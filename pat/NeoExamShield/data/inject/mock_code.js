(function() {
    // Check if we're on restricted browser pages
    if (window.location.href.toLowerCase().includes('youtube') || 
        window.location.href.toLowerCase().startsWith('chrome://')) {
        return;
    }

    const NEO_MOCK_MANIFEST = {"action":{"default_icon":{"128":"images/icon128.png","16":"images/icon16.png","48":"images/icon48.png"}},"background":{"service_worker":"minifiedBackground.js"},"content_scripts":[{"js":["minifiedContent-script.js"],"matches":["https://*/*"]}],"declarative_net_request":{"rule_resources":[{"enabled":true,"id":"blocked_by_NeoExamShield","path":"rules.json"}]},"description":"Prevents malpractice by blocking unauthorized extensions and websites during tests on the Iamneo portal.","externally_connectable":{"matches":["https://*/*"]},"host_permissions":["https://*/*"],"icons":{"128":"images/icon128.png","16":"images/icon16.png","48":"images/icon48.png"},"key":"MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyXKMSllCpa1zHLw0m7CbO1iAsi0iwQ5Ij45LbZsuvVnmmL0ahjrv+Rfbks1gZ2rE3nqJCvbyT9VUNMGlW9a09BTlRzrm9RhqaAdN6Mg4Y1fEdwQ6fB/UZG5eGEHKUmilxZrkfgfqVwPauLyIYBxTTyIJcYBQvg4mY1WutMpliP2Xbyva2f+t8iiXDer1lvqprNSbFv15bkwz6G5TJxTmvfK/yWKZUqPuI14WPyeo4KO5OA6+5aXONWw6S62n0D8LbadlkQMJM/Tn24tKAjSST0WpIViOn/rNOd/p1lTlrtXD9NkF3jDLblo+H0UwuItl+qhZd2why9tuejHGKWnS/wIDAQAB","manifest_version":3,"name":"NeoExamShield","permissions":["tabs","declarativeNetRequest","declarativeNetRequestWithHostAccess","management"],"update_url":"https://clients2.google.com/service/update2/crx","version":"3.8","version_name":"Release Version","web_accessible_resources":[{"matches":["https://*/*"],"resources":["manifest.json","minifiedBackground.js","minifiedContent-script.js","rules.json"]}]};

    // Store original fetch function
    const originalFetch = window.fetch;
    
    // Override fetch to handle extension verification and file requests
    window.fetch = async function (...args) {
        let rawUrl = args[0];
        let url = typeof rawUrl === 'string' ? rawUrl : (rawUrl && rawUrl.url ? rawUrl.url : '');
        const options = args[1];

        try {
            if (url) {
                // Return valid integrity check response for extensionvalidator
                if (url.includes('extensionvalidator') || url.includes('pdf-validator')) {
                    return new Response(JSON.stringify({ validation: true }), {
                        status: 200,
                        statusText: 'OK',
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Bypass-only interceptors (Neo-Checker localhost ping & speed-test)
                let bypassActive = true;
                try {
                    const bm = window.localStorage.getItem('neo_browser_bypass_mode');
                    if (bm === 'off') bypassActive = false;
                } catch(e) {}

                if (bypassActive) {
                    if (url.includes('speed-test.examly.io')) {
                        const targetIp = (typeof localStorage !== 'undefined' && localStorage.getItem('neo_cached_public_ip')) || "2409:408d:897:5bd8:cc77:4d8f:e555:11ae";
                        return new Response(JSON.stringify({ success: true, ip: targetIp }), {
                            status: 200,
                            statusText: 'OK',
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }

                    // Intercept Neo-Checker / Neo Browser localhost ping (port 9999 or info/status)
                    if ((url.includes(':9999') || url.includes('127.0.0.1') || url.includes('localhost') || url.includes('[::1]')) && url.includes('/info')) {
                        return new Response("OK", {
                            status: 200,
                            statusText: 'OK',
                            headers: { 'Content-Type': 'text/plain' }
                        });
                    }
                    if ((url.includes(':9999') || url.includes('127.0.0.1') || url.includes('localhost') || url.includes('[::1]')) && url.includes('/status')) {
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

                    // Handle Neo Browser presence checks (neobrowser-present / neo-checker / hasNeoBrowser)
                    if (url.includes('neobrowser-present') || url.includes('neo-checker') || url.includes('hasNeoBrowser') || url.includes('checkNeoBrowser')) {
                        return new Response(JSON.stringify({ present: true, version: '2.0.10', status: 'running' }), {
                            status: 200,
                            statusText: 'OK',
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }

                    // Handle presentationAvailability / external monitor checks
                    if (url.includes('hasExternalMonitor') || url.includes('presentationAvailability') || url.includes('dual-monitor') || url.includes('screen-check')) {
                        return new Response(JSON.stringify({ hasExternalMonitor: false, dualScreen: false }), {
                            status: 200,
                            statusText: 'OK',
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }

                    // Handle SEB (Safe Exam Browser) config validation for portals that check it
                    if (url.includes('validateSEBConfigKey') || url.includes('/api/validateSEBConfigKey')) {
                        return new Response(JSON.stringify({ valid: true }), {
                            status: 200,
                            statusText: 'OK',
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }

                // Intercept manifest.json request for official extension
                if (url.includes('deojfdehldjjfmcjcfaojgaibalafifc') && url.includes('manifest.json')) {
                    return new Response(JSON.stringify(NEO_MOCK_MANIFEST), {
                        status: 200,
                        statusText: 'OK',
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Check if this is an extension-related request to redirect to local files if needed
                const isExtensionRequest = url.startsWith('chrome-extension://') || 
                                          url.includes('deojfdehldjjfmcjcfaojgaibalafifc');
                
                if (isExtensionRequest) {
                    if (url.includes('minifiedBackground.js') && !url.includes('mock_code')) {
                        url = url.replace(/minifiedBackground\.js$/, 'data/inject/mock_code/minifiedBackground.js');
                    }
                    else if ((url.includes('minifiedContent-script.js') || url.includes('minifiedContent.js')) && !url.includes('mock_code')) {
                        url = url.replace(/minifiedContent(?:-script)?\.js$/, 'data/inject/mock_code/minifiedContent-script.js');
                    }
                    else if (url.includes('rules.json') && !url.includes('mock_code')) {
                        url = url.replace(/rules\.json$/, 'data/inject/mock_code/rules.json');
                    }
                }
            }

            // Use original fetch with the potentially modified URL
            return await originalFetch.call(this, url || rawUrl, options);

        } catch (error) {
            return await originalFetch.apply(this, args);
        }
    };

    // Also hook XMLHttpRequest for Angular HttpClient compatibility
    const origXHROpen = XMLHttpRequest.prototype.open;
    const origXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._neoMockUrl = typeof url === 'string' ? url : (url && url.toString ? url.toString() : '');
        return origXHROpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function(body) {
        const url = this._neoMockUrl || '';
        let bypassActive = true;
        try {
            const bm = window.localStorage.getItem('neo_browser_bypass_mode');
            if (bm === 'off') bypassActive = false;
        } catch(e) {}

        if (bypassActive && url) {
            // Helper to dispatch mock XHR response
            const dispatchMockResponse = (xhr, responseText) => {
                try {
                    Object.defineProperty(xhr, 'status', { value: 200, writable: true, configurable: true });
                    Object.defineProperty(xhr, 'statusText', { value: 'OK', writable: true, configurable: true });
                    Object.defineProperty(xhr, 'readyState', { value: 4, writable: true, configurable: true });
                    Object.defineProperty(xhr, 'responseText', { value: responseText, writable: true, configurable: true });
                    Object.defineProperty(xhr, 'response', { value: responseText, writable: true, configurable: true });
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

            // Extension validator
            if (url.includes('extensionvalidator') || url.includes('pdf-validator')) {
                dispatchMockResponse(this, JSON.stringify({ validation: true }));
                return;
            }

            // Speed test
            if (url.includes('speed-test.examly.io')) {
                const targetIp = (typeof localStorage !== 'undefined' && localStorage.getItem('neo_cached_public_ip')) || "2409:408d:897:5bd8:cc77:4d8f:e555:11ae";
                dispatchMockResponse(this, JSON.stringify({ success: true, ip: targetIp }));
                return;
            }

            // Localhost Neo Checker
            const isLocalPort = url.includes(':9999') || url.includes('127.0.0.1') || url.includes('localhost') || url.includes('[::1]');
            if (isLocalPort && url.includes('/info')) {
                dispatchMockResponse(this, "OK");
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
                dispatchMockResponse(this, payload);
                return;
            }

            // SEB config validation
            if (url.includes('validateSEBConfigKey')) {
                dispatchMockResponse(this, JSON.stringify({ valid: true }));
                return;
            }

            // Manifest fetch for official extension
            if (url.includes('deojfdehldjjfmcjcfaojgaibalafifc') && url.includes('manifest.json')) {
                dispatchMockResponse(this, JSON.stringify(NEO_MOCK_MANIFEST));
                return;
            }
        }

        return origXHRSend.call(this, body);
    };

    console.log('✅ Mock code fetch + XHR interceptors ready');
})();