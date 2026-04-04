# Free Manga Translator - Chrome Extension
 
A free, open-source Chrome extension that translates Japanese, Chinese, and Korean manga/comics to English directly in your browser. No login, no paywall, no usage limits.
 
## Features
 
- **Auto-translate** manga images on any website (MangaDex, MangaKakalot, Webtoons, etc.)
- **Click-and-drag selection panel** for manual translation of specific regions
- **Right-click translate** any image via context menu
- **Multiple API key rotation** - add up to 10+ Gemini keys for seamless rate limit avoidance
- **OpenRouter fallback** - automatic failover if Gemini keys are exhausted
- **Translation caching** - previously translated images load instantly
- **Request deduplication** - prevents wasting API calls on duplicate images
- **Comic-style fonts** - CC Wild Words, Bangers, Patrick Hand included
- **Font customization** - choose font style and color
- **No server dependency** - all API calls go directly from your browser
- **No login required** - no accounts, no subscriptions, no tracking
 
## How It Works
 
1. The extension detects manga images on web pages using MutationObserver, ResizeObserver, and periodic scanning
2. Images are extracted, resized (max 1800x1800), and sent to Google Gemini AI
3. Gemini performs OCR + translation in a single multimodal API call
4. Translated text is overlaid on the original image using canvas rendering with comic-style fonts
5. Results are cached so re-visiting pages is instant
 
## Installation
 
### Step 1: Get a Free API Key (30 seconds)
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key
 
You can create multiple keys across different Google Cloud projects for higher rate limits.
 
### Step 2: Load the Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select the `free-manga-translator` folder
5. The extension icon will appear in your toolbar
 
### Step 3: Configure
1. Click the extension icon in your toolbar
2. Paste your Gemini API key(s) and click "Add"
3. (Optional) Add an OpenRouter API key as fallback
4. Toggle "Auto-translate images" on
5. Visit any manga reading site!

#### Optional local `.env` setup (recommended for local projects)
- Create/modify `.env` in the extension root:
     - `GEMINI_API_KEYS=key1,key2`
     - `GITHUB_API_KEY=...`
     - `GROQ_API_KEY=...`
     - `MISTRAL_API_KEY=...`
     - `OPENROUTER_API_KEY=...`
     - `PREFERRED_PROVIDER=gemini`
- On startup, the extension loads these values and stores them in `chrome.storage.local` when storage is empty.
 
## Usage
 
### Auto-Translation
- Enable "Auto-translate images" in the popup
- Navigate to any manga reading site
- Images are automatically detected and translated
 
### Manual Selection (Translation Panel)
- Click the extension icon → "Selection Panel"
- Click and drag over a manga panel on the page
- The selected region will be translated
 
### Right-Click Translation
- Right-click any image on a page
- Select "Translate this manga panel"
- That specific image will be translated
 
### Clear/Redo Translations
- "Clear All" - removes all translations and restores original images
- "Re-translate" - clears cache and re-translates all images on the page
 
## API Keys

You can provide keys either:
- through the popup UI, or
- through local `.env` (for unpacked/local development).
 
### Google Gemini (Primary - Free)
- **Free tier**: 15 requests/minute, 1 million tokens/day per key
- **Multiple keys**: Add 3+ keys for automatic rotation (45+ RPM)
- Get keys at: https://aistudio.google.com/apikey
 
### OpenRouter (Fallback - Optional)
- Automatic fallback if all Gemini keys are rate-limited
- Supports 100+ AI models
- Pay-as-you-go pricing (very cheap per image)
- Get key at: https://openrouter.ai/keys
 
## Technical Architecture
 
```
popup.html/js/css  →  Settings UI (API keys, font, toggle)
     ↕
background.js      →  Service worker (API calls, queue, cache, key rotation)
     ↕
content.js         →  Image detection (MutationObserver + ResizeObserver + polling)
                      Image extraction (canvas → base64, resize to 1800px max)
                      Translation overlay (canvas rendering, comic fonts, text fitting)
     ↕
translationPanel.js → Click-and-drag selection, tab capture, zoom-aware positioning
```
 
### Key Techniques (inspired by Ichigo Manga Translator)
- **Set-based request deduplication** prevents duplicate API calls
- **Fast hash sampling** (first/last 150 chars + 1/1000th sampling) for efficient cache keys
- **Aspect-ratio-preserving resize** with OR-logic bounds checking
- **OffscreenCanvas with bitmaprenderer** for high-quality image processing
- **Zoom-aware tab capture** compensates for browser/OS zoom levels
- **Percentage-based text positioning** in translation panel for responsive rendering
- **Backward drag support** in selection UI
- **DOM-based overflow detection** for accurate text fitting
 
## File Structure
 
```
free-manga-translator/
├── manifest.json           # Chrome extension manifest (V3)
├── background.js           # Service worker: Gemini/OpenRouter API, queue, cache
├── content.js              # Image detection, canvas overlay rendering
├── translationPanel.js     # Click-and-drag selection tool
├── popup.html              # Extension popup UI
├── popup.css               # Popup styling
├── popup.js                # Popup logic (multi-key management)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   └── icon128-disabled.png
├── fonts/
│   ├── CCWildWords-Regular.otf
│   ├── Bangers-Regular.ttf
│   └── PatrickHand-Regular.ttf
└── README.md
```
 
## Supported Sites
 
Works on any website that displays manga images, including:
- MangaDex
- MangaKakalot / Mangakakalot
- MangaReader
- Webtoons
- Tachiyomi web
- Raw manga sites
- Local files (enable "Allow access to file URLs" in extension settings)
 
## Troubleshooting
 
| Problem | Solution |
|---------|----------|
| Images not translating | Check that you've added at least one API key in the popup |
| "RATE_LIMITED" errors | Add more Gemini API keys (create new ones at AI Studio) |
| CORS errors on some sites | Try right-click → "Translate this manga panel" instead |
| Translation panel not working | Make sure browser zoom is at 100% for best results |
| Wrong translations | Try "Re-translate" button; Gemini quality varies by image quality |
 
## License
 
This project is for personal/educational use. The fonts included have their own licenses (see the original font files).