// Free Manga Translator - Background Service Worker
// Multi-provider translation engine with bubble detection + fallback chain

// ===== Provider Configuration =====
const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const GEMINI_ENDPOINTS = [
  { version: 'v1beta', model: 'gemini-2.5-flash' },
  { version: 'v1', model: 'gemini-2.5-flash' },
  { version: 'v1beta', model: 'gemini-2.0-flash' },
  { version: 'v1', model: 'gemini-2.0-flash' },
  { version: 'v1beta', model: 'gemini-1.5-flash' },
];
let workingGeminiEndpoint = null;

const PROVIDERS = {
  gemini:     { name: 'Gemini',     storageKey: 'geminiApiKeys' },
  github:     { name: 'GitHub',     storageKey: 'githubApiKey',     url: 'https://models.inference.ai.azure.com/chat/completions',  model: 'gpt-4o-mini' },
  groq:       { name: 'Groq',       storageKey: 'groqApiKey',       url: 'https://api.groq.com/openai/v1/chat/completions',         model: 'llama-3.2-11b-vision-preview' },
  mistral:    { name: 'Mistral',    storageKey: 'mistralApiKey',    url: 'https://api.mistral.ai/v1/chat/completions',              model: 'pixtral-12b-2409' },
  openrouter: { name: 'OpenRouter', storageKey: 'openrouterApiKey', url: 'https://openrouter.ai/api/v1/chat/completions',           model: 'qwen/qwen3.6-plus-preview:free' },
};

const FALLBACK_ORDER = ['gemini', 'github', 'groq', 'mistral', 'openrouter'];
const MAX_CONCURRENT = 3;
const MAX_DIMENSION = 1800;

// ===== Translation Prompt =====
function buildTranslationPrompt(width, height) {
  const hasDims = width > 0 && height > 0;
  const dimText = hasDims ? ` This image is ${width} x ${height} pixels.` : '';
  const rangeText = hasDims ? ` X: 0 to ${width}. Y: 0 to ${height}.` : '';

  return `You are a manga translator.${dimText}

Find ALL speech bubbles and text in Japanese/Chinese/Korean. Translate each to English.
For each, give the bounding box of the WHITE INTERIOR of the speech bubble.

Return ONLY a JSON array:
[{"translatedText":"English here","minX":100,"minY":200,"maxX":350,"maxY":400}]

RULES:
- Coordinates = pixel positions from top-left (0,0).${rangeText}
- Box must cover the FULL WHITE AREA inside the bubble where text appears
- Each bubble's Y coordinates must match its ACTUAL vertical position in the image
- Scan ALL panels top to bottom — do not miss any text
- Translate sound effects (e.g. ドキドキ → *ba-dump*)
- Return [] if no Asian text found
- No text outside the JSON array`;
}

// ===== State =====
const outgoingRequests = new Map();
const requestQueue = [];
const translationCache = {};
let geminiKeyIndex = 0;

// ===== Fast Hash =====
function fastHash(str) {
  if (!str) return '';
  const len = str.length;
  let h = 2166136261 >>> 0;
  const step = Math.max(1, Math.floor(len / 2000));
  for (let i = 0; i < len; i += step) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
    h = h >>> 0;
  }
  h ^= len;
  h = Math.imul(h, 16777619) >>> 0;
  return h.toString(36);
}

// ===== Settings =====
async function getSettings() {
  const result = await chrome.storage.local.get([
    'geminiApiKeys', 'geminiApiKey', 'openrouterApiKey',
    'githubApiKey', 'groqApiKey', 'mistralApiKey',
    'preferredProvider'
  ]);
  let geminiKeys = (result.geminiApiKeys || []).map(k => k.trim()).filter(k => k.length > 0);
  if (geminiKeys.length === 0 && result.geminiApiKey) {
    geminiKeys = [result.geminiApiKey.trim()];
  }
  return {
    geminiKeys,
    githubKey:     (result.githubApiKey || '').trim() || null,
    groqKey:       (result.groqApiKey || '').trim() || null,
    mistralKey:    (result.mistralApiKey || '').trim() || null,
    openrouterKey: (result.openrouterApiKey || '').trim() || null,
    preferredProvider: result.preferredProvider || 'gemini'
  };
}

function getNextGeminiKey(keys) {
  if (keys.length === 0) return null;
  const key = keys[geminiKeyIndex % keys.length];
  geminiKeyIndex++;
  return key;
}

// ===== Blob to Base64 =====
function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// ===== Parse Translation Response =====
function parseTranslationResponse(textContent) {
  if (!textContent) return [];
  try {
    let cleaned = textContent.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    const translations = JSON.parse(cleaned);
    if (!Array.isArray(translations)) return [];
    return translations.filter(t =>
      t.translatedText &&
      typeof t.minX === 'number' && typeof t.minY === 'number' &&
      typeof t.maxX === 'number' && typeof t.maxY === 'number' &&
      t.maxX > t.minX && t.maxY > t.minY
    ).map(t => ({
      translatedText: t.translatedText.trim(),
      minX: Math.max(0, Math.round(t.minX)),
      minY: Math.max(0, Math.round(t.minY)),
      maxX: Math.round(t.maxX),
      maxY: Math.round(t.maxY)
    }));
  } catch (e) {
    console.error('[FMT] Failed to parse:', textContent.substring(0, 200));
    return [];
  }
}

// ================================================================
//  TEXT-REGION BUBBLE DETECTION — finds dark text on white background,
//  clusters characters into text groups, then expands each group
//  outward until hitting the speech bubble's black border.
//  Ported from the Python debug_expand_boxes.py approach.
// ================================================================

// Helper: decode base64 data URL to Blob (avoids fetch(dataUrl) issues in SW)
function base64ToBlob(dataUrl) {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  const raw = atob(parts[1]);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function detectAndSnapBubbles(base64Data, translations) {
  if (!translations || translations.length === 0) return translations;

  try {
    // --- Load image ---
    const blob = base64ToBlob(base64Data);
    const bmp = await createImageBitmap(blob);
    const W = bmp.width, H = bmp.height;
    console.log(`[FMT] Bubble detect: image ${W}x${H}, ${translations.length} translations`);

    // Downsample 2x for accuracy
    const S = 2;
    const sw = Math.ceil(W / S), sh = Math.ceil(H / S);
    const canvas = new OffscreenCanvas(sw, sh);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0, sw, sh);
    const { data: rgba } = ctx.getImageData(0, 0, sw, sh);
    try { bmp.close(); } catch (_) {} // optional cleanup

    // --- Grayscale + binary masks ---
    const N = sw * sh;
    const darkMask = new Uint8Array(N);
    const whiteMask = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const lum = (rgba[i * 4] * 77 + rgba[i * 4 + 1] * 150 + rgba[i * 4 + 2] * 29) >> 8;
      darkMask[i] = lum <= 140 ? 1 : 0;   // slightly more permissive for JPEG
      whiteMask[i] = lum >= 190 ? 1 : 0;   // slightly more permissive for JPEG
    }

    // --- Integral image of white mask for O(1) white-ratio queries ---
    const iw = sw + 1;
    const integral = new Int32Array(iw * (sh + 1));
    for (let y = 0; y < sh; y++) {
      let rowSum = 0;
      for (let x = 0; x < sw; x++) {
        rowSum += whiteMask[y * sw + x];
        integral[(y + 1) * iw + (x + 1)] = rowSum + integral[y * iw + (x + 1)];
      }
    }

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    function whiteRatio(x0, y0, x1, y1) {
      x0 = clamp(Math.round(x0), 0, sw - 1);
      y0 = clamp(Math.round(y0), 0, sh - 1);
      x1 = clamp(Math.round(x1), 0, sw - 1);
      y1 = clamp(Math.round(y1), 0, sh - 1);
      if (x1 < x0 || y1 < y0) return 0;
      const sum = integral[(y1 + 1) * iw + (x1 + 1)]
                - integral[y0 * iw + (x1 + 1)]
                - integral[(y1 + 1) * iw + x0]
                + integral[y0 * iw + x0];
      return sum / Math.max(1, (x1 - x0 + 1) * (y1 - y0 + 1));
    }

    // --- Step 1: Find text-candidate pixels (dark ink on white background) ---
    const textPx = new Uint8Array(N);
    const CONTEXT = 4;
    let textPxCount = 0;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        if (!darkMask[y * sw + x]) continue;
        if (whiteRatio(x - CONTEXT, y - CONTEXT, x + CONTEXT, y + CONTEXT) >= 0.45) {
          textPx[y * sw + x] = 1;
          textPxCount++;
        }
      }
    }
    console.log(`[FMT] Text candidate pixels: ${textPxCount}`);

    // --- Step 2: Dilate text pixels to group nearby characters ---
    // Kernel half-sizes: 3×5 at 2x ≈ 7×10 at 1x (matches Python's 13×19)
    const KHW = 3, KHH = 5;
    const dilated = new Uint8Array(N);
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        if (!textPx[y * sw + x]) continue;
        const y0d = Math.max(0, y - KHH), y1d = Math.min(sh - 1, y + KHH);
        const x0d = Math.max(0, x - KHW), x1d = Math.min(sw - 1, x + KHW);
        for (let dy = y0d; dy <= y1d; dy++) {
          for (let dx = x0d; dx <= x1d; dx++) {
            dilated[dy * sw + dx] = 1;
          }
        }
      }
    }

    // --- Step 3: BFS connected components on dilated mask ---
    const labels = new Int32Array(N);
    const clusters = [];

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const i = y * sw + x;
        if (!dilated[i] || labels[i]) continue;

        const lbl = clusters.length + 1;
        const queue = [i];
        labels[i] = lbl;
        let head = 0;
        let tMinX = sw, tMaxX = 0, tMinY = sh, tMaxY = 0;
        let textCount = 0;

        while (head < queue.length) {
          const ci = queue[head++];
          const cx = ci % sw, cy = (ci - cx) / sw;

          if (textPx[ci]) {
            textCount++;
            if (cx < tMinX) tMinX = cx;
            if (cx > tMaxX) tMaxX = cx;
            if (cy < tMinY) tMinY = cy;
            if (cy > tMaxY) tMaxY = cy;
          }

          if (cx > 0     && dilated[ci - 1]  && !labels[ci - 1])  { labels[ci - 1]  = lbl; queue.push(ci - 1); }
          if (cx < sw - 1 && dilated[ci + 1]  && !labels[ci + 1])  { labels[ci + 1]  = lbl; queue.push(ci + 1); }
          if (cy > 0     && dilated[ci - sw] && !labels[ci - sw]) { labels[ci - sw] = lbl; queue.push(ci - sw); }
          if (cy < sh - 1 && dilated[ci + sw] && !labels[ci + sw]) { labels[ci + sw] = lbl; queue.push(ci + sw); }
        }

        // Filter: enough text pixels, reasonable size, white context
        if (textCount < 15) continue;
        const bw = tMaxX - tMinX + 1, bh = tMaxY - tMinY + 1;
        if (bw < 6 || bh < 6) continue;
        if (bw > sw * 0.50 && bh > sh * 0.30) continue;
        if (whiteRatio(tMinX - 5, tMinY - 5, tMaxX + 5, tMaxY + 5) < 0.50) continue;

        clusters.push({
          minX: tMinX, minY: tMinY, maxX: tMaxX, maxY: tMaxY,
          cx: (tMinX + tMaxX) / 2, cy: (tMinY + tMaxY) / 2,
          textCount
        });
      }
    }

    console.log(`[FMT] Text clusters found: ${clusters.length}`);
    for (const c of clusters) {
      console.log(`[FMT]   cluster at (${c.minX*S},${c.minY*S})-(${c.maxX*S},${c.maxY*S}) textPx=${c.textCount}`);
    }

    // --- Expand a box outward while staying in white region (bubble interior) ---
    function expandToBubble(seedMinX, seedMinY, seedMaxX, seedMaxY) {
      let minX = clamp(seedMinX - 2, 0, sw - 1);
      let minY = clamp(seedMinY - 2, 0, sh - 1);
      let maxX = clamp(seedMaxX + 2, 0, sw - 1);
      let maxY = clamp(seedMaxY + 2, 0, sh - 1);

      const tightW = maxX - minX + 1, tightH = maxY - minY + 1;
      const tightDiag = Math.max(1, Math.sqrt(tightW * tightH));

      const minPadX = clamp(Math.round(Math.max(3, Math.min(6, tightDiag * 0.11))), 3, 6);
      const minPadY = clamp(Math.round(Math.max(2, Math.min(5, tightDiag * 0.07))), 2, 5);
      const targetPadX = clamp(Math.round(Math.max(minPadX + 2, Math.min(13, tightH * 0.08 + tightDiag * 0.09))), minPadX + 1, 13);
      const targetPadY = clamp(Math.round(Math.max(minPadY + 2, Math.min(9, tightH * 0.05 + tightDiag * 0.05))), minPadY + 1, 9);

      function growSide(side, steps, stripMin, fullMin) {
        for (let s = 0; s < steps; s++) {
          if (side === 'L') {
            if (minX <= 0) break;
            if (whiteRatio(minX - 1, minY, minX - 1, maxY) >= stripMin &&
                whiteRatio(minX - 1, minY, maxX, maxY) >= fullMin) minX--;
            else break;
          } else if (side === 'R') {
            if (maxX >= sw - 1) break;
            if (whiteRatio(maxX + 1, minY, maxX + 1, maxY) >= stripMin &&
                whiteRatio(minX, minY, maxX + 1, maxY) >= fullMin) maxX++;
            else break;
          } else if (side === 'T') {
            if (minY <= 0) break;
            if (whiteRatio(minX, minY - 1, maxX, minY - 1) >= stripMin &&
                whiteRatio(minX, minY - 1, maxX, maxY) >= fullMin) minY--;
            else break;
          } else if (side === 'B') {
            if (maxY >= sh - 1) break;
            if (whiteRatio(minX, maxY + 1, maxX, maxY + 1) >= stripMin &&
                whiteRatio(minX, minY, maxX, maxY + 1) >= fullMin) maxY++;
            else break;
          }
        }
      }

      // Pass 1: guaranteed minimum padding
      growSide('L', minPadX, 0.44, 0.48);
      growSide('R', minPadX, 0.44, 0.48);
      growSide('T', minPadY, 0.42, 0.46);
      growSide('B', minPadY, 0.42, 0.46);

      // Pass 2: extra growth, stops at bubble border
      growSide('L', Math.max(0, targetPadX - minPadX), 0.56, 0.60);
      growSide('R', Math.max(0, targetPadX - minPadX), 0.56, 0.60);
      growSide('T', Math.max(0, targetPadY - minPadY), 0.54, 0.58);
      growSide('B', Math.max(0, targetPadY - minPadY), 0.54, 0.58);

      // Trim dark edges
      for (let p = 0; p < 4; p++) {
        if (minX < maxX && whiteRatio(minX, minY, minX, maxY) < 0.50) minX++;
        if (maxX > minX && whiteRatio(maxX, minY, maxX, maxY) < 0.50) maxX--;
        if (minY < maxY && whiteRatio(minX, minY, maxX, minY) < 0.48) minY++;
        if (maxY > minY && whiteRatio(minX, maxY, maxX, maxY) < 0.48) maxY--;
      }

      // Max size cap
      const maxW = Math.min(Math.round(sw * 0.35), Math.max(Math.round(tightW * 2.8), tightW + 15));
      const maxH = Math.min(Math.round(sh * 0.38), Math.max(Math.round(tightH * 2.2), tightH + 12));
      let curW = maxX - minX + 1, curH = maxY - minY + 1;
      if (curW > maxW) {
        const ex = curW - maxW;
        minX = clamp(minX + Math.floor(ex / 2), 0, sw - 1);
        maxX = clamp(maxX - Math.ceil(ex / 2), 0, sw - 1);
      }
      if (curH > maxH) {
        const ex = curH - maxH;
        minY = clamp(minY + Math.floor(ex / 2), 0, sh - 1);
        maxY = clamp(maxY - Math.ceil(ex / 2), 0, sh - 1);
      }

      return { minX, minY, maxX, maxY };
    }

    // --- Fallback: grow from any center point outward in white region ---
    function growFromCenter(cx, cy) {
      cx = clamp(Math.round(cx), 0, sw - 1);
      cy = clamp(Math.round(cy), 0, sh - 1);
      let minX = cx, maxX = cx, minY = cy, maxY = cy;
      const LIMIT = Math.round(Math.min(sw, sh) * 0.25);

      // Grow each direction until white ratio of the new strip drops below threshold
      for (let s = 0; s < LIMIT; s++) {
        if (minX > 0 && whiteRatio(minX - 1, minY, minX - 1, maxY) >= 0.55) minX--;
        else break;
      }
      for (let s = 0; s < LIMIT; s++) {
        if (maxX < sw - 1 && whiteRatio(maxX + 1, minY, maxX + 1, maxY) >= 0.55) maxX++;
        else break;
      }
      for (let s = 0; s < LIMIT; s++) {
        if (minY > 0 && whiteRatio(minX, minY - 1, maxX, minY - 1) >= 0.55) minY--;
        else break;
      }
      for (let s = 0; s < LIMIT; s++) {
        if (maxY < sh - 1 && whiteRatio(minX, maxY + 1, maxX, maxY + 1) >= 0.55) maxY++;
        else break;
      }

      const bw = maxX - minX + 1, bh = maxY - minY + 1;
      if (bw < 10 || bh < 10) return null; // not inside a white region
      return { minX, minY, maxX, maxY };
    }

    // --- Step 4: Match translations to clusters ---
    // Strategy: sort both by position (top-to-bottom, left-to-right) and match in order.
    // This works because both the LLM and the detected clusters follow reading order.
    // We fall back to distance-based matching only when counts differ.

    const sortedClusterIndices = clusters
      .map((c, i) => ({ i, cy: c.cy, cx: c.cx }))
      .sort((a, b) => a.cy - b.cy || a.cx - b.cx)
      .map(o => o.i);

    const sortedTranslationIndices = translations
      .map((t, i) => ({ i, cy: (t.minY + t.maxY) / 2, cx: (t.minX + t.maxX) / 2 }))
      .sort((a, b) => a.cy - b.cy || a.cx - b.cx)
      .map(o => o.i);

    const result = [...translations];

    if (clusters.length > 0) {
      // Match by position order: Nth translation (by y-pos) → Nth cluster (by y-pos)
      const matched = Math.min(sortedTranslationIndices.length, sortedClusterIndices.length);
      const usedClusters = new Set();

      for (let m = 0; m < matched; m++) {
        const ti = sortedTranslationIndices[m];
        const ci = sortedClusterIndices[m];
        usedClusters.add(ci);

        const c = clusters[ci];
        const expanded = expandToBubble(c.minX, c.minY, c.maxX, c.maxY);

        result[ti] = {
          ...translations[ti],
          minX: Math.round(expanded.minX * S),
          minY: Math.round(expanded.minY * S),
          maxX: Math.round(Math.min((expanded.maxX + 1) * S, W)),
          maxY: Math.round(Math.min((expanded.maxY + 1) * S, H))
        };
        console.log(`[FMT] Matched T${ti} → C${ci}: (${result[ti].minX},${result[ti].minY})-(${result[ti].maxX},${result[ti].maxY})`);
      }

      // Unmatched translations: try growFromCenter fallback
      for (let m = matched; m < sortedTranslationIndices.length; m++) {
        const ti = sortedTranslationIndices[m];
        const t = translations[ti];
        const cx = (t.minX + t.maxX) / (2 * S);
        const cy = (t.minY + t.maxY) / (2 * S);
        const fb = growFromCenter(cx, cy);
        if (fb) {
          result[ti] = {
            ...t,
            minX: Math.round(fb.minX * S),
            minY: Math.round(fb.minY * S),
            maxX: Math.round(Math.min((fb.maxX + 1) * S, W)),
            maxY: Math.round(Math.min((fb.maxY + 1) * S, H))
          };
          console.log(`[FMT] Fallback T${ti}: growFromCenter → (${result[ti].minX},${result[ti].minY})-(${result[ti].maxX},${result[ti].maxY})`);
        }
      }
    }

    return result;
  } catch (e) {
    console.error('[FMT] Bubble detection FAILED:', e.message, e.stack);
    return translations;
  }
}

// ================================================================
//  GEMINI API
// ================================================================
async function callGeminiApiWithEndpoint(base64Data, apiKey, endpoint, prompt) {
  const base64Clean = base64Data.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
  const url = `${GEMINI_BASE}/${endpoint.version}/models/${endpoint.model}:generateContent?key=${apiKey.trim()}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: prompt },
        { inlineData: { mimeType: 'image/png', data: base64Clean } }
      ]}],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 4096 }
    })
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error('RATE_LIMITED');
    if (res.status === 403) throw new Error('INVALID_API_KEY');
    if (res.status === 400) {
      if (body.includes('API_KEY_INVALID') || body.includes('API key expired') || body.includes('API key not valid'))
        throw new Error('INVALID_API_KEY');
      if (body.includes('not found') || body.includes('is not supported') || body.includes('does not exist'))
        throw new Error('MODEL_NOT_FOUND');
      throw new Error('BAD_REQUEST: ' + body.substring(0, 200));
    }
    if (res.status === 404) throw new Error('MODEL_NOT_FOUND');
    throw new Error(`API_ERROR_${res.status}`);
  }
  const data = await res.json();
  return parseTranslationResponse(data.candidates?.[0]?.content?.parts?.[0]?.text);
}

async function callGemini(base64Data, apiKey, prompt) {
  if (workingGeminiEndpoint) {
    return await callGeminiApiWithEndpoint(base64Data, apiKey, workingGeminiEndpoint, prompt);
  }
  let lastError = null;
  for (const ep of GEMINI_ENDPOINTS) {
    try {
      const result = await callGeminiApiWithEndpoint(base64Data, apiKey, ep, prompt);
      workingGeminiEndpoint = ep;
      console.log(`[FMT] Gemini endpoint: ${ep.version}/${ep.model}`);
      return result;
    } catch (error) {
      lastError = error;
      if (error.message === 'MODEL_NOT_FOUND') continue;
      throw error;
    }
  }
  throw lastError || new Error('NO_WORKING_ENDPOINT');
}

// ================================================================
//  UNIFIED OpenAI-compatible API call
// ================================================================
async function callOpenAICompatible(base64Data, apiKey, providerUrl, model, extraHeaders, prompt) {
  const base64WithPrefix = base64Data.startsWith('data:') ? base64Data : `data:image/png;base64,${base64Data}`;
  const res = await fetch(providerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.trim()}`,
      ...extraHeaders
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: base64WithPrefix } }
        ]
      }],
      temperature: 0.1,
      max_tokens: 4096
    })
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error('RATE_LIMITED');
    if (res.status === 401 || res.status === 403) throw new Error('INVALID_API_KEY');
    throw new Error(`API_ERROR_${res.status}: ${body.substring(0, 150)}`);
  }
  const data = await res.json();
  return parseTranslationResponse(data.choices?.[0]?.message?.content);
}

// ================================================================
//  Provider dispatch
// ================================================================
async function callProvider(providerId, base64Data, settings, prompt) {
  switch (providerId) {
    case 'gemini': {
      if (settings.geminiKeys.length === 0) throw new Error('NO_KEY');
      let lastErr = null;
      for (let i = 0; i < settings.geminiKeys.length; i++) {
        const key = getNextGeminiKey(settings.geminiKeys);
        try { return await callGemini(base64Data, key, prompt); }
        catch (e) {
          lastErr = e;
          if (e.message === 'RATE_LIMITED' || e.message === 'INVALID_API_KEY') continue;
          throw e;
        }
      }
      throw lastErr || new Error('ALL_KEYS_FAILED');
    }
    case 'github':
      if (!settings.githubKey) throw new Error('NO_KEY');
      return await callOpenAICompatible(base64Data, settings.githubKey,
        PROVIDERS.github.url, PROVIDERS.github.model, {}, prompt);
    case 'groq':
      if (!settings.groqKey) throw new Error('NO_KEY');
      return await callOpenAICompatible(base64Data, settings.groqKey,
        PROVIDERS.groq.url, PROVIDERS.groq.model, {}, prompt);
    case 'mistral':
      if (!settings.mistralKey) throw new Error('NO_KEY');
      return await callOpenAICompatible(base64Data, settings.mistralKey,
        PROVIDERS.mistral.url, PROVIDERS.mistral.model, {}, prompt);
    case 'openrouter':
      if (!settings.openrouterKey) throw new Error('NO_KEY');
      return await callOpenAICompatible(base64Data, settings.openrouterKey,
        PROVIDERS.openrouter.url, PROVIDERS.openrouter.model,
        { 'HTTP-Referer': 'chrome-extension://free-manga-translator', 'X-Title': 'Free Manga Translator' },
        prompt);
    default: throw new Error('UNKNOWN_PROVIDER');
  }
}

// ================================================================
//  translateWithProviders — preferred first, then fallback chain
// ================================================================
async function translateWithProviders(base64Data, width, height) {
  const settings = await getSettings();
  const prompt = buildTranslationPrompt(width, height);

  const preferred = settings.preferredProvider || 'gemini';
  const order = [preferred, ...FALLBACK_ORDER.filter(p => p !== preferred)];

  let lastError = null;
  for (const providerId of order) {
    try {
      return await callProvider(providerId, base64Data, settings, prompt);
    } catch (error) {
      lastError = error;
      console.warn(`[FMT] ${PROVIDERS[providerId]?.name || providerId} failed:`, error.message);
      continue;
    }
  }

  if (lastError?.message === 'NO_KEY') throw new Error('NO_API_KEY');
  throw lastError || new Error('ALL_PROVIDERS_FAILED');
}

// ===== Process Translation (dedup + cache + bubble snap) =====
async function processTranslation(message) {
  const base64Data = message.base64Data;
  const imgWidth = message.width || 0;
  const imgHeight = message.height || 0;
  const id = fastHash(base64Data);

  if (translationCache[id]) return { translations: translationCache[id] };

  if (outgoingRequests.has(id)) {
    try { return await outgoingRequests.get(id); }
    catch (e) { return { error: e.message }; }
  }

  if (outgoingRequests.size >= MAX_CONCURRENT) return { error: 'FullQueue' };

  const promise = (async () => {
    try {
      let translations = await translateWithProviders(base64Data, imgWidth, imgHeight);

      // Snap translations to detected speech bubbles
      if (translations && translations.length > 0) {
        translations = await detectAndSnapBubbles(base64Data, translations);
      }

      if (translations && translations.length >= 0) {
        translationCache[id] = translations;
        const keys = Object.keys(translationCache);
        if (keys.length > 300) delete translationCache[keys[0]];
      }
      return { translations };
    } catch (error) {
      console.error('[FMT] Translation error:', error.message);
      return { error: error.message };
    } finally {
      outgoingRequests.delete(id);
      processQueue();
    }
  })();

  outgoingRequests.set(id, promise);
  return promise;
}

// ===== Queue =====
function processQueue() {
  while (requestQueue.length > 0 && outgoingRequests.size < MAX_CONCURRENT) {
    const { message, resolve } = requestQueue.shift();
    processTranslation(message).then(resolve);
  }
}

function queueTranslation(message) {
  return new Promise((resolve) => {
    if (outgoingRequests.size < MAX_CONCURRENT) {
      processTranslation(message).then(resolve);
    } else {
      requestQueue.push({ message, resolve });
    }
  });
}

// ===== Tab Capture =====
async function captureAndTranslate(tabId, dimensions) {
  try {
    const dataUrl = await new Promise(resolve =>
      chrome.tabs.captureVisibleTab(null, { format: 'png' }, resolve));
    if (!dataUrl) return { error: 'CAPTURE_FAILED' };

    const zoomFactor = await new Promise(resolve => chrome.tabs.getZoom(tabId, resolve));
    const dpr = dimensions.devicePixelRatio || 1;
    const scale = zoomFactor * dpr;

    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob,
      Math.round(dimensions.left * scale), Math.round(dimensions.top * scale),
      Math.round(dimensions.width * scale), Math.round(dimensions.height * scale));

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext('bitmaprenderer').transferFromImageBitmap(bitmap);
    const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
    const base64Data = await blobToBase64(croppedBlob);

    const result = await queueTranslation({
      base64Data,
      width: bitmap.width,
      height: bitmap.height
    });
    return { ...result, zoomFactor };
  } catch (error) {
    console.error('[FMT] Capture error:', error);
    return { error: 'CAPTURE_ERROR: ' + error.message };
  }
}

// ===== Tiny 1x1 white PNG for multimodal key testing =====
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

async function testProviderKey(providerId, apiKey) {
  const key = (apiKey || '').trim();
  if (!key) return { success: false, error: 'No key provided' };

  if (providerId === 'gemini') {
    for (const ep of GEMINI_ENDPOINTS) {
      const base64Clean = TINY_PNG.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
      const url = `${GEMINI_BASE}/${ep.version}/models/${ep.model}:generateContent?key=${key}`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [
              { text: 'Say OK' },
              { inlineData: { mimeType: 'image/png', data: base64Clean } }
            ]}],
            generationConfig: { maxOutputTokens: 5 }
          })
        });
        if (res.ok) {
          workingGeminiEndpoint = ep;
          return { success: true, message: `Works with ${ep.model} (${ep.version})` };
        }
        const body = await res.text();
        if (body.includes('API_KEY_INVALID') || body.includes('API key expired'))
          return { success: false, error: `Key rejected (HTTP ${res.status}).` };
        if (res.status === 404 || body.includes('not found')) continue;
      } catch (e) {
        return { success: false, error: 'Network error: ' + e.message };
      }
    }
    return { success: false, error: 'No compatible Gemini model found.' };
  }

  const provider = PROVIDERS[providerId];
  if (!provider?.url) return { success: false, error: 'Unknown provider' };

  const extraHeaders = providerId === 'openrouter'
    ? { 'HTTP-Referer': 'chrome-extension://free-manga-translator', 'X-Title': 'Free Manga Translator' }
    : {};

  try {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, ...extraHeaders },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: 'user', content: [
          { type: 'text', text: 'Say OK' },
          { type: 'image_url', image_url: { url: TINY_PNG } }
        ]}],
        max_tokens: 5
      })
    });
    if (res.ok) return { success: true, message: `Works with ${provider.model}` };
    const body = await res.text();
    return { success: false, error: `HTTP ${res.status}: ${body.substring(0, 120)}` };
  } catch (e) {
    return { success: false, error: 'Network error: ' + e.message };
  }
}

// ===== Message Handler =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.kind === 'translateImage') {
    queueTranslation(message).then(sendResponse);
    return true;
  }
  if (message.kind === 'translateSnapshot') {
    captureAndTranslate(sender.tab?.id || message.tabId, message.dimensions).then(sendResponse);
    return true;
  }
  if (message.kind === 'testProviderKey') {
    testProviderKey(message.provider, message.apiKey).then(sendResponse);
    return true;
  }
  if (message.kind === 'getTranslationStats') {
    sendResponse({ cacheSize: Object.keys(translationCache).length, activeRequests: outgoingRequests.size, queueLength: requestQueue.length });
    return true;
  }
  if (message.kind === 'clearCache') {
    for (const k in translationCache) delete translationCache[k];
    sendResponse({ success: true });
    return true;
  }
  if (message.kind === 'startTranslationPanel') {
    chrome.scripting.executeScript({ target: { tabId: message.tabId }, files: ['translationPanel.js'] });
    return false;
  }
});

// ===== Context Menu =====
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'translateMangaImage', title: 'Translate this manga panel', contexts: ['image'] });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'translateMangaImage' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { kind: 'translateSpecificImage', imageUrl: info.srcUrl });
  }
});

// ===== Icon =====
async function updateIcon() {
  const s = await getSettings();
  const hasKey = s.geminiKeys.length > 0 || !!s.githubKey || !!s.groqKey || !!s.mistralKey || !!s.openrouterKey;
  chrome.action.setIcon({
    path: {
      '16': hasKey ? 'icons/16x16.png' : 'icons/128x128-disabled.png',
      '48': hasKey ? 'icons/48x48.png' : 'icons/128x128-disabled.png',
      '128': hasKey ? 'icons/128x128.png' : 'icons/128x128-disabled.png'
    }
  });
}
chrome.storage.onChanged.addListener((changes) => {
  if (changes.geminiApiKeys || changes.githubApiKey || changes.groqApiKey || changes.mistralApiKey || changes.openrouterApiKey)
    updateIcon();
});
updateIcon();
