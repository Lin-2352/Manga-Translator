// Free Manga Translator - Background Service Worker
// Handles Gemini/OpenRouter API calls, key rotation, request queue, and translation caching

// ===== Configuration =====
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_CONCURRENT = 3;
const MAX_DIMENSION = 1800;

const TRANSLATION_PROMPT = `You are a professional manga/comic translator. Analyze this manga image and:
 
1. Find ALL speech bubbles, text boxes, sound effects, and any text containing Japanese, Chinese (Mandarin), or Korean characters
2. Translate each text segment to natural, fluent English
3. For each translated text, provide the precise bounding box coordinates (in pixels) of where the ORIGINAL text appears in the image
 
Return ONLY a valid JSON array with this exact format:
[
  {
    "translatedText": "Natural English translation",
    "minX": 100,
    "minY": 50,
    "maxX": 300,
    "maxY": 150,
    "fontSize": 18
  }
]
 
Rules:
- Coordinates must be pixel positions in the original image dimensions
- fontSize should be appropriate for the bounding box size (roughly matching original text size)
- Translate sound effects too (e.g. ドキドキ → *ba-dump ba-dump*)
- Keep translations natural and contextual, not literal
- Preserve the speaker's tone and personality in translation
- If no translatable Asian text is found, return []
- Do NOT include any text outside the JSON array`;

// ===== State =====
const outgoingRequests = new Set(); // Set-based deduplication (Ichigo pattern)
const requestQueue = [];
const translationCache = {};
let geminiKeyIndex = 0; // For key rotation

// ===== Fast Hash (Ichigo's sampling algorithm) =====
function fastHash(str) {
  if (!str) return '';
  const len = str.length;
  let hash = '';
  // First 150 chars
  for (let i = 0; i < 150 && i < len; i++) {
    hash += str.charCodeAt(i);
  }
  // Last 150 chars
  for (let i = Math.max(0, len - 150); i < len; i++) {
    hash += str.charCodeAt(i);
  }
  // Sample every 1/1000th
  const step = Math.ceil(len / 1000) + 1;
  for (let i = 0; i < len; i += step) {
    hash += str.charCodeAt(i);
  }
  return hash;
}

// ===== Settings Helpers =====
async function getSettings() {
  const result = await chrome.storage.local.get([
    'geminiApiKeys', 'geminiApiKey', 'openrouterApiKey', 'preferredProvider'
  ]);
  // Support both single key and multiple keys
  let geminiKeys = result.geminiApiKeys || [];
  if (geminiKeys.length === 0 && result.geminiApiKey) {
    geminiKeys = [result.geminiApiKey];
  }
  return {
    geminiKeys,
    openrouterKey: result.openrouterApiKey || null,
    preferredProvider: result.preferredProvider || 'gemini'
  };
}

// Rotate through Gemini API keys
function getNextGeminiKey(keys) {
  if (keys.length === 0) return null;
  const key = keys[geminiKeyIndex % keys.length];
  geminiKeyIndex++;
  return key;
}

// ===== Image Resize (Ichigo's aspect-ratio-preserving algorithm) =====
function calculateResizedDimensions(width, height) {
  // Ichigo uses OR (not AND) — if either dimension is within bounds, no resize
  const alreadyWithinBounds = width <= MAX_DIMENSION || height <= MAX_DIMENSION;
  if (alreadyWithinBounds) return { width, height };

  // Use Math.max to favor larger images (Ichigo's approach)
  const ratio = Math.max(MAX_DIMENSION / height, MAX_DIMENSION / width);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio)
  };
}

// ===== Blob to Base64 =====
function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// ===== Gemini API Call =====
async function callGeminiApi(base64Data, apiKey) {
  const base64Clean = base64Data.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

  const requestBody = {
    contents: [{
      parts: [
        { text: TRANSLATION_PROMPT },
        {
          inlineData: {
            mimeType: 'image/png',
            data: base64Clean
          }
        }
      ]
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: 4096
    }
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    if (response.status === 429) throw new Error('RATE_LIMITED');
    if (response.status === 403) throw new Error('INVALID_API_KEY');
    if (response.status === 400) throw new Error('BAD_REQUEST: ' + errorBody);
    throw new Error(`API_ERROR_${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  return parseTranslationResponse(data.candidates?.[0]?.content?.parts?.[0]?.text);
}

// ===== OpenRouter API Call (Fallback) =====
async function callOpenRouterApi(base64Data, apiKey) {
  const base64WithPrefix = base64Data.startsWith('data:')
    ? base64Data
    : `data:image/png;base64,${base64Data}`;

  const requestBody = {
    model: 'google/gemini-2.0-flash-001',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: TRANSLATION_PROMPT },
        { type: 'image_url', image_url: { url: base64WithPrefix } }
      ]
    }],
    temperature: 0.1,
    max_tokens: 4096
  };

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'chrome-extension://free-manga-translator',
      'X-Title': 'Free Manga Translator'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    if (response.status === 429) throw new Error('RATE_LIMITED');
    if (response.status === 401 || response.status === 403) throw new Error('INVALID_API_KEY');
    throw new Error(`API_ERROR_${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  return parseTranslationResponse(data.choices?.[0]?.message?.content);
}

// ===== Parse Translation Response =====
function parseTranslationResponse(textContent) {
  if (!textContent) return [];

  try {
    // Handle cases where response might have markdown code blocks
    let cleaned = textContent.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const translations = JSON.parse(cleaned);
    if (!Array.isArray(translations)) return [];

    return translations.filter(t =>
      t.translatedText &&
      typeof t.minX === 'number' &&
      typeof t.minY === 'number' &&
      typeof t.maxX === 'number' &&
      typeof t.maxY === 'number'
    ).map(t => ({
      translatedText: t.translatedText.trim(),
      minX: Math.max(0, Math.round(t.minX)),
      minY: Math.max(0, Math.round(t.minY)),
      maxX: Math.round(t.maxX),
      maxY: Math.round(t.maxY),
      fontSize: t.fontSize || 16
    }));
  } catch (e) {
    console.error('[MangaTranslator] Failed to parse response:', textContent.substring(0, 200));
    return [];
  }
}

// ===== Translation with Key Rotation + Fallback =====
async function translateWithProviders(base64Data) {
  const settings = await getSettings();

  // Try Gemini keys first (with rotation)
  if (settings.geminiKeys.length > 0) {
    const totalKeys = settings.geminiKeys.length;
    let lastError = null;

    // Try each key, starting from the rotated index
    for (let attempt = 0; attempt < totalKeys; attempt++) {
      const key = getNextGeminiKey(settings.geminiKeys);
      try {
        return await callGeminiApi(base64Data, key);
      } catch (error) {
        lastError = error;
        console.warn(`[MangaTranslator] Gemini key ${attempt + 1}/${totalKeys} failed:`, error.message);
        if (error.message === 'INVALID_API_KEY') continue; // Try next key
        if (error.message === 'RATE_LIMITED') continue; // Try next key
        throw error; // Non-recoverable error
      }
    }

    // All Gemini keys failed — try OpenRouter fallback
    if (settings.openrouterKey) {
      console.log('[MangaTranslator] All Gemini keys exhausted, falling back to OpenRouter');
      try {
        return await callOpenRouterApi(base64Data, settings.openrouterKey);
      } catch (error) {
        console.error('[MangaTranslator] OpenRouter fallback also failed:', error.message);
        throw error;
      }
    }

    throw lastError || new Error('ALL_KEYS_FAILED');
  }

  // No Gemini keys — try OpenRouter only
  if (settings.openrouterKey) {
    return await callOpenRouterApi(base64Data, settings.openrouterKey);
  }

  throw new Error('NO_API_KEY');
}

// ===== Process Translation (with deduplication + caching) =====
async function processTranslation(message) {
  const base64Data = message.base64Data;
  const imageIdentity = fastHash(base64Data);

  // Deduplication: already translating this exact image?
  if (outgoingRequests.has(imageIdentity)) {
    return { error: 'FullQueue' };
  }

  // Check cache
  if (translationCache[imageIdentity]) {
    return { translations: translationCache[imageIdentity] };
  }

  // Concurrency check
  if (outgoingRequests.size >= MAX_CONCURRENT) {
    return { error: 'FullQueue' };
  }

  try {
    outgoingRequests.add(imageIdentity);
    const translations = await translateWithProviders(base64Data);

    // Cache successful results
    if (translations && translations.length >= 0) {
      translationCache[imageIdentity] = translations;
      // Evict old entries if cache is too large
      const keys = Object.keys(translationCache);
      if (keys.length > 300) {
        delete translationCache[keys[0]];
      }
    }

    return { translations };
  } catch (error) {
    console.error('[MangaTranslator] Translation error:', error.message);
    return { error: error.message };
  } finally {
    outgoingRequests.delete(imageIdentity);
    processQueue();
  }
}

// ===== Request Queue =====
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

// ===== Tab Capture for Translation Panel (Ichigo's zoom-aware approach) =====
async function captureAndTranslate(tabId, dimensions) {
  try {
    // Capture visible tab
    const dataUrl = await new Promise(resolve =>
      chrome.tabs.captureVisibleTab(null, { format: 'png' }, resolve)
    );

    if (!dataUrl) return { error: 'CAPTURE_FAILED' };

    // Get zoom factor for coordinate adjustment
    const zoomFactor = await new Promise(resolve =>
      chrome.tabs.getZoom(tabId, resolve)
    );
    const dpr = dimensions.devicePixelRatio || 1;
    const scale = zoomFactor * dpr;

    // Crop using OffscreenCanvas with bitmaprenderer (Ichigo's technique)
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob,
      Math.round(dimensions.left * scale),
      Math.round(dimensions.top * scale),
      Math.round(dimensions.width * scale),
      Math.round(dimensions.height * scale)
    );

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('bitmaprenderer');
    ctx.transferFromImageBitmap(bitmap);

    const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
    const base64Data = await blobToBase64(croppedBlob);

    const result = await queueTranslation({ base64Data });
    return { ...result, zoomFactor };
  } catch (error) {
    console.error('[MangaTranslator] Capture error:', error);
    return { error: 'CAPTURE_ERROR: ' + error.message };
  }
}

// ===== Message Handler =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.kind === 'translateImage') {
    queueTranslation(message).then(sendResponse);
    return true;
  }

  if (message.kind === 'translateSnapshot') {
    const tabId = sender.tab?.id || message.tabId;
    captureAndTranslate(tabId, message.dimensions).then(sendResponse);
    return true;
  }

  if (message.kind === 'checkApiKey') {
    getSettings().then(s => sendResponse({
      hasGemini: s.geminiKeys.length > 0,
      hasOpenRouter: !!s.openrouterKey,
      provider: s.preferredProvider
    }));
    return true;
  }

  if (message.kind === 'getTranslationStats') {
    sendResponse({
      cacheSize: Object.keys(translationCache).length,
      activeRequests: outgoingRequests.size,
      queueLength: requestQueue.length
    });
    return true;
  }

  if (message.kind === 'clearCache') {
    for (const key in translationCache) delete translationCache[key];
    sendResponse({ success: true });
    return true;
  }

  if (message.kind === 'startTranslationPanel') {
    chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      files: ['translationPanel.js']
    });
    return false;
  }
});

// ===== Context Menu =====
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'translateMangaImage',
    title: 'Translate this manga panel',
    contexts: ['image']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'translateMangaImage' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      kind: 'translateSpecificImage',
      imageUrl: info.srcUrl
    });
  }
});

// ===== Icon Management =====
async function updateIcon() {
  const settings = await getSettings();
  const hasKey = settings.geminiKeys.length > 0 || !!settings.openrouterKey;
  chrome.action.setIcon({
    path: {
      '16': hasKey ? 'icons/16x16.png' : 'icons/128x128-disabled.png',
      '48': hasKey ? 'icons/48x48.png' : 'icons/128x128-disabled.png',
      '128': hasKey ? 'icons/128x128.png' : 'icons/128x128-disabled.png'
    }
  });
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.geminiApiKeys || changes.geminiApiKey || changes.openrouterApiKey) {
    updateIcon();
  }
});

updateIcon();