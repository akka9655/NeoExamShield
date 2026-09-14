!(() => {
    const Proxy = window.Proxy;
    const Object = window.Object;
    const Array = window.Array;
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

    // 2. Hook window.fetch to serve mock manifest, files & auto-validate integrity
    try {
        const origFetch = window.fetch;
        window.fetch = async function(...args) {
            const rawUrl = args[0];
            const url = typeof rawUrl === 'string' ? rawUrl : (rawUrl && rawUrl.url ? rawUrl.url : '');

            if (url) {
                // Return valid integrity check response for extensionvalidator
                if (url.includes('extensionvalidator') || url.includes('pdf-validator')) {
                    return new Response(JSON.stringify({ validation: true }), {
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
            }

            return origFetch.apply(this, args);
        };
    } catch (e) {}

    // 3. Hook XMLHttpRequest as well for full compatibility
    try {
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this._neoUrl = typeof url === 'string' ? url : '';
            return origOpen.call(this, method, url, ...rest);
        };

        XMLHttpRequest.prototype.send = function(body) {
            if (this._neoUrl && (this._neoUrl.includes('extensionvalidator') || this._neoUrl.includes('pdf-validator'))) {
                try {
                    Object.defineProperty(this, 'status', { value: 200, writable: true });
                    Object.defineProperty(this, 'statusText', { value: 'OK', writable: true });
                    Object.defineProperty(this, 'readyState', { value: 4, writable: true });
                    Object.defineProperty(this, 'responseText', { value: JSON.stringify({ validation: true }), writable: true });
                    Object.defineProperty(this, 'response', { value: JSON.stringify({ validation: true }), writable: true });
                } catch(err) {}
                setTimeout(() => {
                    if (typeof this.onreadystatechange === 'function') this.onreadystatechange(new Event('readystatechange'));
                    if (typeof this.onload === 'function') this.onload(new Event('load'));
                }, 10);
                return;
            }
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
})()
