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
  openrouter: { name: 'OpenRouter', storageKey: 'openrouterApiKey', url: 'https://openrouter.ai/api/v1/chat/completions',           model: 'google/gemma-3-27b-it:free' },
};

const FALLBACK_ORDER = ['gemini', 'github', 'groq', 'mistral', 'openrouter'];
const MAX_CONCURRENT = 3;
const MAX_DIMENSION = 1800;
const CACHE_VERSION = 'tight-text-v6-local-lock';
const ENABLE_LOCAL_TEXT_REFINEMENT = true;
const ENABLE_BUBBLE_SNAPPING = false;

// ===== Translation Prompt =====
function buildTranslationPrompt(width, height) {
  const hasDims = width > 0 && height > 0;
  const dimText = hasDims ? ` This image is ${width} x ${height} pixels.` : '';
  const rangeText = hasDims ? ` X: 0 to ${width}. Y: 0 to ${height}.` : '';

  return `You are a manga translator.${dimText}

Task:
1) Detect every Japanese/Chinese/Korean text region.
2) For each detected region, extract the exact source text from that region.
3) Translate that source text to natural English.

For each item, return a TIGHT box around SOURCE GLYPHS only (characters/ink), not bubble interior.

Return ONLY a JSON array:
[{"sourceText":"ダウン症とは","translatedText":"Down syndrome is...","minX":100,"minY":200,"maxX":350,"maxY":400}]

RULES:
- Coordinates = pixel positions from top-left (0,0).${rangeText}
- Each box must be TIGHT around visible source characters, not the full bubble interior
- Do NOT output panel-wide/gutter-wide boxes and do NOT merge distant text groups into one box
- One item = one contiguous text group only (speech block, SFX block, caption block)
- sourceText must match characters physically inside that exact box
- Prefer smaller/tighter boxes when uncertain
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
let envDefaultsPromise = null;

function normalizeEnvValue(raw) {
  let value = (raw || '').trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value.trim();
}

function isPlaceholderValue(value) {
  return !value || /YOUR_|REPLACE|CHANGE_ME|<.*>/i.test(value);
}

function parseEnvDefaults(envText) {
  const parsed = {
    geminiApiKeys: [],
    githubApiKey: '',
    groqApiKey: '',
    mistralApiKey: '',
    openrouterApiKey: '',
    preferredProvider: ''
  };

  const lines = String(envText || '').split(/\r?\n/);
  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    const value = normalizeEnvValue(line.slice(eq + 1));
    if (!value) continue;

    switch (key) {
      case 'GEMINI_API_KEYS':
        parsed.geminiApiKeys = value
          .split(',')
          .map(v => normalizeEnvValue(v))
          .filter(v => !isPlaceholderValue(v));
        break;
      case 'GEMINI_API_KEY':
        if (!isPlaceholderValue(value)) parsed.geminiApiKeys.push(value);
        break;
      case 'GITHUB_API_KEY':
        if (!isPlaceholderValue(value)) parsed.githubApiKey = value;
        break;
      case 'GROQ_API_KEY':
        if (!isPlaceholderValue(value)) parsed.groqApiKey = value;
        break;
      case 'MISTRAL_API_KEY':
        if (!isPlaceholderValue(value)) parsed.mistralApiKey = value;
        break;
      case 'OPENROUTER_API_KEY':
        if (!isPlaceholderValue(value)) parsed.openrouterApiKey = value;
        break;
      case 'PREFERRED_PROVIDER':
        parsed.preferredProvider = value;
        break;
    }
  }

  if (parsed.geminiApiKeys.length > 0) {
    parsed.geminiApiKeys = Array.from(new Set(parsed.geminiApiKeys));
  }

  return parsed;
}

async function loadEnvDefaults() {
  if (!envDefaultsPromise) {
    envDefaultsPromise = (async () => {
      try {
        const resp = await fetch(chrome.runtime.getURL('.env'));
        if (!resp.ok) return {};
        return parseEnvDefaults(await resp.text());
      } catch {
        return {};
      }
    })();
  }
  return envDefaultsPromise;
}

async function getSettings() {
  const [result, envDefaults] = await Promise.all([
    chrome.storage.local.get([
      'geminiApiKeys', 'geminiApiKey', 'openrouterApiKey',
      'githubApiKey', 'groqApiKey', 'mistralApiKey',
      'preferredProvider'
    ]),
    loadEnvDefaults()
  ]);

  let geminiKeys = (result.geminiApiKeys || []).map(k => k.trim()).filter(k => k.length > 0);
  if (geminiKeys.length === 0 && result.geminiApiKey) {
    geminiKeys = [result.geminiApiKey.trim()];
  }
  if (geminiKeys.length === 0 && envDefaults.geminiApiKeys?.length > 0) {
    geminiKeys = envDefaults.geminiApiKeys;
  }

  return {
    geminiKeys,
    githubKey:     (result.githubApiKey || envDefaults.githubApiKey || '').trim() || null,
    groqKey:       (result.groqApiKey || envDefaults.groqApiKey || '').trim() || null,
    mistralKey:    (result.mistralApiKey || envDefaults.mistralApiKey || '').trim() || null,
    openrouterKey: (result.openrouterApiKey || envDefaults.openrouterApiKey || '').trim() || null,
    preferredProvider: result.preferredProvider || envDefaults.preferredProvider || 'gemini'
  };
}

async function hydrateEnvKeysToStorage() {
  const envDefaults = await loadEnvDefaults();
  if (!envDefaults || Object.keys(envDefaults).length === 0) return;

  const existing = await chrome.storage.local.get([
    'geminiApiKeys', 'githubApiKey', 'groqApiKey',
    'mistralApiKey', 'openrouterApiKey', 'preferredProvider'
  ]);

  const updates = {};
  const existingGemini = (existing.geminiApiKeys || []).map(k => (k || '').trim()).filter(Boolean);

  if (existingGemini.length === 0 && envDefaults.geminiApiKeys?.length > 0) {
    updates.geminiApiKeys = envDefaults.geminiApiKeys;
  }
  if (!existing.githubApiKey && envDefaults.githubApiKey) updates.githubApiKey = envDefaults.githubApiKey;
  if (!existing.groqApiKey && envDefaults.groqApiKey) updates.groqApiKey = envDefaults.groqApiKey;
  if (!existing.mistralApiKey && envDefaults.mistralApiKey) updates.mistralApiKey = envDefaults.mistralApiKey;
  if (!existing.openrouterApiKey && envDefaults.openrouterApiKey) updates.openrouterApiKey = envDefaults.openrouterApiKey;
  if (!existing.preferredProvider && envDefaults.preferredProvider) updates.preferredProvider = envDefaults.preferredProvider;

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }
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
      sourceText: (typeof t.sourceText === 'string' ? t.sourceText.trim() : ''),
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

function sanitizeTranslationBoxes(translations, width, height) {
  if (!Array.isArray(translations) || translations.length === 0) return [];

  const W = Math.max(1, Math.round(width || 0));
  const H = Math.max(1, Math.round(height || 0));
  const imageArea = W * H;

  const out = [];
  for (const t of translations) {
    const minX = Math.max(0, Math.min(W, Math.round(t.minX)));
    const minY = Math.max(0, Math.min(H, Math.round(t.minY)));
    const maxX = Math.max(0, Math.min(W, Math.round(t.maxX)));
    const maxY = Math.max(0, Math.min(H, Math.round(t.maxY)));
    const w = maxX - minX;
    const h = maxY - minY;

    if (w < 4 || h < 4) continue;

    const area = w * h;
    const suspiciouslyHuge =
      area > imageArea * 0.22 ||
      w > W * 0.82 ||
      h > H * 0.82;

    if (suspiciouslyHuge) continue;

    out.push({
      sourceText: t.sourceText || '',
      translatedText: t.translatedText,
      minX,
      minY,
      maxX,
      maxY,
    });
  }

  return out;
}

// ===== Local coordinate refinement: snap model boxes onto nearby source glyph clusters =====
async function refineBoxesToLocalTextRegions(base64Data, translations, width, height) {
  if (!Array.isArray(translations) || translations.length === 0) return [];

  try {
    const resp = await fetch(base64Data);
    const blob = await resp.blob();
    const bmp = await createImageBitmap(blob);

    const W = Math.max(1, Math.round(width || bmp.width));
    const H = Math.max(1, Math.round(height || bmp.height));
    const imgArea = W * H;

    const canvas = new OffscreenCanvas(W, H);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0, W, H);
    const rgba = ctx.getImageData(0, 0, W, H).data;

    const N = W * H;
    const white = new Uint8Array(N);
    const dark = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const r = rgba[i * 4];
      const g = rgba[i * 4 + 1];
      const b = rgba[i * 4 + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      white[i] = lum >= 200 ? 1 : 0;
      dark[i] = lum <= 135 ? 1 : 0;
    }

    const IW = W + 1;
    const integralWhite = new Int32Array((W + 1) * (H + 1));
    for (let y = 1; y <= H; y++) {
      let rowSum = 0;
      const rowBase = (y - 1) * W;
      for (let x = 1; x <= W; x++) {
        rowSum += white[rowBase + (x - 1)];
        integralWhite[y * IW + x] = integralWhite[(y - 1) * IW + x] + rowSum;
      }
    }

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const rectIntersects = (a, b) => !(a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY);
    const boxGap = (a, b) => ({
      dx: Math.max(0, Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX)),
      dy: Math.max(0, Math.max(a.minY, b.minY) - Math.min(a.maxY, b.maxY)),
    });
    const iou = (a, b) => {
      const ix0 = Math.max(a.minX, b.minX);
      const iy0 = Math.max(a.minY, b.minY);
      const ix1 = Math.min(a.maxX, b.maxX);
      const iy1 = Math.min(a.maxY, b.maxY);
      const iw = Math.max(0, ix1 - ix0 + 1);
      const ih = Math.max(0, iy1 - iy0 + 1);
      const inter = iw * ih;
      const aa = Math.max(1, (a.maxX - a.minX + 1) * (a.maxY - a.minY + 1));
      const bb = Math.max(1, (b.maxX - b.minX + 1) * (b.maxY - b.minY + 1));
      return inter / Math.max(1, aa + bb - inter);
    };

    function whiteRatio(x0, y0, x1, y1) {
      const ax = clamp(Math.round(x0), 0, W - 1);
      const ay = clamp(Math.round(y0), 0, H - 1);
      const bx = clamp(Math.round(x1), 0, W - 1);
      const by = clamp(Math.round(y1), 0, H - 1);
      if (bx < ax || by < ay) return 0;

      const sx0 = ax;
      const sy0 = ay;
      const sx1 = bx + 1;
      const sy1 = by + 1;
      const sum =
        integralWhite[sy1 * IW + sx1] -
        integralWhite[sy0 * IW + sx1] -
        integralWhite[sy1 * IW + sx0] +
        integralWhite[sy0 * IW + sx0];
      const area = (bx - ax + 1) * (by - ay + 1);
      return sum / Math.max(1, area);
    }

    function constrainAndExpandForReadableEnglish(seedBox) {
      let b = {
        minX: clamp(Math.round(seedBox.minX), 0, W - 1),
        minY: clamp(Math.round(seedBox.minY), 0, H - 1),
        maxX: clamp(Math.round(seedBox.maxX), 0, W - 1),
        maxY: clamp(Math.round(seedBox.maxY), 0, H - 1),
      };
      if (b.maxX <= b.minX || b.maxY <= b.minY) return b;

      const tightW = b.maxX - b.minX + 1;
      const tightH = b.maxY - b.minY + 1;
      const tightDiag = Math.max(1, Math.sqrt(tightW * tightH));

      // We bias horizontal growth because English is horizontally set.
      const minPadX = clamp(Math.round(Math.max(6, Math.min(12, tightDiag * 0.11))), 6, 12);
      const minPadY = clamp(Math.round(Math.max(4, Math.min(10, tightDiag * 0.07))), 4, 10);
      const targetPadX = clamp(Math.round(Math.max(minPadX + 5, Math.min(26, tightH * 0.08 + tightDiag * 0.09))), minPadX + 2, 26);
      const targetPadY = clamp(Math.round(Math.max(minPadY + 3, Math.min(18, tightH * 0.05 + tightDiag * 0.05))), minPadY + 1, 18);

      const growSide = (side, steps, stripMinWhite, fullMinWhite) => {
        for (let i = 0; i < steps; i++) {
          if (side === 'left') {
            if (b.minX <= 0) break;
            const strip = whiteRatio(b.minX - 1, b.minY, b.minX - 1, b.maxY);
            const full = whiteRatio(b.minX - 1, b.minY, b.maxX, b.maxY);
            if (strip >= stripMinWhite && full >= fullMinWhite) b.minX -= 1;
            else break;
          } else if (side === 'right') {
            if (b.maxX >= W - 1) break;
            const strip = whiteRatio(b.maxX + 1, b.minY, b.maxX + 1, b.maxY);
            const full = whiteRatio(b.minX, b.minY, b.maxX + 1, b.maxY);
            if (strip >= stripMinWhite && full >= fullMinWhite) b.maxX += 1;
            else break;
          } else if (side === 'top') {
            if (b.minY <= 0) break;
            const strip = whiteRatio(b.minX, b.minY - 1, b.maxX, b.minY - 1);
            const full = whiteRatio(b.minX, b.minY - 1, b.maxX, b.maxY);
            if (strip >= stripMinWhite && full >= fullMinWhite) b.minY -= 1;
            else break;
          } else if (side === 'bottom') {
            if (b.maxY >= H - 1) break;
            const strip = whiteRatio(b.minX, b.maxY + 1, b.maxX, b.maxY + 1);
            const full = whiteRatio(b.minX, b.minY, b.maxX, b.maxY + 1);
            if (strip >= stripMinWhite && full >= fullMinWhite) b.maxY += 1;
            else break;
          }
        }
      };

      // Pass 1: guaranteed modest growth around text if still mostly inside bubble interior.
      growSide('left', minPadX, 0.44, 0.48);
      growSide('right', minPadX, 0.44, 0.48);
      growSide('top', minPadY, 0.42, 0.46);
      growSide('bottom', minPadY, 0.42, 0.46);

      // Pass 2: opportunistic growth for English readability, but stricter white-only constraint.
      growSide('left', Math.max(0, targetPadX - minPadX), 0.56, 0.60);
      growSide('right', Math.max(0, targetPadX - minPadX), 0.56, 0.60);
      growSide('top', Math.max(0, targetPadY - minPadY), 0.54, 0.58);
      growSide('bottom', Math.max(0, targetPadY - minPadY), 0.54, 0.58);

      // Trim dark border strokes if we accidentally touched bubble outlines.
      for (let i = 0; i < 6; i++) {
        if (b.minX < b.maxX && whiteRatio(b.minX, b.minY, b.minX, b.maxY) < 0.50) b.minX += 1;
        if (b.maxX > b.minX && whiteRatio(b.maxX, b.minY, b.maxX, b.maxY) < 0.50) b.maxX -= 1;
        if (b.minY < b.maxY && whiteRatio(b.minX, b.minY, b.maxX, b.minY) < 0.48) b.minY += 1;
        if (b.maxY > b.minY && whiteRatio(b.minX, b.maxY, b.maxX, b.maxY) < 0.48) b.maxY -= 1;
      }

      // Guardrail: never let boxes become panel-sized from expansion.
      const maxW = Math.min(Math.round(W * 0.35), Math.max(Math.round(tightW * 2.8), tightW + 30));
      const maxH = Math.min(Math.round(H * 0.38), Math.max(Math.round(tightH * 2.2), tightH + 24));

      let curW = b.maxX - b.minX + 1;
      let curH = b.maxY - b.minY + 1;

      if (curW > maxW) {
        const excess = curW - maxW;
        const leftTrim = Math.floor(excess / 2);
        const rightTrim = excess - leftTrim;
        b.minX = clamp(b.minX + leftTrim, 0, W - 1);
        b.maxX = clamp(b.maxX - rightTrim, 0, W - 1);
      }
      curW = b.maxX - b.minX + 1;
      if (curW < 8) {
        const center = Math.round((b.minX + b.maxX) / 2);
        b.minX = clamp(center - 4, 0, W - 1);
        b.maxX = clamp(center + 4, 0, W - 1);
      }

      if (curH > maxH) {
        const excess = curH - maxH;
        const topTrim = Math.floor(excess / 2);
        const bottomTrim = excess - topTrim;
        b.minY = clamp(b.minY + topTrim, 0, H - 1);
        b.maxY = clamp(b.maxY - bottomTrim, 0, H - 1);
      }
      curH = b.maxY - b.minY + 1;
      if (curH < 8) {
        const center = Math.round((b.minY + b.maxY) / 2);
        b.minY = clamp(center - 4, 0, H - 1);
        b.maxY = clamp(center + 4, 0, H - 1);
      }

      if (b.maxX <= b.minX || b.maxY <= b.minY) return seedBox;
      return b;
    }

    // Extract text-like connected components from dark pixels
    const seen = new Uint8Array(N);
    const textComps = [];

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const start = y * W + x;
        if (!dark[start] || seen[start]) continue;

        const queue = [start];
        seen[start] = 1;
        let head = 0;
        let area = 0;
        let minX = x, maxX = x, minY = y, maxY = y;

        while (head < queue.length) {
          const idx = queue[head++];
          const cx = idx % W;
          const cy = (idx - cx) / W;
          area++;

          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          for (let ny = cy - 1; ny <= cy + 1; ny++) {
            if (ny < 0 || ny >= H) continue;
            for (let nx = cx - 1; nx <= cx + 1; nx++) {
              if (nx < 0 || nx >= W) continue;
              const ni = ny * W + nx;
              if (dark[ni] && !seen[ni]) {
                seen[ni] = 1;
                queue.push(ni);
              }
            }
          }
        }

        if (area < 6 || area > 280) continue;
        const bw = maxX - minX + 1;
        const bh = maxY - minY + 1;
        const ar = bw / Math.max(1, bh);
        if (ar < 0.12 || ar > 6.2) continue;

        const wr = whiteRatio(minX - 7, minY - 7, maxX + 7, maxY + 7);
        if (wr < 0.5) continue;

        textComps.push({
          minX,
          minY,
          maxX,
          maxY,
          area,
          cx: (minX + maxX) / 2,
          cy: (minY + maxY) / 2,
        });
      }
    }

    if (textComps.length === 0) {
      return translations;
    }

    const diag = Math.max(1, Math.hypot(W, H));
    const refined = translations.map(t => ({ ...t }));

    for (let ti = 0; ti < refined.length; ti++) {
      const t = refined[ti];
      const orig = {
        minX: clamp(Math.round(t.minX), 0, W - 1),
        minY: clamp(Math.round(t.minY), 0, H - 1),
        maxX: clamp(Math.round(t.maxX), 0, W - 1),
        maxY: clamp(Math.round(t.maxY), 0, H - 1),
      };
      if (orig.maxX <= orig.minX || orig.maxY <= orig.minY) continue;

      const bw = orig.maxX - orig.minX + 1;
      const bh = orig.maxY - orig.minY + 1;
      const bArea = bw * bh;
      const suspicious =
        bArea > imgArea * 0.08 ||
        bw > W * 0.45 ||
        bh > H * 0.42 ||
        (bw / Math.max(1, bh)) > 2.8;

      const expand = suspicious ? 150 : 80;
      const search = {
        minX: clamp(orig.minX - expand, 0, W - 1),
        minY: clamp(orig.minY - expand, 0, H - 1),
        maxX: clamp(orig.maxX + expand, 0, W - 1),
        maxY: clamp(orig.maxY + expand, 0, H - 1),
      };

      const candidates = textComps.filter(c => rectIntersects(c, search));
      if (candidates.length === 0) continue;

      const parent = new Int32Array(candidates.length);
      const rank = new Int32Array(candidates.length);
      for (let i = 0; i < candidates.length; i++) parent[i] = i;

      const find = (i) => {
        let p = i;
        while (parent[p] !== p) {
          parent[p] = parent[parent[p]];
          p = parent[p];
        }
        while (parent[i] !== i) {
          const next = parent[i];
          parent[i] = p;
          i = next;
        }
        return p;
      };

      const unite = (a, b) => {
        let ra = find(a);
        let rb = find(b);
        if (ra === rb) return;
        if (rank[ra] < rank[rb]) {
          const tmp = ra; ra = rb; rb = tmp;
        }
        parent[rb] = ra;
        if (rank[ra] === rank[rb]) rank[ra]++;
      };

      for (let i = 0; i < candidates.length; i++) {
        for (let j = i + 1; j < candidates.length; j++) {
          const g = boxGap(candidates[i], candidates[j]);
          if (g.dx <= 13 && g.dy <= 19) {
            unite(i, j);
          }
        }
      }

      const clustersByRoot = new Map();
      for (let i = 0; i < candidates.length; i++) {
        const r = find(i);
        const c = candidates[i];
        if (!clustersByRoot.has(r)) {
          clustersByRoot.set(r, {
            minX: c.minX,
            minY: c.minY,
            maxX: c.maxX,
            maxY: c.maxY,
            compCount: 0,
            pixelCount: 0,
          });
        }
        const cl = clustersByRoot.get(r);
        cl.minX = Math.min(cl.minX, c.minX);
        cl.minY = Math.min(cl.minY, c.minY);
        cl.maxX = Math.max(cl.maxX, c.maxX);
        cl.maxY = Math.max(cl.maxY, c.maxY);
        cl.compCount += 1;
        cl.pixelCount += c.area;
      }

      const ocx = (orig.minX + orig.maxX) / 2;
      const ocy = (orig.minY + orig.maxY) / 2;
      const scored = [];

      for (const cl of clustersByRoot.values()) {
        if (cl.compCount < 5 || cl.pixelCount < 45) continue;

        const cbw = cl.maxX - cl.minX + 1;
        const cbh = cl.maxY - cl.minY + 1;
        if (cbw > W * 0.45 && cbh > H * 0.25) continue;

        const wr = whiteRatio(cl.minX - 10, cl.minY - 10, cl.maxX + 10, cl.maxY + 10);
        if (wr < 0.6) continue;

        const cbox = { minX: cl.minX, minY: cl.minY, maxX: cl.maxX, maxY: cl.maxY };
        const ciou = iou(orig, cbox);
        const ccx = (cl.minX + cl.maxX) / 2;
        const ccy = (cl.minY + cl.maxY) / 2;
        const dist = Math.hypot(ccx - ocx, ccy - ocy) / diag;
        const textiness = Math.min(1, cl.compCount / 20) * 0.7 + Math.min(1, cl.pixelCount / 2200) * 0.3;

        const score = suspicious
          ? (textiness * 1.6 + ciou * 0.9 + (1 - Math.min(1, dist)) * 0.5 + wr * 0.25)
          : (ciou * 1.8 + (1 - Math.min(1, dist)) * 0.9 + textiness * 0.8 + wr * 0.2);

        scored.push({ score, box: cbox });
      }

      let selected = null;
      let sortedScored = [];

      if (scored.length > 0) {
        sortedScored = [...scored].sort((a, b) => b.score - a.score);
      }

      const maxShiftX = clamp(Math.round(bw * 0.75) + 24, 24, 130);
      const maxShiftY = clamp(Math.round(bh * 0.75) + 24, 24, 130);

      if (sortedScored.length > 0 && sortedScored[0].score >= 0.42) {
        const primary = sortedScored[0].box;
        const pcx = (primary.minX + primary.maxX) / 2;
        const pcy = (primary.minY + primary.maxY) / 2;

        if (Math.abs(pcx - ocx) <= maxShiftX && Math.abs(pcy - ocy) <= maxShiftY) {
          selected = { ...primary };
          const supportThreshold = Math.max(0.26, sortedScored[0].score * 0.56);
          for (let i = 1; i < Math.min(sortedScored.length, 10); i++) {
            const s = sortedScored[i];
            if (s.score < supportThreshold) continue;

            const scx = (s.box.minX + s.box.maxX) / 2;
            const scy = (s.box.minY + s.box.maxY) / 2;
            if (Math.abs(scx - ocx) > maxShiftX || Math.abs(scy - ocy) > maxShiftY) continue;

            const g = boxGap(selected, s.box);
            if (g.dx <= 20 && g.dy <= 24) {
              selected.minX = Math.min(selected.minX, s.box.minX);
              selected.minY = Math.min(selected.minY, s.box.minY);
              selected.maxX = Math.max(selected.maxX, s.box.maxX);
              selected.maxY = Math.max(selected.maxY, s.box.maxY);
            }
          }
        }
      }

      if (!selected) continue;

      // Hard lock: never drift too far from original model box neighborhood.
      const anchorPadX = clamp(Math.round(bw * 0.6) + 18, 18, 120);
      const anchorPadY = clamp(Math.round(bh * 0.6) + 18, 18, 120);
      const anchor = {
        minX: clamp(orig.minX - anchorPadX, 0, W - 1),
        minY: clamp(orig.minY - anchorPadY, 0, H - 1),
        maxX: clamp(orig.maxX + anchorPadX, 0, W - 1),
        maxY: clamp(orig.maxY + anchorPadY, 0, H - 1),
      };

      selected.minX = clamp(selected.minX, anchor.minX, anchor.maxX);
      selected.minY = clamp(selected.minY, anchor.minY, anchor.maxY);
      selected.maxX = clamp(selected.maxX, anchor.minX, anchor.maxX);
      selected.maxY = clamp(selected.maxY, anchor.minY, anchor.maxY);
      if (selected.maxX <= selected.minX || selected.maxY <= selected.minY) continue;

      // Slight pad only; keep placement over source text region.
      const padX = clamp(Math.round(Math.max(2, Math.min(6, bh * 0.06))), 2, 6);
      const padY = clamp(Math.round(Math.max(2, Math.min(6, bh * 0.06))), 2, 6);
      const placed = {
        minX: clamp(selected.minX - padX, anchor.minX, anchor.maxX),
        minY: clamp(selected.minY - padY, anchor.minY, anchor.maxY),
        maxX: clamp(selected.maxX + padX, anchor.minX, anchor.maxX),
        maxY: clamp(selected.maxY + padY, anchor.minY, anchor.maxY),
      };

      // Size guardrail relative to original to avoid large expansions.
      const maxPlacedW = Math.max(Math.round(bw * 1.45), bw + 12);
      const maxPlacedH = Math.max(Math.round(bh * 1.45), bh + 12);

      let pw = placed.maxX - placed.minX + 1;
      let ph = placed.maxY - placed.minY + 1;

      if (pw > maxPlacedW) {
        const excess = pw - maxPlacedW;
        const trimL = Math.floor(excess / 2);
        const trimR = excess - trimL;
        placed.minX = clamp(placed.minX + trimL, anchor.minX, anchor.maxX);
        placed.maxX = clamp(placed.maxX - trimR, anchor.minX, anchor.maxX);
      }
      if (ph > maxPlacedH) {
        const excess = ph - maxPlacedH;
        const trimT = Math.floor(excess / 2);
        const trimB = excess - trimT;
        placed.minY = clamp(placed.minY + trimT, anchor.minY, anchor.maxY);
        placed.maxY = clamp(placed.maxY - trimB, anchor.minY, anchor.maxY);
      }

      pw = placed.maxX - placed.minX + 1;
      ph = placed.maxY - placed.minY + 1;
      if (pw < 8 || ph < 8) continue;

      refined[ti] = {
        ...refined[ti],
        minX: clamp(placed.minX, 0, W - 1),
        minY: clamp(placed.minY, 0, H - 1),
        maxX: clamp(placed.maxX, 0, W - 1),
        maxY: clamp(placed.maxY, 0, H - 1),
      };
    }

    return refined;
  } catch (e) {
    console.warn('[FMT] Local text-region refinement skipped:', e?.message || e);
    return translations;
  }
}

// ================================================================
//  SPEECH BUBBLE DETECTION — finds white regions in the image
//  and snaps LLM coordinates to actual bubble positions
// ================================================================
async function detectAndSnapBubbles(base64Data, translations) {
  if (!translations || translations.length === 0) return translations;

  try {
    const resp = await fetch(base64Data);
    const blob = await resp.blob();
    const bmp = await createImageBitmap(blob);
    const W = bmp.width, H = bmp.height;

    // Downsample 4x for performance
    const S = 4;
    const sw = Math.ceil(W / S), sh = Math.ceil(H / S);
    const canvas = new OffscreenCanvas(sw, sh);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0, sw, sh);
    const { data: px } = ctx.getImageData(0, 0, sw, sh);

    // Binary mask: white pixels (threshold 220)
    const mask = new Uint8Array(sw * sh);
    for (let i = 0; i < sw * sh; i++) {
      mask[i] = (px[i * 4] > 220 && px[i * 4 + 1] > 220 && px[i * 4 + 2] > 220) ? 1 : 0;
    }

    // Connected components on white regions
    const labels = new Int32Array(sw * sh);
    const components = [];
    const maxFill = Math.floor(sw * sh * 0.18); // hard cap per region to avoid pathological fills
    let componentId = 0;

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const i = y * sw + x;
        if (!mask[i] || labels[i]) continue;

        componentId++;
        const queue = [i];
        let head = 0;
        labels[i] = componentId;

        let minX = x, maxX = x, minY = y, maxY = y;
        let area = 0;
        let touchesEdge = false;

        while (head < queue.length && area < maxFill) {
          const ci = queue[head++];
          const cx = ci % sw;
          const cy = (ci - cx) / sw;
          area++;

          if (cx === 0 || cx === sw - 1 || cy === 0 || cy === sh - 1) touchesEdge = true;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          const neighbors = [];
          if (cx > 0) neighbors.push(ci - 1);
          if (cx < sw - 1) neighbors.push(ci + 1);
          if (cy > 0) neighbors.push(ci - sw);
          if (cy < sh - 1) neighbors.push(ci + sw);

          for (const ni of neighbors) {
            if (mask[ni] && !labels[ni]) {
              labels[ni] = componentId;
              queue.push(ni);
            }
          }
        }

        components.push({
          id: componentId,
          minX,
          minY,
          maxX,
          maxY,
          area,
          touchesEdge,
        });
      }
    }

    function coverageOnBoundingEdges(c) {
      const bw = c.maxX - c.minX + 1;
      const bh = c.maxY - c.minY + 1;
      if (bw <= 0 || bh <= 0) {
        return { top: 0, bottom: 0, left: 0, right: 0 };
      }

      let top = 0, bottom = 0, left = 0, right = 0;

      for (let x = c.minX; x <= c.maxX; x++) {
        if (labels[c.minY * sw + x] === c.id) top++;
        if (labels[c.maxY * sw + x] === c.id) bottom++;
      }
      for (let y = c.minY; y <= c.maxY; y++) {
        if (labels[y * sw + c.minX] === c.id) left++;
        if (labels[y * sw + c.maxX] === c.id) right++;
      }

      return {
        top: top / bw,
        bottom: bottom / bw,
        left: left / bh,
        right: right / bh,
      };
    }

    function ringDarkness(c) {
      const rx0 = Math.max(0, c.minX - 1);
      const ry0 = Math.max(0, c.minY - 1);
      const rx1 = Math.min(sw - 1, c.maxX + 1);
      const ry1 = Math.min(sh - 1, c.maxY + 1);

      let dark = 0;
      let total = 0;

      for (let y = ry0; y <= ry1; y++) {
        for (let x = rx0; x <= rx1; x++) {
          const onOuterRing = x === rx0 || x === rx1 || y === ry0 || y === ry1;
          if (!onOuterRing) continue;

          const pi = (y * sw + x) * 4;
          const lum = px[pi] * 0.299 + px[pi + 1] * 0.587 + px[pi + 2] * 0.114;
          if (lum < 170) dark++;
          total++;
        }
      }

      return total > 0 ? dark / total : 0;
    }

    const imgArea = W * H;
    const bubbles = [];

    for (const c of components) {
      const b = {
        minX: c.minX * S,
        minY: c.minY * S,
        maxX: Math.min((c.maxX + 1) * S, W),
        maxY: Math.min((c.maxY + 1) * S, H),
        area: c.area * S * S,
      };

      const bw = b.maxX - b.minX;
      const bh = b.maxY - b.minY;
      if (bw <= 0 || bh <= 0) continue;

      // Size filters
      if (b.area < imgArea * 0.0015) continue;
      if (b.area > imgArea * 0.14) continue;
      if (bw < 34 || bh < 34) continue;
      if (bw > bh * 6.5 || bh > bw * 6.5) continue;

      // Fill-shape filters
      const fill = b.area / Math.max(1, bw * bh);
      if (fill < 0.2 || fill > 0.92) continue;

      const edgeCov = coverageOnBoundingEdges(c);
      const stripLike =
        (edgeCov.top > 0.92 && edgeCov.bottom > 0.92) ||
        (edgeCov.left > 0.92 && edgeCov.right > 0.92) ||
        (edgeCov.top > 0.8 && edgeCov.bottom > 0.8 && edgeCov.left > 0.8 && edgeCov.right > 0.8);
      if (stripLike) continue;

      if (c.touchesEdge && (edgeCov.top > 0.95 || edgeCov.bottom > 0.95 || edgeCov.left > 0.95 || edgeCov.right > 0.95)) {
        continue;
      }

      const darkRing = ringDarkness(c);
      if (darkRing < 0.06) continue;

      bubbles.push({
        ...b,
        cx: (b.minX + b.maxX) / 2,
        cy: (b.minY + b.maxY) / 2,
      });
    }

    if (bubbles.length === 0) {
      console.log('[FMT] No bubbles detected, keeping original coords');
      return translations;
    }

    console.log(`[FMT] Detected ${bubbles.length} bubble candidates after filtering`);

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const diag = Math.max(1, Math.hypot(W, H));
    const result = translations.map(t => ({ ...t }));
    const usedBubbleIdx = new Set();
    let snappedCount = 0;

    // Match each translation to the best nearby bubble, prioritizing overlap.
    for (let ti = 0; ti < result.length; ti++) {
      const t = result[ti];
      const tx1 = clamp(Math.round(t.minX), 0, W);
      const ty1 = clamp(Math.round(t.minY), 0, H);
      const tx2 = clamp(Math.round(t.maxX), 0, W);
      const ty2 = clamp(Math.round(t.maxY), 0, H);
      if (tx2 <= tx1 || ty2 <= ty1) continue;

      const tArea = Math.max(1, (tx2 - tx1) * (ty2 - ty1));
      const tcx = (tx1 + tx2) / 2;
      const tcy = (ty1 + ty2) / 2;
      const boxW = tx2 - tx1;
      const boxH = ty2 - ty1;

      let bestBubble = null;
      let bestBubbleIdx = -1;
      let bestScore = -Infinity;

      for (let bi = 0; bi < bubbles.length; bi++) {
        const b = bubbles[bi];
        const ix1 = Math.max(tx1, b.minX);
        const iy1 = Math.max(ty1, b.minY);
        const ix2 = Math.min(tx2, b.maxX);
        const iy2 = Math.min(ty2, b.maxY);
        const interArea = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);

        const overlap = interArea / tArea;
        const centerInside = tcx >= b.minX && tcx <= b.maxX && tcy >= b.minY && tcy <= b.maxY;
        const distNorm = Math.hypot(tcx - b.cx, tcy - b.cy) / diag;
        const sizePenalty = Math.abs(Math.log((b.area + 1) / (tArea + 1)));
        const verticalPenalty = Math.abs(tcy - b.cy) / Math.max(1, H);

        const viable = overlap >= 0.03 || centerInside || distNorm < 0.12;
        if (!viable) continue;

        const score =
          overlap * 4.0 +
          (centerInside ? 1.1 : 0) +
          (1 - Math.min(1, distNorm)) * 1.2 -
          sizePenalty * 0.4 -
          verticalPenalty * 0.35;

        if (score > bestScore) {
          bestScore = score;
          bestBubble = b;
          bestBubbleIdx = bi;
        }
      }

      let chosenBubble = null;
      let chosenBubbleIdx = -1;

      if (bestBubble && bestScore >= 0.55) {
        chosenBubble = bestBubble;
        chosenBubbleIdx = bestBubbleIdx;
      } else {
        // Fallback for suspicious model boxes (panel-wide or elongated).
        const suspiciousBox =
          tArea > imgArea * 0.08 ||
          boxW > W * 0.6 ||
          boxH > H * 0.45 ||
          boxW / Math.max(1, boxH) > 3.2 ||
          boxH / Math.max(1, boxW) > 3.2;

        if (suspiciousBox) {
          let nearest = null;
          let nearestIdx = -1;
          let nearestDist = Infinity;

          for (let bi = 0; bi < bubbles.length; bi++) {
            if (usedBubbleIdx.has(bi)) continue;
            const b = bubbles[bi];
            const d = Math.hypot(tcx - b.cx, tcy - b.cy);
            if (d < nearestDist) {
              nearestDist = d;
              nearest = b;
              nearestIdx = bi;
            }
          }

          if (nearest && nearestDist <= diag * 0.22) {
            chosenBubble = nearest;
            chosenBubbleIdx = nearestIdx;
          }
        }
      }

      if (!chosenBubble) continue;

      const inset = 4;
      result[ti] = {
        ...result[ti],
        minX: Math.max(0, Math.round(chosenBubble.minX + inset)),
        minY: Math.max(0, Math.round(chosenBubble.minY + inset)),
        maxX: Math.min(W, Math.round(chosenBubble.maxX - inset)),
        maxY: Math.min(H, Math.round(chosenBubble.maxY - inset)),
      };

      if (result[ti].maxX > result[ti].minX && result[ti].maxY > result[ti].minY) {
        if (chosenBubbleIdx >= 0) usedBubbleIdx.add(chosenBubbleIdx);
        snappedCount++;
      }
    }

    console.log(`[FMT] Bubble snapping: ${snappedCount}/${translations.length} translated regions snapped`);

    return result;
  } catch (e) {
    console.warn('[FMT] Bubble detection failed:', e);
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
  const id = `${CACHE_VERSION}:${fastHash(base64Data)}`;

  if (translationCache[id]) return { translations: translationCache[id] };

  if (outgoingRequests.has(id)) {
    try { return await outgoingRequests.get(id); }
    catch (e) { return { error: e.message }; }
  }

  if (outgoingRequests.size >= MAX_CONCURRENT) return { error: 'FullQueue' };

  const promise = (async () => {
    try {
      let translations = await translateWithProviders(base64Data, imgWidth, imgHeight);

      if (ENABLE_LOCAL_TEXT_REFINEMENT && translations && translations.length > 0) {
        translations = await refineBoxesToLocalTextRegions(base64Data, translations, imgWidth, imgHeight);
      }

      translations = sanitizeTranslationBoxes(translations, imgWidth, imgHeight);

      // Optional bubble snapping (disabled for tight text-overlay mode)
      if (ENABLE_BUBBLE_SNAPPING && translations && translations.length > 0) {
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
hydrateEnvKeysToStorage()
  .catch((e) => console.warn('[FMT] .env hydration skipped:', e?.message || e))
  .finally(updateIcon);
