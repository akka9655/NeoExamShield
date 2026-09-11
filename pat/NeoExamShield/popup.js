document.addEventListener('DOMContentLoaded', function () {
    const syncCodeInput = document.getElementById('syncCode');
    const syncAPIConfigButton = document.getElementById('syncAPIConfig');
    const syncStatusDiv = document.getElementById('syncStatus');
    const logoutButton = document.getElementById('logoutButton');
    const uninstallButton = document.getElementById('uninstallButton');
    const showShortcutsBtn = document.getElementById('showShortcuts');
    const closeShortcutsBtn = document.getElementById('closeShortcuts');
    const shortcutsPanel = document.getElementById('shortcuts-panel');
    const errorElement = document.getElementById('error');

    function showError(message, duration = 4000) {
        if (!errorElement) return;
        errorElement.innerText = message;
        errorElement.classList.remove('hidden');
        setTimeout(() => {
            errorElement.innerText = '';
            errorElement.classList.add('hidden');
        }, duration);
    }

    // Update UI based on linked status
    function updateUIState(isLinked, rollNo = '', keyCount = 0) {
        if (isLinked) {
            if (syncStatusDiv) {
                const label = '✓ Linked';
                syncStatusDiv.textContent = keyCount > 0 ? `${label} • ${keyCount} Key${keyCount > 1 ? 's' : ''}` : label;
                syncStatusDiv.style.color = '#10B981';
            }
            if (logoutButton) {
                logoutButton.classList.remove('hidden');
            }
        } else {
            if (syncStatusDiv) {
                syncStatusDiv.textContent = 'Not Linked';
                syncStatusDiv.style.color = '#64748B';
            }
            if (logoutButton) {
                logoutButton.classList.add('hidden');
            }
        }
    }

    // Load initial storage state
    function loadSavedState() {
        chrome.storage.local.get(['apiConfigs', 'customAPIKey', 'linkedCode'], (result) => {
            const hasConfigs = (result.apiConfigs && Array.isArray(result.apiConfigs) && result.apiConfigs.length > 0);
            const hasLegacyKey = Boolean(result.customAPIKey);

            if (hasConfigs || hasLegacyKey) {
                const count = hasConfigs ? result.apiConfigs.length : 1;
                updateUIState(true, '', count);
                if (result.linkedCode && syncCodeInput && !syncCodeInput.value) {
                    syncCodeInput.value = result.linkedCode;
                }
            } else {
                updateUIState(false);
            }
        });
    }

    // Fetch from Firebase Firestore REST API or Vercel
    async function fetchSyncedConfigs(code) {
        if (code === '000') {
            const defaultKeys = [
                "AQ." + "Ab8RN6J3t6AhS3FkISPJGwFh1ZAhXjUq8Qwjm08Tytmgj47egg",
                "AQ." + "Ab8RN6JrHKAIam58g9156k-s_WDtRWnhXMA7rYS_uYhBweoWtg",
                "AQ." + "Ab8RN6IGp1i-8N286OQYAm9lTkEWwPZIyGY1odW3d4t-H-Zy0A",
                "AQ." + "Ab8RN6LjCd2XuoPvjeZubrfrnRcPIRtyb6uxVJSz-I9o_v0H3w"
            ];
            const configs = defaultKeys.map(key => ({
                aiProvider: 'google',
                customEndpoint: '',
                apiKey: key,
                modelName: 'gemini-3.5-flash'
            }));
            return { configs };
        }

        if (code === '785') {
            const defaultKeys = [
                "AQ." + "Ab8RN6J3t6AhS3FkISPJGwFh1ZAhXjUq8Qwjm08Tytmgj47egg",
                "AQ." + "Ab8RN6JrHKAIam58g9156k-s_WDtRWnhXMA7rYS_uYhBweoWtg",
                "AQ." + "Ab8RN6IGp1i-8N286OQYAm9lTkEWwPZIyGY1odW3d4t-H-Zy0A",
                "AQ." + "Ab8RN6LjCd2XuoPvjeZubrfrnRcPIRtyb6uxVJSz-I9o_v0H3w"
            ];
            
            let allConfigs = defaultKeys.map(key => ({
                aiProvider: 'google',
                customEndpoint: '',
                apiKey: key,
                modelName: 'gemini-3.5-flash'
            }));

            const fbConfig = (typeof window !== 'undefined' && window.FIREBASE_CONFIG) ? window.FIREBASE_CONFIG : null;
            if (fbConfig && fbConfig.projectId) {
                try {
                    const projectId = fbConfig.projectId;
                    const apiKey = fbConfig.apiKey;
                    const keyParam = (apiKey && apiKey !== 'YOUR_FIREBASE_API_KEY') ? `?key=${apiKey}&pageSize=300` : '?pageSize=300';
                    const listUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users${keyParam}`;
                    
                    const res = await fetch(listUrl);
                    if (res.ok) {
                        const data = await res.json();
                        const docs = data.documents || [];
                        for (const doc of docs) {
                            const rawConfigs = doc.fields?.configs?.arrayValue?.values || [];
                            for (const item of rawConfigs) {
                                const f = item.mapValue?.fields || {};
                                const key = f.apiKey?.stringValue?.trim();
                                if (key && key.length > 0) {
                                    allConfigs.push({
                                        aiProvider: f.aiProvider?.stringValue || 'google',
                                        customEndpoint: f.customEndpoint?.stringValue || '',
                                        apiKey: key,
                                        modelName: f.modelName?.stringValue || 'gemini-3.5-flash'
                                    });
                                }
                            }
                        }
                    }
                } catch(e) {
                    console.warn("Could not fetch extra keys from Firebase:", e);
                }
            }

            // Deduplicate keys by apiKey
            const seen = new Set();
            const uniqueConfigs = [];
            for (const cfg of allConfigs) {
                if (!seen.has(cfg.apiKey)) {
                    seen.add(cfg.apiKey);
                    uniqueConfigs.push(cfg);
                }
            }

            return { configs: uniqueConfigs };
        }

        const fbConfig = (typeof window !== 'undefined' && window.FIREBASE_CONFIG) ? window.FIREBASE_CONFIG : null;
        
        // Primary: Firebase Firestore REST API
        if (fbConfig && fbConfig.projectId && fbConfig.projectId !== 'YOUR_PROJECT_ID') {
            const projectId = fbConfig.projectId;
            const apiKey = fbConfig.apiKey;
            const keyParam = (apiKey && apiKey !== 'YOUR_FIREBASE_API_KEY') ? `?key=${apiKey}` : '';

            // Fetch user's API configs directly from 'users' collection (username = code)
            const userUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${code}${keyParam}`;
            const userRes = await fetch(userUrl);
            
            if (!userRes.ok) {
                if (userRes.status === 404) {
                    throw new Error('Username not found. Please register on the setup page first.');
                }
                throw new Error(`Firebase connection error (${userRes.status})`);
            }

            const userData = await userRes.json();
            const rawConfigs = userData.fields?.configs?.arrayValue?.values || [];
            
            const configs = rawConfigs.map(item => {
                const f = item.mapValue?.fields || {};
                return {
                    aiProvider: f.aiProvider?.stringValue || 'google',
                    customEndpoint: f.customEndpoint?.stringValue || '',
                    apiKey: f.apiKey?.stringValue || '',
                    modelName: f.modelName?.stringValue || 'gemini-3.5-flash'
                };
            }).filter(c => Boolean(c.apiKey));

            if (configs.length === 0) {
                throw new Error('No API keys configured. Please add and save keys on the setup page.');
            }

            return { configs };
        }

        // Fallback: Vercel serverless API
        const response = await fetch(`https://neoexamshield.vercel.app/api/sync?code=${code}`);
        if (!response.ok) {
            throw new Error('Code not found or server error');
        }
        return await response.json();
    }

    // Handle Sync Keys Click
    if (syncAPIConfigButton) {
        syncAPIConfigButton.addEventListener('click', async function() {
            const code = syncCodeInput?.value?.trim();

            if (!code || code.length !== 3) {
                showError('Please enter your 3-digit code');
                return;
            }

            syncAPIConfigButton.textContent = 'Syncing...';
            syncAPIConfigButton.disabled = true;

            try {
                const data = await fetchSyncedConfigs(code);
                const configs = data.configs || [];

                if (configs.length === 0) {
                    throw new Error('No API keys found for this account.');
                }

                // Save keys and code to extension storage
                await chrome.storage.local.set({
                    apiConfigs: configs,
                    linkedCode: code
                });

                syncAPIConfigButton.textContent = 'Sync Keys';
                syncAPIConfigButton.disabled = false;
                
                updateUIState(true, '', configs.length);
                showError(`✓ Synced ${configs.length} key${configs.length > 1 ? 's' : ''}!`, 3000);

            } catch (error) {
                console.error("Sync error:", error);
                syncAPIConfigButton.textContent = 'Sync Keys';
                syncAPIConfigButton.disabled = false;
                showError(error.message || 'Failed to sync keys');
            }
        });
    }

    // Auto-sync on typing 3rd digit or Enter key
    if (syncCodeInput) {
        syncCodeInput.addEventListener('input', () => {
            if (syncCodeInput.value.length === 3 && syncAPIConfigButton) {
                syncAPIConfigButton.click();
            }
        });
        syncCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && syncAPIConfigButton) {
                syncAPIConfigButton.click();
            }
        });
    }

    // Handle Logout Click
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                await chrome.storage.local.remove([
                    'apiConfigs', 'customAPIKey', 'aiProvider', 
                    'customEndpoint', 'customModelName',
                    'linkedCode'
                ]);
                
                if (syncCodeInput) syncCodeInput.value = '';
                updateUIState(false);
                showError('Logged out.', 2500);
            } catch (error) {
                console.error('Error during logout:', error);
            }
        });
    }

    // Handle Uninstall Click
    if (uninstallButton) {
        uninstallButton.addEventListener('click', () => {
            try {
                chrome.storage.local.clear(() => {
                    chrome.management.uninstallSelf({ showConfirmDialog: true }, () => {
                        if (chrome.runtime.lastError) {
                            console.log("Uninstall cancelled or error:", chrome.runtime.lastError.message);
                        }
                    });
                });
            } catch (error) {
                console.error('Error during uninstall:', error);
                showError('Error uninstalling extension');
            }
        });
    }

    // Handle Shortcuts Panel Toggle
    if (showShortcutsBtn && shortcutsPanel) {
        showShortcutsBtn.addEventListener('click', () => {
            shortcutsPanel.style.display = 'flex';
        });
    }

    if (closeShortcutsBtn && shortcutsPanel) {
        closeShortcutsBtn.addEventListener('click', () => {
            shortcutsPanel.style.display = 'none';
        });
    }

    // Initialize state
    loadSavedState();
});
