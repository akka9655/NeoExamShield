// Mac detection - only declare if not already declared
let isMac;
if (typeof isMac === 'undefined') {
    isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || 
            navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
}

// Lists of events to intercept safely
const windowEvents = [
    "blur", 
    "focus", 
    "focusout", 
    "pagehide", 
    "lostpointercapture", 
    "visibilitychange", 
    "webkitvisibilitychange", 
    "fullscreenchange", 
    "webkitfullscreenchange", 
    "mouseleave", 
    "mouseout"
];

const documentEvents = [
    "blur", 
    "focus", 
    "focusout", 
    "pagehide", 
    "lostpointercapture", 
    "visibilitychange", 
    "webkitvisibilitychange", 
    "fullscreenchange", 
    "webkitfullscreenchange", 
    "mouseleave", 
    "mouseout"
];

// Store original property descriptors for restoration
let originalVisibilityState, originalWebkitVisibilityState, originalHidden;
try {
    originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    originalWebkitVisibilityState = Object.getOwnPropertyDescriptor(document, "webkitVisibilityState");
    originalHidden = Object.getOwnPropertyDescriptor(document, "hidden");
} catch (e) {}

// Event handler to prevent default tracking behavior safely
const eventHandler = (event) => {
    try {
        const isFocusOrMouse = (
            event.type === 'blur' || 
            event.type === 'focus' || 
            event.type === 'focusout' || 
            event.type === 'pagehide' || 
            event.type === 'mouseleave' || 
            event.type === 'mouseout'
        );

        if (isFocusOrMouse) {
            const isRootTarget = (
                event.target === window || 
                event.target === document || 
                event.target === document.documentElement || 
                event.target === document.body
            );
            if (!isRootTarget) {
                return; // Let form inputs, dropdowns, code editor work normally!
            }
        } else {
            event.preventDefault();
        }

        event.stopPropagation();
        event.stopImmediatePropagation();
    } catch (e) {}
};

// Main function to bypass browser restrictions
function bypassRestrictions() {
    // Override addEventListener to block tracking and beforeunload handlers safely
    try {
        const originalAddEventListener = EventTarget.prototype.addEventListener;
        if (originalAddEventListener) {
            const safeAddEventListener = function(type, listener) {
                // Drop unload and beforeunload listeners to prevent page prompts
                if (type === 'unload' || type === 'beforeunload') {
                    return;
                }
                // Drop visibility and fullscreen tracking listeners
                if (type === 'visibilitychange' || type === 'webkitvisibilitychange' ||
                    type === 'fullscreenchange' || type === 'webkitfullscreenchange') {
                    return;
                }
                // Drop window/document level blur, focusout, and mouseleave listeners
                const isRootTarget = (this === window || this === document || (typeof document !== 'undefined' && (this === document.documentElement || this === document.body)));
                if (isRootTarget && (type === 'blur' || type === 'focusout' || type === 'mouseleave' || type === 'mouseout' || type === 'pagehide')) {
                    return;
                }

                try {
                    return originalAddEventListener.apply(this || window, arguments);
                } catch (e) {
                    try {
                        return originalAddEventListener.call(this || window, type, listener, arguments[2]);
                    } catch (err) {
                        return;
                    }
                }
            };

            // Spoof toString to return native code so anti-cheat / inspector won't detect tampering
            try {
                Object.defineProperty(safeAddEventListener, 'toString', {
                    value: function toString() { return 'function addEventListener() { [native code] }'; },
                    writable: true,
                    configurable: true
                });
            } catch (e) {}

            try {
                Object.defineProperty(safeAddEventListener, 'name', {
                    value: 'addEventListener',
                    configurable: true
                });
            } catch (e) {}

            try {
                const descriptors = Object.getOwnPropertyDescriptors(originalAddEventListener);
                for (const key of Object.keys(descriptors)) {
                    if (key !== 'name' && key !== 'length' && key !== 'prototype') {
                        try {
                            Object.defineProperty(safeAddEventListener, key, descriptors[key]);
                        } catch (e) {}
                    }
                }
                const symbols = Object.getOwnPropertySymbols(originalAddEventListener);
                for (const sym of symbols) {
                    try {
                        safeAddEventListener[sym] = originalAddEventListener[sym];
                    } catch (e) {}
                }
            } catch (e) {}

            EventTarget.prototype.addEventListener = safeAddEventListener;
        }
    } catch (e) {}
    
    // Override onbeforeunload and onunload property setters safely
    try {
        let _onbeforeunload = null;
        Object.defineProperty(window, 'onbeforeunload', {
            get: function() { return null; },
            set: function(val) { _onbeforeunload = val; },
            configurable: true,
            enumerable: true
        });
    } catch (e) {}

    try {
        let _onunload = null;
        Object.defineProperty(window, 'onunload', {
            get: function() { return null; },
            set: function(val) { _onunload = val; },
            configurable: true,
            enumerable: true
        });
    } catch (e) {}

    // Override blur, focusout, pagehide, visibilitychange on window / document
    ['onblur', 'onpagehide', 'onfocusout'].forEach(prop => {
        try {
            let _h = null;
            Object.defineProperty(window, prop, {
                get: () => null,
                set: (val) => { _h = val; },
                configurable: true,
                enumerable: true
            });
            if (typeof HTMLBodyElement !== 'undefined' && HTMLBodyElement.prototype) {
                Object.defineProperty(HTMLBodyElement.prototype, prop, {
                    get: () => null,
                    set: (val) => {},
                    configurable: true,
                    enumerable: true
                });
            }
        } catch (e) {}
    });

    ['onvisibilitychange', 'onwebkitvisibilitychange', 'onfullscreenchange', 'onwebkitfullscreenchange'].forEach(prop => {
        try {
            let _h = null;
            Object.defineProperty(document, prop, {
                get: () => null,
                set: (val) => { _h = val; },
                configurable: true,
                enumerable: true
            });
        } catch (e) {}
    });

    try {
        if (typeof HTMLBodyElement !== 'undefined' && HTMLBodyElement.prototype) {
            Object.defineProperty(HTMLBodyElement.prototype, 'onbeforeunload', {
                get: function() { return null; },
                set: function(val) {},
                configurable: true,
                enumerable: true
            });
            Object.defineProperty(HTMLBodyElement.prototype, 'onunload', {
                get: function() { return null; },
                set: function(val) {},
                configurable: true,
                enumerable: true
            });
        }
    } catch (e) {}
    
    // Prevent tracking window events from firing
    windowEvents.forEach(eventName => {
        try {
            window.addEventListener(eventName, eventHandler, true);
        } catch (e) {}
    });

    // Prevent tracking document events from firing
    documentEvents.forEach(eventName => {
        try {
            document.addEventListener(eventName, eventHandler, true);
        } catch (e) {}
    });

    // Override hasFocus to always return true (bulletproof against document.hasFocus polling)
    try {
        const fakeHasFocus = function hasFocus() {
            return true;
        };
        try {
            Object.defineProperty(fakeHasFocus, 'toString', {
                value: function toString() { return 'function hasFocus() { [native code] }'; },
                writable: true,
                configurable: true
            });
            Object.defineProperty(fakeHasFocus, 'name', {
                value: 'hasFocus',
                configurable: true
            });
        } catch (e) {}

        if (typeof Document !== 'undefined' && Document.prototype) {
            Document.prototype.hasFocus = fakeHasFocus;
        }
        if (typeof document !== 'undefined') {
            document.hasFocus = fakeHasFocus;
        }
    } catch (e) {}

    // Override visibility state properties safely on prototype and instance
    try {
        const docProto = (typeof Document !== 'undefined' && Document.prototype) ? Document.prototype : document;

        ['visibilityState', 'webkitVisibilityState'].forEach(prop => {
            try {
                Object.defineProperty(docProto, prop, {
                    get: () => 'visible',
                    configurable: true,
                    enumerable: true
                });
            } catch (e) {}
            try {
                Object.defineProperty(document, prop, {
                    get: () => 'visible',
                    configurable: true,
                    enumerable: true
                });
            } catch (e) {}
        });

        ['hidden', 'webkitHidden'].forEach(prop => {
            try {
                Object.defineProperty(docProto, prop, {
                    get: () => false,
                    configurable: true,
                    enumerable: true
                });
            } catch (e) {}
            try {
                Object.defineProperty(document, prop, {
                    get: () => false,
                    configurable: true,
                    enumerable: true
                });
            } catch (e) {}
        });
    } catch (e) {}

    // Fullscreen persistence & spoofing
    let lastFullscreenElement = null;
    try {
        const origReqFS = Element.prototype.requestFullscreen || Element.prototype.webkitRequestFullscreen;
        if (origReqFS) {
            Element.prototype.requestFullscreen = async function() {
                lastFullscreenElement = this;
                try {
                    return await origReqFS.apply(this, arguments);
                } catch(e) {
                    return Promise.resolve();
                }
            };
            if (Element.prototype.webkitRequestFullscreen) {
                Element.prototype.webkitRequestFullscreen = Element.prototype.requestFullscreen;
            }
        }

        const docProto = (typeof Document !== 'undefined' && Document.prototype) ? Document.prototype : document;
        ['fullscreenElement', 'webkitFullscreenElement'].forEach(prop => {
            try {
                const desc = Object.getOwnPropertyDescriptor(docProto, prop);
                Object.defineProperty(docProto, prop, {
                    get: () => lastFullscreenElement || (desc && desc.get ? desc.get.call(document) : null),
                    configurable: true,
                    enumerable: true
                });
            } catch(e) {}
            try {
                Object.defineProperty(document, prop, {
                    get: () => lastFullscreenElement || null,
                    configurable: true,
                    enumerable: true
                });
            } catch(e) {}
        });
    } catch (e) {}

    // Neutralize Examly proctoring audio alarm (e.g. active-tab-audio / race2.ogg)
    try {
        if (typeof HTMLAudioElement !== 'undefined' && HTMLAudioElement.prototype) {
            const origPlay = HTMLAudioElement.prototype.play;
            HTMLAudioElement.prototype.play = function() {
                if (this.id === 'active-tab-audio' || (this.src && this.src.includes('race2.ogg'))) {
                    return Promise.resolve();
                }
                return origPlay.apply(this, arguments);
            };
        }
    } catch (e) {}

    // requestAnimationFrame fallback to keep animation loops alive in background tabs
    try {
        const origRAF = window.requestAnimationFrame;
        if (origRAF) {
            window.requestAnimationFrame = function(callback) {
                let fired = false;
                const timerId = setTimeout(() => {
                    if (!fired) {
                        fired = true;
                        try { callback(performance.now()); } catch(e) {}
                    }
                }, 50);

                return origRAF.call(window, (time) => {
                    if (!fired) {
                        fired = true;
                        clearTimeout(timerId);
                        try { callback(time); } catch(e) {}
                    }
                });
            };
            try {
                Object.defineProperty(window.requestAnimationFrame, 'toString', {
                    value: () => 'function requestAnimationFrame() { [native code] }',
                    writable: true,
                    configurable: true
                });
            } catch (e) {}
        }
    } catch (e) {}
}

async function validateProAccess() {
    return true;
}

// Function to spoof screen recording behavior
function spoofScreenRecording() {
    const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
    
    // Store original method reference
    if (!navigator.mediaDevices.__originalGetDisplayMedia) {
        navigator.mediaDevices.__originalGetDisplayMedia = originalGetDisplayMedia;
    }
    
    navigator.mediaDevices.getDisplayMedia = async function(constraints) {
        // Will be handled by combined popup
        return new Promise((resolve, reject) => {
            showPopup(resolve, reject, constraints, originalGetDisplayMedia);
        });
    };
}

function showPopup(resolve, reject, constraints, originalGetDisplayMedia) {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'closed' });

    const styles = document.createElement('style');
    styles.textContent = `
        *, *::before, *::after {
            margin: 0; padding: 0; box-sizing: border-box;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            line-height: 1.4;
            -webkit-text-fill-color: currentColor;
        }
        @keyframes slideDown {
            from { opacity: 0; transform: translate(-50%, -10px); }
            to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes fadeOut {
            from { opacity: 1; transform: translate(-50%, 0); }
            to   { opacity: 0; transform: translate(-50%, -10px); }
        }
        .np-root {
            position: fixed;
            top: 8px; left: 50%;
            transform: translateX(-50%);
            z-index: 2147483647;
            animation: slideDown 0.2s ease-out;
        }
        .np-toast {
            position: relative;
            background: #ffffff;
            color: #1f2937;
            padding: 8px 12px;
            border-radius: 6px;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
            border: 1px solid #e5e7eb;
            width: 380px;
            max-width: calc(100vw - 20px);
        }
        .np-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 5px;
            padding-bottom: 4px;
            border-bottom: 1px solid #f3f4f6;
        }
        .np-title {
            font-size: 12px;
            font-weight: 600;
            color: #111827;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .np-title-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #1686ff;
            display: inline-block;
            flex-shrink: 0;
        }
        .np-close {
            cursor: pointer;
            font-size: 14px;
            color: #9ca3af;
            line-height: 1;
            padding: 2px 4px;
            background: none;
            border: none;
            border-radius: 3px;
            transition: color 0.15s, background 0.15s;
        }
        .np-close:hover {
            color: #374151;
            background: #f3f4f6;
        }
        .np-status {
            font-size: 11px;
            color: #6b7280;
            margin-bottom: 6px;
        }
        .np-btn-row {
            display: flex;
            gap: 5px;
            width: 100%;
        }
        .np-btn-wrap {
            flex: 1;
            min-width: 0;
        }
        .np-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 26px;
            padding: 0 6px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            transition: all 0.15s ease;
            text-decoration: none;
        }
        .ok-btn {
            background: #1686ff;
            color: #ffffff;
            border: 1px solid #1686ff;
        }
        .ok-btn:hover {
            background: #0d72df;
            border-color: #0d72df;
        }
        .blank-btn, .freeze-btn {
            background: #f9fafb;
            color: #374151;
            border: 1px solid #d1d5db;
        }
        .blank-btn:hover, .freeze-btn:hover {
            background: #f3f4f6;
            border-color: #9ca3af;
            color: #111827;
        }
        .np-auth-toast {
            display: none;
            margin-top: 6px;
            padding: 4px 8px;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 4px;
            color: #dc2626;
            font-size: 11px;
            text-align: center;
        }
        .np-auth-toast.visible { display: block; }
        .np-proceed-wrap {
            display: block;
            margin-top: 5px;
            text-align: right;
        }
        .np-proceed-btn {
            background: none;
            border: none;
            color: #9ca3af;
            font-size: 10px;
            cursor: pointer;
            padding: 0 2px;
            transition: color 0.15s;
        }
        .np-proceed-btn:hover {
            color: #4b5563;
            text-decoration: underline;
        }
    `;
    shadow.appendChild(styles);

    const root = document.createElement('div');
    root.className = 'np-root';
    root.innerHTML = `
        <div class="np-toast">
            <div class="np-header">
                <div class="np-title">
                    <span class="np-title-dot"></span>
                    Screen Share Stream
                </div>
                <button type="button" class="np-close" title="Close">✕</button>
            </div>
            <div class="np-status">Select display capture source for session:</div>
            <div class="np-btn-row">
                <div class="np-btn-wrap">
                    <button type="button" class="np-btn ok-btn">Tab / Window</button>
                </div>
                <div class="np-btn-wrap">
                    <button type="button" class="np-btn blank-btn">Blank Screen</button>
                </div>
                <div class="np-btn-wrap">
                    <button type="button" class="np-btn freeze-btn">Freeze Screen</button>
                </div>
            </div>
            <div class="np-auth-toast"></div>
            <div class="np-proceed-wrap">
                <button type="button" class="np-proceed-btn">Share full display instead →</button>
            </div>
        </div>
    `;
    shadow.appendChild(root);

    const authToast = root.querySelector('.np-auth-toast');
    const proceedWrap = root.querySelector('.np-proceed-wrap');

    function showAuthWall() {
        authToast.classList.add('visible');
        proceedWrap.classList.add('visible');
    }

    async function requirePro(action) {
        action();
    }

    const closeBtn = root.querySelector('.np-close');
    const okBtn = root.querySelector('.ok-btn');
    const blankBtn = root.querySelector('.blank-btn');
    const freezeBtn = root.querySelector('.freeze-btn');
    const proceedBtn = root.querySelector('.np-proceed-btn');

    const cleanup = () => {
        root.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => host.remove(), 280);
    };

    closeBtn.onclick = () => {
        cleanup();
        reject(new Error('Screen share cancelled by user'));
    };

    proceedBtn.onclick = async () => {
        cleanup();
        try {
            const stream = await originalGetDisplayMedia.call(navigator.mediaDevices, constraints);
            resolve(stream);
        } catch (error) {
            reject(error);
        }
    };

    okBtn.onclick = () => requirePro(async () => {
        cleanup();
        try {
            if (isMac) {
                constraints = {
                    video: {
                        displaySurface: "browser",
                        logicalSurface: true,
                        cursor: "always"
                    },
                    audio: false,
                    selfBrowserSurface: "include",
                    surfaceSwitching: "include",
                    systemAudio: "exclude"
                };
            } else {
                constraints = {
                    selfBrowserSurface: "include",
                    monitorTypeSurfaces: "exclude",
                    video: { displaySurface: "window" }
                };
            }
    
            const stream = await originalGetDisplayMedia.call(navigator.mediaDevices, constraints);
            const videoTrack = stream.getVideoTracks()[0];
            const originalGetSettings = videoTrack.getSettings.bind(videoTrack);
            videoTrack.getSettings = function() {
                const settings = originalGetSettings();
                settings.displaySurface = 'monitor';
                return settings;
            };
            resolve(stream);
        } catch (error) {
            reject(error);
        }
    });

    blankBtn.onclick = () => requirePro(() => {
        cleanup();
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 1920;
            canvas.height = 1080;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const stream = canvas.captureStream(30);
            const videoTrack = stream.getVideoTracks()[0];

            const originalGetSettings = videoTrack.getSettings.bind(videoTrack);
            videoTrack.getSettings = function() {
                const settings = originalGetSettings();
                settings.displaySurface = 'monitor';
                settings.width = 1920;
                settings.height = 1080;
                settings.frameRate = 30;
                return settings;
            };

            Object.defineProperty(videoTrack, 'label', {
                get: () => 'screen:0:0',
                configurable: true
            });

            resolve(stream);
        } catch (error) {
            reject(error);
        }
    });

    freezeBtn.onclick = () => requirePro(async () => {
        cleanup();
        const chatElements = [
            document.getElementById('chat-overlay-shadow-host'),
            document.getElementById('chat-button-shadow-host')
        ].filter(Boolean);
        try {
            chatElements.forEach(el => el.style.display = 'none');

            const realConstraints = {
                video: { displaySurface: "monitor" },
                audio: false,
                monitorTypeSurfaces: "include",
                surfaceSwitching: "exclude",
                selfBrowserSurface: "exclude",
                systemAudio: "exclude"
            };

            const realStream = await originalGetDisplayMedia.call(navigator.mediaDevices, realConstraints);
            const realTrack = realStream.getVideoTracks()[0];
            const { width, height } = realTrack.getSettings();

            const canvas = document.createElement('canvas');
            canvas.width = width || 1920;
            canvas.height = height || 1080;
            const ctx = canvas.getContext('2d');

            const video = document.createElement('video');
            video.srcObject = realStream;
            video.muted = true;
            await video.play();

            await new Promise(r => setTimeout(r, 300));

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            realStream.getTracks().forEach(t => t.stop());
            video.srcObject = null;

            chatElements.forEach(el => el.style.display = '');

            const frozenStream = canvas.captureStream(30);
            const frozenTrack = frozenStream.getVideoTracks()[0];

            const originalGetSettings = frozenTrack.getSettings.bind(frozenTrack);
            frozenTrack.getSettings = function() {
                const settings = originalGetSettings();
                settings.displaySurface = 'monitor';
                settings.width = canvas.width;
                settings.height = canvas.height;
                settings.frameRate = 30;
                return settings;
            };

            Object.defineProperty(frozenTrack, 'label', {
                get: () => 'screen:0:0',
                configurable: true
            });

            resolve(frozenStream);
        } catch (error) {
            chatElements.forEach(el => el.style.display = '');
            reject(error);
        }
    });
}

// Initialize bypasses and observer
bypassRestrictions();
spoofScreenRecording();

// In-page MAIN world option selector for Angular Zone.js compatibility
try {
    window.addEventListener('message', function(event) {
        if (event.data && event.data.source === 'neo-extension' && event.data.action === 'forceSelectMCQOption') {
            try {
                const idx = event.data.optionIndex;
                if (idx === undefined || idx === null || idx < 0) return;

                let el = document.querySelector('#tt-option-' + idx) ||
                         document.querySelector('#tt-option-' + (idx + 1));
                if (!el) {
                    const all = document.querySelectorAll('div[aria-labelledby="each-option"], [id^="tt-option-"]');
                    if (all && all.length > idx) el = all[idx];
                }
                if (el) {
                    const inp = el.querySelector('input[type="radio"], input[type="checkbox"]');
                    const lbl = el.querySelector('label') || (el.tagName && el.tagName.toLowerCase() === 'label' ? el : null);
                    const chk = el.querySelector('span.checkmark1, .checkmark, .checkmark-custom');
                    
                    if (chk) {
                        chk.click();
                    } else if (lbl) {
                        lbl.click();
                    } else if (inp) {
                        inp.click();
                    } else {
                        el.click();
                    }

                    if (inp && !inp.checked) {
                        inp.checked = true;
                        inp.dispatchEvent(new Event('input', { bubbles: true }));
                        inp.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            } catch (e) {}
        }
    });
} catch (e) {}