/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

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
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it uses a non-standard name for the exports (exports).
(() => {
var exports = __webpack_exports__;
/*!*************************************!*\
  !*** ./src/app/setExtensionIcon.ts ***!
  \*************************************/

Object.defineProperty(exports, "__esModule", ({ value: true }));
const chromeApi_1 = __webpack_require__(/*! ../utils/chromeApi */ "./src/utils/chromeApi.ts");
setExtensionIcon();
function setExtensionIcon() {
    (0, chromeApi_1.postBackgroundMessage)({
        kind: 'setExtensionIcon'
    });
}

})();

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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QUFDO0FBQ0osQ0FBQztBQUVELFNBQWdCLGNBQWMsQ0FBSSxHQUFXLEVBQUUsS0FBUTtJQUN0RCxNQUFNLFlBQVksR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDcEMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRTtRQUM1QixJQUFJLENBQUM7WUFDSixNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxFQUFFLEtBQUssRUFBRSxFQUFFLEdBQUcsRUFBRTtnQkFDeEQsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2YsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDO1FBQUMsV0FBTSxDQUFDO1lBQ1IsNkJBQTZCO1lBQzdCLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNoQixDQUFDO0lBQ0YsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDO0FBRUQsU0FBUyxTQUFTLENBQUMsR0FBVztJQUM3QixNQUFNLFNBQVMsR0FBRyxLQUFLLENBQUM7SUFDeEIsT0FBTyxHQUFHLFNBQVMsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUM5QixDQUFDOzs7Ozs7O1VDcEhEO1VBQ0E7O1VBRUE7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7O1VBRUE7VUFDQTs7VUFFQTtVQUNBO1VBQ0E7Ozs7Ozs7Ozs7OztBQ3RCQSw4RkFBMkQ7QUFFM0QsZ0JBQWdCLEVBQUUsQ0FBQztBQUVuQixTQUFTLGdCQUFnQjtJQUN4QixxQ0FBcUIsRUFBQztRQUNyQixJQUFJLEVBQUUsa0JBQWtCO0tBQ3hCLENBQUMsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9pY2hpZ28tcmVhZGVyLy4vc3JjL3V0aWxzL2Nocm9tZUFwaS50cyIsIndlYnBhY2s6Ly9pY2hpZ28tcmVhZGVyL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL2ljaGlnby1yZWFkZXIvLi9zcmMvYXBwL3NldEV4dGVuc2lvbkljb24udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gTW9kdWxlIGZvciBtYWtpbmcgd29ya2luZyB3aXRoIHRoZSBDaHJvbWUgQVBJIGVhc2llci5cbi8vIFRoaXMgbWF5IGluY2x1ZGUgbWFraW5nIHRoZSBBUEkgYXN5bmMsIHNpbXBsaWZ5aW5nIHRoZSBpbnRlcmZhY2UsIG9yIG1vcmUuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q3VycmVudFRhYigpOiBQcm9taXNlPFxuXHQoY2hyb21lLnRhYnMuVGFiICYgeyBnZXRIb3N0TmFtZTogKCkgPT4gc3RyaW5nIH0pIHwgdW5kZWZpbmVkXG4+IHtcblx0cmV0dXJuIG5ldyBQcm9taXNlPChjaHJvbWUudGFicy5UYWIgJiB7IGdldEhvc3ROYW1lOiAoKSA9PiBzdHJpbmcgfSkgfCB1bmRlZmluZWQ+KHJlc29sdmUgPT4ge1xuXHRcdGNocm9tZS50YWJzLnF1ZXJ5KHsgY3VycmVudFdpbmRvdzogdHJ1ZSwgYWN0aXZlOiB0cnVlIH0sIGZ1bmN0aW9uICh0YWJzKSB7XG5cdFx0XHRpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKSB7XG5cdFx0XHRcdHJlc29sdmUodW5kZWZpbmVkKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjdXJyZW50VGFiOiBhbnkgPSB0YWJzWzBdO1xuXHRcdFx0aWYgKCFjdXJyZW50VGFiPy51cmwpIHtcblx0XHRcdFx0cmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGN1cnJlbnRUYWIuZ2V0SG9zdE5hbWUgPSAoKSA9PiB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBVUkwoY3VycmVudFRhYi51cmwpLmhvc3RuYW1lO1xuXHRcdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0XHRyZXR1cm4gJyc7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRyZXNvbHZlKGN1cnJlbnRUYWIpO1xuXHRcdH0pO1xuXHR9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVwZGF0ZVNlc3Npb25IZWFkZXJzKHJ1bGVPcHRpb25zOiBjaHJvbWUuZGVjbGFyYXRpdmVOZXRSZXF1ZXN0LlVwZGF0ZVJ1bGVPcHRpb25zKSB7XG5cdHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHRjaHJvbWUuZGVjbGFyYXRpdmVOZXRSZXF1ZXN0LnVwZGF0ZVNlc3Npb25SdWxlcyhydWxlT3B0aW9ucywgcmVzb2x2ZSk7XG5cdH0pO1xufVxuXG4vLyBXaW5kb3cgSUQgb2YgdGFiIHRvIGNhcHR1cmUsIGVnIGdldEN1cnJlbnRUYWIoKS53aW5kb3dJZDtcbmV4cG9ydCBmdW5jdGlvbiBjYXB0dXJlVmlzaWJsZVRhYih3aW5kb3dJZDogbnVtYmVyKSB7XG5cdHJldHVybiBuZXcgUHJvbWlzZTxzdHJpbmc+KHJlc29sdmUgPT5cblx0XHRjaHJvbWUudGFicy5jYXB0dXJlVmlzaWJsZVRhYih3aW5kb3dJZCwgeyBmb3JtYXQ6ICdwbmcnIH0sIHJlc29sdmUpXG5cdCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRab29tRmFjdG9yKHRhYklkOiBudW1iZXIpOiBQcm9taXNlPG51bWJlcj4ge1xuXHRyZXR1cm4gbmV3IFByb21pc2U8bnVtYmVyPihyZXNvbHZlID0+IGNocm9tZS50YWJzLmdldFpvb20odGFiSWQsIHJlc29sdmUpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldEV4dGVuc2lvbkljb24oaWNvbjogY2hyb21lLmJyb3dzZXJBY3Rpb24uVGFiSWNvbkRldGFpbHMpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0cmV0dXJuIG5ldyBQcm9taXNlPGJvb2xlYW4+KHJlc29sdmUgPT4ge1xuXHRcdGNocm9tZS5hY3Rpb24uc2V0SWNvbihpY29uLCAoKSA9PiB7XG5cdFx0XHRyZXNvbHZlKHRydWUpO1xuXHRcdH0pO1xuXHR9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGV4ZWN1dGVTY3JpcHQoXG5cdHRhYklkOiBudW1iZXIsXG5cdGZpbGVQYXRoOiBzdHJpbmcsXG5cdGFsbEZyYW1lcz86IGJvb2xlYW5cbik6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRyZXR1cm4gbmV3IFByb21pc2U8Ym9vbGVhbj4ocmVzb2x2ZSA9PiB7XG5cdFx0Y2hyb21lLnNjcmlwdGluZy5leGVjdXRlU2NyaXB0KFxuXHRcdFx0eyB0YXJnZXQ6IHsgdGFiSWQsIGFsbEZyYW1lczogYWxsRnJhbWVzID8/IHRydWUgfSwgZmlsZXM6IFtmaWxlUGF0aF0gfSxcblx0XHRcdCgpID0+IHtcblx0XHRcdFx0cmVzb2x2ZSh0cnVlKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzQWxsb3dlZEZpbGVTY2hlbWVBY2Nlc3MoKSB7XG5cdHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHRjaHJvbWUuZXh0ZW5zaW9uLmlzQWxsb3dlZEZpbGVTY2hlbWVBY2Nlc3MocmVzb2x2ZSk7XG5cdH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcG9zdEJhY2tncm91bmRNZXNzYWdlKG1lc3NhZ2U6IGFueSk6IGFueSB7XG5cdGNvbnN0IGV4dGVuc2lvbklkID0gdW5kZWZpbmVkOyAvLyB1bmRlZmluZWQgbWVhbnMgc2VuZCB0byBzZWxmLCBpbnN0ZWFkIG9mIGFub3RoZXIgZXh0ZW5zaW9uLlxuXHRjb25zdCBvcHRpb25zID0gdW5kZWZpbmVkO1xuXG5cdHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHRjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZShleHRlbnNpb25JZCwgbWVzc2FnZSwgb3B0aW9ucywgcmVzb2x2ZSk7XG5cdH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0U3RvcmFnZUl0ZW08VD4oa2V5OiBzdHJpbmcpOiBQcm9taXNlPFQgfCB1bmRlZmluZWQ+IHtcblx0Y29uc3QgZm9ybWF0dGVkS2V5ID0gZm9ybWF0S2V5KGtleSk7XG5cdHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHR0cnkge1xuXHRcdFx0Y2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KFtmb3JtYXR0ZWRLZXldLCBmdW5jdGlvbiAocmVzdWx0KSB7XG5cdFx0XHRcdHJlc29sdmUocmVzdWx0W2Zvcm1hdHRlZEtleV0pO1xuXHRcdFx0fSk7XG5cdFx0fSBjYXRjaCB7XG5cdFx0XHQvLyBEbyBub3RoaW5nIGlmIGNhY2hlIGZhaWxzLlxuXHRcdFx0cmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdH1cblx0fSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRTdG9yYWdlSXRlbTxUPihrZXk6IHN0cmluZywgdmFsdWU6IFQpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0Y29uc3QgZm9ybWF0dGVkS2V5ID0gZm9ybWF0S2V5KGtleSk7XG5cdHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHR0cnkge1xuXHRcdFx0Y2hyb21lLnN0b3JhZ2UubG9jYWwuc2V0KHsgW2Zvcm1hdHRlZEtleV06IHZhbHVlIH0sICgpID0+IHtcblx0XHRcdFx0cmVzb2x2ZSh0cnVlKTtcblx0XHRcdH0pO1xuXHRcdH0gY2F0Y2gge1xuXHRcdFx0Ly8gRG8gbm90aGluZyBpZiBjYWNoZSBmYWlscy5cblx0XHRcdHJlc29sdmUoZmFsc2UpO1xuXHRcdH1cblx0fSk7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdEtleShrZXk6IHN0cmluZykge1xuXHRjb25zdCBrZXlQcmVmaXggPSAnYXBwJztcblx0cmV0dXJuIGAke2tleVByZWZpeH0tJHtrZXl9YDtcbn1cbiIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0X193ZWJwYWNrX21vZHVsZXNfX1ttb2R1bGVJZF0obW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cblx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcblx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xufVxuXG4iLCJpbXBvcnQgeyBwb3N0QmFja2dyb3VuZE1lc3NhZ2UgfSBmcm9tICcuLi91dGlscy9jaHJvbWVBcGknO1xuXG5zZXRFeHRlbnNpb25JY29uKCk7XG5cbmZ1bmN0aW9uIHNldEV4dGVuc2lvbkljb24oKSB7XG5cdHBvc3RCYWNrZ3JvdW5kTWVzc2FnZSh7XG5cdFx0a2luZDogJ3NldEV4dGVuc2lvbkljb24nXG5cdH0pO1xufVxuIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9