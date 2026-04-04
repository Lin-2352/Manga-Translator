// Free Manga Translator - Popup Script
// Supports config.json defaults + multi-provider key management

document.addEventListener('DOMContentLoaded', () => {
  const geminiKeyInput = document.getElementById('geminiKeyInput');
  const addGeminiKeyBtn = document.getElementById('addGeminiKeyBtn');
  const geminiKeysList = document.getElementById('geminiKeysList');
  const geminiKeyCount = document.getElementById('geminiKeyCount');
  const githubKeyInput = document.getElementById('githubKeyInput');
  const saveGithubBtn = document.getElementById('saveGithubBtn');
  const groqKeyInput = document.getElementById('groqKeyInput');
  const saveGroqBtn = document.getElementById('saveGroqBtn');
  const mistralKeyInput = document.getElementById('mistralKeyInput');
  const saveMistralBtn = document.getElementById('saveMistralBtn');
  const openrouterKeyInput = document.getElementById('openrouterKeyInput');
  const saveOpenrouterBtn = document.getElementById('saveOpenrouterBtn');
  const apiStatus = document.getElementById('apiStatus');
  const translationToggle = document.getElementById('translationToggle');
  const translatePageBtn = document.getElementById('translatePageBtn');
  const translationPanelBtn = document.getElementById('translationPanelBtn');
  const clearBtn = document.getElementById('clearBtn');
  const retranslateBtn = document.getElementById('retranslateBtn');
  const clearKeysBtn = document.getElementById('clearKeysBtn');
  const preferredProvider = document.getElementById('preferredProvider');
  const fontSelect = document.getElementById('fontSelect');
  const fontColorInput = document.getElementById('fontColorInput');
  const statusText = document.getElementById('statusText');
  const statsText = document.getElementById('statsText');
  const testKeysBtn = document.getElementById('testKeysBtn');
  const testResult = document.getElementById('testResult');

  let geminiKeys = [];
  const MASK = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';

  const ALL_KEY_FIELDS = [
    'geminiApiKeys', 'geminiApiKey', 'githubApiKey', 'groqApiKey',
    'mistralApiKey', 'openrouterApiKey', 'preferredProvider'
  ];

  // ===== Parse .env file =====
  function parseEnvFile(text) {
    const result = { geminiApiKeys: [] };
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim();
      if (!val) continue;
      if (key.startsWith('GEMINI_API_KEY')) result.geminiApiKeys.push(val);
      else if (key === 'GITHUB_API_KEY') result.githubApiKey = val;
      else if (key === 'GROQ_API_KEY') result.groqApiKey = val;
      else if (key === 'MISTRAL_API_KEY') result.mistralApiKey = val;
      else if (key === 'OPENROUTER_API_KEY') result.openrouterApiKey = val;
      else if (key === 'PREFERRED_PROVIDER') result.preferredProvider = val;
    }
    return result;
  }

  // ===== Load config.json + .env defaults =====
  async function loadConfigDefaults() {
    let config = {};
    // Try config.json first
    try {
      const resp = await fetch(chrome.runtime.getURL('config.json'));
      config = await resp.json();
    } catch {}
    // Merge .env on top (overrides config.json)
    try {
      const resp = await fetch(chrome.runtime.getURL('.env'));
      const text = await resp.text();
      const env = parseEnvFile(text);
      if (env.geminiApiKeys.length > 0) config.geminiApiKeys = env.geminiApiKeys;
      if (env.githubApiKey) config.githubApiKey = env.githubApiKey;
      if (env.groqApiKey) config.groqApiKey = env.groqApiKey;
      if (env.mistralApiKey) config.mistralApiKey = env.mistralApiKey;
      if (env.openrouterApiKey) config.openrouterApiKey = env.openrouterApiKey;
      if (env.preferredProvider) config.preferredProvider = env.preferredProvider;
    } catch {}
    return config;
  }

  // ===== Load saved settings (merge storage + config.json) =====
  async function loadSettings() {
    const config = await loadConfigDefaults();
    const result = await new Promise(resolve =>
      chrome.storage.local.get([
        ...ALL_KEY_FIELDS, 'translationEnabled', 'mangaFontStyle', 'mangaFontColor'
      ], resolve));

    // Merge: storage wins, config.json fills gaps
    geminiKeys = (result.geminiApiKeys && result.geminiApiKeys.length > 0)
      ? result.geminiApiKeys
      : (config.geminiApiKeys && config.geminiApiKeys.length > 0)
        ? config.geminiApiKeys
        : [];

    // Migrate legacy single key
    if (geminiKeys.length === 0 && result.geminiApiKey) {
      geminiKeys = [result.geminiApiKey];
    }

    const githubKey = result.githubApiKey || config.githubApiKey || '';
    const groqKey = result.groqApiKey || config.groqApiKey || '';
    const mistralKey = result.mistralApiKey || config.mistralApiKey || '';
    const openrouterKey = result.openrouterApiKey || config.openrouterApiKey || '';
    const prefProvider = result.preferredProvider || config.preferredProvider || 'gemini';

    // Persist merged keys to storage so background.js can access them
    const toStore = { geminiApiKeys: geminiKeys, preferredProvider: prefProvider };
    if (githubKey) toStore.githubApiKey = githubKey;
    if (groqKey) toStore.groqApiKey = groqKey;
    if (mistralKey) toStore.mistralApiKey = mistralKey;
    if (openrouterKey) toStore.openrouterApiKey = openrouterKey;
    chrome.storage.local.set(toStore);

    // Update UI
    renderGeminiKeys();
    updateApiStatus();

    if (githubKey) githubKeyInput.value = MASK;
    if (groqKey) groqKeyInput.value = MASK;
    if (mistralKey) mistralKeyInput.value = MASK;
    if (openrouterKey) openrouterKeyInput.value = MASK;

    // Auto-translate OFF by default
    translationToggle.checked = result.translationEnabled === true;
    preferredProvider.value = prefProvider;
    if (result.mangaFontStyle) fontSelect.value = result.mangaFontStyle;
    if (result.mangaFontColor) fontColorInput.value = result.mangaFontColor;
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
      removeBtn.textContent = '\u2715';
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
    chrome.storage.local.get(['githubApiKey', 'groqApiKey', 'mistralApiKey', 'openrouterApiKey'], (result) => {
      const providers = [];
      if (geminiKeys.length > 0) providers.push(`${geminiKeys.length} Gemini`);
      if (result.githubApiKey) providers.push('GitHub');
      if (result.groqApiKey) providers.push('Groq');
      if (result.mistralApiKey) providers.push('Mistral');
      if (result.openrouterApiKey) providers.push('OpenRouter');

      apiStatus.className = 'status-dot' + (providers.length > 0 ? ' active' : '');
      statusText.textContent = providers.length > 0
        ? `Ready \u2014 ${providers.join(' + ')}`
        : 'Please add at least one API key';
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

  // ===== Generic single-key provider setup =====
  function setupSingleKeyProvider(input, btn, storageKey, label) {
    btn.addEventListener('click', () => {
      const key = input.value.trim();
      if (!key || key === MASK || key.length < 10) return;
      chrome.storage.local.set({ [storageKey]: key }, () => {
        input.value = MASK;
        updateApiStatus();
        statusText.textContent = `${label} key saved!`;
      });
    });
    input.addEventListener('focus', () => {
      if (input.value === MASK) input.value = '';
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btn.click();
    });
  }

  setupSingleKeyProvider(githubKeyInput, saveGithubBtn, 'githubApiKey', 'GitHub');
  setupSingleKeyProvider(groqKeyInput, saveGroqBtn, 'groqApiKey', 'Groq');
  setupSingleKeyProvider(mistralKeyInput, saveMistralBtn, 'mistralApiKey', 'Mistral');
  setupSingleKeyProvider(openrouterKeyInput, saveOpenrouterBtn, 'openrouterApiKey', 'OpenRouter');

  // ===== Clear All Keys =====
  clearKeysBtn.addEventListener('click', () => {
    chrome.storage.local.remove(ALL_KEY_FIELDS, () => {
      geminiKeys = [];
      renderGeminiKeys();
      githubKeyInput.value = '';
      groqKeyInput.value = '';
      mistralKeyInput.value = '';
      openrouterKeyInput.value = '';
      updateApiStatus();
      statusText.textContent = 'All API keys cleared';
    });
  });

  // ===== Test All Configured API Keys =====
  testKeysBtn.addEventListener('click', async () => {
    testResult.style.display = 'block';
    testResult.style.background = '#e8eaf6';
    testResult.style.color = '#3949ab';
    testResult.textContent = 'Testing configured providers...';
    testKeysBtn.disabled = true;

    const results = [];

    // Test Gemini keys (stop at first success)
    if (geminiKeys.length > 0) {
      for (let i = 0; i < geminiKeys.length; i++) {
        testResult.textContent = `Testing Gemini key ${i + 1}/${geminiKeys.length}...`;
        try {
          const resp = await chrome.runtime.sendMessage({
            kind: 'testProviderKey', provider: 'gemini', apiKey: geminiKeys[i]
          });
          const ok = resp?.success;
          results.push(`Gemini ${i + 1}: ${ok ? '\u2713' : '\u2717'} ${resp?.message || resp?.error || ''}`);
          if (ok) break;
        } catch (e) {
          results.push(`Gemini ${i + 1}: \u2717 ${e.message}`);
        }
      }
    }

    // Test single-key providers
    const providers = [
      { id: 'github', key: 'githubApiKey', label: 'GitHub' },
      { id: 'groq', key: 'groqApiKey', label: 'Groq' },
      { id: 'mistral', key: 'mistralApiKey', label: 'Mistral' },
      { id: 'openrouter', key: 'openrouterApiKey', label: 'OpenRouter' },
    ];

    const stored = await new Promise(resolve =>
      chrome.storage.local.get(providers.map(p => p.key), resolve));

    for (const p of providers) {
      const apiKey = stored[p.key];
      if (!apiKey) continue;
      testResult.textContent = `Testing ${p.label}...`;
      try {
        const resp = await chrome.runtime.sendMessage({
          kind: 'testProviderKey', provider: p.id, apiKey
        });
        const ok = resp?.success;
        results.push(`${p.label}: ${ok ? '\u2713' : '\u2717'} ${resp?.message || resp?.error || ''}`);
      } catch (e) {
        results.push(`${p.label}: \u2717 ${e.message}`);
      }
    }

    if (results.length === 0) {
      testResult.style.background = '#fff3cd';
      testResult.style.color = '#856404';
      testResult.textContent = 'No API keys configured. Add at least one key.';
    } else {
      const anySuccess = results.some(r => r.includes('\u2713'));
      testResult.style.background = anySuccess ? '#d4edda' : '#f8d7da';
      testResult.style.color = anySuccess ? '#155724' : '#721c24';
      testResult.textContent = results.join('\n');
    }
    testKeysBtn.disabled = false;
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
  preferredProvider.addEventListener('change', () => {
    chrome.storage.local.set({ preferredProvider: preferredProvider.value });
  });

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
      if (parts.length > 0) statsText.textContent = parts.join(' \u00b7 ');
    }
  });

  // Init
  loadSettings();
});
