// Free Manga Translator - Popup Script
// Supports multiple Gemini keys (rotation) + OpenRouter fallback

document.addEventListener('DOMContentLoaded', () => {
  const geminiKeyInput = document.getElementById('geminiKeyInput');
  const addGeminiKeyBtn = document.getElementById('addGeminiKeyBtn');
  const geminiKeysList = document.getElementById('geminiKeysList');
  const geminiKeyCount = document.getElementById('geminiKeyCount');
  const openrouterKeyInput = document.getElementById('openrouterKeyInput');
  const saveOpenrouterBtn = document.getElementById('saveOpenrouterBtn');
  const apiStatus = document.getElementById('apiStatus');
  const translationToggle = document.getElementById('translationToggle');
  const translatePageBtn = document.getElementById('translatePageBtn');
  const translationPanelBtn = document.getElementById('translationPanelBtn');
  const clearBtn = document.getElementById('clearBtn');
  const retranslateBtn = document.getElementById('retranslateBtn');
  const fontSelect = document.getElementById('fontSelect');
  const fontColorInput = document.getElementById('fontColorInput');
  const statusText = document.getElementById('statusText');
  const statsText = document.getElementById('statsText');

  let geminiKeys = [];

  // ===== Load saved settings =====
  function loadSettings() {
    chrome.storage.local.get(
      ['geminiApiKeys', 'geminiApiKey', 'openrouterApiKey', 'translationEnabled', 'mangaFontStyle', 'mangaFontColor'],
      (result) => {
        // Support migration from single key to multi-key
        geminiKeys = result.geminiApiKeys || [];
        if (geminiKeys.length === 0 && result.geminiApiKey) {
          geminiKeys = [result.geminiApiKey];
          chrome.storage.local.set({ geminiApiKeys: geminiKeys });
        }

        renderGeminiKeys();
        updateApiStatus();

        if (result.openrouterApiKey) {
          openrouterKeyInput.value = '••••••••••••';
        }

        translationToggle.checked = result.translationEnabled !== false;
        if (result.mangaFontStyle) fontSelect.value = result.mangaFontStyle;
        if (result.mangaFontColor) fontColorInput.value = result.mangaFontColor;
      }
    );
  }

  // ===== Render Gemini Keys List =====
  function renderGeminiKeys() {
    geminiKeysList.innerHTML = '';
    geminiKeyCount.textContent = `(${geminiKeys.length})`;

    geminiKeys.forEach((key, index) => {
      const row = document.createElement('div');
      row.className = 'key-item';

      const label = document.createElement('span');
      label.className = 'key-item-label';
      label.textContent = `Key ${index + 1}: ...${key.slice(-6)}`;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn btn-remove';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => {
        geminiKeys.splice(index, 1);
        chrome.storage.local.set({ geminiApiKeys: geminiKeys });
        renderGeminiKeys();
        updateApiStatus();
      });

      row.appendChild(label);
      row.appendChild(removeBtn);
      geminiKeysList.appendChild(row);
    });
  }

  // ===== Update API Status Indicator =====
  function updateApiStatus() {
    chrome.storage.local.get(['openrouterApiKey'], (result) => {
      const hasKeys = geminiKeys.length > 0 || !!result.openrouterApiKey;
      apiStatus.className = 'status-dot' + (hasKeys ? ' active' : '');

      if (geminiKeys.length > 0 && result.openrouterApiKey) {
        statusText.textContent = `Ready — ${geminiKeys.length} Gemini key(s) + OpenRouter fallback`;
      } else if (geminiKeys.length > 0) {
        statusText.textContent = `Ready — ${geminiKeys.length} Gemini key(s)`;
      } else if (result.openrouterApiKey) {
        statusText.textContent = 'Ready — OpenRouter only';
      } else {
        statusText.textContent = 'Please add at least one API key';
      }
    });
  }

  // ===== Add Gemini Key =====
  addGeminiKeyBtn.addEventListener('click', () => {
    const key = geminiKeyInput.value.trim();
    if (!key || key.length < 10) return;
    if (geminiKeys.includes(key)) {
      statusText.textContent = 'This key is already added';
      return;
    }

    geminiKeys.push(key);
    chrome.storage.local.set({ geminiApiKeys: geminiKeys });
    geminiKeyInput.value = '';
    renderGeminiKeys();
    updateApiStatus();
    statusText.textContent = `Gemini key ${geminiKeys.length} added!`;
  });

  geminiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addGeminiKeyBtn.click();
  });

  // ===== Save OpenRouter Key =====
  saveOpenrouterBtn.addEventListener('click', () => {
    const key = openrouterKeyInput.value.trim();
    if (!key || key === '••••••••••••' || key.length < 10) return;

    chrome.storage.local.set({ openrouterApiKey: key }, () => {
      openrouterKeyInput.value = '••••••••••••';
      updateApiStatus();
      statusText.textContent = 'OpenRouter key saved!';
    });
  });

  openrouterKeyInput.addEventListener('focus', () => {
    if (openrouterKeyInput.value === '••••••••••••') {
      openrouterKeyInput.value = '';
    }
  });

  openrouterKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveOpenrouterBtn.click();
  });

  // ===== Translation Toggle =====
  translationToggle.addEventListener('change', () => {
    const enabled = translationToggle.checked;
    chrome.storage.local.set({ translationEnabled: enabled });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { kind: 'toggleTranslation', enabled });
      }
    });
  });

  // ===== Translate Page =====
  translatePageBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.storage.local.set({ translationEnabled: true });
        translationToggle.checked = true;
        chrome.tabs.sendMessage(tabs[0].id, { kind: 'toggleTranslation', enabled: true });
        statusText.textContent = 'Translating...';
        window.close();
      }
    });
  });

  // ===== Translation Panel =====
  translationPanelBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.runtime.sendMessage({ kind: 'startTranslationPanel', tabId: tabs[0].id });
        window.close();
      }
    });
  });

  // ===== Clear Translations =====
  clearBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { kind: 'clearTranslations' });
        chrome.runtime.sendMessage({ kind: 'clearCache' });
        statusText.textContent = 'Translations cleared';
      }
    });
  });

  // ===== Re-translate =====
  retranslateBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.runtime.sendMessage({ kind: 'clearCache' });
        chrome.tabs.sendMessage(tabs[0].id, { kind: 'retranslateAll' });
        statusText.textContent = 'Re-translating...';
        window.close();
      }
    });
  });

  // ===== Settings =====
  fontSelect.addEventListener('change', () => {
    chrome.storage.local.set({ mangaFontStyle: fontSelect.value });
  });

  fontColorInput.addEventListener('input', () => {
    chrome.storage.local.set({ mangaFontColor: fontColorInput.value });
  });

  // ===== Update Stats =====
  chrome.runtime.sendMessage({ kind: 'getTranslationStats' }, (response) => {
    if (response) {
      const parts = [];
      if (response.cacheSize > 0) parts.push(`${response.cacheSize} cached`);
      if (response.activeRequests > 0) parts.push(`${response.activeRequests} active`);
      if (response.queueLength > 0) parts.push(`${response.queueLength} queued`);
      if (parts.length > 0) statsText.textContent = parts.join(' · ');
    }
  });

  // Init
  loadSettings();
});