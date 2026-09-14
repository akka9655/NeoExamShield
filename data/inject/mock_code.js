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

    console.log('✅ Mock code fetch interceptor ready');
})();