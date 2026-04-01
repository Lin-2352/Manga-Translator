// Free Manga Translator - Content Script
// Detects manga images on pages and overlays translations
// Uses techniques from Ichigo Manga Translator: MutationObserver + ResizeObserver + polling

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
  const RETRY_DELAY = 1500;
  const POLL_INTERVAL = 2000;

  // ===== State =====
  let isEnabled = false;
  let fontFamily = 'CC Wild Words';
  let fontColor = '#000000';
  const finishedImageHashes = new Set();
  const processingImages = new Set(); // Track elements being processed

  // ===== Load Settings =====
  chrome.storage.local.get(['translationEnabled', 'mangaFontStyle', 'mangaFontColor'], (result) => {
    isEnabled = result.translationEnabled !== false;
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

  // ===== Image Size Check (Ichigo's aspect-ratio-preserving resize) =====
  function calculateResizedDimensions(width, height) {
    const withinBounds = width <= MAX_DIMENSION || height <= MAX_DIMENSION;
    if (withinBounds) return { width, height };
    const ratio = Math.max(MAX_DIMENSION / height, MAX_DIMENSION / width);
    return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
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

  // ===== Fetch Image Cross-Origin (CORS fallback) =====
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

  // ===== Word Wrap =====
  function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  // ===== Fit Text to Box =====
  function fitText(ctx, text, boxWidth, boxHeight, fontFam) {
    const padding = 6;
    const availWidth = boxWidth - padding * 2;
    const availHeight = boxHeight - padding * 2;
    let fontSize = Math.min(Math.max(Math.floor(boxHeight * 0.4), 10), 40);

    for (; fontSize >= 8; fontSize--) {
      ctx.font = `bold ${fontSize}px "${fontFam}", "Comic Sans MS", cursive`;
      const lineHeight = fontSize * 1.3;
      const lines = wrapText(ctx, text, availWidth);
      const totalHeight = lines.length * lineHeight;
      if (totalHeight <= availHeight) {
        const allFit = lines.every(line => ctx.measureText(line).width <= availWidth);
        if (allFit) return { fontSize, lines, lineHeight, padding };
      }
    }
    ctx.font = `bold 8px "${fontFam}", "Comic Sans MS", cursive`;
    return { fontSize: 8, lines: wrapText(ctx, text, availWidth), lineHeight: 10, padding };
  }

  // ===== Draw Rounded Rectangle =====
  function drawRoundedRect(ctx, x, y, w, h, radius, fillColor) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
  }

  // ===== Overlay Translations onto Image =====
  function overlayTranslations(img, translations, imageData) {
    if (!translations || translations.length === 0) return;

    const canvas = document.createElement('canvas');
    const origW = imageData.originalWidth || imageData.width;
    const origH = imageData.originalHeight || imageData.height;
    canvas.width = origW;
    canvas.height = origH;
    const ctx = canvas.getContext('2d');

    // Draw original image
    ctx.drawImage(img, 0, 0, origW, origH);

    // Scale coordinates from API (resized) back to original dimensions
    const scaleX = origW / imageData.width;
    const scaleY = origH / imageData.height;

    for (const t of translations) {
      // Ichigo adds padding to box dimensions for better coverage
      const pad = 4;
      const minX = Math.max(0, Math.round(t.minX * scaleX) - pad);
      const minY = Math.max(0, Math.round(t.minY * scaleY) - pad);
      const maxX = Math.min(origW, Math.round(t.maxX * scaleX) + pad);
      const maxY = Math.min(origH, Math.round(t.maxY * scaleY) + pad);
      const boxW = maxX - minX;
      const boxH = maxY - minY;

      if (boxW < 10 || boxH < 10) continue;

      // White background with rounded corners (same as Ichigo)
      drawRoundedRect(ctx, minX, minY, boxW, boxH, 8, 'rgba(255, 255, 255, 0.95)');

      // Fit and draw text
      const { fontSize, lines, lineHeight, padding } = fitText(ctx, t.translatedText, boxW, boxH, fontFamily);

      ctx.font = `bold ${fontSize}px "${fontFamily}", "Comic Sans MS", cursive`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const totalTextH = lines.length * lineHeight;
      const startY = minY + (boxH - totalTextH) / 2;

      for (let i = 0; i < lines.length; i++) {
        const x = minX + boxW / 2;
        const y = startY + i * lineHeight;

        // White outline for readability (Ichigo uses text-shadow: 3px)
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(lines[i], x, y);

        // Main text
        ctx.fillStyle = fontColor;
        ctx.fillText(lines[i], x, y);
      }
    }

    // Replace image source
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
    if (img.getAttribute(TRANSLATED_ATTR) || img.getAttribute(PROCESSING_ATTR)) return false;
    if (processingImages.has(img)) return false;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (w < MIN_IMAGE_SIZE || h < MIN_IMAGE_SIZE) return false;
    // Skip tiny images, icons, avatars
    const rect = img.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) return false;
    return true;
  }

  // ===== Translate a Single Image =====
  async function translateImage(img) {
    if (!shouldTranslate(img)) return;

    processingImages.add(img);
    img.setAttribute(PROCESSING_ATTR, 'true');

    try {
      let imageData;

      // Try direct canvas extraction first
      try {
        imageData = await getImageBase64(img);
      } catch (e) {
        // CORS fallback: fetch image directly
        if (img.src && (img.src.startsWith('http://') || img.src.startsWith('https://'))) {
          try {
            const dataUrl = await fetchImageCrossOrigin(img.src);
            const tempImg = new Image();
            tempImg.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
              tempImg.onload = resolve;
              tempImg.onerror = reject;
              tempImg.src = dataUrl;
            });
            imageData = await getImageBase64(tempImg);
          } catch (corsError) {
            console.warn('[MangaTranslator] CORS blocked for:', img.src?.substring(0, 80));
            img.removeAttribute(PROCESSING_ATTR);
            processingImages.delete(img);
            return;
          }
        } else {
          img.removeAttribute(PROCESSING_ATTR);
          processingImages.delete(img);
          return;
        }
      }

      // Check if we already translated this image content
      const hash = simpleHash(imageData.dataUrl);
      if (finishedImageHashes.has(hash)) {
        img.removeAttribute(PROCESSING_ATTR);
        processingImages.delete(img);
        return;
      }

      // Send to background for translation
      const response = await chrome.runtime.sendMessage({
        kind: 'translateImage',
        base64Data: imageData.dataUrl
      });

      if (response?.error) {
        img.removeAttribute(PROCESSING_ATTR);
        processingImages.delete(img);

        // Retry on FullQueue (Ichigo's pattern: retry after delay)
        if (response.error === 'FullQueue' || response.error === 'RATE_LIMITED') {
          setTimeout(() => {
            img.removeAttribute(PROCESSING_ATTR);
            processingImages.delete(img);
            translateImage(img);
          }, RETRY_DELAY + Math.random() * 1000);
        }
        return;
      }

      finishedImageHashes.add(hash);

      if (response?.translations && response.translations.length > 0) {
        overlayTranslations(img, response.translations, imageData);
      } else {
        img.setAttribute(TRANSLATED_ATTR, 'no-text');
        img.removeAttribute(PROCESSING_ATTR);
      }
      processingImages.delete(img);
    } catch (error) {
      console.error('[MangaTranslator] Error:', error);
      img.removeAttribute(PROCESSING_ATTR);
      processingImages.delete(img);
    }
  }

  // Simple hash for deduplication
  function simpleHash(str) {
    if (!str) return '';
    let hash = 0;
    const step = Math.max(1, Math.floor(str.length / 500));
    for (let i = 0; i < str.length; i += step) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  // ===== Process an Image Element =====
  function processImage(img) {
    if (!isEnabled) return;
    if (img.getAttribute(TRANSLATED_ATTR) || img.getAttribute(PROCESSING_ATTR)) return;

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
    document.querySelectorAll('img').forEach(processImage);
  }

  // ===== Schedule Initial Scan =====
  function scheduleInitialScan() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(scanForImages, 500));
    } else {
      setTimeout(scanForImages, 500);
    }
    // Delayed scans for lazy-loaded content
    setTimeout(scanForImages, 3000);
    setTimeout(scanForImages, 6000);
  }

  // ===== MutationObserver (Ichigo pattern: watch for new images) =====
  const mutationObserver = new MutationObserver((mutations) => {
    if (!isEnabled) return;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeName === 'IMG') {
          processImage(node);
        } else if (node.querySelectorAll) {
          node.querySelectorAll('img').forEach(processImage);
        }
      }
    }
  });

  // ===== ResizeObserver (Ichigo pattern: detect lazy-loaded images that resize) =====
  const resizeObserver = new ResizeObserver((entries) => {
    if (!isEnabled) return;
    for (const entry of entries) {
      const el = entry.target;
      if (el.nodeName === 'IMG' && !el.getAttribute(TRANSLATED_ATTR) && !el.getAttribute(PROCESSING_ATTR)) {
        const w = el.naturalWidth || el.width;
        const h = el.naturalHeight || el.height;
        if (w >= MIN_IMAGE_SIZE && h >= MIN_IMAGE_SIZE) {
          translateImage(el);
        }
      }
    }
  });

  // Observe existing and new images with ResizeObserver
  function observeImage(img) {
    try { resizeObserver.observe(img); } catch (e) { /* ignore */ }
  }

  // ===== Polling (Ichigo pattern: periodic scan for missed images) =====
  setInterval(() => {
    if (!isEnabled) return;
    document.querySelectorAll('img').forEach((img) => {
      observeImage(img);
      if (!img.getAttribute(TRANSLATED_ATTR) && !img.getAttribute(PROCESSING_ATTR)) {
        if (img.complete && img.naturalWidth >= MIN_IMAGE_SIZE && img.naturalHeight >= MIN_IMAGE_SIZE) {
          translateImage(img);
        }
      }
    });
  }, POLL_INTERVAL);

  // ===== Start Observers =====
  if (document.body) {
    mutationObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    });
  }

  // ===== Message Handler =====
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.kind === 'translateSpecificImage') {
      const images = document.querySelectorAll('img');
      for (const img of images) {
        if (img.src === message.imageUrl || img.currentSrc === message.imageUrl) {
          img.removeAttribute(TRANSLATED_ATTR);
          img.removeAttribute(PROCESSING_ATTR);
          processingImages.delete(img);
          translateImage(img);
          break;
        }
      }
    }

    if (message.kind === 'toggleTranslation') {
      isEnabled = message.enabled;
      if (isEnabled) scanForImages();
    }

    if (message.kind === 'retranslateAll') {
      finishedImageHashes.clear();
      document.querySelectorAll(`[${TRANSLATED_ATTR}]`).forEach(img => {
        const originalSrc = img.getAttribute(ORIGINAL_SRC_ATTR);
        if (originalSrc) {
          img.src = originalSrc;
          const originalSrcset = img.getAttribute(ORIGINAL_SRCSET_ATTR);
          if (originalSrcset) img.srcset = originalSrcset;
        }
        img.removeAttribute(TRANSLATED_ATTR);
        img.removeAttribute(PROCESSING_ATTR);
        processingImages.delete(img);
      });
      if (isEnabled) setTimeout(scanForImages, 500);
    }

    if (message.kind === 'clearTranslations') {
      document.querySelectorAll(`[${TRANSLATED_ATTR}]`).forEach(img => {
        const originalSrc = img.getAttribute(ORIGINAL_SRC_ATTR);
        if (originalSrc) {
          img.src = originalSrc;
          const originalSrcset = img.getAttribute(ORIGINAL_SRCSET_ATTR);
          if (originalSrcset) img.srcset = originalSrcset;
        }
        img.removeAttribute(TRANSLATED_ATTR);
        img.removeAttribute(PROCESSING_ATTR);
        processingImages.delete(img);
      });
    }
  });

  // Initial scan
  if (isEnabled) scheduleInitialScan();
})();