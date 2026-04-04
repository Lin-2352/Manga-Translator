// Free Manga Translator - Content Script
// Detects manga images on pages and overlays translations

(function () {
  'use strict';

  if (window.__mangaTranslatorInjected) return;
  window.__mangaTranslatorInjected = true;

  // ===== Constants =====
  const MIN_IMAGE_SIZE = 200;
  const MAX_DIMENSION = 1800;
  const TRANSLATED_ATTR = 'data-fmt-translated';
  const PROCESSING_ATTR = 'data-fmt-processing';
  const ORIGINAL_SRC_ATTR = 'data-fmt-original-src';
  const ORIGINAL_SRCSET_ATTR = 'data-fmt-original-srcset';
  const MAX_RETRIES = 3;
  const BASE_RETRY_DELAY = 3000;

  // ===== State =====
  let isEnabled = false;
  let fontFamily = 'CC Wild Words';
  let fontColor = '#000000';

  const translatedSrcs = new Set();
  const pendingSrcs = new Set();
  const retryCountMap = new Map();
  const observedImages = new WeakSet();
  const spinnerMap = new WeakMap();

  // ===== Load Settings (auto-translate OFF by default) =====
  chrome.storage.local.get(['translationEnabled', 'mangaFontStyle', 'mangaFontColor'], (result) => {
    isEnabled = result.translationEnabled === true; // OFF by default
    fontFamily = result.mangaFontStyle || 'CC Wild Words';
    fontColor = result.mangaFontColor || '#000000';
    if (isEnabled) scheduleInitialScan();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.translationEnabled) {
      isEnabled = changes.translationEnabled.newValue;
      if (isEnabled) scanForImages();
    }
    if (changes.mangaFontStyle) fontFamily = changes.mangaFontStyle.newValue;
    if (changes.mangaFontColor) fontColor = changes.mangaFontColor.newValue;
  });

  // ===== Font Injection =====
  function injectFonts() {
    if (document.getElementById('fmt-fonts')) return;
    const style = document.createElement('style');
    style.id = 'fmt-fonts';
    style.textContent = `
      @font-face {
        font-family: 'CC Wild Words';
        src: url('${chrome.runtime.getURL('fonts/CCWildWords-Regular.otf')}') format('opentype');
        font-display: swap;
      }
      @font-face {
        font-family: 'Bangers';
        src: url('${chrome.runtime.getURL('fonts/Bangers-Regular.ttf')}') format('truetype');
        font-display: swap;
      }
      @font-face {
        font-family: 'Patrick Hand';
        src: url('${chrome.runtime.getURL('fonts/PatrickHand-Regular.ttf')}') format('truetype');
        font-display: swap;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  // ===== Spinner Styles & Helpers (prominent dark badge with white spinner) =====
  function injectSpinnerStyles() {
    if (document.getElementById('fmt-spinner-styles')) return;
    const style = document.createElement('style');
    style.id = 'fmt-spinner-styles';
    style.textContent = `
      @keyframes fmt-img-spin {
        to { transform: rotate(360deg); }
      }
      .fmt-img-spinner {
        position: fixed;
        width: 40px;
        height: 40px;
        background: rgba(0, 0, 0, 0.7);
        border-radius: 50%;
        z-index: 2147483640;
        pointer-events: none;
        box-shadow: 0 2px 10px rgba(0,0,0,0.5);
      }
      .fmt-img-spinner::after {
        content: '';
        position: absolute;
        top: 8px;
        left: 8px;
        width: 24px;
        height: 24px;
        border: 3px solid rgba(255,255,255,0.3);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: fmt-img-spin 0.8s linear infinite;
        box-sizing: border-box;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function showSpinner(img) {
    if (spinnerMap.has(img)) return;
    injectSpinnerStyles();
    const rect = img.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return; // not visible
    const spinner = document.createElement('div');
    spinner.className = 'fmt-img-spinner';
    spinner.style.left = (rect.left + 8) + 'px';
    spinner.style.top = (rect.top + 8) + 'px';
    document.body.appendChild(spinner);
    spinnerMap.set(img, spinner);
    console.log('[MangaTranslator] Spinner shown for image');
  }

  function hideSpinner(img) {
    const spinner = spinnerMap.get(img);
    if (spinner) {
      spinner.remove();
      spinnerMap.delete(img);
    }
  }

  // ===== Image Size Calculation =====
  function calculateResizedDimensions(width, height) {
    if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) return { width, height };
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
  }

  // ===== Get effective image src (handles lazy-load patterns) =====
  function getEffectiveSrc(img) {
    if (img.currentSrc && img.currentSrc !== '') return img.currentSrc;
    if (img.src && img.src !== '' && !img.src.endsWith('/')) return img.src;
    for (const attr of ['data-src', 'data-lazy-src', 'data-original', 'data-lazy', 'data-url']) {
      const val = img.getAttribute(attr);
      if (val && val.startsWith('http')) return val;
    }
    return img.src || '';
  }

  // ===== Detect standalone image page =====
  function isStandaloneImagePage() {
    const ct = document.contentType || '';
    if (ct.startsWith('image/')) return true;
    if (document.body && document.body.children.length === 1 &&
        document.body.children[0].nodeName === 'IMG') return true;
    return false;
  }

  // ===== Get Image as Base64 =====
  function getImageBase64(img) {
    return new Promise((resolve, reject) => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        if (!width || !height) { reject(new Error('No dimensions')); return; }

        const resized = calculateResizedDimensions(width, height);
        const canvas = document.createElement('canvas');
        canvas.width = resized.width;
        canvas.height = resized.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, resized.width, resized.height);
        const dataUrl = canvas.toDataURL('image/png');
        resolve({
          dataUrl,
          width: resized.width,
          height: resized.height,
          originalWidth: width,
          originalHeight: height
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  // ===== Fetch Image Cross-Origin =====
  async function fetchImageCrossOrigin(url) {
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) throw new Error('Fetch failed');
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      throw new Error('CORS_BLOCKED');
    }
  }

  // ===== Word Wrap (handles long words via character breaking) =====
  function wrapText(ctx, text, maxWidth) {
    const content = String(text || '');
    if (maxWidth <= 0) return [content];
    const words = content.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [''];
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      if (ctx.measureText(testLine).width <= maxWidth) {
        currentLine = testLine;
      } else if (currentLine) {
        lines.push(currentLine);
        if (ctx.measureText(word).width > maxWidth) {
          let partial = '';
          for (const ch of word) {
            if (ctx.measureText(partial + ch).width > maxWidth && partial) {
              lines.push(partial);
              partial = ch;
            } else {
              partial += ch;
            }
          }
          currentLine = partial;
        } else {
          currentLine = word;
        }
      } else {
        let partial = '';
        for (const ch of word) {
          if (ctx.measureText(partial + ch).width > maxWidth && partial) {
            lines.push(partial);
            partial = ch;
          } else {
            partial += ch;
          }
        }
        currentLine = partial;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [''];
  }

  // ===== Fit Text to Box (strict: guarantees text fits within box) =====
  function fitText(ctx, text, boxWidth, boxHeight, fontFam) {
    const MIN_FONT_SIZE = 7;
    const PADDING = 8;
    const STROKE_MARGIN = 4;
    const availW = Math.max(1, boxWidth - PADDING * 2 - STROKE_MARGIN * 2);
    const availH = Math.max(1, boxHeight - PADDING * 2);

    let fontSize = Math.floor(Math.min(availH * 0.48, availW * 0.5, 56));
    if (!Number.isFinite(fontSize) || fontSize < MIN_FONT_SIZE) {
      fontSize = MIN_FONT_SIZE;
    }

    let fit = null;
    while (fontSize >= MIN_FONT_SIZE) {
      ctx.font = `bold ${fontSize}px "${fontFam}", "Comic Sans MS", cursive`;
      const lineHeight = Math.ceil(fontSize * 1.2);
      const wrapped = wrapText(ctx, text, availW);
      const totalH = wrapped.length * lineHeight;

      let maxLineW = 0;
      for (const line of wrapped) {
        maxLineW = Math.max(maxLineW, ctx.measureText(line).width);
      }

      if (maxLineW <= availW && totalH <= availH) {
        fit = { fontSize, lines: wrapped, lineHeight, padding: PADDING };
        break;
      }

      fontSize -= 1;
    }

    if (fit) return fit;

    ctx.font = `bold ${MIN_FONT_SIZE}px "${fontFam}", "Comic Sans MS", cursive`;
    return {
      fontSize: MIN_FONT_SIZE,
      lines: wrapText(ctx, text, availW),
      lineHeight: Math.ceil(MIN_FONT_SIZE * 1.2),
      padding: PADDING,
    };
  }

  // ===== Overlay Translations onto Image (strict masking + clipped text) =====
  function overlayTranslations(img, translations, imageData) {
    if (!translations || translations.length === 0) return;

    const canvas = document.createElement('canvas');
    const origW = imageData.originalWidth || imageData.width;
    const origH = imageData.originalHeight || imageData.height;
    canvas.width = origW;
    canvas.height = origH;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(img, 0, 0, origW, origH);

    const scaleX = origW / imageData.width;
    const scaleY = origH / imageData.height;

    for (const t of translations) {
      const MASK_PADDING = 2;
      const minX = Math.max(0, Math.floor(t.minX * scaleX) - MASK_PADDING);
      const minY = Math.max(0, Math.floor(t.minY * scaleY) - MASK_PADDING);
      const maxX = Math.min(origW, Math.ceil(t.maxX * scaleX) + MASK_PADDING);
      const maxY = Math.min(origH, Math.ceil(t.maxY * scaleY) + MASK_PADDING);
      const boxW = maxX - minX;
      const boxH = maxY - minY;

      if (boxW < 8 || boxH < 8) continue;

      // STEP 1: MASK — solid white rectangle
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.fillRect(minX, minY, boxW, boxH);

      // STEP 2: CLIP
      ctx.beginPath();
      ctx.rect(minX, minY, boxW, boxH);
      ctx.clip();

      // STEP 3: TEXT
      const fit = fitText(ctx, t.translatedText, boxW, boxH, fontFamily);
      ctx.font = `bold ${fit.fontSize}px "${fontFamily}", "Comic Sans MS", cursive`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const innerH = Math.max(1, boxH - fit.padding * 2);
      const totalTextH = fit.lines.length * fit.lineHeight;
      const textStartY = minY + fit.padding + Math.max(0, (innerH - totalTextH) / 2);
      const textCenterX = minX + boxW / 2;

      for (let i = 0; i < fit.lines.length; i++) {
        const ly = textStartY + i * fit.lineHeight;

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(fit.lines[i], textCenterX, ly);

        ctx.fillStyle = fontColor;
        ctx.fillText(fit.lines[i], textCenterX, ly);
      }

      ctx.restore();
    }

    try {
      const newDataUrl = canvas.toDataURL('image/png');
      img.setAttribute(TRANSLATED_ATTR, 'true');
      img.removeAttribute(PROCESSING_ATTR);

      if (!img.getAttribute(ORIGINAL_SRC_ATTR)) {
        img.setAttribute(ORIGINAL_SRC_ATTR, img.src);
      }
      if (img.srcset && !img.getAttribute(ORIGINAL_SRCSET_ATTR)) {
        img.setAttribute(ORIGINAL_SRCSET_ATTR, img.srcset);
        img.srcset = '';
      }

      img.src = newDataUrl;
    } catch (e) {
      console.error('[MangaTranslator] Overlay failed:', e);
    }
  }

  // ===== Check if Element Qualifies for Translation =====
  function shouldTranslate(img) {
    if (!isEnabled) return false;
    if (img.getAttribute(TRANSLATED_ATTR)) return false;
    if (img.getAttribute(PROCESSING_ATTR)) return false;

    const src = getEffectiveSrc(img);
    if (!src) return false;
    if (translatedSrcs.has(src)) return false;
    if (pendingSrcs.has(src)) return false;

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (w < MIN_IMAGE_SIZE || h < MIN_IMAGE_SIZE) return false;

    if (!isStandaloneImagePage()) {
      const rect = img.getBoundingClientRect();
      if (rect.width < 100 || rect.height < 100) return false;
    }

    return true;
  }

  // ===== Translate a Single Image =====
  async function translateImage(img) {
    if (!shouldTranslate(img)) return;

    const src = getEffectiveSrc(img);
    if (!src) return;

    console.log('[MangaTranslator] Starting translation for:', src.substring(0, 80));
    pendingSrcs.add(src);
    img.setAttribute(PROCESSING_ATTR, 'true');
    showSpinner(img);

    try {
      let imageData;

      try {
        imageData = await getImageBase64(img);
      } catch (e) {
        if (src.startsWith('http://') || src.startsWith('https://')) {
          try {
            const dataUrl = await fetchImageCrossOrigin(src);
            const tempImg = new Image();
            tempImg.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
              tempImg.onload = resolve;
              tempImg.onerror = reject;
              tempImg.src = dataUrl;
            });
            imageData = await getImageBase64(tempImg);
          } catch (corsError) {
            console.warn('[MangaTranslator] CORS blocked for:', src.substring(0, 80));
            cleanupProcessing(img, src);
            return;
          }
        } else {
          cleanupProcessing(img, src);
          return;
        }
      }

      console.log('[MangaTranslator] Sending to API:', imageData.width, 'x', imageData.height);
      const response = await chrome.runtime.sendMessage({
        kind: 'translateImage',
        base64Data: imageData.dataUrl,
        width: imageData.width,
        height: imageData.height
      });

      if (response?.error) {
        console.warn('[MangaTranslator] API error:', response.error);
        if (response.error === 'FullQueue' || response.error === 'RATE_LIMITED') {
          const retryCount = (retryCountMap.get(src) || 0) + 1;
          retryCountMap.set(src, retryCount);

          if (retryCount <= MAX_RETRIES) {
            const delay = BASE_RETRY_DELAY * Math.pow(2, retryCount - 1) + Math.random() * 1000;
            console.log(`[MangaTranslator] Retry ${retryCount}/${MAX_RETRIES} in ${Math.round(delay)}ms`);
            setTimeout(() => {
              img.removeAttribute(PROCESSING_ATTR);
              pendingSrcs.delete(src);
              translateImage(img);
            }, delay);
            return; // spinner stays during retry
          } else {
            retryCountMap.delete(src);
          }
        }
        cleanupProcessing(img, src);
        return;
      }

      retryCountMap.delete(src);
      translatedSrcs.add(src);
      pendingSrcs.delete(src);
      hideSpinner(img);

      if (response?.translations && response.translations.length > 0) {
        console.log('[MangaTranslator] Got', response.translations.length, 'translations');
        overlayTranslations(img, response.translations, imageData);
      } else {
        console.log('[MangaTranslator] No text found in image');
        img.setAttribute(TRANSLATED_ATTR, 'no-text');
        img.removeAttribute(PROCESSING_ATTR);
      }
    } catch (error) {
      console.error('[MangaTranslator] Error:', error);
      cleanupProcessing(img, src);
    }
  }

  function cleanupProcessing(img, src) {
    img.removeAttribute(PROCESSING_ATTR);
    pendingSrcs.delete(src);
    hideSpinner(img);
  }

  // ===== Process an Image Element =====
  function processImage(img) {
    if (!isEnabled) return;
    if (img.getAttribute(TRANSLATED_ATTR) || img.getAttribute(PROCESSING_ATTR)) return;

    const src = getEffectiveSrc(img);
    if (translatedSrcs.has(src) || pendingSrcs.has(src)) return;

    if (img.complete && img.naturalWidth > 0) {
      translateImage(img);
    } else {
      img.addEventListener('load', () => translateImage(img), { once: true });
    }
  }

  // ===== Scan Page for Images =====
  function scanForImages() {
    if (!isEnabled) return;
    injectFonts();
    console.log('[MangaTranslator] Scanning for images...');

    let count = 0;
    document.querySelectorAll('img').forEach((img) => {
      processImage(img);
      observeWithIntersection(img);
      count++;
    });

    document.querySelectorAll('picture img').forEach((img) => {
      processImage(img);
      observeWithIntersection(img);
    });

    document.querySelectorAll('img[data-src], img[data-lazy-src], img[data-original]').forEach((img) => {
      observeWithIntersection(img);
    });

    console.log('[MangaTranslator] Found', count, 'img elements');
  }

  // ===== Standalone Image Handler =====
  function handleStandaloneImage() {
    if (!isStandaloneImagePage()) return;
    if (!isEnabled) return;
    injectFonts();

    const img = document.querySelector('img');
    if (!img) return;

    console.log('[MangaTranslator] Standalone image detected');
    if (img.complete && img.naturalWidth > 0) {
      translateImage(img);
    } else {
      img.addEventListener('load', () => translateImage(img), { once: true });
    }
  }

  // ===== Schedule Initial Scan =====
  function scheduleInitialScan() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(scanForImages, 500);
        setTimeout(handleStandaloneImage, 600);
      });
    } else {
      setTimeout(scanForImages, 500);
      setTimeout(handleStandaloneImage, 600);
    }
    setTimeout(scanForImages, 4000);
  }

  // ===== IntersectionObserver =====
  const intersectionObserver = new IntersectionObserver((entries) => {
    if (!isEnabled) return;
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const img = entry.target;
      if (img.nodeName !== 'IMG') continue;
      if (img.getAttribute(TRANSLATED_ATTR) || img.getAttribute(PROCESSING_ATTR)) continue;
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (w >= MIN_IMAGE_SIZE && h >= MIN_IMAGE_SIZE) {
        processImage(img);
      }
    }
  }, { rootMargin: '200px' });

  function observeWithIntersection(img) {
    if (observedImages.has(img)) return;
    observedImages.add(img);
    intersectionObserver.observe(img);
  }

  // ===== MutationObserver =====
  const mutationObserver = new MutationObserver((mutations) => {
    if (!isEnabled) return;
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node.nodeName === 'IMG') {
            processImage(node);
            observeWithIntersection(node);
          } else if (node.querySelectorAll) {
            node.querySelectorAll('img').forEach((img) => {
              processImage(img);
              observeWithIntersection(img);
            });
          }
        }
      }
      if (mutation.type === 'attributes' && mutation.target.nodeName === 'IMG') {
        const img = mutation.target;
        const newSrc = getEffectiveSrc(img);
        if (newSrc && !translatedSrcs.has(newSrc) && !pendingSrcs.has(newSrc)) {
          if (img.getAttribute(TRANSLATED_ATTR)) {
            img.removeAttribute(TRANSLATED_ATTR);
          }
          if (!img.getAttribute(PROCESSING_ATTR)) {
            processImage(img);
          }
        }
      }
    }
  });

  // ===== Start Observers =====
  function startObservers() {
    const target = document.body || document.documentElement;
    if (!target) return;
    mutationObserver.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset', 'data-src', 'data-lazy-src', 'data-original']
    });
  }

  if (document.body) {
    startObservers();
  } else {
    document.addEventListener('DOMContentLoaded', startObservers);
  }

  // ===== Message Handler =====
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.kind === 'translateSpecificImage') {
      const images = document.querySelectorAll('img');
      for (const img of images) {
        if (img.src === message.imageUrl || img.currentSrc === message.imageUrl) {
          const src = getEffectiveSrc(img);
          translatedSrcs.delete(src);
          pendingSrcs.delete(src);
          retryCountMap.delete(src);
          img.removeAttribute(TRANSLATED_ATTR);
          img.removeAttribute(PROCESSING_ATTR);
          translateImage(img);
          break;
        }
      }
    }

    if (message.kind === 'toggleTranslation') {
      isEnabled = message.enabled;
      console.log('[MangaTranslator] Translation', isEnabled ? 'enabled' : 'disabled');
      if (isEnabled) {
        scanForImages();
        handleStandaloneImage();
      }
    }

    if (message.kind === 'retranslateAll') {
      translatedSrcs.clear();
      pendingSrcs.clear();
      retryCountMap.clear();
      document.querySelectorAll(`[${TRANSLATED_ATTR}]`).forEach(img => {
        const originalSrc = img.getAttribute(ORIGINAL_SRC_ATTR);
        if (originalSrc) {
          img.src = originalSrc;
          const originalSrcset = img.getAttribute(ORIGINAL_SRCSET_ATTR);
          if (originalSrcset) img.srcset = originalSrcset;
        }
        img.removeAttribute(TRANSLATED_ATTR);
        img.removeAttribute(PROCESSING_ATTR);
      });
      if (isEnabled) setTimeout(scanForImages, 500);
    }

    if (message.kind === 'clearTranslations') {
      translatedSrcs.clear();
      pendingSrcs.clear();
      retryCountMap.clear();
      document.querySelectorAll(`[${TRANSLATED_ATTR}]`).forEach(img => {
        const originalSrc = img.getAttribute(ORIGINAL_SRC_ATTR);
        if (originalSrc) {
          img.src = originalSrc;
          const originalSrcset = img.getAttribute(ORIGINAL_SRCSET_ATTR);
          if (originalSrcset) img.srcset = originalSrcset;
        }
        img.removeAttribute(TRANSLATED_ATTR);
        img.removeAttribute(PROCESSING_ATTR);
      });
    }
  });

  // Initial scan
  if (isEnabled) scheduleInitialScan();
})();
