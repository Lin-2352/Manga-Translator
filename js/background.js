/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/app/background.ts":
/*!*******************************!*\
  !*** ./src/app/background.ts ***!
  \*******************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
/* Background process for the Ichigo extension.
 * This module should be used to process async work.
 * Handle failures in a robust manner and avoid the fail-fast pattern, unless in debug mode. */
const chromeApi_1 = __webpack_require__(/*! ../utils/chromeApi */ "./src/utils/chromeApi.ts");
const appConfig_1 = __webpack_require__(/*! ../utils/appConfig */ "./src/utils/appConfig.ts");
const ichigoApi_1 = __webpack_require__(/*! ../utils/ichigoApi */ "./src/utils/ichigoApi.ts");
const translateWithScaling_1 = __webpack_require__(/*! ./translateWithScaling */ "./src/app/translateWithScaling.ts");
const contextMenus_1 = __webpack_require__(/*! ./background/contextMenus */ "./src/app/background/contextMenus.ts");
const fastHash_1 = __webpack_require__(/*! ./utils/fastHash */ "./src/app/utils/fastHash.ts");
(0, contextMenus_1.initContextMenus)();
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    handleMessages(message, sender).then(sendResponse);
    return true;
});
const outgoingTranslationRequests = new Set();
function handleMessages(message, sender) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!message) {
            (0, ichigoApi_1.debug)(`Message must not be empty.\n sender:\n ${JSON.stringify(sender)}`);
            return;
        }
        switch (message.kind) {
            case 'translateImage':
                const translateErrorMessage = validateImageMessage(message);
                if (translateErrorMessage) {
                    (0, ichigoApi_1.debug)(`${translateErrorMessage}\n message:\n ${JSON.stringify(message)}`);
                    return;
                }
                const imageIdentity = message.translateTo +
                    ((_a = message.translationModel) !== null && _a !== void 0 ? _a : ':unknown:') +
                    (0, fastHash_1.fastHash)(message.image.src || message.image.base64Data);
                // Already translating the image.
                if (outgoingTranslationRequests.has(imageIdentity)) {
                    return 'FullQueue';
                }
                if (outgoingTranslationRequests.size > 2) {
                    return 'FullQueue';
                }
                try {
                    outgoingTranslationRequests.add(imageIdentity);
                    const translation = yield (0, translateWithScaling_1.translate)(message.image, message.translateTo, message.translationModel, message.includeBase64Data);
                    return translation;
                }
                finally {
                    outgoingTranslationRequests.delete(imageIdentity);
                }
            case 'translateSnapshot':
                const snapshotErrorMessage = validateSnapshotMessage(message);
                if (snapshotErrorMessage) {
                    (0, ichigoApi_1.debug)(`${snapshotErrorMessage}\n message:\n ${JSON.stringify(message)}`);
                    return;
                }
                const snapshot = yield takeSnapshot(message.dimensions, sender.tab);
                if (!snapshot) {
                    return;
                }
                const image = {
                    src: snapshot.dataUrl,
                    width: message.dimensions.width,
                    height: message.dimensions.height
                };
                const snapshotTranslation = yield (0, translateWithScaling_1.translate)(image, message.translateTo, message.translationModel);
                // Possibly free up memory. May not have any impact at all, but (probably) doesn't hurt.
                delete snapshot.dataUrl;
                return {
                    translations: snapshotTranslation.translations,
                    zoomFactor: snapshot.zoomFactor
                };
            case 'setExtensionIcon':
                yield doSetExtensionIcon();
                return;
            case 'openLoginPopup':
                const currentTab = yield (0, chromeApi_1.getCurrentTab)();
                chrome.windows.create({
                    focused: true,
                    width: 376,
                    height: 440,
                    type: 'popup',
                    url: `loginPopup.html?refreshOnCompleteTabId=${currentTab.id}`,
                    top: 0,
                    left: 0
                }, () => { });
                return;
            case 'openSettings':
                chrome.tabs.create({
                    url: `chrome://extensions/?id=${chrome.runtime.id}`
                });
                return;
            default:
                (0, ichigoApi_1.debug)(`Unsupported message kind.\n sender:\n ${JSON.stringify(sender)}\n Received message: \n ${JSON.stringify(message)}`);
        }
    });
}
// Returns an error message string on error.
// undefined means there are no errors.
function validateImageMessage(message) {
    let errorMessage = '';
    const image = message.image;
    if (!image) {
        return 'translateImage message must set image.';
    }
    if (!image.src && !image.base64Data) {
        errorMessage += 'translateImage message must set image.src or image.base64Data\n';
    }
    if (!image.height) {
        errorMessage += 'translateImage message must set image.height\n';
    }
    if (!image.width) {
        errorMessage += 'translateImage message must set image.width\n';
    }
    if (!message.translateTo) {
        errorMessage += 'translateImage message must set translateTo\n';
    }
    return errorMessage === '' ? undefined : errorMessage;
}
// Returns an error message string on error.
// undefined means there are no errors.
function validateSnapshotMessage(message) {
    let errorMessage = '';
    if (!message.translateTo) {
        errorMessage += 'Must supply translateTo.\n';
    }
    if (message.dimensions == null) {
        errorMessage += 'Must supply dimensions of top, left, width, and height.\n';
    }
    else {
        const dimensions = message.dimensions;
        if (!Number.isInteger(dimensions.top)) {
            errorMessage += 'top must be an integer.';
        }
        if (!Number.isInteger(dimensions.left)) {
            errorMessage += 'left must be an integer.';
        }
        if (!Number.isInteger(dimensions.width)) {
            errorMessage += 'width must be an integer.';
        }
        if (!Number.isInteger(dimensions.height)) {
            errorMessage += 'height must be an integer.';
        }
    }
    return errorMessage === '' ? undefined : errorMessage;
}
function doSetExtensionIcon() {
    return __awaiter(this, void 0, void 0, function* () {
        // Calculate if Manga Translator is active on the current tab.
        const activeTab = yield (0, chromeApi_1.getCurrentTab)();
        const activeUrls = yield appConfig_1.appConfig.getActiveUrls();
        if (activeTab && activeUrls.includes(activeTab.getHostName())) {
            yield (0, chromeApi_1.setExtensionIcon)({
                path: chrome.runtime.getURL('icons/128x128.png'),
                tabId: activeTab.id
            });
        }
    });
}
function takeSnapshot(_a, tab_1) {
    return __awaiter(this, arguments, void 0, function* ({ top, left, height, width }, tab) {
        if (tab == null) {
            return;
        }
        const dataUrl = yield (0, chromeApi_1.captureVisibleTab)(tab.windowId);
        // Something went wrong. Possibly closed tab or refreshed.
        if (!dataUrl) {
            return;
        }
        const zoomFactor = yield (0, chromeApi_1.getZoomFactor)(tab.id);
        const dataUrlFetch = yield fetch(dataUrl);
        const visibleTabBlob = yield dataUrlFetch.blob();
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext('bitmaprenderer');
        const bitmap = yield createImageBitmap(visibleTabBlob, zoomFactor * left, zoomFactor * top, zoomFactor * width, zoomFactor * height);
        context.transferFromImageBitmap(bitmap);
        const snippetBlob = yield canvas.convertToBlob();
        // WebP is faster than PNG and still lossless.
        return {
            dataUrl: yield blobToBase64(snippetBlob),
            zoomFactor
        };
    });
}
function blobToBase64(blob) {
    return new Promise((resolve, _) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}
// Workaround:
// https://stackoverflow.com/questions/71724980/chrome-extension-always-show-service-worker-inactive-after-browser-restart-if
chrome.runtime.onStartup.addListener(function () {
    console.log('ichigo-extension-startup');
});


/***/ }),

/***/ "./src/app/background/contextMenus.ts":
/*!********************************************!*\
  !*** ./src/app/background/contextMenus.ts ***!
  \********************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.initContextMenus = initContextMenus;
const chromeApi_1 = __webpack_require__(/*! ../../utils/chromeApi */ "./src/utils/chromeApi.ts");
const appConfig_1 = __webpack_require__(/*! ../../utils/appConfig */ "./src/utils/appConfig.ts");
const m = chrome.i18n.getMessage;
const translatedPageMenuId = 'ichigo-translate-page';
function initContextMenus() {
    return __awaiter(this, void 0, void 0, function* () {
        // Clear previous context menu to prevent "duplicate context menu" error.
        yield removeContextMenu(translatedPageMenuId);
        chrome.contextMenus.create({
            id: translatedPageMenuId,
            title: m('toggleTranslationsContextMenu'),
            type: 'normal',
            contexts: ['all']
        });
        chrome.contextMenus.onClicked.addListener((context) => __awaiter(this, void 0, void 0, function* () {
            if ((context === null || context === void 0 ? void 0 : context.menuItemId) !== translatedPageMenuId) {
                return;
            }
            const tab = yield (0, chromeApi_1.getCurrentTab)();
            if (!tab) {
                return;
            }
            const configActiveUrls = yield appConfig_1.appConfig.getActiveUrls();
            const isToggledOn = configActiveUrls.includes(tab.getHostName());
            if (isToggledOn) {
                // Toggle off.
                yield appConfig_1.appConfig.removeActiveUrl(tab.getHostName());
                yield (0, chromeApi_1.setExtensionIcon)({
                    path: chrome.runtime.getURL('icons/128x128-disabled.png'),
                    tabId: tab.id
                });
                yield (0, chromeApi_1.executeScript)(tab.id, 'js/clearTranslations.js');
            }
            else {
                // Toggle on.
                yield appConfig_1.appConfig.addActiveUrl(tab.getHostName());
                yield (0, chromeApi_1.setExtensionIcon)({
                    path: chrome.runtime.getURL('icons/128x128.png'),
                    tabId: tab.id
                });
            }
        }));
    });
}
function removeContextMenu(menuId) {
    return new Promise(resolve => {
        chrome.contextMenus.remove(menuId, () => {
            if (chrome.runtime.lastError) {
                // Do nothing if an error occurs. Can happen if menu item doesn't exist.
            }
            resolve(undefined);
        });
    });
}


/***/ }),

/***/ "./src/app/translateWithScaling.ts":
/*!*****************************************!*\
  !*** ./src/app/translateWithScaling.ts ***!
  \*****************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.translate = translate;
const ichigoApi_1 = __webpack_require__(/*! ../utils/ichigoApi */ "./src/utils/ichigoApi.ts");
const imageUtils_1 = __webpack_require__(/*! ./utils/imageUtils */ "./src/app/utils/imageUtils.ts");
const translation_1 = __webpack_require__(/*! ../utils/translation */ "./src/utils/translation.ts");
const fastHash_1 = __webpack_require__(/*! ./utils/fastHash */ "./src/app/utils/fastHash.ts");
const translationCache = {};
// Note this can only be called from contexts which can make HTTP requests.
// For example, `background.ts`.
function translate(originalImage, translateTo, translationModel, includeBase64Data) {
    return __awaiter(this, void 0, void 0, function* () {
        let imageToTranslate = originalImage;
        if (imageToTranslate.base64Data === undefined && originalImage.src) {
            const fetchedImage = yield fetchImageWithScaling(originalImage);
            const failed = fetchedImage === 'FetchError' || fetchedImage === 'SiteAccessError';
            if (failed) {
                // Return the error to the caller.
                return fetchedImage;
            }
            imageToTranslate = fetchedImage;
        }
        // If we couldn't get base64 data from the original image or with `fetchImageWithScaling`, return failure.
        if (imageToTranslate.base64Data === undefined) {
            return 'FetchError';
        }
        // Cache translations on the MD5 hash of the image data.
        // The URL is not used as the key because it may return different results depending on various factors.
        const imageIdentity = translateTo + (translationModel !== null && translationModel !== void 0 ? translationModel : ':unknown:') + (0, fastHash_1.fastHash)(imageToTranslate.base64Data);
        const cachedTranslation = translationCache[imageIdentity];
        const result = cachedTranslation ||
            (yield (0, ichigoApi_1.translateImage)(translateTo, imageToTranslate.base64Data, translationModel));
        if (!result.errorMessage) {
            translationCache[imageIdentity] = result;
        }
        const base64Data = includeBase64Data && imageToTranslate.base64Data;
        return {
            image: { width: imageToTranslate.width, height: imageToTranslate.height },
            translations: result.translations,
            base64Data
        };
    });
}
function fetchImageWithScaling(image) {
    return __awaiter(this, void 0, void 0, function* () {
        // Downscale extra large images. Helps prevent processing timeouts.
        const [resizedWidth, resizedHeight] = (0, translation_1.calculateResizedAspectRatio)({
            width: image.width,
            height: image.height,
            heightMaxPx: 1800,
            widthMaxPx: 1800
        });
        (0, ichigoApi_1.debug)(`h:${resizedHeight} w:${resizedWidth}`);
        const resizedImage = Object.assign(Object.assign({}, image), { originalWidth: image.width, originalHeight: image.height, resizedWidth,
            resizedHeight });
        const encodedImage = yield (0, imageUtils_1.getBase64Data)(resizedImage);
        return encodedImage;
    });
}


/***/ }),

/***/ "./src/app/utils/fastHash.ts":
/*!***********************************!*\
  !*** ./src/app/utils/fastHash.ts ***!
  \***********************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.fastHash = fastHash;
function fastHash(str) {
    let hash = '';
    const len = str.length;
    const selectCount = 150;
    // Select the first 150 characters.
    for (let i = 0; i < selectCount && i < len; i++) {
        hash += str.charCodeAt(i);
    }
    // Select the last 150 characters.
    for (let i = len - selectCount; i < len; i++) {
        if (i >= 0) {
            hash += str.charCodeAt(i);
        }
    }
    // Loop through the entire string, increasing the index by a slice of 1/1000th the total length
    const step = Math.ceil(len / 1000) + 1;
    for (let i = 0; i < len; i += step) {
        hash += str.charCodeAt(i);
    }
    return hash;
}


/***/ }),

/***/ "./src/app/utils/imageUtils.ts":
/*!*************************************!*\
  !*** ./src/app/utils/imageUtils.ts ***!
  \*************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getBase64Data = getBase64Data;
const ichigoApi_1 = __webpack_require__(/*! ../../utils/ichigoApi */ "./src/utils/ichigoApi.ts");
const utils_1 = __webpack_require__(/*! ./utils */ "./src/app/utils/utils.ts");
function getBase64Data(_a) {
    return __awaiter(this, arguments, void 0, function* ({ src, resizedWidth, resizedHeight, originalHeight, originalWidth }) {
        let imageData;
        try {
            imageData = yield (0, utils_1.getImage)(src);
        }
        catch (error) {
            // This can happen if the users sets Manga Translator's "Site Access" to "On click",
            // instead of "On all sites", due to CORS. It can also happen if referer is not properly set, on some domains.
            return 'SiteAccessError';
        }
        if (!validStatusCode(imageData.status)) {
            return 'FetchError';
        }
        const blob = yield imageData.blob();
        const shouldResize = resizedWidth != originalWidth || resizedHeight != originalHeight;
        if (shouldResize) {
            (0, ichigoApi_1.debug)(`resized: ${resizedWidth}/${originalWidth} : ${resizedHeight}/${originalHeight}`);
            const canvas = new OffscreenCanvas(resizedWidth, resizedHeight);
            const context = canvas.getContext('bitmaprenderer');
            const bitmap = yield createImageBitmap(blob, {
                resizeWidth: resizedWidth,
                resizeHeight: resizedHeight,
                resizeQuality: 'high'
            });
            context.transferFromImageBitmap(bitmap);
            const resizedBlob = yield canvas.convertToBlob();
            const base64Data = yield blobToBase64(resizedBlob);
            return { base64Data, width: resizedWidth, height: resizedHeight };
        }
        else {
            const base64Data = yield blobToBase64(blob);
            return { base64Data, width: originalWidth, height: originalHeight };
        }
    });
}
function blobToBase64(blob) {
    return new Promise((resolve, _) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}
function validStatusCode(statusCode) {
    // See: https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
    return statusCode >= 200 && statusCode < 400;
}


/***/ }),

/***/ "./src/app/utils/utils.ts":
/*!********************************!*\
  !*** ./src/app/utils/utils.ts ***!
  \********************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.sleepMs = sleepMs;
exports.getImage = getImage;
const chromeApi_1 = __webpack_require__(/*! ../../utils/chromeApi */ "./src/utils/chromeApi.ts");
// A set of common functions that aren't worth grouping alone.
// Break module into multiple modules when it grows too large (800+ LOC).
function sleepMs(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}
const ModifyHeaders = 'modifyHeaders';
const SetHeader = 'set';
const Request = 'xmlhttprequest';
let id = 1;
function getId() {
    return id++;
}
function getImage(src) {
    return __awaiter(this, void 0, void 0, function* () {
        let hostname;
        try {
            hostname = new URL(src).hostname;
        }
        catch (_a) {
            hostname = '';
        }
        // Check if hostname matches any of the referer header rule ids.
        const ruleValues = Object.values(rules);
        for (const rule of ruleValues) {
            if (hostname.includes(rule.condition.urlFilter)) {
                const clonedRule = Object.assign(Object.assign({}, rule), { id: getId() });
                (0, chromeApi_1.updateSessionHeaders)({ addRules: [clonedRule] });
                const result = yield fetch(src);
                (0, chromeApi_1.updateSessionHeaders)({ removeRuleIds: [clonedRule.id] });
                return result;
            }
        }
        // Otherwise, return regular fetch request.
        return yield fetch(src);
    });
}
const rules = {
    pixiv: {
        id: getId(),
        priority: 1,
        action: {
            type: ModifyHeaders,
            requestHeaders: [
                { header: 'referer', operation: SetHeader, value: 'https://www.pixiv.net/' }
            ]
        },
        condition: {
            urlFilter: 'pximg.net',
            resourceTypes: [Request]
        }
    },
    manhuagui: {
        id: getId(),
        priority: 1,
        action: {
            type: ModifyHeaders,
            requestHeaders: [
                {
                    header: 'referer',
                    operation: SetHeader,
                    value: 'https://www.manhuagui.com/'
                }
            ]
        },
        condition: {
            urlFilter: 'i.hamreus.com',
            resourceTypes: [Request]
        }
    },
    hitomi: {
        id: getId(),
        priority: 1,
        action: {
            type: ModifyHeaders,
            requestHeaders: [
                {
                    header: 'referer',
                    operation: SetHeader,
                    value: 'https://hitomi.la/'
                }
            ]
        },
        condition: {
            urlFilter: 'hitomi.la',
            resourceTypes: [Request]
        }
    },
    klmanga: {
        id: getId(),
        priority: 1,
        action: {
            type: ModifyHeaders,
            requestHeaders: [
                {
                    header: 'referer',
                    operation: SetHeader,
                    value: 'https://klmanga.com/'
                }
            ]
        },
        condition: {
            urlFilter: 'klimv1.xyz',
            resourceTypes: [Request]
        }
    }
};


/***/ }),

/***/ "./src/utils/appConfig.ts":
/*!********************************!*\
  !*** ./src/utils/appConfig.ts ***!
  \********************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.appConfig = exports.defaults = void 0;
const locales_1 = __webpack_require__(/*! ./locales */ "./src/utils/locales.ts");
const chromeApi_1 = __webpack_require__(/*! ./chromeApi */ "./src/utils/chromeApi.ts");
const uuid_1 = __webpack_require__(/*! uuid */ "./node_modules/uuid/dist/esm-browser/index.js");
var Keys;
(function (Keys) {
    Keys["Email"] = "email";
    Keys["FontFamily"] = "fontFamily";
    Keys["FontColor"] = "fontColor";
    Keys["FontWeight"] = "fontWeight";
    Keys["ActiveUrls"] = "activeUrls";
    Keys["ClientUuid"] = "clientUuid";
    Keys["TranslateToLanguage"] = "translateToLanguage";
    Keys["TranslationModel"] = "translationModel";
})(Keys || (Keys = {}));
exports.defaults = Object.freeze({
    email: '',
    fontFamily: 'CC Wild Words',
    fontColor: '#000000',
    fontWeight: 'initial',
    translateToLanguage: (0, locales_1.getDefaultLanguage)(),
    translationModel: 'gpt4o-mini'
});
// Used to check if any of the activeUrl appConfig properties have been accessed.
// This is so defaults can be initialized.
// This cannot be done in chrome.runtime.onInstalled due to that event being triggered on chrome updates,
// and on app updates.
const hasInitActiveUrlDefaults = '_isActiveUrlInitKey';
const commonMangaSites = [];
exports.appConfig = Object.freeze({
    getClientUuid: () => __awaiter(void 0, void 0, void 0, function* () {
        const clientUuid = yield (0, chromeApi_1.getStorageItem)(Keys.ClientUuid);
        if (clientUuid) {
            return clientUuid;
        }
        // Initialize client uuid.
        // If storage is full, this could fail repeatedly, but client uuids are not crucial.
        const newUuid = (0, uuid_1.v4)();
        yield (0, chromeApi_1.setStorageItem)(Keys.ClientUuid, newUuid);
        return newUuid;
    }),
    getEmail: () => __awaiter(void 0, void 0, void 0, function* () { var _a; return (_a = (yield (0, chromeApi_1.getStorageItem)(Keys.Email))) !== null && _a !== void 0 ? _a : exports.defaults.email; }),
    setEmail: (email) => __awaiter(void 0, void 0, void 0, function* () { return yield (0, chromeApi_1.setStorageItem)(Keys.Email, email); }),
    getTranslationModel: () => __awaiter(void 0, void 0, void 0, function* () {
        const translationModel = yield (0, chromeApi_1.getStorageItem)(Keys.TranslationModel);
        if (!translationModel) {
            return undefined;
        }
        return translationModel;
    }),
    setTranslationModel: (model) => __awaiter(void 0, void 0, void 0, function* () { return yield (0, chromeApi_1.setStorageItem)(Keys.TranslationModel, model); }),
    // Returns the language code of the language to translate to. Eg 'en', 'ja', 'zh-CN', ..
    getTranslateToLanguage: () => __awaiter(void 0, void 0, void 0, function* () {
        const translateToLanguage = yield (0, chromeApi_1.getStorageItem)(Keys.TranslateToLanguage);
        if (!translateToLanguage) {
            return (0, locales_1.getDefaultLanguage)();
        }
        return translateToLanguage;
    }),
    setTranslateToLanguage: (languageCode) => __awaiter(void 0, void 0, void 0, function* () {
        if (!locales_1.languageCodes.includes(languageCode)) {
            console.warn(`Invalid language code: ${languageCode}. Overwriting with default.`);
            languageCode = (0, locales_1.getDefaultLanguage)();
        }
        return yield (0, chromeApi_1.setStorageItem)(Keys.TranslateToLanguage, languageCode);
    }),
    getUIFontFamily: () => {
        const language = navigator.language.split('-')[0];
        switch (language) {
            // No font file at the moment for these: use whatever the default font is.
            case 'hi':
            case 'th':
            case 'ja':
            case 'ko':
            case 'zh':
            case 'vi':
            case 'ar':
                return 'system-default';
            default:
                return 'PatrickHand-Regular';
        }
    },
    getFontFamily: () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const fontFamily = (_a = (yield (0, chromeApi_1.getStorageItem)(Keys.FontFamily))) !== null && _a !== void 0 ? _a : exports.defaults.fontFamily;
        const language = yield exports.appConfig.getTranslateToLanguage();
        switch (language) {
            // These languages are unsupported for the usual font options.
            case 'hi':
            case 'th':
            case 'ja':
            case 'ko':
            case 'zh-CN':
            case 'zh-TW':
            case 'vi':
            case 'ar':
                return 'system-default';
            default:
                return fontFamily;
        }
    }),
    setFontFamily: (fontFamily) => __awaiter(void 0, void 0, void 0, function* () { return yield (0, chromeApi_1.setStorageItem)(Keys.FontFamily, fontFamily); }),
    getFontColor: () => __awaiter(void 0, void 0, void 0, function* () { var _a; return (_a = (yield (0, chromeApi_1.getStorageItem)(Keys.FontColor))) !== null && _a !== void 0 ? _a : exports.defaults.fontColor; }),
    setFontColor: (fontColor) => __awaiter(void 0, void 0, void 0, function* () { return yield (0, chromeApi_1.setStorageItem)(Keys.FontColor, fontColor); }),
    getFontWeight: () => __awaiter(void 0, void 0, void 0, function* () { var _a; return (_a = (yield (0, chromeApi_1.getStorageItem)(Keys.FontWeight))) !== null && _a !== void 0 ? _a : exports.defaults.fontWeight; }),
    setFontWeight: (fontWeight) => __awaiter(void 0, void 0, void 0, function* () { return yield (0, chromeApi_1.setStorageItem)(Keys.FontWeight, fontWeight); }),
    getActiveUrls: () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const hasInitDefaults = yield (0, chromeApi_1.getStorageItem)(hasInitActiveUrlDefaults);
        if (!hasInitDefaults) {
            yield (0, chromeApi_1.setStorageItem)(Keys.ActiveUrls, commonMangaSites);
            yield (0, chromeApi_1.setStorageItem)(hasInitActiveUrlDefaults, true);
        }
        return (_a = (yield (0, chromeApi_1.getStorageItem)(Keys.ActiveUrls))) !== null && _a !== void 0 ? _a : [];
    }),
    addActiveUrl: (activeUrl) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const hasInitDefaults = yield (0, chromeApi_1.getStorageItem)(hasInitActiveUrlDefaults);
        if (!hasInitDefaults) {
            yield (0, chromeApi_1.setStorageItem)(Keys.ActiveUrls, commonMangaSites);
            yield (0, chromeApi_1.setStorageItem)(hasInitActiveUrlDefaults, true);
        }
        const activeUrls = (_a = (yield (0, chromeApi_1.getStorageItem)(Keys.ActiveUrls))) !== null && _a !== void 0 ? _a : [];
        return yield (0, chromeApi_1.setStorageItem)(Keys.ActiveUrls, [...activeUrls, activeUrl]);
    }),
    removeActiveUrl: (activeUrl) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const hasInitDefaults = yield (0, chromeApi_1.getStorageItem)(hasInitActiveUrlDefaults);
        if (!hasInitDefaults) {
            yield (0, chromeApi_1.setStorageItem)(Keys.ActiveUrls, commonMangaSites);
            yield (0, chromeApi_1.setStorageItem)(hasInitActiveUrlDefaults, true);
        }
        const activeUrls = (_a = (yield (0, chromeApi_1.getStorageItem)(Keys.ActiveUrls))) !== null && _a !== void 0 ? _a : [];
        return yield (0, chromeApi_1.setStorageItem)(Keys.ActiveUrls, activeUrls.filter(url => url !== activeUrl));
    })
});


/***/ }),

/***/ "./src/utils/chromeApi.ts":
/*!********************************!*\
  !*** ./src/utils/chromeApi.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getCurrentTab = getCurrentTab;
exports.updateSessionHeaders = updateSessionHeaders;
exports.captureVisibleTab = captureVisibleTab;
exports.getZoomFactor = getZoomFactor;
exports.setExtensionIcon = setExtensionIcon;
exports.executeScript = executeScript;
exports.isAllowedFileSchemeAccess = isAllowedFileSchemeAccess;
exports.postBackgroundMessage = postBackgroundMessage;
exports.getStorageItem = getStorageItem;
exports.setStorageItem = setStorageItem;
// Module for making working with the Chrome API easier.
// This may include making the API async, simplifying the interface, or more.
function getCurrentTab() {
    return new Promise(resolve => {
        chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
            if (chrome.runtime.lastError) {
                resolve(undefined);
                return;
            }
            const currentTab = tabs[0];
            if (!(currentTab === null || currentTab === void 0 ? void 0 : currentTab.url)) {
                resolve(undefined);
                return;
            }
            currentTab.getHostName = () => {
                try {
                    return new URL(currentTab.url).hostname;
                }
                catch (_a) {
                    return '';
                }
            };
            resolve(currentTab);
        });
    });
}
function updateSessionHeaders(ruleOptions) {
    return new Promise(resolve => {
        chrome.declarativeNetRequest.updateSessionRules(ruleOptions, resolve);
    });
}
// Window ID of tab to capture, eg getCurrentTab().windowId;
function captureVisibleTab(windowId) {
    return new Promise(resolve => chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, resolve));
}
function getZoomFactor(tabId) {
    return new Promise(resolve => chrome.tabs.getZoom(tabId, resolve));
}
function setExtensionIcon(icon) {
    return new Promise(resolve => {
        chrome.action.setIcon(icon, () => {
            resolve(true);
        });
    });
}
function executeScript(tabId, filePath, allFrames) {
    return new Promise(resolve => {
        chrome.scripting.executeScript({ target: { tabId, allFrames: allFrames !== null && allFrames !== void 0 ? allFrames : true }, files: [filePath] }, () => {
            resolve(true);
        });
    });
}
function isAllowedFileSchemeAccess() {
    return new Promise(resolve => {
        chrome.extension.isAllowedFileSchemeAccess(resolve);
    });
}
function postBackgroundMessage(message) {
    const extensionId = undefined; // undefined means send to self, instead of another extension.
    const options = undefined;
    return new Promise(resolve => {
        chrome.runtime.sendMessage(extensionId, message, options, resolve);
    });
}
function getStorageItem(key) {
    const formattedKey = formatKey(key);
    return new Promise(resolve => {
        try {
            chrome.storage.local.get([formattedKey], function (result) {
                resolve(result[formattedKey]);
            });
        }
        catch (_a) {
            // Do nothing if cache fails.
            resolve(undefined);
        }
    });
}
function setStorageItem(key, value) {
    const formattedKey = formatKey(key);
    return new Promise(resolve => {
        try {
            chrome.storage.local.set({ [formattedKey]: value }, () => {
                resolve(true);
            });
        }
        catch (_a) {
            // Do nothing if cache fails.
            resolve(false);
        }
    });
}
function formatKey(key) {
    const keyPrefix = 'app';
    return `${keyPrefix}-${key}`;
}


/***/ }),

/***/ "./src/utils/ichigoApi.ts":
/*!********************************!*\
  !*** ./src/utils/ichigoApi.ts ***!
  \********************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SignupStatus = exports.LoginStatus = exports.baseUrl = void 0;
exports.getCurrentUser = getCurrentUser;
exports.login = login;
exports.logout = logout;
exports.signup = signup;
exports.submitFeedback = submitFeedback;
exports.translateImage = translateImage;
exports.debug = debug;
const appConfig_1 = __webpack_require__(/*! ./appConfig */ "./src/utils/appConfig.ts");
// If set to true, use local implementations and turn on logging.
const isDebug = false;
exports.baseUrl = isDebug ? 'http://localhost:8080' : 'https://ichigoreader.com';
var StatusCode;
(function (StatusCode) {
    StatusCode[StatusCode["Ok"] = 200] = "Ok";
    StatusCode[StatusCode["Created"] = 201] = "Created";
    StatusCode[StatusCode["NoContent"] = 204] = "NoContent";
    StatusCode[StatusCode["BadRequest"] = 400] = "BadRequest";
    StatusCode[StatusCode["Forbidden"] = 403] = "Forbidden";
    StatusCode[StatusCode["NotFound"] = 404] = "NotFound";
    StatusCode[StatusCode["TooManyRequests"] = 429] = "TooManyRequests";
    StatusCode[StatusCode["InternalServerError"] = 500] = "InternalServerError";
})(StatusCode || (StatusCode = {}));
function getCurrentUser() {
    return __awaiter(this, void 0, void 0, function* () {
        const clientUuid = yield appConfig_1.appConfig.getClientUuid();
        const request = yield fetch(`${exports.baseUrl}/metrics?clientUuid=${clientUuid}&fingerprint=${getFingerprint()}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                // Use the new subscription types.
                'Client-Version': '1.0.1'
            }
        });
        if (request.status !== StatusCode.Ok) {
            throw new Error('Failed to retrieve user.');
        }
        return (yield request.json());
    });
}
var LoginStatus;
(function (LoginStatus) {
    LoginStatus[LoginStatus["Unknown"] = 0] = "Unknown";
    LoginStatus[LoginStatus["UnknownEmail"] = 1] = "UnknownEmail";
    LoginStatus[LoginStatus["BadPassword"] = 2] = "BadPassword";
    LoginStatus[LoginStatus["InvalidEmail"] = 3] = "InvalidEmail";
    LoginStatus[LoginStatus["Success"] = 4] = "Success";
})(LoginStatus || (exports.LoginStatus = LoginStatus = {}));
function login(email, password) {
    return __awaiter(this, void 0, void 0, function* () {
        const request = yield fetch(`${exports.baseUrl}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        if (request.status === StatusCode.BadRequest) {
            const json = yield request.json();
            switch (json.detail.kind) {
                case 'emptyEmail':
                    return LoginStatus.InvalidEmail;
                case 'userNotFound':
                    return LoginStatus.UnknownEmail;
                default:
                    return LoginStatus.Unknown;
            }
        }
        if (request.status === StatusCode.Forbidden) {
            return LoginStatus.BadPassword;
        }
        return request.status === StatusCode.Ok ? LoginStatus.Success : LoginStatus.Unknown;
    });
}
function logout() {
    return __awaiter(this, void 0, void 0, function* () {
        const request = yield fetch(`${exports.baseUrl}/auth/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return request.status === StatusCode.NoContent;
    });
}
var SignupStatus;
(function (SignupStatus) {
    SignupStatus[SignupStatus["Unknown"] = 0] = "Unknown";
    SignupStatus[SignupStatus["Success"] = 1] = "Success";
    SignupStatus[SignupStatus["EmailTaken"] = 2] = "EmailTaken";
})(SignupStatus || (exports.SignupStatus = SignupStatus = {}));
function signup(email, password) {
    return __awaiter(this, void 0, void 0, function* () {
        const request = yield fetch(`${exports.baseUrl}/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        if (request.status === StatusCode.Forbidden) {
            return SignupStatus.EmailTaken;
        }
        return request.status === StatusCode.Created ? SignupStatus.Success : SignupStatus.Unknown;
    });
}
function submitFeedback(text) {
    return __awaiter(this, void 0, void 0, function* () {
        const request = yield fetch(`${exports.baseUrl}/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });
        return request.status === StatusCode.Created;
    });
}
function translateImage(translateTo, base64Image, translationModel) {
    return __awaiter(this, void 0, void 0, function* () {
        const clientUuid = yield appConfig_1.appConfig.getClientUuid();
        const request = yield fetch(`${exports.baseUrl}/translate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                base64Images: [base64Image],
                translationModel,
                targetLangCode: translateTo,
                fingerprint: getFingerprint(),
                clientUuid
            })
        });
        if (request.status === StatusCode.InternalServerError) {
            const errorMessage = 'Server is down or experiencing issues. Sorry for the inconvenience.';
            return {
                errorMessage,
                translations: [
                    {
                        originalLanguage: 'Unknown',
                        translatedText: errorMessage,
                        minX: 0,
                        minY: 0,
                        maxX: 200,
                        maxY: 200
                    }
                ]
            };
        }
        if (request.status === StatusCode.TooManyRequests) {
            const errorMessage = 'Out of translations. Server costs are expensive. Upgrade for more!';
            return {
                errorMessage,
                translations: [
                    {
                        originalLanguage: 'Unknown',
                        translatedText: errorMessage,
                        minX: 0,
                        minY: 0,
                        maxX: 200,
                        maxY: 200
                    }
                ]
            };
        }
        const results = yield request.json();
        return {
            translations: results.images[0]
        };
    });
}
function debug(message) {
    if (isDebug) {
        console.log(message);
    }
}
let fingerprint = null; // Do not access this directly, use getFingerprint().
function getFingerprint() {
    if (fingerprint) {
        return fingerprint;
    }
    // Initialize fingerprint.
    const webGlRenderer = getWebGlRenderer();
    const hardware = getHardware();
    const connectionString = getConnectionString();
    const timezoneCode = new Date().getTimezoneOffset();
    fingerprint = btoa(`${webGlRenderer}-${hardware}-${connectionString}-${timezoneCode}`);
    return fingerprint;
}
function getWebGlRenderer() {
    const gl = new OffscreenCanvas(0, 0).getContext('webgl');
    if (!gl) {
        return 'none';
    }
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    return debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown';
}
function getHardware() {
    const hardwareConcurrency = navigator === null || navigator === void 0 ? void 0 : navigator.hardwareConcurrency;
    const deviceMemory = navigator['deviceMemory'];
    return `${hardwareConcurrency}-${deviceMemory}`;
}
function getConnectionString() {
    var _a, _b, _c, _d, _e;
    const type = (_a = navigator['connection']) === null || _a === void 0 ? void 0 : _a.type;
    const rtt = (_b = navigator['connection']) === null || _b === void 0 ? void 0 : _b.rtt;
    const downlinkMax = (_c = navigator['connection']) === null || _c === void 0 ? void 0 : _c.downlinkMax;
    const effectiveType = (_d = navigator['connection']) === null || _d === void 0 ? void 0 : _d.effectiveType;
    const saveData = (_e = navigator['connection']) === null || _e === void 0 ? void 0 : _e.saveData;
    return `${type}-${rtt}-${downlinkMax}-${effectiveType}-${saveData}`;
}


/***/ }),

/***/ "./src/utils/locales.ts":
/*!******************************!*\
  !*** ./src/utils/locales.ts ***!
  \******************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.languageCodes = void 0;
exports.getDefaultLanguage = getDefaultLanguage;
exports.getDisplayString = getDisplayString;
const m = chrome.i18n.getMessage;
exports.languageCodes = [
    'ar',
    'de',
    'en',
    'es',
    'fr',
    'hi',
    'id',
    'it',
    'ja',
    'ko',
    'pl',
    'pt-BR',
    'pt-PT',
    'ru',
    'th',
    'vi',
    'zh-CN',
    'zh-TW'
];
function getDefaultLanguage() {
    const fullLang = navigator.language;
    const shortLang = navigator.language.split('-')[0];
    const firstShortLang = exports.languageCodes.find(lang => lang.startsWith(shortLang));
    if (exports.languageCodes.includes(fullLang)) {
        return fullLang;
    }
    else if (firstShortLang) {
        return firstShortLang;
    }
    else {
        return 'en';
    }
}
function getDisplayString(languageCode) {
    switch (languageCode) {
        case 'ar':
            return m('translateToArabicLabel');
        case 'de':
            return m('translateToGermanLabel');
        case 'en':
            return m('translateToEnglishLabel');
        case 'es':
            return m('translateToSpanishLabel');
        case 'fr':
            return m('translateToFrenchLabel');
        case 'hi':
            return m('translateToHindiLabel');
        case 'id':
            return m('translateToIndonesianLabel');
        case 'it':
            return m('translateToItalianLabel');
        case 'ja':
            return m('translateToJapaneseLabel');
        case 'ko':
            return m('translateToKoreanLabel');
        case 'pl':
            return m('translateToPolishLabel');
        case 'pt-BR':
            return m('translateToBrazilianPortugueseLabel');
        case 'pt-PT':
            return m('translateToPortugueseLabel');
        case 'ru':
            return m('translateToRussianLabel');
        case 'th':
            return m('translateToThaiLabel');
        case 'vi':
            return m('translateToVietnameseLabel');
        case 'zh-CN':
            return m('translateToChineseSimplifiedLabel');
        case 'zh-TW':
            return m('translateToChineseTraditionalLabel');
        default:
            return 'Unknown';
    }
}


/***/ }),

/***/ "./src/utils/translation.ts":
/*!**********************************!*\
  !*** ./src/utils/translation.ts ***!
  \**********************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.scaleTranslation = scaleTranslation;
exports.calculateResizedAspectRatio = calculateResizedAspectRatio;
function scaleTranslation(targetWidth, targetHeight, originalWidth, originalHeight, result) {
    const scaleX = targetWidth / originalWidth;
    const scaleY = targetHeight / originalHeight;
    return Object.assign(Object.assign({}, result), { minX: Math.round(scaleX * result.minX), minY: Math.round(scaleY * result.minY), maxX: Math.round(scaleX * result.maxX), maxY: Math.round(scaleY * result.maxY) });
}
function calculateResizedAspectRatio(params) {
    const { width, height, widthMaxPx, heightMaxPx } = params;
    // `alreadyWithinBounds` intentionally uses `||` instead of `&&`,
    // so that images slightly over bounds are likely not touched.
    // Although experimenting with `&&` instead of `|| may be viable.
    const alreadyWithinBounds = width <= widthMaxPx || height <= heightMaxPx;
    if (alreadyWithinBounds) {
        return [width, height];
    }
    // `Math.max` (vs `Math.min`) is intentionally used to favor larger images.
    const resizedAspectRatio = Math.max(heightMaxPx / height, widthMaxPx / width);
    return [Math.round(width * resizedAspectRatio), Math.round(height * resizedAspectRatio)];
}


/***/ }),

/***/ "./node_modules/uuid/dist/esm-browser/index.js":
/*!*****************************************************!*\
  !*** ./node_modules/uuid/dist/esm-browser/index.js ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   NIL: () => (/* reexport safe */ _nil_js__WEBPACK_IMPORTED_MODULE_4__["default"]),
/* harmony export */   parse: () => (/* reexport safe */ _parse_js__WEBPACK_IMPORTED_MODULE_8__["default"]),
/* harmony export */   stringify: () => (/* reexport safe */ _stringify_js__WEBPACK_IMPORTED_MODULE_7__["default"]),
/* harmony export */   v1: () => (/* reexport safe */ _v1_js__WEBPACK_IMPORTED_MODULE_0__["default"]),
/* harmony export */   v3: () => (/* reexport safe */ _v3_js__WEBPACK_IMPORTED_MODULE_1__["default"]),
/* harmony export */   v4: () => (/* reexport safe */ _v4_js__WEBPACK_IMPORTED_MODULE_2__["default"]),
/* harmony export */   v5: () => (/* reexport safe */ _v5_js__WEBPACK_IMPORTED_MODULE_3__["default"]),
/* harmony export */   validate: () => (/* reexport safe */ _validate_js__WEBPACK_IMPORTED_MODULE_6__["default"]),
/* harmony export */   version: () => (/* reexport safe */ _version_js__WEBPACK_IMPORTED_MODULE_5__["default"])
/* harmony export */ });
/* harmony import */ var _v1_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./v1.js */ "./node_modules/uuid/dist/esm-browser/v1.js");
/* harmony import */ var _v3_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./v3.js */ "./node_modules/uuid/dist/esm-browser/v3.js");
/* harmony import */ var _v4_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./v4.js */ "./node_modules/uuid/dist/esm-browser/v4.js");
/* harmony import */ var _v5_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./v5.js */ "./node_modules/uuid/dist/esm-browser/v5.js");
/* harmony import */ var _nil_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./nil.js */ "./node_modules/uuid/dist/esm-browser/nil.js");
/* harmony import */ var _version_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./version.js */ "./node_modules/uuid/dist/esm-browser/version.js");
/* harmony import */ var _validate_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./validate.js */ "./node_modules/uuid/dist/esm-browser/validate.js");
/* harmony import */ var _stringify_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./stringify.js */ "./node_modules/uuid/dist/esm-browser/stringify.js");
/* harmony import */ var _parse_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./parse.js */ "./node_modules/uuid/dist/esm-browser/parse.js");










/***/ }),

/***/ "./node_modules/uuid/dist/esm-browser/md5.js":
/*!***************************************************!*\
  !*** ./node_modules/uuid/dist/esm-browser/md5.js ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/*
 * Browser-compatible JavaScript MD5
 *
 * Modification of JavaScript MD5
 * https://github.com/blueimp/JavaScript-MD5
 *
 * Copyright 2011, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * https://opensource.org/licenses/MIT
 *
 * Based on
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.2 Copyright (C) Paul Johnston 1999 - 2009
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */
function md5(bytes) {
  if (typeof bytes === 'string') {
    var msg = unescape(encodeURIComponent(bytes)); // UTF8 escape

    bytes = new Uint8Array(msg.length);

    for (var i = 0; i < msg.length; ++i) {
      bytes[i] = msg.charCodeAt(i);
    }
  }

  return md5ToHexEncodedArray(wordsToMd5(bytesToWords(bytes), bytes.length * 8));
}
/*
 * Convert an array of little-endian words to an array of bytes
 */


function md5ToHexEncodedArray(input) {
  var output = [];
  var length32 = input.length * 32;
  var hexTab = '0123456789abcdef';

  for (var i = 0; i < length32; i += 8) {
    var x = input[i >> 5] >>> i % 32 & 0xff;
    var hex = parseInt(hexTab.charAt(x >>> 4 & 0x0f) + hexTab.charAt(x & 0x0f), 16);
    output.push(hex);
  }

  return output;
}
/**
 * Calculate output length with padding and bit length
 */


function getOutputLength(inputLength8) {
  return (inputLength8 + 64 >>> 9 << 4) + 14 + 1;
}
/*
 * Calculate the MD5 of an array of little-endian words, and a bit length.
 */


function wordsToMd5(x, len) {
  /* append padding */
  x[len >> 5] |= 0x80 << len % 32;
  x[getOutputLength(len) - 1] = len;
  var a = 1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d = 271733878;

  for (var i = 0; i < x.length; i += 16) {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;
    a = md5ff(a, b, c, d, x[i], 7, -680876936);
    d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
    c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
    b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
    a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
    d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
    c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
    b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
    a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
    d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
    c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
    b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
    a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
    d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
    c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
    b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);
    a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
    d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
    c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
    b = md5gg(b, c, d, a, x[i], 20, -373897302);
    a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
    d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
    c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
    b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
    a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
    d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
    c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
    b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
    a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
    d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
    c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
    b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);
    a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
    d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
    c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
    b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
    a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
    d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
    c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
    b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
    a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
    d = md5hh(d, a, b, c, x[i], 11, -358537222);
    c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
    b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
    a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
    d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
    c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
    b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);
    a = md5ii(a, b, c, d, x[i], 6, -198630844);
    d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
    c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
    b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
    a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
    d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
    c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
    b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
    a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
    d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
    c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
    b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
    a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
    d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
    c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
    b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);
    a = safeAdd(a, olda);
    b = safeAdd(b, oldb);
    c = safeAdd(c, oldc);
    d = safeAdd(d, oldd);
  }

  return [a, b, c, d];
}
/*
 * Convert an array bytes to an array of little-endian words
 * Characters >255 have their high-byte silently ignored.
 */


function bytesToWords(input) {
  if (input.length === 0) {
    return [];
  }

  var length8 = input.length * 8;
  var output = new Uint32Array(getOutputLength(length8));

  for (var i = 0; i < length8; i += 8) {
    output[i >> 5] |= (input[i / 8] & 0xff) << i % 32;
  }

  return output;
}
/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */


function safeAdd(x, y) {
  var lsw = (x & 0xffff) + (y & 0xffff);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return msw << 16 | lsw & 0xffff;
}
/*
 * Bitwise rotate a 32-bit number to the left.
 */


function bitRotateLeft(num, cnt) {
  return num << cnt | num >>> 32 - cnt;
}
/*
 * These functions implement the four basic operations the algorithm uses.
 */


function md5cmn(q, a, b, x, s, t) {
  return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
}

function md5ff(a, b, c, d, x, s, t) {
  return md5cmn(b & c | ~b & d, a, b, x, s, t);
}

function md5gg(a, b, c, d, x, s, t) {
  return md5cmn(b & d | c & ~d, a, b, x, s, t);
}

function md5hh(a, b, c, d, x, s, t) {
  return md5cmn(b ^ c ^ d, a, b, x, s, t);
}

function md5ii(a, b, c, d, x, s, t) {
  return md5cmn(c ^ (b | ~d), a, b, x, s, t);
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (md5);

/***/ }),

/***/ "./node_modules/uuid/dist/esm-browser/nil.js":
/*!***************************************************!*\
  !*** ./node_modules/uuid/dist/esm-browser/nil.js ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ('00000000-0000-0000-0000-000000000000');

/***/ }),

/***/ "./node_modules/uuid/dist/esm-browser/parse.js":
/*!*****************************************************!*\
  !*** ./node_modules/uuid/dist/esm-browser/parse.js ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _validate_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./validate.js */ "./node_modules/uuid/dist/esm-browser/validate.js");


function parse(uuid) {
  if (!(0,_validate_js__WEBPACK_IMPORTED_MODULE_0__["default"])(uuid)) {
    throw TypeError('Invalid UUID');
  }

  var v;
  var arr = new Uint8Array(16); // Parse ########-....-....-....-............

  arr[0] = (v = parseInt(uuid.slice(0, 8), 16)) >>> 24;
  arr[1] = v >>> 16 & 0xff;
  arr[2] = v >>> 8 & 0xff;
  arr[3] = v & 0xff; // Parse ........-####-....-....-............

  arr[4] = (v = parseInt(uuid.slice(9, 13), 16)) >>> 8;
  arr[5] = v & 0xff; // Parse ........-....-####-....-............

  arr[6] = (v = parseInt(uuid.slice(14, 18), 16)) >>> 8;
  arr[7] = v & 0xff; // Parse ........-....-....-####-............

  arr[8] = (v = parseInt(uuid.slice(19, 23), 16)) >>> 8;
  arr[9] = v & 0xff; // Parse ........-....-....-....-############
  // (Use "/" to avoid 32-bit truncation when bit-shifting high-order bytes)

  arr[10] = (v = parseInt(uuid.slice(24, 36), 16)) / 0x10000000000 & 0xff;
  arr[11] = v / 0x100000000 & 0xff;
  arr[12] = v >>> 24 & 0xff;
  arr[13] = v >>> 16 & 0xff;
  arr[14] = v >>> 8 & 0xff;
  arr[15] = v & 0xff;
  return arr;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (parse);

/***/ }),

/***/ "./node_modules/uuid/dist/esm-browser/regex.js":
/*!*****************************************************!*\
  !*** ./node_modules/uuid/dist/esm-browser/regex.js ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i);

/***/ }),

/***/ "./node_modules/uuid/dist/esm-browser/rng.js":
/*!***************************************************!*\
  !*** ./node_modules/uuid/dist/esm-browser/rng.js ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ rng)
/* harmony export */ });
// Unique ID creation requires a high quality random # generator. In the browser we therefore
// require the crypto API and do not support built-in fallback to lower quality random number
// generators (like Math.random()).
var getRandomValues;
var rnds8 = new Uint8Array(16);
function rng() {
  // lazy load so that environments that need to polyfill have a chance to do so
  if (!getRandomValues) {
    // getRandomValues needs to be invoked in a context where "this" is a Crypto implementation. Also,
    // find the complete implementation of crypto (msCrypto) on IE11.
    getRandomValues = typeof crypto !== 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto) || typeof msCrypto !== 'undefined' && typeof msCrypto.getRandomValues === 'function' && msCrypto.getRandomValues.bind(msCrypto);

    if (!getRandomValues) {
      throw new Error('crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported');
    }
  }

  return getRandomValues(rnds8);
}

/***/ }),

/***/ "./node_modules/uuid/dist/esm-browser/sha1.js":
/*!****************************************************!*\
  !*** ./node_modules/uuid/dist/esm-browser/sha1.js ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
// Adapted from Chris Veness' SHA1 code at
// http://www.movable-type.co.uk/scripts/sha1.html
function f(s, x, y, z) {
  switch (s) {
    case 0:
      return x & y ^ ~x & z;

    case 1:
      return x ^ y ^ z;

    case 2:
      return x & y ^ x & z ^ y & z;

    case 3:
      return x ^ y ^ z;
  }
}

function ROTL(x, n) {
  return x << n | x >>> 32 - n;
}

function sha1(bytes) {
  var K = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6];
  var H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];

  if (typeof bytes === 'string') {
    var msg = unescape(encodeURIComponent(bytes)); // UTF8 escape

    bytes = [];

    for (var i = 0; i < msg.length; ++i) {
      bytes.push(msg.charCodeAt(i));
    }
  } else if (!Array.isArray(bytes)) {
    // Convert Array-like to Array
    bytes = Array.prototype.slice.call(bytes);
  }

  bytes.push(0x80);
  var l = bytes.length / 4 + 2;
  var N = Math.ceil(l / 16);
  var M = new Array(N);

  for (var _i = 0; _i < N; ++_i) {
    var arr = new Uint32Array(16);

    for (var j = 0; j < 16; ++j) {
      arr[j] = bytes[_i * 64 + j * 4] << 24 | bytes[_i * 64 + j * 4 + 1] << 16 | bytes[_i * 64 + j * 4 + 2] << 8 | bytes[_i * 64 + j * 4 + 3];
    }

    M[_i] = arr;
  }

  M[N - 1][14] = (bytes.length - 1) * 8 / Math.pow(2, 32);
  M[N - 1][14] = Math.floor(M[N - 1][14]);
  M[N - 1][15] = (bytes.length - 1) * 8 & 0xffffffff;

  for (var _i2 = 0; _i2 < N; ++_i2) {
    var W = new Uint32Array(80);

    for (var t = 0; t < 16; ++t) {
      W[t] = M[_i2][t];
    }

    for (var _t = 16; _t < 80; ++_t) {
      W[_t] = ROTL(W[_t - 3] ^ W[_t - 8] ^ W[_t - 14] ^ W[_t - 16], 1);
    }

    var a = H[0];
    var b = H[1];
    var c = H[2];
    var d = H[3];
    var e = H[4];

    for (var _t2 = 0; _t2 < 80; ++_t2) {
      var s = Math.floor(_t2 / 20);
      var T = ROTL(a, 5) + f(s, b, c, d) + e + K[s] + W[_t2] >>> 0;
      e = d;
      d = c;
      c = ROTL(b, 30) >>> 0;
      b = a;
      a = T;
    }

    H[0] = H[0] + a >>> 0;
    H[1] = H[1] + b >>> 0;
    H[2] = H[2] + c >>> 0;
    H[3] = H[3] + d >>> 0;
    H[4] = H[4] + e >>> 0;
  }

  return [H[0] >> 24 & 0xff, H[0] >> 16 & 0xff, H[0] >> 8 & 0xff, H[0] & 0xff, H[1] >> 24 & 0xff, H[1] >> 16 & 0xff, H[1] >> 8 & 0xff, H[1] & 0xff, H[2] >> 24 & 0xff, H[2] >> 16 & 0xff, H[2] >> 8 & 0xff, H[2] & 0xff, H[3] >> 24 & 0xff, H[3] >> 16 & 0xff, H[3] >> 8 & 0xff, H[3] & 0xff, H[4] >> 24 & 0xff, H[4] >> 16 & 0xff, H[4] >> 8 & 0xff, H[4] & 0xff];
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (sha1);

/***/ }),

/***/ "./node_modules/uuid/dist/esm-browser/stringify.js":
/*!*********************************************************!*\
  !*** ./node_modules/uuid/dist/esm-browser/stringify.js ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _validate_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./validate.js */ "./node_modules/uuid/dist/esm-browser/validate.js");

/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */

var byteToHex = [];

for (var i = 0; i < 256; ++i) {
  byteToHex.push((i + 0x100).toString(16).substr(1));
}

function stringify(arr) {
  var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  // Note: Be careful editing this code!  It's been tuned for performance
  // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
  var uuid = (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase(); // Consistency check for valid UUID.  If this throws, it's likely due to one
  // of the following:
  // - One or more input array values don't map to a hex octet (leading to
  // "undefined" in the uuid)
  // - Invalid input values for the RFC `version` or `variant` fields

  if (!(0,_validate_js__WEBPACK_IMPORTED_MODULE_0__["default"])(uuid)) {
    throw TypeError('Stringified UUID is invalid');
  }

  return uuid;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (stringify);

/***/ }),

/***/ "./node_modules/uuid/dist/esm-browser/v1.js":
/*!**************************************************!*\
  !*** ./node_modules/uuid/dist/esm-browser/v1.js ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _rng_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./rng.js */ "./node_modules/uuid/dist/esm-browser/rng.js");
/* harmony import */ var _stringify_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./stringify.js */ "./node_modules/uuid/dist/esm-browser/stringify.js");

 // **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html

var _nodeId;

var _clockseq; // Previous uuid creation time


var _lastMSecs = 0;
var _lastNSecs = 0; // See https://github.com/uuidjs/uuid for API details

function v1(options, buf, offset) {
  var i = buf && offset || 0;
  var b = buf || new Array(16);
  options = options || {};
  var node = options.node || _nodeId;
  var clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq; // node and clockseq need to be initialized to random values if they're not
  // specified.  We do this lazily to minimize issues related to insufficient
  // system entropy.  See #189

  if (node == null || clockseq == null) {
    var seedBytes = options.random || (options.rng || _rng_js__WEBPACK_IMPORTED_MODULE_0__["default"])();

    if (node == null) {
      // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
      node = _nodeId = [seedBytes[0] | 0x01, seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]];
    }

    if (clockseq == null) {
      // Per 4.2.2, randomize (14 bit) clockseq
      clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 0x3fff;
    }
  } // UUID timestamps are 100 nano-second units since the Gregorian epoch,
  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.


  var msecs = options.msecs !== undefined ? options.msecs : Date.now(); // Per 4.2.1.2, use count of uuid's generated during the current clock
  // cycle to simulate higher resolution clock

  var nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1; // Time since last uuid creation (in msecs)

  var dt = msecs - _lastMSecs + (nsecs - _lastNSecs) / 10000; // Per 4.2.1.2, Bump clockseq on clock regression

  if (dt < 0 && options.clockseq === undefined) {
    clockseq = clockseq + 1 & 0x3fff;
  } // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
  // time interval


  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  } // Per 4.2.1.2 Throw error if too many uuids are requested


  if (nsecs >= 10000) {
    throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
  }

  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq; // Per 4.1.4 - Convert from unix epoch to Gregorian epoch

  msecs += 12219292800000; // `time_low`

  var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
  b[i++] = tl >>> 24 & 0xff;
  b[i++] = tl >>> 16 & 0xff;
  b[i++] = tl >>> 8 & 0xff;
  b[i++] = tl & 0xff; // `time_mid`

  var tmh = msecs / 0x100000000 * 10000 & 0xfffffff;
  b[i++] = tmh >>> 8 & 0xff;
  b[i++] = tmh & 0xff; // `time_high_and_version`

  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version

  b[i++] = tmh >>> 16 & 0xff; // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)

  b[i++] = clockseq >>> 8 | 0x80; // `clock_seq_low`

  b[i++] = clockseq & 0xff; // `node`

  for (var n = 0; n < 6; ++n) {
    b[i + n] = node[n];
  }

  return buf || (0,_stringify_js__WEBPACK_IMPORTED_MODULE_1__["default"])(b);
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (v1);

/***/ }),

/***/ "./node_modules/uuid/dist/esm-browser/v3.js":
/*!**************************************************!*\
  !*** ./node_modules/uuid/dist/esm-browser/v3.js ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _v35_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./v35.js */ "./node_modules/uuid/dist/esm-browser/v35.js");
/* harmony import */ var _md5_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./md5.js */ "./node_modules/uuid/dist/esm-browser/md5.js");


var v3 = (0,_v35_js__WEBPACK_IMPORTED_MODULE_0__["default"])('v3', 0x30, _md5_js__WEBPACK_IMPORTED_MODULE_1__["default"]);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (v3);

/***/ }),

/***/ "./node_modules/uuid/dist/esm-browser/v35.js":
/*!***************************************************!*\
  !*** ./node_modules/uuid/dist/esm-browser/v35.js ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DNS: () => (/* binding */ DNS),
/* harmony export */   URL: () => (/* binding */ URL),
/* harmony export */   "default": () => (/* export default binding */ __WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _stringify_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./stringify.js */ "./node_modules/uuid/dist/esm-browser/stringify.js");
/* harmony import */ var _parse_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./parse.js */ "./node_modules/uuid/dist/esm-browser/parse.js");



function stringToBytes(str) {
  str = unescape(encodeURIComponent(str)); // UTF8 escape

  var bytes = [];

  for (var i = 0; i < str.length; ++i) {
    bytes.push(str.charCodeAt(i));
  }

  return bytes;
}

var DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
var URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
/* harmony default export */ function __WEBPACK_DEFAULT_EXPORT__(name, version, hashfunc) {
  function generateUUID(value, namespace, buf, offset) {
    if (typeof value === 'string') {
      value = stringToBytes(value);
    }

    if (typeof namespace === 'string') {
      namespace = (0,_parse_js__WEBPACK_IMPORTED_MODULE_0__["default"])(namespace);
    }

    if (namespace.length !== 16) {
      throw TypeError('Namespace must be array-like (16 iterable integer values, 0-255)');
    } // Compute hash of namespace and value, Per 4.3
    // Future: Use spread syntax when supported on all platforms, e.g. `bytes =
    // hashfunc([...namespace, ... value])`


    var bytes = new Uint8Array(16 + value.length);
    bytes.set(namespace);
    bytes.set(value, namespace.length);
    bytes = hashfunc(bytes);
    bytes[6] = bytes[6] & 0x0f | version;
    bytes[8] = bytes[8] & 0x3f | 0x80;

    if (buf) {
      offset = offset || 0;

      for (var i = 0; i < 16; ++i) {
        buf[offset + i] = bytes[i];
      }

      return buf;
    }

    return (0,_stringify_js__WEBPACK_IMPORTED_MODULE_1__["default"])(bytes);
  } // Function#name is not settable on some platforms (#270)


  try {
    generateUUID.name = name; // eslint-disable-next-line no-empty
  } catch (err) {} // For CommonJS default export support


  generateUUID.DNS = DNS;
  generateUUID.URL = URL;
  return generateUUID;
}

/***/ }),

/***/ "./node_modules/uuid/dist/esm-browser/v4.js":
/*!**************************************************!*\
  !*** ./node_modules/uuid/dist/esm-browser/v4.js ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _rng_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./rng.js */ "./node_modules/uuid/dist/esm-browser/rng.js");
/* harmony import */ var _stringify_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./stringify.js */ "./node_modules/uuid/dist/esm-browser/stringify.js");



function v4(options, buf, offset) {
  options = options || {};
  var rnds = options.random || (options.rng || _rng_js__WEBPACK_IMPORTED_MODULE_0__["default"])(); // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`

  rnds[6] = rnds[6] & 0x0f | 0x40;
  rnds[8] = rnds[8] & 0x3f | 0x80; // Copy bytes to buffer, if provided

  if (buf) {
    offset = offset || 0;

    for (var i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }

    return buf;
  }

  return (0,_stringify_js__WEBPACK_IMPORTED_MODULE_1__["default"])(rnds);
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (v4);

/***/ }),

/***/ "./node_modules/uuid/dist/esm-browser/v5.js":
/*!**************************************************!*\
  !*** ./node_modules/uuid/dist/esm-browser/v5.js ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _v35_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./v35.js */ "./node_modules/uuid/dist/esm-browser/v35.js");
/* harmony import */ var _sha1_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./sha1.js */ "./node_modules/uuid/dist/esm-browser/sha1.js");


var v5 = (0,_v35_js__WEBPACK_IMPORTED_MODULE_0__["default"])('v5', 0x50, _sha1_js__WEBPACK_IMPORTED_MODULE_1__["default"]);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (v5);

/***/ }),

/***/ "./node_modules/uuid/dist/esm-browser/validate.js":
/*!********************************************************!*\
  !*** ./node_modules/uuid/dist/esm-browser/validate.js ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _regex_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./regex.js */ "./node_modules/uuid/dist/esm-browser/regex.js");


function validate(uuid) {
  return typeof uuid === 'string' && _regex_js__WEBPACK_IMPORTED_MODULE_0__["default"].test(uuid);
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (validate);

/***/ }),

/***/ "./node_modules/uuid/dist/esm-browser/version.js":
/*!*******************************************************!*\
  !*** ./node_modules/uuid/dist/esm-browser/version.js ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _validate_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./validate.js */ "./node_modules/uuid/dist/esm-browser/validate.js");


function version(uuid) {
  if (!(0,_validate_js__WEBPACK_IMPORTED_MODULE_0__["default"])(uuid)) {
    throw TypeError('Invalid UUID');
  }

  return parseInt(uuid.substr(14, 1), 16);
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (version);

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/app/background.ts");
/******/ 	
/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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dUQsaUJBQWlCO1dBQ3hFO1dBQ0EsZ0RBQWdELGFBQWE7V0FDN0Q7Ozs7O1VFTkE7VUFDQTtVQUNBO1VBQ0EiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9pY2hpZ28tcmVhZGVyLy4vc3JjL2FwcC9iYWNrZ3JvdW5kLnRzIiwid2VicGFjazovL2ljaGlnby1yZWFkZXIvLi9zcmMvYXBwL2JhY2tncm91bmQvY29udGV4dE1lbnVzLnRzIiwid2VicGFjazovL2ljaGlnby1yZWFkZXIvLi9zcmMvYXBwL3RyYW5zbGF0ZVdpdGhTY2FsaW5nLnRzIiwid2VicGFjazovL2ljaGlnby1yZWFkZXIvLi9zcmMvYXBwL3V0aWxzL2Zhc3RIYXNoLnRzIiwid2VicGFjazovL2ljaGlnby1yZWFkZXIvLi9zcmMvYXBwL3V0aWxzL2ltYWdlVXRpbHMudHMiLCJ3ZWJwYWNrOi8vaWNoaWdvLXJlYWRlci8uL3NyYy9hcHAvdXRpbHMvdXRpbHMudHMiLCJ3ZWJwYWNrOi8vaWNoaWdvLXJlYWRlci8uL3NyYy91dGlscy9hcHBDb25maWcudHMiLCJ3ZWJwYWNrOi8vaWNoaWdvLXJlYWRlci8uL3NyYy91dGlscy9jaHJvbWVBcGkudHMiLCJ3ZWJwYWNrOi8vaWNoaWdvLXJlYWRlci8uL3NyYy91dGlscy9pY2hpZ29BcGkudHMiLCJ3ZWJwYWNrOi8vaWNoaWdvLXJlYWRlci8uL3NyYy91dGlscy9sb2NhbGVzLnRzIiwid2VicGFjazovL2ljaGlnby1yZWFkZXIvLi9zcmMvdXRpbHMvdHJhbnNsYXRpb24udHMiLCJ3ZWJwYWNrOi8vaWNoaWdvLXJlYWRlci8uL25vZGVfbW9kdWxlcy91dWlkL2Rpc3QvZXNtLWJyb3dzZXIvaW5kZXguanMiLCJ3ZWJwYWNrOi8vaWNoaWdvLXJlYWRlci8uL25vZGVfbW9kdWxlcy91dWlkL2Rpc3QvZXNtLWJyb3dzZXIvbWQ1LmpzIiwid2VicGFjazovL2ljaGlnby1yZWFkZXIvLi9ub2RlX21vZHVsZXMvdXVpZC9kaXN0L2VzbS1icm93c2VyL25pbC5qcyIsIndlYnBhY2s6Ly9pY2hpZ28tcmVhZGVyLy4vbm9kZV9tb2R1bGVzL3V1aWQvZGlzdC9lc20tYnJvd3Nlci9wYXJzZS5qcyIsIndlYnBhY2s6Ly9pY2hpZ28tcmVhZGVyLy4vbm9kZV9tb2R1bGVzL3V1aWQvZGlzdC9lc20tYnJvd3Nlci9yZWdleC5qcyIsIndlYnBhY2s6Ly9pY2hpZ28tcmVhZGVyLy4vbm9kZV9tb2R1bGVzL3V1aWQvZGlzdC9lc20tYnJvd3Nlci9ybmcuanMiLCJ3ZWJwYWNrOi8vaWNoaWdvLXJlYWRlci8uL25vZGVfbW9kdWxlcy91dWlkL2Rpc3QvZXNtLWJyb3dzZXIvc2hhMS5qcyIsIndlYnBhY2s6Ly9pY2hpZ28tcmVhZGVyLy4vbm9kZV9tb2R1bGVzL3V1aWQvZGlzdC9lc20tYnJvd3Nlci9zdHJpbmdpZnkuanMiLCJ3ZWJwYWNrOi8vaWNoaWdvLXJlYWRlci8uL25vZGVfbW9kdWxlcy91dWlkL2Rpc3QvZXNtLWJyb3dzZXIvdjEuanMiLCJ3ZWJwYWNrOi8vaWNoaWdvLXJlYWRlci8uL25vZGVfbW9kdWxlcy91dWlkL2Rpc3QvZXNtLWJyb3dzZXIvdjMuanMiLCJ3ZWJwYWNrOi8vaWNoaWdvLXJlYWRlci8uL25vZGVfbW9kdWxlcy91dWlkL2Rpc3QvZXNtLWJyb3dzZXIvdjM1LmpzIiwid2VicGFjazovL2ljaGlnby1yZWFkZXIvLi9ub2RlX21vZHVsZXMvdXVpZC9kaXN0L2VzbS1icm93c2VyL3Y0LmpzIiwid2VicGFjazovL2ljaGlnby1yZWFkZXIvLi9ub2RlX21vZHVsZXMvdXVpZC9kaXN0L2VzbS1icm93c2VyL3Y1LmpzIiwid2VicGFjazovL2ljaGlnby1yZWFkZXIvLi9ub2RlX21vZHVsZXMvdXVpZC9kaXN0L2VzbS1icm93c2VyL3ZhbGlkYXRlLmpzIiwid2VicGFjazovL2ljaGlnby1yZWFkZXIvLi9ub2RlX21vZHVsZXMvdXVpZC9kaXN0L2VzbS1icm93c2VyL3ZlcnNpb24uanMiLCJ3ZWJwYWNrOi8vaWNoaWdvLXJlYWRlci93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly9pY2hpZ28tcmVhZGVyL3dlYnBhY2svcnVudGltZS9kZWZpbmUgcHJvcGVydHkgZ2V0dGVycyIsIndlYnBhY2s6Ly9pY2hpZ28tcmVhZGVyL3dlYnBhY2svcnVudGltZS9oYXNPd25Qcm9wZXJ0eSBzaG9ydGhhbmQiLCJ3ZWJwYWNrOi8vaWNoaWdvLXJlYWRlci93ZWJwYWNrL3J1bnRpbWUvbWFrZSBuYW1lc3BhY2Ugb2JqZWN0Iiwid2VicGFjazovL2ljaGlnby1yZWFkZXIvd2VicGFjay9iZWZvcmUtc3RhcnR1cCIsIndlYnBhY2s6Ly9pY2hpZ28tcmVhZGVyL3dlYnBhY2svc3RhcnR1cCIsIndlYnBhY2s6Ly9pY2hpZ28tcmVhZGVyL3dlYnBhY2svYWZ0ZXItc3RhcnR1cCJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiBCYWNrZ3JvdW5kIHByb2Nlc3MgZm9yIHRoZSBJY2hpZ28gZXh0ZW5zaW9uLlxuICogVGhpcyBtb2R1bGUgc2hvdWxkIGJlIHVzZWQgdG8gcHJvY2VzcyBhc3luYyB3b3JrLlxuICogSGFuZGxlIGZhaWx1cmVzIGluIGEgcm9idXN0IG1hbm5lciBhbmQgYXZvaWQgdGhlIGZhaWwtZmFzdCBwYXR0ZXJuLCB1bmxlc3MgaW4gZGVidWcgbW9kZS4gKi9cbmltcG9ydCB7XG5cdGNhcHR1cmVWaXNpYmxlVGFiLFxuXHRnZXRDdXJyZW50VGFiLFxuXHRnZXRab29tRmFjdG9yLFxuXHRzZXRFeHRlbnNpb25JY29uXG59IGZyb20gJy4uL3V0aWxzL2Nocm9tZUFwaSc7XG5pbXBvcnQgeyBhcHBDb25maWcgfSBmcm9tICcuLi91dGlscy9hcHBDb25maWcnO1xuaW1wb3J0IHsgZGVidWcgfSBmcm9tICcuLi91dGlscy9pY2hpZ29BcGknO1xuaW1wb3J0IHsgdHJhbnNsYXRlIH0gZnJvbSAnLi90cmFuc2xhdGVXaXRoU2NhbGluZyc7XG5pbXBvcnQgeyBpbml0Q29udGV4dE1lbnVzIH0gZnJvbSAnLi9iYWNrZ3JvdW5kL2NvbnRleHRNZW51cyc7XG5pbXBvcnQgeyBmYXN0SGFzaCB9IGZyb20gJy4vdXRpbHMvZmFzdEhhc2gnO1xuXG5pbml0Q29udGV4dE1lbnVzKCk7XG5cbmNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihmdW5jdGlvbiAobWVzc2FnZSwgc2VuZGVyLCBzZW5kUmVzcG9uc2UpIHtcblx0aGFuZGxlTWVzc2FnZXMobWVzc2FnZSwgc2VuZGVyKS50aGVuKHNlbmRSZXNwb25zZSk7XG5cdHJldHVybiB0cnVlO1xufSk7XG5cbmNvbnN0IG91dGdvaW5nVHJhbnNsYXRpb25SZXF1ZXN0cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVNZXNzYWdlcyhtZXNzYWdlLCBzZW5kZXI6IGNocm9tZS5ydW50aW1lLk1lc3NhZ2VTZW5kZXIpIHtcblx0aWYgKCFtZXNzYWdlKSB7XG5cdFx0ZGVidWcoYE1lc3NhZ2UgbXVzdCBub3QgYmUgZW1wdHkuXFxuIHNlbmRlcjpcXG4gJHtKU09OLnN0cmluZ2lmeShzZW5kZXIpfWApO1xuXHRcdHJldHVybjtcblx0fVxuXG5cdHN3aXRjaCAobWVzc2FnZS5raW5kKSB7XG5cdFx0Y2FzZSAndHJhbnNsYXRlSW1hZ2UnOlxuXHRcdFx0Y29uc3QgdHJhbnNsYXRlRXJyb3JNZXNzYWdlID0gdmFsaWRhdGVJbWFnZU1lc3NhZ2UobWVzc2FnZSk7XG5cdFx0XHRpZiAodHJhbnNsYXRlRXJyb3JNZXNzYWdlKSB7XG5cdFx0XHRcdGRlYnVnKGAke3RyYW5zbGF0ZUVycm9yTWVzc2FnZX1cXG4gbWVzc2FnZTpcXG4gJHtKU09OLnN0cmluZ2lmeShtZXNzYWdlKX1gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBpbWFnZUlkZW50aXR5ID1cblx0XHRcdFx0bWVzc2FnZS50cmFuc2xhdGVUbyArXG5cdFx0XHRcdChtZXNzYWdlLnRyYW5zbGF0aW9uTW9kZWwgPz8gJzp1bmtub3duOicpICtcblx0XHRcdFx0ZmFzdEhhc2gobWVzc2FnZS5pbWFnZS5zcmMgfHwgbWVzc2FnZS5pbWFnZS5iYXNlNjREYXRhKTtcblxuXHRcdFx0Ly8gQWxyZWFkeSB0cmFuc2xhdGluZyB0aGUgaW1hZ2UuXG5cdFx0XHRpZiAob3V0Z29pbmdUcmFuc2xhdGlvblJlcXVlc3RzLmhhcyhpbWFnZUlkZW50aXR5KSkge1xuXHRcdFx0XHRyZXR1cm4gJ0Z1bGxRdWV1ZSc7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChvdXRnb2luZ1RyYW5zbGF0aW9uUmVxdWVzdHMuc2l6ZSA+IDIpIHtcblx0XHRcdFx0cmV0dXJuICdGdWxsUXVldWUnO1xuXHRcdFx0fVxuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRvdXRnb2luZ1RyYW5zbGF0aW9uUmVxdWVzdHMuYWRkKGltYWdlSWRlbnRpdHkpO1xuXHRcdFx0XHRjb25zdCB0cmFuc2xhdGlvbiA9IGF3YWl0IHRyYW5zbGF0ZShcblx0XHRcdFx0XHRtZXNzYWdlLmltYWdlLFxuXHRcdFx0XHRcdG1lc3NhZ2UudHJhbnNsYXRlVG8sXG5cdFx0XHRcdFx0bWVzc2FnZS50cmFuc2xhdGlvbk1vZGVsLFxuXHRcdFx0XHRcdG1lc3NhZ2UuaW5jbHVkZUJhc2U2NERhdGFcblx0XHRcdFx0KTtcblx0XHRcdFx0cmV0dXJuIHRyYW5zbGF0aW9uO1xuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0b3V0Z29pbmdUcmFuc2xhdGlvblJlcXVlc3RzLmRlbGV0ZShpbWFnZUlkZW50aXR5KTtcblx0XHRcdH1cblxuXHRcdGNhc2UgJ3RyYW5zbGF0ZVNuYXBzaG90Jzpcblx0XHRcdGNvbnN0IHNuYXBzaG90RXJyb3JNZXNzYWdlID0gdmFsaWRhdGVTbmFwc2hvdE1lc3NhZ2UobWVzc2FnZSk7XG5cdFx0XHRpZiAoc25hcHNob3RFcnJvck1lc3NhZ2UpIHtcblx0XHRcdFx0ZGVidWcoYCR7c25hcHNob3RFcnJvck1lc3NhZ2V9XFxuIG1lc3NhZ2U6XFxuICR7SlNPTi5zdHJpbmdpZnkobWVzc2FnZSl9YCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc25hcHNob3QgPSBhd2FpdCB0YWtlU25hcHNob3QobWVzc2FnZS5kaW1lbnNpb25zLCBzZW5kZXIudGFiKTtcblx0XHRcdGlmICghc25hcHNob3QpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBpbWFnZSA9IHtcblx0XHRcdFx0c3JjOiBzbmFwc2hvdC5kYXRhVXJsLFxuXHRcdFx0XHR3aWR0aDogbWVzc2FnZS5kaW1lbnNpb25zLndpZHRoLFxuXHRcdFx0XHRoZWlnaHQ6IG1lc3NhZ2UuZGltZW5zaW9ucy5oZWlnaHRcblx0XHRcdH07XG5cdFx0XHRjb25zdCBzbmFwc2hvdFRyYW5zbGF0aW9uID0gYXdhaXQgdHJhbnNsYXRlKFxuXHRcdFx0XHRpbWFnZSxcblx0XHRcdFx0bWVzc2FnZS50cmFuc2xhdGVUbyxcblx0XHRcdFx0bWVzc2FnZS50cmFuc2xhdGlvbk1vZGVsXG5cdFx0XHQpO1xuXG5cdFx0XHQvLyBQb3NzaWJseSBmcmVlIHVwIG1lbW9yeS4gTWF5IG5vdCBoYXZlIGFueSBpbXBhY3QgYXQgYWxsLCBidXQgKHByb2JhYmx5KSBkb2Vzbid0IGh1cnQuXG5cdFx0XHRkZWxldGUgc25hcHNob3QuZGF0YVVybDtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dHJhbnNsYXRpb25zOiAoc25hcHNob3RUcmFuc2xhdGlvbiBhcyBhbnkpLnRyYW5zbGF0aW9ucyxcblx0XHRcdFx0em9vbUZhY3Rvcjogc25hcHNob3Quem9vbUZhY3RvclxuXHRcdFx0fTtcblxuXHRcdGNhc2UgJ3NldEV4dGVuc2lvbkljb24nOlxuXHRcdFx0YXdhaXQgZG9TZXRFeHRlbnNpb25JY29uKCk7XG5cdFx0XHRyZXR1cm47XG5cblx0XHRjYXNlICdvcGVuTG9naW5Qb3B1cCc6XG5cdFx0XHRjb25zdCBjdXJyZW50VGFiID0gYXdhaXQgZ2V0Q3VycmVudFRhYigpO1xuXHRcdFx0Y2hyb21lLndpbmRvd3MuY3JlYXRlKFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0Zm9jdXNlZDogdHJ1ZSxcblx0XHRcdFx0XHR3aWR0aDogMzc2LFxuXHRcdFx0XHRcdGhlaWdodDogNDQwLFxuXHRcdFx0XHRcdHR5cGU6ICdwb3B1cCcsXG5cdFx0XHRcdFx0dXJsOiBgbG9naW5Qb3B1cC5odG1sP3JlZnJlc2hPbkNvbXBsZXRlVGFiSWQ9JHtjdXJyZW50VGFiLmlkfWAsXG5cdFx0XHRcdFx0dG9wOiAwLFxuXHRcdFx0XHRcdGxlZnQ6IDBcblx0XHRcdFx0fSxcblx0XHRcdFx0KCkgPT4ge31cblx0XHRcdCk7XG5cdFx0XHRyZXR1cm47XG5cblx0XHRjYXNlICdvcGVuU2V0dGluZ3MnOlxuXHRcdFx0Y2hyb21lLnRhYnMuY3JlYXRlKHtcblx0XHRcdFx0dXJsOiBgY2hyb21lOi8vZXh0ZW5zaW9ucy8/aWQ9JHtjaHJvbWUucnVudGltZS5pZH1gXG5cdFx0XHR9KTtcblx0XHRcdHJldHVybjtcblxuXHRcdGRlZmF1bHQ6XG5cdFx0XHRkZWJ1Zyhcblx0XHRcdFx0YFVuc3VwcG9ydGVkIG1lc3NhZ2Uga2luZC5cXG4gc2VuZGVyOlxcbiAke0pTT04uc3RyaW5naWZ5KFxuXHRcdFx0XHRcdHNlbmRlclxuXHRcdFx0XHQpfVxcbiBSZWNlaXZlZCBtZXNzYWdlOiBcXG4gJHtKU09OLnN0cmluZ2lmeShtZXNzYWdlKX1gXG5cdFx0XHQpO1xuXHR9XG59XG5cbi8vIFJldHVybnMgYW4gZXJyb3IgbWVzc2FnZSBzdHJpbmcgb24gZXJyb3IuXG4vLyB1bmRlZmluZWQgbWVhbnMgdGhlcmUgYXJlIG5vIGVycm9ycy5cbmZ1bmN0aW9uIHZhbGlkYXRlSW1hZ2VNZXNzYWdlKG1lc3NhZ2U6IGFueSkge1xuXHRsZXQgZXJyb3JNZXNzYWdlID0gJyc7XG5cblx0Y29uc3QgaW1hZ2UgPSBtZXNzYWdlLmltYWdlO1xuXHRpZiAoIWltYWdlKSB7XG5cdFx0cmV0dXJuICd0cmFuc2xhdGVJbWFnZSBtZXNzYWdlIG11c3Qgc2V0IGltYWdlLic7XG5cdH1cblxuXHRpZiAoIWltYWdlLnNyYyAmJiAhaW1hZ2UuYmFzZTY0RGF0YSkge1xuXHRcdGVycm9yTWVzc2FnZSArPSAndHJhbnNsYXRlSW1hZ2UgbWVzc2FnZSBtdXN0IHNldCBpbWFnZS5zcmMgb3IgaW1hZ2UuYmFzZTY0RGF0YVxcbic7XG5cdH1cblxuXHRpZiAoIWltYWdlLmhlaWdodCkge1xuXHRcdGVycm9yTWVzc2FnZSArPSAndHJhbnNsYXRlSW1hZ2UgbWVzc2FnZSBtdXN0IHNldCBpbWFnZS5oZWlnaHRcXG4nO1xuXHR9XG5cblx0aWYgKCFpbWFnZS53aWR0aCkge1xuXHRcdGVycm9yTWVzc2FnZSArPSAndHJhbnNsYXRlSW1hZ2UgbWVzc2FnZSBtdXN0IHNldCBpbWFnZS53aWR0aFxcbic7XG5cdH1cblxuXHRpZiAoIW1lc3NhZ2UudHJhbnNsYXRlVG8pIHtcblx0XHRlcnJvck1lc3NhZ2UgKz0gJ3RyYW5zbGF0ZUltYWdlIG1lc3NhZ2UgbXVzdCBzZXQgdHJhbnNsYXRlVG9cXG4nO1xuXHR9XG5cblx0cmV0dXJuIGVycm9yTWVzc2FnZSA9PT0gJycgPyB1bmRlZmluZWQgOiBlcnJvck1lc3NhZ2U7XG59XG5cbi8vIFJldHVybnMgYW4gZXJyb3IgbWVzc2FnZSBzdHJpbmcgb24gZXJyb3IuXG4vLyB1bmRlZmluZWQgbWVhbnMgdGhlcmUgYXJlIG5vIGVycm9ycy5cbmZ1bmN0aW9uIHZhbGlkYXRlU25hcHNob3RNZXNzYWdlKG1lc3NhZ2U6IGFueSkge1xuXHRsZXQgZXJyb3JNZXNzYWdlID0gJyc7XG5cblx0aWYgKCFtZXNzYWdlLnRyYW5zbGF0ZVRvKSB7XG5cdFx0ZXJyb3JNZXNzYWdlICs9ICdNdXN0IHN1cHBseSB0cmFuc2xhdGVUby5cXG4nO1xuXHR9XG5cblx0aWYgKG1lc3NhZ2UuZGltZW5zaW9ucyA9PSBudWxsKSB7XG5cdFx0ZXJyb3JNZXNzYWdlICs9ICdNdXN0IHN1cHBseSBkaW1lbnNpb25zIG9mIHRvcCwgbGVmdCwgd2lkdGgsIGFuZCBoZWlnaHQuXFxuJztcblx0fSBlbHNlIHtcblx0XHRjb25zdCBkaW1lbnNpb25zID0gbWVzc2FnZS5kaW1lbnNpb25zO1xuXHRcdGlmICghTnVtYmVyLmlzSW50ZWdlcihkaW1lbnNpb25zLnRvcCkpIHtcblx0XHRcdGVycm9yTWVzc2FnZSArPSAndG9wIG11c3QgYmUgYW4gaW50ZWdlci4nO1xuXHRcdH1cblx0XHRpZiAoIU51bWJlci5pc0ludGVnZXIoZGltZW5zaW9ucy5sZWZ0KSkge1xuXHRcdFx0ZXJyb3JNZXNzYWdlICs9ICdsZWZ0IG11c3QgYmUgYW4gaW50ZWdlci4nO1xuXHRcdH1cblx0XHRpZiAoIU51bWJlci5pc0ludGVnZXIoZGltZW5zaW9ucy53aWR0aCkpIHtcblx0XHRcdGVycm9yTWVzc2FnZSArPSAnd2lkdGggbXVzdCBiZSBhbiBpbnRlZ2VyLic7XG5cdFx0fVxuXHRcdGlmICghTnVtYmVyLmlzSW50ZWdlcihkaW1lbnNpb25zLmhlaWdodCkpIHtcblx0XHRcdGVycm9yTWVzc2FnZSArPSAnaGVpZ2h0IG11c3QgYmUgYW4gaW50ZWdlci4nO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBlcnJvck1lc3NhZ2UgPT09ICcnID8gdW5kZWZpbmVkIDogZXJyb3JNZXNzYWdlO1xufVxuXG5hc3luYyBmdW5jdGlvbiBkb1NldEV4dGVuc2lvbkljb24oKSB7XG5cdC8vIENhbGN1bGF0ZSBpZiBNYW5nYSBUcmFuc2xhdG9yIGlzIGFjdGl2ZSBvbiB0aGUgY3VycmVudCB0YWIuXG5cdGNvbnN0IGFjdGl2ZVRhYiA9IGF3YWl0IGdldEN1cnJlbnRUYWIoKTtcblx0Y29uc3QgYWN0aXZlVXJscyA9IGF3YWl0IGFwcENvbmZpZy5nZXRBY3RpdmVVcmxzKCk7XG5cblx0aWYgKGFjdGl2ZVRhYiAmJiBhY3RpdmVVcmxzLmluY2x1ZGVzKGFjdGl2ZVRhYi5nZXRIb3N0TmFtZSgpKSkge1xuXHRcdGF3YWl0IHNldEV4dGVuc2lvbkljb24oe1xuXHRcdFx0cGF0aDogY2hyb21lLnJ1bnRpbWUuZ2V0VVJMKCdpY29ucy8xMjh4MTI4LnBuZycpLFxuXHRcdFx0dGFiSWQ6IGFjdGl2ZVRhYi5pZFxuXHRcdH0pO1xuXHR9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHRha2VTbmFwc2hvdChcblx0eyB0b3AsIGxlZnQsIGhlaWdodCwgd2lkdGggfSxcblx0dGFiPzogY2hyb21lLnRhYnMuVGFiXG4pOiBQcm9taXNlPHsgZGF0YVVybDogc3RyaW5nOyB6b29tRmFjdG9yOiBudW1iZXIgfSB8IHVuZGVmaW5lZD4ge1xuXHRpZiAodGFiID09IG51bGwpIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRjb25zdCBkYXRhVXJsID0gYXdhaXQgY2FwdHVyZVZpc2libGVUYWIodGFiLndpbmRvd0lkKTtcblxuXHQvLyBTb21ldGhpbmcgd2VudCB3cm9uZy4gUG9zc2libHkgY2xvc2VkIHRhYiBvciByZWZyZXNoZWQuXG5cdGlmICghZGF0YVVybCkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IHpvb21GYWN0b3IgPSBhd2FpdCBnZXRab29tRmFjdG9yKHRhYi5pZCk7XG5cdGNvbnN0IGRhdGFVcmxGZXRjaCA9IGF3YWl0IGZldGNoKGRhdGFVcmwpO1xuXHRjb25zdCB2aXNpYmxlVGFiQmxvYiA9IGF3YWl0IGRhdGFVcmxGZXRjaC5ibG9iKCk7XG5cblx0Y29uc3QgY2FudmFzID0gbmV3IE9mZnNjcmVlbkNhbnZhcyh3aWR0aCwgaGVpZ2h0KTtcblx0Y29uc3QgY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KCdiaXRtYXByZW5kZXJlcicpO1xuXHRjb25zdCBiaXRtYXAgPSBhd2FpdCBjcmVhdGVJbWFnZUJpdG1hcChcblx0XHR2aXNpYmxlVGFiQmxvYixcblx0XHR6b29tRmFjdG9yICogbGVmdCxcblx0XHR6b29tRmFjdG9yICogdG9wLFxuXHRcdHpvb21GYWN0b3IgKiB3aWR0aCxcblx0XHR6b29tRmFjdG9yICogaGVpZ2h0XG5cdCk7XG5cdGNvbnRleHQudHJhbnNmZXJGcm9tSW1hZ2VCaXRtYXAoYml0bWFwKTtcblxuXHRjb25zdCBzbmlwcGV0QmxvYiA9IGF3YWl0IGNhbnZhcy5jb252ZXJ0VG9CbG9iKCk7XG5cblx0Ly8gV2ViUCBpcyBmYXN0ZXIgdGhhbiBQTkcgYW5kIHN0aWxsIGxvc3NsZXNzLlxuXHRyZXR1cm4ge1xuXHRcdGRhdGFVcmw6IGF3YWl0IGJsb2JUb0Jhc2U2NChzbmlwcGV0QmxvYiksXG5cdFx0em9vbUZhY3RvclxuXHR9O1xufVxuXG5mdW5jdGlvbiBibG9iVG9CYXNlNjQoYmxvYjogQmxvYik6IFByb21pc2U8c3RyaW5nPiB7XG5cdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgXykgPT4ge1xuXHRcdGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG5cdFx0cmVhZGVyLm9ubG9hZGVuZCA9ICgpID0+IHJlc29sdmUocmVhZGVyLnJlc3VsdCBhcyBzdHJpbmcpO1xuXHRcdHJlYWRlci5yZWFkQXNEYXRhVVJMKGJsb2IpO1xuXHR9KTtcbn1cblxuLy8gV29ya2Fyb3VuZDpcbi8vIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzcxNzI0OTgwL2Nocm9tZS1leHRlbnNpb24tYWx3YXlzLXNob3ctc2VydmljZS13b3JrZXItaW5hY3RpdmUtYWZ0ZXItYnJvd3Nlci1yZXN0YXJ0LWlmXG5jaHJvbWUucnVudGltZS5vblN0YXJ0dXAuYWRkTGlzdGVuZXIoZnVuY3Rpb24gKCkge1xuXHRjb25zb2xlLmxvZygnaWNoaWdvLWV4dGVuc2lvbi1zdGFydHVwJyk7XG59KTtcbiIsImltcG9ydCB7IGV4ZWN1dGVTY3JpcHQsIGdldEN1cnJlbnRUYWIsIHNldEV4dGVuc2lvbkljb24gfSBmcm9tICcuLi8uLi91dGlscy9jaHJvbWVBcGknO1xuaW1wb3J0IHsgYXBwQ29uZmlnIH0gZnJvbSAnLi4vLi4vdXRpbHMvYXBwQ29uZmlnJztcblxuY29uc3QgbSA9IGNocm9tZS5pMThuLmdldE1lc3NhZ2U7XG5jb25zdCB0cmFuc2xhdGVkUGFnZU1lbnVJZCA9ICdpY2hpZ28tdHJhbnNsYXRlLXBhZ2UnO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaW5pdENvbnRleHRNZW51cygpIHtcblx0Ly8gQ2xlYXIgcHJldmlvdXMgY29udGV4dCBtZW51IHRvIHByZXZlbnQgXCJkdXBsaWNhdGUgY29udGV4dCBtZW51XCIgZXJyb3IuXG5cdGF3YWl0IHJlbW92ZUNvbnRleHRNZW51KHRyYW5zbGF0ZWRQYWdlTWVudUlkKTtcblxuXHRjaHJvbWUuY29udGV4dE1lbnVzLmNyZWF0ZSh7XG5cdFx0aWQ6IHRyYW5zbGF0ZWRQYWdlTWVudUlkLFxuXHRcdHRpdGxlOiBtKCd0b2dnbGVUcmFuc2xhdGlvbnNDb250ZXh0TWVudScpLFxuXHRcdHR5cGU6ICdub3JtYWwnLFxuXHRcdGNvbnRleHRzOiBbJ2FsbCddXG5cdH0pO1xuXG5cdGNocm9tZS5jb250ZXh0TWVudXMub25DbGlja2VkLmFkZExpc3RlbmVyKGFzeW5jIChjb250ZXh0OiBjaHJvbWUuY29udGV4dE1lbnVzLk9uQ2xpY2tEYXRhKSA9PiB7XG5cdFx0aWYgKGNvbnRleHQ/Lm1lbnVJdGVtSWQgIT09IHRyYW5zbGF0ZWRQYWdlTWVudUlkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHRhYiA9IGF3YWl0IGdldEN1cnJlbnRUYWIoKTtcblx0XHRpZiAoIXRhYikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBjb25maWdBY3RpdmVVcmxzID0gYXdhaXQgYXBwQ29uZmlnLmdldEFjdGl2ZVVybHMoKTtcblx0XHRjb25zdCBpc1RvZ2dsZWRPbiA9IGNvbmZpZ0FjdGl2ZVVybHMuaW5jbHVkZXModGFiLmdldEhvc3ROYW1lKCkpO1xuXG5cdFx0aWYgKGlzVG9nZ2xlZE9uKSB7XG5cdFx0XHQvLyBUb2dnbGUgb2ZmLlxuXHRcdFx0YXdhaXQgYXBwQ29uZmlnLnJlbW92ZUFjdGl2ZVVybCh0YWIuZ2V0SG9zdE5hbWUoKSk7XG5cdFx0XHRhd2FpdCBzZXRFeHRlbnNpb25JY29uKHtcblx0XHRcdFx0cGF0aDogY2hyb21lLnJ1bnRpbWUuZ2V0VVJMKCdpY29ucy8xMjh4MTI4LWRpc2FibGVkLnBuZycpLFxuXHRcdFx0XHR0YWJJZDogdGFiLmlkXG5cdFx0XHR9KTtcblxuXHRcdFx0YXdhaXQgZXhlY3V0ZVNjcmlwdCh0YWIuaWQsICdqcy9jbGVhclRyYW5zbGF0aW9ucy5qcycpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBUb2dnbGUgb24uXG5cdFx0XHRhd2FpdCBhcHBDb25maWcuYWRkQWN0aXZlVXJsKHRhYi5nZXRIb3N0TmFtZSgpKTtcblx0XHRcdGF3YWl0IHNldEV4dGVuc2lvbkljb24oe1xuXHRcdFx0XHRwYXRoOiBjaHJvbWUucnVudGltZS5nZXRVUkwoJ2ljb25zLzEyOHgxMjgucG5nJyksXG5cdFx0XHRcdHRhYklkOiB0YWIuaWRcblx0XHRcdH0pO1xuXHRcdH1cblx0fSk7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZUNvbnRleHRNZW51KG1lbnVJZDogc3RyaW5nKSB7XG5cdHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHRjaHJvbWUuY29udGV4dE1lbnVzLnJlbW92ZShtZW51SWQsICgpID0+IHtcblx0XHRcdGlmIChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpIHtcblx0XHRcdFx0Ly8gRG8gbm90aGluZyBpZiBhbiBlcnJvciBvY2N1cnMuIENhbiBoYXBwZW4gaWYgbWVudSBpdGVtIGRvZXNuJ3QgZXhpc3QuXG5cdFx0XHR9XG5cdFx0XHRyZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0fSk7XG5cdH0pO1xufVxuIiwiaW1wb3J0IHsgZGVidWcsIHRyYW5zbGF0ZUltYWdlIH0gZnJvbSAnLi4vdXRpbHMvaWNoaWdvQXBpJztcbmltcG9ydCB7IGdldEJhc2U2NERhdGEgfSBmcm9tICcuL3V0aWxzL2ltYWdlVXRpbHMnO1xuaW1wb3J0IHsgVHJhbnNsYXRpb25SZXN1bHRzLCBjYWxjdWxhdGVSZXNpemVkQXNwZWN0UmF0aW8gfSBmcm9tICcuLi91dGlscy90cmFuc2xhdGlvbic7XG5pbXBvcnQgeyBmYXN0SGFzaCB9IGZyb20gJy4vdXRpbHMvZmFzdEhhc2gnO1xuaW1wb3J0IHsgTGFuZ3VhZ2VDb2RlIH0gZnJvbSAnLi4vdXRpbHMvbG9jYWxlcyc7XG5pbXBvcnQgeyBUcmFuc2xhdGlvbk1vZGVsIH0gZnJvbSAnLi4vdXRpbHMvbW9kZWxzJztcblxuY29uc3QgdHJhbnNsYXRpb25DYWNoZSA9IHt9O1xuXG5pbnRlcmZhY2UgSW1hZ2Uge1xuXHR3aWR0aDogbnVtYmVyO1xuXHRoZWlnaHQ6IG51bWJlcjtcblx0YmFzZTY0RGF0YT86IHN0cmluZztcblxuXHQvLyBVUkwgb2YgdGhlIGltYWdlIHRvIHRyYW5zbGF0ZS4gTWF5IGJlIGJhc2U2NCBkYXRhLlxuXHQvLyBFaXRoZXIgYHNyY2Agb3IgYGJhc2U2NERhdGFgIG11c3QgYmUgc2V0LlxuXHRzcmM/OiBzdHJpbmc7XG59XG5cbi8vIE5vdGUgdGhpcyBjYW4gb25seSBiZSBjYWxsZWQgZnJvbSBjb250ZXh0cyB3aGljaCBjYW4gbWFrZSBIVFRQIHJlcXVlc3RzLlxuLy8gRm9yIGV4YW1wbGUsIGBiYWNrZ3JvdW5kLnRzYC5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB0cmFuc2xhdGUoXG5cdG9yaWdpbmFsSW1hZ2U6IEltYWdlLFxuXHR0cmFuc2xhdGVUbzogTGFuZ3VhZ2VDb2RlLFxuXHR0cmFuc2xhdGlvbk1vZGVsPzogVHJhbnNsYXRpb25Nb2RlbCxcblx0aW5jbHVkZUJhc2U2NERhdGE/OiBib29sZWFuXG4pOiBQcm9taXNlPFRyYW5zbGF0aW9uUmVzdWx0cyB8ICdGZXRjaEVycm9yJyB8ICdTaXRlQWNjZXNzRXJyb3InPiB7XG5cdGxldCBpbWFnZVRvVHJhbnNsYXRlID0gb3JpZ2luYWxJbWFnZTtcblxuXHRpZiAoaW1hZ2VUb1RyYW5zbGF0ZS5iYXNlNjREYXRhID09PSB1bmRlZmluZWQgJiYgb3JpZ2luYWxJbWFnZS5zcmMpIHtcblx0XHRjb25zdCBmZXRjaGVkSW1hZ2UgPSBhd2FpdCBmZXRjaEltYWdlV2l0aFNjYWxpbmcob3JpZ2luYWxJbWFnZSk7XG5cdFx0Y29uc3QgZmFpbGVkID0gZmV0Y2hlZEltYWdlID09PSAnRmV0Y2hFcnJvcicgfHwgZmV0Y2hlZEltYWdlID09PSAnU2l0ZUFjY2Vzc0Vycm9yJztcblx0XHRpZiAoZmFpbGVkKSB7XG5cdFx0XHQvLyBSZXR1cm4gdGhlIGVycm9yIHRvIHRoZSBjYWxsZXIuXG5cdFx0XHRyZXR1cm4gZmV0Y2hlZEltYWdlO1xuXHRcdH1cblxuXHRcdGltYWdlVG9UcmFuc2xhdGUgPSBmZXRjaGVkSW1hZ2U7XG5cdH1cblxuXHQvLyBJZiB3ZSBjb3VsZG4ndCBnZXQgYmFzZTY0IGRhdGEgZnJvbSB0aGUgb3JpZ2luYWwgaW1hZ2Ugb3Igd2l0aCBgZmV0Y2hJbWFnZVdpdGhTY2FsaW5nYCwgcmV0dXJuIGZhaWx1cmUuXG5cdGlmIChpbWFnZVRvVHJhbnNsYXRlLmJhc2U2NERhdGEgPT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiAnRmV0Y2hFcnJvcic7XG5cdH1cblxuXHQvLyBDYWNoZSB0cmFuc2xhdGlvbnMgb24gdGhlIE1ENSBoYXNoIG9mIHRoZSBpbWFnZSBkYXRhLlxuXHQvLyBUaGUgVVJMIGlzIG5vdCB1c2VkIGFzIHRoZSBrZXkgYmVjYXVzZSBpdCBtYXkgcmV0dXJuIGRpZmZlcmVudCByZXN1bHRzIGRlcGVuZGluZyBvbiB2YXJpb3VzIGZhY3RvcnMuXG5cdGNvbnN0IGltYWdlSWRlbnRpdHkgPVxuXHRcdHRyYW5zbGF0ZVRvICsgKHRyYW5zbGF0aW9uTW9kZWwgPz8gJzp1bmtub3duOicpICsgZmFzdEhhc2goaW1hZ2VUb1RyYW5zbGF0ZS5iYXNlNjREYXRhKTtcblx0Y29uc3QgY2FjaGVkVHJhbnNsYXRpb24gPSB0cmFuc2xhdGlvbkNhY2hlW2ltYWdlSWRlbnRpdHldO1xuXHRjb25zdCByZXN1bHQgPVxuXHRcdGNhY2hlZFRyYW5zbGF0aW9uIHx8XG5cdFx0KGF3YWl0IHRyYW5zbGF0ZUltYWdlKHRyYW5zbGF0ZVRvLCBpbWFnZVRvVHJhbnNsYXRlLmJhc2U2NERhdGEsIHRyYW5zbGF0aW9uTW9kZWwpKTtcblxuXHRpZiAoIXJlc3VsdC5lcnJvck1lc3NhZ2UpIHtcblx0XHR0cmFuc2xhdGlvbkNhY2hlW2ltYWdlSWRlbnRpdHldID0gcmVzdWx0O1xuXHR9XG5cblx0Y29uc3QgYmFzZTY0RGF0YSA9IGluY2x1ZGVCYXNlNjREYXRhICYmIGltYWdlVG9UcmFuc2xhdGUuYmFzZTY0RGF0YTtcblxuXHRyZXR1cm4ge1xuXHRcdGltYWdlOiB7IHdpZHRoOiBpbWFnZVRvVHJhbnNsYXRlLndpZHRoLCBoZWlnaHQ6IGltYWdlVG9UcmFuc2xhdGUuaGVpZ2h0IH0sXG5cdFx0dHJhbnNsYXRpb25zOiByZXN1bHQudHJhbnNsYXRpb25zLFxuXHRcdGJhc2U2NERhdGFcblx0fTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZmV0Y2hJbWFnZVdpdGhTY2FsaW5nKGltYWdlOiBJbWFnZSkge1xuXHQvLyBEb3duc2NhbGUgZXh0cmEgbGFyZ2UgaW1hZ2VzLiBIZWxwcyBwcmV2ZW50IHByb2Nlc3NpbmcgdGltZW91dHMuXG5cdGNvbnN0IFtyZXNpemVkV2lkdGgsIHJlc2l6ZWRIZWlnaHRdID0gY2FsY3VsYXRlUmVzaXplZEFzcGVjdFJhdGlvKHtcblx0XHR3aWR0aDogaW1hZ2Uud2lkdGgsXG5cdFx0aGVpZ2h0OiBpbWFnZS5oZWlnaHQsXG5cdFx0aGVpZ2h0TWF4UHg6IDE4MDAsXG5cdFx0d2lkdGhNYXhQeDogMTgwMFxuXHR9KTtcblxuXHRkZWJ1ZyhgaDoke3Jlc2l6ZWRIZWlnaHR9IHc6JHtyZXNpemVkV2lkdGh9YCk7XG5cblx0Y29uc3QgcmVzaXplZEltYWdlID0ge1xuXHRcdC4uLmltYWdlLFxuXHRcdG9yaWdpbmFsV2lkdGg6IGltYWdlLndpZHRoLFxuXHRcdG9yaWdpbmFsSGVpZ2h0OiBpbWFnZS5oZWlnaHQsXG5cdFx0cmVzaXplZFdpZHRoLFxuXHRcdHJlc2l6ZWRIZWlnaHRcblx0fTtcblxuXHRjb25zdCBlbmNvZGVkSW1hZ2UgPSBhd2FpdCBnZXRCYXNlNjREYXRhKHJlc2l6ZWRJbWFnZSBhcyBhbnkpO1xuXHRyZXR1cm4gZW5jb2RlZEltYWdlO1xufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIGZhc3RIYXNoKHN0cjogc3RyaW5nKTogc3RyaW5nIHtcblx0bGV0IGhhc2ggPSAnJztcblx0Y29uc3QgbGVuID0gc3RyLmxlbmd0aDtcblx0Y29uc3Qgc2VsZWN0Q291bnQgPSAxNTA7XG5cblx0Ly8gU2VsZWN0IHRoZSBmaXJzdCAxNTAgY2hhcmFjdGVycy5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzZWxlY3RDb3VudCAmJiBpIDwgbGVuOyBpKyspIHtcblx0XHRoYXNoICs9IHN0ci5jaGFyQ29kZUF0KGkpO1xuXHR9XG5cblx0Ly8gU2VsZWN0IHRoZSBsYXN0IDE1MCBjaGFyYWN0ZXJzLlxuXHRmb3IgKGxldCBpID0gbGVuIC0gc2VsZWN0Q291bnQ7IGkgPCBsZW47IGkrKykge1xuXHRcdGlmIChpID49IDApIHtcblx0XHRcdGhhc2ggKz0gc3RyLmNoYXJDb2RlQXQoaSk7XG5cdFx0fVxuXHR9XG5cblx0Ly8gTG9vcCB0aHJvdWdoIHRoZSBlbnRpcmUgc3RyaW5nLCBpbmNyZWFzaW5nIHRoZSBpbmRleCBieSBhIHNsaWNlIG9mIDEvMTAwMHRoIHRoZSB0b3RhbCBsZW5ndGhcblx0Y29uc3Qgc3RlcCA9IE1hdGguY2VpbChsZW4gLyAxMDAwKSArIDE7XG5cdGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpICs9IHN0ZXApIHtcblx0XHRoYXNoICs9IHN0ci5jaGFyQ29kZUF0KGkpO1xuXHR9XG5cblx0cmV0dXJuIGhhc2g7XG59XG4iLCJpbXBvcnQgeyBkZWJ1ZyB9IGZyb20gJy4uLy4uL3V0aWxzL2ljaGlnb0FwaSc7XG5pbXBvcnQgeyBnZXRJbWFnZSB9IGZyb20gJy4vdXRpbHMnO1xuXG5leHBvcnQgdHlwZSBJbWFnZUJhc2U2NCA9IHN0cmluZzsgLy8gRWcgJ2RhdGE6aW1hZ2UvcG5nO2Jhc2U2NCxpVkJPUncwS0dnby4uLidcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEJhc2U2NERhdGEoe1xuXHRzcmMsXG5cdHJlc2l6ZWRXaWR0aCxcblx0cmVzaXplZEhlaWdodCxcblx0b3JpZ2luYWxIZWlnaHQsXG5cdG9yaWdpbmFsV2lkdGhcbn06IHtcblx0c3JjOiBzdHJpbmc7XG5cdHJlc2l6ZWRXaWR0aDogbnVtYmVyO1xuXHRyZXNpemVkSGVpZ2h0OiBudW1iZXI7XG5cdG9yaWdpbmFsV2lkdGg6IG51bWJlcjtcblx0b3JpZ2luYWxIZWlnaHQ6IG51bWJlcjtcblx0YmFzZTY0RGF0YT86IEltYWdlQmFzZTY0O1xufSk6IFByb21pc2U8XG5cdHsgYmFzZTY0RGF0YTogSW1hZ2VCYXNlNjQ7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyIH0gfCAnRmV0Y2hFcnJvcicgfCAnU2l0ZUFjY2Vzc0Vycm9yJ1xuPiB7XG5cdGxldCBpbWFnZURhdGE7XG5cdHRyeSB7XG5cdFx0aW1hZ2VEYXRhID0gYXdhaXQgZ2V0SW1hZ2Uoc3JjKTtcblx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHQvLyBUaGlzIGNhbiBoYXBwZW4gaWYgdGhlIHVzZXJzIHNldHMgTWFuZ2EgVHJhbnNsYXRvcidzIFwiU2l0ZSBBY2Nlc3NcIiB0byBcIk9uIGNsaWNrXCIsXG5cdFx0Ly8gaW5zdGVhZCBvZiBcIk9uIGFsbCBzaXRlc1wiLCBkdWUgdG8gQ09SUy4gSXQgY2FuIGFsc28gaGFwcGVuIGlmIHJlZmVyZXIgaXMgbm90IHByb3Blcmx5IHNldCwgb24gc29tZSBkb21haW5zLlxuXHRcdHJldHVybiAnU2l0ZUFjY2Vzc0Vycm9yJztcblx0fVxuXG5cdGlmICghdmFsaWRTdGF0dXNDb2RlKGltYWdlRGF0YS5zdGF0dXMpKSB7XG5cdFx0cmV0dXJuICdGZXRjaEVycm9yJztcblx0fVxuXG5cdGNvbnN0IGJsb2IgPSBhd2FpdCBpbWFnZURhdGEuYmxvYigpO1xuXHRjb25zdCBzaG91bGRSZXNpemUgPSByZXNpemVkV2lkdGggIT0gb3JpZ2luYWxXaWR0aCB8fCByZXNpemVkSGVpZ2h0ICE9IG9yaWdpbmFsSGVpZ2h0O1xuXG5cdGlmIChzaG91bGRSZXNpemUpIHtcblx0XHRkZWJ1ZyhgcmVzaXplZDogJHtyZXNpemVkV2lkdGh9LyR7b3JpZ2luYWxXaWR0aH0gOiAke3Jlc2l6ZWRIZWlnaHR9LyR7b3JpZ2luYWxIZWlnaHR9YCk7XG5cdFx0Y29uc3QgY2FudmFzID0gbmV3IE9mZnNjcmVlbkNhbnZhcyhyZXNpemVkV2lkdGgsIHJlc2l6ZWRIZWlnaHQpO1xuXHRcdGNvbnN0IGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCgnYml0bWFwcmVuZGVyZXInKTtcblx0XHRjb25zdCBiaXRtYXAgPSBhd2FpdCBjcmVhdGVJbWFnZUJpdG1hcChibG9iLCB7XG5cdFx0XHRyZXNpemVXaWR0aDogcmVzaXplZFdpZHRoLFxuXHRcdFx0cmVzaXplSGVpZ2h0OiByZXNpemVkSGVpZ2h0LFxuXHRcdFx0cmVzaXplUXVhbGl0eTogJ2hpZ2gnXG5cdFx0fSk7XG5cdFx0Y29udGV4dC50cmFuc2ZlckZyb21JbWFnZUJpdG1hcChiaXRtYXApO1xuXG5cdFx0Y29uc3QgcmVzaXplZEJsb2IgPSBhd2FpdCBjYW52YXMuY29udmVydFRvQmxvYigpO1xuXHRcdGNvbnN0IGJhc2U2NERhdGEgPSBhd2FpdCBibG9iVG9CYXNlNjQocmVzaXplZEJsb2IpO1xuXG5cdFx0cmV0dXJuIHsgYmFzZTY0RGF0YSwgd2lkdGg6IHJlc2l6ZWRXaWR0aCwgaGVpZ2h0OiByZXNpemVkSGVpZ2h0IH07XG5cdH0gZWxzZSB7XG5cdFx0Y29uc3QgYmFzZTY0RGF0YSA9IGF3YWl0IGJsb2JUb0Jhc2U2NChibG9iKTtcblx0XHRyZXR1cm4geyBiYXNlNjREYXRhLCB3aWR0aDogb3JpZ2luYWxXaWR0aCwgaGVpZ2h0OiBvcmlnaW5hbEhlaWdodCB9O1xuXHR9XG59XG5cbmZ1bmN0aW9uIGJsb2JUb0Jhc2U2NChibG9iOiBCbG9iKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCBfKSA9PiB7XG5cdFx0Y29uc3QgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcblx0XHRyZWFkZXIub25sb2FkZW5kID0gKCkgPT4gcmVzb2x2ZShyZWFkZXIucmVzdWx0IGFzIHN0cmluZyk7XG5cdFx0cmVhZGVyLnJlYWRBc0RhdGFVUkwoYmxvYik7XG5cdH0pO1xufVxuXG5mdW5jdGlvbiB2YWxpZFN0YXR1c0NvZGUoc3RhdHVzQ29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG5cdC8vIFNlZTogaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvTGlzdF9vZl9IVFRQX3N0YXR1c19jb2Rlc1xuXHRyZXR1cm4gc3RhdHVzQ29kZSA+PSAyMDAgJiYgc3RhdHVzQ29kZSA8IDQwMDtcbn1cbiIsImltcG9ydCB7IHVwZGF0ZVNlc3Npb25IZWFkZXJzIH0gZnJvbSAnLi4vLi4vdXRpbHMvY2hyb21lQXBpJztcblxuLy8gQSBzZXQgb2YgY29tbW9uIGZ1bmN0aW9ucyB0aGF0IGFyZW4ndCB3b3J0aCBncm91cGluZyBhbG9uZS5cbi8vIEJyZWFrIG1vZHVsZSBpbnRvIG11bHRpcGxlIG1vZHVsZXMgd2hlbiBpdCBncm93cyB0b28gbGFyZ2UgKDgwMCsgTE9DKS5cbmV4cG9ydCBmdW5jdGlvbiBzbGVlcE1zKG1pbGxpc2Vjb25kcykge1xuXHRyZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1pbGxpc2Vjb25kcykpO1xufVxuXG5jb25zdCBNb2RpZnlIZWFkZXJzID0gJ21vZGlmeUhlYWRlcnMnIGFzIGNocm9tZS5kZWNsYXJhdGl2ZU5ldFJlcXVlc3QuUnVsZUFjdGlvblR5cGUuTU9ESUZZX0hFQURFUlM7XG5jb25zdCBTZXRIZWFkZXIgPSAnc2V0JyBhcyBjaHJvbWUuZGVjbGFyYXRpdmVOZXRSZXF1ZXN0LkhlYWRlck9wZXJhdGlvbi5TRVQ7XG5jb25zdCBSZXF1ZXN0ID0gJ3htbGh0dHByZXF1ZXN0JyBhcyBjaHJvbWUuZGVjbGFyYXRpdmVOZXRSZXF1ZXN0LlJlc291cmNlVHlwZS5YTUxIVFRQUkVRVUVTVDtcblxubGV0IGlkID0gMTtcbmZ1bmN0aW9uIGdldElkKCkge1xuXHRyZXR1cm4gaWQrKztcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEltYWdlKHNyYzogc3RyaW5nKSB7XG5cdGxldCBob3N0bmFtZTtcblx0dHJ5IHtcblx0XHRob3N0bmFtZSA9IG5ldyBVUkwoc3JjKS5ob3N0bmFtZTtcblx0fSBjYXRjaCB7XG5cdFx0aG9zdG5hbWUgPSAnJztcblx0fVxuXG5cdC8vIENoZWNrIGlmIGhvc3RuYW1lIG1hdGNoZXMgYW55IG9mIHRoZSByZWZlcmVyIGhlYWRlciBydWxlIGlkcy5cblx0Y29uc3QgcnVsZVZhbHVlcyA9IE9iamVjdC52YWx1ZXMocnVsZXMpO1xuXHRmb3IgKGNvbnN0IHJ1bGUgb2YgcnVsZVZhbHVlcykge1xuXHRcdGlmIChob3N0bmFtZS5pbmNsdWRlcyhydWxlLmNvbmRpdGlvbi51cmxGaWx0ZXIpKSB7XG5cdFx0XHRjb25zdCBjbG9uZWRSdWxlID0geyAuLi5ydWxlLCBpZDogZ2V0SWQoKSB9O1xuXHRcdFx0dXBkYXRlU2Vzc2lvbkhlYWRlcnMoeyBhZGRSdWxlczogW2Nsb25lZFJ1bGVdIH0pO1xuXG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBmZXRjaChzcmMpO1xuXG5cdFx0XHR1cGRhdGVTZXNzaW9uSGVhZGVycyh7IHJlbW92ZVJ1bGVJZHM6IFtjbG9uZWRSdWxlLmlkXSB9KTtcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXHR9XG5cblx0Ly8gT3RoZXJ3aXNlLCByZXR1cm4gcmVndWxhciBmZXRjaCByZXF1ZXN0LlxuXHRyZXR1cm4gYXdhaXQgZmV0Y2goc3JjKTtcbn1cblxuY29uc3QgcnVsZXMgPSB7XG5cdHBpeGl2OiB7XG5cdFx0aWQ6IGdldElkKCksXG5cdFx0cHJpb3JpdHk6IDEsXG5cdFx0YWN0aW9uOiB7XG5cdFx0XHR0eXBlOiBNb2RpZnlIZWFkZXJzLFxuXHRcdFx0cmVxdWVzdEhlYWRlcnM6IFtcblx0XHRcdFx0eyBoZWFkZXI6ICdyZWZlcmVyJywgb3BlcmF0aW9uOiBTZXRIZWFkZXIsIHZhbHVlOiAnaHR0cHM6Ly93d3cucGl4aXYubmV0LycgfVxuXHRcdFx0XVxuXHRcdH0sXG5cdFx0Y29uZGl0aW9uOiB7XG5cdFx0XHR1cmxGaWx0ZXI6ICdweGltZy5uZXQnLFxuXHRcdFx0cmVzb3VyY2VUeXBlczogW1JlcXVlc3RdXG5cdFx0fVxuXHR9LFxuXHRtYW5odWFndWk6IHtcblx0XHRpZDogZ2V0SWQoKSxcblx0XHRwcmlvcml0eTogMSxcblx0XHRhY3Rpb246IHtcblx0XHRcdHR5cGU6IE1vZGlmeUhlYWRlcnMsXG5cdFx0XHRyZXF1ZXN0SGVhZGVyczogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aGVhZGVyOiAncmVmZXJlcicsXG5cdFx0XHRcdFx0b3BlcmF0aW9uOiBTZXRIZWFkZXIsXG5cdFx0XHRcdFx0dmFsdWU6ICdodHRwczovL3d3dy5tYW5odWFndWkuY29tLydcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH0sXG5cdFx0Y29uZGl0aW9uOiB7XG5cdFx0XHR1cmxGaWx0ZXI6ICdpLmhhbXJldXMuY29tJyxcblx0XHRcdHJlc291cmNlVHlwZXM6IFtSZXF1ZXN0XVxuXHRcdH1cblx0fSxcblx0aGl0b21pOiB7XG5cdFx0aWQ6IGdldElkKCksXG5cdFx0cHJpb3JpdHk6IDEsXG5cdFx0YWN0aW9uOiB7XG5cdFx0XHR0eXBlOiBNb2RpZnlIZWFkZXJzLFxuXHRcdFx0cmVxdWVzdEhlYWRlcnM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGhlYWRlcjogJ3JlZmVyZXInLFxuXHRcdFx0XHRcdG9wZXJhdGlvbjogU2V0SGVhZGVyLFxuXHRcdFx0XHRcdHZhbHVlOiAnaHR0cHM6Ly9oaXRvbWkubGEvJ1xuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fSxcblx0XHRjb25kaXRpb246IHtcblx0XHRcdHVybEZpbHRlcjogJ2hpdG9taS5sYScsXG5cdFx0XHRyZXNvdXJjZVR5cGVzOiBbUmVxdWVzdF1cblx0XHR9XG5cdH0sXG5cdGtsbWFuZ2E6IHtcblx0XHRpZDogZ2V0SWQoKSxcblx0XHRwcmlvcml0eTogMSxcblx0XHRhY3Rpb246IHtcblx0XHRcdHR5cGU6IE1vZGlmeUhlYWRlcnMsXG5cdFx0XHRyZXF1ZXN0SGVhZGVyczogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aGVhZGVyOiAncmVmZXJlcicsXG5cdFx0XHRcdFx0b3BlcmF0aW9uOiBTZXRIZWFkZXIsXG5cdFx0XHRcdFx0dmFsdWU6ICdodHRwczovL2tsbWFuZ2EuY29tLydcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH0sXG5cdFx0Y29uZGl0aW9uOiB7XG5cdFx0XHR1cmxGaWx0ZXI6ICdrbGltdjEueHl6Jyxcblx0XHRcdHJlc291cmNlVHlwZXM6IFtSZXF1ZXN0XVxuXHRcdH1cblx0fVxufTtcbiIsImltcG9ydCB7IGdldERlZmF1bHRMYW5ndWFnZSwgTGFuZ3VhZ2VDb2RlLCBsYW5ndWFnZUNvZGVzIH0gZnJvbSAnLi9sb2NhbGVzJztcbmltcG9ydCB7IGdldFN0b3JhZ2VJdGVtLCBzZXRTdG9yYWdlSXRlbSB9IGZyb20gJy4vY2hyb21lQXBpJztcbmltcG9ydCB7IHY0IGFzIHV1aWR2NCB9IGZyb20gJ3V1aWQnO1xuaW1wb3J0IHsgVHJhbnNsYXRpb25Nb2RlbCB9IGZyb20gJy4vbW9kZWxzJztcblxuZXhwb3J0IGludGVyZmFjZSBBcHBDb25maWcge1xuXHQvLyBHZXRzIHRoZSBjbGllbnQgdXVpZC5cblx0Z2V0Q2xpZW50VXVpZDogKCkgPT4gUHJvbWlzZTxzdHJpbmc+O1xuXG5cdC8vIEdldHMgdGhlIG5hbWUgb2YgdGhlIGZvbnQgdGhhdCBzaG91bGQgYmUgdXNlZCBmb3IgVUkgc3RyaW5ncy5cblx0Ly8gZWcgYHRleHQuc3R5bGUuZm9udEZhbWlseSA9IGFwcENvbmZpZy5nZXRVSUZvbnROYW1lKCk7YFxuXHQvLyByZXR1cm5zIGBzeXN0ZW0tZGVmYXVsdGAgZm9yIGxhbmd1YWdlcyB0aGF0IGRvbid0IGhhdmUgYSBmb250IGZpbGUuXG5cdGdldFVJRm9udEZhbWlseTogKCkgPT4gc3RyaW5nO1xuXG5cdC8vIFNldC9nZXQgdGhlIHRyYW5zbGF0aW9uIG1vZGVsIHRvIHVzZSB3aGVuIHRyYW5zbGF0aW5nIG1hbmdhLiBFZyAnZ3B0NG8tbWluaScsICdncHQ0bycsICdkZWVwbCcsIC4uXG5cdGdldFRyYW5zbGF0aW9uTW9kZWw6ICgpID0+IFByb21pc2U8VHJhbnNsYXRpb25Nb2RlbCB8IHVuZGVmaW5lZD47XG5cdHNldFRyYW5zbGF0aW9uTW9kZWw6IChtb2RlbDogVHJhbnNsYXRpb25Nb2RlbCkgPT4gUHJvbWlzZTxib29sZWFuPjtcblxuXHQvLyBTZXQvZ2V0IHRoZSBsYW5ndWFnZSBjb2RlIG9mIHRoZSBsYW5ndWFnZSB0byB0cmFuc2xhdGUgdG8uXG5cdGdldFRyYW5zbGF0ZVRvTGFuZ3VhZ2U6ICgpID0+IFByb21pc2U8TGFuZ3VhZ2VDb2RlPjtcblx0c2V0VHJhbnNsYXRlVG9MYW5ndWFnZTogKGxhbmd1YWdlQ29kZTogTGFuZ3VhZ2VDb2RlKSA9PiBQcm9taXNlPGJvb2xlYW4+O1xuXG5cdC8vIFNldC9nZXQgY3VycmVudCB1c2VyIGVtYWlsLlxuXHRnZXRFbWFpbDogKCkgPT4gUHJvbWlzZTxzdHJpbmc+O1xuXHRzZXRFbWFpbDogKGVtYWlsOiBzdHJpbmcpID0+IFByb21pc2U8Ym9vbGVhbj47XG5cblx0Ly8gU2V0L2dldCBjb25maWd1cmVkIG1hbmdhIGZvbnQgZmFtaWx5LlxuXHRnZXRGb250RmFtaWx5OiAoKSA9PiBQcm9taXNlPHN0cmluZz47XG5cdHNldEZvbnRGYW1pbHk6IChmb250RmFtaWx5OiBzdHJpbmcpID0+IFByb21pc2U8Ym9vbGVhbj47XG5cblx0Ly8gU2V0L2dldCBjb25maWd1cmVkIG1hbmdhIGZvbnQgY29sb3IuXG5cdGdldEZvbnRDb2xvcjogKCkgPT4gUHJvbWlzZTxzdHJpbmc+O1xuXHRzZXRGb250Q29sb3I6IChmb250Q29sb3I6IHN0cmluZykgPT4gUHJvbWlzZTxib29sZWFuPjtcblxuXHQvLyBTZXQvZ2V0IGNvbmZpZ3VyZWQgbWFuZ2EgZm9udCB3ZWlnaHQuXG5cdGdldEZvbnRXZWlnaHQ6ICgpID0+IFByb21pc2U8c3RyaW5nPjtcblx0c2V0Rm9udFdlaWdodDogKGZvbnRXZWlnaHQ6IHN0cmluZykgPT4gUHJvbWlzZTxib29sZWFuPjtcblxuXHQvLyBhZGQvcmVtb3ZlL2dldCBhY3RpdmUgdHJhbnNsYXRpb24gdXJscy5cblx0Ly8gQW4gYWN0aXZlIHVybCBpcyBhIHNpdGUgdGhlIGV4dGVuc2lvbiB3aWxsIHNjYW4gZm9yIHRyYW5zbGF0aW9uIG9wcG9ydHVuaXRpZXMuXG5cdGdldEFjdGl2ZVVybHM6ICgpID0+IFByb21pc2U8c3RyaW5nW10+O1xuXHRhZGRBY3RpdmVVcmw6IChhY3RpdmVVcmw6IHN0cmluZykgPT4gUHJvbWlzZTxib29sZWFuPjtcblx0cmVtb3ZlQWN0aXZlVXJsOiAoYWN0aXZlVXJsOiBzdHJpbmcpID0+IFByb21pc2U8Ym9vbGVhbj47XG59XG5cbmVudW0gS2V5cyB7XG5cdEVtYWlsID0gJ2VtYWlsJyxcblx0Rm9udEZhbWlseSA9ICdmb250RmFtaWx5Jyxcblx0Rm9udENvbG9yID0gJ2ZvbnRDb2xvcicsXG5cdEZvbnRXZWlnaHQgPSAnZm9udFdlaWdodCcsXG5cdEFjdGl2ZVVybHMgPSAnYWN0aXZlVXJscycsXG5cdENsaWVudFV1aWQgPSAnY2xpZW50VXVpZCcsXG5cdFRyYW5zbGF0ZVRvTGFuZ3VhZ2UgPSAndHJhbnNsYXRlVG9MYW5ndWFnZScsXG5cdFRyYW5zbGF0aW9uTW9kZWwgPSAndHJhbnNsYXRpb25Nb2RlbCdcbn1cblxuZXhwb3J0IGNvbnN0IGRlZmF1bHRzID0gT2JqZWN0LmZyZWV6ZSh7XG5cdGVtYWlsOiAnJyxcblx0Zm9udEZhbWlseTogJ0NDIFdpbGQgV29yZHMnLFxuXHRmb250Q29sb3I6ICcjMDAwMDAwJyxcblx0Zm9udFdlaWdodDogJ2luaXRpYWwnLFxuXHR0cmFuc2xhdGVUb0xhbmd1YWdlOiBnZXREZWZhdWx0TGFuZ3VhZ2UoKSxcblx0dHJhbnNsYXRpb25Nb2RlbDogJ2dwdDRvLW1pbmknXG59KTtcblxuLy8gVXNlZCB0byBjaGVjayBpZiBhbnkgb2YgdGhlIGFjdGl2ZVVybCBhcHBDb25maWcgcHJvcGVydGllcyBoYXZlIGJlZW4gYWNjZXNzZWQuXG4vLyBUaGlzIGlzIHNvIGRlZmF1bHRzIGNhbiBiZSBpbml0aWFsaXplZC5cbi8vIFRoaXMgY2Fubm90IGJlIGRvbmUgaW4gY2hyb21lLnJ1bnRpbWUub25JbnN0YWxsZWQgZHVlIHRvIHRoYXQgZXZlbnQgYmVpbmcgdHJpZ2dlcmVkIG9uIGNocm9tZSB1cGRhdGVzLFxuLy8gYW5kIG9uIGFwcCB1cGRhdGVzLlxuY29uc3QgaGFzSW5pdEFjdGl2ZVVybERlZmF1bHRzID0gJ19pc0FjdGl2ZVVybEluaXRLZXknO1xuY29uc3QgY29tbW9uTWFuZ2FTaXRlcyA9IFtdO1xuXG5leHBvcnQgY29uc3QgYXBwQ29uZmlnOiBBcHBDb25maWcgPSBPYmplY3QuZnJlZXplKHtcblx0Z2V0Q2xpZW50VXVpZDogYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGNsaWVudFV1aWQgPSBhd2FpdCBnZXRTdG9yYWdlSXRlbTxzdHJpbmc+KEtleXMuQ2xpZW50VXVpZCk7XG5cdFx0aWYgKGNsaWVudFV1aWQpIHtcblx0XHRcdHJldHVybiBjbGllbnRVdWlkO1xuXHRcdH1cblxuXHRcdC8vIEluaXRpYWxpemUgY2xpZW50IHV1aWQuXG5cdFx0Ly8gSWYgc3RvcmFnZSBpcyBmdWxsLCB0aGlzIGNvdWxkIGZhaWwgcmVwZWF0ZWRseSwgYnV0IGNsaWVudCB1dWlkcyBhcmUgbm90IGNydWNpYWwuXG5cdFx0Y29uc3QgbmV3VXVpZCA9IHV1aWR2NCgpO1xuXHRcdGF3YWl0IHNldFN0b3JhZ2VJdGVtPHN0cmluZz4oS2V5cy5DbGllbnRVdWlkLCBuZXdVdWlkKTtcblx0XHRyZXR1cm4gbmV3VXVpZDtcblx0fSxcblxuXHRnZXRFbWFpbDogYXN5bmMgKCkgPT4gKGF3YWl0IGdldFN0b3JhZ2VJdGVtPHN0cmluZz4oS2V5cy5FbWFpbCkpID8/IGRlZmF1bHRzLmVtYWlsLFxuXHRzZXRFbWFpbDogYXN5bmMgKGVtYWlsOiBzdHJpbmcpID0+IGF3YWl0IHNldFN0b3JhZ2VJdGVtPHN0cmluZz4oS2V5cy5FbWFpbCwgZW1haWwpLFxuXG5cdGdldFRyYW5zbGF0aW9uTW9kZWw6IGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB0cmFuc2xhdGlvbk1vZGVsID0gYXdhaXQgZ2V0U3RvcmFnZUl0ZW08VHJhbnNsYXRpb25Nb2RlbD4oS2V5cy5UcmFuc2xhdGlvbk1vZGVsKTtcblx0XHRpZiAoIXRyYW5zbGF0aW9uTW9kZWwpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRyYW5zbGF0aW9uTW9kZWw7XG5cdH0sXG5cdHNldFRyYW5zbGF0aW9uTW9kZWw6IGFzeW5jIChtb2RlbDogVHJhbnNsYXRpb25Nb2RlbCkgPT5cblx0XHRhd2FpdCBzZXRTdG9yYWdlSXRlbTxzdHJpbmc+KEtleXMuVHJhbnNsYXRpb25Nb2RlbCwgbW9kZWwpLFxuXG5cdC8vIFJldHVybnMgdGhlIGxhbmd1YWdlIGNvZGUgb2YgdGhlIGxhbmd1YWdlIHRvIHRyYW5zbGF0ZSB0by4gRWcgJ2VuJywgJ2phJywgJ3poLUNOJywgLi5cblx0Z2V0VHJhbnNsYXRlVG9MYW5ndWFnZTogYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHRyYW5zbGF0ZVRvTGFuZ3VhZ2UgPSBhd2FpdCBnZXRTdG9yYWdlSXRlbTxMYW5ndWFnZUNvZGU+KEtleXMuVHJhbnNsYXRlVG9MYW5ndWFnZSk7XG5cblx0XHRpZiAoIXRyYW5zbGF0ZVRvTGFuZ3VhZ2UpIHtcblx0XHRcdHJldHVybiBnZXREZWZhdWx0TGFuZ3VhZ2UoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJhbnNsYXRlVG9MYW5ndWFnZTtcblx0fSxcblx0c2V0VHJhbnNsYXRlVG9MYW5ndWFnZTogYXN5bmMgKGxhbmd1YWdlQ29kZTogTGFuZ3VhZ2VDb2RlKSA9PiB7XG5cdFx0aWYgKCFsYW5ndWFnZUNvZGVzLmluY2x1ZGVzKGxhbmd1YWdlQ29kZSkpIHtcblx0XHRcdGNvbnNvbGUud2FybihgSW52YWxpZCBsYW5ndWFnZSBjb2RlOiAke2xhbmd1YWdlQ29kZX0uIE92ZXJ3cml0aW5nIHdpdGggZGVmYXVsdC5gKTtcblx0XHRcdGxhbmd1YWdlQ29kZSA9IGdldERlZmF1bHRMYW5ndWFnZSgpO1xuXHRcdH1cblxuXHRcdHJldHVybiBhd2FpdCBzZXRTdG9yYWdlSXRlbTxMYW5ndWFnZUNvZGU+KEtleXMuVHJhbnNsYXRlVG9MYW5ndWFnZSwgbGFuZ3VhZ2VDb2RlKTtcblx0fSxcblx0Z2V0VUlGb250RmFtaWx5OiAoKSA9PiB7XG5cdFx0Y29uc3QgbGFuZ3VhZ2UgPSBuYXZpZ2F0b3IubGFuZ3VhZ2Uuc3BsaXQoJy0nKVswXTtcblx0XHRzd2l0Y2ggKGxhbmd1YWdlKSB7XG5cdFx0XHQvLyBObyBmb250IGZpbGUgYXQgdGhlIG1vbWVudCBmb3IgdGhlc2U6IHVzZSB3aGF0ZXZlciB0aGUgZGVmYXVsdCBmb250IGlzLlxuXHRcdFx0Y2FzZSAnaGknOlxuXHRcdFx0Y2FzZSAndGgnOlxuXHRcdFx0Y2FzZSAnamEnOlxuXHRcdFx0Y2FzZSAna28nOlxuXHRcdFx0Y2FzZSAnemgnOlxuXHRcdFx0Y2FzZSAndmknOlxuXHRcdFx0Y2FzZSAnYXInOlxuXHRcdFx0XHRyZXR1cm4gJ3N5c3RlbS1kZWZhdWx0Jztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiAnUGF0cmlja0hhbmQtUmVndWxhcic7XG5cdFx0fVxuXHR9LFxuXG5cdGdldEZvbnRGYW1pbHk6IGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmb250RmFtaWx5ID0gKGF3YWl0IGdldFN0b3JhZ2VJdGVtPHN0cmluZz4oS2V5cy5Gb250RmFtaWx5KSkgPz8gZGVmYXVsdHMuZm9udEZhbWlseTtcblx0XHRjb25zdCBsYW5ndWFnZSA9IGF3YWl0IGFwcENvbmZpZy5nZXRUcmFuc2xhdGVUb0xhbmd1YWdlKCk7XG5cdFx0c3dpdGNoIChsYW5ndWFnZSkge1xuXHRcdFx0Ly8gVGhlc2UgbGFuZ3VhZ2VzIGFyZSB1bnN1cHBvcnRlZCBmb3IgdGhlIHVzdWFsIGZvbnQgb3B0aW9ucy5cblx0XHRcdGNhc2UgJ2hpJzpcblx0XHRcdGNhc2UgJ3RoJzpcblx0XHRcdGNhc2UgJ2phJzpcblx0XHRcdGNhc2UgJ2tvJzpcblx0XHRcdGNhc2UgJ3poLUNOJzpcblx0XHRcdGNhc2UgJ3poLVRXJzpcblx0XHRcdGNhc2UgJ3ZpJzpcblx0XHRcdGNhc2UgJ2FyJzpcblx0XHRcdFx0cmV0dXJuICdzeXN0ZW0tZGVmYXVsdCc7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRyZXR1cm4gZm9udEZhbWlseTtcblx0XHR9XG5cdH0sXG5cdHNldEZvbnRGYW1pbHk6IGFzeW5jIChmb250RmFtaWx5OiBzdHJpbmcpID0+XG5cdFx0YXdhaXQgc2V0U3RvcmFnZUl0ZW08c3RyaW5nPihLZXlzLkZvbnRGYW1pbHksIGZvbnRGYW1pbHkpLFxuXG5cdGdldEZvbnRDb2xvcjogYXN5bmMgKCkgPT4gKGF3YWl0IGdldFN0b3JhZ2VJdGVtPHN0cmluZz4oS2V5cy5Gb250Q29sb3IpKSA/PyBkZWZhdWx0cy5mb250Q29sb3IsXG5cdHNldEZvbnRDb2xvcjogYXN5bmMgKGZvbnRDb2xvcjogc3RyaW5nKSA9PlxuXHRcdGF3YWl0IHNldFN0b3JhZ2VJdGVtPHN0cmluZz4oS2V5cy5Gb250Q29sb3IsIGZvbnRDb2xvciksXG5cblx0Z2V0Rm9udFdlaWdodDogYXN5bmMgKCkgPT5cblx0XHQoYXdhaXQgZ2V0U3RvcmFnZUl0ZW08c3RyaW5nPihLZXlzLkZvbnRXZWlnaHQpKSA/PyBkZWZhdWx0cy5mb250V2VpZ2h0LFxuXHRzZXRGb250V2VpZ2h0OiBhc3luYyAoZm9udFdlaWdodDogc3RyaW5nKSA9PlxuXHRcdGF3YWl0IHNldFN0b3JhZ2VJdGVtPHN0cmluZz4oS2V5cy5Gb250V2VpZ2h0LCBmb250V2VpZ2h0KSxcblxuXHRnZXRBY3RpdmVVcmxzOiBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaGFzSW5pdERlZmF1bHRzID0gYXdhaXQgZ2V0U3RvcmFnZUl0ZW08Ym9vbGVhbj4oaGFzSW5pdEFjdGl2ZVVybERlZmF1bHRzKTtcblx0XHRpZiAoIWhhc0luaXREZWZhdWx0cykge1xuXHRcdFx0YXdhaXQgc2V0U3RvcmFnZUl0ZW08c3RyaW5nW10+KEtleXMuQWN0aXZlVXJscywgY29tbW9uTWFuZ2FTaXRlcyk7XG5cdFx0XHRhd2FpdCBzZXRTdG9yYWdlSXRlbTxib29sZWFuPihoYXNJbml0QWN0aXZlVXJsRGVmYXVsdHMsIHRydWUpO1xuXHRcdH1cblxuXHRcdHJldHVybiAoYXdhaXQgZ2V0U3RvcmFnZUl0ZW08c3RyaW5nW10+KEtleXMuQWN0aXZlVXJscykpID8/IFtdO1xuXHR9LFxuXHRhZGRBY3RpdmVVcmw6IGFzeW5jIChhY3RpdmVVcmw6IHN0cmluZykgPT4ge1xuXHRcdGNvbnN0IGhhc0luaXREZWZhdWx0cyA9IGF3YWl0IGdldFN0b3JhZ2VJdGVtPGJvb2xlYW4+KGhhc0luaXRBY3RpdmVVcmxEZWZhdWx0cyk7XG5cdFx0aWYgKCFoYXNJbml0RGVmYXVsdHMpIHtcblx0XHRcdGF3YWl0IHNldFN0b3JhZ2VJdGVtPHN0cmluZ1tdPihLZXlzLkFjdGl2ZVVybHMsIGNvbW1vbk1hbmdhU2l0ZXMpO1xuXHRcdFx0YXdhaXQgc2V0U3RvcmFnZUl0ZW08Ym9vbGVhbj4oaGFzSW5pdEFjdGl2ZVVybERlZmF1bHRzLCB0cnVlKTtcblx0XHR9XG5cblx0XHRjb25zdCBhY3RpdmVVcmxzID0gKGF3YWl0IGdldFN0b3JhZ2VJdGVtPHN0cmluZ1tdPihLZXlzLkFjdGl2ZVVybHMpKSA/PyBbXTtcblx0XHRyZXR1cm4gYXdhaXQgc2V0U3RvcmFnZUl0ZW08c3RyaW5nW10+KEtleXMuQWN0aXZlVXJscywgWy4uLmFjdGl2ZVVybHMsIGFjdGl2ZVVybF0pO1xuXHR9LFxuXHRyZW1vdmVBY3RpdmVVcmw6IGFzeW5jIChhY3RpdmVVcmw6IHN0cmluZykgPT4ge1xuXHRcdGNvbnN0IGhhc0luaXREZWZhdWx0cyA9IGF3YWl0IGdldFN0b3JhZ2VJdGVtPGJvb2xlYW4+KGhhc0luaXRBY3RpdmVVcmxEZWZhdWx0cyk7XG5cdFx0aWYgKCFoYXNJbml0RGVmYXVsdHMpIHtcblx0XHRcdGF3YWl0IHNldFN0b3JhZ2VJdGVtPHN0cmluZ1tdPihLZXlzLkFjdGl2ZVVybHMsIGNvbW1vbk1hbmdhU2l0ZXMpO1xuXHRcdFx0YXdhaXQgc2V0U3RvcmFnZUl0ZW08Ym9vbGVhbj4oaGFzSW5pdEFjdGl2ZVVybERlZmF1bHRzLCB0cnVlKTtcblx0XHR9XG5cblx0XHRjb25zdCBhY3RpdmVVcmxzID0gKGF3YWl0IGdldFN0b3JhZ2VJdGVtPHN0cmluZ1tdPihLZXlzLkFjdGl2ZVVybHMpKSA/PyBbXTtcblx0XHRyZXR1cm4gYXdhaXQgc2V0U3RvcmFnZUl0ZW08c3RyaW5nW10+KFxuXHRcdFx0S2V5cy5BY3RpdmVVcmxzLFxuXHRcdFx0YWN0aXZlVXJscy5maWx0ZXIodXJsID0+IHVybCAhPT0gYWN0aXZlVXJsKVxuXHRcdCk7XG5cdH1cbn0pO1xuIiwiLy8gTW9kdWxlIGZvciBtYWtpbmcgd29ya2luZyB3aXRoIHRoZSBDaHJvbWUgQVBJIGVhc2llci5cbi8vIFRoaXMgbWF5IGluY2x1ZGUgbWFraW5nIHRoZSBBUEkgYXN5bmMsIHNpbXBsaWZ5aW5nIHRoZSBpbnRlcmZhY2UsIG9yIG1vcmUuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q3VycmVudFRhYigpOiBQcm9taXNlPFxuXHQoY2hyb21lLnRhYnMuVGFiICYgeyBnZXRIb3N0TmFtZTogKCkgPT4gc3RyaW5nIH0pIHwgdW5kZWZpbmVkXG4+IHtcblx0cmV0dXJuIG5ldyBQcm9taXNlPChjaHJvbWUudGFicy5UYWIgJiB7IGdldEhvc3ROYW1lOiAoKSA9PiBzdHJpbmcgfSkgfCB1bmRlZmluZWQ+KHJlc29sdmUgPT4ge1xuXHRcdGNocm9tZS50YWJzLnF1ZXJ5KHsgY3VycmVudFdpbmRvdzogdHJ1ZSwgYWN0aXZlOiB0cnVlIH0sIGZ1bmN0aW9uICh0YWJzKSB7XG5cdFx0XHRpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKSB7XG5cdFx0XHRcdHJlc29sdmUodW5kZWZpbmVkKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjdXJyZW50VGFiOiBhbnkgPSB0YWJzWzBdO1xuXHRcdFx0aWYgKCFjdXJyZW50VGFiPy51cmwpIHtcblx0XHRcdFx0cmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGN1cnJlbnRUYWIuZ2V0SG9zdE5hbWUgPSAoKSA9PiB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBVUkwoY3VycmVudFRhYi51cmwpLmhvc3RuYW1lO1xuXHRcdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0XHRyZXR1cm4gJyc7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRyZXNvbHZlKGN1cnJlbnRUYWIpO1xuXHRcdH0pO1xuXHR9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVwZGF0ZVNlc3Npb25IZWFkZXJzKHJ1bGVPcHRpb25zOiBjaHJvbWUuZGVjbGFyYXRpdmVOZXRSZXF1ZXN0LlVwZGF0ZVJ1bGVPcHRpb25zKSB7XG5cdHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHRjaHJvbWUuZGVjbGFyYXRpdmVOZXRSZXF1ZXN0LnVwZGF0ZVNlc3Npb25SdWxlcyhydWxlT3B0aW9ucywgcmVzb2x2ZSk7XG5cdH0pO1xufVxuXG4vLyBXaW5kb3cgSUQgb2YgdGFiIHRvIGNhcHR1cmUsIGVnIGdldEN1cnJlbnRUYWIoKS53aW5kb3dJZDtcbmV4cG9ydCBmdW5jdGlvbiBjYXB0dXJlVmlzaWJsZVRhYih3aW5kb3dJZDogbnVtYmVyKSB7XG5cdHJldHVybiBuZXcgUHJvbWlzZTxzdHJpbmc+KHJlc29sdmUgPT5cblx0XHRjaHJvbWUudGFicy5jYXB0dXJlVmlzaWJsZVRhYih3aW5kb3dJZCwgeyBmb3JtYXQ6ICdwbmcnIH0sIHJlc29sdmUpXG5cdCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRab29tRmFjdG9yKHRhYklkOiBudW1iZXIpOiBQcm9taXNlPG51bWJlcj4ge1xuXHRyZXR1cm4gbmV3IFByb21pc2U8bnVtYmVyPihyZXNvbHZlID0+IGNocm9tZS50YWJzLmdldFpvb20odGFiSWQsIHJlc29sdmUpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldEV4dGVuc2lvbkljb24oaWNvbjogY2hyb21lLmJyb3dzZXJBY3Rpb24uVGFiSWNvbkRldGFpbHMpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0cmV0dXJuIG5ldyBQcm9taXNlPGJvb2xlYW4+KHJlc29sdmUgPT4ge1xuXHRcdGNocm9tZS5hY3Rpb24uc2V0SWNvbihpY29uLCAoKSA9PiB7XG5cdFx0XHRyZXNvbHZlKHRydWUpO1xuXHRcdH0pO1xuXHR9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGV4ZWN1dGVTY3JpcHQoXG5cdHRhYklkOiBudW1iZXIsXG5cdGZpbGVQYXRoOiBzdHJpbmcsXG5cdGFsbEZyYW1lcz86IGJvb2xlYW5cbik6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRyZXR1cm4gbmV3IFByb21pc2U8Ym9vbGVhbj4ocmVzb2x2ZSA9PiB7XG5cdFx0Y2hyb21lLnNjcmlwdGluZy5leGVjdXRlU2NyaXB0KFxuXHRcdFx0eyB0YXJnZXQ6IHsgdGFiSWQsIGFsbEZyYW1lczogYWxsRnJhbWVzID8/IHRydWUgfSwgZmlsZXM6IFtmaWxlUGF0aF0gfSxcblx0XHRcdCgpID0+IHtcblx0XHRcdFx0cmVzb2x2ZSh0cnVlKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzQWxsb3dlZEZpbGVTY2hlbWVBY2Nlc3MoKSB7XG5cdHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHRjaHJvbWUuZXh0ZW5zaW9uLmlzQWxsb3dlZEZpbGVTY2hlbWVBY2Nlc3MocmVzb2x2ZSk7XG5cdH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcG9zdEJhY2tncm91bmRNZXNzYWdlKG1lc3NhZ2U6IGFueSk6IGFueSB7XG5cdGNvbnN0IGV4dGVuc2lvbklkID0gdW5kZWZpbmVkOyAvLyB1bmRlZmluZWQgbWVhbnMgc2VuZCB0byBzZWxmLCBpbnN0ZWFkIG9mIGFub3RoZXIgZXh0ZW5zaW9uLlxuXHRjb25zdCBvcHRpb25zID0gdW5kZWZpbmVkO1xuXG5cdHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHRjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZShleHRlbnNpb25JZCwgbWVzc2FnZSwgb3B0aW9ucywgcmVzb2x2ZSk7XG5cdH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0U3RvcmFnZUl0ZW08VD4oa2V5OiBzdHJpbmcpOiBQcm9taXNlPFQgfCB1bmRlZmluZWQ+IHtcblx0Y29uc3QgZm9ybWF0dGVkS2V5ID0gZm9ybWF0S2V5KGtleSk7XG5cdHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHR0cnkge1xuXHRcdFx0Y2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KFtmb3JtYXR0ZWRLZXldLCBmdW5jdGlvbiAocmVzdWx0KSB7XG5cdFx0XHRcdHJlc29sdmUocmVzdWx0W2Zvcm1hdHRlZEtleV0pO1xuXHRcdFx0fSk7XG5cdFx0fSBjYXRjaCB7XG5cdFx0XHQvLyBEbyBub3RoaW5nIGlmIGNhY2hlIGZhaWxzLlxuXHRcdFx0cmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdH1cblx0fSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRTdG9yYWdlSXRlbTxUPihrZXk6IHN0cmluZywgdmFsdWU6IFQpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0Y29uc3QgZm9ybWF0dGVkS2V5ID0gZm9ybWF0S2V5KGtleSk7XG5cdHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHR0cnkge1xuXHRcdFx0Y2hyb21lLnN0b3JhZ2UubG9jYWwuc2V0KHsgW2Zvcm1hdHRlZEtleV06IHZhbHVlIH0sICgpID0+IHtcblx0XHRcdFx0cmVzb2x2ZSh0cnVlKTtcblx0XHRcdH0pO1xuXHRcdH0gY2F0Y2gge1xuXHRcdFx0Ly8gRG8gbm90aGluZyBpZiBjYWNoZSBmYWlscy5cblx0XHRcdHJlc29sdmUoZmFsc2UpO1xuXHRcdH1cblx0fSk7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdEtleShrZXk6IHN0cmluZykge1xuXHRjb25zdCBrZXlQcmVmaXggPSAnYXBwJztcblx0cmV0dXJuIGAke2tleVByZWZpeH0tJHtrZXl9YDtcbn1cbiIsImltcG9ydCB7IFRyYW5zbGF0aW9uUmVzdWx0IH0gZnJvbSAnLi90cmFuc2xhdGlvbic7XG5pbXBvcnQgeyBhcHBDb25maWcgfSBmcm9tICcuL2FwcENvbmZpZyc7XG5pbXBvcnQgeyBMYW5ndWFnZUNvZGUgfSBmcm9tICcuL2xvY2FsZXMnO1xuaW1wb3J0IHsgVHJhbnNsYXRpb25Nb2RlbCB9IGZyb20gJy4vbW9kZWxzJztcblxuLy8gSWYgc2V0IHRvIHRydWUsIHVzZSBsb2NhbCBpbXBsZW1lbnRhdGlvbnMgYW5kIHR1cm4gb24gbG9nZ2luZy5cbmNvbnN0IGlzRGVidWcgPSBmYWxzZTtcbmV4cG9ydCBjb25zdCBiYXNlVXJsID0gaXNEZWJ1ZyA/ICdodHRwOi8vbG9jYWxob3N0OjgwODAnIDogJ2h0dHBzOi8vaWNoaWdvcmVhZGVyLmNvbSc7XG5cbmVudW0gU3RhdHVzQ29kZSB7XG5cdE9rID0gMjAwLFxuXHRDcmVhdGVkID0gMjAxLFxuXHROb0NvbnRlbnQgPSAyMDQsXG5cdEJhZFJlcXVlc3QgPSA0MDAsXG5cdEZvcmJpZGRlbiA9IDQwMyxcblx0Tm90Rm91bmQgPSA0MDQsXG5cdFRvb01hbnlSZXF1ZXN0cyA9IDQyOSxcblx0SW50ZXJuYWxTZXJ2ZXJFcnJvciA9IDUwMFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFVzZXIge1xuXHRlbWFpbD86IHN0cmluZzsgLy8gVW5yZWdpc3RlcmVkIHVzZXJzIGhhdmUgbm8gZW1haWwuIFRoZXkgYXJlIHRyYWNrZWQgYnkgSVAuXG5cdHN1YnNjcmlwdGlvblRpZXI6ICdmcmVlJyB8ICd0aWVyLTEnIHwgJ3RpZXItMic7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRDdXJyZW50VXNlcigpOiBQcm9taXNlPFVzZXI+IHtcblx0Y29uc3QgY2xpZW50VXVpZCA9IGF3YWl0IGFwcENvbmZpZy5nZXRDbGllbnRVdWlkKCk7XG5cdGNvbnN0IHJlcXVlc3QgPSBhd2FpdCBmZXRjaChcblx0XHRgJHtiYXNlVXJsfS9tZXRyaWNzP2NsaWVudFV1aWQ9JHtjbGllbnRVdWlkfSZmaW5nZXJwcmludD0ke2dldEZpbmdlcnByaW50KCl9YCxcblx0XHR7XG5cdFx0XHRtZXRob2Q6ICdHRVQnLFxuXHRcdFx0aGVhZGVyczoge1xuXHRcdFx0XHQnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuXHRcdFx0XHQvLyBVc2UgdGhlIG5ldyBzdWJzY3JpcHRpb24gdHlwZXMuXG5cdFx0XHRcdCdDbGllbnQtVmVyc2lvbic6ICcxLjAuMSdcblx0XHRcdH1cblx0XHR9XG5cdCk7XG5cblx0aWYgKHJlcXVlc3Quc3RhdHVzICE9PSBTdGF0dXNDb2RlLk9rKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcmV0cmlldmUgdXNlci4nKTtcblx0fVxuXG5cdHJldHVybiAoYXdhaXQgcmVxdWVzdC5qc29uKCkpIGFzIHtcblx0XHRlbWFpbD86IHN0cmluZztcblx0XHRzdWJzY3JpcHRpb25UaWVyOiAnZnJlZScgfCAndGllci0xJyB8ICd0aWVyLTInO1xuXHR9O1xufVxuXG5leHBvcnQgZW51bSBMb2dpblN0YXR1cyB7XG5cdFVua25vd24sIC8vIFZhcmlvdXMgbmV0d29yayBlcnJvcnMsIGlmIHNlcnZlciBpcyBvbiBoaWdoIGxvYWQsIGV0Yy4gTm90IHdvcnRoIGhhbmRsaW5nIGF0IHRoaXMgdGltZS5cblx0VW5rbm93bkVtYWlsLFxuXHRCYWRQYXNzd29yZCxcblx0SW52YWxpZEVtYWlsLFxuXHRTdWNjZXNzXG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2dpbihlbWFpbDogc3RyaW5nLCBwYXNzd29yZDogc3RyaW5nKTogUHJvbWlzZTxMb2dpblN0YXR1cz4ge1xuXHRjb25zdCByZXF1ZXN0ID0gYXdhaXQgZmV0Y2goYCR7YmFzZVVybH0vYXV0aC9sb2dpbmAsIHtcblx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRoZWFkZXJzOiB7XG5cdFx0XHQnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG5cdFx0fSxcblx0XHRib2R5OiBKU09OLnN0cmluZ2lmeSh7IGVtYWlsLCBwYXNzd29yZCB9KVxuXHR9KTtcblxuXHRpZiAocmVxdWVzdC5zdGF0dXMgPT09IFN0YXR1c0NvZGUuQmFkUmVxdWVzdCkge1xuXHRcdGNvbnN0IGpzb24gPSBhd2FpdCByZXF1ZXN0Lmpzb24oKTtcblx0XHRzd2l0Y2ggKGpzb24uZGV0YWlsLmtpbmQpIHtcblx0XHRcdGNhc2UgJ2VtcHR5RW1haWwnOlxuXHRcdFx0XHRyZXR1cm4gTG9naW5TdGF0dXMuSW52YWxpZEVtYWlsO1xuXHRcdFx0Y2FzZSAndXNlck5vdEZvdW5kJzpcblx0XHRcdFx0cmV0dXJuIExvZ2luU3RhdHVzLlVua25vd25FbWFpbDtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBMb2dpblN0YXR1cy5Vbmtub3duO1xuXHRcdH1cblx0fVxuXG5cdGlmIChyZXF1ZXN0LnN0YXR1cyA9PT0gU3RhdHVzQ29kZS5Gb3JiaWRkZW4pIHtcblx0XHRyZXR1cm4gTG9naW5TdGF0dXMuQmFkUGFzc3dvcmQ7XG5cdH1cblxuXHRyZXR1cm4gcmVxdWVzdC5zdGF0dXMgPT09IFN0YXR1c0NvZGUuT2sgPyBMb2dpblN0YXR1cy5TdWNjZXNzIDogTG9naW5TdGF0dXMuVW5rbm93bjtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvZ291dCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0Y29uc3QgcmVxdWVzdCA9IGF3YWl0IGZldGNoKGAke2Jhc2VVcmx9L2F1dGgvbG9nb3V0YCwge1xuXHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdGhlYWRlcnM6IHtcblx0XHRcdCdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcblx0XHR9XG5cdH0pO1xuXG5cdHJldHVybiByZXF1ZXN0LnN0YXR1cyA9PT0gU3RhdHVzQ29kZS5Ob0NvbnRlbnQ7XG59XG5cbmV4cG9ydCBlbnVtIFNpZ251cFN0YXR1cyB7XG5cdFVua25vd24sIC8vIFZhcmlvdXMgbmV0d29yayBlcnJvcnMsIGlmIHNlcnZlciBpcyBvbiBoaWdoIGxvYWQsIGV0Yy4gTm90IHdvcnRoIGhhbmRsaW5nIGF0IHRoaXMgdGltZS5cblx0U3VjY2Vzcyxcblx0RW1haWxUYWtlblxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2lnbnVwKGVtYWlsOiBzdHJpbmcsIHBhc3N3b3JkOiBzdHJpbmcpOiBQcm9taXNlPFNpZ251cFN0YXR1cz4ge1xuXHRjb25zdCByZXF1ZXN0ID0gYXdhaXQgZmV0Y2goYCR7YmFzZVVybH0vc2lnbnVwYCwge1xuXHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdGhlYWRlcnM6IHtcblx0XHRcdCdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcblx0XHR9LFxuXHRcdGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgZW1haWwsIHBhc3N3b3JkIH0pXG5cdH0pO1xuXG5cdGlmIChyZXF1ZXN0LnN0YXR1cyA9PT0gU3RhdHVzQ29kZS5Gb3JiaWRkZW4pIHtcblx0XHRyZXR1cm4gU2lnbnVwU3RhdHVzLkVtYWlsVGFrZW47XG5cdH1cblxuXHRyZXR1cm4gcmVxdWVzdC5zdGF0dXMgPT09IFN0YXR1c0NvZGUuQ3JlYXRlZCA/IFNpZ251cFN0YXR1cy5TdWNjZXNzIDogU2lnbnVwU3RhdHVzLlVua25vd247XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzdWJtaXRGZWVkYmFjayh0ZXh0OiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0Y29uc3QgcmVxdWVzdCA9IGF3YWl0IGZldGNoKGAke2Jhc2VVcmx9L2ZlZWRiYWNrYCwge1xuXHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdGhlYWRlcnM6IHtcblx0XHRcdCdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcblx0XHR9LFxuXHRcdGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgdGV4dCB9KVxuXHR9KTtcblxuXHRyZXR1cm4gcmVxdWVzdC5zdGF0dXMgPT09IFN0YXR1c0NvZGUuQ3JlYXRlZDtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHRyYW5zbGF0ZUltYWdlKFxuXHR0cmFuc2xhdGVUbzogTGFuZ3VhZ2VDb2RlLFxuXHRiYXNlNjRJbWFnZTogc3RyaW5nLFxuXHR0cmFuc2xhdGlvbk1vZGVsPzogVHJhbnNsYXRpb25Nb2RlbFxuKTogUHJvbWlzZTx7IHRyYW5zbGF0aW9uczogVHJhbnNsYXRpb25SZXN1bHRbXTsgZXJyb3JNZXNzYWdlPzogc3RyaW5nIH0+IHtcblx0Y29uc3QgY2xpZW50VXVpZCA9IGF3YWl0IGFwcENvbmZpZy5nZXRDbGllbnRVdWlkKCk7XG5cdGNvbnN0IHJlcXVlc3QgPSBhd2FpdCBmZXRjaChgJHtiYXNlVXJsfS90cmFuc2xhdGVgLCB7XG5cdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0aGVhZGVyczoge1xuXHRcdFx0J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xuXHRcdH0sXG5cdFx0Ym9keTogSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0YmFzZTY0SW1hZ2VzOiBbYmFzZTY0SW1hZ2VdLFxuXHRcdFx0dHJhbnNsYXRpb25Nb2RlbCxcblx0XHRcdHRhcmdldExhbmdDb2RlOiB0cmFuc2xhdGVUbyxcblx0XHRcdGZpbmdlcnByaW50OiBnZXRGaW5nZXJwcmludCgpLFxuXHRcdFx0Y2xpZW50VXVpZFxuXHRcdH0pXG5cdH0pO1xuXG5cdGlmIChyZXF1ZXN0LnN0YXR1cyA9PT0gU3RhdHVzQ29kZS5JbnRlcm5hbFNlcnZlckVycm9yKSB7XG5cdFx0Y29uc3QgZXJyb3JNZXNzYWdlID0gJ1NlcnZlciBpcyBkb3duIG9yIGV4cGVyaWVuY2luZyBpc3N1ZXMuIFNvcnJ5IGZvciB0aGUgaW5jb252ZW5pZW5jZS4nO1xuXHRcdHJldHVybiB7XG5cdFx0XHRlcnJvck1lc3NhZ2UsXG5cdFx0XHR0cmFuc2xhdGlvbnM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG9yaWdpbmFsTGFuZ3VhZ2U6ICdVbmtub3duJyxcblx0XHRcdFx0XHR0cmFuc2xhdGVkVGV4dDogZXJyb3JNZXNzYWdlLFxuXHRcdFx0XHRcdG1pblg6IDAsXG5cdFx0XHRcdFx0bWluWTogMCxcblx0XHRcdFx0XHRtYXhYOiAyMDAsXG5cdFx0XHRcdFx0bWF4WTogMjAwXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9O1xuXHR9XG5cblx0aWYgKHJlcXVlc3Quc3RhdHVzID09PSBTdGF0dXNDb2RlLlRvb01hbnlSZXF1ZXN0cykge1xuXHRcdGNvbnN0IGVycm9yTWVzc2FnZSA9ICdPdXQgb2YgdHJhbnNsYXRpb25zLiBTZXJ2ZXIgY29zdHMgYXJlIGV4cGVuc2l2ZS4gVXBncmFkZSBmb3IgbW9yZSEnO1xuXHRcdHJldHVybiB7XG5cdFx0XHRlcnJvck1lc3NhZ2UsXG5cdFx0XHR0cmFuc2xhdGlvbnM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG9yaWdpbmFsTGFuZ3VhZ2U6ICdVbmtub3duJyxcblx0XHRcdFx0XHR0cmFuc2xhdGVkVGV4dDogZXJyb3JNZXNzYWdlLFxuXHRcdFx0XHRcdG1pblg6IDAsXG5cdFx0XHRcdFx0bWluWTogMCxcblx0XHRcdFx0XHRtYXhYOiAyMDAsXG5cdFx0XHRcdFx0bWF4WTogMjAwXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9O1xuXHR9XG5cblx0Y29uc3QgcmVzdWx0cyA9IGF3YWl0IHJlcXVlc3QuanNvbigpO1xuXG5cdHJldHVybiB7XG5cdFx0dHJhbnNsYXRpb25zOiByZXN1bHRzLmltYWdlc1swXSBhcyBUcmFuc2xhdGlvblJlc3VsdFtdXG5cdH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWJ1ZyhtZXNzYWdlKSB7XG5cdGlmIChpc0RlYnVnKSB7XG5cdFx0Y29uc29sZS5sb2cobWVzc2FnZSk7XG5cdH1cbn1cblxubGV0IGZpbmdlcnByaW50OiBzdHJpbmcgPSBudWxsOyAvLyBEbyBub3QgYWNjZXNzIHRoaXMgZGlyZWN0bHksIHVzZSBnZXRGaW5nZXJwcmludCgpLlxuZnVuY3Rpb24gZ2V0RmluZ2VycHJpbnQoKSB7XG5cdGlmIChmaW5nZXJwcmludCkge1xuXHRcdHJldHVybiBmaW5nZXJwcmludDtcblx0fVxuXG5cdC8vIEluaXRpYWxpemUgZmluZ2VycHJpbnQuXG5cdGNvbnN0IHdlYkdsUmVuZGVyZXIgPSBnZXRXZWJHbFJlbmRlcmVyKCk7XG5cdGNvbnN0IGhhcmR3YXJlID0gZ2V0SGFyZHdhcmUoKTtcblx0Y29uc3QgY29ubmVjdGlvblN0cmluZyA9IGdldENvbm5lY3Rpb25TdHJpbmcoKTtcblx0Y29uc3QgdGltZXpvbmVDb2RlID0gbmV3IERhdGUoKS5nZXRUaW1lem9uZU9mZnNldCgpO1xuXHRmaW5nZXJwcmludCA9IGJ0b2EoYCR7d2ViR2xSZW5kZXJlcn0tJHtoYXJkd2FyZX0tJHtjb25uZWN0aW9uU3RyaW5nfS0ke3RpbWV6b25lQ29kZX1gKTtcblxuXHRyZXR1cm4gZmluZ2VycHJpbnQ7XG59XG5cbmZ1bmN0aW9uIGdldFdlYkdsUmVuZGVyZXIoKSB7XG5cdGNvbnN0IGdsID0gbmV3IE9mZnNjcmVlbkNhbnZhcygwLCAwKS5nZXRDb250ZXh0KCd3ZWJnbCcpO1xuXHRpZiAoIWdsKSB7XG5cdFx0cmV0dXJuICdub25lJztcblx0fVxuXHRjb25zdCBkZWJ1Z0luZm8gPSBnbC5nZXRFeHRlbnNpb24oJ1dFQkdMX2RlYnVnX3JlbmRlcmVyX2luZm8nKTtcblx0cmV0dXJuIGRlYnVnSW5mbyA/IGdsLmdldFBhcmFtZXRlcihkZWJ1Z0luZm8uVU5NQVNLRURfUkVOREVSRVJfV0VCR0wpIDogJ3Vua25vd24nO1xufVxuXG5mdW5jdGlvbiBnZXRIYXJkd2FyZSgpIHtcblx0Y29uc3QgaGFyZHdhcmVDb25jdXJyZW5jeSA9IG5hdmlnYXRvcj8uaGFyZHdhcmVDb25jdXJyZW5jeTtcblx0Y29uc3QgZGV2aWNlTWVtb3J5ID0gbmF2aWdhdG9yWydkZXZpY2VNZW1vcnknXTtcblx0cmV0dXJuIGAke2hhcmR3YXJlQ29uY3VycmVuY3l9LSR7ZGV2aWNlTWVtb3J5fWA7XG59XG5cbmZ1bmN0aW9uIGdldENvbm5lY3Rpb25TdHJpbmcoKSB7XG5cdGNvbnN0IHR5cGUgPSBuYXZpZ2F0b3JbJ2Nvbm5lY3Rpb24nXT8udHlwZTtcblx0Y29uc3QgcnR0ID0gbmF2aWdhdG9yWydjb25uZWN0aW9uJ10/LnJ0dDtcblx0Y29uc3QgZG93bmxpbmtNYXggPSBuYXZpZ2F0b3JbJ2Nvbm5lY3Rpb24nXT8uZG93bmxpbmtNYXg7XG5cdGNvbnN0IGVmZmVjdGl2ZVR5cGUgPSBuYXZpZ2F0b3JbJ2Nvbm5lY3Rpb24nXT8uZWZmZWN0aXZlVHlwZTtcblx0Y29uc3Qgc2F2ZURhdGEgPSBuYXZpZ2F0b3JbJ2Nvbm5lY3Rpb24nXT8uc2F2ZURhdGE7XG5cdHJldHVybiBgJHt0eXBlfS0ke3J0dH0tJHtkb3dubGlua01heH0tJHtlZmZlY3RpdmVUeXBlfS0ke3NhdmVEYXRhfWA7XG59XG4iLCJjb25zdCBtID0gY2hyb21lLmkxOG4uZ2V0TWVzc2FnZTtcblxuLy8gU3VwcG9ydGVkIGxhbmd1YWdlIGNvZGVzLlxuZXhwb3J0IHR5cGUgTGFuZ3VhZ2VDb2RlID1cblx0fCAnYXInXG5cdHwgJ2RlJ1xuXHR8ICdlbidcblx0fCAnZXMnXG5cdHwgJ2ZyJ1xuXHR8ICdoaSdcblx0fCAnaWQnXG5cdHwgJ2l0J1xuXHR8ICdqYSdcblx0fCAna28nXG5cdHwgJ3BsJ1xuXHR8ICdwdC1CUidcblx0fCAncHQtUFQnXG5cdHwgJ3J1J1xuXHR8ICd0aCdcblx0fCAndmknXG5cdHwgJ3poLUNOJ1xuXHR8ICd6aC1UVyc7XG5cbmV4cG9ydCBjb25zdCBsYW5ndWFnZUNvZGVzOiBMYW5ndWFnZUNvZGVbXSA9IFtcblx0J2FyJyxcblx0J2RlJyxcblx0J2VuJyxcblx0J2VzJyxcblx0J2ZyJyxcblx0J2hpJyxcblx0J2lkJyxcblx0J2l0Jyxcblx0J2phJyxcblx0J2tvJyxcblx0J3BsJyxcblx0J3B0LUJSJyxcblx0J3B0LVBUJyxcblx0J3J1Jyxcblx0J3RoJyxcblx0J3ZpJyxcblx0J3poLUNOJyxcblx0J3poLVRXJ1xuXTtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldERlZmF1bHRMYW5ndWFnZSgpOiBMYW5ndWFnZUNvZGUge1xuXHRjb25zdCBmdWxsTGFuZyA9IG5hdmlnYXRvci5sYW5ndWFnZTtcblxuXHRjb25zdCBzaG9ydExhbmcgPSBuYXZpZ2F0b3IubGFuZ3VhZ2Uuc3BsaXQoJy0nKVswXTtcblx0Y29uc3QgZmlyc3RTaG9ydExhbmcgPSBsYW5ndWFnZUNvZGVzLmZpbmQobGFuZyA9PiBsYW5nLnN0YXJ0c1dpdGgoc2hvcnRMYW5nKSk7XG5cblx0aWYgKGxhbmd1YWdlQ29kZXMuaW5jbHVkZXMoZnVsbExhbmcgYXMgTGFuZ3VhZ2VDb2RlKSkge1xuXHRcdHJldHVybiBmdWxsTGFuZyBhcyBMYW5ndWFnZUNvZGU7XG5cdH0gZWxzZSBpZiAoZmlyc3RTaG9ydExhbmcpIHtcblx0XHRyZXR1cm4gZmlyc3RTaG9ydExhbmc7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuICdlbic7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldERpc3BsYXlTdHJpbmcobGFuZ3VhZ2VDb2RlOiBMYW5ndWFnZUNvZGUpOiBzdHJpbmcge1xuXHRzd2l0Y2ggKGxhbmd1YWdlQ29kZSkge1xuXHRcdGNhc2UgJ2FyJzpcblx0XHRcdHJldHVybiBtKCd0cmFuc2xhdGVUb0FyYWJpY0xhYmVsJyk7XG5cdFx0Y2FzZSAnZGUnOlxuXHRcdFx0cmV0dXJuIG0oJ3RyYW5zbGF0ZVRvR2VybWFuTGFiZWwnKTtcblx0XHRjYXNlICdlbic6XG5cdFx0XHRyZXR1cm4gbSgndHJhbnNsYXRlVG9FbmdsaXNoTGFiZWwnKTtcblx0XHRjYXNlICdlcyc6XG5cdFx0XHRyZXR1cm4gbSgndHJhbnNsYXRlVG9TcGFuaXNoTGFiZWwnKTtcblx0XHRjYXNlICdmcic6XG5cdFx0XHRyZXR1cm4gbSgndHJhbnNsYXRlVG9GcmVuY2hMYWJlbCcpO1xuXHRcdGNhc2UgJ2hpJzpcblx0XHRcdHJldHVybiBtKCd0cmFuc2xhdGVUb0hpbmRpTGFiZWwnKTtcblx0XHRjYXNlICdpZCc6XG5cdFx0XHRyZXR1cm4gbSgndHJhbnNsYXRlVG9JbmRvbmVzaWFuTGFiZWwnKTtcblx0XHRjYXNlICdpdCc6XG5cdFx0XHRyZXR1cm4gbSgndHJhbnNsYXRlVG9JdGFsaWFuTGFiZWwnKTtcblx0XHRjYXNlICdqYSc6XG5cdFx0XHRyZXR1cm4gbSgndHJhbnNsYXRlVG9KYXBhbmVzZUxhYmVsJyk7XG5cdFx0Y2FzZSAna28nOlxuXHRcdFx0cmV0dXJuIG0oJ3RyYW5zbGF0ZVRvS29yZWFuTGFiZWwnKTtcblx0XHRjYXNlICdwbCc6XG5cdFx0XHRyZXR1cm4gbSgndHJhbnNsYXRlVG9Qb2xpc2hMYWJlbCcpO1xuXHRcdGNhc2UgJ3B0LUJSJzpcblx0XHRcdHJldHVybiBtKCd0cmFuc2xhdGVUb0JyYXppbGlhblBvcnR1Z3Vlc2VMYWJlbCcpO1xuXHRcdGNhc2UgJ3B0LVBUJzpcblx0XHRcdHJldHVybiBtKCd0cmFuc2xhdGVUb1BvcnR1Z3Vlc2VMYWJlbCcpO1xuXHRcdGNhc2UgJ3J1Jzpcblx0XHRcdHJldHVybiBtKCd0cmFuc2xhdGVUb1J1c3NpYW5MYWJlbCcpO1xuXHRcdGNhc2UgJ3RoJzpcblx0XHRcdHJldHVybiBtKCd0cmFuc2xhdGVUb1RoYWlMYWJlbCcpO1xuXHRcdGNhc2UgJ3ZpJzpcblx0XHRcdHJldHVybiBtKCd0cmFuc2xhdGVUb1ZpZXRuYW1lc2VMYWJlbCcpO1xuXHRcdGNhc2UgJ3poLUNOJzpcblx0XHRcdHJldHVybiBtKCd0cmFuc2xhdGVUb0NoaW5lc2VTaW1wbGlmaWVkTGFiZWwnKTtcblx0XHRjYXNlICd6aC1UVyc6XG5cdFx0XHRyZXR1cm4gbSgndHJhbnNsYXRlVG9DaGluZXNlVHJhZGl0aW9uYWxMYWJlbCcpO1xuXHRcdGRlZmF1bHQ6XG5cdFx0XHRyZXR1cm4gJ1Vua25vd24nO1xuXHR9XG59XG4iLCJleHBvcnQgaW50ZXJmYWNlIFRyYW5zbGF0aW9uUmVzdWx0IHtcblx0b3JpZ2luYWxMYW5ndWFnZTogc3RyaW5nO1xuXHR0cmFuc2xhdGVkVGV4dDogc3RyaW5nO1xuXHRtaW5YOiBudW1iZXI7XG5cdG1pblk6IG51bWJlcjtcblx0bWF4WDogbnVtYmVyO1xuXHRtYXhZOiBudW1iZXI7XG5cdGZvbnRIZWlnaHRQeD86IG51bWJlcjtcblx0Zm9udENvbG9yPzogc3RyaW5nO1xuXHR6SW5kZXg/OiBudW1iZXI7XG5cdGJhY2tncm91bmQ/OiBzdHJpbmc7IC8vIEJhc2U2NCBlbmNvZGVkIHN0cmluZyB3aXRoIHRoZSBvcmlnaW5hbCB0ZXh0IHJlbW92ZWQuXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVHJhbnNsYXRpb25SZXN1bHRzIHtcblx0aW1hZ2U6IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfTtcblx0dHJhbnNsYXRpb25zOiBUcmFuc2xhdGlvblJlc3VsdFtdO1xuXG5cdC8vIE9wdGlvbmFsIGNvbnZlbmllbmNlIHJldHVybi5cblx0Ly8gYmFzZTY0IGVuY29kZWQgc3RyaW5nIG9mIHRoZSBpbWFnZS5cblx0YmFzZTY0RGF0YT86IHN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNjYWxlVHJhbnNsYXRpb24oXG5cdHRhcmdldFdpZHRoOiBudW1iZXIsXG5cdHRhcmdldEhlaWdodDogbnVtYmVyLFxuXHRvcmlnaW5hbFdpZHRoOiBudW1iZXIsXG5cdG9yaWdpbmFsSGVpZ2h0OiBudW1iZXIsXG5cdHJlc3VsdDogVHJhbnNsYXRpb25SZXN1bHRcbik6IFRyYW5zbGF0aW9uUmVzdWx0IHtcblx0Y29uc3Qgc2NhbGVYID0gdGFyZ2V0V2lkdGggLyBvcmlnaW5hbFdpZHRoO1xuXHRjb25zdCBzY2FsZVkgPSB0YXJnZXRIZWlnaHQgLyBvcmlnaW5hbEhlaWdodDtcblxuXHRyZXR1cm4ge1xuXHRcdC4uLnJlc3VsdCxcblx0XHRtaW5YOiBNYXRoLnJvdW5kKHNjYWxlWCAqIHJlc3VsdC5taW5YKSxcblx0XHRtaW5ZOiBNYXRoLnJvdW5kKHNjYWxlWSAqIHJlc3VsdC5taW5ZKSxcblx0XHRtYXhYOiBNYXRoLnJvdW5kKHNjYWxlWCAqIHJlc3VsdC5tYXhYKSxcblx0XHRtYXhZOiBNYXRoLnJvdW5kKHNjYWxlWSAqIHJlc3VsdC5tYXhZKVxuXHR9O1xufVxuXG50eXBlIFdpZHRoID0gbnVtYmVyO1xudHlwZSBIZWlnaHQgPSBudW1iZXI7XG5cbmV4cG9ydCBmdW5jdGlvbiBjYWxjdWxhdGVSZXNpemVkQXNwZWN0UmF0aW8ocGFyYW1zOiB7XG5cdHdpZHRoOiBudW1iZXI7XG5cdGhlaWdodDogbnVtYmVyO1xuXHR3aWR0aE1heFB4OiBudW1iZXI7XG5cdGhlaWdodE1heFB4OiBudW1iZXI7XG59KTogW1dpZHRoLCBIZWlnaHRdIHtcblx0Y29uc3QgeyB3aWR0aCwgaGVpZ2h0LCB3aWR0aE1heFB4LCBoZWlnaHRNYXhQeCB9ID0gcGFyYW1zO1xuXHQvLyBgYWxyZWFkeVdpdGhpbkJvdW5kc2AgaW50ZW50aW9uYWxseSB1c2VzIGB8fGAgaW5zdGVhZCBvZiBgJiZgLFxuXHQvLyBzbyB0aGF0IGltYWdlcyBzbGlnaHRseSBvdmVyIGJvdW5kcyBhcmUgbGlrZWx5IG5vdCB0b3VjaGVkLlxuXHQvLyBBbHRob3VnaCBleHBlcmltZW50aW5nIHdpdGggYCYmYCBpbnN0ZWFkIG9mIGB8fCBtYXkgYmUgdmlhYmxlLlxuXHRjb25zdCBhbHJlYWR5V2l0aGluQm91bmRzID0gd2lkdGggPD0gd2lkdGhNYXhQeCB8fCBoZWlnaHQgPD0gaGVpZ2h0TWF4UHg7XG5cdGlmIChhbHJlYWR5V2l0aGluQm91bmRzKSB7XG5cdFx0cmV0dXJuIFt3aWR0aCwgaGVpZ2h0XTtcblx0fVxuXG5cdC8vIGBNYXRoLm1heGAgKHZzIGBNYXRoLm1pbmApIGlzIGludGVudGlvbmFsbHkgdXNlZCB0byBmYXZvciBsYXJnZXIgaW1hZ2VzLlxuXHRjb25zdCByZXNpemVkQXNwZWN0UmF0aW8gPSBNYXRoLm1heChoZWlnaHRNYXhQeCAvIGhlaWdodCwgd2lkdGhNYXhQeCAvIHdpZHRoKTtcblx0cmV0dXJuIFtNYXRoLnJvdW5kKHdpZHRoICogcmVzaXplZEFzcGVjdFJhdGlvKSwgTWF0aC5yb3VuZChoZWlnaHQgKiByZXNpemVkQXNwZWN0UmF0aW8pXTtcbn1cbiIsImV4cG9ydCB7IGRlZmF1bHQgYXMgdjEgfSBmcm9tICcuL3YxLmpzJztcbmV4cG9ydCB7IGRlZmF1bHQgYXMgdjMgfSBmcm9tICcuL3YzLmpzJztcbmV4cG9ydCB7IGRlZmF1bHQgYXMgdjQgfSBmcm9tICcuL3Y0LmpzJztcbmV4cG9ydCB7IGRlZmF1bHQgYXMgdjUgfSBmcm9tICcuL3Y1LmpzJztcbmV4cG9ydCB7IGRlZmF1bHQgYXMgTklMIH0gZnJvbSAnLi9uaWwuanMnO1xuZXhwb3J0IHsgZGVmYXVsdCBhcyB2ZXJzaW9uIH0gZnJvbSAnLi92ZXJzaW9uLmpzJztcbmV4cG9ydCB7IGRlZmF1bHQgYXMgdmFsaWRhdGUgfSBmcm9tICcuL3ZhbGlkYXRlLmpzJztcbmV4cG9ydCB7IGRlZmF1bHQgYXMgc3RyaW5naWZ5IH0gZnJvbSAnLi9zdHJpbmdpZnkuanMnO1xuZXhwb3J0IHsgZGVmYXVsdCBhcyBwYXJzZSB9IGZyb20gJy4vcGFyc2UuanMnOyIsIi8qXG4gKiBCcm93c2VyLWNvbXBhdGlibGUgSmF2YVNjcmlwdCBNRDVcbiAqXG4gKiBNb2RpZmljYXRpb24gb2YgSmF2YVNjcmlwdCBNRDVcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9ibHVlaW1wL0phdmFTY3JpcHQtTUQ1XG4gKlxuICogQ29weXJpZ2h0IDIwMTEsIFNlYmFzdGlhbiBUc2NoYW5cbiAqIGh0dHBzOi8vYmx1ZWltcC5uZXRcbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2U6XG4gKiBodHRwczovL29wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL01JVFxuICpcbiAqIEJhc2VkIG9uXG4gKiBBIEphdmFTY3JpcHQgaW1wbGVtZW50YXRpb24gb2YgdGhlIFJTQSBEYXRhIFNlY3VyaXR5LCBJbmMuIE1ENSBNZXNzYWdlXG4gKiBEaWdlc3QgQWxnb3JpdGhtLCBhcyBkZWZpbmVkIGluIFJGQyAxMzIxLlxuICogVmVyc2lvbiAyLjIgQ29weXJpZ2h0IChDKSBQYXVsIEpvaG5zdG9uIDE5OTkgLSAyMDA5XG4gKiBPdGhlciBjb250cmlidXRvcnM6IEdyZWcgSG9sdCwgQW5kcmV3IEtlcGVydCwgWWRuYXIsIExvc3RpbmV0XG4gKiBEaXN0cmlidXRlZCB1bmRlciB0aGUgQlNEIExpY2Vuc2VcbiAqIFNlZSBodHRwOi8vcGFqaG9tZS5vcmcudWsvY3J5cHQvbWQ1IGZvciBtb3JlIGluZm8uXG4gKi9cbmZ1bmN0aW9uIG1kNShieXRlcykge1xuICBpZiAodHlwZW9mIGJ5dGVzID09PSAnc3RyaW5nJykge1xuICAgIHZhciBtc2cgPSB1bmVzY2FwZShlbmNvZGVVUklDb21wb25lbnQoYnl0ZXMpKTsgLy8gVVRGOCBlc2NhcGVcblxuICAgIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkobXNnLmxlbmd0aCk7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1zZy5sZW5ndGg7ICsraSkge1xuICAgICAgYnl0ZXNbaV0gPSBtc2cuY2hhckNvZGVBdChpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbWQ1VG9IZXhFbmNvZGVkQXJyYXkod29yZHNUb01kNShieXRlc1RvV29yZHMoYnl0ZXMpLCBieXRlcy5sZW5ndGggKiA4KSk7XG59XG4vKlxuICogQ29udmVydCBhbiBhcnJheSBvZiBsaXR0bGUtZW5kaWFuIHdvcmRzIHRvIGFuIGFycmF5IG9mIGJ5dGVzXG4gKi9cblxuXG5mdW5jdGlvbiBtZDVUb0hleEVuY29kZWRBcnJheShpbnB1dCkge1xuICB2YXIgb3V0cHV0ID0gW107XG4gIHZhciBsZW5ndGgzMiA9IGlucHV0Lmxlbmd0aCAqIDMyO1xuICB2YXIgaGV4VGFiID0gJzAxMjM0NTY3ODlhYmNkZWYnO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoMzI7IGkgKz0gOCkge1xuICAgIHZhciB4ID0gaW5wdXRbaSA+PiA1XSA+Pj4gaSAlIDMyICYgMHhmZjtcbiAgICB2YXIgaGV4ID0gcGFyc2VJbnQoaGV4VGFiLmNoYXJBdCh4ID4+PiA0ICYgMHgwZikgKyBoZXhUYWIuY2hhckF0KHggJiAweDBmKSwgMTYpO1xuICAgIG91dHB1dC5wdXNoKGhleCk7XG4gIH1cblxuICByZXR1cm4gb3V0cHV0O1xufVxuLyoqXG4gKiBDYWxjdWxhdGUgb3V0cHV0IGxlbmd0aCB3aXRoIHBhZGRpbmcgYW5kIGJpdCBsZW5ndGhcbiAqL1xuXG5cbmZ1bmN0aW9uIGdldE91dHB1dExlbmd0aChpbnB1dExlbmd0aDgpIHtcbiAgcmV0dXJuIChpbnB1dExlbmd0aDggKyA2NCA+Pj4gOSA8PCA0KSArIDE0ICsgMTtcbn1cbi8qXG4gKiBDYWxjdWxhdGUgdGhlIE1ENSBvZiBhbiBhcnJheSBvZiBsaXR0bGUtZW5kaWFuIHdvcmRzLCBhbmQgYSBiaXQgbGVuZ3RoLlxuICovXG5cblxuZnVuY3Rpb24gd29yZHNUb01kNSh4LCBsZW4pIHtcbiAgLyogYXBwZW5kIHBhZGRpbmcgKi9cbiAgeFtsZW4gPj4gNV0gfD0gMHg4MCA8PCBsZW4gJSAzMjtcbiAgeFtnZXRPdXRwdXRMZW5ndGgobGVuKSAtIDFdID0gbGVuO1xuICB2YXIgYSA9IDE3MzI1ODQxOTM7XG4gIHZhciBiID0gLTI3MTczMzg3OTtcbiAgdmFyIGMgPSAtMTczMjU4NDE5NDtcbiAgdmFyIGQgPSAyNzE3MzM4Nzg7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB4Lmxlbmd0aDsgaSArPSAxNikge1xuICAgIHZhciBvbGRhID0gYTtcbiAgICB2YXIgb2xkYiA9IGI7XG4gICAgdmFyIG9sZGMgPSBjO1xuICAgIHZhciBvbGRkID0gZDtcbiAgICBhID0gbWQ1ZmYoYSwgYiwgYywgZCwgeFtpXSwgNywgLTY4MDg3NjkzNik7XG4gICAgZCA9IG1kNWZmKGQsIGEsIGIsIGMsIHhbaSArIDFdLCAxMiwgLTM4OTU2NDU4Nik7XG4gICAgYyA9IG1kNWZmKGMsIGQsIGEsIGIsIHhbaSArIDJdLCAxNywgNjA2MTA1ODE5KTtcbiAgICBiID0gbWQ1ZmYoYiwgYywgZCwgYSwgeFtpICsgM10sIDIyLCAtMTA0NDUyNTMzMCk7XG4gICAgYSA9IG1kNWZmKGEsIGIsIGMsIGQsIHhbaSArIDRdLCA3LCAtMTc2NDE4ODk3KTtcbiAgICBkID0gbWQ1ZmYoZCwgYSwgYiwgYywgeFtpICsgNV0sIDEyLCAxMjAwMDgwNDI2KTtcbiAgICBjID0gbWQ1ZmYoYywgZCwgYSwgYiwgeFtpICsgNl0sIDE3LCAtMTQ3MzIzMTM0MSk7XG4gICAgYiA9IG1kNWZmKGIsIGMsIGQsIGEsIHhbaSArIDddLCAyMiwgLTQ1NzA1OTgzKTtcbiAgICBhID0gbWQ1ZmYoYSwgYiwgYywgZCwgeFtpICsgOF0sIDcsIDE3NzAwMzU0MTYpO1xuICAgIGQgPSBtZDVmZihkLCBhLCBiLCBjLCB4W2kgKyA5XSwgMTIsIC0xOTU4NDE0NDE3KTtcbiAgICBjID0gbWQ1ZmYoYywgZCwgYSwgYiwgeFtpICsgMTBdLCAxNywgLTQyMDYzKTtcbiAgICBiID0gbWQ1ZmYoYiwgYywgZCwgYSwgeFtpICsgMTFdLCAyMiwgLTE5OTA0MDQxNjIpO1xuICAgIGEgPSBtZDVmZihhLCBiLCBjLCBkLCB4W2kgKyAxMl0sIDcsIDE4MDQ2MDM2ODIpO1xuICAgIGQgPSBtZDVmZihkLCBhLCBiLCBjLCB4W2kgKyAxM10sIDEyLCAtNDAzNDExMDEpO1xuICAgIGMgPSBtZDVmZihjLCBkLCBhLCBiLCB4W2kgKyAxNF0sIDE3LCAtMTUwMjAwMjI5MCk7XG4gICAgYiA9IG1kNWZmKGIsIGMsIGQsIGEsIHhbaSArIDE1XSwgMjIsIDEyMzY1MzUzMjkpO1xuICAgIGEgPSBtZDVnZyhhLCBiLCBjLCBkLCB4W2kgKyAxXSwgNSwgLTE2NTc5NjUxMCk7XG4gICAgZCA9IG1kNWdnKGQsIGEsIGIsIGMsIHhbaSArIDZdLCA5LCAtMTA2OTUwMTYzMik7XG4gICAgYyA9IG1kNWdnKGMsIGQsIGEsIGIsIHhbaSArIDExXSwgMTQsIDY0MzcxNzcxMyk7XG4gICAgYiA9IG1kNWdnKGIsIGMsIGQsIGEsIHhbaV0sIDIwLCAtMzczODk3MzAyKTtcbiAgICBhID0gbWQ1Z2coYSwgYiwgYywgZCwgeFtpICsgNV0sIDUsIC03MDE1NTg2OTEpO1xuICAgIGQgPSBtZDVnZyhkLCBhLCBiLCBjLCB4W2kgKyAxMF0sIDksIDM4MDE2MDgzKTtcbiAgICBjID0gbWQ1Z2coYywgZCwgYSwgYiwgeFtpICsgMTVdLCAxNCwgLTY2MDQ3ODMzNSk7XG4gICAgYiA9IG1kNWdnKGIsIGMsIGQsIGEsIHhbaSArIDRdLCAyMCwgLTQwNTUzNzg0OCk7XG4gICAgYSA9IG1kNWdnKGEsIGIsIGMsIGQsIHhbaSArIDldLCA1LCA1Njg0NDY0MzgpO1xuICAgIGQgPSBtZDVnZyhkLCBhLCBiLCBjLCB4W2kgKyAxNF0sIDksIC0xMDE5ODAzNjkwKTtcbiAgICBjID0gbWQ1Z2coYywgZCwgYSwgYiwgeFtpICsgM10sIDE0LCAtMTg3MzYzOTYxKTtcbiAgICBiID0gbWQ1Z2coYiwgYywgZCwgYSwgeFtpICsgOF0sIDIwLCAxMTYzNTMxNTAxKTtcbiAgICBhID0gbWQ1Z2coYSwgYiwgYywgZCwgeFtpICsgMTNdLCA1LCAtMTQ0NDY4MTQ2Nyk7XG4gICAgZCA9IG1kNWdnKGQsIGEsIGIsIGMsIHhbaSArIDJdLCA5LCAtNTE0MDM3ODQpO1xuICAgIGMgPSBtZDVnZyhjLCBkLCBhLCBiLCB4W2kgKyA3XSwgMTQsIDE3MzUzMjg0NzMpO1xuICAgIGIgPSBtZDVnZyhiLCBjLCBkLCBhLCB4W2kgKyAxMl0sIDIwLCAtMTkyNjYwNzczNCk7XG4gICAgYSA9IG1kNWhoKGEsIGIsIGMsIGQsIHhbaSArIDVdLCA0LCAtMzc4NTU4KTtcbiAgICBkID0gbWQ1aGgoZCwgYSwgYiwgYywgeFtpICsgOF0sIDExLCAtMjAyMjU3NDQ2Myk7XG4gICAgYyA9IG1kNWhoKGMsIGQsIGEsIGIsIHhbaSArIDExXSwgMTYsIDE4MzkwMzA1NjIpO1xuICAgIGIgPSBtZDVoaChiLCBjLCBkLCBhLCB4W2kgKyAxNF0sIDIzLCAtMzUzMDk1NTYpO1xuICAgIGEgPSBtZDVoaChhLCBiLCBjLCBkLCB4W2kgKyAxXSwgNCwgLTE1MzA5OTIwNjApO1xuICAgIGQgPSBtZDVoaChkLCBhLCBiLCBjLCB4W2kgKyA0XSwgMTEsIDEyNzI4OTMzNTMpO1xuICAgIGMgPSBtZDVoaChjLCBkLCBhLCBiLCB4W2kgKyA3XSwgMTYsIC0xNTU0OTc2MzIpO1xuICAgIGIgPSBtZDVoaChiLCBjLCBkLCBhLCB4W2kgKyAxMF0sIDIzLCAtMTA5NDczMDY0MCk7XG4gICAgYSA9IG1kNWhoKGEsIGIsIGMsIGQsIHhbaSArIDEzXSwgNCwgNjgxMjc5MTc0KTtcbiAgICBkID0gbWQ1aGgoZCwgYSwgYiwgYywgeFtpXSwgMTEsIC0zNTg1MzcyMjIpO1xuICAgIGMgPSBtZDVoaChjLCBkLCBhLCBiLCB4W2kgKyAzXSwgMTYsIC03MjI1MjE5NzkpO1xuICAgIGIgPSBtZDVoaChiLCBjLCBkLCBhLCB4W2kgKyA2XSwgMjMsIDc2MDI5MTg5KTtcbiAgICBhID0gbWQ1aGgoYSwgYiwgYywgZCwgeFtpICsgOV0sIDQsIC02NDAzNjQ0ODcpO1xuICAgIGQgPSBtZDVoaChkLCBhLCBiLCBjLCB4W2kgKyAxMl0sIDExLCAtNDIxODE1ODM1KTtcbiAgICBjID0gbWQ1aGgoYywgZCwgYSwgYiwgeFtpICsgMTVdLCAxNiwgNTMwNzQyNTIwKTtcbiAgICBiID0gbWQ1aGgoYiwgYywgZCwgYSwgeFtpICsgMl0sIDIzLCAtOTk1MzM4NjUxKTtcbiAgICBhID0gbWQ1aWkoYSwgYiwgYywgZCwgeFtpXSwgNiwgLTE5ODYzMDg0NCk7XG4gICAgZCA9IG1kNWlpKGQsIGEsIGIsIGMsIHhbaSArIDddLCAxMCwgMTEyNjg5MTQxNSk7XG4gICAgYyA9IG1kNWlpKGMsIGQsIGEsIGIsIHhbaSArIDE0XSwgMTUsIC0xNDE2MzU0OTA1KTtcbiAgICBiID0gbWQ1aWkoYiwgYywgZCwgYSwgeFtpICsgNV0sIDIxLCAtNTc0MzQwNTUpO1xuICAgIGEgPSBtZDVpaShhLCBiLCBjLCBkLCB4W2kgKyAxMl0sIDYsIDE3MDA0ODU1NzEpO1xuICAgIGQgPSBtZDVpaShkLCBhLCBiLCBjLCB4W2kgKyAzXSwgMTAsIC0xODk0OTg2NjA2KTtcbiAgICBjID0gbWQ1aWkoYywgZCwgYSwgYiwgeFtpICsgMTBdLCAxNSwgLTEwNTE1MjMpO1xuICAgIGIgPSBtZDVpaShiLCBjLCBkLCBhLCB4W2kgKyAxXSwgMjEsIC0yMDU0OTIyNzk5KTtcbiAgICBhID0gbWQ1aWkoYSwgYiwgYywgZCwgeFtpICsgOF0sIDYsIDE4NzMzMTMzNTkpO1xuICAgIGQgPSBtZDVpaShkLCBhLCBiLCBjLCB4W2kgKyAxNV0sIDEwLCAtMzA2MTE3NDQpO1xuICAgIGMgPSBtZDVpaShjLCBkLCBhLCBiLCB4W2kgKyA2XSwgMTUsIC0xNTYwMTk4MzgwKTtcbiAgICBiID0gbWQ1aWkoYiwgYywgZCwgYSwgeFtpICsgMTNdLCAyMSwgMTMwOTE1MTY0OSk7XG4gICAgYSA9IG1kNWlpKGEsIGIsIGMsIGQsIHhbaSArIDRdLCA2LCAtMTQ1NTIzMDcwKTtcbiAgICBkID0gbWQ1aWkoZCwgYSwgYiwgYywgeFtpICsgMTFdLCAxMCwgLTExMjAyMTAzNzkpO1xuICAgIGMgPSBtZDVpaShjLCBkLCBhLCBiLCB4W2kgKyAyXSwgMTUsIDcxODc4NzI1OSk7XG4gICAgYiA9IG1kNWlpKGIsIGMsIGQsIGEsIHhbaSArIDldLCAyMSwgLTM0MzQ4NTU1MSk7XG4gICAgYSA9IHNhZmVBZGQoYSwgb2xkYSk7XG4gICAgYiA9IHNhZmVBZGQoYiwgb2xkYik7XG4gICAgYyA9IHNhZmVBZGQoYywgb2xkYyk7XG4gICAgZCA9IHNhZmVBZGQoZCwgb2xkZCk7XG4gIH1cblxuICByZXR1cm4gW2EsIGIsIGMsIGRdO1xufVxuLypcbiAqIENvbnZlcnQgYW4gYXJyYXkgYnl0ZXMgdG8gYW4gYXJyYXkgb2YgbGl0dGxlLWVuZGlhbiB3b3Jkc1xuICogQ2hhcmFjdGVycyA+MjU1IGhhdmUgdGhlaXIgaGlnaC1ieXRlIHNpbGVudGx5IGlnbm9yZWQuXG4gKi9cblxuXG5mdW5jdGlvbiBieXRlc1RvV29yZHMoaW5wdXQpIHtcbiAgaWYgKGlucHV0Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIHZhciBsZW5ndGg4ID0gaW5wdXQubGVuZ3RoICogODtcbiAgdmFyIG91dHB1dCA9IG5ldyBVaW50MzJBcnJheShnZXRPdXRwdXRMZW5ndGgobGVuZ3RoOCkpO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoODsgaSArPSA4KSB7XG4gICAgb3V0cHV0W2kgPj4gNV0gfD0gKGlucHV0W2kgLyA4XSAmIDB4ZmYpIDw8IGkgJSAzMjtcbiAgfVxuXG4gIHJldHVybiBvdXRwdXQ7XG59XG4vKlxuICogQWRkIGludGVnZXJzLCB3cmFwcGluZyBhdCAyXjMyLiBUaGlzIHVzZXMgMTYtYml0IG9wZXJhdGlvbnMgaW50ZXJuYWxseVxuICogdG8gd29yayBhcm91bmQgYnVncyBpbiBzb21lIEpTIGludGVycHJldGVycy5cbiAqL1xuXG5cbmZ1bmN0aW9uIHNhZmVBZGQoeCwgeSkge1xuICB2YXIgbHN3ID0gKHggJiAweGZmZmYpICsgKHkgJiAweGZmZmYpO1xuICB2YXIgbXN3ID0gKHggPj4gMTYpICsgKHkgPj4gMTYpICsgKGxzdyA+PiAxNik7XG4gIHJldHVybiBtc3cgPDwgMTYgfCBsc3cgJiAweGZmZmY7XG59XG4vKlxuICogQml0d2lzZSByb3RhdGUgYSAzMi1iaXQgbnVtYmVyIHRvIHRoZSBsZWZ0LlxuICovXG5cblxuZnVuY3Rpb24gYml0Um90YXRlTGVmdChudW0sIGNudCkge1xuICByZXR1cm4gbnVtIDw8IGNudCB8IG51bSA+Pj4gMzIgLSBjbnQ7XG59XG4vKlxuICogVGhlc2UgZnVuY3Rpb25zIGltcGxlbWVudCB0aGUgZm91ciBiYXNpYyBvcGVyYXRpb25zIHRoZSBhbGdvcml0aG0gdXNlcy5cbiAqL1xuXG5cbmZ1bmN0aW9uIG1kNWNtbihxLCBhLCBiLCB4LCBzLCB0KSB7XG4gIHJldHVybiBzYWZlQWRkKGJpdFJvdGF0ZUxlZnQoc2FmZUFkZChzYWZlQWRkKGEsIHEpLCBzYWZlQWRkKHgsIHQpKSwgcyksIGIpO1xufVxuXG5mdW5jdGlvbiBtZDVmZihhLCBiLCBjLCBkLCB4LCBzLCB0KSB7XG4gIHJldHVybiBtZDVjbW4oYiAmIGMgfCB+YiAmIGQsIGEsIGIsIHgsIHMsIHQpO1xufVxuXG5mdW5jdGlvbiBtZDVnZyhhLCBiLCBjLCBkLCB4LCBzLCB0KSB7XG4gIHJldHVybiBtZDVjbW4oYiAmIGQgfCBjICYgfmQsIGEsIGIsIHgsIHMsIHQpO1xufVxuXG5mdW5jdGlvbiBtZDVoaChhLCBiLCBjLCBkLCB4LCBzLCB0KSB7XG4gIHJldHVybiBtZDVjbW4oYiBeIGMgXiBkLCBhLCBiLCB4LCBzLCB0KTtcbn1cblxuZnVuY3Rpb24gbWQ1aWkoYSwgYiwgYywgZCwgeCwgcywgdCkge1xuICByZXR1cm4gbWQ1Y21uKGMgXiAoYiB8IH5kKSwgYSwgYiwgeCwgcywgdCk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IG1kNTsiLCJleHBvcnQgZGVmYXVsdCAnMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAwJzsiLCJpbXBvcnQgdmFsaWRhdGUgZnJvbSAnLi92YWxpZGF0ZS5qcyc7XG5cbmZ1bmN0aW9uIHBhcnNlKHV1aWQpIHtcbiAgaWYgKCF2YWxpZGF0ZSh1dWlkKSkge1xuICAgIHRocm93IFR5cGVFcnJvcignSW52YWxpZCBVVUlEJyk7XG4gIH1cblxuICB2YXIgdjtcbiAgdmFyIGFyciA9IG5ldyBVaW50OEFycmF5KDE2KTsgLy8gUGFyc2UgIyMjIyMjIyMtLi4uLi0uLi4uLS4uLi4tLi4uLi4uLi4uLi4uXG5cbiAgYXJyWzBdID0gKHYgPSBwYXJzZUludCh1dWlkLnNsaWNlKDAsIDgpLCAxNikpID4+PiAyNDtcbiAgYXJyWzFdID0gdiA+Pj4gMTYgJiAweGZmO1xuICBhcnJbMl0gPSB2ID4+PiA4ICYgMHhmZjtcbiAgYXJyWzNdID0gdiAmIDB4ZmY7IC8vIFBhcnNlIC4uLi4uLi4uLSMjIyMtLi4uLi0uLi4uLS4uLi4uLi4uLi4uLlxuXG4gIGFycls0XSA9ICh2ID0gcGFyc2VJbnQodXVpZC5zbGljZSg5LCAxMyksIDE2KSkgPj4+IDg7XG4gIGFycls1XSA9IHYgJiAweGZmOyAvLyBQYXJzZSAuLi4uLi4uLi0uLi4uLSMjIyMtLi4uLi0uLi4uLi4uLi4uLi5cblxuICBhcnJbNl0gPSAodiA9IHBhcnNlSW50KHV1aWQuc2xpY2UoMTQsIDE4KSwgMTYpKSA+Pj4gODtcbiAgYXJyWzddID0gdiAmIDB4ZmY7IC8vIFBhcnNlIC4uLi4uLi4uLS4uLi4tLi4uLi0jIyMjLS4uLi4uLi4uLi4uLlxuXG4gIGFycls4XSA9ICh2ID0gcGFyc2VJbnQodXVpZC5zbGljZSgxOSwgMjMpLCAxNikpID4+PiA4O1xuICBhcnJbOV0gPSB2ICYgMHhmZjsgLy8gUGFyc2UgLi4uLi4uLi4tLi4uLi0uLi4uLS4uLi4tIyMjIyMjIyMjIyMjXG4gIC8vIChVc2UgXCIvXCIgdG8gYXZvaWQgMzItYml0IHRydW5jYXRpb24gd2hlbiBiaXQtc2hpZnRpbmcgaGlnaC1vcmRlciBieXRlcylcblxuICBhcnJbMTBdID0gKHYgPSBwYXJzZUludCh1dWlkLnNsaWNlKDI0LCAzNiksIDE2KSkgLyAweDEwMDAwMDAwMDAwICYgMHhmZjtcbiAgYXJyWzExXSA9IHYgLyAweDEwMDAwMDAwMCAmIDB4ZmY7XG4gIGFyclsxMl0gPSB2ID4+PiAyNCAmIDB4ZmY7XG4gIGFyclsxM10gPSB2ID4+PiAxNiAmIDB4ZmY7XG4gIGFyclsxNF0gPSB2ID4+PiA4ICYgMHhmZjtcbiAgYXJyWzE1XSA9IHYgJiAweGZmO1xuICByZXR1cm4gYXJyO1xufVxuXG5leHBvcnQgZGVmYXVsdCBwYXJzZTsiLCJleHBvcnQgZGVmYXVsdCAvXig/OlswLTlhLWZdezh9LVswLTlhLWZdezR9LVsxLTVdWzAtOWEtZl17M30tWzg5YWJdWzAtOWEtZl17M30tWzAtOWEtZl17MTJ9fDAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMCkkL2k7IiwiLy8gVW5pcXVlIElEIGNyZWF0aW9uIHJlcXVpcmVzIGEgaGlnaCBxdWFsaXR5IHJhbmRvbSAjIGdlbmVyYXRvci4gSW4gdGhlIGJyb3dzZXIgd2UgdGhlcmVmb3JlXG4vLyByZXF1aXJlIHRoZSBjcnlwdG8gQVBJIGFuZCBkbyBub3Qgc3VwcG9ydCBidWlsdC1pbiBmYWxsYmFjayB0byBsb3dlciBxdWFsaXR5IHJhbmRvbSBudW1iZXJcbi8vIGdlbmVyYXRvcnMgKGxpa2UgTWF0aC5yYW5kb20oKSkuXG52YXIgZ2V0UmFuZG9tVmFsdWVzO1xudmFyIHJuZHM4ID0gbmV3IFVpbnQ4QXJyYXkoMTYpO1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcm5nKCkge1xuICAvLyBsYXp5IGxvYWQgc28gdGhhdCBlbnZpcm9ubWVudHMgdGhhdCBuZWVkIHRvIHBvbHlmaWxsIGhhdmUgYSBjaGFuY2UgdG8gZG8gc29cbiAgaWYgKCFnZXRSYW5kb21WYWx1ZXMpIHtcbiAgICAvLyBnZXRSYW5kb21WYWx1ZXMgbmVlZHMgdG8gYmUgaW52b2tlZCBpbiBhIGNvbnRleHQgd2hlcmUgXCJ0aGlzXCIgaXMgYSBDcnlwdG8gaW1wbGVtZW50YXRpb24uIEFsc28sXG4gICAgLy8gZmluZCB0aGUgY29tcGxldGUgaW1wbGVtZW50YXRpb24gb2YgY3J5cHRvIChtc0NyeXB0bykgb24gSUUxMS5cbiAgICBnZXRSYW5kb21WYWx1ZXMgPSB0eXBlb2YgY3J5cHRvICE9PSAndW5kZWZpbmVkJyAmJiBjcnlwdG8uZ2V0UmFuZG9tVmFsdWVzICYmIGNyeXB0by5nZXRSYW5kb21WYWx1ZXMuYmluZChjcnlwdG8pIHx8IHR5cGVvZiBtc0NyeXB0byAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG1zQ3J5cHRvLmdldFJhbmRvbVZhbHVlcyA9PT0gJ2Z1bmN0aW9uJyAmJiBtc0NyeXB0by5nZXRSYW5kb21WYWx1ZXMuYmluZChtc0NyeXB0byk7XG5cbiAgICBpZiAoIWdldFJhbmRvbVZhbHVlcykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdjcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKCkgbm90IHN1cHBvcnRlZC4gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS91dWlkanMvdXVpZCNnZXRyYW5kb212YWx1ZXMtbm90LXN1cHBvcnRlZCcpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBnZXRSYW5kb21WYWx1ZXMocm5kczgpO1xufSIsIi8vIEFkYXB0ZWQgZnJvbSBDaHJpcyBWZW5lc3MnIFNIQTEgY29kZSBhdFxuLy8gaHR0cDovL3d3dy5tb3ZhYmxlLXR5cGUuY28udWsvc2NyaXB0cy9zaGExLmh0bWxcbmZ1bmN0aW9uIGYocywgeCwgeSwgeikge1xuICBzd2l0Y2ggKHMpIHtcbiAgICBjYXNlIDA6XG4gICAgICByZXR1cm4geCAmIHkgXiB+eCAmIHo7XG5cbiAgICBjYXNlIDE6XG4gICAgICByZXR1cm4geCBeIHkgXiB6O1xuXG4gICAgY2FzZSAyOlxuICAgICAgcmV0dXJuIHggJiB5IF4geCAmIHogXiB5ICYgejtcblxuICAgIGNhc2UgMzpcbiAgICAgIHJldHVybiB4IF4geSBeIHo7XG4gIH1cbn1cblxuZnVuY3Rpb24gUk9UTCh4LCBuKSB7XG4gIHJldHVybiB4IDw8IG4gfCB4ID4+PiAzMiAtIG47XG59XG5cbmZ1bmN0aW9uIHNoYTEoYnl0ZXMpIHtcbiAgdmFyIEsgPSBbMHg1YTgyNzk5OSwgMHg2ZWQ5ZWJhMSwgMHg4ZjFiYmNkYywgMHhjYTYyYzFkNl07XG4gIHZhciBIID0gWzB4Njc0NTIzMDEsIDB4ZWZjZGFiODksIDB4OThiYWRjZmUsIDB4MTAzMjU0NzYsIDB4YzNkMmUxZjBdO1xuXG4gIGlmICh0eXBlb2YgYnl0ZXMgPT09ICdzdHJpbmcnKSB7XG4gICAgdmFyIG1zZyA9IHVuZXNjYXBlKGVuY29kZVVSSUNvbXBvbmVudChieXRlcykpOyAvLyBVVEY4IGVzY2FwZVxuXG4gICAgYnl0ZXMgPSBbXTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbXNnLmxlbmd0aDsgKytpKSB7XG4gICAgICBieXRlcy5wdXNoKG1zZy5jaGFyQ29kZUF0KGkpKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoIUFycmF5LmlzQXJyYXkoYnl0ZXMpKSB7XG4gICAgLy8gQ29udmVydCBBcnJheS1saWtlIHRvIEFycmF5XG4gICAgYnl0ZXMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChieXRlcyk7XG4gIH1cblxuICBieXRlcy5wdXNoKDB4ODApO1xuICB2YXIgbCA9IGJ5dGVzLmxlbmd0aCAvIDQgKyAyO1xuICB2YXIgTiA9IE1hdGguY2VpbChsIC8gMTYpO1xuICB2YXIgTSA9IG5ldyBBcnJheShOKTtcblxuICBmb3IgKHZhciBfaSA9IDA7IF9pIDwgTjsgKytfaSkge1xuICAgIHZhciBhcnIgPSBuZXcgVWludDMyQXJyYXkoMTYpO1xuXG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCAxNjsgKytqKSB7XG4gICAgICBhcnJbal0gPSBieXRlc1tfaSAqIDY0ICsgaiAqIDRdIDw8IDI0IHwgYnl0ZXNbX2kgKiA2NCArIGogKiA0ICsgMV0gPDwgMTYgfCBieXRlc1tfaSAqIDY0ICsgaiAqIDQgKyAyXSA8PCA4IHwgYnl0ZXNbX2kgKiA2NCArIGogKiA0ICsgM107XG4gICAgfVxuXG4gICAgTVtfaV0gPSBhcnI7XG4gIH1cblxuICBNW04gLSAxXVsxNF0gPSAoYnl0ZXMubGVuZ3RoIC0gMSkgKiA4IC8gTWF0aC5wb3coMiwgMzIpO1xuICBNW04gLSAxXVsxNF0gPSBNYXRoLmZsb29yKE1bTiAtIDFdWzE0XSk7XG4gIE1bTiAtIDFdWzE1XSA9IChieXRlcy5sZW5ndGggLSAxKSAqIDggJiAweGZmZmZmZmZmO1xuXG4gIGZvciAodmFyIF9pMiA9IDA7IF9pMiA8IE47ICsrX2kyKSB7XG4gICAgdmFyIFcgPSBuZXcgVWludDMyQXJyYXkoODApO1xuXG4gICAgZm9yICh2YXIgdCA9IDA7IHQgPCAxNjsgKyt0KSB7XG4gICAgICBXW3RdID0gTVtfaTJdW3RdO1xuICAgIH1cblxuICAgIGZvciAodmFyIF90ID0gMTY7IF90IDwgODA7ICsrX3QpIHtcbiAgICAgIFdbX3RdID0gUk9UTChXW190IC0gM10gXiBXW190IC0gOF0gXiBXW190IC0gMTRdIF4gV1tfdCAtIDE2XSwgMSk7XG4gICAgfVxuXG4gICAgdmFyIGEgPSBIWzBdO1xuICAgIHZhciBiID0gSFsxXTtcbiAgICB2YXIgYyA9IEhbMl07XG4gICAgdmFyIGQgPSBIWzNdO1xuICAgIHZhciBlID0gSFs0XTtcblxuICAgIGZvciAodmFyIF90MiA9IDA7IF90MiA8IDgwOyArK190Mikge1xuICAgICAgdmFyIHMgPSBNYXRoLmZsb29yKF90MiAvIDIwKTtcbiAgICAgIHZhciBUID0gUk9UTChhLCA1KSArIGYocywgYiwgYywgZCkgKyBlICsgS1tzXSArIFdbX3QyXSA+Pj4gMDtcbiAgICAgIGUgPSBkO1xuICAgICAgZCA9IGM7XG4gICAgICBjID0gUk9UTChiLCAzMCkgPj4+IDA7XG4gICAgICBiID0gYTtcbiAgICAgIGEgPSBUO1xuICAgIH1cblxuICAgIEhbMF0gPSBIWzBdICsgYSA+Pj4gMDtcbiAgICBIWzFdID0gSFsxXSArIGIgPj4+IDA7XG4gICAgSFsyXSA9IEhbMl0gKyBjID4+PiAwO1xuICAgIEhbM10gPSBIWzNdICsgZCA+Pj4gMDtcbiAgICBIWzRdID0gSFs0XSArIGUgPj4+IDA7XG4gIH1cblxuICByZXR1cm4gW0hbMF0gPj4gMjQgJiAweGZmLCBIWzBdID4+IDE2ICYgMHhmZiwgSFswXSA+PiA4ICYgMHhmZiwgSFswXSAmIDB4ZmYsIEhbMV0gPj4gMjQgJiAweGZmLCBIWzFdID4+IDE2ICYgMHhmZiwgSFsxXSA+PiA4ICYgMHhmZiwgSFsxXSAmIDB4ZmYsIEhbMl0gPj4gMjQgJiAweGZmLCBIWzJdID4+IDE2ICYgMHhmZiwgSFsyXSA+PiA4ICYgMHhmZiwgSFsyXSAmIDB4ZmYsIEhbM10gPj4gMjQgJiAweGZmLCBIWzNdID4+IDE2ICYgMHhmZiwgSFszXSA+PiA4ICYgMHhmZiwgSFszXSAmIDB4ZmYsIEhbNF0gPj4gMjQgJiAweGZmLCBIWzRdID4+IDE2ICYgMHhmZiwgSFs0XSA+PiA4ICYgMHhmZiwgSFs0XSAmIDB4ZmZdO1xufVxuXG5leHBvcnQgZGVmYXVsdCBzaGExOyIsImltcG9ydCB2YWxpZGF0ZSBmcm9tICcuL3ZhbGlkYXRlLmpzJztcbi8qKlxuICogQ29udmVydCBhcnJheSBvZiAxNiBieXRlIHZhbHVlcyB0byBVVUlEIHN0cmluZyBmb3JtYXQgb2YgdGhlIGZvcm06XG4gKiBYWFhYWFhYWC1YWFhYLVhYWFgtWFhYWC1YWFhYWFhYWFhYWFhcbiAqL1xuXG52YXIgYnl0ZVRvSGV4ID0gW107XG5cbmZvciAodmFyIGkgPSAwOyBpIDwgMjU2OyArK2kpIHtcbiAgYnl0ZVRvSGV4LnB1c2goKGkgKyAweDEwMCkudG9TdHJpbmcoMTYpLnN1YnN0cigxKSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ2lmeShhcnIpIHtcbiAgdmFyIG9mZnNldCA9IGFyZ3VtZW50cy5sZW5ndGggPiAxICYmIGFyZ3VtZW50c1sxXSAhPT0gdW5kZWZpbmVkID8gYXJndW1lbnRzWzFdIDogMDtcbiAgLy8gTm90ZTogQmUgY2FyZWZ1bCBlZGl0aW5nIHRoaXMgY29kZSEgIEl0J3MgYmVlbiB0dW5lZCBmb3IgcGVyZm9ybWFuY2VcbiAgLy8gYW5kIHdvcmtzIGluIHdheXMgeW91IG1heSBub3QgZXhwZWN0LiBTZWUgaHR0cHM6Ly9naXRodWIuY29tL3V1aWRqcy91dWlkL3B1bGwvNDM0XG4gIHZhciB1dWlkID0gKGJ5dGVUb0hleFthcnJbb2Zmc2V0ICsgMF1dICsgYnl0ZVRvSGV4W2FycltvZmZzZXQgKyAxXV0gKyBieXRlVG9IZXhbYXJyW29mZnNldCArIDJdXSArIGJ5dGVUb0hleFthcnJbb2Zmc2V0ICsgM11dICsgJy0nICsgYnl0ZVRvSGV4W2FycltvZmZzZXQgKyA0XV0gKyBieXRlVG9IZXhbYXJyW29mZnNldCArIDVdXSArICctJyArIGJ5dGVUb0hleFthcnJbb2Zmc2V0ICsgNl1dICsgYnl0ZVRvSGV4W2FycltvZmZzZXQgKyA3XV0gKyAnLScgKyBieXRlVG9IZXhbYXJyW29mZnNldCArIDhdXSArIGJ5dGVUb0hleFthcnJbb2Zmc2V0ICsgOV1dICsgJy0nICsgYnl0ZVRvSGV4W2FycltvZmZzZXQgKyAxMF1dICsgYnl0ZVRvSGV4W2FycltvZmZzZXQgKyAxMV1dICsgYnl0ZVRvSGV4W2FycltvZmZzZXQgKyAxMl1dICsgYnl0ZVRvSGV4W2FycltvZmZzZXQgKyAxM11dICsgYnl0ZVRvSGV4W2FycltvZmZzZXQgKyAxNF1dICsgYnl0ZVRvSGV4W2FycltvZmZzZXQgKyAxNV1dKS50b0xvd2VyQ2FzZSgpOyAvLyBDb25zaXN0ZW5jeSBjaGVjayBmb3IgdmFsaWQgVVVJRC4gIElmIHRoaXMgdGhyb3dzLCBpdCdzIGxpa2VseSBkdWUgdG8gb25lXG4gIC8vIG9mIHRoZSBmb2xsb3dpbmc6XG4gIC8vIC0gT25lIG9yIG1vcmUgaW5wdXQgYXJyYXkgdmFsdWVzIGRvbid0IG1hcCB0byBhIGhleCBvY3RldCAobGVhZGluZyB0b1xuICAvLyBcInVuZGVmaW5lZFwiIGluIHRoZSB1dWlkKVxuICAvLyAtIEludmFsaWQgaW5wdXQgdmFsdWVzIGZvciB0aGUgUkZDIGB2ZXJzaW9uYCBvciBgdmFyaWFudGAgZmllbGRzXG5cbiAgaWYgKCF2YWxpZGF0ZSh1dWlkKSkge1xuICAgIHRocm93IFR5cGVFcnJvcignU3RyaW5naWZpZWQgVVVJRCBpcyBpbnZhbGlkJyk7XG4gIH1cblxuICByZXR1cm4gdXVpZDtcbn1cblxuZXhwb3J0IGRlZmF1bHQgc3RyaW5naWZ5OyIsImltcG9ydCBybmcgZnJvbSAnLi9ybmcuanMnO1xuaW1wb3J0IHN0cmluZ2lmeSBmcm9tICcuL3N0cmluZ2lmeS5qcyc7IC8vICoqYHYxKClgIC0gR2VuZXJhdGUgdGltZS1iYXNlZCBVVUlEKipcbi8vXG4vLyBJbnNwaXJlZCBieSBodHRwczovL2dpdGh1Yi5jb20vTGlvc0svVVVJRC5qc1xuLy8gYW5kIGh0dHA6Ly9kb2NzLnB5dGhvbi5vcmcvbGlicmFyeS91dWlkLmh0bWxcblxudmFyIF9ub2RlSWQ7XG5cbnZhciBfY2xvY2tzZXE7IC8vIFByZXZpb3VzIHV1aWQgY3JlYXRpb24gdGltZVxuXG5cbnZhciBfbGFzdE1TZWNzID0gMDtcbnZhciBfbGFzdE5TZWNzID0gMDsgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS91dWlkanMvdXVpZCBmb3IgQVBJIGRldGFpbHNcblxuZnVuY3Rpb24gdjEob3B0aW9ucywgYnVmLCBvZmZzZXQpIHtcbiAgdmFyIGkgPSBidWYgJiYgb2Zmc2V0IHx8IDA7XG4gIHZhciBiID0gYnVmIHx8IG5ldyBBcnJheSgxNik7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICB2YXIgbm9kZSA9IG9wdGlvbnMubm9kZSB8fCBfbm9kZUlkO1xuICB2YXIgY2xvY2tzZXEgPSBvcHRpb25zLmNsb2Nrc2VxICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLmNsb2Nrc2VxIDogX2Nsb2Nrc2VxOyAvLyBub2RlIGFuZCBjbG9ja3NlcSBuZWVkIHRvIGJlIGluaXRpYWxpemVkIHRvIHJhbmRvbSB2YWx1ZXMgaWYgdGhleSdyZSBub3RcbiAgLy8gc3BlY2lmaWVkLiAgV2UgZG8gdGhpcyBsYXppbHkgdG8gbWluaW1pemUgaXNzdWVzIHJlbGF0ZWQgdG8gaW5zdWZmaWNpZW50XG4gIC8vIHN5c3RlbSBlbnRyb3B5LiAgU2VlICMxODlcblxuICBpZiAobm9kZSA9PSBudWxsIHx8IGNsb2Nrc2VxID09IG51bGwpIHtcbiAgICB2YXIgc2VlZEJ5dGVzID0gb3B0aW9ucy5yYW5kb20gfHwgKG9wdGlvbnMucm5nIHx8IHJuZykoKTtcblxuICAgIGlmIChub2RlID09IG51bGwpIHtcbiAgICAgIC8vIFBlciA0LjUsIGNyZWF0ZSBhbmQgNDgtYml0IG5vZGUgaWQsICg0NyByYW5kb20gYml0cyArIG11bHRpY2FzdCBiaXQgPSAxKVxuICAgICAgbm9kZSA9IF9ub2RlSWQgPSBbc2VlZEJ5dGVzWzBdIHwgMHgwMSwgc2VlZEJ5dGVzWzFdLCBzZWVkQnl0ZXNbMl0sIHNlZWRCeXRlc1szXSwgc2VlZEJ5dGVzWzRdLCBzZWVkQnl0ZXNbNV1dO1xuICAgIH1cblxuICAgIGlmIChjbG9ja3NlcSA9PSBudWxsKSB7XG4gICAgICAvLyBQZXIgNC4yLjIsIHJhbmRvbWl6ZSAoMTQgYml0KSBjbG9ja3NlcVxuICAgICAgY2xvY2tzZXEgPSBfY2xvY2tzZXEgPSAoc2VlZEJ5dGVzWzZdIDw8IDggfCBzZWVkQnl0ZXNbN10pICYgMHgzZmZmO1xuICAgIH1cbiAgfSAvLyBVVUlEIHRpbWVzdGFtcHMgYXJlIDEwMCBuYW5vLXNlY29uZCB1bml0cyBzaW5jZSB0aGUgR3JlZ29yaWFuIGVwb2NoLFxuICAvLyAoMTU4Mi0xMC0xNSAwMDowMCkuICBKU051bWJlcnMgYXJlbid0IHByZWNpc2UgZW5vdWdoIGZvciB0aGlzLCBzb1xuICAvLyB0aW1lIGlzIGhhbmRsZWQgaW50ZXJuYWxseSBhcyAnbXNlY3MnIChpbnRlZ2VyIG1pbGxpc2Vjb25kcykgYW5kICduc2VjcydcbiAgLy8gKDEwMC1uYW5vc2Vjb25kcyBvZmZzZXQgZnJvbSBtc2Vjcykgc2luY2UgdW5peCBlcG9jaCwgMTk3MC0wMS0wMSAwMDowMC5cblxuXG4gIHZhciBtc2VjcyA9IG9wdGlvbnMubXNlY3MgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMubXNlY3MgOiBEYXRlLm5vdygpOyAvLyBQZXIgNC4yLjEuMiwgdXNlIGNvdW50IG9mIHV1aWQncyBnZW5lcmF0ZWQgZHVyaW5nIHRoZSBjdXJyZW50IGNsb2NrXG4gIC8vIGN5Y2xlIHRvIHNpbXVsYXRlIGhpZ2hlciByZXNvbHV0aW9uIGNsb2NrXG5cbiAgdmFyIG5zZWNzID0gb3B0aW9ucy5uc2VjcyAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5uc2VjcyA6IF9sYXN0TlNlY3MgKyAxOyAvLyBUaW1lIHNpbmNlIGxhc3QgdXVpZCBjcmVhdGlvbiAoaW4gbXNlY3MpXG5cbiAgdmFyIGR0ID0gbXNlY3MgLSBfbGFzdE1TZWNzICsgKG5zZWNzIC0gX2xhc3ROU2VjcykgLyAxMDAwMDsgLy8gUGVyIDQuMi4xLjIsIEJ1bXAgY2xvY2tzZXEgb24gY2xvY2sgcmVncmVzc2lvblxuXG4gIGlmIChkdCA8IDAgJiYgb3B0aW9ucy5jbG9ja3NlcSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgY2xvY2tzZXEgPSBjbG9ja3NlcSArIDEgJiAweDNmZmY7XG4gIH0gLy8gUmVzZXQgbnNlY3MgaWYgY2xvY2sgcmVncmVzc2VzIChuZXcgY2xvY2tzZXEpIG9yIHdlJ3ZlIG1vdmVkIG9udG8gYSBuZXdcbiAgLy8gdGltZSBpbnRlcnZhbFxuXG5cbiAgaWYgKChkdCA8IDAgfHwgbXNlY3MgPiBfbGFzdE1TZWNzKSAmJiBvcHRpb25zLm5zZWNzID09PSB1bmRlZmluZWQpIHtcbiAgICBuc2VjcyA9IDA7XG4gIH0gLy8gUGVyIDQuMi4xLjIgVGhyb3cgZXJyb3IgaWYgdG9vIG1hbnkgdXVpZHMgYXJlIHJlcXVlc3RlZFxuXG5cbiAgaWYgKG5zZWNzID49IDEwMDAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwidXVpZC52MSgpOiBDYW4ndCBjcmVhdGUgbW9yZSB0aGFuIDEwTSB1dWlkcy9zZWNcIik7XG4gIH1cblxuICBfbGFzdE1TZWNzID0gbXNlY3M7XG4gIF9sYXN0TlNlY3MgPSBuc2VjcztcbiAgX2Nsb2Nrc2VxID0gY2xvY2tzZXE7IC8vIFBlciA0LjEuNCAtIENvbnZlcnQgZnJvbSB1bml4IGVwb2NoIHRvIEdyZWdvcmlhbiBlcG9jaFxuXG4gIG1zZWNzICs9IDEyMjE5MjkyODAwMDAwOyAvLyBgdGltZV9sb3dgXG5cbiAgdmFyIHRsID0gKChtc2VjcyAmIDB4ZmZmZmZmZikgKiAxMDAwMCArIG5zZWNzKSAlIDB4MTAwMDAwMDAwO1xuICBiW2krK10gPSB0bCA+Pj4gMjQgJiAweGZmO1xuICBiW2krK10gPSB0bCA+Pj4gMTYgJiAweGZmO1xuICBiW2krK10gPSB0bCA+Pj4gOCAmIDB4ZmY7XG4gIGJbaSsrXSA9IHRsICYgMHhmZjsgLy8gYHRpbWVfbWlkYFxuXG4gIHZhciB0bWggPSBtc2VjcyAvIDB4MTAwMDAwMDAwICogMTAwMDAgJiAweGZmZmZmZmY7XG4gIGJbaSsrXSA9IHRtaCA+Pj4gOCAmIDB4ZmY7XG4gIGJbaSsrXSA9IHRtaCAmIDB4ZmY7IC8vIGB0aW1lX2hpZ2hfYW5kX3ZlcnNpb25gXG5cbiAgYltpKytdID0gdG1oID4+PiAyNCAmIDB4ZiB8IDB4MTA7IC8vIGluY2x1ZGUgdmVyc2lvblxuXG4gIGJbaSsrXSA9IHRtaCA+Pj4gMTYgJiAweGZmOyAvLyBgY2xvY2tfc2VxX2hpX2FuZF9yZXNlcnZlZGAgKFBlciA0LjIuMiAtIGluY2x1ZGUgdmFyaWFudClcblxuICBiW2krK10gPSBjbG9ja3NlcSA+Pj4gOCB8IDB4ODA7IC8vIGBjbG9ja19zZXFfbG93YFxuXG4gIGJbaSsrXSA9IGNsb2Nrc2VxICYgMHhmZjsgLy8gYG5vZGVgXG5cbiAgZm9yICh2YXIgbiA9IDA7IG4gPCA2OyArK24pIHtcbiAgICBiW2kgKyBuXSA9IG5vZGVbbl07XG4gIH1cblxuICByZXR1cm4gYnVmIHx8IHN0cmluZ2lmeShiKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgdjE7IiwiaW1wb3J0IHYzNSBmcm9tICcuL3YzNS5qcyc7XG5pbXBvcnQgbWQ1IGZyb20gJy4vbWQ1LmpzJztcbnZhciB2MyA9IHYzNSgndjMnLCAweDMwLCBtZDUpO1xuZXhwb3J0IGRlZmF1bHQgdjM7IiwiaW1wb3J0IHN0cmluZ2lmeSBmcm9tICcuL3N0cmluZ2lmeS5qcyc7XG5pbXBvcnQgcGFyc2UgZnJvbSAnLi9wYXJzZS5qcyc7XG5cbmZ1bmN0aW9uIHN0cmluZ1RvQnl0ZXMoc3RyKSB7XG4gIHN0ciA9IHVuZXNjYXBlKGVuY29kZVVSSUNvbXBvbmVudChzdHIpKTsgLy8gVVRGOCBlc2NhcGVcblxuICB2YXIgYnl0ZXMgPSBbXTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7ICsraSkge1xuICAgIGJ5dGVzLnB1c2goc3RyLmNoYXJDb2RlQXQoaSkpO1xuICB9XG5cbiAgcmV0dXJuIGJ5dGVzO1xufVxuXG5leHBvcnQgdmFyIEROUyA9ICc2YmE3YjgxMC05ZGFkLTExZDEtODBiNC0wMGMwNGZkNDMwYzgnO1xuZXhwb3J0IHZhciBVUkwgPSAnNmJhN2I4MTEtOWRhZC0xMWQxLTgwYjQtMDBjMDRmZDQzMGM4JztcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChuYW1lLCB2ZXJzaW9uLCBoYXNoZnVuYykge1xuICBmdW5jdGlvbiBnZW5lcmF0ZVVVSUQodmFsdWUsIG5hbWVzcGFjZSwgYnVmLCBvZmZzZXQpIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgdmFsdWUgPSBzdHJpbmdUb0J5dGVzKHZhbHVlKTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIG5hbWVzcGFjZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIG5hbWVzcGFjZSA9IHBhcnNlKG5hbWVzcGFjZSk7XG4gICAgfVxuXG4gICAgaWYgKG5hbWVzcGFjZS5sZW5ndGggIT09IDE2KSB7XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ05hbWVzcGFjZSBtdXN0IGJlIGFycmF5LWxpa2UgKDE2IGl0ZXJhYmxlIGludGVnZXIgdmFsdWVzLCAwLTI1NSknKTtcbiAgICB9IC8vIENvbXB1dGUgaGFzaCBvZiBuYW1lc3BhY2UgYW5kIHZhbHVlLCBQZXIgNC4zXG4gICAgLy8gRnV0dXJlOiBVc2Ugc3ByZWFkIHN5bnRheCB3aGVuIHN1cHBvcnRlZCBvbiBhbGwgcGxhdGZvcm1zLCBlLmcuIGBieXRlcyA9XG4gICAgLy8gaGFzaGZ1bmMoWy4uLm5hbWVzcGFjZSwgLi4uIHZhbHVlXSlgXG5cblxuICAgIHZhciBieXRlcyA9IG5ldyBVaW50OEFycmF5KDE2ICsgdmFsdWUubGVuZ3RoKTtcbiAgICBieXRlcy5zZXQobmFtZXNwYWNlKTtcbiAgICBieXRlcy5zZXQodmFsdWUsIG5hbWVzcGFjZS5sZW5ndGgpO1xuICAgIGJ5dGVzID0gaGFzaGZ1bmMoYnl0ZXMpO1xuICAgIGJ5dGVzWzZdID0gYnl0ZXNbNl0gJiAweDBmIHwgdmVyc2lvbjtcbiAgICBieXRlc1s4XSA9IGJ5dGVzWzhdICYgMHgzZiB8IDB4ODA7XG5cbiAgICBpZiAoYnVmKSB7XG4gICAgICBvZmZzZXQgPSBvZmZzZXQgfHwgMDtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCAxNjsgKytpKSB7XG4gICAgICAgIGJ1ZltvZmZzZXQgKyBpXSA9IGJ5dGVzW2ldO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gYnVmO1xuICAgIH1cblxuICAgIHJldHVybiBzdHJpbmdpZnkoYnl0ZXMpO1xuICB9IC8vIEZ1bmN0aW9uI25hbWUgaXMgbm90IHNldHRhYmxlIG9uIHNvbWUgcGxhdGZvcm1zICgjMjcwKVxuXG5cbiAgdHJ5IHtcbiAgICBnZW5lcmF0ZVVVSUQubmFtZSA9IG5hbWU7IC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1lbXB0eVxuICB9IGNhdGNoIChlcnIpIHt9IC8vIEZvciBDb21tb25KUyBkZWZhdWx0IGV4cG9ydCBzdXBwb3J0XG5cblxuICBnZW5lcmF0ZVVVSUQuRE5TID0gRE5TO1xuICBnZW5lcmF0ZVVVSUQuVVJMID0gVVJMO1xuICByZXR1cm4gZ2VuZXJhdGVVVUlEO1xufSIsImltcG9ydCBybmcgZnJvbSAnLi9ybmcuanMnO1xuaW1wb3J0IHN0cmluZ2lmeSBmcm9tICcuL3N0cmluZ2lmeS5qcyc7XG5cbmZ1bmN0aW9uIHY0KG9wdGlvbnMsIGJ1Ziwgb2Zmc2V0KSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICB2YXIgcm5kcyA9IG9wdGlvbnMucmFuZG9tIHx8IChvcHRpb25zLnJuZyB8fCBybmcpKCk7IC8vIFBlciA0LjQsIHNldCBiaXRzIGZvciB2ZXJzaW9uIGFuZCBgY2xvY2tfc2VxX2hpX2FuZF9yZXNlcnZlZGBcblxuICBybmRzWzZdID0gcm5kc1s2XSAmIDB4MGYgfCAweDQwO1xuICBybmRzWzhdID0gcm5kc1s4XSAmIDB4M2YgfCAweDgwOyAvLyBDb3B5IGJ5dGVzIHRvIGJ1ZmZlciwgaWYgcHJvdmlkZWRcblxuICBpZiAoYnVmKSB7XG4gICAgb2Zmc2V0ID0gb2Zmc2V0IHx8IDA7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IDE2OyArK2kpIHtcbiAgICAgIGJ1ZltvZmZzZXQgKyBpXSA9IHJuZHNbaV07XG4gICAgfVxuXG4gICAgcmV0dXJuIGJ1ZjtcbiAgfVxuXG4gIHJldHVybiBzdHJpbmdpZnkocm5kcyk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IHY0OyIsImltcG9ydCB2MzUgZnJvbSAnLi92MzUuanMnO1xuaW1wb3J0IHNoYTEgZnJvbSAnLi9zaGExLmpzJztcbnZhciB2NSA9IHYzNSgndjUnLCAweDUwLCBzaGExKTtcbmV4cG9ydCBkZWZhdWx0IHY1OyIsImltcG9ydCBSRUdFWCBmcm9tICcuL3JlZ2V4LmpzJztcblxuZnVuY3Rpb24gdmFsaWRhdGUodXVpZCkge1xuICByZXR1cm4gdHlwZW9mIHV1aWQgPT09ICdzdHJpbmcnICYmIFJFR0VYLnRlc3QodXVpZCk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IHZhbGlkYXRlOyIsImltcG9ydCB2YWxpZGF0ZSBmcm9tICcuL3ZhbGlkYXRlLmpzJztcblxuZnVuY3Rpb24gdmVyc2lvbih1dWlkKSB7XG4gIGlmICghdmFsaWRhdGUodXVpZCkpIHtcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ0ludmFsaWQgVVVJRCcpO1xuICB9XG5cbiAgcmV0dXJuIHBhcnNlSW50KHV1aWQuc3Vic3RyKDE0LCAxKSwgMTYpO1xufVxuXG5leHBvcnQgZGVmYXVsdCB2ZXJzaW9uOyIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0X193ZWJwYWNrX21vZHVsZXNfX1ttb2R1bGVJZF0uY2FsbChtb2R1bGUuZXhwb3J0cywgbW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cblx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcblx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xufVxuXG4iLCIvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9ucyBmb3IgaGFybW9ueSBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSAoZXhwb3J0cywgZGVmaW5pdGlvbikgPT4ge1xuXHRmb3IodmFyIGtleSBpbiBkZWZpbml0aW9uKSB7XG5cdFx0aWYoX193ZWJwYWNrX3JlcXVpcmVfXy5vKGRlZmluaXRpb24sIGtleSkgJiYgIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBrZXkpKSB7XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywga2V5LCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZGVmaW5pdGlvbltrZXldIH0pO1xuXHRcdH1cblx0fVxufTsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSAob2JqLCBwcm9wKSA9PiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCkpIiwiLy8gZGVmaW5lIF9fZXNNb2R1bGUgb24gZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5yID0gKGV4cG9ydHMpID0+IHtcblx0aWYodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnRvU3RyaW5nVGFnKSB7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFN5bWJvbC50b1N0cmluZ1RhZywgeyB2YWx1ZTogJ01vZHVsZScgfSk7XG5cdH1cblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcbn07IiwiIiwiLy8gc3RhcnR1cFxuLy8gTG9hZCBlbnRyeSBtb2R1bGUgYW5kIHJldHVybiBleHBvcnRzXG4vLyBUaGlzIGVudHJ5IG1vZHVsZSBpcyByZWZlcmVuY2VkIGJ5IG90aGVyIG1vZHVsZXMgc28gaXQgY2FuJ3QgYmUgaW5saW5lZFxudmFyIF9fd2VicGFja19leHBvcnRzX18gPSBfX3dlYnBhY2tfcmVxdWlyZV9fKFwiLi9zcmMvYXBwL2JhY2tncm91bmQudHNcIik7XG4iLCIiXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=