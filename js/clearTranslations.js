/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/app/utils/createShadowOverlay.ts":
/*!**********************************************!*\
  !*** ./src/app/utils/createShadowOverlay.ts ***!
  \**********************************************/
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
exports.ichigoReaderElementClassName = void 0;
exports.createShadowOverlay = createShadowOverlay;
const appConfig_1 = __webpack_require__(/*! ../../utils/appConfig */ "./src/utils/appConfig.ts");
const fitText_1 = __webpack_require__(/*! ./fitText */ "./src/app/utils/fitText.ts");
const maxZindex = '2147483647';
exports.ichigoReaderElementClassName = 'ichigoReaderElement';
function createShadowOverlay(root, element, onRemoved, onChanged) {
    var _a;
    if (!root) {
        throw new Error(`root not initialized. Element:\n ${element}`);
    }
    if (element == null) {
        return null;
    }
    const overlayTextListeners = [];
    const overlay = document.createElement('div');
    overlay.style.all = 'initial';
    overlay.style.position = 'absolute';
    overlay.style.zIndex = maxZindex;
    overlay.style.pointerEvents = 'none';
    setOverlayPosition(overlay, element);
    root.append(overlay);
    const updateOverlayPosition = () => {
        setOverlayPosition(overlay, element);
        for (const overlayTextListener of overlayTextListeners) {
            overlayTextListener();
        }
        onChanged();
    };
    const resizeObserver = new ResizeObserver(updateOverlayPosition);
    resizeObserver.observe(element);
    const intersectionObserver = new IntersectionObserver(updateOverlayPosition);
    intersectionObserver.observe(element);
    // Remove overlay if element is removed.
    const config = { attributes: true, childList: true, subtree: true };
    const mutationObserver = new MutationObserver(mutationList => {
        if (!document.body.contains(element)) {
            overlay.remove();
            onRemoved();
        }
        if (element.hidden ||
            element.style.visibility === 'hidden' ||
            element.style.display === 'none') {
            overlay.remove();
            onRemoved();
        }
        for (const mutationRecord of mutationList) {
            if (mutationRecord.removedNodes) {
                for (const removedNode of mutationRecord.removedNodes) {
                    if (element === removedNode) {
                        overlay.remove();
                        onRemoved();
                    }
                }
            }
        }
        updateOverlayPosition();
    });
    // Null check required due to race conditions with DOM renders.
    mutationObserver.observe((_a = document.body) !== null && _a !== void 0 ? _a : document.head, config);
    // Remove overlay if element src changes.
    const elementObserver = new MutationObserver(changes => {
        // Extension changed the src.
        const isSrcChange = changes.some(change => change.attributeName === 'src');
        if (isSrcChange) {
            overlay.remove();
            onRemoved();
        }
        updateOverlayPosition();
    });
    elementObserver.observe(element, { attributes: true });
    window.addEventListener('resize', () => {
        setOverlayPosition(overlay, element);
    });
    const loadingSpinner = document.createElement('div');
    loadingSpinner.style.position = 'absolute';
    loadingSpinner.style.zIndex = maxZindex;
    loadingSpinner.style.top = '0px';
    loadingSpinner.style.fontSize = '30px';
    loadingSpinner.className = `ichigo-spinner ${exports.ichigoReaderElementClassName}`;
    loadingSpinner.textContent = '🍓';
    let displayTimeout;
    overlay.setLoading = (value) => {
        if (value) {
            displayTimeout = setTimeout(() => {
                overlay.append(loadingSpinner);
            }, 500);
        }
        else {
            clearTimeout(displayTimeout);
            loadingSpinner.remove();
        }
    };
    const header = document.createElement('div');
    header.style.all = 'initial';
    header.style.position = 'absolute';
    header.style.zIndex = maxZindex;
    header.style.top = '8px';
    header.style.left = '45px';
    header.style.fontSize = '30px';
    header.className = `overlayHeader ${exports.ichigoReaderElementClassName}`;
    overlay.displayHeaderMessage = (message, fontFamily) => {
        // Clear previous header message, if there was one.
        header.remove();
        header.style.color = 'black';
        header.style.fontFamily = fontFamily;
        header.style.webkitTextStroke = '1px white';
        header.textContent = message;
        overlay.append(header);
    };
    overlay.removeHeaderMessage = () => {
        header.remove();
    };
    overlay.addMessage = (message, ...append) => __awaiter(this, void 0, void 0, function* () {
        const textBox = createTextBox();
        textBox.textContent = message;
        textBox.append(...append);
        overlay.append(textBox);
        const [_, updateTextSizes] = yield (0, fitText_1.fitText)([textBox], [30]);
        overlayTextListeners.push(updateTextSizes);
    });
    overlay.addSystemMessage = (message, ...append) => __awaiter(this, void 0, void 0, function* () {
        const textBox = createTextBox();
        textBox.style.width = 'initial';
        textBox.style.minWidth = '200px';
        textBox.style.maxWidth = '400px';
        const textBoxText = document.createElement('span');
        textBoxText.style.width = '200px';
        textBoxText.textContent = message;
        textBox.append(textBoxText);
        textBox.append(...append);
        overlay.append(textBox);
        const [_, updateTextSizes] = yield (0, fitText_1.fitText)([textBox], [30]);
        overlayTextListeners.push(updateTextSizes);
    });
    return overlay;
}
function setOverlayPosition(overlay, referenceElement) {
    const boundingBox = getElementPosition(referenceElement);
    overlay.style.top = `${boundingBox.top}px`;
    overlay.style.left = `${boundingBox.left}px`;
    overlay.style.width = `${boundingBox.width}px`;
    overlay.style.height = `${boundingBox.height}px`;
}
function getElementPosition(element) {
    let style = getComputedStyle(element);
    const absRec = getAbsoluteBoundingRect(element);
    let offsetWidth = element.offsetWidth;
    let offsetHeight = element.offsetHeight;
    let top = absRec.top;
    let left = absRec.left;
    let xPaddingSum = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    let yPaddingSum = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    let width = offsetWidth -
        xPaddingSum -
        (parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth));
    let height = offsetHeight -
        yPaddingSum -
        (parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth));
    top += parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop);
    left += parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
    return { top: top, left: left, width: width, height: height };
}
function getAbsoluteBoundingRect(el) {
    let doc = document, win = window, body = doc.body, 
    // pageXOffset and pageYOffset work everywhere except IE <9.
    offsetX = win.pageXOffset !== undefined
        ? win.pageXOffset
        : (doc.documentElement || body.parentNode || body).scrollLeft, offsetY = win.pageYOffset !== undefined
        ? win.pageYOffset
        : (doc.documentElement || body.parentNode || body).scrollTop, rect = el.getBoundingClientRect();
    if (el !== body) {
        let parent = el.parentNode;
        // The element's rect will be affected by the scroll positions of
        // *all* of its scrollable parents, not just the window, so we have
        // to walk up the tree and collect every scroll offset. Good times.
        while (parent && parent !== body) {
            offsetX += parent.scrollLeft;
            offsetY += parent.scrollTop;
            parent = parent.parentNode;
        }
    }
    return {
        bottom: rect.bottom + offsetY,
        height: rect.height,
        left: rect.left + offsetX,
        right: rect.right + offsetX,
        top: rect.top + offsetY,
        width: rect.width
    };
}
function createTextBox() {
    const textBox = document.createElement('div');
    textBox.className = exports.ichigoReaderElementClassName;
    textBox.style.all = 'initial';
    textBox.style.display = 'grid';
    textBox.style.placeItems = 'center';
    textBox.style.textAlign = 'center';
    textBox.style.backgroundColor = 'white';
    textBox.style.padding = '8px';
    textBox.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)';
    textBox.style.position = 'absolute';
    textBox.style.borderRadius = '8px';
    textBox.style.zIndex = maxZindex;
    textBox.style.pointerEvents = 'all';
    textBox.style.textShadow =
        'calc(1.5px*1) calc(1.5px*0) 0 #fff,calc(1.5px*0.924) calc(1.5px*0.383) 0 #fff,calc(1.5px*0.707) calc(1.5px*0.707) 0 #fff,calc(1.5px*0.383) calc(1.5px*0.924) 0 #fff,calc(1.5px*0) calc(1.5px*1) 0 #fff,calc(1.5px*-0.383) calc(1.5px*0.924) 0 #fff,calc(1.5px*-0.707) calc(1.5px*0.707) 0 #fff,calc(1.5px*-0.924) calc(1.5px*0.3827) 0 #fff,calc(1.5px*-1) calc(1.5px*0) 0 #fff,calc(1.5px*-0.924) calc(1.5px*-0.383) 0 #fff,calc(1.5px*-0.707) calc(1.5px*-0.707) 0 #fff,calc(1.5px*-0.383) calc(1.5px*-0.924) 0 #fff,calc(1.5px*0) calc(1.5px*-1) 0 #fff,calc(1.5px*0.383) calc(1.5px*-0.924) 0 #fff,calc(1.5px*0.707) calc(1.5px*-0.707) 0 #fff,calc(1.5px*0.924) calc(1.5px*-0.383) 0 #fff';
    textBox.style.top = '6px';
    textBox.style.left = '6px';
    textBox.style.width = '200px';
    textBox.style.height = '200px';
    textBox.style.fontFamily = appConfig_1.appConfig.getUIFontFamily();
    textBox.style.color = '#976353';
    return textBox;
}


/***/ }),

/***/ "./src/app/utils/elementUtils.ts":
/*!***************************************!*\
  !*** ./src/app/utils/elementUtils.ts ***!
  \***************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.checkIsImageElement = checkIsImageElement;
exports.checkIsCanvasElement = checkIsCanvasElement;
exports.checkIsBgImageElement = checkIsBgImageElement;
exports.getBackgroundUrl = getBackgroundUrl;
function checkIsImageElement(node) {
    return node.nodeName.toLowerCase() === 'img';
}
function checkIsCanvasElement(node) {
    return node.nodeName.toLowerCase() === 'canvas';
}
function checkIsBgImageElement(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE || !(node instanceof HTMLElement)) {
        return false;
    }
    if (checkIsImageElement(node) || checkIsCanvasElement(node)) {
        return false;
    }
    const element = node;
    // Computed styles.
    const computedStyle = window.getComputedStyle(element);
    const cbackgroundImage = computedStyle.getPropertyValue('background-image');
    const cbackground = computedStyle.getPropertyValue('background');
    // Inline styles.
    const style = element.style;
    const sbackgroundImage = style.backgroundImage;
    const sbackground = style.background;
    const hasCbackgroundUrl = cbackgroundImage.includes('url(') || cbackground.includes('url(');
    const hasSbackgroundUrl = sbackgroundImage.includes('url(') || sbackground.includes('url(');
    // Check if background-image or background contains a URL
    return hasCbackgroundUrl || hasSbackgroundUrl;
}
function getBackgroundUrl(element) {
    // Check inline styles for background url.
    const backgroundImage = element.style.backgroundImage;
    const background = element.style.background;
    if (backgroundImage.includes('url(')) {
        const url = backgroundImage.match(/url\(([^)]+)\)/)[1];
        return stripOuterQuotes(url);
    }
    else if (background.includes('url(')) {
        const url = background.match(/url\(([^)]+)\)/)[1];
        return stripOuterQuotes(url);
    }
    // Check computed styles for background url.
    const computedStyle = window.getComputedStyle(element);
    const computedBackgroundImage = computedStyle.getPropertyValue('background-image');
    const computedBackground = computedStyle.getPropertyValue('background');
    if (computedBackgroundImage.includes('url(')) {
        const url = computedBackgroundImage.match(/url\(([^)]+)\)/)[1];
        return stripOuterQuotes(url);
    }
    else if (computedBackground.includes('url(')) {
        const url = computedBackground.match(/url\(([^)]+)\)/)[1];
        return stripOuterQuotes(url);
    }
    return undefined;
}
function stripOuterQuotes(str) {
    return str.replace(/^['"]|['"]$/g, '');
}


/***/ }),

/***/ "./src/app/utils/fitText.ts":
/*!**********************************!*\
  !*** ./src/app/utils/fitText.ts ***!
  \**********************************/
/***/ (function(__unused_webpack_module, exports) {


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
exports.fitText = void 0;
/*!
 * FitText.js 1.0 jQuery free version
 *
 * Copyright 2011, Dave Rupert http://daverupert.com
 * Released under the WTFPL license
 * http://sam.zoy.org/wtfpl/
 * Modified by Slawomir Kolodziej http://slawekk.info
 *
 * Date: Tue Aug 09 2011 10:45:54 GMT+0200 (CEST)
 */
const fitText = function (elements, originalFontSizes) {
    return __awaiter(this, void 0, void 0, function* () {
        const fit = function (elements) {
            return __awaiter(this, void 0, void 0, function* () {
                const resizer = function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        let tries = 0;
                        for (const [i, element] of elements.entries()) {
                            element.style.fontSize = `${originalFontSizes[i]}px`;
                        }
                        yield waitForNextFrame();
                        do {
                            let isOverflowing = elements.some(checkIsOverflowing);
                            if (!isOverflowing) {
                                // Refresh to make sure.
                                // Pragrammatically, it seems as though waiting two frames is required to be sure.
                                yield waitForNextFrame();
                                yield waitForNextFrame();
                                isOverflowing = elements.some(checkIsOverflowing);
                                if (!isOverflowing) {
                                    break;
                                }
                            }
                            // Decrement font size.
                            for (const element of elements) {
                                if (!checkIsOverflowing(element))
                                    continue;
                                const fontSize = getFontSize(element);
                                // If at the minimum font size, increase the element size.
                                if (fontSize <= 14) {
                                    increaseSizeUntilFits(element);
                                }
                                else {
                                    element.style.fontSize = `${getFontSize(element) - 1}px`;
                                }
                            }
                            tries++;
                        } while (tries < 1000);
                    });
                };
                yield resizer();
            });
        };
        yield fit(elements);
        // return set of elements
        return [elements, () => fit(elements)];
    });
};
exports.fitText = fitText;
function increaseSizeUntilFits(element) {
    let increaseTryCount = 0;
    const maxIncreaseTryCount = 20;
    while (checkIsOverflowing(element) && increaseTryCount < maxIncreaseTryCount) {
        element.style.width = `${getWidth(element) + 1}px`;
        element.style.height = `${getHeight(element) + 1}px`;
        increaseTryCount++;
    }
}
function checkIsOverflowing(el) {
    return el.clientWidth < el.scrollWidth || el.clientHeight < el.scrollHeight;
}
function waitForNextFrame() {
    return new Promise(resolve => {
        requestAnimationFrame(resolve);
    });
}
function getFontSize(element) {
    return parseInt(element.style.fontSize, 10);
}
function getWidth(element) {
    return parseInt(element.style.width, 10);
}
function getHeight(element) {
    return parseInt(element.style.height, 10);
}


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
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it uses a non-standard name for the exports (exports).
(() => {
var exports = __webpack_exports__;
/*!**************************************!*\
  !*** ./src/app/clearTranslations.ts ***!
  \**************************************/

var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
const createShadowOverlay_1 = __webpack_require__(/*! ./utils/createShadowOverlay */ "./src/app/utils/createShadowOverlay.ts");
const elementUtils_1 = __webpack_require__(/*! ./utils/elementUtils */ "./src/app/utils/elementUtils.ts");
{
    // Revert canvases and images to their original src.
    let tries = 0;
    while (document.querySelectorAll('[data-original-src]').length !== 0) {
        if (tries > 5) {
            break;
        }
        for (const element of document.querySelectorAll('[data-original-src]')) {
            if ((0, elementUtils_1.checkIsCanvasElement)(element)) {
                const originalSrc = element.getAttribute('data-original-src');
                const originalImage = new Image();
                originalImage.onload = () => {
                    element.width = originalImage.width;
                    element.height = originalImage.height;
                    const context = element.getContext('2d');
                    if (context) {
                        context.drawImage(originalImage, 0, 0);
                    }
                    element.removeAttribute('data-original-src');
                    element.removeAttribute('data-translated');
                };
                originalImage.src = originalSrc;
            }
            else if ((0, elementUtils_1.checkIsImageElement)(element)) {
                element.setAttribute('src', element.getAttribute('data-original-src'));
                element.removeAttribute('data-original-src');
                element.removeAttribute('data-translated');
            }
            else {
                // Element with a background image.
                const originalSrc = element.getAttribute('data-original-src');
                if (((_a = element === null || element === void 0 ? void 0 : element.style) === null || _a === void 0 ? void 0 : _a.backgroundImage) && originalSrc) {
                    element.style.backgroundImage = `url("${originalSrc}")`;
                    element.removeAttribute('data-original-src');
                    element.removeAttribute('data-translated');
                }
            }
        }
        tries++;
    }
}
{
    // Remove any overlays or loading spinners.
    let tries = 0;
    while (document.getElementsByClassName(createShadowOverlay_1.ichigoReaderElementClassName).length !== 0) {
        if (tries > 5) {
            break;
        }
        for (const element of document.getElementsByClassName(createShadowOverlay_1.ichigoReaderElementClassName)) {
            element.remove();
        }
        tries++;
    }
}

})();

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xlYXJUcmFuc2xhdGlvbnMuanMiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVlBLGtEQW9LQztBQWhMRCxpR0FBa0Q7QUFDbEQscUZBQW9DO0FBRXBDLE1BQU0sU0FBUyxHQUFHLFlBQVksQ0FBQztBQUNsQixvQ0FBNEIsR0FBRyxxQkFBcUIsQ0FBQztBQVFsRSxTQUFnQixtQkFBbUIsQ0FDbEMsSUFBaUIsRUFDakIsT0FBb0IsRUFDcEIsU0FBcUIsRUFDckIsU0FBcUI7O0lBRXJCLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNYLE1BQU0sSUFBSSxLQUFLLENBQUMsb0NBQW9DLE9BQU8sRUFBRSxDQUFDLENBQUM7SUFDaEUsQ0FBQztJQUVELElBQUksT0FBTyxJQUFJLElBQUksRUFBRSxDQUFDO1FBQ3JCLE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUVELE1BQU0sb0JBQW9CLEdBQW1CLEVBQUUsQ0FBQztJQUNoRCxNQUFNLE9BQU8sR0FBUSxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ25ELE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLFNBQVMsQ0FBQztJQUM5QixPQUFPLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxVQUFVLENBQUM7SUFDcEMsT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsU0FBUyxDQUFDO0lBQ2pDLE9BQU8sQ0FBQyxLQUFLLENBQUMsYUFBYSxHQUFHLE1BQU0sQ0FBQztJQUNyQyxrQkFBa0IsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDckMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUVyQixNQUFNLHFCQUFxQixHQUFHLEdBQUcsRUFBRTtRQUNsQyxrQkFBa0IsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDckMsS0FBSyxNQUFNLG1CQUFtQixJQUFJLG9CQUFvQixFQUFFLENBQUM7WUFDeEQsbUJBQW1CLEVBQUUsQ0FBQztRQUN2QixDQUFDO1FBRUQsU0FBUyxFQUFFLENBQUM7SUFDYixDQUFDLENBQUM7SUFFRixNQUFNLGNBQWMsR0FBRyxJQUFJLGNBQWMsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0lBQ2pFLGNBQWMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7SUFFaEMsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLG9CQUFvQixDQUFDLHFCQUFxQixDQUFDLENBQUM7SUFDN0Usb0JBQW9CLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBRXRDLHdDQUF3QztJQUN4QyxNQUFNLE1BQU0sR0FBRyxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUM7SUFDcEUsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLGdCQUFnQixDQUFDLFlBQVksQ0FBQyxFQUFFO1FBQzVELElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ3RDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNqQixTQUFTLEVBQUUsQ0FBQztRQUNiLENBQUM7UUFFRCxJQUNDLE9BQU8sQ0FBQyxNQUFNO1lBQ2QsT0FBTyxDQUFDLEtBQUssQ0FBQyxVQUFVLEtBQUssUUFBUTtZQUNyQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sS0FBSyxNQUFNLEVBQy9CLENBQUM7WUFDRixPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDakIsU0FBUyxFQUFFLENBQUM7UUFDYixDQUFDO1FBRUQsS0FBSyxNQUFNLGNBQWMsSUFBSSxZQUFZLEVBQUUsQ0FBQztZQUMzQyxJQUFJLGNBQWMsQ0FBQyxZQUFZLEVBQUUsQ0FBQztnQkFDakMsS0FBSyxNQUFNLFdBQVcsSUFBSSxjQUFjLENBQUMsWUFBWSxFQUFFLENBQUM7b0JBQ3ZELElBQUksT0FBTyxLQUFLLFdBQVcsRUFBRSxDQUFDO3dCQUM3QixPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7d0JBQ2pCLFNBQVMsRUFBRSxDQUFDO29CQUNiLENBQUM7Z0JBQ0YsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBRUQscUJBQXFCLEVBQUUsQ0FBQztJQUN6QixDQUFDLENBQUMsQ0FBQztJQUNILCtEQUErRDtJQUMvRCxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsY0FBUSxDQUFDLElBQUksbUNBQUksUUFBUSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztJQUVqRSx5Q0FBeUM7SUFDekMsTUFBTSxlQUFlLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsRUFBRTtRQUN0RCw2QkFBNkI7UUFDN0IsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxhQUFhLEtBQUssS0FBSyxDQUFDLENBQUM7UUFDM0UsSUFBSSxXQUFXLEVBQUUsQ0FBQztZQUNqQixPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDakIsU0FBUyxFQUFFLENBQUM7UUFDYixDQUFDO1FBRUQscUJBQXFCLEVBQUUsQ0FBQztJQUN6QixDQUFDLENBQUMsQ0FBQztJQUNILGVBQWUsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7SUFFdkQsTUFBTSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUU7UUFDdEMsa0JBQWtCLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3RDLENBQUMsQ0FBQyxDQUFDO0lBRUgsTUFBTSxjQUFjLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNyRCxjQUFjLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxVQUFVLENBQUM7SUFDM0MsY0FBYyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsU0FBUyxDQUFDO0lBQ3hDLGNBQWMsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQztJQUNqQyxjQUFjLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxNQUFNLENBQUM7SUFDdkMsY0FBYyxDQUFDLFNBQVMsR0FBRyxrQkFBa0Isb0NBQTRCLEVBQUUsQ0FBQztJQUM1RSxjQUFjLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztJQUNsQyxJQUFJLGNBQWMsQ0FBQztJQUNuQixPQUFPLENBQUMsVUFBVSxHQUFHLENBQUMsS0FBYyxFQUFFLEVBQUU7UUFDdkMsSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUNYLGNBQWMsR0FBRyxVQUFVLENBQUMsR0FBRyxFQUFFO2dCQUNoQyxPQUFPLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQ2hDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUNULENBQUM7YUFBTSxDQUFDO1lBQ1AsWUFBWSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQzdCLGNBQWMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUN6QixDQUFDO0lBQ0YsQ0FBQyxDQUFDO0lBRUYsTUFBTSxNQUFNLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM3QyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxTQUFTLENBQUM7SUFDN0IsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsVUFBVSxDQUFDO0lBQ25DLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLFNBQVMsQ0FBQztJQUNoQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxLQUFLLENBQUM7SUFDekIsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDO0lBQzNCLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLE1BQU0sQ0FBQztJQUMvQixNQUFNLENBQUMsU0FBUyxHQUFHLGlCQUFpQixvQ0FBNEIsRUFBRSxDQUFDO0lBQ25FLE9BQU8sQ0FBQyxvQkFBb0IsR0FBRyxDQUFDLE9BQWUsRUFBRSxVQUFrQixFQUFFLEVBQUU7UUFDdEUsbURBQW1EO1FBQ25ELE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUVoQixNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxPQUFPLENBQUM7UUFDN0IsTUFBTSxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFDO1FBQ3JDLE1BQU0sQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLEdBQUcsV0FBVyxDQUFDO1FBQzVDLE1BQU0sQ0FBQyxXQUFXLEdBQUcsT0FBTyxDQUFDO1FBQzdCLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDeEIsQ0FBQyxDQUFDO0lBQ0YsT0FBTyxDQUFDLG1CQUFtQixHQUFHLEdBQUcsRUFBRTtRQUNsQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDakIsQ0FBQyxDQUFDO0lBRUYsT0FBTyxDQUFDLFVBQVUsR0FBRyxDQUFPLE9BQWUsRUFBRSxHQUFHLE1BQXFCLEVBQUUsRUFBRTtRQUN4RSxNQUFNLE9BQU8sR0FBRyxhQUFhLEVBQUUsQ0FBQztRQUNoQyxPQUFPLENBQUMsV0FBVyxHQUFHLE9BQU8sQ0FBQztRQUM5QixPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUM7UUFFMUIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN4QixNQUFNLENBQUMsQ0FBQyxFQUFFLGVBQWUsQ0FBQyxHQUFHLE1BQU0scUJBQU8sRUFBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM1RCxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7SUFDNUMsQ0FBQyxFQUFDO0lBRUYsT0FBTyxDQUFDLGdCQUFnQixHQUFHLENBQU8sT0FBZSxFQUFFLEdBQUcsTUFBcUIsRUFBRSxFQUFFO1FBQzlFLE1BQU0sT0FBTyxHQUFHLGFBQWEsRUFBRSxDQUFDO1FBQ2hDLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLFNBQVMsQ0FBQztRQUNoQyxPQUFPLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUM7UUFDakMsT0FBTyxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDO1FBRWpDLE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbkQsV0FBVyxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDO1FBQ2xDLFdBQVcsQ0FBQyxXQUFXLEdBQUcsT0FBTyxDQUFDO1FBQ2xDLE9BQU8sQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFNUIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDO1FBRTFCLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDeEIsTUFBTSxDQUFDLENBQUMsRUFBRSxlQUFlLENBQUMsR0FBRyxNQUFNLHFCQUFPLEVBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDNUQsb0JBQW9CLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQzVDLENBQUMsRUFBQztJQUVGLE9BQU8sT0FNTixDQUFDO0FBQ0gsQ0FBQztBQUVELFNBQVMsa0JBQWtCLENBQUMsT0FBb0IsRUFBRSxnQkFBNkI7SUFDOUUsTUFBTSxXQUFXLEdBQUcsa0JBQWtCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztJQUN6RCxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxHQUFHLFdBQVcsQ0FBQyxHQUFHLElBQUksQ0FBQztJQUMzQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxHQUFHLFdBQVcsQ0FBQyxJQUFJLElBQUksQ0FBQztJQUM3QyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxHQUFHLFdBQVcsQ0FBQyxLQUFLLElBQUksQ0FBQztJQUMvQyxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxHQUFHLFdBQVcsQ0FBQyxNQUFNLElBQUksQ0FBQztBQUNsRCxDQUFDO0FBRUQsU0FBUyxrQkFBa0IsQ0FBQyxPQUFvQjtJQUMvQyxJQUFJLEtBQUssR0FBRyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN0QyxNQUFNLE1BQU0sR0FBRyx1QkFBdUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNoRCxJQUFJLFdBQVcsR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDO0lBQ3RDLElBQUksWUFBWSxHQUFHLE9BQU8sQ0FBQyxZQUFZLENBQUM7SUFDeEMsSUFBSSxHQUFHLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQztJQUNyQixJQUFJLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ3ZCLElBQUksV0FBVyxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUNqRixJQUFJLFdBQVcsR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDakYsSUFBSSxLQUFLLEdBQ1IsV0FBVztRQUNYLFdBQVc7UUFDWCxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7SUFDMUUsSUFBSSxNQUFNLEdBQ1QsWUFBWTtRQUNaLFdBQVc7UUFDWCxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUM7SUFDMUUsR0FBRyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUN2RSxJQUFJLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQzFFLE9BQU8sRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLENBQUM7QUFDL0QsQ0FBQztBQUVELFNBQVMsdUJBQXVCLENBQUMsRUFBRTtJQUNsQyxJQUFJLEdBQUcsR0FBRyxRQUFRLEVBQ2pCLEdBQUcsR0FBRyxNQUFNLEVBQ1osSUFBSSxHQUFHLEdBQUcsQ0FBQyxJQUFJO0lBQ2YsNERBQTREO0lBQzVELE9BQU8sR0FDTixHQUFHLENBQUMsV0FBVyxLQUFLLFNBQVM7UUFDNUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXO1FBQ2pCLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxlQUFlLElBQUksSUFBSSxDQUFDLFVBQVUsSUFBSSxJQUFJLENBQVMsQ0FBQyxVQUFVLEVBQ3hFLE9BQU8sR0FDTixHQUFHLENBQUMsV0FBVyxLQUFLLFNBQVM7UUFDNUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXO1FBQ2pCLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxlQUFlLElBQUksSUFBSSxDQUFDLFVBQVUsSUFBSSxJQUFJLENBQVMsQ0FBQyxTQUFTLEVBQ3ZFLElBQUksR0FBRyxFQUFFLENBQUMscUJBQXFCLEVBQUUsQ0FBQztJQUVuQyxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUNqQixJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUMsVUFBVSxDQUFDO1FBRTNCLGlFQUFpRTtRQUNqRSxtRUFBbUU7UUFDbkUsbUVBQW1FO1FBQ25FLE9BQU8sTUFBTSxJQUFJLE1BQU0sS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUNsQyxPQUFPLElBQUksTUFBTSxDQUFDLFVBQVUsQ0FBQztZQUM3QixPQUFPLElBQUksTUFBTSxDQUFDLFNBQVMsQ0FBQztZQUM1QixNQUFNLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQztRQUM1QixDQUFDO0lBQ0YsQ0FBQztJQUVELE9BQU87UUFDTixNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sR0FBRyxPQUFPO1FBQzdCLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtRQUNuQixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxPQUFPO1FBQ3pCLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxHQUFHLE9BQU87UUFDM0IsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLEdBQUcsT0FBTztRQUN2QixLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUs7S0FDakIsQ0FBQztBQUNILENBQUM7QUFFRCxTQUFTLGFBQWE7SUFDckIsTUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM5QyxPQUFPLENBQUMsU0FBUyxHQUFHLG9DQUE0QixDQUFDO0lBQ2pELE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLFNBQVMsQ0FBQztJQUM5QixPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUM7SUFDL0IsT0FBTyxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsUUFBUSxDQUFDO0lBQ3BDLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxHQUFHLFFBQVEsQ0FBQztJQUNuQyxPQUFPLENBQUMsS0FBSyxDQUFDLGVBQWUsR0FBRyxPQUFPLENBQUM7SUFDeEMsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDO0lBQzlCLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxHQUFHLDZEQUE2RCxDQUFDO0lBQ3hGLE9BQU8sQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLFVBQVUsQ0FBQztJQUNwQyxPQUFPLENBQUMsS0FBSyxDQUFDLFlBQVksR0FBRyxLQUFLLENBQUM7SUFDbkMsT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsU0FBUyxDQUFDO0lBQ2pDLE9BQU8sQ0FBQyxLQUFLLENBQUMsYUFBYSxHQUFHLEtBQUssQ0FBQztJQUNwQyxPQUFPLENBQUMsS0FBSyxDQUFDLFVBQVU7UUFDdkIsZ3FCQUFncUIsQ0FBQztJQUNscUIsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUcsS0FBSyxDQUFDO0lBQzFCLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQztJQUMzQixPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxPQUFPLENBQUM7SUFDOUIsT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFDO0lBQy9CLE9BQU8sQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLHFCQUFTLENBQUMsZUFBZSxFQUFFLENBQUM7SUFDdkQsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsU0FBUyxDQUFDO0lBQ2hDLE9BQU8sT0FBTyxDQUFDO0FBQ2hCLENBQUM7Ozs7Ozs7Ozs7Ozs7QUM3UUQsa0RBRUM7QUFFRCxvREFFQztBQUVELHNEQTBCQztBQUVELDRDQTJCQztBQS9ERCxTQUFnQixtQkFBbUIsQ0FBQyxJQUFVO0lBQzdDLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsS0FBSyxLQUFLLENBQUM7QUFDOUMsQ0FBQztBQUVELFNBQWdCLG9CQUFvQixDQUFDLElBQVU7SUFDOUMsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxLQUFLLFFBQVEsQ0FBQztBQUNqRCxDQUFDO0FBRUQsU0FBZ0IscUJBQXFCLENBQUMsSUFBVTtJQUMvQyxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssSUFBSSxDQUFDLFlBQVksSUFBSSxDQUFDLENBQUMsSUFBSSxZQUFZLFdBQVcsQ0FBQyxFQUFFLENBQUM7UUFDcEYsT0FBTyxLQUFLLENBQUM7SUFDZCxDQUFDO0lBRUQsSUFBSSxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1FBQzdELE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztJQUVELE1BQU0sT0FBTyxHQUFHLElBQW1CLENBQUM7SUFFcEMsbUJBQW1CO0lBQ25CLE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN2RCxNQUFNLGdCQUFnQixHQUFHLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0lBQzVFLE1BQU0sV0FBVyxHQUFHLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUVqRSxpQkFBaUI7SUFDakIsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQztJQUM1QixNQUFNLGdCQUFnQixHQUFHLEtBQUssQ0FBQyxlQUFlLENBQUM7SUFDL0MsTUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQztJQUVyQyxNQUFNLGlCQUFpQixHQUFHLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsSUFBSSxXQUFXLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzVGLE1BQU0saUJBQWlCLEdBQUcsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFdBQVcsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFNUYseURBQXlEO0lBQ3pELE9BQU8saUJBQWlCLElBQUksaUJBQWlCLENBQUM7QUFDL0MsQ0FBQztBQUVELFNBQWdCLGdCQUFnQixDQUFDLE9BQW9CO0lBQ3BELDBDQUEwQztJQUMxQyxNQUFNLGVBQWUsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQztJQUN0RCxNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQztJQUU1QyxJQUFJLGVBQWUsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztRQUN0QyxNQUFNLEdBQUcsR0FBRyxlQUFlLENBQUMsS0FBSyxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDdkQsT0FBTyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUM5QixDQUFDO1NBQU0sSUFBSSxVQUFVLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7UUFDeEMsTUFBTSxHQUFHLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2xELE9BQU8sZ0JBQWdCLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDOUIsQ0FBQztJQUVELDRDQUE0QztJQUM1QyxNQUFNLGFBQWEsR0FBRyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDdkQsTUFBTSx1QkFBdUIsR0FBRyxhQUFhLENBQUMsZ0JBQWdCLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUNuRixNQUFNLGtCQUFrQixHQUFHLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUV4RSxJQUFJLHVCQUF1QixDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO1FBQzlDLE1BQU0sR0FBRyxHQUFHLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQy9ELE9BQU8sZ0JBQWdCLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDOUIsQ0FBQztTQUFNLElBQUksa0JBQWtCLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7UUFDaEQsTUFBTSxHQUFHLEdBQUcsa0JBQWtCLENBQUMsS0FBSyxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDMUQsT0FBTyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUM5QixDQUFDO0lBRUQsT0FBTyxTQUFTLENBQUM7QUFDbEIsQ0FBQztBQUVELFNBQVMsZ0JBQWdCLENBQUMsR0FBRztJQUM1QixPQUFPLEdBQUcsQ0FBQyxPQUFPLENBQUMsY0FBYyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQ3hDLENBQUM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDbkVEOzs7Ozs7Ozs7R0FTRztBQUNJLE1BQU0sT0FBTyxHQUFHLFVBQ3RCLFFBQXVCLEVBQ3ZCLGlCQUEyQjs7UUFFM0IsTUFBTSxHQUFHLEdBQUcsVUFBZ0IsUUFBUTs7Z0JBQ25DLE1BQU0sT0FBTyxHQUFHOzt3QkFDZixJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7d0JBRWQsS0FBSyxNQUFNLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDOzRCQUMvQyxPQUFPLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxHQUFHLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7d0JBQ3RELENBQUM7d0JBRUQsTUFBTSxnQkFBZ0IsRUFBRSxDQUFDO3dCQUV6QixHQUFHLENBQUM7NEJBQ0gsSUFBSSxhQUFhLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDOzRCQUN0RCxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7Z0NBQ3BCLHdCQUF3QjtnQ0FDeEIsa0ZBQWtGO2dDQUNsRixNQUFNLGdCQUFnQixFQUFFLENBQUM7Z0NBQ3pCLE1BQU0sZ0JBQWdCLEVBQUUsQ0FBQztnQ0FDekIsYUFBYSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQztnQ0FDbEQsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO29DQUNwQixNQUFNO2dDQUNQLENBQUM7NEJBQ0YsQ0FBQzs0QkFFRCx1QkFBdUI7NEJBQ3ZCLEtBQUssTUFBTSxPQUFPLElBQUksUUFBUSxFQUFFLENBQUM7Z0NBQ2hDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUM7b0NBQUUsU0FBUztnQ0FFM0MsTUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dDQUV0QywwREFBMEQ7Z0NBQzFELElBQUksUUFBUSxJQUFJLEVBQUUsRUFBRSxDQUFDO29DQUNwQixxQkFBcUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztnQ0FDaEMsQ0FBQztxQ0FBTSxDQUFDO29DQUNQLE9BQU8sQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDO2dDQUMxRCxDQUFDOzRCQUNGLENBQUM7NEJBRUQsS0FBSyxFQUFFLENBQUM7d0JBQ1QsQ0FBQyxRQUFRLEtBQUssR0FBRyxJQUFJLEVBQUU7b0JBQ3hCLENBQUM7aUJBQUEsQ0FBQztnQkFFRixNQUFNLE9BQU8sRUFBRSxDQUFDO1lBQ2pCLENBQUM7U0FBQSxDQUFDO1FBRUYsTUFBTSxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFcEIseUJBQXlCO1FBQ3pCLE9BQU8sQ0FBQyxRQUFRLEVBQUUsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUFDeEMsQ0FBQztDQUFBLENBQUM7QUFwRFcsZUFBTyxXQW9EbEI7QUFFRixTQUFTLHFCQUFxQixDQUFDLE9BQW9CO0lBQ2xELElBQUksZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDO0lBQ3pCLE1BQU0sbUJBQW1CLEdBQUcsRUFBRSxDQUFDO0lBQy9CLE9BQU8sa0JBQWtCLENBQUMsT0FBTyxDQUFDLElBQUksZ0JBQWdCLEdBQUcsbUJBQW1CLEVBQUUsQ0FBQztRQUM5RSxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQztRQUNuRCxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQztRQUNyRCxnQkFBZ0IsRUFBRSxDQUFDO0lBQ3BCLENBQUM7QUFDRixDQUFDO0FBQ0QsU0FBUyxrQkFBa0IsQ0FBQyxFQUFFO0lBQzdCLE9BQU8sRUFBRSxDQUFDLFdBQVcsR0FBRyxFQUFFLENBQUMsV0FBVyxJQUFJLEVBQUUsQ0FBQyxZQUFZLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQztBQUM3RSxDQUFDO0FBRUQsU0FBUyxnQkFBZ0I7SUFDeEIsT0FBTyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRTtRQUM1QixxQkFBcUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNoQyxDQUFDLENBQUMsQ0FBQztBQUNKLENBQUM7QUFFRCxTQUFTLFdBQVcsQ0FBQyxPQUFvQjtJQUN4QyxPQUFPLFFBQVEsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUM3QyxDQUFDO0FBRUQsU0FBUyxRQUFRLENBQUMsT0FBb0I7SUFDckMsT0FBTyxRQUFRLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDMUMsQ0FBQztBQUVELFNBQVMsU0FBUyxDQUFDLE9BQW9CO0lBQ3RDLE9BQU8sUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQzNDLENBQUM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDN0ZELGlGQUE0RTtBQUM1RSx1RkFBNkQ7QUFDN0QsZ0dBQW9DO0FBMkNwQyxJQUFLLElBU0o7QUFURCxXQUFLLElBQUk7SUFDUix1QkFBZTtJQUNmLGlDQUF5QjtJQUN6QiwrQkFBdUI7SUFDdkIsaUNBQXlCO0lBQ3pCLGlDQUF5QjtJQUN6QixpQ0FBeUI7SUFDekIsbURBQTJDO0lBQzNDLDZDQUFxQztBQUN0QyxDQUFDLEVBVEksSUFBSSxLQUFKLElBQUksUUFTUjtBQUVZLGdCQUFRLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztJQUNyQyxLQUFLLEVBQUUsRUFBRTtJQUNULFVBQVUsRUFBRSxlQUFlO0lBQzNCLFNBQVMsRUFBRSxTQUFTO0lBQ3BCLFVBQVUsRUFBRSxTQUFTO0lBQ3JCLG1CQUFtQixFQUFFLGdDQUFrQixHQUFFO0lBQ3pDLGdCQUFnQixFQUFFLFlBQVk7Q0FDOUIsQ0FBQyxDQUFDO0FBRUgsaUZBQWlGO0FBQ2pGLDBDQUEwQztBQUMxQyx5R0FBeUc7QUFDekcsc0JBQXNCO0FBQ3RCLE1BQU0sd0JBQXdCLEdBQUcscUJBQXFCLENBQUM7QUFDdkQsTUFBTSxnQkFBZ0IsR0FBRyxFQUFFLENBQUM7QUFFZixpQkFBUyxHQUFjLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFDakQsYUFBYSxFQUFFLEdBQVMsRUFBRTtRQUN6QixNQUFNLFVBQVUsR0FBRyxNQUFNLDhCQUFjLEVBQVMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ2pFLElBQUksVUFBVSxFQUFFLENBQUM7WUFDaEIsT0FBTyxVQUFVLENBQUM7UUFDbkIsQ0FBQztRQUVELDBCQUEwQjtRQUMxQixvRkFBb0Y7UUFDcEYsTUFBTSxPQUFPLEdBQUcsYUFBTSxHQUFFLENBQUM7UUFDekIsTUFBTSw4QkFBYyxFQUFTLElBQUksQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDdkQsT0FBTyxPQUFPLENBQUM7SUFDaEIsQ0FBQztJQUVELFFBQVEsRUFBRSxHQUFTLEVBQUUsMERBQUMsY0FBQyxNQUFNLDhCQUFjLEVBQVMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLG1DQUFJLGdCQUFRLENBQUMsS0FBSztJQUNsRixRQUFRLEVBQUUsQ0FBTyxLQUFhLEVBQUUsRUFBRSxrREFBQyxhQUFNLDhCQUFjLEVBQVMsSUFBSSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUM7SUFFbEYsbUJBQW1CLEVBQUUsR0FBUyxFQUFFO1FBQy9CLE1BQU0sZ0JBQWdCLEdBQUcsTUFBTSw4QkFBYyxFQUFtQixJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUN2RixJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUN2QixPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBRUQsT0FBTyxnQkFBZ0IsQ0FBQztJQUN6QixDQUFDO0lBQ0QsbUJBQW1CLEVBQUUsQ0FBTyxLQUF1QixFQUFFLEVBQUUsa0RBQ3RELGFBQU0sOEJBQWMsRUFBUyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsS0FBSyxDQUFDO0lBRTNELHdGQUF3RjtJQUN4RixzQkFBc0IsRUFBRSxHQUFTLEVBQUU7UUFDbEMsTUFBTSxtQkFBbUIsR0FBRyxNQUFNLDhCQUFjLEVBQWUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFFekYsSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUM7WUFDMUIsT0FBTyxnQ0FBa0IsR0FBRSxDQUFDO1FBQzdCLENBQUM7UUFFRCxPQUFPLG1CQUFtQixDQUFDO0lBQzVCLENBQUM7SUFDRCxzQkFBc0IsRUFBRSxDQUFPLFlBQTBCLEVBQUUsRUFBRTtRQUM1RCxJQUFJLENBQUMsdUJBQWEsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQztZQUMzQyxPQUFPLENBQUMsSUFBSSxDQUFDLDBCQUEwQixZQUFZLDZCQUE2QixDQUFDLENBQUM7WUFDbEYsWUFBWSxHQUFHLGdDQUFrQixHQUFFLENBQUM7UUFDckMsQ0FBQztRQUVELE9BQU8sTUFBTSw4QkFBYyxFQUFlLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxZQUFZLENBQUMsQ0FBQztJQUNuRixDQUFDO0lBQ0QsZUFBZSxFQUFFLEdBQUcsRUFBRTtRQUNyQixNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNsRCxRQUFRLFFBQVEsRUFBRSxDQUFDO1lBQ2xCLDBFQUEwRTtZQUMxRSxLQUFLLElBQUksQ0FBQztZQUNWLEtBQUssSUFBSSxDQUFDO1lBQ1YsS0FBSyxJQUFJLENBQUM7WUFDVixLQUFLLElBQUksQ0FBQztZQUNWLEtBQUssSUFBSSxDQUFDO1lBQ1YsS0FBSyxJQUFJLENBQUM7WUFDVixLQUFLLElBQUk7Z0JBQ1IsT0FBTyxnQkFBZ0IsQ0FBQztZQUN6QjtnQkFDQyxPQUFPLHFCQUFxQixDQUFDO1FBQy9CLENBQUM7SUFDRixDQUFDO0lBRUQsYUFBYSxFQUFFLEdBQVMsRUFBRTs7UUFDekIsTUFBTSxVQUFVLEdBQUcsT0FBQyxNQUFNLDhCQUFjLEVBQVMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLG1DQUFJLGdCQUFRLENBQUMsVUFBVSxDQUFDO1FBQzFGLE1BQU0sUUFBUSxHQUFHLE1BQU0saUJBQVMsQ0FBQyxzQkFBc0IsRUFBRSxDQUFDO1FBQzFELFFBQVEsUUFBUSxFQUFFLENBQUM7WUFDbEIsOERBQThEO1lBQzlELEtBQUssSUFBSSxDQUFDO1lBQ1YsS0FBSyxJQUFJLENBQUM7WUFDVixLQUFLLElBQUksQ0FBQztZQUNWLEtBQUssSUFBSSxDQUFDO1lBQ1YsS0FBSyxPQUFPLENBQUM7WUFDYixLQUFLLE9BQU8sQ0FBQztZQUNiLEtBQUssSUFBSSxDQUFDO1lBQ1YsS0FBSyxJQUFJO2dCQUNSLE9BQU8sZ0JBQWdCLENBQUM7WUFDekI7Z0JBQ0MsT0FBTyxVQUFVLENBQUM7UUFDcEIsQ0FBQztJQUNGLENBQUM7SUFDRCxhQUFhLEVBQUUsQ0FBTyxVQUFrQixFQUFFLEVBQUUsa0RBQzNDLGFBQU0sOEJBQWMsRUFBUyxJQUFJLENBQUMsVUFBVSxFQUFFLFVBQVUsQ0FBQztJQUUxRCxZQUFZLEVBQUUsR0FBUyxFQUFFLDBEQUFDLGNBQUMsTUFBTSw4QkFBYyxFQUFTLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxtQ0FBSSxnQkFBUSxDQUFDLFNBQVM7SUFDOUYsWUFBWSxFQUFFLENBQU8sU0FBaUIsRUFBRSxFQUFFLGtEQUN6QyxhQUFNLDhCQUFjLEVBQVMsSUFBSSxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUM7SUFFeEQsYUFBYSxFQUFFLEdBQVMsRUFBRSwwREFDekIsY0FBQyxNQUFNLDhCQUFjLEVBQVMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLG1DQUFJLGdCQUFRLENBQUMsVUFBVTtJQUN2RSxhQUFhLEVBQUUsQ0FBTyxVQUFrQixFQUFFLEVBQUUsa0RBQzNDLGFBQU0sOEJBQWMsRUFBUyxJQUFJLENBQUMsVUFBVSxFQUFFLFVBQVUsQ0FBQztJQUUxRCxhQUFhLEVBQUUsR0FBUyxFQUFFOztRQUN6QixNQUFNLGVBQWUsR0FBRyxNQUFNLDhCQUFjLEVBQVUsd0JBQXdCLENBQUMsQ0FBQztRQUNoRixJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDdEIsTUFBTSw4QkFBYyxFQUFXLElBQUksQ0FBQyxVQUFVLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztZQUNsRSxNQUFNLDhCQUFjLEVBQVUsd0JBQXdCLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDL0QsQ0FBQztRQUVELE9BQU8sT0FBQyxNQUFNLDhCQUFjLEVBQVcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLG1DQUFJLEVBQUUsQ0FBQztJQUNoRSxDQUFDO0lBQ0QsWUFBWSxFQUFFLENBQU8sU0FBaUIsRUFBRSxFQUFFOztRQUN6QyxNQUFNLGVBQWUsR0FBRyxNQUFNLDhCQUFjLEVBQVUsd0JBQXdCLENBQUMsQ0FBQztRQUNoRixJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDdEIsTUFBTSw4QkFBYyxFQUFXLElBQUksQ0FBQyxVQUFVLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztZQUNsRSxNQUFNLDhCQUFjLEVBQVUsd0JBQXdCLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDL0QsQ0FBQztRQUVELE1BQU0sVUFBVSxHQUFHLE9BQUMsTUFBTSw4QkFBYyxFQUFXLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxtQ0FBSSxFQUFFLENBQUM7UUFDM0UsT0FBTyxNQUFNLDhCQUFjLEVBQVcsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLEdBQUcsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUM7SUFDcEYsQ0FBQztJQUNELGVBQWUsRUFBRSxDQUFPLFNBQWlCLEVBQUUsRUFBRTs7UUFDNUMsTUFBTSxlQUFlLEdBQUcsTUFBTSw4QkFBYyxFQUFVLHdCQUF3QixDQUFDLENBQUM7UUFDaEYsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQ3RCLE1BQU0sOEJBQWMsRUFBVyxJQUFJLENBQUMsVUFBVSxFQUFFLGdCQUFnQixDQUFDLENBQUM7WUFDbEUsTUFBTSw4QkFBYyxFQUFVLHdCQUF3QixFQUFFLElBQUksQ0FBQyxDQUFDO1FBQy9ELENBQUM7UUFFRCxNQUFNLFVBQVUsR0FBRyxPQUFDLE1BQU0sOEJBQWMsRUFBVyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsbUNBQUksRUFBRSxDQUFDO1FBQzNFLE9BQU8sTUFBTSw4QkFBYyxFQUMxQixJQUFJLENBQUMsVUFBVSxFQUNmLFVBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssU0FBUyxDQUFDLENBQzNDLENBQUM7SUFDSCxDQUFDO0NBQ0QsQ0FBQyxDQUFDOzs7Ozs7Ozs7Ozs7O0FDbk1ILHNDQTBCQztBQUVELG9EQUlDO0FBR0QsOENBSUM7QUFFRCxzQ0FFQztBQUVELDRDQU1DO0FBRUQsc0NBYUM7QUFFRCw4REFJQztBQUVELHNEQU9DO0FBRUQsd0NBWUM7QUFFRCx3Q0FZQztBQS9HRCx3REFBd0Q7QUFDeEQsNkVBQTZFO0FBQzdFLFNBQWdCLGFBQWE7SUFHNUIsT0FBTyxJQUFJLE9BQU8sQ0FBZ0UsT0FBTyxDQUFDLEVBQUU7UUFDM0YsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsRUFBRSxVQUFVLElBQUk7WUFDdEUsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUM5QixPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQ25CLE9BQU87WUFDUixDQUFDO1lBRUQsTUFBTSxVQUFVLEdBQVEsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2hDLElBQUksQ0FBQyxXQUFVLGFBQVYsVUFBVSx1QkFBVixVQUFVLENBQUUsR0FBRyxHQUFFLENBQUM7Z0JBQ3RCLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDbkIsT0FBTztZQUNSLENBQUM7WUFFRCxVQUFVLENBQUMsV0FBVyxHQUFHLEdBQUcsRUFBRTtnQkFDN0IsSUFBSSxDQUFDO29CQUNKLE9BQU8sSUFBSSxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQztnQkFDekMsQ0FBQztnQkFBQyxXQUFNLENBQUM7b0JBQ1IsT0FBTyxFQUFFLENBQUM7Z0JBQ1gsQ0FBQztZQUNGLENBQUMsQ0FBQztZQUNGLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNyQixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQUVELFNBQWdCLG9CQUFvQixDQUFDLFdBQTJEO0lBQy9GLE9BQU8sSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUU7UUFDNUIsTUFBTSxDQUFDLHFCQUFxQixDQUFDLGtCQUFrQixDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUN2RSxDQUFDLENBQUMsQ0FBQztBQUNKLENBQUM7QUFFRCw0REFBNEQ7QUFDNUQsU0FBZ0IsaUJBQWlCLENBQUMsUUFBZ0I7SUFDakQsT0FBTyxJQUFJLE9BQU8sQ0FBUyxPQUFPLENBQUMsRUFBRSxDQUNwQyxNQUFNLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsRUFBRSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FDbkUsQ0FBQztBQUNILENBQUM7QUFFRCxTQUFnQixhQUFhLENBQUMsS0FBYTtJQUMxQyxPQUFPLElBQUksT0FBTyxDQUFTLE9BQU8sQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDNUUsQ0FBQztBQUVELFNBQWdCLGdCQUFnQixDQUFDLElBQXlDO0lBQ3pFLE9BQU8sSUFBSSxPQUFPLENBQVUsT0FBTyxDQUFDLEVBQUU7UUFDckMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRTtZQUNoQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDZixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQUVELFNBQWdCLGFBQWEsQ0FDNUIsS0FBYSxFQUNiLFFBQWdCLEVBQ2hCLFNBQW1CO0lBRW5CLE9BQU8sSUFBSSxPQUFPLENBQVUsT0FBTyxDQUFDLEVBQUU7UUFDckMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQzdCLEVBQUUsTUFBTSxFQUFFLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxTQUFTLGFBQVQsU0FBUyxjQUFULFNBQVMsR0FBSSxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUN0RSxHQUFHLEVBQUU7WUFDSixPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDZixDQUFDLENBQ0QsQ0FBQztJQUNILENBQUMsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQUVELFNBQWdCLHlCQUF5QjtJQUN4QyxPQUFPLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQzVCLE1BQU0sQ0FBQyxTQUFTLENBQUMseUJBQXlCLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDckQsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDO0FBRUQsU0FBZ0IscUJBQXFCLENBQUMsT0FBWTtJQUNqRCxNQUFNLFdBQVcsR0FBRyxTQUFTLENBQUMsQ0FBQyw4REFBOEQ7SUFDN0YsTUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDO0lBRTFCLE9BQU8sSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUU7UUFDNUIsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDcEUsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDO0FBRUQsU0FBZ0IsY0FBYyxDQUFJLEdBQVc7SUFDNUMsTUFBTSxZQUFZLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3BDLE9BQU8sSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUU7UUFDNUIsSUFBSSxDQUFDO1lBQ0osTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsWUFBWSxDQUFDLEVBQUUsVUFBVSxNQUFNO2dCQUN4RCxPQUFPLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7WUFDL0IsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDO1FBQUMsV0FBTSxDQUFDO1lBQ1IsNkJBQTZCO1lBQzdCLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNwQixDQUFDO0lBQ0YsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDO0FBRUQsU0FBZ0IsY0FBYyxDQUFJLEdBQVcsRUFBRSxLQUFRO0lBQ3RELE1BQU0sWUFBWSxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNwQyxPQUFPLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQzVCLElBQUksQ0FBQztZQUNKLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLEVBQUUsS0FBSyxFQUFFLEVBQUUsR0FBRyxFQUFFO2dCQUN4RCxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDZixDQUFDLENBQUMsQ0FBQztRQUNKLENBQUM7UUFBQyxXQUFNLENBQUM7WUFDUiw2QkFBNkI7WUFDN0IsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2hCLENBQUM7SUFDRixDQUFDLENBQUMsQ0FBQztBQUNKLENBQUM7QUFFRCxTQUFTLFNBQVMsQ0FBQyxHQUFXO0lBQzdCLE1BQU0sU0FBUyxHQUFHLEtBQUssQ0FBQztJQUN4QixPQUFPLEdBQUcsU0FBUyxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQzlCLENBQUM7Ozs7Ozs7Ozs7Ozs7O0FDeEVELGdEQWFDO0FBRUQsNENBeUNDO0FBcEdELE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO0FBdUJwQixxQkFBYSxHQUFtQjtJQUM1QyxJQUFJO0lBQ0osSUFBSTtJQUNKLElBQUk7SUFDSixJQUFJO0lBQ0osSUFBSTtJQUNKLElBQUk7SUFDSixJQUFJO0lBQ0osSUFBSTtJQUNKLElBQUk7SUFDSixJQUFJO0lBQ0osSUFBSTtJQUNKLE9BQU87SUFDUCxPQUFPO0lBQ1AsSUFBSTtJQUNKLElBQUk7SUFDSixJQUFJO0lBQ0osT0FBTztJQUNQLE9BQU87Q0FDUCxDQUFDO0FBRUYsU0FBZ0Isa0JBQWtCO0lBQ2pDLE1BQU0sUUFBUSxHQUFHLFNBQVMsQ0FBQyxRQUFRLENBQUM7SUFFcEMsTUFBTSxTQUFTLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbkQsTUFBTSxjQUFjLEdBQUcscUJBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7SUFFOUUsSUFBSSxxQkFBYSxDQUFDLFFBQVEsQ0FBQyxRQUF3QixDQUFDLEVBQUUsQ0FBQztRQUN0RCxPQUFPLFFBQXdCLENBQUM7SUFDakMsQ0FBQztTQUFNLElBQUksY0FBYyxFQUFFLENBQUM7UUFDM0IsT0FBTyxjQUFjLENBQUM7SUFDdkIsQ0FBQztTQUFNLENBQUM7UUFDUCxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7QUFDRixDQUFDO0FBRUQsU0FBZ0IsZ0JBQWdCLENBQUMsWUFBMEI7SUFDMUQsUUFBUSxZQUFZLEVBQUUsQ0FBQztRQUN0QixLQUFLLElBQUk7WUFDUixPQUFPLENBQUMsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO1FBQ3BDLEtBQUssSUFBSTtZQUNSLE9BQU8sQ0FBQyxDQUFDLHdCQUF3QixDQUFDLENBQUM7UUFDcEMsS0FBSyxJQUFJO1lBQ1IsT0FBTyxDQUFDLENBQUMseUJBQXlCLENBQUMsQ0FBQztRQUNyQyxLQUFLLElBQUk7WUFDUixPQUFPLENBQUMsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO1FBQ3JDLEtBQUssSUFBSTtZQUNSLE9BQU8sQ0FBQyxDQUFDLHdCQUF3QixDQUFDLENBQUM7UUFDcEMsS0FBSyxJQUFJO1lBQ1IsT0FBTyxDQUFDLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUNuQyxLQUFLLElBQUk7WUFDUixPQUFPLENBQUMsQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO1FBQ3hDLEtBQUssSUFBSTtZQUNSLE9BQU8sQ0FBQyxDQUFDLHlCQUF5QixDQUFDLENBQUM7UUFDckMsS0FBSyxJQUFJO1lBQ1IsT0FBTyxDQUFDLENBQUMsMEJBQTBCLENBQUMsQ0FBQztRQUN0QyxLQUFLLElBQUk7WUFDUixPQUFPLENBQUMsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO1FBQ3BDLEtBQUssSUFBSTtZQUNSLE9BQU8sQ0FBQyxDQUFDLHdCQUF3QixDQUFDLENBQUM7UUFDcEMsS0FBSyxPQUFPO1lBQ1gsT0FBTyxDQUFDLENBQUMscUNBQXFDLENBQUMsQ0FBQztRQUNqRCxLQUFLLE9BQU87WUFDWCxPQUFPLENBQUMsQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO1FBQ3hDLEtBQUssSUFBSTtZQUNSLE9BQU8sQ0FBQyxDQUFDLHlCQUF5QixDQUFDLENBQUM7UUFDckMsS0FBSyxJQUFJO1lBQ1IsT0FBTyxDQUFDLENBQUMsc0JBQXNCLENBQUMsQ0FBQztRQUNsQyxLQUFLLElBQUk7WUFDUixPQUFPLENBQUMsQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO1FBQ3hDLEtBQUssT0FBTztZQUNYLE9BQU8sQ0FBQyxDQUFDLG1DQUFtQyxDQUFDLENBQUM7UUFDL0MsS0FBSyxPQUFPO1lBQ1gsT0FBTyxDQUFDLENBQUMsb0NBQW9DLENBQUMsQ0FBQztRQUNoRDtZQUNDLE9BQU8sU0FBUyxDQUFDO0lBQ25CLENBQUM7QUFDRixDQUFDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ3BHdUM7QUFDQTtBQUNBO0FBQ0E7QUFDRTtBQUNRO0FBQ0U7QUFDRTs7Ozs7Ozs7Ozs7Ozs7O0FDUHREO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsbURBQW1EOztBQUVuRDs7QUFFQSxvQkFBb0IsZ0JBQWdCO0FBQ3BDO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFHQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxrQkFBa0IsY0FBYztBQUNoQztBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsa0JBQWtCLGNBQWM7QUFDaEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFHQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBLGtCQUFrQixhQUFhO0FBQy9CO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUdBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUEsaUVBQWUsR0FBRzs7Ozs7Ozs7Ozs7Ozs7QUN0TmxCLGlFQUFlLHNDQUFzQzs7Ozs7Ozs7Ozs7Ozs7O0FDQWhCOztBQUVyQztBQUNBLE9BQU8sd0RBQVE7QUFDZjtBQUNBOztBQUVBO0FBQ0EsZ0NBQWdDOztBQUVoQztBQUNBO0FBQ0E7QUFDQSxx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YnBhY2s6Ly9pY2hpZ28tcmVhZGVyLy4vc3JjL2FwcC91dGlscy9jcmVhdGVTaGFkb3dPdmVybGF5LnRzIiwid2VicGFjazovL2ljaGlnby1yZWFkZXIvLi9zcmMvYXBwL3V0aWxzL2VsZW1lbnRVdGlscy50cyIsIndlYnBhY2s6Ly9pY2hpZ28tcmVhZGVyLy4vc3JjL2FwcC91dGlscy9maXRUZXh0LnRzIiwid2VicGFjazovL2ljaGlnby1yZWFkZXIvLi9zcmMvdXRpbHMvYXBwQ29uZmlnLnRzIiwid2VicGFjazovL2ljaGlnby1yZWFkZXIvLi9zcmMvdXRpbHMvY2hyb21lQXBpLnRzIiwid2VicGFjazovL2ljaGlnby1yZWFkZXIvLi9zcmMvdXRpbHMvbG9jYWxlcy50cyIsIndlYnBhY2s6Ly9pY2hpZ28tcmVhZGVyLy4vbm9kZV9tb2R1bGVzL3V1aWQvZGlzdC9lc20tYnJvd3Nlci9pbmRleC5qcyIsIndlYnBhY2s6Ly9pY2hpZ28tcmVhZGVyLy4vbm9kZV9tb2R1bGVzL3V1aWQvZGlzdC9lc20tYnJvd3Nlci9tZDUuanMiLCJ3ZWJwYWNrOi8vaWNoaWdvLXJlYWRlci8uL25vZGVfbW9kdWxlcy91dWlkL2Rpc3QvZXNtLWJyb3dzZXIvbmlsLmpzIiwid2VicGFjazovL2ljaGlnby1yZWFkZXIvLi9ub2RlX21vZHVsZXMvdXVpZC9kaXN0L2VzbS1icm93c2VyL3BhcnNlLmpzIiwid2VicGFjazovL2ljaGlnby1yZWFkZXIvLi9ub2RlX21vZHVsZXMvdXVpZC9kaXN0L2VzbS1icm93c2VyL3JlZ2V4LmpzIiwid2VicGFjazovL2ljaGlnby1yZWFkZXIvLi9ub2RlX21vZHVsZXMvdXVpZC9kaXN0L2VzbS1icm93c2VyL3JuZy5qcyIsIndlYnBhY2s6Ly9pY2hpZ28tcmVhZGVyLy4vbm9kZV9tb2R1bGVzL3V1aWQvZGlzdC9lc20tYnJvd3Nlci9zaGExLmpzIiwid2VicGFjazovL2ljaGlnby1yZWFkZXIvLi9ub2RlX21vZHVsZXMvdXVpZC9kaXN0L2VzbS1icm93c2VyL3N0cmluZ2lmeS5qcyIsIndlYnBhY2s6Ly9pY2hpZ28tcmVhZGVyLy4vbm9kZV9tb2R1bGVzL3V1aWQvZGlzdC9lc20tYnJvd3Nlci92MS5qcyIsIndlYnBhY2s6Ly9pY2hpZ28tcmVhZGVyLy4vbm9kZV9tb2R1bGVzL3V1aWQvZGlzdC9lc20tYnJvd3Nlci92My5qcyIsIndlYnBhY2s6Ly9pY2hpZ28tcmVhZGVyLy4vbm9kZV9tb2R1bGVzL3V1aWQvZGlzdC9lc20tYnJvd3Nlci92MzUuanMiLCJ3ZWJwYWNrOi8vaWNoaWdvLXJlYWRlci8uL25vZGVfbW9kdWxlcy91dWlkL2Rpc3QvZXNtLWJyb3dzZXIvdjQuanMiLCJ3ZWJwYWNrOi8vaWNoaWdvLXJlYWRlci8uL25vZGVfbW9kdWxlcy91dWlkL2Rpc3QvZXNtLWJyb3dzZXIvdjUuanMiLCJ3ZWJwYWNrOi8vaWNoaWdvLXJlYWRlci8uL25vZGVfbW9kdWxlcy91dWlkL2Rpc3QvZXNtLWJyb3dzZXIvdmFsaWRhdGUuanMiLCJ3ZWJwYWNrOi8vaWNoaWdvLXJlYWRlci8uL25vZGVfbW9kdWxlcy91dWlkL2Rpc3QvZXNtLWJyb3dzZXIvdmVyc2lvbi5qcyIsIndlYnBhY2s6Ly9pY2hpZ28tcmVhZGVyL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL2ljaGlnby1yZWFkZXIvd2VicGFjay9ydW50aW1lL2RlZmluZSBwcm9wZXJ0eSBnZXR0ZXJzIiwid2VicGFjazovL2ljaGlnby1yZWFkZXIvd2VicGFjay9ydW50aW1lL2hhc093blByb3BlcnR5IHNob3J0aGFuZCIsIndlYnBhY2s6Ly9pY2hpZ28tcmVhZGVyL3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vaWNoaWdvLXJlYWRlci8uL3NyYy9hcHAvY2xlYXJUcmFuc2xhdGlvbnMudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgYXBwQ29uZmlnIH0gZnJvbSAnLi4vLi4vdXRpbHMvYXBwQ29uZmlnJztcbmltcG9ydCB7IGZpdFRleHQgfSBmcm9tICcuL2ZpdFRleHQnO1xuXG5jb25zdCBtYXhaaW5kZXggPSAnMjE0NzQ4MzY0Nyc7XG5leHBvcnQgY29uc3QgaWNoaWdvUmVhZGVyRWxlbWVudENsYXNzTmFtZSA9ICdpY2hpZ29SZWFkZXJFbGVtZW50JztcblxuLy8gTmVjZXNzYXJ5IGJlY2F1c2UgVHlwZVNjcmlwdCBkb2VzIG5vdCBzdXBwb3J0IHRoaXMgb3V0IG9mIGJveCB5ZXQuXG5kZWNsYXJlIGNsYXNzIFJlc2l6ZU9ic2VydmVyIHtcblx0Y29uc3RydWN0b3IobGlzdGVuZXI6IGFueSk7XG5cdG9ic2VydmU6IChlbGVtZW50OiBhbnkpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTaGFkb3dPdmVybGF5KFxuXHRyb290OiBIVE1MRWxlbWVudCxcblx0ZWxlbWVudDogSFRNTEVsZW1lbnQsXG5cdG9uUmVtb3ZlZDogKCkgPT4gdm9pZCxcblx0b25DaGFuZ2VkOiAoKSA9PiB2b2lkXG4pIHtcblx0aWYgKCFyb290KSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGByb290IG5vdCBpbml0aWFsaXplZC4gRWxlbWVudDpcXG4gJHtlbGVtZW50fWApO1xuXHR9XG5cblx0aWYgKGVsZW1lbnQgPT0gbnVsbCkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0Y29uc3Qgb3ZlcmxheVRleHRMaXN0ZW5lcnM6ICgoKSA9PiB2b2lkKVtdID0gW107XG5cdGNvbnN0IG92ZXJsYXk6IGFueSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRvdmVybGF5LnN0eWxlLmFsbCA9ICdpbml0aWFsJztcblx0b3ZlcmxheS5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdG92ZXJsYXkuc3R5bGUuekluZGV4ID0gbWF4WmluZGV4O1xuXHRvdmVybGF5LnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XG5cdHNldE92ZXJsYXlQb3NpdGlvbihvdmVybGF5LCBlbGVtZW50KTtcblx0cm9vdC5hcHBlbmQob3ZlcmxheSk7XG5cblx0Y29uc3QgdXBkYXRlT3ZlcmxheVBvc2l0aW9uID0gKCkgPT4ge1xuXHRcdHNldE92ZXJsYXlQb3NpdGlvbihvdmVybGF5LCBlbGVtZW50KTtcblx0XHRmb3IgKGNvbnN0IG92ZXJsYXlUZXh0TGlzdGVuZXIgb2Ygb3ZlcmxheVRleHRMaXN0ZW5lcnMpIHtcblx0XHRcdG92ZXJsYXlUZXh0TGlzdGVuZXIoKTtcblx0XHR9XG5cblx0XHRvbkNoYW5nZWQoKTtcblx0fTtcblxuXHRjb25zdCByZXNpemVPYnNlcnZlciA9IG5ldyBSZXNpemVPYnNlcnZlcih1cGRhdGVPdmVybGF5UG9zaXRpb24pO1xuXHRyZXNpemVPYnNlcnZlci5vYnNlcnZlKGVsZW1lbnQpO1xuXG5cdGNvbnN0IGludGVyc2VjdGlvbk9ic2VydmVyID0gbmV3IEludGVyc2VjdGlvbk9ic2VydmVyKHVwZGF0ZU92ZXJsYXlQb3NpdGlvbik7XG5cdGludGVyc2VjdGlvbk9ic2VydmVyLm9ic2VydmUoZWxlbWVudCk7XG5cblx0Ly8gUmVtb3ZlIG92ZXJsYXkgaWYgZWxlbWVudCBpcyByZW1vdmVkLlxuXHRjb25zdCBjb25maWcgPSB7IGF0dHJpYnV0ZXM6IHRydWUsIGNoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZSB9O1xuXHRjb25zdCBtdXRhdGlvbk9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIobXV0YXRpb25MaXN0ID0+IHtcblx0XHRpZiAoIWRvY3VtZW50LmJvZHkuY29udGFpbnMoZWxlbWVudCkpIHtcblx0XHRcdG92ZXJsYXkucmVtb3ZlKCk7XG5cdFx0XHRvblJlbW92ZWQoKTtcblx0XHR9XG5cblx0XHRpZiAoXG5cdFx0XHRlbGVtZW50LmhpZGRlbiB8fFxuXHRcdFx0ZWxlbWVudC5zdHlsZS52aXNpYmlsaXR5ID09PSAnaGlkZGVuJyB8fFxuXHRcdFx0ZWxlbWVudC5zdHlsZS5kaXNwbGF5ID09PSAnbm9uZSdcblx0XHQpIHtcblx0XHRcdG92ZXJsYXkucmVtb3ZlKCk7XG5cdFx0XHRvblJlbW92ZWQoKTtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IG11dGF0aW9uUmVjb3JkIG9mIG11dGF0aW9uTGlzdCkge1xuXHRcdFx0aWYgKG11dGF0aW9uUmVjb3JkLnJlbW92ZWROb2Rlcykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHJlbW92ZWROb2RlIG9mIG11dGF0aW9uUmVjb3JkLnJlbW92ZWROb2Rlcykge1xuXHRcdFx0XHRcdGlmIChlbGVtZW50ID09PSByZW1vdmVkTm9kZSkge1xuXHRcdFx0XHRcdFx0b3ZlcmxheS5yZW1vdmUoKTtcblx0XHRcdFx0XHRcdG9uUmVtb3ZlZCgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHVwZGF0ZU92ZXJsYXlQb3NpdGlvbigpO1xuXHR9KTtcblx0Ly8gTnVsbCBjaGVjayByZXF1aXJlZCBkdWUgdG8gcmFjZSBjb25kaXRpb25zIHdpdGggRE9NIHJlbmRlcnMuXG5cdG11dGF0aW9uT2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5ID8/IGRvY3VtZW50LmhlYWQsIGNvbmZpZyk7XG5cblx0Ly8gUmVtb3ZlIG92ZXJsYXkgaWYgZWxlbWVudCBzcmMgY2hhbmdlcy5cblx0Y29uc3QgZWxlbWVudE9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoY2hhbmdlcyA9PiB7XG5cdFx0Ly8gRXh0ZW5zaW9uIGNoYW5nZWQgdGhlIHNyYy5cblx0XHRjb25zdCBpc1NyY0NoYW5nZSA9IGNoYW5nZXMuc29tZShjaGFuZ2UgPT4gY2hhbmdlLmF0dHJpYnV0ZU5hbWUgPT09ICdzcmMnKTtcblx0XHRpZiAoaXNTcmNDaGFuZ2UpIHtcblx0XHRcdG92ZXJsYXkucmVtb3ZlKCk7XG5cdFx0XHRvblJlbW92ZWQoKTtcblx0XHR9XG5cblx0XHR1cGRhdGVPdmVybGF5UG9zaXRpb24oKTtcblx0fSk7XG5cdGVsZW1lbnRPYnNlcnZlci5vYnNlcnZlKGVsZW1lbnQsIHsgYXR0cmlidXRlczogdHJ1ZSB9KTtcblxuXHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgKCkgPT4ge1xuXHRcdHNldE92ZXJsYXlQb3NpdGlvbihvdmVybGF5LCBlbGVtZW50KTtcblx0fSk7XG5cblx0Y29uc3QgbG9hZGluZ1NwaW5uZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0bG9hZGluZ1NwaW5uZXIuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHRsb2FkaW5nU3Bpbm5lci5zdHlsZS56SW5kZXggPSBtYXhaaW5kZXg7XG5cdGxvYWRpbmdTcGlubmVyLnN0eWxlLnRvcCA9ICcwcHgnO1xuXHRsb2FkaW5nU3Bpbm5lci5zdHlsZS5mb250U2l6ZSA9ICczMHB4Jztcblx0bG9hZGluZ1NwaW5uZXIuY2xhc3NOYW1lID0gYGljaGlnby1zcGlubmVyICR7aWNoaWdvUmVhZGVyRWxlbWVudENsYXNzTmFtZX1gO1xuXHRsb2FkaW5nU3Bpbm5lci50ZXh0Q29udGVudCA9ICfwn42TJztcblx0bGV0IGRpc3BsYXlUaW1lb3V0O1xuXHRvdmVybGF5LnNldExvYWRpbmcgPSAodmFsdWU6IGJvb2xlYW4pID0+IHtcblx0XHRpZiAodmFsdWUpIHtcblx0XHRcdGRpc3BsYXlUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdG92ZXJsYXkuYXBwZW5kKGxvYWRpbmdTcGlubmVyKTtcblx0XHRcdH0sIDUwMCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNsZWFyVGltZW91dChkaXNwbGF5VGltZW91dCk7XG5cdFx0XHRsb2FkaW5nU3Bpbm5lci5yZW1vdmUoKTtcblx0XHR9XG5cdH07XG5cblx0Y29uc3QgaGVhZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdGhlYWRlci5zdHlsZS5hbGwgPSAnaW5pdGlhbCc7XG5cdGhlYWRlci5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdGhlYWRlci5zdHlsZS56SW5kZXggPSBtYXhaaW5kZXg7XG5cdGhlYWRlci5zdHlsZS50b3AgPSAnOHB4Jztcblx0aGVhZGVyLnN0eWxlLmxlZnQgPSAnNDVweCc7XG5cdGhlYWRlci5zdHlsZS5mb250U2l6ZSA9ICczMHB4Jztcblx0aGVhZGVyLmNsYXNzTmFtZSA9IGBvdmVybGF5SGVhZGVyICR7aWNoaWdvUmVhZGVyRWxlbWVudENsYXNzTmFtZX1gO1xuXHRvdmVybGF5LmRpc3BsYXlIZWFkZXJNZXNzYWdlID0gKG1lc3NhZ2U6IHN0cmluZywgZm9udEZhbWlseTogc3RyaW5nKSA9PiB7XG5cdFx0Ly8gQ2xlYXIgcHJldmlvdXMgaGVhZGVyIG1lc3NhZ2UsIGlmIHRoZXJlIHdhcyBvbmUuXG5cdFx0aGVhZGVyLnJlbW92ZSgpO1xuXG5cdFx0aGVhZGVyLnN0eWxlLmNvbG9yID0gJ2JsYWNrJztcblx0XHRoZWFkZXIuc3R5bGUuZm9udEZhbWlseSA9IGZvbnRGYW1pbHk7XG5cdFx0aGVhZGVyLnN0eWxlLndlYmtpdFRleHRTdHJva2UgPSAnMXB4IHdoaXRlJztcblx0XHRoZWFkZXIudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuXHRcdG92ZXJsYXkuYXBwZW5kKGhlYWRlcik7XG5cdH07XG5cdG92ZXJsYXkucmVtb3ZlSGVhZGVyTWVzc2FnZSA9ICgpID0+IHtcblx0XHRoZWFkZXIucmVtb3ZlKCk7XG5cdH07XG5cblx0b3ZlcmxheS5hZGRNZXNzYWdlID0gYXN5bmMgKG1lc3NhZ2U6IHN0cmluZywgLi4uYXBwZW5kOiBIVE1MRWxlbWVudFtdKSA9PiB7XG5cdFx0Y29uc3QgdGV4dEJveCA9IGNyZWF0ZVRleHRCb3goKTtcblx0XHR0ZXh0Qm94LnRleHRDb250ZW50ID0gbWVzc2FnZTtcblx0XHR0ZXh0Qm94LmFwcGVuZCguLi5hcHBlbmQpO1xuXG5cdFx0b3ZlcmxheS5hcHBlbmQodGV4dEJveCk7XG5cdFx0Y29uc3QgW18sIHVwZGF0ZVRleHRTaXplc10gPSBhd2FpdCBmaXRUZXh0KFt0ZXh0Qm94XSwgWzMwXSk7XG5cdFx0b3ZlcmxheVRleHRMaXN0ZW5lcnMucHVzaCh1cGRhdGVUZXh0U2l6ZXMpO1xuXHR9O1xuXG5cdG92ZXJsYXkuYWRkU3lzdGVtTWVzc2FnZSA9IGFzeW5jIChtZXNzYWdlOiBzdHJpbmcsIC4uLmFwcGVuZDogSFRNTEVsZW1lbnRbXSkgPT4ge1xuXHRcdGNvbnN0IHRleHRCb3ggPSBjcmVhdGVUZXh0Qm94KCk7XG5cdFx0dGV4dEJveC5zdHlsZS53aWR0aCA9ICdpbml0aWFsJztcblx0XHR0ZXh0Qm94LnN0eWxlLm1pbldpZHRoID0gJzIwMHB4Jztcblx0XHR0ZXh0Qm94LnN0eWxlLm1heFdpZHRoID0gJzQwMHB4JztcblxuXHRcdGNvbnN0IHRleHRCb3hUZXh0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXHRcdHRleHRCb3hUZXh0LnN0eWxlLndpZHRoID0gJzIwMHB4Jztcblx0XHR0ZXh0Qm94VGV4dC50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG5cdFx0dGV4dEJveC5hcHBlbmQodGV4dEJveFRleHQpO1xuXG5cdFx0dGV4dEJveC5hcHBlbmQoLi4uYXBwZW5kKTtcblxuXHRcdG92ZXJsYXkuYXBwZW5kKHRleHRCb3gpO1xuXHRcdGNvbnN0IFtfLCB1cGRhdGVUZXh0U2l6ZXNdID0gYXdhaXQgZml0VGV4dChbdGV4dEJveF0sIFszMF0pO1xuXHRcdG92ZXJsYXlUZXh0TGlzdGVuZXJzLnB1c2godXBkYXRlVGV4dFNpemVzKTtcblx0fTtcblxuXHRyZXR1cm4gb3ZlcmxheSBhcyBIVE1MRGl2RWxlbWVudCAmIHtcblx0XHRhZGRNZXNzYWdlOiAobWVzc2FnZTogc3RyaW5nLCAuLi5hcHBlbmQ6IEhUTUxFbGVtZW50W10pID0+IFByb21pc2U8dm9pZD47XG5cdFx0YWRkU3lzdGVtTWVzc2FnZTogKG1lc3NhZ2U6IHN0cmluZywgLi4uYXBwZW5kOiBIVE1MRWxlbWVudFtdKSA9PiBQcm9taXNlPHZvaWQ+O1xuXHRcdHNldExvYWRpbmc6ICh2YWx1ZTogYm9vbGVhbikgPT4gdm9pZDtcblx0XHRkaXNwbGF5SGVhZGVyTWVzc2FnZTogKG1lc3NhZ2U6IHN0cmluZywgZm9udEZhbWlseTogc3RyaW5nKSA9PiB2b2lkO1xuXHRcdHJlbW92ZUhlYWRlck1lc3NhZ2U6ICgpID0+IHZvaWQ7XG5cdH07XG59XG5cbmZ1bmN0aW9uIHNldE92ZXJsYXlQb3NpdGlvbihvdmVybGF5OiBIVE1MRWxlbWVudCwgcmVmZXJlbmNlRWxlbWVudDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0Y29uc3QgYm91bmRpbmdCb3ggPSBnZXRFbGVtZW50UG9zaXRpb24ocmVmZXJlbmNlRWxlbWVudCk7XG5cdG92ZXJsYXkuc3R5bGUudG9wID0gYCR7Ym91bmRpbmdCb3gudG9wfXB4YDtcblx0b3ZlcmxheS5zdHlsZS5sZWZ0ID0gYCR7Ym91bmRpbmdCb3gubGVmdH1weGA7XG5cdG92ZXJsYXkuc3R5bGUud2lkdGggPSBgJHtib3VuZGluZ0JveC53aWR0aH1weGA7XG5cdG92ZXJsYXkuc3R5bGUuaGVpZ2h0ID0gYCR7Ym91bmRpbmdCb3guaGVpZ2h0fXB4YDtcbn1cblxuZnVuY3Rpb24gZ2V0RWxlbWVudFBvc2l0aW9uKGVsZW1lbnQ6IEhUTUxFbGVtZW50KSB7XG5cdGxldCBzdHlsZSA9IGdldENvbXB1dGVkU3R5bGUoZWxlbWVudCk7XG5cdGNvbnN0IGFic1JlYyA9IGdldEFic29sdXRlQm91bmRpbmdSZWN0KGVsZW1lbnQpO1xuXHRsZXQgb2Zmc2V0V2lkdGggPSBlbGVtZW50Lm9mZnNldFdpZHRoO1xuXHRsZXQgb2Zmc2V0SGVpZ2h0ID0gZWxlbWVudC5vZmZzZXRIZWlnaHQ7XG5cdGxldCB0b3AgPSBhYnNSZWMudG9wO1xuXHRsZXQgbGVmdCA9IGFic1JlYy5sZWZ0O1xuXHRsZXQgeFBhZGRpbmdTdW0gPSBwYXJzZUZsb2F0KHN0eWxlLnBhZGRpbmdMZWZ0KSArIHBhcnNlRmxvYXQoc3R5bGUucGFkZGluZ1JpZ2h0KTtcblx0bGV0IHlQYWRkaW5nU3VtID0gcGFyc2VGbG9hdChzdHlsZS5wYWRkaW5nVG9wKSArIHBhcnNlRmxvYXQoc3R5bGUucGFkZGluZ0JvdHRvbSk7XG5cdGxldCB3aWR0aCA9XG5cdFx0b2Zmc2V0V2lkdGggLVxuXHRcdHhQYWRkaW5nU3VtIC1cblx0XHQocGFyc2VGbG9hdChzdHlsZS5ib3JkZXJMZWZ0V2lkdGgpICsgcGFyc2VGbG9hdChzdHlsZS5ib3JkZXJSaWdodFdpZHRoKSk7XG5cdGxldCBoZWlnaHQgPVxuXHRcdG9mZnNldEhlaWdodCAtXG5cdFx0eVBhZGRpbmdTdW0gLVxuXHRcdChwYXJzZUZsb2F0KHN0eWxlLmJvcmRlclRvcFdpZHRoKSArIHBhcnNlRmxvYXQoc3R5bGUuYm9yZGVyQm90dG9tV2lkdGgpKTtcblx0dG9wICs9IHBhcnNlRmxvYXQoc3R5bGUuYm9yZGVyVG9wV2lkdGgpICsgcGFyc2VGbG9hdChzdHlsZS5wYWRkaW5nVG9wKTtcblx0bGVmdCArPSBwYXJzZUZsb2F0KHN0eWxlLmJvcmRlckxlZnRXaWR0aCkgKyBwYXJzZUZsb2F0KHN0eWxlLnBhZGRpbmdMZWZ0KTtcblx0cmV0dXJuIHsgdG9wOiB0b3AsIGxlZnQ6IGxlZnQsIHdpZHRoOiB3aWR0aCwgaGVpZ2h0OiBoZWlnaHQgfTtcbn1cblxuZnVuY3Rpb24gZ2V0QWJzb2x1dGVCb3VuZGluZ1JlY3QoZWwpIHtcblx0bGV0IGRvYyA9IGRvY3VtZW50LFxuXHRcdHdpbiA9IHdpbmRvdyxcblx0XHRib2R5ID0gZG9jLmJvZHksXG5cdFx0Ly8gcGFnZVhPZmZzZXQgYW5kIHBhZ2VZT2Zmc2V0IHdvcmsgZXZlcnl3aGVyZSBleGNlcHQgSUUgPDkuXG5cdFx0b2Zmc2V0WCA9XG5cdFx0XHR3aW4ucGFnZVhPZmZzZXQgIT09IHVuZGVmaW5lZFxuXHRcdFx0XHQ/IHdpbi5wYWdlWE9mZnNldFxuXHRcdFx0XHQ6ICgoZG9jLmRvY3VtZW50RWxlbWVudCB8fCBib2R5LnBhcmVudE5vZGUgfHwgYm9keSkgYXMgYW55KS5zY3JvbGxMZWZ0LFxuXHRcdG9mZnNldFkgPVxuXHRcdFx0d2luLnBhZ2VZT2Zmc2V0ICE9PSB1bmRlZmluZWRcblx0XHRcdFx0PyB3aW4ucGFnZVlPZmZzZXRcblx0XHRcdFx0OiAoKGRvYy5kb2N1bWVudEVsZW1lbnQgfHwgYm9keS5wYXJlbnROb2RlIHx8IGJvZHkpIGFzIGFueSkuc2Nyb2xsVG9wLFxuXHRcdHJlY3QgPSBlbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblxuXHRpZiAoZWwgIT09IGJvZHkpIHtcblx0XHRsZXQgcGFyZW50ID0gZWwucGFyZW50Tm9kZTtcblxuXHRcdC8vIFRoZSBlbGVtZW50J3MgcmVjdCB3aWxsIGJlIGFmZmVjdGVkIGJ5IHRoZSBzY3JvbGwgcG9zaXRpb25zIG9mXG5cdFx0Ly8gKmFsbCogb2YgaXRzIHNjcm9sbGFibGUgcGFyZW50cywgbm90IGp1c3QgdGhlIHdpbmRvdywgc28gd2UgaGF2ZVxuXHRcdC8vIHRvIHdhbGsgdXAgdGhlIHRyZWUgYW5kIGNvbGxlY3QgZXZlcnkgc2Nyb2xsIG9mZnNldC4gR29vZCB0aW1lcy5cblx0XHR3aGlsZSAocGFyZW50ICYmIHBhcmVudCAhPT0gYm9keSkge1xuXHRcdFx0b2Zmc2V0WCArPSBwYXJlbnQuc2Nyb2xsTGVmdDtcblx0XHRcdG9mZnNldFkgKz0gcGFyZW50LnNjcm9sbFRvcDtcblx0XHRcdHBhcmVudCA9IHBhcmVudC5wYXJlbnROb2RlO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiB7XG5cdFx0Ym90dG9tOiByZWN0LmJvdHRvbSArIG9mZnNldFksXG5cdFx0aGVpZ2h0OiByZWN0LmhlaWdodCxcblx0XHRsZWZ0OiByZWN0LmxlZnQgKyBvZmZzZXRYLFxuXHRcdHJpZ2h0OiByZWN0LnJpZ2h0ICsgb2Zmc2V0WCxcblx0XHR0b3A6IHJlY3QudG9wICsgb2Zmc2V0WSxcblx0XHR3aWR0aDogcmVjdC53aWR0aFxuXHR9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVUZXh0Qm94KCkge1xuXHRjb25zdCB0ZXh0Qm94ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdHRleHRCb3guY2xhc3NOYW1lID0gaWNoaWdvUmVhZGVyRWxlbWVudENsYXNzTmFtZTtcblx0dGV4dEJveC5zdHlsZS5hbGwgPSAnaW5pdGlhbCc7XG5cdHRleHRCb3guc3R5bGUuZGlzcGxheSA9ICdncmlkJztcblx0dGV4dEJveC5zdHlsZS5wbGFjZUl0ZW1zID0gJ2NlbnRlcic7XG5cdHRleHRCb3guc3R5bGUudGV4dEFsaWduID0gJ2NlbnRlcic7XG5cdHRleHRCb3guc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJ3doaXRlJztcblx0dGV4dEJveC5zdHlsZS5wYWRkaW5nID0gJzhweCc7XG5cdHRleHRCb3guc3R5bGUuYm94U2hhZG93ID0gJzAgNHB4IDhweCByZ2JhKDAsIDAsIDAsIDAuMSksIDAgMnB4IDRweCByZ2JhKDAsIDAsIDAsIDAuMDYpJztcblx0dGV4dEJveC5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdHRleHRCb3guc3R5bGUuYm9yZGVyUmFkaXVzID0gJzhweCc7XG5cdHRleHRCb3guc3R5bGUuekluZGV4ID0gbWF4WmluZGV4O1xuXHR0ZXh0Qm94LnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnYWxsJztcblx0dGV4dEJveC5zdHlsZS50ZXh0U2hhZG93ID1cblx0XHQnY2FsYygxLjVweCoxKSBjYWxjKDEuNXB4KjApIDAgI2ZmZixjYWxjKDEuNXB4KjAuOTI0KSBjYWxjKDEuNXB4KjAuMzgzKSAwICNmZmYsY2FsYygxLjVweCowLjcwNykgY2FsYygxLjVweCowLjcwNykgMCAjZmZmLGNhbGMoMS41cHgqMC4zODMpIGNhbGMoMS41cHgqMC45MjQpIDAgI2ZmZixjYWxjKDEuNXB4KjApIGNhbGMoMS41cHgqMSkgMCAjZmZmLGNhbGMoMS41cHgqLTAuMzgzKSBjYWxjKDEuNXB4KjAuOTI0KSAwICNmZmYsY2FsYygxLjVweCotMC43MDcpIGNhbGMoMS41cHgqMC43MDcpIDAgI2ZmZixjYWxjKDEuNXB4Ki0wLjkyNCkgY2FsYygxLjVweCowLjM4MjcpIDAgI2ZmZixjYWxjKDEuNXB4Ki0xKSBjYWxjKDEuNXB4KjApIDAgI2ZmZixjYWxjKDEuNXB4Ki0wLjkyNCkgY2FsYygxLjVweCotMC4zODMpIDAgI2ZmZixjYWxjKDEuNXB4Ki0wLjcwNykgY2FsYygxLjVweCotMC43MDcpIDAgI2ZmZixjYWxjKDEuNXB4Ki0wLjM4MykgY2FsYygxLjVweCotMC45MjQpIDAgI2ZmZixjYWxjKDEuNXB4KjApIGNhbGMoMS41cHgqLTEpIDAgI2ZmZixjYWxjKDEuNXB4KjAuMzgzKSBjYWxjKDEuNXB4Ki0wLjkyNCkgMCAjZmZmLGNhbGMoMS41cHgqMC43MDcpIGNhbGMoMS41cHgqLTAuNzA3KSAwICNmZmYsY2FsYygxLjVweCowLjkyNCkgY2FsYygxLjVweCotMC4zODMpIDAgI2ZmZic7XG5cdHRleHRCb3guc3R5bGUudG9wID0gJzZweCc7XG5cdHRleHRCb3guc3R5bGUubGVmdCA9ICc2cHgnO1xuXHR0ZXh0Qm94LnN0eWxlLndpZHRoID0gJzIwMHB4Jztcblx0dGV4dEJveC5zdHlsZS5oZWlnaHQgPSAnMjAwcHgnO1xuXHR0ZXh0Qm94LnN0eWxlLmZvbnRGYW1pbHkgPSBhcHBDb25maWcuZ2V0VUlGb250RmFtaWx5KCk7XG5cdHRleHRCb3guc3R5bGUuY29sb3IgPSAnIzk3NjM1Myc7XG5cdHJldHVybiB0ZXh0Qm94O1xufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIGNoZWNrSXNJbWFnZUVsZW1lbnQobm9kZTogTm9kZSk6IG5vZGUgaXMgSFRNTEltYWdlRWxlbWVudCB7XG5cdHJldHVybiBub2RlLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdpbWcnO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2hlY2tJc0NhbnZhc0VsZW1lbnQobm9kZTogTm9kZSk6IG5vZGUgaXMgSFRNTENhbnZhc0VsZW1lbnQge1xuXHRyZXR1cm4gbm9kZS5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpID09PSAnY2FudmFzJztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNoZWNrSXNCZ0ltYWdlRWxlbWVudChub2RlOiBOb2RlKTogbm9kZSBpcyBIVE1MRWxlbWVudCB7XG5cdGlmICghbm9kZSB8fCBub2RlLm5vZGVUeXBlICE9PSBOb2RlLkVMRU1FTlRfTk9ERSB8fCAhKG5vZGUgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRpZiAoY2hlY2tJc0ltYWdlRWxlbWVudChub2RlKSB8fCBjaGVja0lzQ2FudmFzRWxlbWVudChub2RlKSkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGNvbnN0IGVsZW1lbnQgPSBub2RlIGFzIEhUTUxFbGVtZW50O1xuXG5cdC8vIENvbXB1dGVkIHN0eWxlcy5cblx0Y29uc3QgY29tcHV0ZWRTdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsZW1lbnQpO1xuXHRjb25zdCBjYmFja2dyb3VuZEltYWdlID0gY29tcHV0ZWRTdHlsZS5nZXRQcm9wZXJ0eVZhbHVlKCdiYWNrZ3JvdW5kLWltYWdlJyk7XG5cdGNvbnN0IGNiYWNrZ3JvdW5kID0gY29tcHV0ZWRTdHlsZS5nZXRQcm9wZXJ0eVZhbHVlKCdiYWNrZ3JvdW5kJyk7XG5cblx0Ly8gSW5saW5lIHN0eWxlcy5cblx0Y29uc3Qgc3R5bGUgPSBlbGVtZW50LnN0eWxlO1xuXHRjb25zdCBzYmFja2dyb3VuZEltYWdlID0gc3R5bGUuYmFja2dyb3VuZEltYWdlO1xuXHRjb25zdCBzYmFja2dyb3VuZCA9IHN0eWxlLmJhY2tncm91bmQ7XG5cblx0Y29uc3QgaGFzQ2JhY2tncm91bmRVcmwgPSBjYmFja2dyb3VuZEltYWdlLmluY2x1ZGVzKCd1cmwoJykgfHwgY2JhY2tncm91bmQuaW5jbHVkZXMoJ3VybCgnKTtcblx0Y29uc3QgaGFzU2JhY2tncm91bmRVcmwgPSBzYmFja2dyb3VuZEltYWdlLmluY2x1ZGVzKCd1cmwoJykgfHwgc2JhY2tncm91bmQuaW5jbHVkZXMoJ3VybCgnKTtcblxuXHQvLyBDaGVjayBpZiBiYWNrZ3JvdW5kLWltYWdlIG9yIGJhY2tncm91bmQgY29udGFpbnMgYSBVUkxcblx0cmV0dXJuIGhhc0NiYWNrZ3JvdW5kVXJsIHx8IGhhc1NiYWNrZ3JvdW5kVXJsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0QmFja2dyb3VuZFVybChlbGVtZW50OiBIVE1MRWxlbWVudCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdC8vIENoZWNrIGlubGluZSBzdHlsZXMgZm9yIGJhY2tncm91bmQgdXJsLlxuXHRjb25zdCBiYWNrZ3JvdW5kSW1hZ2UgPSBlbGVtZW50LnN0eWxlLmJhY2tncm91bmRJbWFnZTtcblx0Y29uc3QgYmFja2dyb3VuZCA9IGVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZDtcblxuXHRpZiAoYmFja2dyb3VuZEltYWdlLmluY2x1ZGVzKCd1cmwoJykpIHtcblx0XHRjb25zdCB1cmwgPSBiYWNrZ3JvdW5kSW1hZ2UubWF0Y2goL3VybFxcKChbXildKylcXCkvKVsxXTtcblx0XHRyZXR1cm4gc3RyaXBPdXRlclF1b3Rlcyh1cmwpO1xuXHR9IGVsc2UgaWYgKGJhY2tncm91bmQuaW5jbHVkZXMoJ3VybCgnKSkge1xuXHRcdGNvbnN0IHVybCA9IGJhY2tncm91bmQubWF0Y2goL3VybFxcKChbXildKylcXCkvKVsxXTtcblx0XHRyZXR1cm4gc3RyaXBPdXRlclF1b3Rlcyh1cmwpO1xuXHR9XG5cblx0Ly8gQ2hlY2sgY29tcHV0ZWQgc3R5bGVzIGZvciBiYWNrZ3JvdW5kIHVybC5cblx0Y29uc3QgY29tcHV0ZWRTdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsZW1lbnQpO1xuXHRjb25zdCBjb21wdXRlZEJhY2tncm91bmRJbWFnZSA9IGNvbXB1dGVkU3R5bGUuZ2V0UHJvcGVydHlWYWx1ZSgnYmFja2dyb3VuZC1pbWFnZScpO1xuXHRjb25zdCBjb21wdXRlZEJhY2tncm91bmQgPSBjb21wdXRlZFN0eWxlLmdldFByb3BlcnR5VmFsdWUoJ2JhY2tncm91bmQnKTtcblxuXHRpZiAoY29tcHV0ZWRCYWNrZ3JvdW5kSW1hZ2UuaW5jbHVkZXMoJ3VybCgnKSkge1xuXHRcdGNvbnN0IHVybCA9IGNvbXB1dGVkQmFja2dyb3VuZEltYWdlLm1hdGNoKC91cmxcXCgoW14pXSspXFwpLylbMV07XG5cdFx0cmV0dXJuIHN0cmlwT3V0ZXJRdW90ZXModXJsKTtcblx0fSBlbHNlIGlmIChjb21wdXRlZEJhY2tncm91bmQuaW5jbHVkZXMoJ3VybCgnKSkge1xuXHRcdGNvbnN0IHVybCA9IGNvbXB1dGVkQmFja2dyb3VuZC5tYXRjaCgvdXJsXFwoKFteKV0rKVxcKS8pWzFdO1xuXHRcdHJldHVybiBzdHJpcE91dGVyUXVvdGVzKHVybCk7XG5cdH1cblxuXHRyZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBzdHJpcE91dGVyUXVvdGVzKHN0cikge1xuXHRyZXR1cm4gc3RyLnJlcGxhY2UoL15bJ1wiXXxbJ1wiXSQvZywgJycpO1xufVxuIiwiLyohXG4gKiBGaXRUZXh0LmpzIDEuMCBqUXVlcnkgZnJlZSB2ZXJzaW9uXG4gKlxuICogQ29weXJpZ2h0IDIwMTEsIERhdmUgUnVwZXJ0IGh0dHA6Ly9kYXZlcnVwZXJ0LmNvbVxuICogUmVsZWFzZWQgdW5kZXIgdGhlIFdURlBMIGxpY2Vuc2VcbiAqIGh0dHA6Ly9zYW0uem95Lm9yZy93dGZwbC9cbiAqIE1vZGlmaWVkIGJ5IFNsYXdvbWlyIEtvbG9kemllaiBodHRwOi8vc2xhd2Vray5pbmZvXG4gKlxuICogRGF0ZTogVHVlIEF1ZyAwOSAyMDExIDEwOjQ1OjU0IEdNVCswMjAwIChDRVNUKVxuICovXG5leHBvcnQgY29uc3QgZml0VGV4dCA9IGFzeW5jIGZ1bmN0aW9uIChcblx0ZWxlbWVudHM6IEhUTUxFbGVtZW50W10sXG5cdG9yaWdpbmFsRm9udFNpemVzOiBudW1iZXJbXVxuKTogUHJvbWlzZTxbSFRNTEVsZW1lbnRbXSwgKCkgPT4gdm9pZF0+IHtcblx0Y29uc3QgZml0ID0gYXN5bmMgZnVuY3Rpb24gKGVsZW1lbnRzKSB7XG5cdFx0Y29uc3QgcmVzaXplciA9IGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRcdGxldCB0cmllcyA9IDA7XG5cblx0XHRcdGZvciAoY29uc3QgW2ksIGVsZW1lbnRdIG9mIGVsZW1lbnRzLmVudHJpZXMoKSkge1xuXHRcdFx0XHRlbGVtZW50LnN0eWxlLmZvbnRTaXplID0gYCR7b3JpZ2luYWxGb250U2l6ZXNbaV19cHhgO1xuXHRcdFx0fVxuXG5cdFx0XHRhd2FpdCB3YWl0Rm9yTmV4dEZyYW1lKCk7XG5cblx0XHRcdGRvIHtcblx0XHRcdFx0bGV0IGlzT3ZlcmZsb3dpbmcgPSBlbGVtZW50cy5zb21lKGNoZWNrSXNPdmVyZmxvd2luZyk7XG5cdFx0XHRcdGlmICghaXNPdmVyZmxvd2luZykge1xuXHRcdFx0XHRcdC8vIFJlZnJlc2ggdG8gbWFrZSBzdXJlLlxuXHRcdFx0XHRcdC8vIFByYWdyYW1tYXRpY2FsbHksIGl0IHNlZW1zIGFzIHRob3VnaCB3YWl0aW5nIHR3byBmcmFtZXMgaXMgcmVxdWlyZWQgdG8gYmUgc3VyZS5cblx0XHRcdFx0XHRhd2FpdCB3YWl0Rm9yTmV4dEZyYW1lKCk7XG5cdFx0XHRcdFx0YXdhaXQgd2FpdEZvck5leHRGcmFtZSgpO1xuXHRcdFx0XHRcdGlzT3ZlcmZsb3dpbmcgPSBlbGVtZW50cy5zb21lKGNoZWNrSXNPdmVyZmxvd2luZyk7XG5cdFx0XHRcdFx0aWYgKCFpc092ZXJmbG93aW5nKSB7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBEZWNyZW1lbnQgZm9udCBzaXplLlxuXHRcdFx0XHRmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZWxlbWVudHMpIHtcblx0XHRcdFx0XHRpZiAoIWNoZWNrSXNPdmVyZmxvd2luZyhlbGVtZW50KSkgY29udGludWU7XG5cblx0XHRcdFx0XHRjb25zdCBmb250U2l6ZSA9IGdldEZvbnRTaXplKGVsZW1lbnQpO1xuXG5cdFx0XHRcdFx0Ly8gSWYgYXQgdGhlIG1pbmltdW0gZm9udCBzaXplLCBpbmNyZWFzZSB0aGUgZWxlbWVudCBzaXplLlxuXHRcdFx0XHRcdGlmIChmb250U2l6ZSA8PSAxNCkge1xuXHRcdFx0XHRcdFx0aW5jcmVhc2VTaXplVW50aWxGaXRzKGVsZW1lbnQpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRlbGVtZW50LnN0eWxlLmZvbnRTaXplID0gYCR7Z2V0Rm9udFNpemUoZWxlbWVudCkgLSAxfXB4YDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0cmllcysrO1xuXHRcdFx0fSB3aGlsZSAodHJpZXMgPCAxMDAwKTtcblx0XHR9O1xuXG5cdFx0YXdhaXQgcmVzaXplcigpO1xuXHR9O1xuXG5cdGF3YWl0IGZpdChlbGVtZW50cyk7XG5cblx0Ly8gcmV0dXJuIHNldCBvZiBlbGVtZW50c1xuXHRyZXR1cm4gW2VsZW1lbnRzLCAoKSA9PiBmaXQoZWxlbWVudHMpXTtcbn07XG5cbmZ1bmN0aW9uIGluY3JlYXNlU2l6ZVVudGlsRml0cyhlbGVtZW50OiBIVE1MRWxlbWVudCkge1xuXHRsZXQgaW5jcmVhc2VUcnlDb3VudCA9IDA7XG5cdGNvbnN0IG1heEluY3JlYXNlVHJ5Q291bnQgPSAyMDtcblx0d2hpbGUgKGNoZWNrSXNPdmVyZmxvd2luZyhlbGVtZW50KSAmJiBpbmNyZWFzZVRyeUNvdW50IDwgbWF4SW5jcmVhc2VUcnlDb3VudCkge1xuXHRcdGVsZW1lbnQuc3R5bGUud2lkdGggPSBgJHtnZXRXaWR0aChlbGVtZW50KSArIDF9cHhgO1xuXHRcdGVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gYCR7Z2V0SGVpZ2h0KGVsZW1lbnQpICsgMX1weGA7XG5cdFx0aW5jcmVhc2VUcnlDb3VudCsrO1xuXHR9XG59XG5mdW5jdGlvbiBjaGVja0lzT3ZlcmZsb3dpbmcoZWwpIHtcblx0cmV0dXJuIGVsLmNsaWVudFdpZHRoIDwgZWwuc2Nyb2xsV2lkdGggfHwgZWwuY2xpZW50SGVpZ2h0IDwgZWwuc2Nyb2xsSGVpZ2h0O1xufVxuXG5mdW5jdGlvbiB3YWl0Rm9yTmV4dEZyYW1lKCkge1xuXHRyZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG5cdFx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lKHJlc29sdmUpO1xuXHR9KTtcbn1cblxuZnVuY3Rpb24gZ2V0Rm9udFNpemUoZWxlbWVudDogSFRNTEVsZW1lbnQpIHtcblx0cmV0dXJuIHBhcnNlSW50KGVsZW1lbnQuc3R5bGUuZm9udFNpemUsIDEwKTtcbn1cblxuZnVuY3Rpb24gZ2V0V2lkdGgoZWxlbWVudDogSFRNTEVsZW1lbnQpIHtcblx0cmV0dXJuIHBhcnNlSW50KGVsZW1lbnQuc3R5bGUud2lkdGgsIDEwKTtcbn1cblxuZnVuY3Rpb24gZ2V0SGVpZ2h0KGVsZW1lbnQ6IEhUTUxFbGVtZW50KSB7XG5cdHJldHVybiBwYXJzZUludChlbGVtZW50LnN0eWxlLmhlaWdodCwgMTApO1xufVxuIiwiaW1wb3J0IHsgZ2V0RGVmYXVsdExhbmd1YWdlLCBMYW5ndWFnZUNvZGUsIGxhbmd1YWdlQ29kZXMgfSBmcm9tICcuL2xvY2FsZXMnO1xuaW1wb3J0IHsgZ2V0U3RvcmFnZUl0ZW0sIHNldFN0b3JhZ2VJdGVtIH0gZnJvbSAnLi9jaHJvbWVBcGknO1xuaW1wb3J0IHsgdjQgYXMgdXVpZHY0IH0gZnJvbSAndXVpZCc7XG5pbXBvcnQgeyBUcmFuc2xhdGlvbk1vZGVsIH0gZnJvbSAnLi9tb2RlbHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEFwcENvbmZpZyB7XG5cdC8vIEdldHMgdGhlIGNsaWVudCB1dWlkLlxuXHRnZXRDbGllbnRVdWlkOiAoKSA9PiBQcm9taXNlPHN0cmluZz47XG5cblx0Ly8gR2V0cyB0aGUgbmFtZSBvZiB0aGUgZm9udCB0aGF0IHNob3VsZCBiZSB1c2VkIGZvciBVSSBzdHJpbmdzLlxuXHQvLyBlZyBgdGV4dC5zdHlsZS5mb250RmFtaWx5ID0gYXBwQ29uZmlnLmdldFVJRm9udE5hbWUoKTtgXG5cdC8vIHJldHVybnMgYHN5c3RlbS1kZWZhdWx0YCBmb3IgbGFuZ3VhZ2VzIHRoYXQgZG9uJ3QgaGF2ZSBhIGZvbnQgZmlsZS5cblx0Z2V0VUlGb250RmFtaWx5OiAoKSA9PiBzdHJpbmc7XG5cblx0Ly8gU2V0L2dldCB0aGUgdHJhbnNsYXRpb24gbW9kZWwgdG8gdXNlIHdoZW4gdHJhbnNsYXRpbmcgbWFuZ2EuIEVnICdncHQ0by1taW5pJywgJ2dwdDRvJywgJ2RlZXBsJywgLi5cblx0Z2V0VHJhbnNsYXRpb25Nb2RlbDogKCkgPT4gUHJvbWlzZTxUcmFuc2xhdGlvbk1vZGVsIHwgdW5kZWZpbmVkPjtcblx0c2V0VHJhbnNsYXRpb25Nb2RlbDogKG1vZGVsOiBUcmFuc2xhdGlvbk1vZGVsKSA9PiBQcm9taXNlPGJvb2xlYW4+O1xuXG5cdC8vIFNldC9nZXQgdGhlIGxhbmd1YWdlIGNvZGUgb2YgdGhlIGxhbmd1YWdlIHRvIHRyYW5zbGF0ZSB0by5cblx0Z2V0VHJhbnNsYXRlVG9MYW5ndWFnZTogKCkgPT4gUHJvbWlzZTxMYW5ndWFnZUNvZGU+O1xuXHRzZXRUcmFuc2xhdGVUb0xhbmd1YWdlOiAobGFuZ3VhZ2VDb2RlOiBMYW5ndWFnZUNvZGUpID0+IFByb21pc2U8Ym9vbGVhbj47XG5cblx0Ly8gU2V0L2dldCBjdXJyZW50IHVzZXIgZW1haWwuXG5cdGdldEVtYWlsOiAoKSA9PiBQcm9taXNlPHN0cmluZz47XG5cdHNldEVtYWlsOiAoZW1haWw6IHN0cmluZykgPT4gUHJvbWlzZTxib29sZWFuPjtcblxuXHQvLyBTZXQvZ2V0IGNvbmZpZ3VyZWQgbWFuZ2EgZm9udCBmYW1pbHkuXG5cdGdldEZvbnRGYW1pbHk6ICgpID0+IFByb21pc2U8c3RyaW5nPjtcblx0c2V0Rm9udEZhbWlseTogKGZvbnRGYW1pbHk6IHN0cmluZykgPT4gUHJvbWlzZTxib29sZWFuPjtcblxuXHQvLyBTZXQvZ2V0IGNvbmZpZ3VyZWQgbWFuZ2EgZm9udCBjb2xvci5cblx0Z2V0Rm9udENvbG9yOiAoKSA9PiBQcm9taXNlPHN0cmluZz47XG5cdHNldEZvbnRDb2xvcjogKGZvbnRDb2xvcjogc3RyaW5nKSA9PiBQcm9taXNlPGJvb2xlYW4+O1xuXG5cdC8vIFNldC9nZXQgY29uZmlndXJlZCBtYW5nYSBmb250IHdlaWdodC5cblx0Z2V0Rm9udFdlaWdodDogKCkgPT4gUHJvbWlzZTxzdHJpbmc+O1xuXHRzZXRGb250V2VpZ2h0OiAoZm9udFdlaWdodDogc3RyaW5nKSA9PiBQcm9taXNlPGJvb2xlYW4+O1xuXG5cdC8vIGFkZC9yZW1vdmUvZ2V0IGFjdGl2ZSB0cmFuc2xhdGlvbiB1cmxzLlxuXHQvLyBBbiBhY3RpdmUgdXJsIGlzIGEgc2l0ZSB0aGUgZXh0ZW5zaW9uIHdpbGwgc2NhbiBmb3IgdHJhbnNsYXRpb24gb3Bwb3J0dW5pdGllcy5cblx0Z2V0QWN0aXZlVXJsczogKCkgPT4gUHJvbWlzZTxzdHJpbmdbXT47XG5cdGFkZEFjdGl2ZVVybDogKGFjdGl2ZVVybDogc3RyaW5nKSA9PiBQcm9taXNlPGJvb2xlYW4+O1xuXHRyZW1vdmVBY3RpdmVVcmw6IChhY3RpdmVVcmw6IHN0cmluZykgPT4gUHJvbWlzZTxib29sZWFuPjtcbn1cblxuZW51bSBLZXlzIHtcblx0RW1haWwgPSAnZW1haWwnLFxuXHRGb250RmFtaWx5ID0gJ2ZvbnRGYW1pbHknLFxuXHRGb250Q29sb3IgPSAnZm9udENvbG9yJyxcblx0Rm9udFdlaWdodCA9ICdmb250V2VpZ2h0Jyxcblx0QWN0aXZlVXJscyA9ICdhY3RpdmVVcmxzJyxcblx0Q2xpZW50VXVpZCA9ICdjbGllbnRVdWlkJyxcblx0VHJhbnNsYXRlVG9MYW5ndWFnZSA9ICd0cmFuc2xhdGVUb0xhbmd1YWdlJyxcblx0VHJhbnNsYXRpb25Nb2RlbCA9ICd0cmFuc2xhdGlvbk1vZGVsJ1xufVxuXG5leHBvcnQgY29uc3QgZGVmYXVsdHMgPSBPYmplY3QuZnJlZXplKHtcblx0ZW1haWw6ICcnLFxuXHRmb250RmFtaWx5OiAnQ0MgV2lsZCBXb3JkcycsXG5cdGZvbnRDb2xvcjogJyMwMDAwMDAnLFxuXHRmb250V2VpZ2h0OiAnaW5pdGlhbCcsXG5cdHRyYW5zbGF0ZVRvTGFuZ3VhZ2U6IGdldERlZmF1bHRMYW5ndWFnZSgpLFxuXHR0cmFuc2xhdGlvbk1vZGVsOiAnZ3B0NG8tbWluaSdcbn0pO1xuXG4vLyBVc2VkIHRvIGNoZWNrIGlmIGFueSBvZiB0aGUgYWN0aXZlVXJsIGFwcENvbmZpZyBwcm9wZXJ0aWVzIGhhdmUgYmVlbiBhY2Nlc3NlZC5cbi8vIFRoaXMgaXMgc28gZGVmYXVsdHMgY2FuIGJlIGluaXRpYWxpemVkLlxuLy8gVGhpcyBjYW5ub3QgYmUgZG9uZSBpbiBjaHJvbWUucnVudGltZS5vbkluc3RhbGxlZCBkdWUgdG8gdGhhdCBldmVudCBiZWluZyB0cmlnZ2VyZWQgb24gY2hyb21lIHVwZGF0ZXMsXG4vLyBhbmQgb24gYXBwIHVwZGF0ZXMuXG5jb25zdCBoYXNJbml0QWN0aXZlVXJsRGVmYXVsdHMgPSAnX2lzQWN0aXZlVXJsSW5pdEtleSc7XG5jb25zdCBjb21tb25NYW5nYVNpdGVzID0gW107XG5cbmV4cG9ydCBjb25zdCBhcHBDb25maWc6IEFwcENvbmZpZyA9IE9iamVjdC5mcmVlemUoe1xuXHRnZXRDbGllbnRVdWlkOiBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY2xpZW50VXVpZCA9IGF3YWl0IGdldFN0b3JhZ2VJdGVtPHN0cmluZz4oS2V5cy5DbGllbnRVdWlkKTtcblx0XHRpZiAoY2xpZW50VXVpZCkge1xuXHRcdFx0cmV0dXJuIGNsaWVudFV1aWQ7XG5cdFx0fVxuXG5cdFx0Ly8gSW5pdGlhbGl6ZSBjbGllbnQgdXVpZC5cblx0XHQvLyBJZiBzdG9yYWdlIGlzIGZ1bGwsIHRoaXMgY291bGQgZmFpbCByZXBlYXRlZGx5LCBidXQgY2xpZW50IHV1aWRzIGFyZSBub3QgY3J1Y2lhbC5cblx0XHRjb25zdCBuZXdVdWlkID0gdXVpZHY0KCk7XG5cdFx0YXdhaXQgc2V0U3RvcmFnZUl0ZW08c3RyaW5nPihLZXlzLkNsaWVudFV1aWQsIG5ld1V1aWQpO1xuXHRcdHJldHVybiBuZXdVdWlkO1xuXHR9LFxuXG5cdGdldEVtYWlsOiBhc3luYyAoKSA9PiAoYXdhaXQgZ2V0U3RvcmFnZUl0ZW08c3RyaW5nPihLZXlzLkVtYWlsKSkgPz8gZGVmYXVsdHMuZW1haWwsXG5cdHNldEVtYWlsOiBhc3luYyAoZW1haWw6IHN0cmluZykgPT4gYXdhaXQgc2V0U3RvcmFnZUl0ZW08c3RyaW5nPihLZXlzLkVtYWlsLCBlbWFpbCksXG5cblx0Z2V0VHJhbnNsYXRpb25Nb2RlbDogYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHRyYW5zbGF0aW9uTW9kZWwgPSBhd2FpdCBnZXRTdG9yYWdlSXRlbTxUcmFuc2xhdGlvbk1vZGVsPihLZXlzLlRyYW5zbGF0aW9uTW9kZWwpO1xuXHRcdGlmICghdHJhbnNsYXRpb25Nb2RlbCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJhbnNsYXRpb25Nb2RlbDtcblx0fSxcblx0c2V0VHJhbnNsYXRpb25Nb2RlbDogYXN5bmMgKG1vZGVsOiBUcmFuc2xhdGlvbk1vZGVsKSA9PlxuXHRcdGF3YWl0IHNldFN0b3JhZ2VJdGVtPHN0cmluZz4oS2V5cy5UcmFuc2xhdGlvbk1vZGVsLCBtb2RlbCksXG5cblx0Ly8gUmV0dXJucyB0aGUgbGFuZ3VhZ2UgY29kZSBvZiB0aGUgbGFuZ3VhZ2UgdG8gdHJhbnNsYXRlIHRvLiBFZyAnZW4nLCAnamEnLCAnemgtQ04nLCAuLlxuXHRnZXRUcmFuc2xhdGVUb0xhbmd1YWdlOiBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgdHJhbnNsYXRlVG9MYW5ndWFnZSA9IGF3YWl0IGdldFN0b3JhZ2VJdGVtPExhbmd1YWdlQ29kZT4oS2V5cy5UcmFuc2xhdGVUb0xhbmd1YWdlKTtcblxuXHRcdGlmICghdHJhbnNsYXRlVG9MYW5ndWFnZSkge1xuXHRcdFx0cmV0dXJuIGdldERlZmF1bHRMYW5ndWFnZSgpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cmFuc2xhdGVUb0xhbmd1YWdlO1xuXHR9LFxuXHRzZXRUcmFuc2xhdGVUb0xhbmd1YWdlOiBhc3luYyAobGFuZ3VhZ2VDb2RlOiBMYW5ndWFnZUNvZGUpID0+IHtcblx0XHRpZiAoIWxhbmd1YWdlQ29kZXMuaW5jbHVkZXMobGFuZ3VhZ2VDb2RlKSkge1xuXHRcdFx0Y29uc29sZS53YXJuKGBJbnZhbGlkIGxhbmd1YWdlIGNvZGU6ICR7bGFuZ3VhZ2VDb2RlfS4gT3ZlcndyaXRpbmcgd2l0aCBkZWZhdWx0LmApO1xuXHRcdFx0bGFuZ3VhZ2VDb2RlID0gZ2V0RGVmYXVsdExhbmd1YWdlKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGF3YWl0IHNldFN0b3JhZ2VJdGVtPExhbmd1YWdlQ29kZT4oS2V5cy5UcmFuc2xhdGVUb0xhbmd1YWdlLCBsYW5ndWFnZUNvZGUpO1xuXHR9LFxuXHRnZXRVSUZvbnRGYW1pbHk6ICgpID0+IHtcblx0XHRjb25zdCBsYW5ndWFnZSA9IG5hdmlnYXRvci5sYW5ndWFnZS5zcGxpdCgnLScpWzBdO1xuXHRcdHN3aXRjaCAobGFuZ3VhZ2UpIHtcblx0XHRcdC8vIE5vIGZvbnQgZmlsZSBhdCB0aGUgbW9tZW50IGZvciB0aGVzZTogdXNlIHdoYXRldmVyIHRoZSBkZWZhdWx0IGZvbnQgaXMuXG5cdFx0XHRjYXNlICdoaSc6XG5cdFx0XHRjYXNlICd0aCc6XG5cdFx0XHRjYXNlICdqYSc6XG5cdFx0XHRjYXNlICdrbyc6XG5cdFx0XHRjYXNlICd6aCc6XG5cdFx0XHRjYXNlICd2aSc6XG5cdFx0XHRjYXNlICdhcic6XG5cdFx0XHRcdHJldHVybiAnc3lzdGVtLWRlZmF1bHQnO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuICdQYXRyaWNrSGFuZC1SZWd1bGFyJztcblx0XHR9XG5cdH0sXG5cblx0Z2V0Rm9udEZhbWlseTogYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZvbnRGYW1pbHkgPSAoYXdhaXQgZ2V0U3RvcmFnZUl0ZW08c3RyaW5nPihLZXlzLkZvbnRGYW1pbHkpKSA/PyBkZWZhdWx0cy5mb250RmFtaWx5O1xuXHRcdGNvbnN0IGxhbmd1YWdlID0gYXdhaXQgYXBwQ29uZmlnLmdldFRyYW5zbGF0ZVRvTGFuZ3VhZ2UoKTtcblx0XHRzd2l0Y2ggKGxhbmd1YWdlKSB7XG5cdFx0XHQvLyBUaGVzZSBsYW5ndWFnZXMgYXJlIHVuc3VwcG9ydGVkIGZvciB0aGUgdXN1YWwgZm9udCBvcHRpb25zLlxuXHRcdFx0Y2FzZSAnaGknOlxuXHRcdFx0Y2FzZSAndGgnOlxuXHRcdFx0Y2FzZSAnamEnOlxuXHRcdFx0Y2FzZSAna28nOlxuXHRcdFx0Y2FzZSAnemgtQ04nOlxuXHRcdFx0Y2FzZSAnemgtVFcnOlxuXHRcdFx0Y2FzZSAndmknOlxuXHRcdFx0Y2FzZSAnYXInOlxuXHRcdFx0XHRyZXR1cm4gJ3N5c3RlbS1kZWZhdWx0Jztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBmb250RmFtaWx5O1xuXHRcdH1cblx0fSxcblx0c2V0Rm9udEZhbWlseTogYXN5bmMgKGZvbnRGYW1pbHk6IHN0cmluZykgPT5cblx0XHRhd2FpdCBzZXRTdG9yYWdlSXRlbTxzdHJpbmc+KEtleXMuRm9udEZhbWlseSwgZm9udEZhbWlseSksXG5cblx0Z2V0Rm9udENvbG9yOiBhc3luYyAoKSA9PiAoYXdhaXQgZ2V0U3RvcmFnZUl0ZW08c3RyaW5nPihLZXlzLkZvbnRDb2xvcikpID8/IGRlZmF1bHRzLmZvbnRDb2xvcixcblx0c2V0Rm9udENvbG9yOiBhc3luYyAoZm9udENvbG9yOiBzdHJpbmcpID0+XG5cdFx0YXdhaXQgc2V0U3RvcmFnZUl0ZW08c3RyaW5nPihLZXlzLkZvbnRDb2xvciwgZm9udENvbG9yKSxcblxuXHRnZXRGb250V2VpZ2h0OiBhc3luYyAoKSA9PlxuXHRcdChhd2FpdCBnZXRTdG9yYWdlSXRlbTxzdHJpbmc+KEtleXMuRm9udFdlaWdodCkpID8/IGRlZmF1bHRzLmZvbnRXZWlnaHQsXG5cdHNldEZvbnRXZWlnaHQ6IGFzeW5jIChmb250V2VpZ2h0OiBzdHJpbmcpID0+XG5cdFx0YXdhaXQgc2V0U3RvcmFnZUl0ZW08c3RyaW5nPihLZXlzLkZvbnRXZWlnaHQsIGZvbnRXZWlnaHQpLFxuXG5cdGdldEFjdGl2ZVVybHM6IGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBoYXNJbml0RGVmYXVsdHMgPSBhd2FpdCBnZXRTdG9yYWdlSXRlbTxib29sZWFuPihoYXNJbml0QWN0aXZlVXJsRGVmYXVsdHMpO1xuXHRcdGlmICghaGFzSW5pdERlZmF1bHRzKSB7XG5cdFx0XHRhd2FpdCBzZXRTdG9yYWdlSXRlbTxzdHJpbmdbXT4oS2V5cy5BY3RpdmVVcmxzLCBjb21tb25NYW5nYVNpdGVzKTtcblx0XHRcdGF3YWl0IHNldFN0b3JhZ2VJdGVtPGJvb2xlYW4+KGhhc0luaXRBY3RpdmVVcmxEZWZhdWx0cywgdHJ1ZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIChhd2FpdCBnZXRTdG9yYWdlSXRlbTxzdHJpbmdbXT4oS2V5cy5BY3RpdmVVcmxzKSkgPz8gW107XG5cdH0sXG5cdGFkZEFjdGl2ZVVybDogYXN5bmMgKGFjdGl2ZVVybDogc3RyaW5nKSA9PiB7XG5cdFx0Y29uc3QgaGFzSW5pdERlZmF1bHRzID0gYXdhaXQgZ2V0U3RvcmFnZUl0ZW08Ym9vbGVhbj4oaGFzSW5pdEFjdGl2ZVVybERlZmF1bHRzKTtcblx0XHRpZiAoIWhhc0luaXREZWZhdWx0cykge1xuXHRcdFx0YXdhaXQgc2V0U3RvcmFnZUl0ZW08c3RyaW5nW10+KEtleXMuQWN0aXZlVXJscywgY29tbW9uTWFuZ2FTaXRlcyk7XG5cdFx0XHRhd2FpdCBzZXRTdG9yYWdlSXRlbTxib29sZWFuPihoYXNJbml0QWN0aXZlVXJsRGVmYXVsdHMsIHRydWUpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdGl2ZVVybHMgPSAoYXdhaXQgZ2V0U3RvcmFnZUl0ZW08c3RyaW5nW10+KEtleXMuQWN0aXZlVXJscykpID8/IFtdO1xuXHRcdHJldHVybiBhd2FpdCBzZXRTdG9yYWdlSXRlbTxzdHJpbmdbXT4oS2V5cy5BY3RpdmVVcmxzLCBbLi4uYWN0aXZlVXJscywgYWN0aXZlVXJsXSk7XG5cdH0sXG5cdHJlbW92ZUFjdGl2ZVVybDogYXN5bmMgKGFjdGl2ZVVybDogc3RyaW5nKSA9PiB7XG5cdFx0Y29uc3QgaGFzSW5pdERlZmF1bHRzID0gYXdhaXQgZ2V0U3RvcmFnZUl0ZW08Ym9vbGVhbj4oaGFzSW5pdEFjdGl2ZVVybERlZmF1bHRzKTtcblx0XHRpZiAoIWhhc0luaXREZWZhdWx0cykge1xuXHRcdFx0YXdhaXQgc2V0U3RvcmFnZUl0ZW08c3RyaW5nW10+KEtleXMuQWN0aXZlVXJscywgY29tbW9uTWFuZ2FTaXRlcyk7XG5cdFx0XHRhd2FpdCBzZXRTdG9yYWdlSXRlbTxib29sZWFuPihoYXNJbml0QWN0aXZlVXJsRGVmYXVsdHMsIHRydWUpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdGl2ZVVybHMgPSAoYXdhaXQgZ2V0U3RvcmFnZUl0ZW08c3RyaW5nW10+KEtleXMuQWN0aXZlVXJscykpID8/IFtdO1xuXHRcdHJldHVybiBhd2FpdCBzZXRTdG9yYWdlSXRlbTxzdHJpbmdbXT4oXG5cdFx0XHRLZXlzLkFjdGl2ZVVybHMsXG5cdFx0XHRhY3RpdmVVcmxzLmZpbHRlcih1cmwgPT4gdXJsICE9PSBhY3RpdmVVcmwpXG5cdFx0KTtcblx0fVxufSk7XG4iLCIvLyBNb2R1bGUgZm9yIG1ha2luZyB3b3JraW5nIHdpdGggdGhlIENocm9tZSBBUEkgZWFzaWVyLlxuLy8gVGhpcyBtYXkgaW5jbHVkZSBtYWtpbmcgdGhlIEFQSSBhc3luYywgc2ltcGxpZnlpbmcgdGhlIGludGVyZmFjZSwgb3IgbW9yZS5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDdXJyZW50VGFiKCk6IFByb21pc2U8XG5cdChjaHJvbWUudGFicy5UYWIgJiB7IGdldEhvc3ROYW1lOiAoKSA9PiBzdHJpbmcgfSkgfCB1bmRlZmluZWRcbj4ge1xuXHRyZXR1cm4gbmV3IFByb21pc2U8KGNocm9tZS50YWJzLlRhYiAmIHsgZ2V0SG9zdE5hbWU6ICgpID0+IHN0cmluZyB9KSB8IHVuZGVmaW5lZD4ocmVzb2x2ZSA9PiB7XG5cdFx0Y2hyb21lLnRhYnMucXVlcnkoeyBjdXJyZW50V2luZG93OiB0cnVlLCBhY3RpdmU6IHRydWUgfSwgZnVuY3Rpb24gKHRhYnMpIHtcblx0XHRcdGlmIChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpIHtcblx0XHRcdFx0cmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGN1cnJlbnRUYWI6IGFueSA9IHRhYnNbMF07XG5cdFx0XHRpZiAoIWN1cnJlbnRUYWI/LnVybCkge1xuXHRcdFx0XHRyZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y3VycmVudFRhYi5nZXRIb3N0TmFtZSA9ICgpID0+IHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IFVSTChjdXJyZW50VGFiLnVybCkuaG9zdG5hbWU7XG5cdFx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHRcdHJldHVybiAnJztcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdHJlc29sdmUoY3VycmVudFRhYik7XG5cdFx0fSk7XG5cdH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdXBkYXRlU2Vzc2lvbkhlYWRlcnMocnVsZU9wdGlvbnM6IGNocm9tZS5kZWNsYXJhdGl2ZU5ldFJlcXVlc3QuVXBkYXRlUnVsZU9wdGlvbnMpIHtcblx0cmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdGNocm9tZS5kZWNsYXJhdGl2ZU5ldFJlcXVlc3QudXBkYXRlU2Vzc2lvblJ1bGVzKHJ1bGVPcHRpb25zLCByZXNvbHZlKTtcblx0fSk7XG59XG5cbi8vIFdpbmRvdyBJRCBvZiB0YWIgdG8gY2FwdHVyZSwgZWcgZ2V0Q3VycmVudFRhYigpLndpbmRvd0lkO1xuZXhwb3J0IGZ1bmN0aW9uIGNhcHR1cmVWaXNpYmxlVGFiKHdpbmRvd0lkOiBudW1iZXIpIHtcblx0cmV0dXJuIG5ldyBQcm9taXNlPHN0cmluZz4ocmVzb2x2ZSA9PlxuXHRcdGNocm9tZS50YWJzLmNhcHR1cmVWaXNpYmxlVGFiKHdpbmRvd0lkLCB7IGZvcm1hdDogJ3BuZycgfSwgcmVzb2x2ZSlcblx0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFpvb21GYWN0b3IodGFiSWQ6IG51bWJlcik6IFByb21pc2U8bnVtYmVyPiB7XG5cdHJldHVybiBuZXcgUHJvbWlzZTxudW1iZXI+KHJlc29sdmUgPT4gY2hyb21lLnRhYnMuZ2V0Wm9vbSh0YWJJZCwgcmVzb2x2ZSkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2V0RXh0ZW5zaW9uSWNvbihpY29uOiBjaHJvbWUuYnJvd3NlckFjdGlvbi5UYWJJY29uRGV0YWlscyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRyZXR1cm4gbmV3IFByb21pc2U8Ym9vbGVhbj4ocmVzb2x2ZSA9PiB7XG5cdFx0Y2hyb21lLmFjdGlvbi5zZXRJY29uKGljb24sICgpID0+IHtcblx0XHRcdHJlc29sdmUodHJ1ZSk7XG5cdFx0fSk7XG5cdH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXhlY3V0ZVNjcmlwdChcblx0dGFiSWQ6IG51bWJlcixcblx0ZmlsZVBhdGg6IHN0cmluZyxcblx0YWxsRnJhbWVzPzogYm9vbGVhblxuKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdHJldHVybiBuZXcgUHJvbWlzZTxib29sZWFuPihyZXNvbHZlID0+IHtcblx0XHRjaHJvbWUuc2NyaXB0aW5nLmV4ZWN1dGVTY3JpcHQoXG5cdFx0XHR7IHRhcmdldDogeyB0YWJJZCwgYWxsRnJhbWVzOiBhbGxGcmFtZXMgPz8gdHJ1ZSB9LCBmaWxlczogW2ZpbGVQYXRoXSB9LFxuXHRcdFx0KCkgPT4ge1xuXHRcdFx0XHRyZXNvbHZlKHRydWUpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNBbGxvd2VkRmlsZVNjaGVtZUFjY2VzcygpIHtcblx0cmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdGNocm9tZS5leHRlbnNpb24uaXNBbGxvd2VkRmlsZVNjaGVtZUFjY2VzcyhyZXNvbHZlKTtcblx0fSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwb3N0QmFja2dyb3VuZE1lc3NhZ2UobWVzc2FnZTogYW55KTogYW55IHtcblx0Y29uc3QgZXh0ZW5zaW9uSWQgPSB1bmRlZmluZWQ7IC8vIHVuZGVmaW5lZCBtZWFucyBzZW5kIHRvIHNlbGYsIGluc3RlYWQgb2YgYW5vdGhlciBleHRlbnNpb24uXG5cdGNvbnN0IG9wdGlvbnMgPSB1bmRlZmluZWQ7XG5cblx0cmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKGV4dGVuc2lvbklkLCBtZXNzYWdlLCBvcHRpb25zLCByZXNvbHZlKTtcblx0fSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTdG9yYWdlSXRlbTxUPihrZXk6IHN0cmluZyk6IFByb21pc2U8VCB8IHVuZGVmaW5lZD4ge1xuXHRjb25zdCBmb3JtYXR0ZWRLZXkgPSBmb3JtYXRLZXkoa2V5KTtcblx0cmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoW2Zvcm1hdHRlZEtleV0sIGZ1bmN0aW9uIChyZXN1bHQpIHtcblx0XHRcdFx0cmVzb2x2ZShyZXN1bHRbZm9ybWF0dGVkS2V5XSk7XG5cdFx0XHR9KTtcblx0XHR9IGNhdGNoIHtcblx0XHRcdC8vIERvIG5vdGhpbmcgaWYgY2FjaGUgZmFpbHMuXG5cdFx0XHRyZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldFN0b3JhZ2VJdGVtPFQ+KGtleTogc3RyaW5nLCB2YWx1ZTogVCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRjb25zdCBmb3JtYXR0ZWRLZXkgPSBmb3JtYXRLZXkoa2V5KTtcblx0cmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQoeyBbZm9ybWF0dGVkS2V5XTogdmFsdWUgfSwgKCkgPT4ge1xuXHRcdFx0XHRyZXNvbHZlKHRydWUpO1xuXHRcdFx0fSk7XG5cdFx0fSBjYXRjaCB7XG5cdFx0XHQvLyBEbyBub3RoaW5nIGlmIGNhY2hlIGZhaWxzLlxuXHRcdFx0cmVzb2x2ZShmYWxzZSk7XG5cdFx0fVxuXHR9KTtcbn1cblxuZnVuY3Rpb24gZm9ybWF0S2V5KGtleTogc3RyaW5nKSB7XG5cdGNvbnN0IGtleVByZWZpeCA9ICdhcHAnO1xuXHRyZXR1cm4gYCR7a2V5UHJlZml4fS0ke2tleX1gO1xufVxuIiwiY29uc3QgbSA9IGNocm9tZS5pMThuLmdldE1lc3NhZ2U7XG5cbi8vIFN1cHBvcnRlZCBsYW5ndWFnZSBjb2Rlcy5cbmV4cG9ydCB0eXBlIExhbmd1YWdlQ29kZSA9XG5cdHwgJ2FyJ1xuXHR8ICdkZSdcblx0fCAnZW4nXG5cdHwgJ2VzJ1xuXHR8ICdmcidcblx0fCAnaGknXG5cdHwgJ2lkJ1xuXHR8ICdpdCdcblx0fCAnamEnXG5cdHwgJ2tvJ1xuXHR8ICdwbCdcblx0fCAncHQtQlInXG5cdHwgJ3B0LVBUJ1xuXHR8ICdydSdcblx0fCAndGgnXG5cdHwgJ3ZpJ1xuXHR8ICd6aC1DTidcblx0fCAnemgtVFcnO1xuXG5leHBvcnQgY29uc3QgbGFuZ3VhZ2VDb2RlczogTGFuZ3VhZ2VDb2RlW10gPSBbXG5cdCdhcicsXG5cdCdkZScsXG5cdCdlbicsXG5cdCdlcycsXG5cdCdmcicsXG5cdCdoaScsXG5cdCdpZCcsXG5cdCdpdCcsXG5cdCdqYScsXG5cdCdrbycsXG5cdCdwbCcsXG5cdCdwdC1CUicsXG5cdCdwdC1QVCcsXG5cdCdydScsXG5cdCd0aCcsXG5cdCd2aScsXG5cdCd6aC1DTicsXG5cdCd6aC1UVydcbl07XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXREZWZhdWx0TGFuZ3VhZ2UoKTogTGFuZ3VhZ2VDb2RlIHtcblx0Y29uc3QgZnVsbExhbmcgPSBuYXZpZ2F0b3IubGFuZ3VhZ2U7XG5cblx0Y29uc3Qgc2hvcnRMYW5nID0gbmF2aWdhdG9yLmxhbmd1YWdlLnNwbGl0KCctJylbMF07XG5cdGNvbnN0IGZpcnN0U2hvcnRMYW5nID0gbGFuZ3VhZ2VDb2Rlcy5maW5kKGxhbmcgPT4gbGFuZy5zdGFydHNXaXRoKHNob3J0TGFuZykpO1xuXG5cdGlmIChsYW5ndWFnZUNvZGVzLmluY2x1ZGVzKGZ1bGxMYW5nIGFzIExhbmd1YWdlQ29kZSkpIHtcblx0XHRyZXR1cm4gZnVsbExhbmcgYXMgTGFuZ3VhZ2VDb2RlO1xuXHR9IGVsc2UgaWYgKGZpcnN0U2hvcnRMYW5nKSB7XG5cdFx0cmV0dXJuIGZpcnN0U2hvcnRMYW5nO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiAnZW4nO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXREaXNwbGF5U3RyaW5nKGxhbmd1YWdlQ29kZTogTGFuZ3VhZ2VDb2RlKTogc3RyaW5nIHtcblx0c3dpdGNoIChsYW5ndWFnZUNvZGUpIHtcblx0XHRjYXNlICdhcic6XG5cdFx0XHRyZXR1cm4gbSgndHJhbnNsYXRlVG9BcmFiaWNMYWJlbCcpO1xuXHRcdGNhc2UgJ2RlJzpcblx0XHRcdHJldHVybiBtKCd0cmFuc2xhdGVUb0dlcm1hbkxhYmVsJyk7XG5cdFx0Y2FzZSAnZW4nOlxuXHRcdFx0cmV0dXJuIG0oJ3RyYW5zbGF0ZVRvRW5nbGlzaExhYmVsJyk7XG5cdFx0Y2FzZSAnZXMnOlxuXHRcdFx0cmV0dXJuIG0oJ3RyYW5zbGF0ZVRvU3BhbmlzaExhYmVsJyk7XG5cdFx0Y2FzZSAnZnInOlxuXHRcdFx0cmV0dXJuIG0oJ3RyYW5zbGF0ZVRvRnJlbmNoTGFiZWwnKTtcblx0XHRjYXNlICdoaSc6XG5cdFx0XHRyZXR1cm4gbSgndHJhbnNsYXRlVG9IaW5kaUxhYmVsJyk7XG5cdFx0Y2FzZSAnaWQnOlxuXHRcdFx0cmV0dXJuIG0oJ3RyYW5zbGF0ZVRvSW5kb25lc2lhbkxhYmVsJyk7XG5cdFx0Y2FzZSAnaXQnOlxuXHRcdFx0cmV0dXJuIG0oJ3RyYW5zbGF0ZVRvSXRhbGlhbkxhYmVsJyk7XG5cdFx0Y2FzZSAnamEnOlxuXHRcdFx0cmV0dXJuIG0oJ3RyYW5zbGF0ZVRvSmFwYW5lc2VMYWJlbCcpO1xuXHRcdGNhc2UgJ2tvJzpcblx0XHRcdHJldHVybiBtKCd0cmFuc2xhdGVUb0tvcmVhbkxhYmVsJyk7XG5cdFx0Y2FzZSAncGwnOlxuXHRcdFx0cmV0dXJuIG0oJ3RyYW5zbGF0ZVRvUG9saXNoTGFiZWwnKTtcblx0XHRjYXNlICdwdC1CUic6XG5cdFx0XHRyZXR1cm4gbSgndHJhbnNsYXRlVG9CcmF6aWxpYW5Qb3J0dWd1ZXNlTGFiZWwnKTtcblx0XHRjYXNlICdwdC1QVCc6XG5cdFx0XHRyZXR1cm4gbSgndHJhbnNsYXRlVG9Qb3J0dWd1ZXNlTGFiZWwnKTtcblx0XHRjYXNlICdydSc6XG5cdFx0XHRyZXR1cm4gbSgndHJhbnNsYXRlVG9SdXNzaWFuTGFiZWwnKTtcblx0XHRjYXNlICd0aCc6XG5cdFx0XHRyZXR1cm4gbSgndHJhbnNsYXRlVG9UaGFpTGFiZWwnKTtcblx0XHRjYXNlICd2aSc6XG5cdFx0XHRyZXR1cm4gbSgndHJhbnNsYXRlVG9WaWV0bmFtZXNlTGFiZWwnKTtcblx0XHRjYXNlICd6aC1DTic6XG5cdFx0XHRyZXR1cm4gbSgndHJhbnNsYXRlVG9DaGluZXNlU2ltcGxpZmllZExhYmVsJyk7XG5cdFx0Y2FzZSAnemgtVFcnOlxuXHRcdFx0cmV0dXJuIG0oJ3RyYW5zbGF0ZVRvQ2hpbmVzZVRyYWRpdGlvbmFsTGFiZWwnKTtcblx0XHRkZWZhdWx0OlxuXHRcdFx0cmV0dXJuICdVbmtub3duJztcblx0fVxufVxuIiwiZXhwb3J0IHsgZGVmYXVsdCBhcyB2MSB9IGZyb20gJy4vdjEuanMnO1xuZXhwb3J0IHsgZGVmYXVsdCBhcyB2MyB9IGZyb20gJy4vdjMuanMnO1xuZXhwb3J0IHsgZGVmYXVsdCBhcyB2NCB9IGZyb20gJy4vdjQuanMnO1xuZXhwb3J0IHsgZGVmYXVsdCBhcyB2NSB9IGZyb20gJy4vdjUuanMnO1xuZXhwb3J0IHsgZGVmYXVsdCBhcyBOSUwgfSBmcm9tICcuL25pbC5qcyc7XG5leHBvcnQgeyBkZWZhdWx0IGFzIHZlcnNpb24gfSBmcm9tICcuL3ZlcnNpb24uanMnO1xuZXhwb3J0IHsgZGVmYXVsdCBhcyB2YWxpZGF0ZSB9IGZyb20gJy4vdmFsaWRhdGUuanMnO1xuZXhwb3J0IHsgZGVmYXVsdCBhcyBzdHJpbmdpZnkgfSBmcm9tICcuL3N0cmluZ2lmeS5qcyc7XG5leHBvcnQgeyBkZWZhdWx0IGFzIHBhcnNlIH0gZnJvbSAnLi9wYXJzZS5qcyc7IiwiLypcbiAqIEJyb3dzZXItY29tcGF0aWJsZSBKYXZhU2NyaXB0IE1ENVxuICpcbiAqIE1vZGlmaWNhdGlvbiBvZiBKYXZhU2NyaXB0IE1ENVxuICogaHR0cHM6Ly9naXRodWIuY29tL2JsdWVpbXAvSmF2YVNjcmlwdC1NRDVcbiAqXG4gKiBDb3B5cmlnaHQgMjAxMSwgU2ViYXN0aWFuIFRzY2hhblxuICogaHR0cHM6Ly9ibHVlaW1wLm5ldFxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZTpcbiAqIGh0dHBzOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvTUlUXG4gKlxuICogQmFzZWQgb25cbiAqIEEgSmF2YVNjcmlwdCBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgUlNBIERhdGEgU2VjdXJpdHksIEluYy4gTUQ1IE1lc3NhZ2VcbiAqIERpZ2VzdCBBbGdvcml0aG0sIGFzIGRlZmluZWQgaW4gUkZDIDEzMjEuXG4gKiBWZXJzaW9uIDIuMiBDb3B5cmlnaHQgKEMpIFBhdWwgSm9obnN0b24gMTk5OSAtIDIwMDlcbiAqIE90aGVyIGNvbnRyaWJ1dG9yczogR3JlZyBIb2x0LCBBbmRyZXcgS2VwZXJ0LCBZZG5hciwgTG9zdGluZXRcbiAqIERpc3RyaWJ1dGVkIHVuZGVyIHRoZSBCU0QgTGljZW5zZVxuICogU2VlIGh0dHA6Ly9wYWpob21lLm9yZy51ay9jcnlwdC9tZDUgZm9yIG1vcmUgaW5mby5cbiAqL1xuZnVuY3Rpb24gbWQ1KGJ5dGVzKSB7XG4gIGlmICh0eXBlb2YgYnl0ZXMgPT09ICdzdHJpbmcnKSB7XG4gICAgdmFyIG1zZyA9IHVuZXNjYXBlKGVuY29kZVVSSUNvbXBvbmVudChieXRlcykpOyAvLyBVVEY4IGVzY2FwZVxuXG4gICAgYnl0ZXMgPSBuZXcgVWludDhBcnJheShtc2cubGVuZ3RoKTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbXNnLmxlbmd0aDsgKytpKSB7XG4gICAgICBieXRlc1tpXSA9IG1zZy5jaGFyQ29kZUF0KGkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBtZDVUb0hleEVuY29kZWRBcnJheSh3b3Jkc1RvTWQ1KGJ5dGVzVG9Xb3JkcyhieXRlcyksIGJ5dGVzLmxlbmd0aCAqIDgpKTtcbn1cbi8qXG4gKiBDb252ZXJ0IGFuIGFycmF5IG9mIGxpdHRsZS1lbmRpYW4gd29yZHMgdG8gYW4gYXJyYXkgb2YgYnl0ZXNcbiAqL1xuXG5cbmZ1bmN0aW9uIG1kNVRvSGV4RW5jb2RlZEFycmF5KGlucHV0KSB7XG4gIHZhciBvdXRwdXQgPSBbXTtcbiAgdmFyIGxlbmd0aDMyID0gaW5wdXQubGVuZ3RoICogMzI7XG4gIHZhciBoZXhUYWIgPSAnMDEyMzQ1Njc4OWFiY2RlZic7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGgzMjsgaSArPSA4KSB7XG4gICAgdmFyIHggPSBpbnB1dFtpID4+IDVdID4+PiBpICUgMzIgJiAweGZmO1xuICAgIHZhciBoZXggPSBwYXJzZUludChoZXhUYWIuY2hhckF0KHggPj4+IDQgJiAweDBmKSArIGhleFRhYi5jaGFyQXQoeCAmIDB4MGYpLCAxNik7XG4gICAgb3V0cHV0LnB1c2goaGV4KTtcbiAgfVxuXG4gIHJldHVybiBvdXRwdXQ7XG59XG4vKipcbiAqIENhbGN1bGF0ZSBvdXRwdXQgbGVuZ3RoIHdpdGggcGFkZGluZyBhbmQgYml0IGxlbmd0aFxuICovXG5cblxuZnVuY3Rpb24gZ2V0T3V0cHV0TGVuZ3RoKGlucHV0TGVuZ3RoOCkge1xuICByZXR1cm4gKGlucHV0TGVuZ3RoOCArIDY0ID4+PiA5IDw8IDQpICsgMTQgKyAxO1xufVxuLypcbiAqIENhbGN1bGF0ZSB0aGUgTUQ1IG9mIGFuIGFycmF5IG9mIGxpdHRsZS1lbmRpYW4gd29yZHMsIGFuZCBhIGJpdCBsZW5ndGguXG4gKi9cblxuXG5mdW5jdGlvbiB3b3Jkc1RvTWQ1KHgsIGxlbikge1xuICAvKiBhcHBlbmQgcGFkZGluZyAqL1xuICB4W2xlbiA+PiA1XSB8PSAweDgwIDw8IGxlbiAlIDMyO1xuICB4W2dldE91dHB1dExlbmd0aChsZW4pIC0gMV0gPSBsZW47XG4gIHZhciBhID0gMTczMjU4NDE5MztcbiAgdmFyIGIgPSAtMjcxNzMzODc5O1xuICB2YXIgYyA9IC0xNzMyNTg0MTk0O1xuICB2YXIgZCA9IDI3MTczMzg3ODtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IHgubGVuZ3RoOyBpICs9IDE2KSB7XG4gICAgdmFyIG9sZGEgPSBhO1xuICAgIHZhciBvbGRiID0gYjtcbiAgICB2YXIgb2xkYyA9IGM7XG4gICAgdmFyIG9sZGQgPSBkO1xuICAgIGEgPSBtZDVmZihhLCBiLCBjLCBkLCB4W2ldLCA3LCAtNjgwODc2OTM2KTtcbiAgICBkID0gbWQ1ZmYoZCwgYSwgYiwgYywgeFtpICsgMV0sIDEyLCAtMzg5NTY0NTg2KTtcbiAgICBjID0gbWQ1ZmYoYywgZCwgYSwgYiwgeFtpICsgMl0sIDE3LCA2MDYxMDU4MTkpO1xuICAgIGIgPSBtZDVmZihiLCBjLCBkLCBhLCB4W2kgKyAzXSwgMjIsIC0xMDQ0NTI1MzMwKTtcbiAgICBhID0gbWQ1ZmYoYSwgYiwgYywgZCwgeFtpICsgNF0sIDcsIC0xNzY0MTg4OTcpO1xuICAgIGQgPSBtZDVmZihkLCBhLCBiLCBjLCB4W2kgKyA1XSwgMTIsIDEyMDAwODA0MjYpO1xuICAgIGMgPSBtZDVmZihjLCBkLCBhLCBiLCB4W2kgKyA2XSwgMTcsIC0xNDczMjMxMzQxKTtcbiAgICBiID0gbWQ1ZmYoYiwgYywgZCwgYSwgeFtpICsgN10sIDIyLCAtNDU3MDU5ODMpO1xuICAgIGEgPSBtZDVmZihhLCBiLCBjLCBkLCB4W2kgKyA4XSwgNywgMTc3MDAzNTQxNik7XG4gICAgZCA9IG1kNWZmKGQsIGEsIGIsIGMsIHhbaSArIDldLCAxMiwgLTE5NTg0MTQ0MTcpO1xuICAgIGMgPSBtZDVmZihjLCBkLCBhLCBiLCB4W2kgKyAxMF0sIDE3LCAtNDIwNjMpO1xuICAgIGIgPSBtZDVmZihiLCBjLCBkLCBhLCB4W2kgKyAxMV0sIDIyLCAtMTk5MDQwNDE2Mik7XG4gICAgYSA9IG1kNWZmKGEsIGIsIGMsIGQsIHhbaSArIDEyXSwgNywgMTgwNDYwMzY4Mik7XG4gICAgZCA9IG1kNWZmKGQsIGEsIGIsIGMsIHhbaSArIDEzXSwgMTIsIC00MDM0MTEwMSk7XG4gICAgYyA9IG1kNWZmKGMsIGQsIGEsIGIsIHhbaSArIDE0XSwgMTcsIC0xNTAyMDAyMjkwKTtcbiAgICBiID0gbWQ1ZmYoYiwgYywgZCwgYSwgeFtpICsgMTVdLCAyMiwgMTIzNjUzNTMyOSk7XG4gICAgYSA9IG1kNWdnKGEsIGIsIGMsIGQsIHhbaSArIDFdLCA1LCAtMTY1Nzk2NTEwKTtcbiAgICBkID0gbWQ1Z2coZCwgYSwgYiwgYywgeFtpICsgNl0sIDksIC0xMDY5NTAxNjMyKTtcbiAgICBjID0gbWQ1Z2coYywgZCwgYSwgYiwgeFtpICsgMTFdLCAxNCwgNjQzNzE3NzEzKTtcbiAgICBiID0gbWQ1Z2coYiwgYywgZCwgYSwgeFtpXSwgMjAsIC0zNzM4OTczMDIpO1xuICAgIGEgPSBtZDVnZyhhLCBiLCBjLCBkLCB4W2kgKyA1XSwgNSwgLTcwMTU1ODY5MSk7XG4gICAgZCA9IG1kNWdnKGQsIGEsIGIsIGMsIHhbaSArIDEwXSwgOSwgMzgwMTYwODMpO1xuICAgIGMgPSBtZDVnZyhjLCBkLCBhLCBiLCB4W2kgKyAxNV0sIDE0LCAtNjYwNDc4MzM1KTtcbiAgICBiID0gbWQ1Z2coYiwgYywgZCwgYSwgeFtpICsgNF0sIDIwLCAtNDA1NTM3ODQ4KTtcbiAgICBhID0gbWQ1Z2coYSwgYiwgYywgZCwgeFtpICsgOV0sIDUsIDU2ODQ0NjQzOCk7XG4gICAgZCA9IG1kNWdnKGQsIGEsIGIsIGMsIHhbaSArIDE0XSwgOSwgLTEwMTk4MDM2OTApO1xuICAgIGMgPSBtZDVnZyhjLCBkLCBhLCBiLCB4W2kgKyAzXSwgMTQsIC0xODczNjM5NjEpO1xuICAgIGIgPSBtZDVnZyhiLCBjLCBkLCBhLCB4W2kgKyA4XSwgMjAsIDExNjM1MzE1MDEpO1xuICAgIGEgPSBtZDVnZyhhLCBiLCBjLCBkLCB4W2kgKyAxM10sIDUsIC0xNDQ0NjgxNDY3KTtcbiAgICBkID0gbWQ1Z2coZCwgYSwgYiwgYywgeFtpICsgMl0sIDksIC01MTQwMzc4NCk7XG4gICAgYyA9IG1kNWdnKGMsIGQsIGEsIGIsIHhbaSArIDddLCAxNCwgMTczNTMyODQ3Myk7XG4gICAgYiA9IG1kNWdnKGIsIGMsIGQsIGEsIHhbaSArIDEyXSwgMjAsIC0xOTI2NjA3NzM0KTtcbiAgICBhID0gbWQ1aGgoYSwgYiwgYywgZCwgeFtpICsgNV0sIDQsIC0zNzg1NTgpO1xuICAgIGQgPSBtZDVoaChkLCBhLCBiLCBjLCB4W2kgKyA4XSwgMTEsIC0yMDIyNTc0NDYzKTtcbiAgICBjID0gbWQ1aGgoYywgZCwgYSwgYiwgeFtpICsgMTFdLCAxNiwgMTgzOTAzMDU2Mik7XG4gICAgYiA9IG1kNWhoKGIsIGMsIGQsIGEsIHhbaSArIDE0XSwgMjMsIC0zNTMwOTU1Nik7XG4gICAgYSA9IG1kNWhoKGEsIGIsIGMsIGQsIHhbaSArIDFdLCA0LCAtMTUzMDk5MjA2MCk7XG4gICAgZCA9IG1kNWhoKGQsIGEsIGIsIGMsIHhbaSArIDRdLCAxMSwgMTI3Mjg5MzM1Myk7XG4gICAgYyA9IG1kNWhoKGMsIGQsIGEsIGIsIHhbaSArIDddLCAxNiwgLTE1NTQ5NzYzMik7XG4gICAgYiA9IG1kNWhoKGIsIGMsIGQsIGEsIHhbaSArIDEwXSwgMjMsIC0xMDk0NzMwNjQwKTtcbiAgICBhID0gbWQ1aGgoYSwgYiwgYywgZCwgeFtpICsgMTNdLCA0LCA2ODEyNzkxNzQpO1xuICAgIGQgPSBtZDVoaChkLCBhLCBiLCBjLCB4W2ldLCAxMSwgLTM1ODUzNzIyMik7XG4gICAgYyA9IG1kNWhoKGMsIGQsIGEsIGIsIHhbaSArIDNdLCAxNiwgLTcyMjUyMTk3OSk7XG4gICAgYiA9IG1kNWhoKGIsIGMsIGQsIGEsIHhbaSArIDZdLCAyMywgNzYwMjkxODkpO1xuICAgIGEgPSBtZDVoaChhLCBiLCBjLCBkLCB4W2kgKyA5XSwgNCwgLTY0MDM2NDQ4Nyk7XG4gICAgZCA9IG1kNWhoKGQsIGEsIGIsIGMsIHhbaSArIDEyXSwgMTEsIC00MjE4MTU4MzUpO1xuICAgIGMgPSBtZDVoaChjLCBkLCBhLCBiLCB4W2kgKyAxNV0sIDE2LCA1MzA3NDI1MjApO1xuICAgIGIgPSBtZDVoaChiLCBjLCBkLCBhLCB4W2kgKyAyXSwgMjMsIC05OTUzMzg2NTEpO1xuICAgIGEgPSBtZDVpaShhLCBiLCBjLCBkLCB4W2ldLCA2LCAtMTk4NjMwODQ0KTtcbiAgICBkID0gbWQ1aWkoZCwgYSwgYiwgYywgeFtpICsgN10sIDEwLCAxMTI2ODkxNDE1KTtcbiAgICBjID0gbWQ1aWkoYywgZCwgYSwgYiwgeFtpICsgMTRdLCAxNSwgLTE0MTYzNTQ5MDUpO1xuICAgIGIgPSBtZDVpaShiLCBjLCBkLCBhLCB4W2kgKyA1XSwgMjEsIC01NzQzNDA1NSk7XG4gICAgYSA9IG1kNWlpKGEsIGIsIGMsIGQsIHhbaSArIDEyXSwgNiwgMTcwMDQ4NTU3MSk7XG4gICAgZCA9IG1kNWlpKGQsIGEsIGIsIGMsIHhbaSArIDNdLCAxMCwgLTE4OTQ5ODY2MDYpO1xuICAgIGMgPSBtZDVpaShjLCBkLCBhLCBiLCB4W2kgKyAxMF0sIDE1LCAtMTA1MTUyMyk7XG4gICAgYiA9IG1kNWlpKGIsIGMsIGQsIGEsIHhbaSArIDFdLCAyMSwgLTIwNTQ5MjI3OTkpO1xuICAgIGEgPSBtZDVpaShhLCBiLCBjLCBkLCB4W2kgKyA4XSwgNiwgMTg3MzMxMzM1OSk7XG4gICAgZCA9IG1kNWlpKGQsIGEsIGIsIGMsIHhbaSArIDE1XSwgMTAsIC0zMDYxMTc0NCk7XG4gICAgYyA9IG1kNWlpKGMsIGQsIGEsIGIsIHhbaSArIDZdLCAxNSwgLTE1NjAxOTgzODApO1xuICAgIGIgPSBtZDVpaShiLCBjLCBkLCBhLCB4W2kgKyAxM10sIDIxLCAxMzA5MTUxNjQ5KTtcbiAgICBhID0gbWQ1aWkoYSwgYiwgYywgZCwgeFtpICsgNF0sIDYsIC0xNDU1MjMwNzApO1xuICAgIGQgPSBtZDVpaShkLCBhLCBiLCBjLCB4W2kgKyAxMV0sIDEwLCAtMTEyMDIxMDM3OSk7XG4gICAgYyA9IG1kNWlpKGMsIGQsIGEsIGIsIHhbaSArIDJdLCAxNSwgNzE4Nzg3MjU5KTtcbiAgICBiID0gbWQ1aWkoYiwgYywgZCwgYSwgeFtpICsgOV0sIDIxLCAtMzQzNDg1NTUxKTtcbiAgICBhID0gc2FmZUFkZChhLCBvbGRhKTtcbiAgICBiID0gc2FmZUFkZChiLCBvbGRiKTtcbiAgICBjID0gc2FmZUFkZChjLCBvbGRjKTtcbiAgICBkID0gc2FmZUFkZChkLCBvbGRkKTtcbiAgfVxuXG4gIHJldHVybiBbYSwgYiwgYywgZF07XG59XG4vKlxuICogQ29udmVydCBhbiBhcnJheSBieXRlcyB0byBhbiBhcnJheSBvZiBsaXR0bGUtZW5kaWFuIHdvcmRzXG4gKiBDaGFyYWN0ZXJzID4yNTUgaGF2ZSB0aGVpciBoaWdoLWJ5dGUgc2lsZW50bHkgaWdub3JlZC5cbiAqL1xuXG5cbmZ1bmN0aW9uIGJ5dGVzVG9Xb3JkcyhpbnB1dCkge1xuICBpZiAoaW5wdXQubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgdmFyIGxlbmd0aDggPSBpbnB1dC5sZW5ndGggKiA4O1xuICB2YXIgb3V0cHV0ID0gbmV3IFVpbnQzMkFycmF5KGdldE91dHB1dExlbmd0aChsZW5ndGg4KSk7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg4OyBpICs9IDgpIHtcbiAgICBvdXRwdXRbaSA+PiA1XSB8PSAoaW5wdXRbaSAvIDhdICYgMHhmZikgPDwgaSAlIDMyO1xuICB9XG5cbiAgcmV0dXJuIG91dHB1dDtcbn1cbi8qXG4gKiBBZGQgaW50ZWdlcnMsIHdyYXBwaW5nIGF0IDJeMzIuIFRoaXMgdXNlcyAxNi1iaXQgb3BlcmF0aW9ucyBpbnRlcm5hbGx5XG4gKiB0byB3b3JrIGFyb3VuZCBidWdzIGluIHNvbWUgSlMgaW50ZXJwcmV0ZXJzLlxuICovXG5cblxuZnVuY3Rpb24gc2FmZUFkZCh4LCB5KSB7XG4gIHZhciBsc3cgPSAoeCAmIDB4ZmZmZikgKyAoeSAmIDB4ZmZmZik7XG4gIHZhciBtc3cgPSAoeCA+PiAxNikgKyAoeSA+PiAxNikgKyAobHN3ID4+IDE2KTtcbiAgcmV0dXJuIG1zdyA8PCAxNiB8IGxzdyAmIDB4ZmZmZjtcbn1cbi8qXG4gKiBCaXR3aXNlIHJvdGF0ZSBhIDMyLWJpdCBudW1iZXIgdG8gdGhlIGxlZnQuXG4gKi9cblxuXG5mdW5jdGlvbiBiaXRSb3RhdGVMZWZ0KG51bSwgY250KSB7XG4gIHJldHVybiBudW0gPDwgY250IHwgbnVtID4+PiAzMiAtIGNudDtcbn1cbi8qXG4gKiBUaGVzZSBmdW5jdGlvbnMgaW1wbGVtZW50IHRoZSBmb3VyIGJhc2ljIG9wZXJhdGlvbnMgdGhlIGFsZ29yaXRobSB1c2VzLlxuICovXG5cblxuZnVuY3Rpb24gbWQ1Y21uKHEsIGEsIGIsIHgsIHMsIHQpIHtcbiAgcmV0dXJuIHNhZmVBZGQoYml0Um90YXRlTGVmdChzYWZlQWRkKHNhZmVBZGQoYSwgcSksIHNhZmVBZGQoeCwgdCkpLCBzKSwgYik7XG59XG5cbmZ1bmN0aW9uIG1kNWZmKGEsIGIsIGMsIGQsIHgsIHMsIHQpIHtcbiAgcmV0dXJuIG1kNWNtbihiICYgYyB8IH5iICYgZCwgYSwgYiwgeCwgcywgdCk7XG59XG5cbmZ1bmN0aW9uIG1kNWdnKGEsIGIsIGMsIGQsIHgsIHMsIHQpIHtcbiAgcmV0dXJuIG1kNWNtbihiICYgZCB8IGMgJiB+ZCwgYSwgYiwgeCwgcywgdCk7XG59XG5cbmZ1bmN0aW9uIG1kNWhoKGEsIGIsIGMsIGQsIHgsIHMsIHQpIHtcbiAgcmV0dXJuIG1kNWNtbihiIF4gYyBeIGQsIGEsIGIsIHgsIHMsIHQpO1xufVxuXG5mdW5jdGlvbiBtZDVpaShhLCBiLCBjLCBkLCB4LCBzLCB0KSB7XG4gIHJldHVybiBtZDVjbW4oYyBeIChiIHwgfmQpLCBhLCBiLCB4LCBzLCB0KTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgbWQ1OyIsImV4cG9ydCBkZWZhdWx0ICcwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAnOyIsImltcG9ydCB2YWxpZGF0ZSBmcm9tICcuL3ZhbGlkYXRlLmpzJztcblxuZnVuY3Rpb24gcGFyc2UodXVpZCkge1xuICBpZiAoIXZhbGlkYXRlKHV1aWQpKSB7XG4gICAgdGhyb3cgVHlwZUVycm9yKCdJbnZhbGlkIFVVSUQnKTtcbiAgfVxuXG4gIHZhciB2O1xuICB2YXIgYXJyID0gbmV3IFVpbnQ4QXJyYXkoMTYpOyAvLyBQYXJzZSAjIyMjIyMjIy0uLi4uLS4uLi4tLi4uLi0uLi4uLi4uLi4uLi5cblxuICBhcnJbMF0gPSAodiA9IHBhcnNlSW50KHV1aWQuc2xpY2UoMCwgOCksIDE2KSkgPj4+IDI0O1xuICBhcnJbMV0gPSB2ID4+PiAxNiAmIDB4ZmY7XG4gIGFyclsyXSA9IHYgPj4+IDggJiAweGZmO1xuICBhcnJbM10gPSB2ICYgMHhmZjsgLy8gUGFyc2UgLi4uLi4uLi4tIyMjIy0uLi4uLS4uLi4tLi4uLi4uLi4uLi4uXG5cbiAgYXJyWzRdID0gKHYgPSBwYXJzZUludCh1dWlkLnNsaWNlKDksIDEzKSwgMTYpKSA+Pj4gODtcbiAgYXJyWzVdID0gdiAmIDB4ZmY7IC8vIFBhcnNlIC4uLi4uLi4uLS4uLi4tIyMjIy0uLi4uLS4uLi4uLi4uLi4uLlxuXG4gIGFycls2XSA9ICh2ID0gcGFyc2VJbnQodXVpZC5zbGljZSgxNCwgMTgpLCAxNikpID4+PiA4O1xuICBhcnJbN10gPSB2ICYgMHhmZjsgLy8gUGFyc2UgLi4uLi4uLi4tLi4uLi0uLi4uLSMjIyMtLi4uLi4uLi4uLi4uXG5cbiAgYXJyWzhdID0gKHYgPSBwYXJzZUludCh1dWlkLnNsaWNlKDE5LCAyMyksIDE2KSkgPj4+IDg7XG4gIGFycls5XSA9IHYgJiAweGZmOyAvLyBQYXJzZSAuLi4uLi4uLi0uLi4uLS4uLi4tLi4uLi0jIyMjIyMjIyMjIyNcbiAgLy8gKFVzZSBcIi9cIiB0byBhdm9pZCAzMi1iaXQgdHJ1bmNhdGlvbiB3aGVuIGJpdC1zaGlmdGluZyBoaWdoLW9yZGVyIGJ5dGVzKVxuXG4gIGFyclsxMF0gPSAodiA9IHBhcnNlSW50KHV1aWQuc2xpY2UoMjQsIDM2KSwgMTYpKSAvIDB4MTAwMDAwMDAwMDAgJiAweGZmO1xuICBhcnJbMTFdID0gdiAvIDB4MTAwMDAwMDAwICYgMHhmZjtcbiAgYXJyWzEyXSA9IHYgPj4+IDI0ICYgMHhmZjtcbiAgYXJyWzEzXSA9IHYgPj4+IDE2ICYgMHhmZjtcbiAgYXJyWzE0XSA9IHYgPj4+IDggJiAweGZmO1xuICBhcnJbMTVdID0gdiAmIDB4ZmY7XG4gIHJldHVybiBhcnI7XG59XG5cbmV4cG9ydCBkZWZhdWx0IHBhcnNlOyIsImV4cG9ydCBkZWZhdWx0IC9eKD86WzAtOWEtZl17OH0tWzAtOWEtZl17NH0tWzEtNV1bMC05YS1mXXszfS1bODlhYl1bMC05YS1mXXszfS1bMC05YS1mXXsxMn18MDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAwKSQvaTsiLCIvLyBVbmlxdWUgSUQgY3JlYXRpb24gcmVxdWlyZXMgYSBoaWdoIHF1YWxpdHkgcmFuZG9tICMgZ2VuZXJhdG9yLiBJbiB0aGUgYnJvd3NlciB3ZSB0aGVyZWZvcmVcbi8vIHJlcXVpcmUgdGhlIGNyeXB0byBBUEkgYW5kIGRvIG5vdCBzdXBwb3J0IGJ1aWx0LWluIGZhbGxiYWNrIHRvIGxvd2VyIHF1YWxpdHkgcmFuZG9tIG51bWJlclxuLy8gZ2VuZXJhdG9ycyAobGlrZSBNYXRoLnJhbmRvbSgpKS5cbnZhciBnZXRSYW5kb21WYWx1ZXM7XG52YXIgcm5kczggPSBuZXcgVWludDhBcnJheSgxNik7XG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBybmcoKSB7XG4gIC8vIGxhenkgbG9hZCBzbyB0aGF0IGVudmlyb25tZW50cyB0aGF0IG5lZWQgdG8gcG9seWZpbGwgaGF2ZSBhIGNoYW5jZSB0byBkbyBzb1xuICBpZiAoIWdldFJhbmRvbVZhbHVlcykge1xuICAgIC8vIGdldFJhbmRvbVZhbHVlcyBuZWVkcyB0byBiZSBpbnZva2VkIGluIGEgY29udGV4dCB3aGVyZSBcInRoaXNcIiBpcyBhIENyeXB0byBpbXBsZW1lbnRhdGlvbi4gQWxzbyxcbiAgICAvLyBmaW5kIHRoZSBjb21wbGV0ZSBpbXBsZW1lbnRhdGlvbiBvZiBjcnlwdG8gKG1zQ3J5cHRvKSBvbiBJRTExLlxuICAgIGdldFJhbmRvbVZhbHVlcyA9IHR5cGVvZiBjcnlwdG8gIT09ICd1bmRlZmluZWQnICYmIGNyeXB0by5nZXRSYW5kb21WYWx1ZXMgJiYgY3J5cHRvLmdldFJhbmRvbVZhbHVlcy5iaW5kKGNyeXB0bykgfHwgdHlwZW9mIG1zQ3J5cHRvICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbXNDcnlwdG8uZ2V0UmFuZG9tVmFsdWVzID09PSAnZnVuY3Rpb24nICYmIG1zQ3J5cHRvLmdldFJhbmRvbVZhbHVlcy5iaW5kKG1zQ3J5cHRvKTtcblxuICAgIGlmICghZ2V0UmFuZG9tVmFsdWVzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NyeXB0by5nZXRSYW5kb21WYWx1ZXMoKSBub3Qgc3VwcG9ydGVkLiBTZWUgaHR0cHM6Ly9naXRodWIuY29tL3V1aWRqcy91dWlkI2dldHJhbmRvbXZhbHVlcy1ub3Qtc3VwcG9ydGVkJyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGdldFJhbmRvbVZhbHVlcyhybmRzOCk7XG59IiwiLy8gQWRhcHRlZCBmcm9tIENocmlzIFZlbmVzcycgU0hBMSBjb2RlIGF0XG4vLyBodHRwOi8vd3d3Lm1vdmFibGUtdHlwZS5jby51ay9zY3JpcHRzL3NoYTEuaHRtbFxuZnVuY3Rpb24gZihzLCB4LCB5LCB6KSB7XG4gIHN3aXRjaCAocykge1xuICAgIGNhc2UgMDpcbiAgICAgIHJldHVybiB4ICYgeSBeIH54ICYgejtcblxuICAgIGNhc2UgMTpcbiAgICAgIHJldHVybiB4IF4geSBeIHo7XG5cbiAgICBjYXNlIDI6XG4gICAgICByZXR1cm4geCAmIHkgXiB4ICYgeiBeIHkgJiB6O1xuXG4gICAgY2FzZSAzOlxuICAgICAgcmV0dXJuIHggXiB5IF4gejtcbiAgfVxufVxuXG5mdW5jdGlvbiBST1RMKHgsIG4pIHtcbiAgcmV0dXJuIHggPDwgbiB8IHggPj4+IDMyIC0gbjtcbn1cblxuZnVuY3Rpb24gc2hhMShieXRlcykge1xuICB2YXIgSyA9IFsweDVhODI3OTk5LCAweDZlZDllYmExLCAweDhmMWJiY2RjLCAweGNhNjJjMWQ2XTtcbiAgdmFyIEggPSBbMHg2NzQ1MjMwMSwgMHhlZmNkYWI4OSwgMHg5OGJhZGNmZSwgMHgxMDMyNTQ3NiwgMHhjM2QyZTFmMF07XG5cbiAgaWYgKHR5cGVvZiBieXRlcyA9PT0gJ3N0cmluZycpIHtcbiAgICB2YXIgbXNnID0gdW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KGJ5dGVzKSk7IC8vIFVURjggZXNjYXBlXG5cbiAgICBieXRlcyA9IFtdO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtc2cubGVuZ3RoOyArK2kpIHtcbiAgICAgIGJ5dGVzLnB1c2gobXNnLmNoYXJDb2RlQXQoaSkpO1xuICAgIH1cbiAgfSBlbHNlIGlmICghQXJyYXkuaXNBcnJheShieXRlcykpIHtcbiAgICAvLyBDb252ZXJ0IEFycmF5LWxpa2UgdG8gQXJyYXlcbiAgICBieXRlcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGJ5dGVzKTtcbiAgfVxuXG4gIGJ5dGVzLnB1c2goMHg4MCk7XG4gIHZhciBsID0gYnl0ZXMubGVuZ3RoIC8gNCArIDI7XG4gIHZhciBOID0gTWF0aC5jZWlsKGwgLyAxNik7XG4gIHZhciBNID0gbmV3IEFycmF5KE4pO1xuXG4gIGZvciAodmFyIF9pID0gMDsgX2kgPCBOOyArK19pKSB7XG4gICAgdmFyIGFyciA9IG5ldyBVaW50MzJBcnJheSgxNik7XG5cbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IDE2OyArK2opIHtcbiAgICAgIGFycltqXSA9IGJ5dGVzW19pICogNjQgKyBqICogNF0gPDwgMjQgfCBieXRlc1tfaSAqIDY0ICsgaiAqIDQgKyAxXSA8PCAxNiB8IGJ5dGVzW19pICogNjQgKyBqICogNCArIDJdIDw8IDggfCBieXRlc1tfaSAqIDY0ICsgaiAqIDQgKyAzXTtcbiAgICB9XG5cbiAgICBNW19pXSA9IGFycjtcbiAgfVxuXG4gIE1bTiAtIDFdWzE0XSA9IChieXRlcy5sZW5ndGggLSAxKSAqIDggLyBNYXRoLnBvdygyLCAzMik7XG4gIE1bTiAtIDFdWzE0XSA9IE1hdGguZmxvb3IoTVtOIC0gMV1bMTRdKTtcbiAgTVtOIC0gMV1bMTVdID0gKGJ5dGVzLmxlbmd0aCAtIDEpICogOCAmIDB4ZmZmZmZmZmY7XG5cbiAgZm9yICh2YXIgX2kyID0gMDsgX2kyIDwgTjsgKytfaTIpIHtcbiAgICB2YXIgVyA9IG5ldyBVaW50MzJBcnJheSg4MCk7XG5cbiAgICBmb3IgKHZhciB0ID0gMDsgdCA8IDE2OyArK3QpIHtcbiAgICAgIFdbdF0gPSBNW19pMl1bdF07XG4gICAgfVxuXG4gICAgZm9yICh2YXIgX3QgPSAxNjsgX3QgPCA4MDsgKytfdCkge1xuICAgICAgV1tfdF0gPSBST1RMKFdbX3QgLSAzXSBeIFdbX3QgLSA4XSBeIFdbX3QgLSAxNF0gXiBXW190IC0gMTZdLCAxKTtcbiAgICB9XG5cbiAgICB2YXIgYSA9IEhbMF07XG4gICAgdmFyIGIgPSBIWzFdO1xuICAgIHZhciBjID0gSFsyXTtcbiAgICB2YXIgZCA9IEhbM107XG4gICAgdmFyIGUgPSBIWzRdO1xuXG4gICAgZm9yICh2YXIgX3QyID0gMDsgX3QyIDwgODA7ICsrX3QyKSB7XG4gICAgICB2YXIgcyA9IE1hdGguZmxvb3IoX3QyIC8gMjApO1xuICAgICAgdmFyIFQgPSBST1RMKGEsIDUpICsgZihzLCBiLCBjLCBkKSArIGUgKyBLW3NdICsgV1tfdDJdID4+PiAwO1xuICAgICAgZSA9IGQ7XG4gICAgICBkID0gYztcbiAgICAgIGMgPSBST1RMKGIsIDMwKSA+Pj4gMDtcbiAgICAgIGIgPSBhO1xuICAgICAgYSA9IFQ7XG4gICAgfVxuXG4gICAgSFswXSA9IEhbMF0gKyBhID4+PiAwO1xuICAgIEhbMV0gPSBIWzFdICsgYiA+Pj4gMDtcbiAgICBIWzJdID0gSFsyXSArIGMgPj4+IDA7XG4gICAgSFszXSA9IEhbM10gKyBkID4+PiAwO1xuICAgIEhbNF0gPSBIWzRdICsgZSA+Pj4gMDtcbiAgfVxuXG4gIHJldHVybiBbSFswXSA+PiAyNCAmIDB4ZmYsIEhbMF0gPj4gMTYgJiAweGZmLCBIWzBdID4+IDggJiAweGZmLCBIWzBdICYgMHhmZiwgSFsxXSA+PiAyNCAmIDB4ZmYsIEhbMV0gPj4gMTYgJiAweGZmLCBIWzFdID4+IDggJiAweGZmLCBIWzFdICYgMHhmZiwgSFsyXSA+PiAyNCAmIDB4ZmYsIEhbMl0gPj4gMTYgJiAweGZmLCBIWzJdID4+IDggJiAweGZmLCBIWzJdICYgMHhmZiwgSFszXSA+PiAyNCAmIDB4ZmYsIEhbM10gPj4gMTYgJiAweGZmLCBIWzNdID4+IDggJiAweGZmLCBIWzNdICYgMHhmZiwgSFs0XSA+PiAyNCAmIDB4ZmYsIEhbNF0gPj4gMTYgJiAweGZmLCBIWzRdID4+IDggJiAweGZmLCBIWzRdICYgMHhmZl07XG59XG5cbmV4cG9ydCBkZWZhdWx0IHNoYTE7IiwiaW1wb3J0IHZhbGlkYXRlIGZyb20gJy4vdmFsaWRhdGUuanMnO1xuLyoqXG4gKiBDb252ZXJ0IGFycmF5IG9mIDE2IGJ5dGUgdmFsdWVzIHRvIFVVSUQgc3RyaW5nIGZvcm1hdCBvZiB0aGUgZm9ybTpcbiAqIFhYWFhYWFhYLVhYWFgtWFhYWC1YWFhYLVhYWFhYWFhYWFhYWFxuICovXG5cbnZhciBieXRlVG9IZXggPSBbXTtcblxuZm9yICh2YXIgaSA9IDA7IGkgPCAyNTY7ICsraSkge1xuICBieXRlVG9IZXgucHVzaCgoaSArIDB4MTAwKS50b1N0cmluZygxNikuc3Vic3RyKDEpKTtcbn1cblxuZnVuY3Rpb24gc3RyaW5naWZ5KGFycikge1xuICB2YXIgb2Zmc2V0ID0gYXJndW1lbnRzLmxlbmd0aCA+IDEgJiYgYXJndW1lbnRzWzFdICE9PSB1bmRlZmluZWQgPyBhcmd1bWVudHNbMV0gOiAwO1xuICAvLyBOb3RlOiBCZSBjYXJlZnVsIGVkaXRpbmcgdGhpcyBjb2RlISAgSXQncyBiZWVuIHR1bmVkIGZvciBwZXJmb3JtYW5jZVxuICAvLyBhbmQgd29ya3MgaW4gd2F5cyB5b3UgbWF5IG5vdCBleHBlY3QuIFNlZSBodHRwczovL2dpdGh1Yi5jb20vdXVpZGpzL3V1aWQvcHVsbC80MzRcbiAgdmFyIHV1aWQgPSAoYnl0ZVRvSGV4W2FycltvZmZzZXQgKyAwXV0gKyBieXRlVG9IZXhbYXJyW29mZnNldCArIDFdXSArIGJ5dGVUb0hleFthcnJbb2Zmc2V0ICsgMl1dICsgYnl0ZVRvSGV4W2FycltvZmZzZXQgKyAzXV0gKyAnLScgKyBieXRlVG9IZXhbYXJyW29mZnNldCArIDRdXSArIGJ5dGVUb0hleFthcnJbb2Zmc2V0ICsgNV1dICsgJy0nICsgYnl0ZVRvSGV4W2FycltvZmZzZXQgKyA2XV0gKyBieXRlVG9IZXhbYXJyW29mZnNldCArIDddXSArICctJyArIGJ5dGVUb0hleFthcnJbb2Zmc2V0ICsgOF1dICsgYnl0ZVRvSGV4W2FycltvZmZzZXQgKyA5XV0gKyAnLScgKyBieXRlVG9IZXhbYXJyW29mZnNldCArIDEwXV0gKyBieXRlVG9IZXhbYXJyW29mZnNldCArIDExXV0gKyBieXRlVG9IZXhbYXJyW29mZnNldCArIDEyXV0gKyBieXRlVG9IZXhbYXJyW29mZnNldCArIDEzXV0gKyBieXRlVG9IZXhbYXJyW29mZnNldCArIDE0XV0gKyBieXRlVG9IZXhbYXJyW29mZnNldCArIDE1XV0pLnRvTG93ZXJDYXNlKCk7IC8vIENvbnNpc3RlbmN5IGNoZWNrIGZvciB2YWxpZCBVVUlELiAgSWYgdGhpcyB0aHJvd3MsIGl0J3MgbGlrZWx5IGR1ZSB0byBvbmVcbiAgLy8gb2YgdGhlIGZvbGxvd2luZzpcbiAgLy8gLSBPbmUgb3IgbW9yZSBpbnB1dCBhcnJheSB2YWx1ZXMgZG9uJ3QgbWFwIHRvIGEgaGV4IG9jdGV0IChsZWFkaW5nIHRvXG4gIC8vIFwidW5kZWZpbmVkXCIgaW4gdGhlIHV1aWQpXG4gIC8vIC0gSW52YWxpZCBpbnB1dCB2YWx1ZXMgZm9yIHRoZSBSRkMgYHZlcnNpb25gIG9yIGB2YXJpYW50YCBmaWVsZHNcblxuICBpZiAoIXZhbGlkYXRlKHV1aWQpKSB7XG4gICAgdGhyb3cgVHlwZUVycm9yKCdTdHJpbmdpZmllZCBVVUlEIGlzIGludmFsaWQnKTtcbiAgfVxuXG4gIHJldHVybiB1dWlkO1xufVxuXG5leHBvcnQgZGVmYXVsdCBzdHJpbmdpZnk7IiwiaW1wb3J0IHJuZyBmcm9tICcuL3JuZy5qcyc7XG5pbXBvcnQgc3RyaW5naWZ5IGZyb20gJy4vc3RyaW5naWZ5LmpzJzsgLy8gKipgdjEoKWAgLSBHZW5lcmF0ZSB0aW1lLWJhc2VkIFVVSUQqKlxuLy9cbi8vIEluc3BpcmVkIGJ5IGh0dHBzOi8vZ2l0aHViLmNvbS9MaW9zSy9VVUlELmpzXG4vLyBhbmQgaHR0cDovL2RvY3MucHl0aG9uLm9yZy9saWJyYXJ5L3V1aWQuaHRtbFxuXG52YXIgX25vZGVJZDtcblxudmFyIF9jbG9ja3NlcTsgLy8gUHJldmlvdXMgdXVpZCBjcmVhdGlvbiB0aW1lXG5cblxudmFyIF9sYXN0TVNlY3MgPSAwO1xudmFyIF9sYXN0TlNlY3MgPSAwOyAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL3V1aWRqcy91dWlkIGZvciBBUEkgZGV0YWlsc1xuXG5mdW5jdGlvbiB2MShvcHRpb25zLCBidWYsIG9mZnNldCkge1xuICB2YXIgaSA9IGJ1ZiAmJiBvZmZzZXQgfHwgMDtcbiAgdmFyIGIgPSBidWYgfHwgbmV3IEFycmF5KDE2KTtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIHZhciBub2RlID0gb3B0aW9ucy5ub2RlIHx8IF9ub2RlSWQ7XG4gIHZhciBjbG9ja3NlcSA9IG9wdGlvbnMuY2xvY2tzZXEgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuY2xvY2tzZXEgOiBfY2xvY2tzZXE7IC8vIG5vZGUgYW5kIGNsb2Nrc2VxIG5lZWQgdG8gYmUgaW5pdGlhbGl6ZWQgdG8gcmFuZG9tIHZhbHVlcyBpZiB0aGV5J3JlIG5vdFxuICAvLyBzcGVjaWZpZWQuICBXZSBkbyB0aGlzIGxhemlseSB0byBtaW5pbWl6ZSBpc3N1ZXMgcmVsYXRlZCB0byBpbnN1ZmZpY2llbnRcbiAgLy8gc3lzdGVtIGVudHJvcHkuICBTZWUgIzE4OVxuXG4gIGlmIChub2RlID09IG51bGwgfHwgY2xvY2tzZXEgPT0gbnVsbCkge1xuICAgIHZhciBzZWVkQnl0ZXMgPSBvcHRpb25zLnJhbmRvbSB8fCAob3B0aW9ucy5ybmcgfHwgcm5nKSgpO1xuXG4gICAgaWYgKG5vZGUgPT0gbnVsbCkge1xuICAgICAgLy8gUGVyIDQuNSwgY3JlYXRlIGFuZCA0OC1iaXQgbm9kZSBpZCwgKDQ3IHJhbmRvbSBiaXRzICsgbXVsdGljYXN0IGJpdCA9IDEpXG4gICAgICBub2RlID0gX25vZGVJZCA9IFtzZWVkQnl0ZXNbMF0gfCAweDAxLCBzZWVkQnl0ZXNbMV0sIHNlZWRCeXRlc1syXSwgc2VlZEJ5dGVzWzNdLCBzZWVkQnl0ZXNbNF0sIHNlZWRCeXRlc1s1XV07XG4gICAgfVxuXG4gICAgaWYgKGNsb2Nrc2VxID09IG51bGwpIHtcbiAgICAgIC8vIFBlciA0LjIuMiwgcmFuZG9taXplICgxNCBiaXQpIGNsb2Nrc2VxXG4gICAgICBjbG9ja3NlcSA9IF9jbG9ja3NlcSA9IChzZWVkQnl0ZXNbNl0gPDwgOCB8IHNlZWRCeXRlc1s3XSkgJiAweDNmZmY7XG4gICAgfVxuICB9IC8vIFVVSUQgdGltZXN0YW1wcyBhcmUgMTAwIG5hbm8tc2Vjb25kIHVuaXRzIHNpbmNlIHRoZSBHcmVnb3JpYW4gZXBvY2gsXG4gIC8vICgxNTgyLTEwLTE1IDAwOjAwKS4gIEpTTnVtYmVycyBhcmVuJ3QgcHJlY2lzZSBlbm91Z2ggZm9yIHRoaXMsIHNvXG4gIC8vIHRpbWUgaXMgaGFuZGxlZCBpbnRlcm5hbGx5IGFzICdtc2VjcycgKGludGVnZXIgbWlsbGlzZWNvbmRzKSBhbmQgJ25zZWNzJ1xuICAvLyAoMTAwLW5hbm9zZWNvbmRzIG9mZnNldCBmcm9tIG1zZWNzKSBzaW5jZSB1bml4IGVwb2NoLCAxOTcwLTAxLTAxIDAwOjAwLlxuXG5cbiAgdmFyIG1zZWNzID0gb3B0aW9ucy5tc2VjcyAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5tc2VjcyA6IERhdGUubm93KCk7IC8vIFBlciA0LjIuMS4yLCB1c2UgY291bnQgb2YgdXVpZCdzIGdlbmVyYXRlZCBkdXJpbmcgdGhlIGN1cnJlbnQgY2xvY2tcbiAgLy8gY3ljbGUgdG8gc2ltdWxhdGUgaGlnaGVyIHJlc29sdXRpb24gY2xvY2tcblxuICB2YXIgbnNlY3MgPSBvcHRpb25zLm5zZWNzICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLm5zZWNzIDogX2xhc3ROU2VjcyArIDE7IC8vIFRpbWUgc2luY2UgbGFzdCB1dWlkIGNyZWF0aW9uIChpbiBtc2VjcylcblxuICB2YXIgZHQgPSBtc2VjcyAtIF9sYXN0TVNlY3MgKyAobnNlY3MgLSBfbGFzdE5TZWNzKSAvIDEwMDAwOyAvLyBQZXIgNC4yLjEuMiwgQnVtcCBjbG9ja3NlcSBvbiBjbG9jayByZWdyZXNzaW9uXG5cbiAgaWYgKGR0IDwgMCAmJiBvcHRpb25zLmNsb2Nrc2VxID09PSB1bmRlZmluZWQpIHtcbiAgICBjbG9ja3NlcSA9IGNsb2Nrc2VxICsgMSAmIDB4M2ZmZjtcbiAgfSAvLyBSZXNldCBuc2VjcyBpZiBjbG9jayByZWdyZXNzZXMgKG5ldyBjbG9ja3NlcSkgb3Igd2UndmUgbW92ZWQgb250byBhIG5ld1xuICAvLyB0aW1lIGludGVydmFsXG5cblxuICBpZiAoKGR0IDwgMCB8fCBtc2VjcyA+IF9sYXN0TVNlY3MpICYmIG9wdGlvbnMubnNlY3MgPT09IHVuZGVmaW5lZCkge1xuICAgIG5zZWNzID0gMDtcbiAgfSAvLyBQZXIgNC4yLjEuMiBUaHJvdyBlcnJvciBpZiB0b28gbWFueSB1dWlkcyBhcmUgcmVxdWVzdGVkXG5cblxuICBpZiAobnNlY3MgPj0gMTAwMDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJ1dWlkLnYxKCk6IENhbid0IGNyZWF0ZSBtb3JlIHRoYW4gMTBNIHV1aWRzL3NlY1wiKTtcbiAgfVxuXG4gIF9sYXN0TVNlY3MgPSBtc2VjcztcbiAgX2xhc3ROU2VjcyA9IG5zZWNzO1xuICBfY2xvY2tzZXEgPSBjbG9ja3NlcTsgLy8gUGVyIDQuMS40IC0gQ29udmVydCBmcm9tIHVuaXggZXBvY2ggdG8gR3JlZ29yaWFuIGVwb2NoXG5cbiAgbXNlY3MgKz0gMTIyMTkyOTI4MDAwMDA7IC8vIGB0aW1lX2xvd2BcblxuICB2YXIgdGwgPSAoKG1zZWNzICYgMHhmZmZmZmZmKSAqIDEwMDAwICsgbnNlY3MpICUgMHgxMDAwMDAwMDA7XG4gIGJbaSsrXSA9IHRsID4+PiAyNCAmIDB4ZmY7XG4gIGJbaSsrXSA9IHRsID4+PiAxNiAmIDB4ZmY7XG4gIGJbaSsrXSA9IHRsID4+PiA4ICYgMHhmZjtcbiAgYltpKytdID0gdGwgJiAweGZmOyAvLyBgdGltZV9taWRgXG5cbiAgdmFyIHRtaCA9IG1zZWNzIC8gMHgxMDAwMDAwMDAgKiAxMDAwMCAmIDB4ZmZmZmZmZjtcbiAgYltpKytdID0gdG1oID4+PiA4ICYgMHhmZjtcbiAgYltpKytdID0gdG1oICYgMHhmZjsgLy8gYHRpbWVfaGlnaF9hbmRfdmVyc2lvbmBcblxuICBiW2krK10gPSB0bWggPj4+IDI0ICYgMHhmIHwgMHgxMDsgLy8gaW5jbHVkZSB2ZXJzaW9uXG5cbiAgYltpKytdID0gdG1oID4+PiAxNiAmIDB4ZmY7IC8vIGBjbG9ja19zZXFfaGlfYW5kX3Jlc2VydmVkYCAoUGVyIDQuMi4yIC0gaW5jbHVkZSB2YXJpYW50KVxuXG4gIGJbaSsrXSA9IGNsb2Nrc2VxID4+PiA4IHwgMHg4MDsgLy8gYGNsb2NrX3NlcV9sb3dgXG5cbiAgYltpKytdID0gY2xvY2tzZXEgJiAweGZmOyAvLyBgbm9kZWBcblxuICBmb3IgKHZhciBuID0gMDsgbiA8IDY7ICsrbikge1xuICAgIGJbaSArIG5dID0gbm9kZVtuXTtcbiAgfVxuXG4gIHJldHVybiBidWYgfHwgc3RyaW5naWZ5KGIpO1xufVxuXG5leHBvcnQgZGVmYXVsdCB2MTsiLCJpbXBvcnQgdjM1IGZyb20gJy4vdjM1LmpzJztcbmltcG9ydCBtZDUgZnJvbSAnLi9tZDUuanMnO1xudmFyIHYzID0gdjM1KCd2MycsIDB4MzAsIG1kNSk7XG5leHBvcnQgZGVmYXVsdCB2MzsiLCJpbXBvcnQgc3RyaW5naWZ5IGZyb20gJy4vc3RyaW5naWZ5LmpzJztcbmltcG9ydCBwYXJzZSBmcm9tICcuL3BhcnNlLmpzJztcblxuZnVuY3Rpb24gc3RyaW5nVG9CeXRlcyhzdHIpIHtcbiAgc3RyID0gdW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KHN0cikpOyAvLyBVVEY4IGVzY2FwZVxuXG4gIHZhciBieXRlcyA9IFtdO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgKytpKSB7XG4gICAgYnl0ZXMucHVzaChzdHIuY2hhckNvZGVBdChpKSk7XG4gIH1cblxuICByZXR1cm4gYnl0ZXM7XG59XG5cbmV4cG9ydCB2YXIgRE5TID0gJzZiYTdiODEwLTlkYWQtMTFkMS04MGI0LTAwYzA0ZmQ0MzBjOCc7XG5leHBvcnQgdmFyIFVSTCA9ICc2YmE3YjgxMS05ZGFkLTExZDEtODBiNC0wMGMwNGZkNDMwYzgnO1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKG5hbWUsIHZlcnNpb24sIGhhc2hmdW5jKSB7XG4gIGZ1bmN0aW9uIGdlbmVyYXRlVVVJRCh2YWx1ZSwgbmFtZXNwYWNlLCBidWYsIG9mZnNldCkge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICB2YWx1ZSA9IHN0cmluZ1RvQnl0ZXModmFsdWUpO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgbmFtZXNwYWNlID09PSAnc3RyaW5nJykge1xuICAgICAgbmFtZXNwYWNlID0gcGFyc2UobmFtZXNwYWNlKTtcbiAgICB9XG5cbiAgICBpZiAobmFtZXNwYWNlLmxlbmd0aCAhPT0gMTYpIHtcbiAgICAgIHRocm93IFR5cGVFcnJvcignTmFtZXNwYWNlIG11c3QgYmUgYXJyYXktbGlrZSAoMTYgaXRlcmFibGUgaW50ZWdlciB2YWx1ZXMsIDAtMjU1KScpO1xuICAgIH0gLy8gQ29tcHV0ZSBoYXNoIG9mIG5hbWVzcGFjZSBhbmQgdmFsdWUsIFBlciA0LjNcbiAgICAvLyBGdXR1cmU6IFVzZSBzcHJlYWQgc3ludGF4IHdoZW4gc3VwcG9ydGVkIG9uIGFsbCBwbGF0Zm9ybXMsIGUuZy4gYGJ5dGVzID1cbiAgICAvLyBoYXNoZnVuYyhbLi4ubmFtZXNwYWNlLCAuLi4gdmFsdWVdKWBcblxuXG4gICAgdmFyIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoMTYgKyB2YWx1ZS5sZW5ndGgpO1xuICAgIGJ5dGVzLnNldChuYW1lc3BhY2UpO1xuICAgIGJ5dGVzLnNldCh2YWx1ZSwgbmFtZXNwYWNlLmxlbmd0aCk7XG4gICAgYnl0ZXMgPSBoYXNoZnVuYyhieXRlcyk7XG4gICAgYnl0ZXNbNl0gPSBieXRlc1s2XSAmIDB4MGYgfCB2ZXJzaW9uO1xuICAgIGJ5dGVzWzhdID0gYnl0ZXNbOF0gJiAweDNmIHwgMHg4MDtcblxuICAgIGlmIChidWYpIHtcbiAgICAgIG9mZnNldCA9IG9mZnNldCB8fCAwO1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IDE2OyArK2kpIHtcbiAgICAgICAgYnVmW29mZnNldCArIGldID0gYnl0ZXNbaV07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBidWY7XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0cmluZ2lmeShieXRlcyk7XG4gIH0gLy8gRnVuY3Rpb24jbmFtZSBpcyBub3Qgc2V0dGFibGUgb24gc29tZSBwbGF0Zm9ybXMgKCMyNzApXG5cblxuICB0cnkge1xuICAgIGdlbmVyYXRlVVVJRC5uYW1lID0gbmFtZTsgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWVtcHR5XG4gIH0gY2F0Y2ggKGVycikge30gLy8gRm9yIENvbW1vbkpTIGRlZmF1bHQgZXhwb3J0IHN1cHBvcnRcblxuXG4gIGdlbmVyYXRlVVVJRC5ETlMgPSBETlM7XG4gIGdlbmVyYXRlVVVJRC5VUkwgPSBVUkw7XG4gIHJldHVybiBnZW5lcmF0ZVVVSUQ7XG59IiwiaW1wb3J0IHJuZyBmcm9tICcuL3JuZy5qcyc7XG5pbXBvcnQgc3RyaW5naWZ5IGZyb20gJy4vc3RyaW5naWZ5LmpzJztcblxuZnVuY3Rpb24gdjQob3B0aW9ucywgYnVmLCBvZmZzZXQpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIHZhciBybmRzID0gb3B0aW9ucy5yYW5kb20gfHwgKG9wdGlvbnMucm5nIHx8IHJuZykoKTsgLy8gUGVyIDQuNCwgc2V0IGJpdHMgZm9yIHZlcnNpb24gYW5kIGBjbG9ja19zZXFfaGlfYW5kX3Jlc2VydmVkYFxuXG4gIHJuZHNbNl0gPSBybmRzWzZdICYgMHgwZiB8IDB4NDA7XG4gIHJuZHNbOF0gPSBybmRzWzhdICYgMHgzZiB8IDB4ODA7IC8vIENvcHkgYnl0ZXMgdG8gYnVmZmVyLCBpZiBwcm92aWRlZFxuXG4gIGlmIChidWYpIHtcbiAgICBvZmZzZXQgPSBvZmZzZXQgfHwgMDtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgMTY7ICsraSkge1xuICAgICAgYnVmW29mZnNldCArIGldID0gcm5kc1tpXTtcbiAgICB9XG5cbiAgICByZXR1cm4gYnVmO1xuICB9XG5cbiAgcmV0dXJuIHN0cmluZ2lmeShybmRzKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgdjQ7IiwiaW1wb3J0IHYzNSBmcm9tICcuL3YzNS5qcyc7XG5pbXBvcnQgc2hhMSBmcm9tICcuL3NoYTEuanMnO1xudmFyIHY1ID0gdjM1KCd2NScsIDB4NTAsIHNoYTEpO1xuZXhwb3J0IGRlZmF1bHQgdjU7IiwiaW1wb3J0IFJFR0VYIGZyb20gJy4vcmVnZXguanMnO1xuXG5mdW5jdGlvbiB2YWxpZGF0ZSh1dWlkKSB7XG4gIHJldHVybiB0eXBlb2YgdXVpZCA9PT0gJ3N0cmluZycgJiYgUkVHRVgudGVzdCh1dWlkKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgdmFsaWRhdGU7IiwiaW1wb3J0IHZhbGlkYXRlIGZyb20gJy4vdmFsaWRhdGUuanMnO1xuXG5mdW5jdGlvbiB2ZXJzaW9uKHV1aWQpIHtcbiAgaWYgKCF2YWxpZGF0ZSh1dWlkKSkge1xuICAgIHRocm93IFR5cGVFcnJvcignSW52YWxpZCBVVUlEJyk7XG4gIH1cblxuICByZXR1cm4gcGFyc2VJbnQodXVpZC5zdWJzdHIoMTQsIDEpLCAxNik7XG59XG5cbmV4cG9ydCBkZWZhdWx0IHZlcnNpb247IiwiLy8gVGhlIG1vZHVsZSBjYWNoZVxudmFyIF9fd2VicGFja19tb2R1bGVfY2FjaGVfXyA9IHt9O1xuXG4vLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcblx0dmFyIGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHR2YXIgbW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXSA9IHtcblx0XHQvLyBubyBtb2R1bGUuaWQgbmVlZGVkXG5cdFx0Ly8gbm8gbW9kdWxlLmxvYWRlZCBuZWVkZWRcblx0XHRleHBvcnRzOiB7fVxuXHR9O1xuXG5cdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXS5jYWxsKG1vZHVsZS5leHBvcnRzLCBtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIi8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb25zIGZvciBoYXJtb255IGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uZCA9IChleHBvcnRzLCBkZWZpbml0aW9uKSA9PiB7XG5cdGZvcih2YXIga2V5IGluIGRlZmluaXRpb24pIHtcblx0XHRpZihfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZGVmaW5pdGlvbiwga2V5KSAmJiAhX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIGtleSkpIHtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBkZWZpbml0aW9uW2tleV0gfSk7XG5cdFx0fVxuXHR9XG59OyIsIl9fd2VicGFja19yZXF1aXJlX18ubyA9IChvYmosIHByb3ApID0+IChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKSkiLCIvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSAoZXhwb3J0cykgPT4ge1xuXHRpZih0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiAnTW9kdWxlJyB9KTtcblx0fVxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xufTsiLCJpbXBvcnQgeyBpY2hpZ29SZWFkZXJFbGVtZW50Q2xhc3NOYW1lIH0gZnJvbSAnLi91dGlscy9jcmVhdGVTaGFkb3dPdmVybGF5JztcbmltcG9ydCB7IGNoZWNrSXNJbWFnZUVsZW1lbnQsIGNoZWNrSXNDYW52YXNFbGVtZW50IH0gZnJvbSAnLi91dGlscy9lbGVtZW50VXRpbHMnO1xuXG57XG5cdC8vIFJldmVydCBjYW52YXNlcyBhbmQgaW1hZ2VzIHRvIHRoZWlyIG9yaWdpbmFsIHNyYy5cblx0bGV0IHRyaWVzID0gMDtcblx0d2hpbGUgKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLW9yaWdpbmFsLXNyY10nKS5sZW5ndGggIT09IDApIHtcblx0XHRpZiAodHJpZXMgPiA1KSB7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cdFx0Zm9yIChjb25zdCBlbGVtZW50IG9mIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLW9yaWdpbmFsLXNyY10nKSkge1xuXHRcdFx0aWYgKGNoZWNrSXNDYW52YXNFbGVtZW50KGVsZW1lbnQpKSB7XG5cdFx0XHRcdGNvbnN0IG9yaWdpbmFsU3JjID0gZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtb3JpZ2luYWwtc3JjJykhO1xuXHRcdFx0XHRjb25zdCBvcmlnaW5hbEltYWdlID0gbmV3IEltYWdlKCk7XG5cdFx0XHRcdG9yaWdpbmFsSW1hZ2Uub25sb2FkID0gKCkgPT4ge1xuXHRcdFx0XHRcdGVsZW1lbnQud2lkdGggPSBvcmlnaW5hbEltYWdlLndpZHRoO1xuXHRcdFx0XHRcdGVsZW1lbnQuaGVpZ2h0ID0gb3JpZ2luYWxJbWFnZS5oZWlnaHQ7XG5cdFx0XHRcdFx0Y29uc3QgY29udGV4dCA9IGVsZW1lbnQuZ2V0Q29udGV4dCgnMmQnKTtcblx0XHRcdFx0XHRpZiAoY29udGV4dCkge1xuXHRcdFx0XHRcdFx0Y29udGV4dC5kcmF3SW1hZ2Uob3JpZ2luYWxJbWFnZSwgMCwgMCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdkYXRhLW9yaWdpbmFsLXNyYycpO1xuXHRcdFx0XHRcdGVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdkYXRhLXRyYW5zbGF0ZWQnKTtcblx0XHRcdFx0fTtcblx0XHRcdFx0b3JpZ2luYWxJbWFnZS5zcmMgPSBvcmlnaW5hbFNyYztcblx0XHRcdH0gZWxzZSBpZiAoY2hlY2tJc0ltYWdlRWxlbWVudChlbGVtZW50KSkge1xuXHRcdFx0XHRlbGVtZW50LnNldEF0dHJpYnV0ZSgnc3JjJywgZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtb3JpZ2luYWwtc3JjJykhKTtcblx0XHRcdFx0ZWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUoJ2RhdGEtb3JpZ2luYWwtc3JjJyk7XG5cdFx0XHRcdGVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdkYXRhLXRyYW5zbGF0ZWQnKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIEVsZW1lbnQgd2l0aCBhIGJhY2tncm91bmQgaW1hZ2UuXG5cdFx0XHRcdGNvbnN0IG9yaWdpbmFsU3JjID0gZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtb3JpZ2luYWwtc3JjJyk7XG5cdFx0XHRcdGlmICgoZWxlbWVudCBhcyBhbnkpPy5zdHlsZT8uYmFja2dyb3VuZEltYWdlICYmIG9yaWdpbmFsU3JjKSB7XG5cdFx0XHRcdFx0KGVsZW1lbnQgYXMgYW55KS5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSBgdXJsKFwiJHtvcmlnaW5hbFNyY31cIilgO1xuXHRcdFx0XHRcdGVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdkYXRhLW9yaWdpbmFsLXNyYycpO1xuXHRcdFx0XHRcdGVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdkYXRhLXRyYW5zbGF0ZWQnKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHR0cmllcysrO1xuXHR9XG59XG5cbntcblx0Ly8gUmVtb3ZlIGFueSBvdmVybGF5cyBvciBsb2FkaW5nIHNwaW5uZXJzLlxuXHRsZXQgdHJpZXMgPSAwO1xuXHR3aGlsZSAoZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShpY2hpZ29SZWFkZXJFbGVtZW50Q2xhc3NOYW1lKS5sZW5ndGggIT09IDApIHtcblx0XHRpZiAodHJpZXMgPiA1KSB7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cdFx0Zm9yIChjb25zdCBlbGVtZW50IG9mIGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoaWNoaWdvUmVhZGVyRWxlbWVudENsYXNzTmFtZSkpIHtcblx0XHRcdGVsZW1lbnQucmVtb3ZlKCk7XG5cdFx0fVxuXHRcdHRyaWVzKys7XG5cdH1cbn1cbiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==