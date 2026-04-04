// Free Manga Translator - Translation Panel (Click-and-Drag Selection)
// Uses Ichigo's techniques: backward drag, zoom-aware positioning, percentage-based text boxes

(function () {
  'use strict';

  // Toggle: if panel already exists, remove it
  if (document.getElementById('fmt-panel-overlay')) {
    document.getElementById('fmt-panel-overlay').remove();
    return;
  }

  // ===== Inject panel styles =====
  const styleId = 'fmt-panel-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .fmt-fader {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        cursor: crosshair;
        background: rgba(0, 0, 0, 0.3);
      }
      .fmt-selection {
        position: fixed;
        border: 2px dashed #5c6bc0;
        background: rgba(92, 107, 192, 0.1);
        border-radius: 4px;
        display: none;
        z-index: 2147483647;
        pointer-events: none;
      }
      .fmt-instructions {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #1a1a2e;
        color: white;
        padding: 12px 24px;
        border-radius: 10px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 14px;
        z-index: 2147483647;
        pointer-events: none;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        white-space: nowrap;
      }
      .fmt-panel {
        all: initial;
        position: fixed;
        border: 2px dotted #5c6bc0;
        z-index: 2147483647;
        pointer-events: none;
      }
      .fmt-textbox {
        all: initial;
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        background-color: #FFFFFF;
        pointer-events: auto;
        z-index: 2147483647;
        text-align: center;
        font-weight: bold;
        line-height: 1.25;
        overflow: hidden;
        word-wrap: break-word;
        padding: 4px;
        cursor: default;
      }
      .fmt-loading {
        position: fixed;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.9);
        z-index: 2147483647;
        border-radius: 8px;
        border: 2px solid #5c6bc0;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 14px;
        color: #5c6bc0;
        font-weight: 600;
      }
      .fmt-close-btn {
        position: absolute;
        top: -14px;
        right: -14px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid #5c6bc0;
        background: white;
        color: #5c6bc0;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
        z-index: 2147483647;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      }
      .fmt-close-btn:hover {
        background: #5c6bc0;
        color: white;
      }
      @keyframes fmt-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .fmt-spinner {
        display: inline-block;
        animation: fmt-spin 1s linear infinite;
        margin-right: 8px;
      }
    `;
    document.head.appendChild(style);
  }

  // ===== Create overlay =====
  const overlay = document.createElement('div');
  overlay.id = 'fmt-panel-overlay';

  const fader = document.createElement('div');
  fader.className = 'fmt-fader';

  const selection = document.createElement('div');
  selection.className = 'fmt-selection';

  const instructions = document.createElement('div');
  instructions.className = 'fmt-instructions';
  instructions.textContent = 'Click and drag to select a manga panel. Press ESC to cancel.';

  overlay.appendChild(fader);
  overlay.appendChild(selection);
  overlay.appendChild(instructions);
  document.body.appendChild(overlay);

  // ===== Drag State =====
  let isDragging = false;
  let startX = 0, startY = 0;

  // ===== Mouse Handlers (Ichigo pattern: supports backward dragging) =====
  fader.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDragging = true;
    startX = Math.round(e.clientX);
    startY = Math.round(e.clientY);
    selection.style.display = 'block';
    selection.style.left = startX + 'px';
    selection.style.top = startY + 'px';
    selection.style.width = '0px';
    selection.style.height = '0px';
    instructions.style.display = 'none';
  });

  fader.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const currentX = Math.round(e.clientX);
    const currentY = Math.round(e.clientY);
    const w = currentX - startX;
    const h = currentY - startY;

    // Support backward dragging (Ichigo pattern)
    selection.style.left = (w < 0 ? currentX : startX) + 'px';
    selection.style.top = (h < 0 ? currentY : startY) + 'px';
    selection.style.width = Math.abs(w) + 'px';
    selection.style.height = Math.abs(h) + 'px';
  });

  fader.addEventListener('mouseup', async (e) => {
    if (!isDragging) return;
    isDragging = false;

    const currentX = Math.round(e.clientX);
    const currentY = Math.round(e.clientY);
    const w = Math.abs(currentX - startX);
    const h = Math.abs(currentY - startY);
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);

    // Minimum selection size
    if (w < 50 || h < 50) {
      cleanup();
      return;
    }

    // Hide overlay before capture (so it doesn't appear in screenshot)
    fader.style.display = 'none';
    selection.style.display = 'none';

    // Brief delay for DOM to update
    await new Promise(r => setTimeout(r, 150));

    // Show loading indicator
    const loading = document.createElement('div');
    loading.className = 'fmt-loading';
    loading.style.cssText = `left:${left}px;top:${top}px;width:${w}px;height:${h}px;`;
    loading.innerHTML = '<span class="fmt-spinner">🔄</span> Translating...';
    document.body.appendChild(loading);

    try {
      const response = await chrome.runtime.sendMessage({
        kind: 'translateSnapshot',
        dimensions: {
          left, top, width: w, height: h,
          devicePixelRatio: window.devicePixelRatio || 1
        }
      });

      loading.remove();

      if (response?.error) {
        showError(response.error, left, top, w, h);
        return;
      }

      if (response?.translations && response.translations.length > 0) {
        showTranslationPanel(response.translations, left, top, w, h, response.zoomFactor || 1, window.devicePixelRatio || 1);
      } else {
        showError('No translatable text found in selection', left, top, w, h);
      }
    } catch (error) {
      loading.remove();
      showError(error.message, left, top, w, h);
    }
  });

  // ===== Precision rounding (Ichigo's pattern) =====
  function precisionRound(num) {
    const m = Number((Math.abs(num) * 100).toPrecision(15));
    return (Math.round(m) / 100) * Math.sign(num);
  }

  // ===== Show Translation Panel (percentage-based text positioning, DPR-aware) =====
  function showTranslationPanel(translations, panelX, panelY, panelW, panelH, zoomFactor, dpr) {
    // The captured image dimensions are (panelW * zoomFactor * dpr) x (panelH * zoomFactor * dpr).
    // API coordinates are in that pixel space. To map back to panel percentages:
    const scale = zoomFactor * dpr;
    const imgW = panelW * scale;
    const imgH = panelH * scale;

    const panel = document.createElement('div');
    panel.className = 'fmt-panel';
    panel.style.left = panelX + 'px';
    panel.style.top = panelY + 'px';
    panel.style.width = panelW + 'px';
    panel.style.height = panelH + 'px';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'fmt-close-btn';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => {
      panel.remove();
      cleanup();
    });
    panel.appendChild(closeBtn);

    // Load font preference
    chrome.storage.local.get(['mangaFontStyle', 'mangaFontColor'], (result) => {
      const font = result.mangaFontStyle || 'CC Wild Words';
      const color = result.mangaFontColor || '#000000';

      for (const t of translations) {
        // Convert API pixel coords to panel-relative percentages
        const boxLeftPct = (t.minX / imgW) * 100;
        const boxTopPct = (t.minY / imgH) * 100;
        const boxWPct = ((t.maxX - t.minX) / imgW) * 100;
        const boxHPct = ((t.maxY - t.minY) / imgH) * 100;

        const textBox = document.createElement('div');
        textBox.className = 'fmt-textbox';
        textBox.style.left = precisionRound(boxLeftPct) + '%';
        textBox.style.top = precisionRound(boxTopPct) + '%';
        textBox.style.width = precisionRound(boxWPct) + '%';
        textBox.style.height = precisionRound(boxHPct) + '%';
        textBox.style.fontFamily = `"${font}", "Comic Sans MS", cursive`;
        textBox.style.color = color;
        textBox.style.fontSize = '16px';
        textBox.style.textShadow = '0 0 2px white, 0 0 2px white, 0 0 2px white';
        textBox.textContent = t.translatedText;

        panel.appendChild(textBox);

        // DOM-based fitText: shrink font until no overflow
        requestAnimationFrame(() => {
          let size = parseInt(textBox.style.fontSize);
          let attempts = 0;
          while (
            (textBox.scrollWidth > textBox.clientWidth || textBox.scrollHeight > textBox.clientHeight) &&
            size > 6 && attempts < 50
          ) {
            size--;
            textBox.style.fontSize = size + 'px';
            attempts++;
          }
        });
      }
    });

    document.body.appendChild(panel);
    overlay.remove();
  }

  // ===== Show Error =====
  function showError(message, x, y, w, h) {
    const errorPanel = document.createElement('div');
    errorPanel.style.cssText = `
      position:fixed; left:${x}px; top:${y}px; width:${w}px; height:${h}px;
      background:rgba(255,255,255,0.95); display:flex; flex-direction:column;
      align-items:center; justify-content:center; z-index:2147483647;
      border-radius:8px; border:2px solid #f44336;
      font-family:-apple-system,BlinkMacSystemFont,sans-serif; gap:10px; padding:16px;
    `;

    const errorText = document.createElement('div');
    errorText.style.cssText = 'color:#f44336;font-size:13px;text-align:center;max-width:90%;';

    // User-friendly error messages
    const friendlyMessages = {
      'NO_API_KEY': 'Please set your API key in the extension popup first',
      'INVALID_API_KEY': 'API key is invalid or expired. Please check your keys in the extension popup.',
      'RATE_LIMITED': 'Rate limited. Please wait a moment and try again.',
      'ALL_KEYS_FAILED': 'All API keys failed. Please check your keys are valid.',
      'FullQueue': 'Translation queue is full. Please wait and try again.',
      'CAPTURE_FAILED': 'Failed to capture the page. Please try again.',
    };
    // Match known error prefixes or show truncated message
    let displayMsg = friendlyMessages[message];
    if (!displayMsg) {
      for (const [key, msg] of Object.entries(friendlyMessages)) {
        if (message && message.startsWith(key)) { displayMsg = msg; break; }
      }
    }
    errorText.textContent = displayMsg || (message && message.length > 150 ? message.substring(0, 150) + '...' : message);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
      padding:8px 20px;border:1px solid #ccc;border-radius:6px;
      background:white;cursor:pointer;font-size:13px;
    `;
    closeBtn.addEventListener('click', () => { errorPanel.remove(); cleanup(); });

    errorPanel.appendChild(errorText);
    errorPanel.appendChild(closeBtn);
    document.body.appendChild(errorPanel);
    overlay.remove();
  }

  // ===== Cleanup =====
  function cleanup() {
    const el = document.getElementById('fmt-panel-overlay');
    if (el) el.remove();
  }

  // ===== ESC to cancel =====
  function escHandler(e) {
    if (e.key === 'Escape') {
      cleanup();
      document.removeEventListener('keydown', escHandler);
    }
  }
  document.addEventListener('keydown', escHandler);
})();