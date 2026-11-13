!(() => {
    // Save primordial object references at top of IIFE to avoid Temporal Dead Zone (TDZ)
    const Proxy = window.Proxy || globalThis.Proxy;
    const Object = window.Object || globalThis.Object;
    const Array = window.Array || globalThis.Array;

    // =========================================================================
    // NeoExamShield: Browser Identity Bypass Engine (Alt + J)
    // Disguises Brave / other browsers as Google Chrome or Neo Browser
    // =========================================================================
    function applyBrowserBypass(forcedMode) {
        try {
            let mode = forcedMode;
            if (!mode) {
                try {
                    mode = window.localStorage.getItem('neo_browser_bypass_mode');
                } catch (e) {
                    mode = null;
                }
            }

            // Default to 'off' (Native browser) - only activate when user turns on via Alt+J or HUD
            if (!mode) {
                mode = 'off';
                try {
                    window.localStorage.setItem('neo_browser_bypass_mode', 'off');
                } catch (e) {}
            }

            // Only proceed if user switched to 'chrome' or 'neobrowser'
            if (mode === 'off') {
                return;
            }

            // 1. Hide Brave completely
            try {
                try { delete Navigator.prototype.brave; } catch (e) {}
                try { delete navigator.brave; } catch (e) {}
                try {
                    Object.defineProperty(navigator, 'brave', {
                        get: () => undefined,
                        set: () => {},
                        configurable: true,
                        enumerable: false
                    });
                } catch(e) {}
                try {
                    Object.defineProperty(Navigator.prototype, 'brave', {
                        get: () => undefined,
                        set: () => {},
                        configurable: true,
                        enumerable: false
                    });
                } catch(e) {}
            } catch (e) {}

            // 2. Prepare target strings
            const isLinux = (navigator.platform || '').toLowerCase().includes('linux');
            const isMac = (navigator.platform || '').toLowerCase().includes('mac');
            const platformStr = isMac ? 'Macintosh; Intel Mac OS X 10_15_7' : (isLinux ? 'X11; Linux x86_64' : 'Windows NT 10.0; Win64; x64');
            const secPlatform = isMac ? 'macOS' : (isLinux ? 'Linux' : 'Windows');
            const targetOSVersion = isLinux ? "6.5.0" : (isMac ? "15.0.0" : "10.0.0");

            let targetUA = '';
            let targetAppVersion = '';
            let targetBrands = [];

            if (mode === 'neobrowser') {
                targetUA = `Mozilla/5.0 (${platformStr}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 neo-browser/2.0.10`;
                targetAppVersion = `5.0 (${platformStr}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 neo-browser/2.0.10`;
                targetBrands = [
                    { brand: "Neo Browser", version: "2" },
                    { brand: "Neo Browser", version: "2.0.10" },
                    { brand: "Google Chrome", version: "128" },
                    { brand: "Chromium", version: "128" },
                    { brand: "Not=A?Brand", version: "24" }
                ];
                window.neoCheckerPort = 9999;
            } else {
                // Pure Google Chrome Mode
                targetUA = `Mozilla/5.0 (${platformStr}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36`;
                targetAppVersion = `5.0 (${platformStr}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36`;
                targetBrands = [
                    { brand: "Google Chrome", version: "128" },
                    { brand: "Chromium", version: "128" },
                    { brand: "Not=A?Brand", version: "24" }
                ];
            }

            // 3. Spoof navigator.userAgent & navigator.appVersion on BOTH navigator and Navigator.prototype
            try { delete navigator.userAgent; } catch (e) {}
            try { delete navigator.appVersion; } catch (e) {}

            try {
                Object.defineProperty(navigator, 'userAgent', {
                    get: () => targetUA,
                    configurable: true,
                    enumerable: true
                });
            } catch (e) {}
            try {
                Object.defineProperty(navigator, 'appVersion', {
                    get: () => targetAppVersion,
                    configurable: true,
                    enumerable: true
                });
            } catch (e) {}

            try {
                Object.defineProperty(Navigator.prototype, 'userAgent', {
                    get: () => targetUA,
                    configurable: true,
                    enumerable: true
                });
            } catch (e) {}
            try {
                Object.defineProperty(Navigator.prototype, 'appVersion', {
                    get: () => targetAppVersion,
                    configurable: true,
                    enumerable: true
                });
            } catch (e) {}

            // 4. Spoof navigator.userAgentData on BOTH navigator and Navigator.prototype
            const fakeUaData = {
                brands: targetBrands,
                mobile: false,
                platform: secPlatform,
                getHighEntropyValues: async function(hints) {
                    return {
                        brands: targetBrands,
                        mobile: false,
                        platform: secPlatform,
                        platformVersion: targetOSVersion,
                        architecture: "x86",
                        bitness: "64",
                        model: "",
                        uaFullVersion: mode === 'chrome' ? "128.0.0.0" : "2.0.10",
                        fullVersionList: targetBrands
                    };
                },
                toJSON: function() {
                    return {
                        brands: targetBrands,
                        mobile: false,
                        platform: secPlatform
                    };
                }
            };

            try { delete navigator.userAgentData; } catch (e) {}

            try {
                Object.defineProperty(navigator, 'userAgentData', {
                    get: () => fakeUaData,
                    configurable: true,
                    enumerable: true
                });
            } catch (e) {}
            try {
                Object.defineProperty(Navigator.prototype, 'userAgentData', {
                    get: () => fakeUaData,
                    configurable: true,
                    enumerable: true
                });
            } catch (e) {}

            // 5. Ensure window.chrome is properly populated
            if (!window.chrome) {
                window.chrome = {};
            }
            if (!window.chrome.runtime) {
                window.chrome.runtime = {};
            }

            // 6. Ensure window.opr is not set
            try { delete window.opr; } catch (e) {}

            // 7. Hook testService and client_data on Object.prototype to ensure
            // "Collecting environment information" (Chunk 5120) always succeeds
            try {
                const targetBrowserName = (mode === 'chrome' ? 'Chrome' : 'Neo Browser');
                const targetBrowserMajor = (mode === 'chrome' ? '128' : '2');
                const targetBrowserVersion = (mode === 'chrome' ? '128.0.0.0' : '2.0.10');
                const targetPlatform = isLinux ? 'Linux' : (isMac ? 'MacOS' : 'Windows');
                const targetIp = (typeof localStorage !== 'undefined' && localStorage.getItem('neo_cached_public_ip')) || "2409:408d:897:5bd8:cc77:4d8f:e555:11ae";

                function createSafeBrowserObject() {
                    const bObj = {};
                    Object.defineProperty(bObj, 'name', {
                        get: () => targetBrowserName,
                        set: () => {},
                        configurable: true,
                        enumerable: true
                    });
                    Object.defineProperty(bObj, 'major', {
                        get: () => targetBrowserMajor,
                        set: () => {},
                        configurable: true,
                        enumerable: true
                    });
                    Object.defineProperty(bObj, 'version', {
                        get: () => targetBrowserVersion,
                        set: () => {},
                        configurable: true,
                        enumerable: true
                    });
                    return bObj;
                }

                function createSafeOSObject() {
                    const oObj = {};
                    Object.defineProperty(oObj, 'name', {
                        get: () => targetPlatform,
                        set: () => {},
                        configurable: true,
                        enumerable: true
                    });
                    Object.defineProperty(oObj, 'version', {
                        get: () => targetOSVersion,
                        set: () => {},
                        configurable: true,
                        enumerable: true
                    });
                    return oObj;
                }

                function sanitizeClientData(cd) {
                    if (!cd || typeof cd !== 'object') return;
                    try {
                        let _browser = createSafeBrowserObject();
                        let _os = createSafeOSObject();
                        let _ip = targetIp;

                        Object.defineProperty(cd, 'browser', {
                            get: () => _browser,
                            set: (newB) => {
                                if (newB && typeof newB === 'object') {
                                    if (newB.name === 'Brave' || !newB.name) {
                                        newB.name = targetBrowserName;
                                    }
                                    _browser = newB;
                                }
                            },
                            configurable: true,
                            enumerable: true
                        });

                        Object.defineProperty(cd, 'OS', {
                            get: () => _os,
                            set: (newOS) => {
                                if (newOS && typeof newOS === 'object') {
                                    if (!newOS.name || newOS.name === 'Unknown OS') {
                                        newOS.name = targetPlatform;
                                    }
                                    _os = newOS;
                                }
                            },
                            configurable: true,
                            enumerable: true
                        });

                        Object.defineProperty(cd, 'Public_IP', {
                            get: () => _ip,
                            set: (newIp) => {
                                if (newIp) _ip = newIp;
                            },
                            configurable: true,
                            enumerable: true
                        });
                    } catch(e) {}
                }

                function hookTestServiceInstance(svc) {
                    if (!svc || typeof svc !== 'object') return;
                    if (svc._neoGetBasicDataHooked) return;
                    svc._neoGetBasicDataHooked = true;

                    const origGetBasicData = svc.getBasicData;
                    svc.getBasicData = function(...args) {
                        return new Promise((resolve) => {
                            try {
                                if (!this.testData) this.testData = {};
                                if (!this.testData.client_data) {
                                    this.testData.client_data = {
                                        OS: { name: targetPlatform, version: targetOSVersion },
                                        browser: { name: targetBrowserName, major: targetBrowserMajor, version: targetBrowserVersion },
                                        Public_IP: targetIp,
                                        answer_s3_link: "",
                                        pdfName: ""
                                    };
                                }
                                sanitizeClientData(this.testData.client_data);
                            } catch (e) {}

                            let promiseChain;
                            if (typeof origGetBasicData === 'function') {
                                try {
                                    promiseChain = origGetBasicData.apply(this, args);
                                } catch (e) {
                                    promiseChain = Promise.resolve(true);
                                }
                            } else {
                                promiseChain = Promise.resolve(true);
                            }

                            Promise.resolve(promiseChain).then(() => {
                                try {
                                    if (!this.testData) this.testData = {};
                                    if (!this.testData.client_data) this.testData.client_data = {};
                                    sanitizeClientData(this.testData.client_data);
                                } catch (e) {}
                                resolve(true);
                            }).catch(() => {
                                try {
                                    if (!this.testData) this.testData = {};
                                    if (!this.testData.client_data) this.testData.client_data = {};
                                    sanitizeClientData(this.testData.client_data);
                                } catch (e) {}
                                resolve(true);
                            });
                        });
                    };
                }

                // Object.prototype.testService hook for Angular components
                try {
                    Object.defineProperty(Object.prototype, 'testService', {
                        configurable: true,
                        enumerable: false,
                        get() {
                            return this.__neoTestServiceInstance;
                        },
                        set(val) {
                            this.__neoTestServiceInstance = val;
                            hookTestServiceInstance(val);
                        }
                    });
                } catch (e) {}
            } catch (e) {}

            // 8. Spoof navigator.plugins (Brave returns empty, Chrome has PDF plugins)
            try {
                const fakePluginData = [
                    { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                    { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: '' },
                    { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: '' },
                    { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: '' },
                    { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: '' }
                ];
                const fakeMimeType = { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' };
                
                const fakePlugins = {
                    length: fakePluginData.length,
                    item: function(i) { return fakePluginData[i] || null; },
                    namedItem: function(name) { return fakePluginData.find(p => p.name === name) || null; },
                    refresh: function() {},
                    [Symbol.iterator]: function*() { for (const p of fakePluginData) yield p; }
                };
                for (let i = 0; i < fakePluginData.length; i++) {
                    fakePlugins[i] = fakePluginData[i];
                }

                Object.defineProperty(navigator, 'plugins', {
                    get: () => fakePlugins,
                    configurable: true,
                    enumerable: true
                });
                Object.defineProperty(Navigator.prototype, 'plugins', {
                    get: () => fakePlugins,
                    configurable: true,
                    enumerable: true
                });

                const fakeMimeTypes = {
                    length: 1,
                    item: function(i) { return i === 0 ? fakeMimeType : null; },
                    namedItem: function(name) { return name === 'application/pdf' ? fakeMimeType : null; },
                    [Symbol.iterator]: function*() { yield fakeMimeType; }
                };
                fakeMimeTypes[0] = fakeMimeType;

                Object.defineProperty(navigator, 'mimeTypes', {
                    get: () => fakeMimeTypes,
                    configurable: true,
                    enumerable: true
                });
                Object.defineProperty(Navigator.prototype, 'mimeTypes', {
                    get: () => fakeMimeTypes,
                    configurable: true,
                    enumerable: true
                });
            } catch (e) {}

            // 9. Spoof window.chrome.app, chrome.csi, chrome.loadTimes (Chrome-specific APIs Brave may lack)
            try {
                if (!window.chrome) window.chrome = {};
                
                if (!window.chrome.app) {
                    window.chrome.app = {
                        isInstalled: false,
                        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
                        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
                        getDetails: function() { return null; },
                        getIsInstalled: function() { return false; },
                        installState: function(callback) { if (callback) callback('not_installed'); }
                    };
                }

                if (!window.chrome.csi) {
                    window.chrome.csi = function() {
                        return { pageT: Date.now(), startE: Date.now(), onloadT: 0, tran: 15 };
                    };
                }

                if (!window.chrome.loadTimes) {
                    window.chrome.loadTimes = function() {
                        return {
                            commitLoadTime: Date.now() / 1000,
                            connectionInfo: 'h2',
                            finishDocumentLoadTime: Date.now() / 1000,
                            finishLoadTime: Date.now() / 1000,
                            firstPaintAfterLoadTime: 0,
                            firstPaintTime: Date.now() / 1000,
                            navigationType: 'Other',
                            npnNegotiatedProtocol: 'h2',
                            requestTime: Date.now() / 1000,
                            startLoadTime: Date.now() / 1000,
                            wasAlternateProtocolAvailable: false,
                            wasFetchedViaSpdy: true,
                            wasNpnNegotiated: true
                        };
                    };
                }
            } catch (e) {}

            // 10. Spoof navigator.webdriver (should always be false in normal browser)
            try {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => false,
                    configurable: true,
                    enumerable: true
                });
                Object.defineProperty(Navigator.prototype, 'webdriver', {
                    get: () => false,
                    configurable: true,
                    enumerable: true
                });
            } catch (e) {}

            // 11. Hide dual screen / external display detection
            try {
                if (window.screen) {
                    Object.defineProperty(window.screen, 'isExtended', {
                        get: () => false,
                        configurable: true,
                        enumerable: true
                    });
                }
            } catch (e) {}

            // 12. Neutralize Presentation API external display detection
            try {
                if (navigator.presentation) {
                    Object.defineProperty(navigator.presentation, 'defaultRequest', {
                        get: () => null,
                        set: () => {},
                        configurable: true
                    });
                }
                // Override PresentationAvailability to never report displays
                if (typeof PresentationRequest !== 'undefined') {
                    PresentationRequest.prototype.getAvailability = function() {
                        return Promise.resolve({ value: false, onchange: null });
                    };
                }
            } catch (e) {}

            // 13. Prevent window.Brave and window.brave constructor detection
            try {
                Object.defineProperty(window, 'Brave', {
                    get: () => undefined,
                    set: () => {},
                    configurable: true,
                    enumerable: false
                });
            } catch (e) {}

            // 14. Spoof navigator.connection for exam portal speed checks
            try {
                if (navigator.connection) {
                    Object.defineProperty(navigator.connection, 'effectiveType', {
                        get: () => '4g',
                        configurable: true
                    });
                    Object.defineProperty(navigator.connection, 'downlink', {
                        get: () => 10,
                        configurable: true
                    });
                    Object.defineProperty(navigator.connection, 'rtt', {
                        get: () => 50,
                        configurable: true
                    });
                }
            } catch (e) {}

            // 15. Spoof navigator.pdfViewerEnabled (Chrome returns true, Brave may not)
            try {
                Object.defineProperty(navigator, 'pdfViewerEnabled', {
                    get: () => true,
                    configurable: true,
                    enumerable: true
                });
                Object.defineProperty(Navigator.prototype, 'pdfViewerEnabled', {
                    get: () => true,
                    configurable: true,
                    enumerable: true
                });
            } catch (e) {}

            console.log(`🛡️ [NeoExamShield] Browser Identity Bypass active: ${mode}`);
        } catch (err) {
            console.error('🛡️ [NeoExamShield] Error applying browser bypass:', err);
        }
    }

    // Apply bypass immediately on execution
    applyBrowserBypass();

    // Listen for live bypass mode changes
    window.addEventListener('neoBrowserBypassChange', (ev) => {
        if (ev && ev.detail && ev.detail.mode) {
            applyBrowserBypass(ev.detail.mode);
        }
    });

    /**
     * Save original methods before we override them
     */
    const Originals = {
        createElement: document.createElement,
        log: console.log,
        table: console.table,
        clear: console.clear,
        functionConstructor: window.Function.prototype.constructor,
        setInterval: window.setInterval,
        createElement: document.createElement,
        toString: Function.prototype.toString,
        addEventListener: window.addEventListener
    }

    /**
     * Cutoffs for logging. After cutoff is reached, will no longer log anti debug warnings.
     */
    const cutoffs = {
        table: {
            amount: 5,
            within: 5000
        },
        clear: {
            amount: 5,
            within: 5000
        },
        redactedLog: {
            amount: 5,
            within: 5000
        },
        debugger: {
            amount: 10,
            within: 10000
        },
        debuggerThrow: {
            amount: 10,
            within: 10000
        }
    }

    /**
     * Decides if anti debug warnings should be logged
     */
    function shouldLog(type) {

            return false;
    }

    window.console.log = wrapFn((...args) => {
        // Keep track of redacted arguments
        let redactedCount = 0;

        // Filter arguments for detectors
        const newArgs = args.map((a) => {

            // Don't print functions.
            if (typeof a === 'function') {
                redactedCount++;
                return "Redacted Function";
            }

            // Passthrough if primitive
            if (typeof a !== 'object' || a === null) return a;

            // For objects, scan properties
            var props = Object.getOwnPropertyDescriptors(a)
            for (var name in props) {

                // Redact custom getters
                if (props[name].get !== undefined) {
                    redactedCount++;
                    return "Redacted Getter";
                }

                // Also block toString overrides
                if (name === 'toString') {
                    redactedCount++;
                    return "Redacted Str";
                }
            }

            // Defeat Performance Detector
            // https://github.com/theajack/disable-devtool/blob/master/src/detector/sub-detector/performance.ts
            if (Array.isArray(a) && a.length === 50 && typeof a[0] === "object") {
                redactedCount++;
                return "Redacted LargeObjArray";
            }

            return a;
        });

        // If most arguments are redacted, its probably spam
        if (redactedCount >= Math.max(args.length - 1, 1)) {
            if (!shouldLog("redactedLog")) {
                return;
            }
        }

    }, Originals.log);

    window.console.table = wrapFn((obj) => {
        if (shouldLog("table")) {
        }
    }, Originals.table);

    window.console.clear = wrapFn(() => {
        if (shouldLog("table")) {
        }
    }, Originals.clear);

    let debugCount = 0;
    window.Function.prototype.constructor = wrapFn((...args) => {
        const originalFn = Originals.functionConstructor.apply(this, args);
        var fnContent = args[0];
        if (fnContent) {
            if (fnContent.includes('debugger')) { // An anti-debugger is attempting to stop debugging
                if (shouldLog("debugger")) {
                }
                debugCount++;
                if (debugCount > 100) {
                    if (shouldLog("debuggerThrow")) {
                    }
                    throw new Error("You bad!");
                } else {
                    setTimeout(() => {
                        debugCount--;
                    }, 1);
                }
                const newArgs = args.slice(0);
                newArgs[0] = args[0].replaceAll("debugger", ""); // remove debugger statements
                return new Proxy(Originals.functionConstructor.apply(this, newArgs),{
                    get: function (target, prop) {
                        if (prop === "toString") {
                            return originalFn.toString;
                        }
                        return target[prop];
                    }
                });
            }
        }
        return originalFn;
    }, Originals.functionConstructor);

    document.createElement = wrapFn((el, o) => {
        var string = el.toString();
        var element = Originals.createElement.apply(document, [string, o]);
        if (string.toLowerCase() === "iframe") {
            element.addEventListener("load", () => {
                try {
                    element.contentWindow.window.console = window.console;
                } catch (e) {

                }
            });
        }
        return element;
    }, Originals.createElement);

    function wrapFn(newFn, old) {
        return new Proxy(newFn, {
            get: function (target, prop) {
                const callMethods = ['apply', 'bind', 'call'];
                if (callMethods.includes(prop)) {
                    return target[prop];
                }
                return old[prop];
            }
        });
    }

    // =========================================================================
    // NeoExamShield Official Extension Emulator & Portal Validation Bypass
    // =========================================================================
    const NEO_EXTENSION_ID = "deojfdehldjjfmcjcfaojgaibalafifc";

    const NEO_MOCK_EXTENSION_INFO = {
        description: "Prevents malpractice by identifying and blocking third-party browser extensions during tests on the Iamneo portal.",
        enabled: true,
        homepageUrl: "https://chromewebstore.google.com/detail/deojfdehldjjfmcjcfaojgaibalafifc",
        hostPermissions: ["https://*/*"],
        icons: [
            { size: 16, url: "chrome://extension-icon/deojfdehldjjfmcjcfaojgaibalafifc/16/0" },
            { size: 48, url: "chrome://extension-icon/deojfdehldjjfmcjcfaojgaibalafifc/48/0" },
            { size: 128, url: "chrome://extension-icon/deojfdehldjjfmcjcfaojgaibalafifc/128/0" }
        ],
        id: NEO_EXTENSION_ID,
        installType: "normal",
        isApp: false,
        mayDisable: true,
        name: "NeoExamShield",
        offlineEnabled: false,
        optionsUrl: "",
        permissions: [
            "declarativeNetRequest",
            "declarativeNetRequestWithHostAccess",
            "management",
            "tabs"
        ],
        shortName: "NeoExamShield",
        type: "extension",
        updateUrl: "https://clients2.google.com/service/update2/crx",
        version: "3.8",
        versionName: "Release Version"
    };

    const NEO_MOCK_MANIFEST = {"action":{"default_icon":{"128":"images/icon128.png","16":"images/icon16.png","48":"images/icon48.png"}},"background":{"service_worker":"minifiedBackground.js"},"content_scripts":[{"js":["minifiedContent-script.js"],"matches":["https://*/*"]}],"declarative_net_request":{"rule_resources":[{"enabled":true,"id":"blocked_by_NeoExamShield","path":"rules.json"}]},"description":"Prevents malpractice by blocking unauthorized extensions and websites during tests on the Iamneo portal.","externally_connectable":{"matches":["https://*/*"]},"host_permissions":["https://*/*"],"icons":{"128":"images/icon128.png","16":"images/icon16.png","48":"images/icon48.png"},"key":"MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyXKMSllCpa1zHLw0m7CbO1iAsi0iwQ5Ij45LbZsuvVnmmL0ahjrv+Rfbks1gZ2rE3nqJCvbyT9VUNMGlW9a09BTlRzrm9RhqaAdN6Mg4Y1fEdwQ6fB/UZG5eGEHKUmilxZrkfgfqVwPauLyIYBxTTyIJcYBQvg4mY1WutMpliP2Xbyva2f+t8iiXDer1lvqprNSbFv15bkwz6G5TJxTmvfK/yWKZUqPuI14WPyeo4KO5OA6+5aXONWw6S62n0D8LbadlkQMJM/Tn24tKAjSST0WpIViOn/rNOd/p1lTlrtXD9NkF3jDLblo+H0UwuItl+qhZd2why9tuejHGKWnS/wIDAQAB","manifest_version":3,"name":"NeoExamShield","permissions":["tabs","declarativeNetRequest","declarativeNetRequestWithHostAccess","management"],"update_url":"https://clients2.google.com/service/update2/crx","version":"3.8","version_name":"Release Version","web_accessible_resources":[{"matches":["https://*/*"],"resources":["manifest.json","minifiedBackground.js","minifiedContent-script.js","rules.json"]}]};

    // 1. Hook window.chrome.runtime.sendMessage for 0ms direct in-page response
    try {
        if (typeof window.chrome === 'undefined') {
            window.chrome = {};
        }
        if (!window.chrome.runtime) {
            window.chrome.runtime = {};
        }

        const origSendMessage = window.chrome.runtime.sendMessage;

        window.chrome.runtime.sendMessage = function(...args) {
            let targetId = null;
            let message = null;
            let callback = null;

            if (typeof args[0] === 'string') {
                targetId = args[0];
                message = args[1];
                if (typeof args[2] === 'function') callback = args[2];
                else if (typeof args[3] === 'function') callback = args[3];
            } else {
                message = args[0];
                if (typeof args[1] === 'function') callback = args[1];
            }

            if (targetId === NEO_EXTENSION_ID || (!targetId && message && message.type === "EXECUTE_API")) {
                const instr = message?.instruction || {};
                let result = { code: "Success", info: {} };

                if (instr.target === 'management') {
                    if (instr.operation === 'getAll') {
                        result = { code: "Success", info: [NEO_MOCK_EXTENSION_INFO] };
                    } else if (instr.operation === 'get' || instr.operation === 'getSelf') {
                        result = { code: "Success", info: NEO_MOCK_EXTENSION_INFO };
                    }
                } else if (instr.target === 'tabs') {
                    if (instr.operation === 'create') {
                        try {
                            const tabUrl = (instr.args && instr.args[0] && instr.args[0].url) || 'chrome://extensions/';
                            window.open(tabUrl, '_blank');
                        } catch(e) {}
                        result = { code: "Success", info: { id: 1 } };
                    }
                } else if (instr.target === 'runtime') {
                    if (instr.operation === 'getManifest') {
                        result = { code: "Success", info: NEO_MOCK_MANIFEST };
                    } else {
                        result = { code: "Success", info: { id: NEO_EXTENSION_ID } };
                    }
                }

                if (typeof callback === 'function') {
                    try { callback(result); } catch(e) {}
                    return;
                }
                return Promise.resolve(result);
            }

            if (typeof origSendMessage === 'function') {
                return origSendMessage.apply(window.chrome.runtime, args);
            }
        };
    } catch (e) {}

    // Network telemetry scrubbing helper (neutralizes tab-switch & proctoring counts)
    function scrubViolationPayload(body) {
        if (typeof body !== 'string') return body;
        try {
            let scrubbed = body;
            scrubbed = scrubbed.replace(/"tabswitched"\s*:\s*\d+/g, '"tabswitched": 0');
            scrubbed = scrubbed.replace(/"copyPasted"\s*:\s*\d+/g, '"copyPasted": 0');
            scrubbed = scrubbed.replace(/"offScreen"\s*:\s*\d+/g, '"offScreen": 0');
            scrubbed = scrubbed.replace(/\\"tabswitched\\"\s*:\s*\d+/g, '\\"tabswitched\\": 0');
            scrubbed = scrubbed.replace(/\\"copyPasted\\"\s*:\s*\d+/g, '\\"copyPasted\\": 0');
            scrubbed = scrubbed.replace(/\\"offScreen\\"\s*:\s*\d+/g, '\\"offScreen\\": 0');
            scrubbed = scrubbed.replace(/"tabswitched"\s*:\s*\{\s*"integerValue"\s*:\s*"[^"]+"\s*\}/g, '"tabswitched":{"integerValue":"0"}');
            scrubbed = scrubbed.replace(/"copyPasted"\s*:\s*\{\s*"integerValue"\s*:\s*"[^"]+"\s*\}/g, '"copyPasted":{"integerValue":"0"}');
            scrubbed = scrubbed.replace(/"offScreen"\s*:\s*\{\s*"integerValue"\s*:\s*"[^"]+"\s*\}/g, '"offScreen":{"integerValue":"0"}');
            scrubbed = scrubbed.replace(/"hasExternalMonitor"\s*:\s*\{\s*"integerValue"\s*:\s*"[^"]+"\s*\}/g, '"hasExternalMonitor":{"integerValue":"0"}');
            // URL-encoded patterns used in Firestore write stream channels and submit payloads
            scrubbed = scrubbed.replace(/%22tabswitched%22%3A%7B%22integerValue%22%3A%22\d+%22%7D/g, '%22tabswitched%22%3A%7B%22integerValue%22%3A%220%22%7D');
            scrubbed = scrubbed.replace(/%22copyPasted%22%3A%7B%22integerValue%22%3A%22\d+%22%7D/g, '%22copyPasted%22%3A%7B%22integerValue%22%3A%220%22%7D');
            scrubbed = scrubbed.replace(/%22offScreen%22%3A%7B%22integerValue%22%3A%22\d+%22%7D/g, '%22offScreen%22%3A%7B%22integerValue%22%3A%220%22%7D');
            scrubbed = scrubbed.replace(/%22hasExternalMonitor%22%3A%7B%22integerValue%22%3A%22\d+%22%7D/g, '%22hasExternalMonitor%22%3A%7B%22integerValue%22%3A%220%22%7D');
            scrubbed = scrubbed.replace(/%22tabswitched%22%3A\d+/g, '%22tabswitched%22%3A0');
            scrubbed = scrubbed.replace(/%22copyPasted%22%3A\d+/g, '%22copyPasted%22%3A0');
            scrubbed = scrubbed.replace(/%22offScreen%22%3A\d+/g, '%22offScreen%22%3A0');
            return scrubbed;
        } catch (e) {
            return body;
        }
    }

    // 2. Hook window.fetch to serve mock manifest, files, speed-test & auto-validate integrity
    try {
        const origFetch = window.fetch;
        window.fetch = async function(...args) {
            const rawUrl = args[0];
            const init = args[1];
            const url = typeof rawUrl === 'string' ? rawUrl : (rawUrl && rawUrl.url ? rawUrl.url : '');

            try {
                if (url) {
                    let bypassActive = true;
                    try {
                        const bm = window.localStorage.getItem('neo_browser_bypass_mode');
                        if (bm === 'off') bypassActive = false;
                    } catch(e) {}

                    // Bypass-only intercepts
                    if (bypassActive) {
                        // speed-test.examly.io instant 200 OK
                        if (url.includes('speed-test.examly.io')) {
                            const targetIp = (typeof localStorage !== 'undefined' && localStorage.getItem('neo_cached_public_ip')) || "2409:408d:897:5bd8:cc77:4d8f:e555:11ae";
                            return new Response(JSON.stringify({ success: true, ip: targetIp }), {
                                status: 200,
                                statusText: 'OK',
                                headers: { 'Content-Type': 'application/json' }
                            });
                        }

                        // Localhost port 9999 /info and /status
                        const isLocalPort = url.includes(':9999') || url.includes('127.0.0.1') || url.includes('localhost') || url.includes('[::1]');
                        if (isLocalPort && url.includes('/info')) {
                            return new Response("OK", {
                                status: 200,
                                statusText: 'OK',
                                headers: { 'Content-Type': 'text/plain' }
                            });
                        }
                        if (isLocalPort && url.includes('/status')) {
                            const isLinux = (navigator.platform || '').toLowerCase().includes('linux');
                            const isMac = (navigator.platform || '').toLowerCase().includes('mac');
                            const hash = isMac 
                                ? "c3ca0fa8e426a37046e6c1804ab6870f6187ed5c7ca986bf0f01a7fe0a4825f3"
                                : (isLinux 
                                    ? "1465e4220443af218a923bd5bf80af6349ccef2cabdc4964484b5e6350a58c79"
                                    : "d79e14a743710b354c614575930131ad52e3649d42e6a442e09a881ba2052e62");
                            const payload = btoa(JSON.stringify({
                                status: true,
                                hash: hash,
                                remote_desktop: false,
                                active_processes: [],
                                dual_screen: false
                            }));
                            return new Response(payload, {
                                status: 200,
                                statusText: 'OK',
                                headers: { 'Content-Type': 'text/plain' }
                            });
                        }
                    }

                    // Ensure client_data is always valid in test verification requests (fetch)
                    if (init && typeof init.body === 'string' && (url.includes('checkTestAllreadyTake') || url.includes('checktestSessionsSame') || url.includes('mM5YsmcTM6Msoj5r') || url.includes('CheckTestisHideOrNot'))) {
                        try {
                            const parsed = JSON.parse(init.body);
                            if (!parsed.client_data || typeof parsed.client_data !== 'object' || Object.keys(parsed.client_data).length === 0) {
                                const isLinux = (navigator.platform || '').toLowerCase().includes('linux');
                                const isMac = (navigator.platform || '').toLowerCase().includes('mac');
                                const targetPlatform = isLinux ? 'Linux' : (isMac ? 'MacOS' : 'Windows');
                                const targetOSVersion = isLinux ? "6.5.0" : (isMac ? "15.0.0" : "10.0.0");
                                const targetIp = (typeof localStorage !== 'undefined' && localStorage.getItem('neo_cached_public_ip')) || "2409:408d:897:5bd8:cc77:4d8f:e555:11ae";
                                
                                let curMode = 'off';
                                try { curMode = localStorage.getItem('neo_browser_bypass_mode') || 'off'; } catch(e) {}
                                if (curMode !== 'off') {
                                    const curBName = curMode === 'neobrowser' ? 'Neo Browser' : 'Chrome';
                                    const curBMajor = curMode === 'neobrowser' ? '2' : '128';
                                    const curBVer = curMode === 'neobrowser' ? '2.0.10' : '128.0.0.0';
                                    parsed.client_data = parsed.client_data || {};
                                    parsed.client_data.browser = { name: curBName, major: curBMajor, version: curBVer };
                                    parsed.client_data.OS = { name: targetPlatform, version: targetOSVersion };
                                    parsed.client_data.Public_IP = targetIp;
                                }
                                init.body = JSON.stringify(parsed);
                            }
                        } catch(e) {}
                    }

                    // Return valid integrity check response for extensionvalidator
                    if (url.includes('extensionvalidator') || url.includes('pdf-validator')) {
                        return new Response(JSON.stringify({ validation: true }), {
                            status: 200,
                            statusText: 'OK',
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }

                    // Return valid SEB config validation for FacePrep
                    if (url.includes('validateSEBConfigKey') || url.includes('/api/validateSEBConfigKey')) {
                        return new Response(JSON.stringify({ valid: true }), {
                            status: 200,
                            statusText: 'OK',
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }

                    // Return official manifest for extension manifest queries
                    if (url.includes(NEO_EXTENSION_ID) && url.includes('manifest.json')) {
                        return new Response(JSON.stringify(NEO_MOCK_MANIFEST), {
                            status: 200,
                            statusText: 'OK',
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }

                    // Clarity drop
                    if (url.includes('.clarity.ms/')) {
                        return new Response('', { status: 204, statusText: 'No Content' });
                    }

                    // Tab switch drop
                    if (url.includes('/api/question/all/event')) {
                        const bStr = typeof init?.body === 'string' ? init.body : '';
                        if (bStr.includes('"tab-switch-done"') || bStr.includes('tab-switch-done')) {
                            return new Response(JSON.stringify({ success: true, message: "OK" }), {
                                status: 200,
                                headers: { 'Content-Type': 'application/json' }
                            });
                        }
                    }

                    // Telemetry scrub
                    if (init && typeof init.body === 'string' && (url.includes('examly.io') || url.includes('firestore.googleapis.com'))) {
                        init.body = scrubViolationPayload(init.body);
                    }
                }
            } catch(e) {}

            return origFetch.apply(this, args);
        };
    } catch (e) {}

    // 3. Hook XMLHttpRequest as well for full Angular HttpClient & portal compatibility
    try {
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this._neoUrl = typeof url === 'string' ? url : (url && url.toString ? url.toString() : '');
            return origOpen.call(this, method, url, ...rest);
        };

        XMLHttpRequest.prototype.send = function(body) {
            try {
                const url = this._neoUrl || '';
                let bypassActive = true;
                try {
                    const bm = window.localStorage.getItem('neo_browser_bypass_mode');
                    if (bm === 'off') bypassActive = false;
                } catch(e) {}

                // Dispatch helper ensuring both property callbacks and event listeners fire
                const dispatchSuccess = (xhr, respText) => {
                    try {
                        Object.defineProperty(xhr, 'status', { value: 200, writable: true, configurable: true });
                        Object.defineProperty(xhr, 'statusText', { value: 'OK', writable: true, configurable: true });
                        Object.defineProperty(xhr, 'readyState', { value: 4, writable: true, configurable: true });
                        Object.defineProperty(xhr, 'responseText', { value: respText, writable: true, configurable: true });
                        Object.defineProperty(xhr, 'response', { value: respText, writable: true, configurable: true });
                    } catch(e) {}
                    setTimeout(() => {
                        try {
                            if (typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange(new Event('readystatechange'));
                            xhr.dispatchEvent(new Event('readystatechange'));
                            if (typeof xhr.onload === 'function') xhr.onload(new Event('load'));
                            xhr.dispatchEvent(new Event('load'));
                            if (typeof xhr.onloadend === 'function') xhr.onloadend(new Event('loadend'));
                            xhr.dispatchEvent(new Event('loadend'));
                        } catch(e) {}
                    }, 5);
                };

                // Bypass-only intercepts
                if (bypassActive && url) {
                    if (url.includes('speed-test.examly.io')) {
                        const targetIp = (typeof localStorage !== 'undefined' && localStorage.getItem('neo_cached_public_ip')) || "2409:408d:897:5bd8:cc77:4d8f:e555:11ae";
                        dispatchSuccess(this, JSON.stringify({ success: true, ip: targetIp }));
                        return;
                    }

                    const isLocalPort = url.includes(':9999') || url.includes('127.0.0.1') || url.includes('localhost') || url.includes('[::1]');
                    if (isLocalPort && url.includes('/info')) {
                        dispatchSuccess(this, "OK");
                        return;
                    }
                    if (isLocalPort && url.includes('/status')) {
                        const isLinux = (navigator.platform || '').toLowerCase().includes('linux');
                        const isMac = (navigator.platform || '').toLowerCase().includes('mac');
                        const hash = isMac 
                            ? "c3ca0fa8e426a37046e6c1804ab6870f6187ed5c7ca986bf0f01a7fe0a4825f3"
                            : (isLinux 
                                ? "1465e4220443af218a923bd5bf80af6349ccef2cabdc4964484b5e6350a58c79"
                                : "d79e14a743710b354c614575930131ad52e3649d42e6a442e09a881ba2052e62");
                        const payload = btoa(JSON.stringify({
                            status: true,
                            hash: hash,
                            remote_desktop: false,
                            active_processes: [],
                            dual_screen: false
                        }));
                        dispatchSuccess(this, payload);
                        return;
                    }
                }

                // Ensure client_data is always valid in test verification requests
                if (typeof body === 'string' && (url.includes('checkTestAllreadyTake') || url.includes('checktestSessionsSame') || url.includes('mM5YsmcTM6Msoj5r') || url.includes('CheckTestisHideOrNot'))) {
                    try {
                        const parsed = JSON.parse(body);
                        if (!parsed.client_data || typeof parsed.client_data !== 'object' || Object.keys(parsed.client_data).length === 0) {
                            const isLinux = (navigator.platform || '').toLowerCase().includes('linux');
                            const isMac = (navigator.platform || '').toLowerCase().includes('mac');
                            const targetPlatform = isLinux ? 'Linux' : (isMac ? 'MacOS' : 'Windows');
                            const targetOSVersion = isLinux ? "6.5.0" : (isMac ? "15.0.0" : "10.0.0");
                            const targetIp = (typeof localStorage !== 'undefined' && localStorage.getItem('neo_cached_public_ip')) || "2409:408d:897:5bd8:cc77:4d8f:e555:11ae";
                            
                            let curMode = 'off';
                            try { curMode = localStorage.getItem('neo_browser_bypass_mode') || 'off'; } catch(e) {}
                            if (curMode !== 'off') {
                                const curBName = curMode === 'neobrowser' ? 'Neo Browser' : 'Chrome';
                                const curBMajor = curMode === 'neobrowser' ? '2' : '128';
                                const curBVer = curMode === 'neobrowser' ? '2.0.10' : '128.0.0.0';
                                parsed.client_data = parsed.client_data || {};
                                parsed.client_data.browser = { name: curBName, major: curBMajor, version: curBVer };
                                parsed.client_data.OS = { name: targetPlatform, version: targetOSVersion };
                                parsed.client_data.Public_IP = targetIp;
                            }
                            body = JSON.stringify(parsed);
                        }
                    } catch(e) {}
                }

                // Extension & PDF validator integrity
                if (url && (url.includes('extensionvalidator') || url.includes('pdf-validator'))) {
                    dispatchSuccess(this, JSON.stringify({ validation: true }));
                    return;
                }

                // Clarity tracking drop
                if (url && url.includes('.clarity.ms/')) {
                    try {
                        Object.defineProperty(this, 'status', { value: 204, writable: true, configurable: true });
                        Object.defineProperty(this, 'readyState', { value: 4, writable: true, configurable: true });
                    } catch(e) {}
                    setTimeout(() => {
                        try {
                            if (typeof this.onload === 'function') this.onload(new Event('load'));
                            this.dispatchEvent(new Event('load'));
                            if (typeof this.onloadend === 'function') this.onloadend(new Event('loadend'));
                            this.dispatchEvent(new Event('loadend'));
                        } catch(e) {}
                    }, 5);
                    return;
                }

                // Tab switch event drop
                if (url && url.includes('/api/question/all/event') && typeof body === 'string' && body.includes('tab-switch-done')) {
                    dispatchSuccess(this, '{"success":true}');
                    return;
                }

                // Scrub proctoring violation payloads
                if (typeof body === 'string' && (url.includes('examly.io') || url.includes('firestore.googleapis.com'))) {
                    body = scrubViolationPayload(body);
                }

                // Cache real public IP if present in response
                this.addEventListener('load', () => {
                    try {
                        if (this.responseText && this.responseText.includes('"ip"')) {
                            const parsed = JSON.parse(this.responseText);
                            if (parsed && parsed.ip && typeof localStorage !== 'undefined') {
                                localStorage.setItem('neo_cached_public_ip', parsed.ip.toString().trim());
                            }
                        }
                    } catch(e) {}
                });
            } catch(e) {}

            return origSend.call(this, body);
        };
    } catch (e) {}

    // 4. Handle template base tag creation and window messages for portal extensionService
    try {
        window.addEventListener('message', function(event) {
            if (!event.data) return;
            if (event.data.currentKey) {
                const key = event.data.currentKey;
                try {
                    const oldTags = document.querySelectorAll("[id^='x-template-base-']");
                    oldTags.forEach(el => el.remove());
                    const span = document.createElement('span');
                    span.id = 'x-template-base-' + key;
                    span.style.display = 'none';
                    (document.body || document.documentElement).appendChild(span);
                    window.postMessage(0, '*');
                } catch(err) {}
            }
        });
    } catch (e) {}

    // 5. FacePrep Portal Support: Safe Exam Browser spoofing & Tab-switch protection
    try {
        if (window.location.hostname.includes('faceprep.in')) {
            // Spoof SEB in userAgent so detectSEB() passes in standard Chrome
            try {
                const originalUA = navigator.userAgent;
                if (!/SEB|SecureExamBrowser/i.test(originalUA)) {
                    const sebUA = originalUA + ' SEB/3.8.0 (Windows NT 10.0; Win64; x64)';
                    Object.defineProperty(navigator, 'userAgent', {
                        get: () => sebUA,
                        configurable: true
                    });
                    Object.defineProperty(navigator, 'appVersion', {
                        get: () => sebUA,
                        configurable: true
                    });
                }
            } catch (e) {}

            // Prevent FacePrep tab switch tracking (Firebase RTDB tab_switch_count)
            try {
                Object.defineProperty(document, 'visibilityState', {
                    get: () => 'visible',
                    configurable: true
                });
                Object.defineProperty(document, 'hidden', {
                    get: () => false,
                    configurable: true
                });
            } catch (e) {}

            // Hook addEventListener to prevent visibilitychange event triggers
            try {
                const origDocAEL = document.addEventListener;
                document.addEventListener = function(type, listener, options) {
                    if (type === 'visibilitychange') {
                        const wrappedListener = function(e) {
                            if (document.visibilityState === 'hidden') return;
                            return typeof listener === 'function' ? listener.call(this, e) : listener?.handleEvent?.(e);
                        };
                        return origDocAEL.call(this, type, wrappedListener, options);
                    }
                    return origDocAEL.call(this, type, listener, options);
                };
            } catch (e) {}
        }
    } catch (e) {}

    // 6. Stealth DOM Shield: Completely cloak extension elements from portal scanners
    try {
        const isStealthTarget = (node) => {
            if (!node || node.nodeType !== 1) return false;
            try {
                const id = node.id || '';
                if (id.includes('chat-overlay') || id.includes('chat-button') || 
                    id.includes('neoexamshield') || id.includes('neo-mcq-dot')) {
                    return true;
                }
                if (node.hasAttribute && (node.hasAttribute('data-neo-stealth') || node.hasAttribute('data-neo-dot'))) {
                    return true;
                }
            } catch (e) {}
            return false;
        };

        const isStealthQuery = (query) => {
            if (typeof query !== 'string') return false;
            const q = query.toLowerCase();
            return q.includes('chat-overlay') || q.includes('chat-button') || 
                   q.includes('neoexamshield') || q.includes('neo-mcq-dot') ||
                   q.includes('data-neo-stealth');
        };

        // Hook document.getElementById
        const origGetId = document.getElementById;
        document.getElementById = function(id) {
            if (isStealthQuery(id)) return null;
            const el = origGetId.call(this, id);
            return isStealthTarget(el) ? null : el;
        };

        // Hook querySelector / querySelectorAll on Document and Element
        const origDocQS = Document.prototype.querySelector;
        const origDocQSA = Document.prototype.querySelectorAll;
        const origElemQS = Element.prototype.querySelector;
        const origElemQSA = Element.prototype.querySelectorAll;

        Document.prototype.querySelector = function(selector) {
            if (isStealthQuery(selector)) return null;
            const el = origDocQS.call(this, selector);
            if (isStealthTarget(el)) {
                const all = origDocQSA.call(this, selector);
                for (let i = 0; i < all.length; i++) {
                    if (!isStealthTarget(all[i])) return all[i];
                }
                return null;
            }
            return el;
        };

        Element.prototype.querySelector = function(selector) {
            if (isStealthQuery(selector)) return null;
            const el = origElemQS.call(this, selector);
            if (isStealthTarget(el)) {
                const all = origElemQSA.call(this, selector);
                for (let i = 0; i < all.length; i++) {
                    if (!isStealthTarget(all[i])) return all[i];
                }
                return null;
            }
            return el;
        };

        Document.prototype.querySelectorAll = function(selector) {
            const list = origDocQSA.call(this, selector);
            if (isStealthQuery(selector)) return document.createDocumentFragment().childNodes;
            const filtered = Array.from(list).filter(el => !isStealthTarget(el));
            return filtered.length === list.length ? list : filtered;
        };

        Element.prototype.querySelectorAll = function(selector) {
            const list = origElemQSA.call(this, selector);
            if (isStealthQuery(selector)) return document.createDocumentFragment().childNodes;
            const filtered = Array.from(list).filter(el => !isStealthTarget(el));
            return filtered.length === list.length ? list : filtered;
        };

        // Hook getElementsByTagName
        const origDocGEBTN = Document.prototype.getElementsByTagName;
        Document.prototype.getElementsByTagName = function(tag) {
            const list = origDocGEBTN.call(this, tag);
            const filtered = Array.from(list).filter(el => !isStealthTarget(el));
            return filtered.length === list.length ? list : filtered;
        };

        // Hook getElementsByClassName
        const origDocGEBCN = Document.prototype.getElementsByClassName;
        Document.prototype.getElementsByClassName = function(className) {
            const list = origDocGEBCN.call(this, className);
            const filtered = Array.from(list).filter(el => !isStealthTarget(el));
            return filtered.length === list.length ? list : filtered;
        };

        // Hook children on document.body and document.documentElement
        const childrenDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'children');
        if (childrenDesc && childrenDesc.get) {
            const origChildrenGet = childrenDesc.get;
            Object.defineProperty(Element.prototype, 'children', {
                get: function() {
                    const list = origChildrenGet.call(this);
                    if (this === document.body || this === document.documentElement) {
                        const filtered = Array.from(list).filter(el => !isStealthTarget(el));
                        return filtered.length === list.length ? list : filtered;
                    }
                    return list;
                },
                configurable: true,
                enumerable: true
            });
        }
        // ==========================================
        // PROCTORING & VISIBILITY HARDENING (MAIN WORLD)
        // ==========================================
        try {
            // Lock visibilityState & hidden properties to prevent tab-switch / blur detections
            const forceVisible = () => 'visible';
            const forceNotHidden = () => false;

            Object.defineProperty(Document.prototype, 'visibilityState', {
                get: forceVisible,
                configurable: true,
                enumerable: true
            });
            Object.defineProperty(Document.prototype, 'webkitVisibilityState', {
                get: forceVisible,
                configurable: true,
                enumerable: true
            });
            Object.defineProperty(Document.prototype, 'hidden', {
                get: forceNotHidden,
                configurable: true,
                enumerable: true
            });
            Object.defineProperty(Document.prototype, 'webkitHidden', {
                get: forceNotHidden,
                configurable: true,
                enumerable: true
            });

            // Prevent focus detection from reporting false
            if (Document.prototype.hasFocus) {
                Document.prototype.hasFocus = new Proxy(Document.prototype.hasFocus, {
                    apply: () => true
                });
            }

            // Suppress blur, visibilitychange, and pointer triggers on window and document
            const blockedEventTypes = ['visibilitychange', 'webkitvisibilitychange', 'lostpointercapture'];
            blockedEventTypes.forEach(evtName => {
                window.addEventListener(evtName, (e) => {
                    e.stopImmediatePropagation();
                    e.stopPropagation();
                }, true);
                document.addEventListener(evtName, (e) => {
                    e.stopImmediatePropagation();
                    e.stopPropagation();
                }, true);
            });

            // Suppress window blur events so student can switch windows or use HUD safely
            window.addEventListener('blur', (e) => {
                if (e.target === window || e.target === document) {
                    e.stopImmediatePropagation();
                    e.stopPropagation();
                }
            }, true);

            // Suppress onblur, onvisibilitychange direct properties
            ['onblur', 'onvisibilitychange'].forEach(prop => {
                try {
                    Object.defineProperty(window, prop, {
                        get: () => null,
                        set: () => {},
                        configurable: true
                    });
                } catch(e) {}
            });
            try {
                Object.defineProperty(document, 'onvisibilitychange', {
                    get: () => null,
                    set: () => {},
                    configurable: true
                });
            } catch(e) {}

            // Robust isTrusted spoofing on synthetic user interaction events
            try {
                const origIsTrustedDesc = Object.getOwnPropertyDescriptor(Event.prototype, 'isTrusted');
                if (origIsTrustedDesc && origIsTrustedDesc.get) {
                    const origGet = origIsTrustedDesc.get;
                    Object.defineProperty(Event.prototype, 'isTrusted', {
                        get: function() {
                            try {
                                if (!this) return true;
                                if (this.__neoTrusted === true) return true;
                                const target = this.target;
                                if (target && target.nodeType === 1) {
                                    if (target.closest && target.closest('[id*="option"], [aria-labelledby*="option"], [data-slot*="radio"], label, input, button, .ql-editor, .ace_editor, .cm-content, p, span, div')) {
                                        return true;
                                    }
                                }
                                return origGet.call(this);
                            } catch (e) {
                                return true;
                            }
                        },
                        configurable: true,
                        enumerable: true
                    });
                }
            } catch (e) {}

            // Neutralize anti-cheat siren / warning audio (race2.ogg / active-tab-audio)
            try {
                const origPlay = HTMLMediaElement.prototype.play;
                HTMLMediaElement.prototype.play = function() {
                    try {
                        const src = (this.src || this.currentSrc || '').toLowerCase();
                        if (src.includes('race2.ogg') || src.includes('audio/') || this.id === 'active-tab-audio') {
                            this.muted = true;
                            this.volume = 0;
                            return Promise.resolve();
                        }
                    } catch(e) {}
                    return origPlay.apply(this, arguments);
                };
            } catch (e) {}

            // Clarity telemetry neutered stub
            try {
                const dummyClarity = function() {};
                dummyClarity.q = [];
                dummyClarity.v = '0.8.72-beta';
                dummyClarity.t = true;
                dummyClarity.start = function() {};
                dummyClarity.stop = function() {};
                dummyClarity.event = function() {};
                dummyClarity.set = function() {};
                dummyClarity.identify = function() {};
                dummyClarity.metadata = function() {};
                dummyClarity.upgrade = function() {};
                window.clarity = dummyClarity;
            } catch(e) {}

            // Hook navigator.sendBeacon
            if (navigator && navigator.sendBeacon) {
                const origBeacon = navigator.sendBeacon;
                navigator.sendBeacon = function(url, data) {
                    try {
                        const u = typeof url === 'string' ? url : '';
                        if (u.includes('.clarity.ms/')) {
                            return true;
                        }
                        if (typeof data === 'string' && (u.includes('examly.io') || u.includes('firestore.googleapis.com'))) {
                            data = scrubViolationPayload(data);
                        }
                    } catch(e) {}
                    return origBeacon.call(this, url, data);
                };
            }
        } catch (e) {}
    } catch (e) {}
})()
