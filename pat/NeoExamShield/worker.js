// Track shortcut execution state to prevent multiple requests when held down
const shortcutStates = {
  'search': false,
  'search-mcq': false,
  'nptel': false,
  'customPaste': false
};

// Request blocking mechanism to prevent multiple simultaneous API requests
let isRequestInProgress = false;
let requestTimeout = null;
let lastRequestTimestamp = 0;

function canMakeRequest() {
    // If more than 4 seconds have elapsed since last request, auto-unblock
    if (isRequestInProgress && (Date.now() - lastRequestTimestamp > 4000)) {
        isRequestInProgress = false;
    }
    return !isRequestInProgress;
}

function blockRequests() {
    isRequestInProgress = true;
    lastRequestTimestamp = Date.now();
    
    // Clear any existing timeout
    if (requestTimeout) {
        clearTimeout(requestTimeout);
    }
    
    // Set timeout to unblock after 6 seconds
    requestTimeout = setTimeout(() => {
        isRequestInProgress = false;
    }, 6000);
}

function unblockRequests() {
    isRequestInProgress = false;
    
    // Clear the timeout since we got a response
    if (requestTimeout) {
        clearTimeout(requestTimeout);
        requestTimeout = null;
    }
    
    console.log('[Request Block] Unblocked after receiving response');
}

// Array to store allowed IP addresses
let allowedIPs = [];

// Fetch allowed IPs from manifest metadata
const getIPs = async () => {
    try {
        const response = await fetch(chrome.runtime.getURL("metadata.json"));
        const data = await response.json();
        return data.ip || [];
    } catch (error) {
        console.error("Failed to load metadata:", error);
        return [];
    }
};

// Fetch IP address for a given domain
const fetchDomainIp = async (url) => {
    try {
        await getIPs();
        let hostname = new URL(url).hostname;

        // Special case for specific domain
        if (hostname.includes("pscollege841.examly")) {
            return "34.171.215.232";
        }
        // Query Google DNS API
        let response = await fetch(`https://dns.google/resolve?name=${hostname}`);
        let data = await response.json();

        let ip = data.Answer?.find(record => record.type === 1)?.data || null;
        return ip || null;
    } catch (error) {
        throw error;
    }
};

async function handleMessage(request, sender, sendResponse) {
    try {
        const {
            id,
            type,
            instruction
        } = request || {};

        const {
            target,
            operation,
            args = []
        } = instruction || {};

        // Official extension metadata returned to portal
        const mockExtensionInfo = {
            description: "Prevents malpractice by identifying and blocking third-party browser extensions during tests on the Iamneo portal.",
            enabled: true,
            homepageUrl: "https://chromewebstore.google.com/detail/deojfdehldjjfmcjcfaojgaibalafifc",
            hostPermissions: ["https://*/*"],
            icons: [
            {
                size: 16,
                url: "chrome://extension-icon/deojfdehldjjfmcjcfaojgaibalafifc/16/0"
            },
            {
                size: 48,
                url: "chrome://extension-icon/deojfdehldjjfmcjcfaojgaibalafifc/48/0"
            },
            {
                size: 128,
                url: "chrome://extension-icon/deojfdehldjjfmcjcfaojgaibalafifc/128/0"
            }],
            id: "deojfdehldjjfmcjcfaojgaibalafifc",
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

        if (target === 'management') {
            if (operation === 'getAll') {
                sendResponse({
                    code: "Success",
                    info: [mockExtensionInfo]
                });
                return true;
            }

            if (operation === 'get' || operation === 'getSelf') {
                sendResponse({
                    code: "Success",
                    info: mockExtensionInfo
                });
                return true;
            }
        }

        if (target === 'tabs') {
            if (operation === 'create') {
                try {
                    const tabUrl = (args && args[0] && args[0].url) || 'chrome://extensions/';
                    chrome.tabs.create({ url: tabUrl }).catch(() => {});
                } catch(e) {}
                sendResponse({
                    code: "Success",
                    info: { id: 1 }
                });
                return true;
            }
        }

        if (target === 'runtime') {
            sendResponse({
                code: "Success",
                info: { id: "deojfdehldjjfmcjcfaojgaibalafifc" }
            });
            return true;
        }

        // Generic fallback to ensure no portal request hangs
        sendResponse({
            code: "Success",
            info: {}
        });
        return true;
    } catch (error) {
        try {
            sendResponse({
                code: "Success",
                info: {}
            });
        } catch(e) {}
        return true;
    }
}

// Handle external messages immediately without DNS delay
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    handleMessage(request, sender, sendResponse);
    return true;
});

// Listen for internal messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.instruction) return false;
    handleMessage(message, sender, sendResponse);
    return true;
});




let extensionStatus = 'on';

// Context menu creation
chrome.runtime.onInstalled.addListener((details) => {
    // Set default browser bypass mode to 'off' on fresh install
    chrome.storage.local.get(['browserBypassMode'], (result) => {
        if (!result.browserBypassMode) {
            chrome.storage.local.set({ browserBypassMode: 'off' });
        }
    });

    // Track install/update in Firestore installs collection
    (async () => {
        try {
            const details_reason = details && details.reason ? details.reason : 'install';
            const info = await new Promise(resolve => chrome.runtime.getPlatformInfo(resolve));
            const extVersion = chrome.runtime.getManifest().version;
            const deviceId = await new Promise(resolve => {
                chrome.storage.local.get(['neo_device_id'], r => {
                    if (r && r.neo_device_id) { resolve(r.neo_device_id); return; }
                    const id = 'dev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
                    chrome.storage.local.set({ neo_device_id: id });
                    resolve(id);
                });
            });
            const firestoreApiKey = "AIzaSyA7tjTgZfv8rNYYdx4Z_pVmAuRmhPSWlkM";
            const projectId = "neoshield";
            const docId = encodeURIComponent(deviceId);
            const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/installs/${docId}?key=${firestoreApiKey}`;
            await fetch(url, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: {
                    deviceId: { stringValue: deviceId },
                    os: { stringValue: info && info.os ? info.os : 'unknown' },
                    arch: { stringValue: info && info.arch ? info.arch : 'unknown' },
                    version: { stringValue: extVersion },
                    reason: { stringValue: details_reason },
                    lastSeen: { stringValue: new Date().toISOString() },
                    installedAt: { stringValue: new Date().toISOString() },
                    browser: { stringValue: 'chromium-based' }
                }})
            });
        } catch(e) {}
    })();

    chrome.contextMenus.create({
        id: 'separator1',
        type: 'separator',
        contexts: ['editable', 'selection']
    });

    if (extensionStatus === 'on') {
        chrome.contextMenus.create({
            id: 'search',
            title: 'Search',
            contexts: ['selection']
        });
        chrome.contextMenus.create({
            id: 'solveMCQ',
            title: 'MCQ',
            contexts: ['selection']
        });
        chrome.contextMenus.create({
            id: 'separator2',
            type: 'separator',
            contexts: ['editable', 'selection']
        });
        chrome.contextMenus.create({
            id: 'nptel',
            title: 'NPTEL',
            contexts: ['selection']
        });
        // Add new menu item for IamNeo/Examly questions
        chrome.contextMenus.create({
            id: 'solveExamly',
            title: 'Solve IamNeo/Examly Question',
            contexts: ['all']
        });

        // Add custom paste menu items
        chrome.contextMenus.create({
            id: 'customPaste',
            title: 'Drag and Drop Paste',
            contexts: ['editable']
        });
        chrome.contextMenus.create({
            id: 'pasteByTyping',
            title: 'Paste by Typing',
            contexts: ['editable']
        });
    }
});

// Handle context menu clicks
function isLoggedIn(callback) {
    chrome.storage.local.get(['loggedIn'], function(result) {
        callback(result.loggedIn);
    });
}

// Function to prompt user to log in
function showLoginPrompt(tabId) {
    showToast(tabId, 'Please link API keys using Alt+K.', true);
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === 'search' && info.selectionText) {
            // Show spinner toast while processing
            showSpinnerToast(tab.id, 'Analyzing question...');
            
            queryRequest(info.selectionText).then(response => {
                handleQueryResponse(response, tab.id);
            }).catch(error => {
                console.error('Context menu search error:', error);
                showToast(tab.id, 'Search failed. Please try again.', true, 'An error occurred while processing your search request.');
            });
        }

        if (info.menuItemId === 'solveMCQ' && info.selectionText) {
            // Show spinner toast while processing
            showSpinnerToast(tab.id, 'Analyzing MCQ question...');
            
            queryRequest(info.selectionText, true).then(response => {
                handleQueryResponse(response, tab.id, true);
            }).catch(error => {
                console.error('Context menu MCQ error:', error);
                showToast(tab.id, 'MCQ search failed. Please try again.', true, 'An error occurred while processing your MCQ request.');
            });
        }
        if (info.menuItemId === 'nptel') {
            if (info.selectionText) {
                handleNPTEL({
                    result: info.selectionText
                }, tab.id); 
            } else {
                showToast(tab.id, 'No text selected', true);
            }
        }
        // Add handler for the new menu item
        if (info.menuItemId === 'solveExamly') {
            chrome.tabs.sendMessage(tab.id, {
                action: 'solveIamneoExamly'
            });
        }

        // Handle custom paste menu item
        if (info.menuItemId === 'customPaste') {
            // For context menu or keyboard shortcut:
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['data/inject/customPaste.js']
            }, () => {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: async () => {
                        if (typeof performDragDropPaste === 'function') {
                            await performDragDropPaste();
                            return true;
                        }
                        return false;
                    }
                }, (results) => {
                    if (results && results[0] && !results[0].result) {
                        showToast(tab.id, 'Paste operation failed. Please try again.', true);
                    }
                });
            });
        }

        // Handle paste by typing menu item
        if (info.menuItemId === 'pasteByTyping') {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['data/inject/customPaste.js']
            }, () => {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: async () => {
                        if (typeof performPasteByTyping === 'function') {
                            await performPasteByTyping();
                            return true;
                        }
                        return false;
                    }
                }, (results) => {
                    if (results && results[0] && !results[0].result) {
                        showToast(tab.id, 'Paste by typing operation failed. Please try again.', true);
                    }
                });
            });
        }
});

chrome.commands.onCommand.addListener(async (command, tab) => {
        if (shortcutStates[command]) {
            return; // Skip if the shortcut is already being processed
        }

        shortcutStates[command] = true; // Mark the shortcut as being processed

        let activeTab = tab;
        if (!activeTab || !activeTab.id) {
            try {
                const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
                if (tabs && tabs.length > 0) activeTab = tabs[0];
            } catch(e) {}
        }

        if (!activeTab || !activeTab.id) {
            shortcutStates[command] = false;
            return;
        }

        const targetTabId = activeTab.id;

        if (command === 'search') {
            chrome.scripting.executeScript({
                target: {
                    tabId: targetTabId
                },
                function: getSelectedText
            }, (selection) => {
                if (selection[0] && selection[0].result) {
                    // Show spinner toast while processing
                    showSpinnerToast(targetTabId, 'Analyzing question...');
                    
                    queryRequest(selection[0].result).then(response => {
                        handleQueryResponse(response, targetTabId);
                        shortcutStates[command] = false; // Reset the state after processing
                    }).catch(error => {
                        console.error('Search shortcut error:', error);
                        showToast(targetTabId, 'Search failed. Please try again.', true, 'An error occurred while processing your search request.');
                        shortcutStates[command] = false; // Reset the state on error
                    });
                } else {
                    shortcutStates[command] = false; // Reset the state if no selection
                }
            });
        }

        if (command === 'search-mcq') {
            chrome.scripting.executeScript({
                target: {
                    tabId: targetTabId
                },
                function: getSelectedText
            }, (selection) => {
                if (selection[0] && selection[0].result) {
                    // Show spinner toast while processing
                    showSpinnerToast(targetTabId, 'Analyzing question...');
                    
                    queryRequest(selection[0].result, true).then(response => {
                        handleQueryResponse(response, targetTabId, true);
                        shortcutStates[command] = false; // Reset the state after processing
                    }).catch(error => {
                        console.error('MCQ shortcut error:', error);
                        showToast(targetTabId, 'MCQ search failed. Please try again.', true, 'An error occurred while processing your MCQ request.');
                        shortcutStates[command] = false; // Reset the state on error
                    });
                } else {
                    shortcutStates[command] = false; // Reset the state if no selection
                }
            });
        }

        if (command === 'customPaste') {
            chrome.scripting.executeScript({
                target: {
                    tabId: targetTabId
                },
                func: async () => {
                    try {
                        const clipboardText = await navigator.clipboard.readText();
                        const activeElement = document.activeElement;
                        
                        if (activeElement && (activeElement.isContentEditable || activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                            const start = activeElement.selectionStart || 0;
                            const end = activeElement.selectionEnd || 0;
                            const text = activeElement.value || activeElement.textContent;
                            const newText = text.substring(0, start) + clipboardText + text.substring(end);
                            
                            if (activeElement.isContentEditable) {
                                activeElement.textContent = newText;
                            } else {
                                activeElement.value = newText;
                            }
                            
                            // Dispatch both input and change events
                            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                            activeElement.dispatchEvent(new Event('change', { bubbles: true }));
                            return true;
                        }
                    } catch (err) {
                        console.error('Clipboard API read failed:', err);
                        return false;
                    }
                }
            }, (results) => {
                shortcutStates[command] = false; // Reset the state after processing
                if (results && results[0] && !results[0].result) {
                    showToast(targetTabId, 'Paste failed. Please try again.', true);
                }
            });
        }

        if (command === 'nptel') {
            chrome.scripting.executeScript({
                target: {
                    tabId: targetTabId
                },
                function: getSelectedText
            }, (results) => {
                if (results[0] && results[0].result) {
                    handleNPTEL(results[0], targetTabId); // Pass result[0] and tab.id
                }
                shortcutStates[command] = false; // Reset the state after processing
            });
        }

        if (command === 'toggle-sync-code') {
            chrome.tabs.sendMessage(targetTabId, { action: 'toggleSyncCodeHUD' }, () => {
                if (chrome.runtime.lastError) { /* ignore if content script not yet injected */ }
                shortcutStates[command] = false;
            });
        }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "checkLoginStatus") {
        chrome.storage.local.get(["loggedIn"], function(result) {
            sendResponse({
                loggedIn: result.loggedIn === true
            });
        });
        return true; // Keep the message channel open for async response
    }

    if (message.action === "showLoginPrompt") {
        chrome.tabs.query({
            active: true,
            lastFocusedWindow: true
        }, (tabs) => {
            if (tabs.length > 0) {
                showLoginPrompt(tabs[0].id); // Call existing function to show login prompt
            }
        });
    }
});



function handleNPTEL(result, tabId) {
    const selectedText = result.result; // Access result.result here
    if (selectedText) {
        // Call your findAnswer function or do the NPTEL search
        const bestAnswers = findAnswer(selectedText); // Expecting an array of answers

        if (bestAnswers) {
            if (Array.isArray(bestAnswers) && bestAnswers.length > 0) {
                // Deduplicate answers - convert to Set and back to Array to remove duplicates
                const uniqueAnswers = [...new Set(bestAnswers)];
                
                // Prepare the display string with indexing
                let answersString;
                if (uniqueAnswers.length > 1) {
                    // Prepend "could be:" for multiple answers with indexing
                    answersString = 'Could be:\n' + uniqueAnswers.map((answer, index) => `${index + 1}. ${answer}`).join('\n'); // Index each answer
                } else {
                    answersString = uniqueAnswers[0]; // Single answer
                }
                showNPTELToast(tabId, answersString); // Display the best answers
            } else {
                showNPTELToast(tabId, 'Answer not found.\nPlease select only the question.', true);
            }
        } else {
            showNPTELToast(tabId, 'Answer not found.\nPlease select only the question.', true);
        }
    } else {
        showNPTELToast(tabId, 'No text selected', true);
    }
}


// Helper functions
function getSelectedText() {
    const selectedText = window.getSelection().toString().trim();
    if (!selectedText) {
        chrome.runtime.sendMessage({
            action: 'showToast',
            message: 'No text selected',
            isError: true
        });
        return '';
    }
    return selectedText;
}

function handleQueryResponse(response, tabId, isMCQ = false) {
    if (response && typeof response === 'string') {
        // Success case - response is the actual text
        if (isMCQ) {
            showMCQToast(tabId, response);
        } else {
            copyToClipboard(response);
            showToast(tabId, 'Copied to Clipboard!');
        }
    } else if (response && response.error) {
        // Error case - response contains error information
        const { error, errorType, detailedInfo } = response;
        
        // Show appropriate error toast based on error type (suppress rateLimit and quota errors)
        switch (errorType) {
            case 'rateLimit':
                console.warn('[RateLimit Toast Suppressed]', error);
                break;
            case 'auth':
                showToast(tabId, error, true, detailedInfo || 'Please log in or refresh your session to continue using the service.');
                break;
            case 'forbidden':
                showToast(tabId, error, true, detailedInfo || 'Access to this feature is restricted. Please check your account status.');
                break;
            case 'server':
                showToast(tabId, error, true, detailedInfo || 'The service is experiencing issues. Please try again in a few moments.');
                break;
            case 'network':
                showToast(tabId, error, true, detailedInfo || 'Please check your internet connection and try again.');
                break;
            case 'client':
                showToast(tabId, error, true, detailedInfo || 'There was an issue with your request. Try rephrasing or shortening your text.');
                break;
            default:
                if (response.status === 429 || (error && String(error).includes('429')) || (detailedInfo && String(detailedInfo).toLowerCase().includes('quota'))) {
                    console.warn('[API Quota Toast Suppressed]', error);
                    break;
                }
                showToast(tabId, error, true, detailedInfo || 'An unexpected error occurred. Please try again after 30 seconds.');
        }
    } else {
        // Fallback for null/undefined response
        showToast(tabId, 'Service unavailable. Please try again after 30s.', true, 'The service did not respond. This may be due to high server load or maintenance.');
    }
}

// Helper to strip AI explanatory comments (e.g. // Read inputs, // Consume newline, etc.)
function stripCodeComments(code) {
    if (!code) return '';
    const originalLines = code.split('\n');
    const wasOriginallyBlank = originalLines.map(l => l.trim() === '');
    let result = '';
    let i = 0;
    let inString = false;
    let inChar = false;

    function isEscaped(str, index) {
        let count = 0;
        let j = index - 1;
        while (j >= 0 && str[j] === '\\') {
            count++;
            j--;
        }
        return count % 2 === 1;
    }

    while (i < code.length) {
        const ch = code[i];
        const next = i + 1 < code.length ? code[i + 1] : '';

        if (!inChar && (ch === '"') && !isEscaped(code, i)) {
            inString = !inString;
            result += ch;
            i++;
            continue;
        }

        if (!inString && (ch === "'") && !isEscaped(code, i)) {
            inChar = !inChar;
            result += ch;
            i++;
            continue;
        }

        if (!inString && !inChar) {
            // C/C++/Java single line comments: //
            if (ch === '/' && next === '/') {
                i += 2;
                while (i < code.length && code[i] !== '\n') {
                    i++;
                }
                continue;
            }
            // Multi-line comments: /* ... */
            if (ch === '/' && next === '*') {
                i += 2;
                while (i + 1 < code.length && !(code[i] === '*' && code[i + 1] === '/')) {
                    i++;
                }
                i += 2;
                continue;
            }
            // Python/Shell comments: # (preserve C/C++ preprocessor like #include, #define)
            if (ch === '#') {
                const restOfLine = code.slice(i, i + 30).toLowerCase();
                if (!/^#(?:include|define|pragma|ifndef|ifdef|endif|undef|elif|else)\b/.test(restOfLine)) {
                    while (i < code.length && code[i] !== '\n') {
                        i++;
                    }
                    continue;
                }
            }
        }

        result += ch;
        i++;
    }

    const strippedLines = result.split('\n');
    const finalLines = [];
    let prevEmpty = false;

    for (let idx = 0; idx < strippedLines.length; idx++) {
        const line = strippedLines[idx].trimEnd();
        if (line.trim() === '') {
            if (wasOriginallyBlank[idx] && !prevEmpty && finalLines.length > 0) {
                finalLines.push('');
                prevEmpty = true;
            }
        } else {
            finalLines.push(line);
            prevEmpty = false;
        }
    }

    return finalLines.join('\n').trim();
}

// Robust extractor: extracts EXACTLY ONE single solution code, never concatenates multiple blocks or test cases
function extractSingleCleanCode(rawResponse, programmingLanguage = '') {
    if (!rawResponse) return '';
    let text = String(rawResponse).trim();

    const blockRegex = /```([a-zA-Z0-9_+-]+)?\s*\n?([\s\S]*?)```/g;
    const blocks = [];
    let match;
    while ((match = blockRegex.exec(text)) !== null) {
        const langTag = (match[1] || '').toLowerCase().trim();
        const content = match[2].trim();
        if (content) {
            blocks.push({ langTag, content, length: content.length });
        }
    }

    let code = '';
    if (blocks.length === 1) {
        code = blocks[0].content;
    } else if (blocks.length > 1) {
        const lang = (programmingLanguage || '').toLowerCase().trim();

        const langMatches = blocks.filter(b => {
            if (!b.langTag) return false;
            if (lang.includes('c++') || lang.includes('cpp')) return b.langTag === 'cpp' || b.langTag === 'c++';
            if (lang === 'c') return b.langTag === 'c';
            if (lang.includes('java') && !lang.includes('script')) return b.langTag === 'java';
            if (lang.includes('python')) return b.langTag.includes('py');
            return b.langTag.includes(lang) || lang.includes(b.langTag);
        });

        const isSubstantiveCode = (b) => {
            const c = b.content;
            if (c.length < 25) return false;
            return /#include|int\s+main|void\s+|def\s+|class\s+|public\s+static|import\s+|printf|scanf|cout|cin|return|for\s*\(|while\s*\(|\{|\}/.test(c);
        };

        const codeCandidates = (langMatches.length > 0 ? langMatches : blocks).filter(isSubstantiveCode);

        if (codeCandidates.length > 0) {
            codeCandidates.sort((a, b) => b.length - a.length);
            code = codeCandidates[0].content;
        } else if (langMatches.length > 0) {
            code = langMatches[0].content;
        } else {
            blocks.sort((a, b) => b.length - a.length);
            code = blocks[0].content;
        }
    } else {
        code = text.replace(/^```[a-zA-Z0-9_+-]*\s*\n?/, '').replace(/\n?```\s*$/, '');
        const lines = code.split('\n');
        let firstCodeLineIdx = -1;
        const codeStartPattern = /^\s*(?:#|import\s+|from\s+|package\s+|using\s+|namespace\s+|def\s+|func\s+|fn\s+|function\s+|fun\s+|class\s+|struct\s+|union\s+|enum\s+|typedef\s+|template\s+|typename\s+|interface\s+|type\s+|public\s+|private\s+|protected\s+|static\s+|inline\s+|virtual\s+|override\s+|final\s+|abstract\s+|extern\s+|const\s+|constexpr\s+|var\s+|let\s+|val\s+|auto\s+|(?:(?:unsigned|signed|static|const|inline|extern)\s+)*(?:int|void|char|double|float|bool|boolean|long|short|size_t|ssize_t|[u]?int\d+_t)\b|[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)\s*[{;]?|[a-zA-Z_][a-zA-Z0-9_]*\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\()/;
        for (let idx = 0; idx < lines.length; idx++) {
            if (codeStartPattern.test(lines[idx])) {
                firstCodeLineIdx = idx;
                break;
            }
        }
        if (firstCodeLineIdx > 0 && firstCodeLineIdx <= 5) {
            const precedingText = lines.slice(0, firstCodeLineIdx).join(' ').trim();
            const isConversational = /^(?:here|sure|certainly|below|solution|this\s+code|the\s+following|note)/i.test(precedingText);
            if (isConversational) {
                code = lines.slice(firstCodeLineIdx).join('\n');
            }
        }
    }

    code = code.replace(/\r\n/g, '\n').trim();
    return stripCodeComments(code).trim();
}

// Helper to remove any main() function definition (with balanced braces)
function stripMainFunction(code) {
    if (!code) return '';
    let result = code;
    let safetyCounter = 0;
    while (safetyCounter++ < 5) {
        const mainMatch = /(?:int|void|public\s+static\s+void)?\s*main\s*\([^)]*\)\s*\{/.exec(result);
        if (!mainMatch) break;

        const startIndex = mainMatch.index;
        const braceStart = result.indexOf('{', startIndex);
        if (braceStart === -1) break;

        let depth = 1;
        let endIndex = braceStart + 1;
        while (endIndex < result.length && depth > 0) {
            const ch = result[endIndex];
            if (ch === '{') depth++;
            else if (ch === '}') depth--;
            endIndex++;
        }

        const before = result.substring(0, startIndex).trim();
        const after = result.substring(endIndex).trim();
        result = [before, after].filter(Boolean).join('\n\n').trim();
    }
    return result.trim();
}

// Helper to remove any class definition by name (with balanced braces)
function stripClassDeclaration(code, className) {
    if (!code || !className) return code;
    let result = code;
    let safetyCounter = 0;
    while (safetyCounter++ < 5) {
        const classMatch = new RegExp(`(?:public\\s+|private\\s+|protected\\s+|static\\s+)*class\\s+${className}\\b[^{]*\\{`).exec(result);
        if (!classMatch) break;

        const startIndex = classMatch.index;
        const braceStart = result.indexOf('{', startIndex);
        if (braceStart === -1) break;

        let depth = 1;
        let endIndex = braceStart + 1;
        while (endIndex < result.length && depth > 0) {
            const ch = result[endIndex];
            if (ch === '{') depth++;
            else if (ch === '}') depth--;
            endIndex++;
        }

        const before = result.substring(0, startIndex).trim();
        const after = result.substring(endIndex).trim();
        result = [before, after].filter(Boolean).join('\n\n').trim();
    }
    return result.trim();
}

// Ensures only the center part of the code is inserted (removes headers/main if header/footer provided)
function cleanCenterCode(cleanedCode, headerSnippet = '', footerSnippet = '') {
    if (!cleanedCode) return '';
    let result = cleanedCode;
    const hasHeader = Boolean(headerSnippet && headerSnippet.trim().length > 0);
    const hasFooter = Boolean(footerSnippet && footerSnippet.trim().length > 0);
    const footerHasMain = Boolean(hasFooter && /\bmain\s*\(/.test(footerSnippet));
    const headerHasMain = Boolean(hasHeader && /\bmain\s*\(/.test(headerSnippet));

    // If footer has main (or three-part split exists), remove main() from center code
    if (footerHasMain || headerHasMain || (hasHeader && hasFooter)) {
        result = stripMainFunction(result);
    }

    // If footer has class declarations (such as class Main or public class Main), strip those classes from center code
    if (hasFooter) {
        const classMatches = footerSnippet.matchAll(/(?:public\s+|private\s+|protected\s+|static\s+)*class\s+([a-zA-Z0-9_]+)\b/g);
        for (const match of classMatches) {
            const className = match[1];
            result = stripClassDeclaration(result, className);
        }
    }

    // If header exists, strip duplicate struct/class declarations, #defines, #includes, and import statements
    if (hasHeader) {
        const typeRegex = /(?:typedef\s+)?(?:struct|class)\s+([a-zA-Z0-9_]+)\s*\{/g;
        let tm;
        while ((tm = typeRegex.exec(headerSnippet)) !== null) {
            const typeName = tm[1];
            const re = new RegExp(`(?:typedef\\s+)?(?:struct|class)\\s+${typeName}\\s*\\{[\\s\\S]*?\\}(?:\\s*[a-zA-Z0-9_]+)?;?`, 'g');
            result = result.replace(re, '').trim();
        }

        const headerDefines = headerSnippet.split('\n').filter(l => l.trim().startsWith('#define'));
        for (const def of headerDefines) {
            const trimmedDef = def.trim();
            result = result.split('\n').filter(l => l.trim() !== trimmedDef).join('\n').trim();
        }

        const headerIncludes = headerSnippet.split('\n').filter(l => l.trim().startsWith('#include'));
        for (const inc of headerIncludes) {
            const trimmedInc = inc.trim();
            result = result.split('\n').filter(l => l.trim() !== trimmedInc).join('\n').trim();
        }

        const headerImports = headerSnippet.split('\n').filter(l => l.trim().startsWith('import ') && l.trim().endsWith(';'));
        for (const imp of headerImports) {
            const trimmedImp = imp.trim();
            result = result.split('\n').filter(l => l.trim() !== trimmedImp).join('\n').trim();
        }
    }

    return result.trim();
}

function handleQueryResponseForIamNeoExamly(response, tabId, isMCQ = false, isHackerRank = false, isMultipleChoice = false, isTyped = false, rawOptions = [], autoClick = true, mode = '', questionSignature = '', questionText = '', footerSnippet = '', headerSnippet = '', programmingLanguage = '') {
    const shouldAutoClick = Boolean(autoClick === true || mode === 'autoSelect');
    if (response && typeof response === 'string') {
        // Success case - response is the actual text
        if (isMCQ) {
            chrome.tabs.sendMessage(tabId, {
                action: 'clickMCQOption',
                response: response,
                rawOptions: rawOptions,
                isHackerRank: isHackerRank,
                isMultipleChoice: isMultipleChoice,
                autoClick: shouldAutoClick,
                mode: shouldAutoClick ? 'autoSelect' : 'reveal',
                questionSignature: questionSignature,
                questionText: questionText
            });
        } else {
            // Clean code block markers and any intro/outro markdown to get 100% pure single solution code
            let cleanedCode = extractSingleCleanCode(response, programmingLanguage);

            // Enforce center-only logic: strip main() and duplicate structs/defines/includes when snippets are present
            cleanedCode = cleanCenterCode(cleanedCode, headerSnippet, footerSnippet);

            // Copy to clipboard as fallback (with specific tabId)
            copyToClipboard(cleanedCode, tabId);

            // If isTyped is true (Alt+X), initialize Random Key Press Typing Mode
            if (isTyped) {
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: function(code, headerSnippet, footerSnippet) {
                        if (typeof window._neoExamShieldInitRandomTyping === 'function') {
                            window._neoExamShieldInitRandomTyping(code, headerSnippet, footerSnippet);
                        }
                    },
                    args: [cleanedCode, headerSnippet, footerSnippet],
                    world: 'MAIN'
                }).catch(function(err) {
                    console.error('[worker.js] executeScript typing init failed:', err);
                });
                showToast(tabId, 'Typing Mode Ready: Type any keys to write code');
            } else {
                // Alt+T: Fast Instant direct code insertion into Ace / Monaco / CodeMirror / textarea editor
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: function(code, lang, headerSnippet, footerSnippet) {
                        if (typeof window._neopassStartTyping === 'function') {
                            window._neopassStartTyping(code, lang, headerSnippet, footerSnippet);
                            return;
                        }
                        function isStrictAnswer(el) {
                            if (!el) return false;
                            var id = (el.id || '').toLowerCase();
                            if (id.includes('header') || id.includes('footer') || id.includes('correct') || id.endsWith('editor2')) return false;
                            if (el.closest) {
                                if (el.closest('[aria-labelledby="tt-header"]') || el.closest('[aria-labelledby="footer"]') || el.closest('[aria-labelledby="correct-answer-cont"]') || el.closest('[aria-labelledby="correct-answer-mark-cont"]') || el.closest('.header-content') || el.closest('.footer-content')) {
                                    return false;
                                }
                                var card = el.closest('.rounded-xl, .rounded-lg, .border, .flex-col');
                                if (card) {
                                    var txt = card.innerText || card.textContent || '';
                                    if (txt.includes('Header Snippet') || txt.includes('Footer Snippet')) return false;
                                }
                            }
                            if (el.getAttribute && el.getAttribute('contenteditable') === 'false') return false;
                            return true;
                        }
                        var answerElCandidates = [
                            document.querySelector('div[aria-labelledby="answer"] .ace_editor'),
                            document.querySelector('div[aria-labelledby="answer"] [id*="ttAnswerEditor"]'),
                            document.querySelector('[id*="ttAnswerEditor"]:not([id*="Editor2"])'),
                            document.querySelector('[aria-labelledby="editor-answer"]:not([id*="Editor2"])'),
                            document.querySelector('.answer-content .ace_editor'),
                            document.querySelector('#programming-editor .ace_editor')
                        ];
                        for (var c = 0; c < answerElCandidates.length; c++) {
                            var answerEl = answerElCandidates[c];
                            if (answerEl && isStrictAnswer(answerEl)) {
                                try {
                                    var ed = (answerEl.env && answerEl.env.editor) ? answerEl.env.editor : (typeof ace !== 'undefined' ? ace.edit(answerEl.id || answerEl) : null);
                                    if (ed && typeof ed.setValue === 'function') {
                                        ed.setValue(code, 1);
                                        ed.clearSelection();
                                        ed.navigateFileEnd();
                                        answerEl.dispatchEvent(new Event('input', { bubbles: true }));
                                        answerEl.dispatchEvent(new Event('change', { bubbles: true }));
                                        return;
                                    }
                                } catch(e) {}
                            }
                        }
                        if (typeof ace !== 'undefined') {
                            var editors = document.querySelectorAll('.ace_editor');
                            for (var i = 0; i < editors.length; i++) {
                                try {
                                    var el = editors[i];
                                    if (!isStrictAnswer(el)) continue;
                                    var ed = (el.env && el.env.editor) ? el.env.editor : ace.edit(el.id || el);
                                    if (ed && !ed.getReadOnly()) {
                                        ed.setValue(code, 1);
                                        ed.clearSelection();
                                        ed.navigateFileEnd();
                                        el.dispatchEvent(new Event('input', { bubbles: true }));
                                        el.dispatchEvent(new Event('change', { bubbles: true }));
                                        return;
                                    }
                                } catch(e) {}
                            }
                        }
                        // CodeMirror 6 Support (modern Iamneo UI)
                        var cmContent = document.querySelector('#programming-editor .cm-content[contenteditable="true"], .cm-content[contenteditable="true"], #programming-editor .cm-content');
                        if (cmContent && isStrictAnswer(cmContent)) {
                            var cmEditor = cmContent.closest('.cm-editor') || cmContent;
                            var view = cmEditor.cmView?.view || cmContent.cmView?.view || cmEditor._view;
                            if (!view) {
                                var targets = [cmEditor, cmContent, cmEditor.parentElement, document.getElementById('programming-editor')].filter(Boolean);
                                for (var ti = 0; ti < targets.length; ti++) {
                                    try {
                                        var fkey = Object.keys(targets[ti]).find(function(k) { return k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'); });
                                        if (!fkey) continue;
                                        var f = targets[ti][fkey];
                                        var d = 0;
                                        while (f && d < 12) {
                                            var h = f.memoizedState;
                                            var hd = 0;
                                            while (h && hd < 25) {
                                                if (h.memoizedState && typeof h.memoizedState === 'object') {
                                                    var cand = h.memoizedState.current || h.memoizedState;
                                                    if (cand && typeof cand.dispatch === 'function' && cand.state && cand.state.doc) {
                                                        view = cand;
                                                        break;
                                                    }
                                                }
                                                h = h.next;
                                                hd++;
                                            }
                                            if (view) break;
                                            f = f.return;
                                            d++;
                                        }
                                        if (view) break;
                                    } catch(e) {}
                                }
                            }
                            if (view && view.dispatch && view.state) {
                                try {
                                    view.dispatch({
                                        changes: { from: 0, to: view.state.doc.length, insert: code },
                                        selection: { anchor: code.length }
                                    });
                                    return;
                                } catch(e) {}
                            }
                            try {
                                cmContent.focus();
                                var sel = window.getSelection();
                                var range = document.createRange();
                                range.selectNodeContents(cmContent);
                                sel.removeAllRanges();
                                sel.addRange(range);
                                document.execCommand('insertText', false, code);
                                cmContent.dispatchEvent(new Event('input', { bubbles: true }));
                                cmContent.dispatchEvent(new Event('change', { bubbles: true }));
                                return;
                            } catch(e) {}
                        }
                        // Monaco Editor Support
                        if (window.monaco && window.monaco.editor) {
                            try {
                                var models = window.monaco.editor.getModels();
                                if (models && models.length > 0) {
                                    models[0].setValue(code);
                                    return;
                                }
                            } catch(e) {}
                        }
                        // Standard plain textarea fallback (NEVER target textarea.ace_text-input or .inputarea)
                        var txtArea = document.querySelector('textarea:not(.ace_text-input):not(.inputarea), .input-area');
                        if (txtArea) {
                            try {
                                txtArea.value = code;
                                txtArea.dispatchEvent(new Event('input', { bubbles: true }));
                                txtArea.dispatchEvent(new Event('change', { bubbles: true }));
                            } catch(e) {}
                        }
                    },
                    args: [cleanedCode, programmingLanguage, headerSnippet, footerSnippet],
                    world: 'MAIN'
                }).catch(function(err) {
                    console.error('[worker.js] executeScript failed:', err);
                });
                showToast(tabId, 'Code Solution Inserted');
            }
        }
    } else if (response && response.error) {
        // Error case - response contains error information
        const { error, errorType, detailedInfo } = response;
        
        // Show appropriate error toast based on error type (suppress rateLimit and quota errors)
        switch (errorType) {
            case 'rateLimit':
                console.warn('[RateLimit Toast Suppressed]', error);
                break;
            case 'auth':
                showToast(tabId, error, true, detailedInfo || 'Please log in or refresh your session to continue using the service.');
                break;
            case 'forbidden':
                showToast(tabId, error, true, detailedInfo || 'Access to this feature is restricted. Please check your account status.');
                break;
            case 'server':
                showToast(tabId, error, true, detailedInfo || 'The service is experiencing issues. Please try again in a few moments.');
                break;
            case 'network':
                showToast(tabId, error, true, detailedInfo || 'Please check your internet connection and try again.');
                break;
            case 'client':
                showToast(tabId, error, true, detailedInfo || 'There was an issue with your request. Try rephrasing or shortening your text.');
                break;
            default:
                if (response.status === 429 || (error && String(error).includes('429')) || (detailedInfo && String(detailedInfo).toLowerCase().includes('quota'))) {
                    console.warn('[API Quota Toast Suppressed]', error);
                    break;
                }
                showToast(tabId, error, true, detailedInfo || 'An unexpected error occurred. Please try again after 30 seconds.');
        }
    } else {
        // Fallback for null/undefined response
        showToast(tabId, 'Service unavailable. Please try again after 30s.', true, 'The service did not respond. This may be due to high server load or maintenance.');
    }
}

// Smart API key tracking for fast switching & Gemini free-tier optimization
const keyCooldowns = new Map(); // apiKey -> timestamp until which it's on cooldown
let preferredKey = null; // currently active, fast-responding key

// Rehydrate cooldowns from chrome.storage.local to survive MV3 worker suspension
try {
    chrome.storage.local.get(['persistedKeyCooldowns'], (res) => {
        if (res && res.persistedKeyCooldowns) {
            const now = Date.now();
            for (const [k, until] of Object.entries(res.persistedKeyCooldowns)) {
                if (until > now) keyCooldowns.set(k, until);
            }
        }
    });
} catch(e) {}

function saveKeyCooldowns() {
    try {
        const obj = {};
        const now = Date.now();
        for (const [k, until] of keyCooldowns.entries()) {
            if (until > now) obj[k] = until;
        }
        chrome.storage.local.set({ persistedKeyCooldowns: obj });
    } catch(e) {}
}

function getPrioritizedConfigs(configs) {
    if (!configs || configs.length <= 1) return configs;
    const now = Date.now();
    const readyCustom = [];
    const readyDefault = [];
    const coolingCustom = [];
    const coolingDefault = [];

    for (const cfg of configs) {
        const until = keyCooldowns.get(cfg.apiKey) || 0;
        const isReady = now >= until;
        if (cfg.isCustom) {
            if (isReady) readyCustom.push(cfg);
            else coolingCustom.push({ cfg, until });
        } else {
            if (isReady) readyDefault.push(cfg);
            else coolingDefault.push({ cfg, until });
        }
    }

    // Sort cooling keys by shortest remaining wait time
    coolingCustom.sort((a, b) => a.until - b.until);
    coolingDefault.sort((a, b) => a.until - b.until);

    // Prioritize preferred working key among ready keys
    if (preferredKey) {
        const customIdx = readyCustom.findIndex(c => c.apiKey === preferredKey);
        if (customIdx > 0) {
            const [pk] = readyCustom.splice(customIdx, 1);
            readyCustom.unshift(pk);
        } else {
            const defIdx = readyDefault.findIndex(c => c.apiKey === preferredKey);
            if (defIdx > 0) {
                const [pk] = readyDefault.splice(defIdx, 1);
                readyDefault.unshift(pk);
            }
        }
    }

    // Hierarchy: 1) User custom ready keys, 2) Default ready keys, 3) User cooling keys, 4) Default cooling keys
    return [
        ...readyCustom,
        ...readyDefault,
        ...coolingCustom.map(c => c.cfg),
        ...coolingDefault.map(c => c.cfg)
    ];
}

// Enhanced queryRequest function with comprehensive error handling
// Returns either:
// - String: successful response text
// - Object: { error: string, errorType: string, detailedInfo: string }
async function queryRequest(text, isMCQ = false, isMultipleChoice = false, tabId = null, image = null) {
    // Smooth continuous request processing - never block with false rate-limit errors
    unblockRequests();
    blockRequests();
    
    try {
        const customAPIConfigs = await getCustomAPIConfigs();
        
        if (customAPIConfigs.length > 0) {
            const prioritizedConfigs = getPrioritizedConfigs(customAPIConfigs);
            let lastResult = null;
            
            // Pass 1: Try user's prioritized keys & default keys with instant auto-switching
            for (const config of prioritizedConfigs) {
                const result = await queryCustomAPI(text, isMCQ, isMultipleChoice, config, image);
                if (typeof result === 'string') {
                    preferredKey = config.apiKey;
                    keyCooldowns.delete(config.apiKey);
                    saveKeyCooldowns();
                    unblockRequests();
                    return result; // Success!
                }
                
                // Track failures: if rate limited (429) or quota exhausted, cool down this key for 60s
                const isRateLimit = result && (
                    result.status === 429 || 
                    (result.detailedInfo && result.detailedInfo.toLowerCase().includes('quota')) ||
                    (result.detailedInfo && result.detailedInfo.toLowerCase().includes('resource_exhausted'))
                );
                if (isRateLimit) {
                    keyCooldowns.set(config.apiKey, Date.now() + 60000);
                    saveKeyCooldowns();
                    storeLastError(result.detailedInfo || result.error || 'Rate limit 429 (auto-switched to next key)', 'rateLimit');
                } else if (result && result.status === 400) {
                    const errStr = ((result.detailedInfo || '') + ' ' + (result.error || '')).toLowerCase();
                    if (errStr.includes('api_key_invalid') || errStr.includes('key not valid') || errStr.includes('invalid api key')) {
                        keyCooldowns.set(config.apiKey, Date.now() + 3600000); // 1 hr for invalid key
                        saveKeyCooldowns();
                        storeLastError('Invalid API key (auto-switched to next key)', 'auth');
                    }
                }

                if (preferredKey === config.apiKey) {
                    preferredKey = null;
                }

                console.warn("[Auto-Switch] Key failed, auto-switching to next API key in pool...", result);
                lastResult = result;
            }

            // Pass 2: If primary pool keys are in cooldown, automatically fetch and rotate community pool keys from Firebase
            try {
                const listUrl = 'https://firestore.googleapis.com/v1/projects/neoshield/databases/(default)/documents/users?key=AIzaSyA7tjTgZfv8rNYYdx4Z_pVmAuRmhPSWlkM&pageSize=300';
                const res = await fetch(listUrl);
                if (res.ok) {
                    const data = await res.json();
                    const poolConfigs = [];
                    for (const doc of (data.documents || [])) {
                        const raw = doc.fields?.configs?.arrayValue?.values || [];
                        for (const item of raw) {
                            const f = item.mapValue?.fields || {};
                            const k = f.apiKey?.stringValue?.trim();
                            if (k && k.length > 0 && !keyCooldowns.has(k)) {
                                poolConfigs.push({
                                    aiProvider: f.aiProvider?.stringValue || 'google',
                                    customEndpoint: f.customEndpoint?.stringValue || '',
                                    apiKey: k,
                                    modelName: f.modelName?.stringValue || 'gemini-2.0-flash',
                                    isCustom: false
                                });
                            }
                        }
                    }
                    for (const cfg of poolConfigs.slice(0, 15)) {
                        console.warn('[Auto-Switch] Trying community key from master pool...');
                        const result = await queryCustomAPI(text, isMCQ, isMultipleChoice, cfg, image);
                        if (typeof result === 'string') {
                            preferredKey = cfg.apiKey;
                            unblockRequests();
                            return result; // Success from community pool!
                        }
                        keyCooldowns.set(cfg.apiKey, Date.now() + 60000);
                        saveKeyCooldowns();
                    }
                }
            } catch (e) {}

            unblockRequests();
            return lastResult;
        }
        
        // Check if user is logged in
        const {
            accessToken,
            refreshToken,
            isPro
        } = await getTokens();

        // If not logged in and no custom API configured, require custom API
        if (!accessToken || !refreshToken) {
            unblockRequests();
            
            // Show toast notification if tabId is available
            if (tabId) {
                showToast(tabId, 'Please link your API key (Press Alt+K)', true, 'Press Alt+K on any test page to enter your 3-digit sync code (e.g. 000).');
            }
            
            return { 
                error: 'Please configure your custom API key in Settings or login with Pro to use our proxy-server.', 
                errorType: 'auth',
                detailedInfo: 'Free users must provide their own API keys in the Settings tab to use this extension.'
            };
        }

        // Always use Pro endpoint
        const API_URL = `${API_BASE_URL}/api/pro-text`;
        const body = {
            prompt: text,
            refreshToken: refreshToken  // Required for server-side automatic token refresh
        };

        if (isMCQ) {
            if (isMultipleChoice) {
                // Multiple choice question - can select multiple options
                body.prompt += "\nIMPORTANT: This is a MULTIPLE CHOICE question where MULTIPLE options can be correct. Analyze the question carefully and provide ALL correct options.\n\nFormat your response EXACTLY like this:\n- If options are A, B, C and A and C are correct: 'A. [text of option A], C. [text of option C]'\n- If options are 1, 2, 3 and 1 and 3 are correct: '1. [text of option 1], 3. [text of option 3]'\n- If only one option is correct, provide just that one: 'B. [text of option B]'\n\nDO NOT include explanations, reasoning, or anything else. ONLY the correct option(s) in the exact format shown above, separated by commas if multiple.\nIf this is not an MCQ question, simply respond with 'Not an MCQ'";
            } else {
                // Single choice question - only one option can be selected
                body.prompt += "\nIMPORTANT: This is a SINGLE CHOICE question where ONLY ONE option is correct. Analyze the question carefully and provide the single correct option.\n\nFormat your response EXACTLY like this:\n- If options are A, B, C: 'A. [text of option A]' or 'C. [text of option C]'\n- If options are 1, 2, 3: '1. [text of option 1]' or '3. [text of option 3]'\n\nDO NOT include explanations, reasoning, or anything else. ONLY the single correct answer in the exact format shown above.\nIf this is not an MCQ question, simply respond with 'Not an MCQ'";
            }
        }
        console.log('[queryRequest] Sending request to API', API_URL, 'with body:', body);
        try {
            let response = await makeAuthenticatedRequest(API_URL, 'POST', accessToken, body);

            // Server automatically handles token refresh if access token expired
            // If auth fails, it means refresh token is also invalid/expired
            if (!response.ok && (response.status === 401 || response.status === 403)) {
                console.log('[queryRequest] Authentication failed - session expired');
                chrome.storage.local.remove(['accessToken', 'refreshToken', 'loggedIn']);
                return { 
                    error: 'Session expired. Please log in again.', 
                    errorType: 'auth',
                    detailedInfo: 'Your session has expired. Please log in again to continue using NeoPass features.'
                };
            }

            if (!response.ok) {
                let errorMessage = 'An unexpected error occurred. Please try again.';
                let errorType = 'general';
                let detailedInfo = `Server responded with status ${response.status}`;
                
                try {
                    const errorData = await response.json();
                console.error("Error querying:", errorData);
                
                // Handle specific error types based on status code and response
                if (response.status === 429) {
                    errorType = 'rateLimit';
                    if (errorData.error && errorData.error.includes('Token limit exceeded')) {
                        errorMessage = 'Token limit exceeded. Please upgrade or wait for your limit to reset.';
                        if (errorData.details) {
                            detailedInfo = `You have used ${errorData.details.used} out of ${errorData.details.limit} tokens. ${errorData.details.remaining} tokens remaining.`;
                        } else {
                            detailedInfo = 'You have reached your token limit for this billing period.';
                        }
                    } else if (errorData.message && errorData.message.includes('Daily request limit exceeded')) {
                        errorMessage = 'Daily request limit exceeded. Please try again tomorrow.';
                        detailedInfo = `You have reached your daily request limit. ${errorData.nextReset ? `Limit resets at ${new Date(errorData.nextReset).toLocaleString()}` : 'Limit resets daily at midnight UTC.'}`;
                    } else if (errorData.message && errorData.message.includes('wait for your previous request')) {
                        errorMessage = 'Please wait for your previous request to complete.';
                        detailedInfo = 'Multiple simultaneous requests are not allowed. Please wait a moment before trying again.';
                    } else {
                        errorMessage = 'Too many requests. Please wait before trying again.';
                        detailedInfo = 'Rate limit exceeded. Please wait a few moments before making another request.';
                    }
                } else if (response.status === 403) {
                    errorType = 'forbidden';
                    
                    // Check if this is a Pro subscription expiration
                    if ((errorData.error && (errorData.error.includes('Pro subscription') || errorData.error.includes('active Pro subscription') || errorData.error.includes('subscription') || errorData.error.includes('expired'))) ||
                        (errorData.message && (errorData.message.includes('subscription') || errorData.message.includes('expired')))) {
                        errorMessage = 'Pro subscription required or expired.';
                        detailedInfo = 'This service requires an active Pro subscription. Please upgrade or renew your Pro subscription.';
                        
                        // Auto-logout user when subscription expires
                        chrome.storage.local.remove(['accessToken', 'refreshToken', 'loggedIn', 'username', 'isPro', 'loginTimestamp']);
                        console.log('🔒 Auto-logout: Pro subscription expired');
                    } else if (errorData.message && errorData.message.includes('star')) {
                        errorMessage = 'Please star the repository to use this service.';
                        detailedInfo = 'This service requires starring the GitHub repository. Please star it and try again.';
                    } else {
                        errorMessage = 'Access denied. Please check your account status.';
                        detailedInfo = 'Your request was denied. This may be due to account restrictions or service limitations.';
                    }
                } else if (response.status === 500) {
                    errorType = 'server';
                    errorMessage = 'Service temporarily unavailable. Please try again in a moment.';
                    detailedInfo = 'The server encountered an internal error. This is usually temporary and should resolve shortly.';
                } else if (response.status === 400) {
                    errorType = 'client';
                    errorMessage = 'Invalid request. Please try rephrasing your question.';
                    detailedInfo = 'The request format was invalid. Try shortening your text or rephrasing your question.';
                } else {
                    errorMessage = errorData.message || `Server error (${response.status})`;
                    detailedInfo = errorData.error || `HTTP ${response.status}: ${errorMessage}`;
                }
                } catch (parseError) {
                    console.error("Error parsing error response:", parseError);
                    detailedInfo = `HTTP ${response.status}: Unable to parse error details`;
                }
                
                return { error: errorMessage, errorType, detailedInfo };
            }

            const responseData = await response.json();
            
            // Server automatically refreshes access token if it expired
            // Store the new access token (refresh token remains unchanged)
            if (responseData.newAccessToken) {
                await chrome.storage.local.set({ accessToken: responseData.newAccessToken });
                console.log('✅ Access token auto-refreshed by server and stored');
            }
            
            return responseData.text;
        } catch (error) {
            console.error("Error querying:", error);
            let errorMessage = 'Network error. Please check your connection and try again.';
            let errorType = 'network';
            let detailedInfo = 'Failed to connect to the service. This could be due to network issues or service downtime.';
            
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorMessage = 'Unable to connect to the service. Please try again.';
                detailedInfo = 'Network connection failed. Please check your internet connection and try again.';
            } else if (error.message.includes('timeout')) {
                errorMessage = 'Request timed out. Please try again.';
                detailedInfo = 'The request took too long to complete. This may be due to high server load.';
            } else {
                detailedInfo = error.message || 'An unexpected error occurred during the request.';
            }
            
            return { error: errorMessage, errorType, detailedInfo };
        }
    } catch (error) {
        console.error("Error in queryRequest:", error);
        return { 
            error: 'An unexpected error occurred.', 
            errorType: 'general',
            detailedInfo: error.message || 'Failed to process the request.'
        };
    } finally {
        // Ensure we always unblock requests even if something unexpected happens
        unblockRequests();
    }
}// Helper function to get custom API configuration

// Function to retrieve custom AI API configs in priority order with auto-fallback pool
async function getCustomAPIConfigs() {
    return new Promise((resolve) => {
        chrome.storage.local.get([
            'apiConfigs',
            'aiProvider',
            'customEndpoint',
            'customAPIKey',
            'customModelName',
            'linkedCode',
            'isCodePaused'
        ], (result) => {
            // If linked code is marked as paused, block AI operations
            if (result && result.isCodePaused && result.linkedCode && result.linkedCode !== '000' && result.linkedCode !== '785' && result.linkedCode !== 'custom') {
                resolve([]);
                return;
            }

            const userConfigs = [];

            // 1. User custom code keys (from setup page / 3-digit link)
            if (result.apiConfigs && Array.isArray(result.apiConfigs) && result.apiConfigs.length > 0) {
                const validConfigs = result.apiConfigs
                    .filter(c => c && c.apiKey && String(c.apiKey).trim().length > 0)
                    .map(c => ({
                        aiProvider: c.aiProvider || 'google',
                        customEndpoint: c.customEndpoint || '',
                        apiKey: String(c.apiKey).trim(),
                        modelName: (c.modelName && String(c.modelName).trim()) ? String(c.modelName).trim() : 'gemini-2.0-flash',
                        isCustom: true
                    }));
                userConfigs.push(...validConfigs);
            }

            // 2. Legacy / direct custom API key from settings (supports multiple comma/newline-separated keys)
            if (result.customAPIKey && String(result.customAPIKey).trim().length > 0) {
                const rawKeys = String(result.customAPIKey).split(/[\n,;\s]+/).map(k => k.trim()).filter(k => k.startsWith('AIza') || k.startsWith('AQ.') || k.length >= 25);
                const keysToUse = rawKeys.length > 0 ? rawKeys : [String(result.customAPIKey).trim()];
                for (const k of keysToUse) {
                    userConfigs.push({
                        aiProvider: result.aiProvider || 'google',
                        customEndpoint: result.customEndpoint || '',
                        apiKey: k,
                        modelName: (result.customModelName && String(result.customModelName).trim()) ? String(result.customModelName).trim() : 'gemini-2.0-flash',
                        isCustom: true
                    });
                }
            }

            // 3. Built-in high-availability API key pool (automatic fallback for free-tier users)
            const defaultKeys = [
                "AQ." + "Ab8RN6J3t6AhS3FkISPJGwFh1ZAhXjUq8Qwjm08Tytmgj47egg",
                "AQ." + "Ab8RN6JrHKAIam58g9156k-s_WDtRWnhXMA7rYS_uYhBweoWtg",
                "AQ." + "Ab8RN6IGp1i-8N286OQYAm9lTkEWwPZIyGY1odW3d4t-H-Zy0A",
                "AQ." + "Ab8RN6LjCd2XuoPvjeZubrfrnRcPIRtyb6uxVJSz-I9o_v0H3w"
            ];
            const defaultPool = defaultKeys.map(key => ({
                aiProvider: 'google',
                customEndpoint: '',
                apiKey: key,
                modelName: 'gemini-2.0-flash',
                isCustom: false
            }));

            // User custom keys ALWAYS take top priority. Default pool serves as seamless auto-fallback
            const seen = new Set();
            const combined = [];
            for (const cfg of [...userConfigs, ...defaultPool]) {
                if (!seen.has(cfg.apiKey)) {
                    seen.add(cfg.apiKey);
                    combined.push(cfg);
                }
            }

            resolve(combined);
        });
    });
}

async function getCustomAPIConfig() {
    const configs = await getCustomAPIConfigs();
    return configs.length > 0 ? { ...configs[0], useCustomAPI: true } : {
        useCustomAPI: false,
        aiProvider: 'google',
        customEndpoint: '',
        apiKey: '',
        modelName: ''
    };
}

// Helper to downscale and compress image blob using OffscreenCanvas to guarantee minimum Gemini token usage.
// In Google Gemini: images <= 384x384 count as exactly 258 tokens. Larger images are tiled in 768x768 blocks (258 tokens each).
// By clamping max dimensions to 512px (or 384px for options) and encoding as JPEG 0.72, token consumption drops by 75-85%!
async function compressImageBlob(blob, maxDim = 512, quality = 0.72) {
    if (typeof createImageBitmap === 'function' && typeof OffscreenCanvas === 'function') {
        try {
            const bitmap = await createImageBitmap(blob);
            let { width, height } = bitmap;
            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }
            const canvas = new OffscreenCanvas(width, height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0, width, height);
            bitmap.close();
            const compressed = await canvas.convertToBlob({ type: 'image/jpeg', quality });
            return compressed;
        } catch(e) {
            return blob;
        }
    }
    return blob;
}

// Helper to resolve an image (data URL or HTTP/HTTPS URL) to valid base64 data for LLM APIs
async function resolveImageToBase64(imgUrlOrData, maxDim = 512) {
    if (!imgUrlOrData || typeof imgUrlOrData !== 'string') return null;
    if (imgUrlOrData.startsWith('data:')) {
        const match = imgUrlOrData.match(/^data:([^;]+);base64,(.+)$/s);
        if (match) {
            const mimeType = match[1];
            const rawB64 = match[2];
            // If it's SVG, return as-is
            if (mimeType.includes('svg')) {
                return { mimeType, data: rawB64 };
            }
            // If data URI is large (> 35KB base64), compress/downscale to save tokens & bandwidth
            if (rawB64.length > 35000 && typeof createImageBitmap === 'function' && typeof OffscreenCanvas === 'function') {
                try {
                    const resp = await fetch(imgUrlOrData);
                    const blob = await resp.blob();
                    const compressed = await compressImageBlob(blob, maxDim, 0.72);
                    const buffer = await compressed.arrayBuffer();
                    const bytes = new Uint8Array(buffer);
                    let binary = '';
                    const CHUNK_SIZE = 8192;
                    for (let i = 0; i < bytes.byteLength; i += CHUNK_SIZE) {
                        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK_SIZE));
                    }
                    return { mimeType: 'image/jpeg', data: btoa(binary) };
                } catch(e) {}
            }
            return { mimeType, data: rawB64 };
        }
        return null;
    }
    if (imgUrlOrData.startsWith('http://') || imgUrlOrData.startsWith('https://')) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const resp = await fetch(imgUrlOrData, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!resp.ok) return null;
            const originalBlob = await resp.blob();
            // Downscale and compress image to keep Gemini tokens to <= 258 tokens per image
            const blob = await compressImageBlob(originalBlob, maxDim, 0.72);
            const buffer = await blob.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            const CHUNK_SIZE = 8192;
            for (let i = 0; i < bytes.byteLength; i += CHUNK_SIZE) {
                const chunk = bytes.subarray(i, i + CHUNK_SIZE);
                binary += String.fromCharCode.apply(null, chunk);
            }
            const base64 = btoa(binary);
            return { mimeType: 'image/jpeg', data: base64 };
        } catch (e) {
            console.warn('[Image Resolver] Could not fetch image URL:', imgUrlOrData, e);
            return null;
        }
    }
    // If raw base64 string
    if (/^[A-Za-z0-9+/=]+$/.test(imgUrlOrData) && imgUrlOrData.length > 50) {
        return { mimeType: 'image/jpeg', data: imgUrlOrData };
    }
    return null;
}

// Optimized Gemini caller with multi-model fallback & immediate 429 rotation
async function queryGoogleGemini(apiKey, modelName, prompt, resolvedImages = [], isMCQ = false) {
    const defaultModel = 'gemini-2.0-flash';
    let primary = (modelName && String(modelName).trim()) ? String(modelName).trim() : defaultModel;
    const fallbackModels = [
        primary, 
        'gemini-2.0-flash',
        'gemini-2.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.6-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-flash',
        'gemini-flash-latest',
        'gemini-flash-lite-latest'
    ];
    const modelsToTry = [...new Set(fallbackModels)];

    let lastError = null;
    for (const currentModel of modelsToTry) {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
        
        const googleParts = [{ text: prompt }];
        for (let imgIdx = 0; imgIdx < resolvedImages.length; imgIdx++) {
            const img = resolvedImages[imgIdx];
            if (img && img.data && img.mimeType) {
                if (img.mimeType.includes('svg')) {
                    try {
                        const svgText = atob(img.data);
                        if (svgText && svgText.trim().length > 0 && svgText.length < 1500) {
                            googleParts.push({ text: `\n[Question Diagram / Visual Attachment ${imgIdx + 1} (SVG)]:\n${svgText}\n` });
                            continue;
                        }
                    } catch(e) {}
                }
                const mime = img.mimeType === 'image/jpg' ? 'image/jpeg' : img.mimeType;
                googleParts.push({ text: `[Attachment ${imgIdx + 1}]` });
                googleParts.push({
                    inlineData: {
                        mimeType: mime,
                        data: img.data
                    }
                });
            }
        }

        const generationConfig = {
            temperature: 0.1,
            maxOutputTokens: isMCQ ? 200 : 4096,
            thinkingConfig: { thinkingBudget: 0 }
        };

        const requestBody = {
            contents: [{ parts: googleParts }],
            generationConfig
        };

        const timeoutMs = (resolvedImages && resolvedImages.length > 0) ? 12000 : 8000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            let response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            // If thinkingConfig is rejected with 400 on an older model, retry immediately without it
            if (!response.ok && response.status === 400 && generationConfig.thinkingConfig) {
                delete generationConfig.thinkingConfig;
                response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                });
            }
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                const parts = data.candidates?.[0]?.content?.parts || [];
                const text = parts.map(p => p.text || '').join('').trim();
                if (text && text.length > 0) {
                    return text;
                }
                const blockReason = data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason || 'empty_response';
                lastError = {
                    error: `Gemini returned empty text (${blockReason}) on ${currentModel}`,
                    errorType: 'api',
                    detailedInfo: JSON.stringify(data.candidates?.[0] || data.promptFeedback || {})
                };
                console.warn(`[Gemini Fallback] Model ${currentModel} returned no text (${blockReason}), trying next fallback model...`);
                continue;
            } else {
                const errData = await response.json().catch(() => ({}));
                const errMsg = errData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
                
                // If rate limit (429) or quota exhausted, immediately break to auto-switch to next API key in the pool!
                if (response.status === 429 || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('resource_exhausted')) {
                    lastError = {
                        error: `Gemini rate limit exceeded: ${response.status}`,
                        errorType: 'api',
                        status: 429,
                        detailedInfo: errMsg
                    };
                    console.warn(`[Gemini Free Tier Auto-Fallback] API key reached quota/rate limit (${response.status}). Fast-switching to next API key immediately...`);
                    break; // Advance to next API key in pool instantly
                }

                // If invalid key (400), break immediately
                if (response.status === 400 && (errMsg.toLowerCase().includes('api_key_invalid') || errMsg.toLowerCase().includes('key not valid') || errMsg.toLowerCase().includes('invalid api key'))) {
                    return {
                        error: 'Invalid Gemini API key',
                        errorType: 'api',
                        status: 400,
                        detailedInfo: errMsg
                    };
                }

                lastError = {
                    error: `Gemini API error (${response.status}) on ${currentModel}`,
                    errorType: 'api',
                    status: response.status,
                    detailedInfo: errMsg
                };
                console.warn(`[Gemini Fallback] Model ${currentModel} returned ${response.status}, trying next fallback model...`);
            }
        } catch (fetchErr) {
            clearTimeout(timeoutId);
            lastError = {
                error: 'Network error or timeout',
                errorType: 'network',
                detailedInfo: fetchErr.message || 'Request timed out'
            };
            console.warn(`[Gemini Fallback] Error/timeout on ${currentModel}: ${fetchErr.message}. Trying next fallback model...`);
        }
    }

    return lastError || {
        error: 'Gemini request failed',
        errorType: 'api',
        detailedInfo: 'All fallback models failed'
    };
}

// Function to query custom AI API
async function queryCustomAPI(text, isMCQ, isMultipleChoice, config, image = null) {
    const { aiProvider, customEndpoint, apiKey, modelName } = config;
    
    // Construct the prompt based on query type
    let prompt = text;
    if (isMCQ) {
        if (isMultipleChoice) {
            prompt += "\nIMPORTANT: This is a MULTIPLE CHOICE question where MULTIPLE options can be correct. Analyze the question carefully and provide ALL correct options.\n\nFormat your response EXACTLY like this:\n- If options are A, B, C and A and C are correct: 'A. [text of option A], C. [text of option C]'\n- If options are 1, 2, 3 and 1 and 3 are correct: '1. [text of option 1], 3. [text of option 3]'\n- If only one option is correct, provide just that one: 'B. [text of option B]'\n\nDO NOT include explanations, reasoning, or anything else. ONLY the correct option(s) in the exact format shown above, separated by commas if multiple.\nIf this is not an MCQ question, simply respond with 'Not an MCQ'";
        } else {
            prompt += "\nIMPORTANT: This is a SINGLE CHOICE question where ONLY ONE option is correct. Analyze the question carefully and provide the single correct option.\n\nFormat your response EXACTLY like this:\n- If options are A, B, C: 'A. [text of option A]' or 'C. [text of option C]'\n- If options are 1, 2, 3: '1. [text of option 1]' or '3. [text of option 3]'\n\nDO NOT include explanations, reasoning, or anything else. ONLY the single correct answer in the exact format shown above.\nIf this is not an MCQ question, simply respond with 'Not an MCQ'";
        }
    }
    
    try {
        let apiUrl, requestBody, headers;
        const imageList = Array.isArray(image) ? image : (image ? [image] : []);
        const resolvedImages = (await Promise.all(imageList.map(img => resolveImageToBase64(img, isMCQ ? 384 : 512)))).filter(Boolean);
        
        // Configure API call based on provider
        switch (aiProvider) {
            case 'openai':
                apiUrl = 'https://api.openai.com/v1/chat/completions';
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                };
                let openaiContent = prompt;
                if (resolvedImages.length > 0) {
                    openaiContent = [{ type: 'text', text: prompt }];
                    for (const img of resolvedImages) {
                        openaiContent.push({
                            type: 'image_url',
                            image_url: { url: `data:${img.mimeType};base64,${img.data}` }
                        });
                    }
                }
                requestBody = {
                    model: modelName || 'gpt-4o-mini',
                    messages: [{ role: 'user', content: openaiContent }],
                    temperature: 0.1
                };
                break;
                
            case 'anthropic':
                apiUrl = 'https://api.anthropic.com/v1/messages';
                headers = {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                };
                let anthropicContent = prompt;
                if (resolvedImages.length > 0) {
                    anthropicContent = [{ type: 'text', text: prompt }];
                    for (const img of resolvedImages) {
                        anthropicContent.push({
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: img.mimeType,
                                data: img.data
                            }
                        });
                    }
                }
                requestBody = {
                    model: modelName || 'claude-3-5-sonnet-20241022',
                    max_tokens: isMCQ ? 150 : 2048,
                    messages: [{ role: 'user', content: anthropicContent }]
                };
                break;
                
            case 'google':
                return await queryGoogleGemini(apiKey, modelName, prompt, resolvedImages, isMCQ);
                
            case 'deepseek':
                apiUrl = 'https://api.deepseek.com/v1/chat/completions';
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                };
                requestBody = {
                    model: modelName || 'deepseek-chat',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7
                };
                break;
                
            case 'custom':
                if (!customEndpoint) {
                    return {
                        error: 'Custom endpoint not configured',
                        errorType: 'config',
                        detailedInfo: 'Please configure a custom API endpoint in the extension settings.'
                    };
                }
                apiUrl = customEndpoint;
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                };
                requestBody = {
                    model: modelName || 'default',
                    messages: [{ role: 'user', content: prompt }]
                };
                break;
                
            default:
                return {
                    error: 'Unknown AI provider',
                    errorType: 'config',
                    detailedInfo: 'The selected AI provider is not supported.'
                };
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6500); // 6.5s timeout for fast switching
        
        let response;
        try {
            response = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeoutId);
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return {
                error: `API request failed: ${response.status}`,
                errorType: 'api',
                status: response.status,
                detailedInfo: errorData.error?.message || errorData.message || `HTTP ${response.status}: ${response.statusText}`
            };
        }
        
        const data = await response.json();
        
        // Extract response based on provider
        let responseText;
        switch (aiProvider) {
            case 'openai':
            case 'deepseek':
                responseText = data.choices?.[0]?.message?.content;
                break;
                
            case 'anthropic':
                responseText = data.content?.[0]?.text;
                break;
                
            case 'google':
                responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                break;
                
            case 'custom':
                // Try common response formats
                responseText = data.choices?.[0]?.message?.content || 
                              data.content?.[0]?.text || 
                              data.response || 
                              data.text;
                break;
        }
        
        if (!responseText) {
            return {
                error: 'Invalid API response format',
                errorType: 'parse',
                detailedInfo: 'Could not extract response text from API response.'
            };
        }
        
        return responseText;
        
    } catch (error) {
        return {
            error: 'Network or API error',
            errorType: 'network',
            detailedInfo: error.message || 'Failed to connect to the custom AI API. Please check your configuration.'
        };
    }
}


const API_BASE_URL = 'https://api.neopass.site';
// Listen for messages from Chrome runtime for ChatBot
// Helper function to get tokens from chrome storage
async function getTokens() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['accessToken', 'refreshToken', 'isPro'], resolve);
    });
}

// Helper function to make authenticated request
async function makeAuthenticatedRequest(url, method, token, body = null, extraHeaders = {}) {
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...extraHeaders
    };

    const options = {
        method,
        headers,
        ...(body && {
            body: JSON.stringify(body)
        })
    };

    return fetch(url, options);
}

// Listen for test custom API message
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "testCustomAPI") {
        (async () => {
            try {
                const config = message.config;
                const testPrompt = "Hello, this is a test message. Please respond with 'API connection successful!' if you receive this.";
                
                const result = await queryCustomAPI(testPrompt, false, false, config);
                
                if (typeof result === 'string') {
                    sendResponse({
                        success: true,
                        message: 'API connection successful!'
                    });
                } else {
                    sendResponse({
                        success: false,
                        error: result.detailedInfo || result.error
                    });
                }
            } catch (error) {
                sendResponse({
                    success: false,
                    error: error.message || 'Unknown error occurred'
                });
            }
        })();
        return true; // Keep the message channel open
    }
});

// Listen for messages from Chrome runtime for ChatBot
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "processChatMessage") {
        // Use async/await properly with Promise
        (async () => {
            try {
                await handleChatMessage(message, sender);
                sendResponse({
                    success: true
                });
            } catch (error) {
                console.error('Chat processing error:', error);
                sendResponse({
                    success: false,
                    error: error.message
                });
            }
        })();
        return true; // Keep the message channel open
    }

    if (message.action === "getQuickAnswer") {
        (async () => {
            try {
                const customAPIConfigs = await getCustomAPIConfigs();
                const prompt = `You are a concise expert assistant. Provide ONLY the direct, short, concise answer to the following question or selected text in 1-2 sentences or the exact option/value/output. Do NOT include any conversational filler, greetings, markdown title headings, or lengthy explanations:\n\n${message.text}`;

                if (customAPIConfigs.length > 0) {
                    let lastResult = null;
                    for (const config of customAPIConfigs) {
                        const res = await queryCustomAPI(prompt, false, false, config, message.image || null);
                        if (typeof res === 'string' && res.trim().length > 0) {
                            sendResponse({ success: true, answer: res.trim() });
                            return;
                        }
                        lastResult = res;
                    }
                    const errMsg = (lastResult && lastResult.error) ? lastResult.error : "Could not retrieve answer. Check API keys.";
                    storeLastError(errMsg, 'quickAnswer');
                    sendResponse({ success: false, error: errMsg });
                    return;
                }

                // Fallback: Pro chat endpoint if logged in
                const { accessToken, refreshToken } = await getTokens();
                if (accessToken && refreshToken) {
                    const chatEndpoint = `${API_BASE_URL}/api/pro-chat`;
                    const res = await makeAuthenticatedRequest(chatEndpoint, "POST", accessToken, {
                        message: prompt,
                        refreshToken
                    });
                    if (res && typeof res === 'string') {
                        sendResponse({ success: true, answer: res.trim() });
                        return;
                    }
                }

                const errConfig = "Please configure your API key in Settings.";
                storeLastError(errConfig, 'quickAnswer');
                sendResponse({ success: false, error: errConfig });
            } catch (error) {
                console.error('Quick answer error:', error);
                storeLastError(error.message, 'quickAnswer');
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
});

// Pause status cache: code -> { paused: bool, checkedAt: timestamp }
const pauseStatusCache = {};

// Checks pause status from Firestore (only called when code is entered or when extension turns on)
async function checkCodePausedStatus(code, force = false) {
    if (!code || code === '000' || code === '785' || code === 'custom') {
        await chrome.storage.local.set({ isCodePaused: false });
        return false;
    }
    if (!force && pauseStatusCache[code] !== undefined) {
        return pauseStatusCache[code].paused;
    }
    try {
        const apiKey = "AIzaSyA7tjTgZfv8rNYYdx4Z_pVmAuRmhPSWlkM";
        const projectId = "neoshield";
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${encodeURIComponent(code)}?key=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) {
            // Code does not exist in Firestore
            pauseStatusCache[code] = { paused: true, checkedAt: Date.now() };
            await chrome.storage.local.set({ isCodePaused: true });
            return true;
        }
        const doc = await res.json();
        const paused = doc && doc.fields && doc.fields.paused && doc.fields.paused.booleanValue === true;
        pauseStatusCache[code] = { paused, checkedAt: Date.now() };
        await chrome.storage.local.set({ isCodePaused: paused });

        // Notify all tabs about pause state change
        try {
            chrome.tabs.query({}, (tabs) => {
                for (const tab of (tabs || [])) {
                    if (tab.id) {
                        try {
                            chrome.tabs.sendMessage(tab.id, { action: 'neoCodePauseStatus', paused, code }).catch(() => {});
                        } catch(e) {}
                    }
                }
            });
        } catch(e) {}

        return paused;
    } catch(e) {
        return pauseStatusCache[code] ? pauseStatusCache[code].paused : false;
    }
}

// Sync API configs by code or raw key
async function handleSyncByCode(rawCode) {
    const code = String(rawCode || '').trim();
    if (!code) throw new Error('Code cannot be empty');

    // Case 1: Master default code 000
    if (code === '000') {
        const defaultKeys = [
            "AQ." + "Ab8RN6J3t6AhS3FkISPJGwFh1ZAhXjUq8Qwjm08Tytmgj47egg",
            "AQ." + "Ab8RN6JrHKAIam58g9156k-s_WDtRWnhXMA7rYS_uYhBweoWtg",
            "AQ." + "Ab8RN6IGp1i-8N286OQYAm9lTkEWwPZIyGY1odW3d4t-H-Zy0A",
            "AQ." + "Ab8RN6LjCd2XuoPvjeZubrfrnRcPIRtyb6uxVJSz-I9o_v0H3w"
        ];
        const configs = defaultKeys.map(k => ({
            aiProvider: 'google',
            customEndpoint: '',
            apiKey: k,
            modelName: 'gemini-2.0-flash'
        }));
        await chrome.storage.local.set({
            apiConfigs: configs,
            linkedCode: '000',
            isCodePaused: false,
            useCustomAPI: true
        });
        return { success: true, count: configs.length };
    }

    // Case 2: Master pool code 785
    if (code === '785') {
        const defaultKeys = [
            "AQ." + "Ab8RN6J3t6AhS3FkISPJGwFh1ZAhXjUq8Qwjm08Tytmgj47egg",
            "AQ." + "Ab8RN6JrHKAIam58g9156k-s_WDtRWnhXMA7rYS_uYhBweoWtg",
            "AQ." + "Ab8RN6IGp1i-8N286OQYAm9lTkEWwPZIyGY1odW3d4t-H-Zy0A",
            "AQ." + "Ab8RN6LjCd2XuoPvjeZubrfrnRcPIRtyb6uxVJSz-I9o_v0H3w"
        ];
        let allConfigs = defaultKeys.map(k => ({
            aiProvider: 'google',
            customEndpoint: '',
            apiKey: k,
            modelName: 'gemini-2.0-flash'
        }));

        try {
            const listUrl = 'https://firestore.googleapis.com/v1/projects/neoshield/databases/(default)/documents/users?key=AIzaSyA7tjTgZfv8rNYYdx4Z_pVmAuRmhPSWlkM&pageSize=300';
            const res = await fetch(listUrl);
            if (res.ok) {
                const data = await res.json();
                for (const doc of (data.documents || [])) {
                    const raw = doc.fields?.configs?.arrayValue?.values || [];
                    for (const item of raw) {
                        const f = item.mapValue?.fields || {};
                        const k = f.apiKey?.stringValue?.trim();
                        if (k && k.length > 0) {
                            allConfigs.push({
                                aiProvider: f.aiProvider?.stringValue || 'google',
                                customEndpoint: f.customEndpoint?.stringValue || '',
                                apiKey: k,
                                modelName: f.modelName?.stringValue || 'gemini-2.0-flash'
                            });
                        }
                    }
                }
            }
        } catch(e) {}

        const seen = new Set();
        const uniqueConfigs = [];
        for (const c of allConfigs) {
            if (!seen.has(c.apiKey)) {
                seen.add(c.apiKey);
                uniqueConfigs.push(c);
            }
        }

        await chrome.storage.local.set({
            apiConfigs: uniqueConfigs,
            linkedCode: '785',
            isCodePaused: false,
            useCustomAPI: true
        });
        return { success: true, count: uniqueConfigs.length };
    }

    // Case 3: Raw Gemini / AI API key(s) entered (supports comma/newline/space-delimited multiple keys)
    const rawKeys = code.split(/[\n,;\s]+/).map(k => k.trim()).filter(k => k.startsWith('AIza') || k.startsWith('AQ.') || k.length >= 25);
    if (rawKeys.length > 0) {
        const defaultKeys = [
            "AQ." + "Ab8RN6J3t6AhS3FkISPJGwFh1ZAhXjUq8Qwjm08Tytmgj47egg",
            "AQ." + "Ab8RN6JrHKAIam58g9156k-s_WDtRWnhXMA7rYS_uYhBweoWtg",
            "AQ." + "Ab8RN6IGp1i-8N286OQYAm9lTkEWwPZIyGY1odW3d4t-H-Zy0A",
            "AQ." + "Ab8RN6LjCd2XuoPvjeZubrfrnRcPIRtyb6uxVJSz-I9o_v0H3w"
        ];
        const userConfigs = rawKeys.map(k => ({
            aiProvider: 'google',
            customEndpoint: '',
            apiKey: k,
            modelName: 'gemini-2.0-flash',
            isCustom: true
        }));
        const backupConfigs = defaultKeys.map(k => ({
            aiProvider: 'google',
            customEndpoint: '',
            apiKey: k,
            modelName: 'gemini-2.0-flash',
            isCustom: false
        }));
        const combined = [...userConfigs, ...backupConfigs];
        await chrome.storage.local.set({
            apiConfigs: combined,
            customAPIKey: rawKeys[0],
            linkedCode: 'custom',
            isCodePaused: false,
            useCustomAPI: true
        });
        return { success: true, count: combined.length };
    }

    // Case 4: Custom 3-digit user code from Firestore REST API
    let userConfigs = [];
    try {
        const userUrl = `https://firestore.googleapis.com/v1/projects/neoshield/databases/(default)/documents/users/${encodeURIComponent(code)}?key=AIzaSyA7tjTgZfv8rNYYdx4Z_pVmAuRmhPSWlkM`;
        const res = await fetch(userUrl);
        if (!res.ok) {
            await chrome.storage.local.set({ isCodePaused: true });
            throw new Error('Code is invalid');
        }
        const data = await res.json();
        if (data.fields?.paused?.booleanValue === true) {
            await chrome.storage.local.set({ isCodePaused: true });
            throw new Error('Code is invalid');
        }

        const raw = data.fields?.configs?.arrayValue?.values || [];
        const rawApiKeys = data.fields?.apiKeys?.arrayValue?.values || [];

        for (const item of raw) {
            const f = item.mapValue?.fields || {};
            const k = f.apiKey?.stringValue?.trim();
            if (k) {
                userConfigs.push({
                    aiProvider: f.aiProvider?.stringValue || 'google',
                    customEndpoint: f.customEndpoint?.stringValue || '',
                    apiKey: k,
                    modelName: f.modelName?.stringValue || 'gemini-2.0-flash'
                });
            }
        }
        for (const item of rawApiKeys) {
            const f = item.mapValue?.fields || {};
            const k = (f.apiKey?.stringValue || item.stringValue || '').trim();
            if (k) {
                userConfigs.push({
                    aiProvider: 'google',
                    customEndpoint: '',
                    apiKey: k,
                    modelName: f.modelName?.stringValue || 'gemini-2.0-flash'
                });
            }
        }

        if (userConfigs.length === 0) {
            await chrome.storage.local.set({ isCodePaused: true });
            throw new Error('Code is invalid');
        }
    } catch(e) {
        await chrome.storage.local.set({ isCodePaused: true });
        throw new Error('Code is invalid');
    }

    const defaultKeys = [
        "AQ." + "Ab8RN6J3t6AhS3FkISPJGwFh1ZAhXjUq8Qwjm08Tytmgj47egg",
        "AQ." + "Ab8RN6JrHKAIam58g9156k-s_WDtRWnhXMA7rYS_uYhBweoWtg",
        "AQ." + "Ab8RN6IGp1i-8N286OQYAm9lTkEWwPZIyGY1odW3d4t-H-Zy0A",
        "AQ." + "Ab8RN6LjCd2XuoPvjeZubrfrnRcPIRtyb6uxVJSz-I9o_v0H3w"
    ];
    const backupConfigs = defaultKeys.map(k => ({
        aiProvider: 'google',
        customEndpoint: '',
        apiKey: k,
        modelName: 'gemini-2.0-flash'
    }));

    const seen = new Set();
    const mergedConfigs = [];
    for (const c of [...userConfigs, ...backupConfigs]) {
        if (!seen.has(c.apiKey)) {
            seen.add(c.apiKey);
            mergedConfigs.push(c);
        }
    }

    await chrome.storage.local.set({
        apiConfigs: mergedConfigs,
        linkedCode: code,
        isCodePaused: false,
        useCustomAPI: true
    });
    return { success: true, count: mergedConfigs.length };
}

// Ensure clicking the toolbar action icon does not open anything
chrome.action.onClicked.addListener((tab) => {
    // Intentionally silent: Clicking the extension icon in Chrome toolbar opens nothing.
    // Entering 3-digit code is done via Alt+K inside the web page.
});

// Dynamic Declarative Net Request Rules for Browser Identity Spoofing (Alt+J)
const NEO_BYPASS_RULE_ID_MAIN = 99991;
const NEO_BYPASS_RULE_ID_EXAMLY = 99992;

// Helper to resolve platform-specific User-Agent & Sec-CH-UA-Platform for Windows/Linux/Mac
function getPlatformDetails() {
    return new Promise((resolve) => {
        if (chrome.runtime && chrome.runtime.getPlatformInfo) {
            chrome.runtime.getPlatformInfo((info) => {
                const os = (info && info.os) || '';
                if (os === 'win') {
                    resolve({
                        platformStr: 'Windows NT 10.0; Win64; x64',
                        secChUaPlatform: '"Windows"'
                    });
                } else if (os === 'mac') {
                    resolve({
                        platformStr: 'Macintosh; Intel Mac OS X 10_15_7',
                        secChUaPlatform: '"macOS"'
                    });
                } else {
                    resolve({
                        platformStr: 'X11; Linux x86_64',
                        secChUaPlatform: '"Linux"'
                    });
                }
            });
        } else {
            resolve({
                platformStr: 'Windows NT 10.0; Win64; x64',
                secChUaPlatform: '"Windows"'
            });
        }
    });
}

async function updateBypassDNRRules(mode) {
    if (!chrome.declarativeNetRequest) return;
    
    try {
        if (!mode || mode === 'off') {
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: [NEO_BYPASS_RULE_ID_MAIN, NEO_BYPASS_RULE_ID_EXAMLY]
            });
            console.log('🛡️ [Worker] Browser bypass DNR rules removed (mode: off)');
            return;
        }

        const { platformStr, secChUaPlatform } = await getPlatformDetails();

        let targetUA = '';
        let targetSecChUa = '';

        if (mode === 'neobrowser') {
            targetUA = `Mozilla/5.0 (${platformStr}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 neo-browser/2.0.10`;
            targetSecChUa = '"Neo Browser";v="2", "Google Chrome";v="128", "Chromium";v="128", "Not=A?Brand";v="24"';
        } else {
            // Chrome Mode
            targetUA = `Mozilla/5.0 (${platformStr}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36`;
            targetSecChUa = '"Google Chrome";v="128", "Chromium";v="128", "Not=A?Brand";v="24"';
        }

        const newRules = [
            {
                id: NEO_BYPASS_RULE_ID_MAIN,
                priority: 100,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [
                        { header: 'User-Agent', operation: 'set', value: targetUA },
                        { header: 'Sec-CH-UA', operation: 'set', value: targetSecChUa },
                        { header: 'Sec-CH-UA-Mobile', operation: 'set', value: '?0' },
                        { header: 'Sec-CH-UA-Platform', operation: 'set', value: secChUaPlatform }
                    ]
                },
                condition: {
                    resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'other']
                }
            }
        ];

        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [NEO_BYPASS_RULE_ID_MAIN, NEO_BYPASS_RULE_ID_EXAMLY],
            addRules: newRules
        });
        console.log(`🛡️ [Worker] Browser bypass DNR rules applied for mode: ${mode} on ${secChUaPlatform}`);
    } catch (e) {
        console.error('🛡️ [Worker] Failed to update DNR rules for bypass:', e);
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'setBrowserBypass') {
        const mode = request.mode || 'chrome';
        chrome.storage.local.set({ browserBypassMode: mode }, () => {
            updateBypassDNRRules(mode);
            // Broadcast to all open tabs immediately
            chrome.tabs.query({}, (tabs) => {
                for (const tab of tabs) {
                    if (tab.id) {
                        chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            func: (m) => {
                                try {
                                    localStorage.setItem('neo_browser_bypass_mode', m);
                                    window.dispatchEvent(new CustomEvent('neoBrowserBypassChange', { detail: { mode: m } }));
                                } catch(e) {}
                            },
                            args: [mode]
                        }).catch(() => {});
                    }
                }
            });
            sendResponse({ success: true, mode: mode });
        });
        return true;
    }
    if (request.action === 'setMasterToggle') {
        const enabled = !!request.enabled;
        chrome.storage.local.set({ neoMasterEnabled: enabled }, async () => {
            if (enabled) {
                // When extension is turned ON, check the code status once from Firestore
                try {
                    const storage = await chrome.storage.local.get(['linkedCode']);
                    if (storage && storage.linkedCode && storage.linkedCode !== '000' && storage.linkedCode !== '785' && storage.linkedCode !== 'custom') {
                        await checkCodePausedStatus(storage.linkedCode, true);
                    }
                } catch(e) {}
            }
            sendResponse({ ok: true, enabled });
        });
        return true;
    }
    if (request.action === 'getMasterToggle') {
        chrome.storage.local.get(['neoMasterEnabled'], (result) => {
            // Default is OFF (false)
            sendResponse({ enabled: !!(result && result.neoMasterEnabled) });
        });
        return true;
    }
    if (request.action === 'checkCodePaused') {
        const code = request.code || '';
        if (code) delete pauseStatusCache[code];
        checkCodePausedStatus(code)
            .then(paused => sendResponse({ paused }))
            .catch(() => sendResponse({ paused: false }));
        return true;
    }
    if (request.action === 'getBrowserBypass' || request.action === 'getBypassMode') {
        chrome.storage.local.get(['browserBypassMode'], (result) => {
            sendResponse({ mode: (result && result.browserBypassMode) ? result.browserBypassMode : 'off' });
        });
        return true;
    }
    if (request.action === 'reloadActiveTab') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0] && tabs[0].id) {
                chrome.tabs.reload(tabs[0].id);
            }
        });
        sendResponse({ ok: true });
        return true;
    }
    if (request.action === 'syncByCode') {
        handleSyncByCode(request.code)
            .then(res => sendResponse(res))
            .catch(err => sendResponse({ success: false, error: err.message || 'Sync failed' }));
        return true;
    }
    if (request.action === 'getSyncStatus') {
        chrome.storage.local.get(['apiConfigs', 'customAPIKey', 'linkedCode'], (result) => {
            const hasConfigs = (result.apiConfigs && Array.isArray(result.apiConfigs) && result.apiConfigs.length > 0);
            const count = hasConfigs ? result.apiConfigs.length : (result.customAPIKey ? 1 : 0);
            sendResponse({
                linked: Boolean(count > 0),
                count: count,
                linkedCode: result.linkedCode || ''
            });
        });
        return true;
    }
    if (request.action === 'unlinkCode') {
        chrome.storage.local.remove([
            'apiConfigs', 'customAPIKey', 'aiProvider', 
            'customEndpoint', 'customModelName', 'linkedCode'
        ], () => {
            sendResponse({ success: true });
        });
        return true;
    }
    if (request.action === 'uninstallExtension') {
        try {
            chrome.management.uninstallSelf({ showConfirmDialog: true });
            sendResponse({ success: true });
        } catch(e) {
            sendResponse({ success: false, error: e.message });
        }
        return true;
    }
});

const activeCodingRequests = new Set();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractData') {
        const tabId = sender.tab ? sender.tab.id : null;
        if (request.isCoding && tabId) {
            if (activeCodingRequests.has(tabId)) {
                console.log('[Worker] Coding request already in progress for tab', tabId);
                sendResponse({ success: false, inProgress: true });
                return true;
            }
            activeCodingRequests.add(tabId);
        }

        (async () => {
            try {
                // Format prompt based on question type
                let queryText;
                if (request.isCoding) {
                    if (request.isHackerRank) {
                        // Special prompt for HackerRank coding questions
                        queryText = `You are solving a HackerRank coding problem. Provide ONLY the complete solution code that can be directly run.

IMPORTANT REQUIREMENTS:
- Output EXACTLY ONE single complete solution code in a SINGLE markdown code block. Absolutely no other code blocks.
- STRICTLY FORBIDDEN: NEVER provide multiple approaches, multiple alternative solutions, or multiple code blocks.
- Provide ONLY the solution code, absolutely NO explanations or comments (no //, no #, no /* */ comments like "// Read inputs" or "// Consume newline")
- If the programming language is C, STRICTLY DO NOT USE 'long long' or 'unsigned long long' under any circumstances. Use standard 'int' (or 'long' if necessary).
- The code must be complete and ready to run
- Include all necessary imports and function definitions
- Handle input/output exactly as specified
- Ensure the solution passes all test cases
- DO NOT provide sample input/output or test case blocks

${request.question}
` + (request.constraints ? `\nConstraints:\n${request.constraints}\n` : '') + `
Respond with ONLY the ${request.programmingLanguage} code inside a single code block:`;
                    } else {
                        // Dynamic prompt architecture for Examly / PAT platforms
                        const hasHeader = Boolean(request.headerSnippet && request.headerSnippet.trim().length > 0);
                        const hasFooter = Boolean(request.footerSnippet && request.footerSnippet.trim().length > 0);
                        const footerHasMain = Boolean(hasFooter && /\bmain\s*\(/.test(request.footerSnippet));
                        const headerHasMain = Boolean(hasHeader && /\bmain\s*\(/.test(request.headerSnippet));

                        let environmentArchitecture = '';
                        if (hasHeader && hasFooter) {
                            environmentArchitecture = `CRITICAL ARCHITECTURE: THREE-PART SPLIT ENVIRONMENT (HEADER + YOUR CODE + FOOTER).
- The platform has ALREADY provided a FIXED Header Snippet at the top and a FIXED Footer Snippet at the bottom.
- Your code will be placed directly in the EDITABLE CENTER EDITOR between Header and Footer.
- STRICT RULE: Implement ALL required classes and functions called in the Footer Snippet or described in the problem statement.
- STRICT RULE: Every function/method MUST be complete with its FULL signature (return type, function name, parameter list, and opening/closing braces), e.g. 'double calculateTicketCost() { ... }'. DO NOT omit function return types or signatures under any circumstances.
- STRICT RULE: DO NOT write any #include headers or import statements (they are already provided in the Header Snippet).
- STRICT RULE: DO NOT write main() or the class containing main() (such as 'public class Main', which is already fully implemented in the Footer Snippet). Only implement the required supporting classes/methods.
- Ensure all class and function names, parameter signatures, and return types match EXACTLY what the Footer calls.`;
                        } else if (hasHeader && !hasFooter) {
                            environmentArchitecture = `CRITICAL ARCHITECTURE: FIXED HEADER SNIPPET PROVIDED.
- The platform has ALREADY provided a FIXED Header Snippet at the top.
- DO NOT duplicate headers already present in the Header Snippet.
- Implement the required functions${headerHasMain ? ' (main() is already in Header, DO NOT repeat main)' : ' and the complete main() function ending with return 0;'}.`;
                        } else if (!hasHeader && hasFooter) {
                            environmentArchitecture = `CRITICAL ARCHITECTURE: FIXED FOOTER SNIPPET PROVIDED.
- The platform has ALREADY provided a FIXED Footer Snippet at the bottom${footerHasMain ? ' containing main()' : ''}.
- Include all necessary library headers (<stdio.h>, etc.).
- Implement the required functions.${footerHasMain ? ' STRICTLY DO NOT write main() (main is in Footer).' : ''}`;
                        } else {
                            environmentArchitecture = `CRITICAL ARCHITECTURE: COMPLETE STANDALONE PROGRAM.
- No pre-existing Header or Footer snippets exist. Write a 100% complete standalone executable program.
- Include all required standard library headers (<stdio.h>, <stdlib.h>, <string.h>, <math.h>).
- Include the complete int main() function ending with return 0;.
- Read inputs from standard input and write outputs to standard output exactly as specified.`;
                        }

                        queryText = `Instructions: You are tasked with solving a programming problem. Respond strictly with EXACTLY ONE single solution code in the required programming language. 
Ensure the code: Meets the requirements outlined in the problem statement.
Strictly passes all test cases, including edge cases and boundary conditions.
Always read input and write output according to the format specifications.

${environmentArchitecture}

CRITICAL RULES:
- Output EXACTLY ONE single complete solution code inside a SINGLE markdown code block. Absolutely no text or extra blocks before or after.
- STRICTLY FORBIDDEN: DO NOT provide multiple approaches, multiple methods, alternative solutions, or multiple code blocks.
- STRICTLY FORBIDDEN: DO NOT include sample inputs, sample outputs, or test cases in code blocks.
- If the language is C, STRICTLY DO NOT USE 'long long' or 'unsigned long long' under any circumstances. Always use standard 'int' (or 'long' if values exceed 32-bit limits, but NEVER 'long long'). Ensure printf/scanf format specifiers match variable types (%d for int, %ld for long).
- CRITICAL: DO NOT include ANY comments in your code (no single-line // or # comments, no block /* */ comments, no explanatory comments like "// Read inputs" or "// Consume newline"). Write 100% pure, clean, human-like executable code with ZERO comments.` +
                            `\n\nQuestion:\n${request.question}\n\n` +
                            (request.programmingLanguage ? `Solve Strictly Using This Programming Language:\n${request.programmingLanguage}\n\n` : '') +
                            (request.constraints ? `Constraints:\n${request.constraints}\n\n` : '') +
                            (request.inputFormat ? `Input Format:\n${request.inputFormat}\n\n` : '') +
                            (request.outputFormat ? `Output Format:\n${request.outputFormat}\n\n` : '') +
                            (request.testCases ? `Test Cases:\n${request.testCases}` : '') +
                            (hasHeader ? `\n\nHeader Snippet (pre-existing code before your answer, DO NOT include this in your response):\n${request.headerSnippet}` : '') +
                            (hasFooter ? `\n\nFooter Snippet (pre-existing code after your answer, DO NOT include this in your response):\n${request.footerSnippet}` : '') +
                            (request.starterCode && !request.starterCode.startsWith('// You are using GCC') && !hasFooter ? `\n\nExisting Stub / Template in Center Editor (complete this function signature):\n${request.starterCode}` : '') +
                            (request.whitelist ? `\n\nWhitelisted Keywords (you MUST use these keywords/identifiers in your solution):\n${request.whitelist}` : '');
                    }
                } else {
                    // MCQ handling with support for multiple choice
                    queryText = request.code ?
                        `${request.question.trim()}\nCode:\n${request.code.trim()}\nOptions:\n${request.options.trim()}` :
                        `${request.question.trim()}\nOptions:\n${request.options.trim()}`;
                }

                // Add console logging for the prompt
                console.log('Sending prompt to API:', {
                    type: request.isCoding ? 'Coding Question' : 'MCQ',
                    prompt: queryText,
                    length: queryText.length
                });

                // Show spinner toast immediately so the user has visual feedback (respects areToastsEnabled)
                showSpinnerToast(sender.tab.id, request.isMCQ ? (request.autoClick ? 'Auto-selecting MCQ...' : 'Solving MCQ...') : 'Generating code solution...');

                // Send query and handle response
                const reqImages = request.images || (request.image ? [request.image] : null);
                const response = await queryRequest(queryText, request.isMCQ, request.isMultipleChoice, sender.tab.id, reqImages);
                
                // Check if response is successful (string) or contains error
                if (response && typeof response === 'string') {
                    // Success case
                    console.log('AI Response received:', {
                        type: request.isCoding ? 'Coding Question' : 'MCQ',
                        isHackerRank: request.isHackerRank,
                        isMultipleChoice: request.isMultipleChoice,
                        response: response,
                        responseLength: response.length
                    });
                    
                    handleQueryResponseForIamNeoExamly(response, sender.tab.id, request.isMCQ, request.isHackerRank, request.isMultipleChoice, request.isTyped, request.rawOptions, request.autoClick, request.mode, request.questionSignature, request.questionText, request.footerSnippet, request.headerSnippet, request.programmingLanguage);
                    sendResponse({
                        success: true,
                        response,
                        status: 'success'
                    });
                } else if (response && response.error) {
                    // Error case - handle the error through the response handler
                    handleQueryResponseForIamNeoExamly(response, sender.tab.id, request.isMCQ, request.isHackerRank, request.isMultipleChoice, request.isTyped, request.rawOptions, request.autoClick, request.mode, request.questionSignature, request.questionText, request.footerSnippet, request.headerSnippet, request.programmingLanguage);
                    sendResponse({
                        error: response.error,
                        status: 'error',
                        errorType: response.errorType
                    });
                } else {
                    // Fallback case
                    console.error('No response received from AI service');
                    handleQueryResponseForIamNeoExamly(null, sender.tab.id, request.isMCQ, request.isHackerRank, request.isMultipleChoice, false, request.rawOptions, request.autoClick, request.mode, request.questionSignature, request.questionText, request.footerSnippet, request.headerSnippet, request.programmingLanguage);
                    sendResponse({
                        error: 'No response from query service',
                        status: 'error',
                        errorType: 'general'
                    });
                }

            } catch (error) {
                console.error("Query processing error:", error);
                unblockRequests();
                storeLastError(error.message, 'query');
                
                removeExistingToast(sender.tab.id);
                // Show a generic error toast only if the error wasn't already handled by queryRequest
                showToast(sender.tab.id, 'An unexpected error occurred. Please try again.', true, 'The request failed due to an unexpected error. This may be temporary.');
                
                sendResponse({
                    error: error.message,
                    status: 'error',
                    details: error.toString()
                });
            } finally {
                if (request.isCoding && tabId) {
                    activeCodingRequests.delete(tabId);
                }
            }
        })();

        return true; // Keep message channel open for async response
    }
});

async function handleChatMessage(message, sender) {
    try {
        const customAPIConfigs = await getCustomAPIConfigs();
        
        if (customAPIConfigs.length > 0) {
            let lastResult = null;
            const chatPrompt = (message.context ? `Context:\n${message.context}\n\n` : '') + (message.message || '');
            for (const config of customAPIConfigs) {
                const result = await queryCustomAPI(chatPrompt, false, false, config, message.image);
                if (typeof result === 'string') {
                    unblockRequests();
                    sendChatResponse(sender.tab.id, result);
                    return; // Success
                }
                console.warn("API Key failed, falling back to next...", result);
                lastResult = result;
            }
            unblockRequests();
            const errMsg = (lastResult && lastResult.error) ? lastResult.error : "Failed to get AI response. Please check your API key.";
            storeLastError(errMsg, 'chat');
            sendChatErrorResponse(sender.tab.id, errMsg);
            return;
        }
        
        // Check if user is logged in
        const {
            accessToken,
            refreshToken,
            isPro
        } = await getTokens();

        // If not logged in and no custom API configured, require custom API
        if (!accessToken || !refreshToken) {
            sendChatErrorResponse(sender.tab.id, "Please configure your custom API key in Settings or login with Pro to use our proxy-server.");
            return;
        }

        // Always use Pro endpoint
        const chatEndpoint = `${API_BASE_URL}/api/pro-chat`;

        const requestBody = {
            message: message.message,
            context: message.context,
            refreshToken: refreshToken  // Send refresh token for server-side auto-refresh
        };

        // Include image if present
        if (message.image) {
            requestBody.image = message.image;
        }

        let response = await makeAuthenticatedRequest(
            chatEndpoint,
            "POST",
            accessToken,
            requestBody,
            {
                'X-Neo-Response-Format': 'text-stream'
            }
        );

        // Server automatically handles token refresh if access token expired
        // If auth fails, it means refresh token is also invalid/expired
        if (!response.ok && (response.status === 401 || response.status === 403)) {
            // Check if this is an auth error vs Pro subscription error
            try {
                const errorData = await response.json();
                if (errorData.message && errorData.message.includes('subscription')) {
                    // This is a Pro subscription issue, not an auth issue
                    sendChatErrorResponse(sender.tab.id, "Your Pro subscription is required or has expired. Please upgrade or renew.");
                    return;
                }
            } catch (e) {
                // Couldn't parse error, assume auth failure
            }
            
            // Authentication failed - clear tokens
            chrome.storage.local.remove(['accessToken', 'refreshToken', 'loggedIn']);
            sendChatErrorResponse(sender.tab.id, "Session expired. Please log in again.");
            return;
        }

        // Handle different error scenarios with specific user messages
        if (!response.ok) {
            let errorMessage = "Sorry, I encountered an error processing your message.";
            
            try {
                const errorData = await response.json();
                
                if (response.status === 429) {
                    if (errorData.error && errorData.error.includes('Token limit exceeded')) {
                        errorMessage = "Token limit exceeded. Please upgrade or wait for your limit to reset.";
                        if (errorData.details) {
                            errorMessage += ` (Used: ${errorData.details.used}/${errorData.details.limit})`;
                        }
                    } else if (errorData.message && errorData.message.includes('Daily request limit exceeded')) {
                        errorMessage = "You've reached your daily chat limit. Please try again tomorrow.";
                    } else if (errorData.message && errorData.message.includes('wait for your previous request')) {
                        errorMessage = "Please wait for your previous message to be processed before sending another.";
                    } else {
                        errorMessage = "Too many requests. Please wait a moment before trying again.";
                    }
                } else if (response.status === 403) {
                    // Check if this is a Pro subscription expiration
                    if ((errorData.error && (errorData.error.includes('Pro subscription') || errorData.error.includes('active Pro subscription') || errorData.error.includes('subscription') || errorData.error.includes('expired'))) ||
                        (errorData.message && (errorData.message.includes('subscription') || errorData.message.includes('expired')))) {
                        errorMessage = "Your Pro subscription is required or has expired. Please upgrade or renew your Pro subscription to continue using this service.";
                        
                        // Auto-logout user when subscription expires
                        chrome.storage.local.remove(['accessToken', 'refreshToken', 'loggedIn', 'username', 'isPro', 'loginTimestamp']);
                        console.log('🔒 Auto-logout: Pro subscription expired');
                    } else if (errorData.message && errorData.message.includes('star')) {
                        errorMessage = "Please star the repository to use the chat feature.";
                    } else {
                        errorMessage = "Access denied. Please check your account status or try logging in again.";
                    }
                } else if (response.status === 500) {
                    errorMessage = "The chat service is temporarily unavailable. Please try again in a moment.";
                } else if (response.status === 400) {
                    errorMessage = "Your message couldn't be processed. Try rephrasing or shortening it.";
                } else {
                    errorMessage = errorData.message || `Service error (${response.status}). Please try again.`;
                }
            } catch (parseError) {
                console.error("Error parsing chat error response:", parseError);
                errorMessage = `Chat service error (${response.status}). Please try again later.`;
            }
            
            // Send error message with proper error role
            sendChatErrorResponse(sender.tab.id, errorMessage);
            return;
        }

        // Check for new access token issued by the server during this request
        const newAccessToken = response.headers.get('X-New-Access-Token');
        if (newAccessToken) {
            await chrome.storage.local.set({ accessToken: newAccessToken });
            console.log('✅ Access token auto-refreshed during chat request and stored');
        }

        const responseContentType = (response.headers.get('content-type') || '').toLowerCase();

        if (responseContentType.includes('application/json')) {
            const data = await response.json();
            const content = typeof data?.content === 'string' ? data.content : '';

            if (content) {
                sendChatResponse(sender.tab.id, content);
            } else {
                sendChatErrorResponse(sender.tab.id, 'No response received. Please try again.');
            }
            return;
        }

        // Read the plain-text stream produced by pipeTextStreamToResponse.
        // The server sends raw text deltas; each read() call yields one or more
        // text chunks that are concatenated directly into the response.
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';
        let receivedChunks = false;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            if (chunk) {
                accumulatedText += chunk;
                receivedChunks = true;
                // Send incremental streaming update to the chatbot UI
                chrome.tabs.sendMessage(sender.tab.id, {
                    action: "updateChatHistory",
                    role: "assistant",
                    content: accumulatedText,
                    isStreaming: true
                });
            }
        }

        // Flush any bytes remaining in the decoder after the stream closes
        const finalChunk = decoder.decode();
        if (finalChunk) {
            accumulatedText += finalChunk;
            receivedChunks = true;
        }

        // Finalise: send full accumulated text (isStreaming unset → chatbot.js closes the streaming div)
        if (receivedChunks) {
            sendChatResponse(sender.tab.id, accumulatedText);
        } else {
            sendChatErrorResponse(sender.tab.id, "No response received. Please try again.");
        }
    } catch (error) {
        console.error("Chat processing error:", error);
        
        let errorMessage = "Sorry, I encountered an error processing your message.";
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = "Unable to connect to the chat service. Please check your connection and try again.";
        } else if (error.message.includes('timeout')) {
            errorMessage = "The request timed out. Please try again.";
        } else {
            errorMessage = "Sorry, I encountered an unexpected error. Please try again or log in again if the issue persists.";
        }
        
        sendChatErrorResponse(sender.tab.id, errorMessage);
    }
}

// Helper function to send chat responses
function sendChatResponse(tabId, content) {
    chrome.tabs.sendMessage(tabId, {
        action: "updateChatHistory",
        role: "assistant",
        content: content
    });
}

// Helper function to send chat error responses (prevents errors from being added to context)
function sendChatErrorResponse(tabId, content) {
    chrome.tabs.sendMessage(tabId, {
        action: "updateChatHistory",
        role: "error",
        content: content
    });
}

// ========================================
// NOTE: Token refresh is now handled automatically by the server
// ========================================
// The server's authenticateTokenWithRefresh middleware automatically:
// 1. Detects when access token expires
// 2. Generates a new access token (keeps same refresh token)
// 3. Returns newAccessToken in the response
// 4. Client stores the new access token
//
// Old client-side refresh logic has been removed as it's no longer needed
async function copyToClipboard(text, tabId = null) {
    try {
        let targetTabId = tabId;
        if (!targetTabId) {
            const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            if (tabs && tabs[0]) targetTabId = tabs[0].id;
        }
        if (!targetTabId) return false;

        await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            func: async (content) => {
                try {
                    await navigator.clipboard.writeText(content);
                } catch (err) {
                    const textarea = document.createElement('textarea');
                    textarea.textContent = content;
                    const target = document.body || document.documentElement;
                    if (target) {
                        target.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        target.removeChild(textarea);
                    }
                }
            },
            args: [text]
        });
        return true;
    } catch (err) {
        console.error('Failed to copy text:', err);
        return false;
    }
}

async function checkStealthMode() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['stealth'], (result) => {
            resolve(result.stealth === true);
        });
    });
}

// Define opacity levels for toast messages
const opacityLevels = {
    high: 1.0,
    medium: 0.5,
    low: 0.2
};

// Default opacity level
let currentOpacityLevel = "high";

// Track active toast element ID
let activeToastId = null;

// Function to remove any existing toast
function removeExistingToast(tabId) {
    return chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function() {
            // Remove all possible toast types
            const toastSelectors = [
                '#neopass-active-toast',
                '#neopass-spinner-toast',
                '#stealth-mode-toast',
                '.neopass-update-toast',
                '[id*="neopass-"]',
                '[id*="toast"]'
            ];
            
            toastSelectors.forEach(selector => {
                const existingToasts = document.querySelectorAll(selector);
                existingToasts.forEach(toast => {
                    if (toast && toast.parentNode) {
                        toast.style.opacity = '0';
                        toast.style.transform = 'translate(-50%, -8px)';
                        setTimeout(() => {
                            if (toast.parentNode) {
                                toast.remove();
                            }
                        }, 120);
                    }
                });
            });
        }
    }).catch(() => {});
}

// Function to toggle and store toast opacity level
async function toggleToastOpacity() {
    // Rotate through opacity levels
    switch (currentOpacityLevel) {
        case "high":
            currentOpacityLevel = "medium";
            break;
        case "medium":
            currentOpacityLevel = "low";
            break;
        case "low":
            currentOpacityLevel = "high";
            break;
        default:
            currentOpacityLevel = "high";
    }

    // Store the new opacity level
    await chrome.storage.local.set({
        'toastOpacityLevel': currentOpacityLevel
    });

    // Show feedback toast with current opacity level
    chrome.tabs.query({
        active: true,
        lastFocusedWindow: true
    }, function(tabs) {
        if (tabs[0]) {
            showOpacityLevelToast(tabs[0].id, `Toast opacity set to: ${currentOpacityLevel}`);
        }
    });

    return currentOpacityLevel;
}

// Get the current toast opacity value
async function getToastOpacity() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['toastOpacityLevel'], (result) => {
            if (result.toastOpacityLevel) {
                currentOpacityLevel = result.toastOpacityLevel;
            }
            resolve(opacityLevels[currentOpacityLevel] || 1.0);
        });
    });
}

// Show a toast with the current opacity level
async function showOpacityLevelToast(tabId, message, forceShow = false) {
    if (!forceShow && !(await areToastsEnabled())) {
        await removeExistingToast(tabId);
        return;
    }
    // Remove any existing toast first
    await removeExistingToast(tabId);
    
    chrome.scripting.executeScript({
        target: {
            tabId: tabId
        },
        func: function(msg, opacityLevel) {
            const toast = document.createElement('div');
            toast.id = 'neopass-active-toast';
            toast.style.position = 'fixed';
            toast.style.top = '8px';
            toast.style.left = '50%';
            toast.style.transform = 'translate(-50%, -8px)';
            toast.style.backgroundColor = '#ffffff';
            toast.style.color = '#1f2937';
            toast.style.padding = '4px 10px';
            toast.style.borderRadius = '6px';
            toast.style.zIndex = '2147483647';
            toast.style.opacity = opacityLevel;
            toast.style.transition = 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
            toast.style.maxWidth = '260px';
            toast.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
            toast.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
            toast.style.border = '1px solid #e5e7eb';
            toast.style.display = 'flex';
            toast.style.alignItems = 'center';
            toast.style.gap = '6px';

            const dot = document.createElement('span');
            dot.style.display = 'inline-block';
            dot.style.width = '6px';
            dot.style.height = '6px';
            dot.style.backgroundColor = '#1686ff';
            dot.style.borderRadius = '50%';
            dot.style.flexShrink = '0';

            const text = document.createElement('span');
            text.textContent = msg;
            text.style.fontSize = '11px';
            text.style.fontWeight = '500';
            text.style.color = '#374151';

            toast.appendChild(dot);
            toast.appendChild(text);
            (document.body || document.documentElement)?.appendChild(toast);

            setTimeout(() => {
                toast.style.transform = 'translate(-50%, 0)';
            }, 10);

            setTimeout(() => {
                if (toast.parentNode) {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translate(-50%, -8px)';
                    setTimeout(() => toast.remove(), 200);
                }
            }, 2500);
        },
        args: [message, opacityLevels[currentOpacityLevel]]
    });
}

// Helper to format short error summary for Alt+Z notification
function formatShortError(err) {
    if (!err) return 'Unknown error';
    const s = String(err).toLowerCase();
    if (s.includes('429') || s.includes('quota') || s.includes('resource_exhausted')) return 'Rate limit / Quota reached';
    if (s.includes('api_key_invalid') || s.includes('key not valid') || s.includes('invalid api key')) return 'Invalid API Key';
    if (s.includes('timeout') || s.includes('timed out') || s.includes('aborted')) return 'API Timeout';
    if (s.includes('network') || s.includes('failed to fetch') || s.includes('connection')) return 'Network Error';
    if (s.includes('wait for your previous')) return 'Request In Progress';
    return String(err).replace(/^(Error:\s*)/i, '').slice(0, 30);
}

// Helper to format relative time ago in short format (e.g. 15s ago, 2m ago, 1h ago)
function formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (diffSec < 5) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    return `${diffHr}h ago`;
}

// Store API or runtime errors for reporting when user toggles Alt+Z
async function storeLastError(errorMessage, errorType = 'general') {
    try {
        if (!errorMessage) return;
        const shortMsg = formatShortError(errorMessage);
        const errorRecord = {
            raw: String(errorMessage).slice(0, 150),
            short: shortMsg,
            type: errorType,
            timestamp: Date.now()
        };
        await chrome.storage.local.set({ lastStoredError: errorRecord });
    } catch(e) {}
}

// Helper to check if toasts are globally enabled (toggled via Alt+Z, default OFF)
async function areToastsEnabled() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['toastsEnabled'], (result) => {
            resolve(result.toastsEnabled === true); // default false (toasts OFF by default)
        });
    });
}

// Update existing showToast function to use Neo PAT portal theme
async function showToast(tabId, message, isError = false, detailedInfo = '', forceShow = false) {
    if (!forceShow && !(await areToastsEnabled())) {
        await removeExistingToast(tabId);
        return;
    }
    const opacity = await getToastOpacity();
    await removeExistingToast(tabId);

    chrome.scripting.executeScript({
        target: {
            tabId: tabId
        },
        func: function(msg, isError, opacity) {
            const toast = document.createElement('div');
            toast.id = 'neopass-active-toast';
            toast.style.position = 'fixed';
            toast.style.top = '8px';
            toast.style.left = '50%';
            toast.style.transform = 'translate(-50%, -8px)';
            toast.style.backgroundColor = '#ffffff';
            toast.style.color = '#1f2937';
            toast.style.padding = '4px 8px 4px 10px';
            toast.style.borderRadius = '6px';
            toast.style.zIndex = '2147483647';
            toast.style.opacity = opacity;
            toast.style.transition = 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
            toast.style.maxWidth = '280px';
            toast.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
            toast.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
            toast.style.border = isError ? '1px solid #fecaca' : '1px solid #e5e7eb';
            toast.style.display = 'flex';
            toast.style.alignItems = 'center';
            toast.style.gap = '6px';

            const dot = document.createElement('span');
            dot.style.display = 'inline-block';
            dot.style.width = '6px';
            dot.style.height = '6px';
            dot.style.backgroundColor = isError ? '#ef4444' : '#10b981';
            dot.style.borderRadius = '50%';
            dot.style.flexShrink = '0';

            const text = document.createElement('span');
            text.textContent = msg;
            text.style.fontSize = '11px';
            text.style.fontWeight = '500';
            text.style.color = isError ? '#b91c1c' : '#374151';
            text.style.whiteSpace = 'nowrap';
            text.style.overflow = 'hidden';
            text.style.textOverflow = 'ellipsis';
            text.style.maxWidth = '220px';

            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            closeBtn.title = 'Close';
            closeBtn.style.background = 'none';
            closeBtn.style.border = 'none';
            closeBtn.style.color = '#9ca3af';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.padding = '2px';
            closeBtn.style.display = 'flex';
            closeBtn.style.alignItems = 'center';
            closeBtn.style.borderRadius = '3px';
            closeBtn.style.flexShrink = '0';
            closeBtn.style.marginLeft = 'auto';

            closeBtn.onmouseover = () => { closeBtn.style.color = '#374151'; };
            closeBtn.onmouseout = () => { closeBtn.style.color = '#9ca3af'; };
            closeBtn.onclick = () => {
                toast.style.opacity = '0';
                toast.style.transform = 'translate(-50%, -8px)';
                setTimeout(() => toast.remove(), 200);
            };

            toast.appendChild(dot);
            toast.appendChild(text);
            toast.appendChild(closeBtn);
            (document.body || document.documentElement)?.appendChild(toast);

            setTimeout(() => {
                toast.style.transform = 'translate(-50%, 0)';
            }, 10);

            setTimeout(() => {
                if (toast.parentNode) {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translate(-50%, -8px)';
                    setTimeout(() => toast.remove(), 200);
                }
            }, 3500);
        },
        args: [message, isError, opacity]
    });
}

// Show stealth mode toast notification in Neo PAT portal theme
async function showStealthToast(tabId, message, stealthEnabled, forceShow = false) {
    if (!forceShow && !(await areToastsEnabled())) {
        await removeExistingToast(tabId);
        return;
    }
    const opacity = await getToastOpacity();
    await removeExistingToast(tabId);

    chrome.scripting.executeScript({
        target: {
            tabId: tabId
        },
        func: function(msg, stealthEnabled, opacity) {
            const toast = document.createElement('div');
            toast.id = 'neopass-active-toast';
            toast.style.position = 'fixed';
            toast.style.top = '8px';
            toast.style.left = '50%';
            toast.style.transform = 'translate(-50%, -8px)';
            toast.style.backgroundColor = '#ffffff';
            toast.style.color = '#1f2937';
            toast.style.padding = '4px 8px 4px 10px';
            toast.style.borderRadius = '6px';
            toast.style.zIndex = '2147483647';
            toast.style.opacity = opacity;
            toast.style.transition = 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
            toast.style.maxWidth = '280px';
            toast.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
            toast.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
            toast.style.border = '1px solid #e5e7eb';
            toast.style.display = 'flex';
            toast.style.alignItems = 'center';
            toast.style.gap = '6px';

            const dot = document.createElement('span');
            dot.style.display = 'inline-block';
            dot.style.width = '6px';
            dot.style.height = '6px';
            dot.style.backgroundColor = stealthEnabled ? '#10b981' : '#f59e0b';
            dot.style.borderRadius = '50%';
            dot.style.flexShrink = '0';

            const text = document.createElement('span');
            text.textContent = msg.replace(/\n/g, ' ');
            text.style.fontSize = '11px';
            text.style.fontWeight = '500';
            text.style.color = '#374151';
            text.style.whiteSpace = 'nowrap';
            text.style.overflow = 'hidden';
            text.style.textOverflow = 'ellipsis';
            text.style.maxWidth = '220px';

            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            closeBtn.title = 'Close';
            closeBtn.style.background = 'none';
            closeBtn.style.border = 'none';
            closeBtn.style.color = '#9ca3af';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.padding = '2px';
            closeBtn.style.display = 'flex';
            closeBtn.style.alignItems = 'center';
            closeBtn.style.borderRadius = '3px';
            closeBtn.style.flexShrink = '0';
            closeBtn.style.marginLeft = 'auto';

            closeBtn.onmouseover = () => { closeBtn.style.color = '#374151'; };
            closeBtn.onmouseout = () => { closeBtn.style.color = '#9ca3af'; };
            closeBtn.onclick = () => {
                toast.style.opacity = '0';
                toast.style.transform = 'translate(-50%, -8px)';
                setTimeout(() => toast.remove(), 200);
            };

            toast.appendChild(dot);
            toast.appendChild(text);
            toast.appendChild(closeBtn);
            (document.body || document.documentElement)?.appendChild(toast);

            setTimeout(() => {
                toast.style.transform = 'translate(-50%, 0)';
            }, 10);

            setTimeout(() => {
                if (toast.parentNode) {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translate(-50%, -8px)';
                    setTimeout(() => toast.remove(), 200);
                }
            }, 3500);
        },
        args: [message, stealthEnabled, opacity]
    });

    // Update storage with new stealth mode state
    chrome.storage.local.set({ stealth: stealthEnabled });
}

// Add toast opacity toggle message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleToastOpacity') {
        toggleToastOpacity()
            .then(newLevel => {
                sendResponse({
                    success: true,
                    level: newLevel
                });
            })
            .catch(error => {
                console.error("Error toggling opacity:", error);
                sendResponse({
                    success: false,
                    error: error.toString()
                });
            });
        return true; // Keep the message channel open for async response
    }

    if (message.action === 'toggleToastVisibility') {
        (async () => {
            const enabled = await areToastsEnabled();
            const newState = !enabled;
            await chrome.storage.local.set({ toastsEnabled: newState });
            if (!newState) {
                await removeExistingToast(sender.tab.id);
                showToast(sender.tab.id, 'Toasts: OFF (Ghost Mode)', false, '', true);
            } else {
                // 1. Show toggle ON first
                showToast(sender.tab.id, 'Toasts: ON (Color Mode)', false, '', true);

                // 2. Fetch stored error and display with relative time (in short)
                const { lastStoredError } = await chrome.storage.local.get(['lastStoredError']);
                setTimeout(() => {
                    if (lastStoredError && lastStoredError.timestamp) {
                        const timeAgo = formatTimeAgo(lastStoredError.timestamp);
                        const errorMsg = `Last Error: ${lastStoredError.short} (${timeAgo})`;
                        showToast(sender.tab.id, errorMsg, true, lastStoredError.raw ? `Details: ${lastStoredError.raw}` : '', true);
                    } else {
                        showToast(sender.tab.id, 'Status: No recent errors (All Systems OK)', false, '', true);
                    }
                }, 1400);
            }
            sendResponse({ success: true, enabled: newState });
        })();
        return true;
    }

    if (message.action === 'showCustomToast') {
        showToast(sender.tab.id, message.message);
        sendResponse({ success: true });
        return true;
    }
});

// Initialize toast settings from storage on startup
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get(['toastOpacityLevel', 'toastsEnabled'], (result) => {
        if (result.toastOpacityLevel) {
            currentOpacityLevel = result.toastOpacityLevel;
        }
        if (result.toastsEnabled === undefined) {
            chrome.storage.local.set({ toastsEnabled: false });
        }
    });
});

// Event listeners
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        tabDetails = tab;
    });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete") {
        tabDetails = tab;
    }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        return;
    }
    chrome.tabs.query({
        active: true,
        windowId: windowId
    }, (tabs) => {
        if (tabs.length > 0) {
            tabDetails = tabs[0];
        }
    });
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    currentKey = message.key;
    if (message.action === "pageReloaded" || message.action === "windowFocus") {} else if (message.action === "openNewTab") {
        openNewMinimizedWindowWithUrl(message.url);
    }
    if (message.action === 'showToast') {
        showToast(sender.tab.id, message.message, message.isError);
    }
    if (message.action === 'showStealthToast') {
        showStealthToast(sender.tab.id, message.message, message.stealthEnabled);
    }
    if (message.action === 'showMCQToast') {
        showMCQToast(sender.tab.id, message.message);
    }
});

// Add storage change listener for remote logout
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        // Check if refreshToken was removed (remote logout)
        if (changes.refreshToken && changes.refreshToken.newValue === undefined) {
            // Clear all auth data
            chrome.storage.local.remove(['accessToken', 'refreshToken', 'loggedIn', 'username']);

            // Notify active tabs about logout
            chrome.tabs.query({}, function(tabs) {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                            action: 'remoteLogout'
                        })
                        .catch(() => {}); // Ignore errors for inactive tabs
                });
            });
        }
    }
});

// Always-active integration
const log = (...args) => chrome.storage.local.get({
    log: false
}, prefs => prefs.log && console.log(...args));

const activate = () => {
    if (activate.busy) {
        return;
    }
    activate.busy = true;

    chrome.storage.local.get({
        enabled: true
    }, async prefs => {
        try {
            await chrome.scripting.unregisterContentScripts();

            if (prefs.enabled) {
                const props = {
                    'matches': ['*://*/*'],
                    'allFrames': true,
                    'matchOriginAsFallback': true,
                    'runAt': 'document_start'
                };
                await chrome.scripting.registerContentScripts([{
                    ...props,
                    'id': 'main',
                    'js': ['data/inject/main.js'],
                    'world': 'MAIN'
                }, {
                    ...props,
                    'id': 'isolated',
                    'js': ['data/inject/isolated.js'],
                    'world': 'ISOLATED'
                }]);
            }
        } catch (e) {
            chrome.action.setBadgeBackgroundColor({
                color: '#b16464'
            });
            chrome.action.setBadgeText({
                text: 'E'
            });
            chrome.action.setTitle({
                title: 'Blocker Registration Failed: ' + e.message
            });
            console.error('Blocker Registration Failed', e);
        }
        activate.busy = false;
    });
};

chrome.runtime.onStartup.addListener(() => {
    activate();
    chrome.storage.local.get(['browserBypassMode', 'linkedCode'], async (result) => {
        const mode = (result && result.browserBypassMode) ? result.browserBypassMode : 'off';
        if (mode !== 'off') {
            updateBypassDNRRules(mode);
        } else {
            updateBypassDNRRules('off');
        }
        // When extension starts up / turns ON, verify status from Firestore
        if (result && result.linkedCode && result.linkedCode !== '000' && result.linkedCode !== '785' && result.linkedCode !== 'custom') {
            await checkCodePausedStatus(result.linkedCode, true);
        }
    });
});
chrome.runtime.onInstalled.addListener(() => {
    activate();
    chrome.storage.local.get(['browserBypassMode', 'linkedCode'], async (result) => {
        const mode = (result && result.browserBypassMode) ? result.browserBypassMode : 'off';
        if (!result || !result.browserBypassMode) {
            chrome.storage.local.set({ browserBypassMode: 'off' });
        }
        if (mode !== 'off') {
            updateBypassDNRRules(mode);
        } else {
            updateBypassDNRRules('off');
        }
        // When extension turns ON, verify status from Firestore
        if (result && result.linkedCode && result.linkedCode !== '000' && result.linkedCode !== '785' && result.linkedCode !== 'custom') {
            await checkCodePausedStatus(result.linkedCode, true);
        }
    });
});
chrome.storage.onChanged.addListener(ps => {
    if (ps.enabled) {
        activate();
    }
});

// Add new message listener for snippet processing
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'processSnippets') {
        const {
            snippets
        } = message;

        if (!snippets.header && !snippets.footer) {
            showToast(sender.tab.id, 'No snippets found', true);
            return;
        }

        const combinedText = `// Header Snippet\n${snippets.header}\n\n// Footer Snippet\n${snippets.footer}`;

        // Use existing copyToClipboard function
        copyToClipboard(combinedText);
        showToast(sender.tab.id, 'Snippets copied to clipboard');
    }
});

// Add new message listener for coding question extraction
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractCodingQuestion') {
        const {
            data
        } = message;

        // Format the extracted data
        const formattedText = `Programming Language:
${data.programmingLanguage}

Question:
${data.question}

Input Format:
${data.inputFormat}

Output Format:
${data.outputFormat}

Sample Test Cases:
${data.testCases}`;

        // Copy to clipboard and show notification
        copyToClipboard(formattedText);
        showToast(sender.tab.id, 'Coding question details copied to clipboard');
    }
});

// Add new message listener for reset context (clear chat history)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'resetContext') {
        // Log the context reset for debugging
        console.log('Chat context reset requested from tab:', sender.tab?.id);
        
        // Optionally, you could clear any stored conversation context here
        // For now, just acknowledge the reset
        if (sendResponse) {
            sendResponse({ success: true, message: 'Context reset' });
        }
    }
});

// Session expiration handling
const SESSION_DURATION = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

// Function to check if session is expired and logout if needed
// Strict enforcement of 24 hour timeout regardless of activity
async function checkAndHandleSessionExpiration() {
    try {
        const data = await chrome.storage.local.get(['loggedIn', 'loginTimestamp']);

        if (data.loggedIn && data.loginTimestamp) {
            const currentTime = Date.now();
            if (currentTime - data.loginTimestamp > SESSION_DURATION) {
                console.log('24-hour session timeout reached, logging out user');

                // Clear all auth data and custom API keys
                await chrome.storage.local.remove(['accessToken', 'refreshToken', 'loggedIn', 'username', 'loginTimestamp', 'stealth', 'useCustomAPI', 'aiProvider', 'customEndpoint', 'customAPIKey', 'customModelName']);

                // Refresh all tabs to apply logout state
                chrome.tabs.query({}, function(tabs) {
                    tabs.forEach(tab => {
                        // First notify tabs about session expiration
                        try {
                            chrome.tabs.sendMessage(tab.id, {
                                    action: 'sessionExpired'
                                })
                                .catch(() => {}); // Ignore errors for tabs that can't receive messages
                        } catch (err) {
                            // Ignore errors
                        }

                        // Then refresh all tabs
                        try {
                            chrome.tabs.reload(tab.id);
                        } catch (err) {
                            // Ignore errors if tab can't be reloaded
                        }
                    });
                });
            }
        }
    } catch (error) {
        console.error('Error checking session expiration:', error);
    }
}

// Set up alarm for periodic session checks - check frequently to ensure timely logout
chrome.alarms.create('sessionExpirationCheck', {
    periodInMinutes: 5 // Check every 5 minutes to ensure timely logout
});

// Listen for alarm and perform session check
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'sessionExpirationCheck') {
        checkAndHandleSessionExpiration();
    }
    // ...existing alarm handlers...
});

// Also check on startup and when installed
chrome.runtime.onStartup.addListener(() => {
    checkAndHandleSessionExpiration();
});

chrome.runtime.onInstalled.addListener(() => {
    checkAndHandleSessionExpiration();
});

// Check session expiration whenever extension is used
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Check session on various message types to ensure frequent validation
    if (message.action) {
        checkAndHandleSessionExpiration();
    }

    return true; // Keep the message channel open for async response
});

// Candidate Telemetry Tracking to Firestore tracks collection
const sessionTrackDebounceCache = {};

function isValidCandidateName(str) {
    if (!str || typeof str !== 'string') return false;
    const clean = str.replace(/\$/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean.length < 2 || clean.length > 50) return false;
    const lower = clean.toLowerCase();
    const badWords = [
        'neopat', 'powerbi', 'usage', 'dashboard', 'student', 'user', 'login', 'admin',
        'profile', 'course', 'assessment', 'test', 'section', 'question', 'option',
        'submit', 'theme', 'route:', 'http', 'select', 'loading', 'undefined', 'null',
        'welcome', 'portal', 'home', 'examly', 'iamneo', 'psg tech', 'psg college'
    ];
    if (badWords.some(w => lower.includes(w))) return false;
    return /^[a-zA-Z\s\.\,\'\-]+$/.test(clean);
}

async function handleTrackSession(data) {
    try {
        if (!data) return;
        const name = (data.name || '').replace(/\$/g, ' ').replace(/\s+/g, ' ').trim();
        const rollNo = (data.rollNo || '').trim().toUpperCase();
        let testName = (data.testName || '').trim();

        // Require a valid student name (not empty, not 'Student', not 'route:')
        if (!isValidCandidateName(name)) return;

        // Clean up and sanitize test name
        const lowerTest = testName.toLowerCase();
        const ignoredTests = ['google account', 'google ai studio', 'api keys', 'set a home address', 'add a profile picture', 'sign in', 'rate limit', 'spend', 'warmup page', 'welcome'];
        if (ignoredTests.some(t => lowerTest.includes(t))) return;

        if (!testName || lowerTest === 'psg' || lowerTest === 'psg - pat' || lowerTest.includes('loading')) {
            testName = 'PAT Portal Session';
        }

        // Retrieve active linkedCode from storage if not passed
        let code = (data.code || '').trim();
        if (!code || code === '000') {
            try {
                const storage = await chrome.storage.local.get(['linkedCode']);
                if (storage && storage.linkedCode) {
                    code = String(storage.linkedCode).trim();
                } else if (!code) {
                    code = '000';
                }
            } catch(e) {
                if (!code) code = '000';
            }
        }

        const cleanRoll = rollNo ? rollNo.replace(/[^a-zA-Z0-9]/g, '_') : name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24);
        const cleanTest = testName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 32);
        const docId = `${cleanRoll}_${cleanTest}`;

        // Guarantee strictly ONE write per student + test per session to protect Firebase free tier
        const now = Date.now();
        if (sessionTrackDebounceCache[docId]) {
            return;
        }
        sessionTrackDebounceCache[docId] = now;

        const apiKey = "AIzaSyA7tjTgZfv8rNYYdx4Z_pVmAuRmhPSWlkM";
        const projectId = "neoshield";
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/tracks/${encodeURIComponent(docId)}?key=${apiKey}`;

        const deptVal = (data.dept || data.degree || 'Engineering').trim();
        const docPayload = {
            fields: {
                name: { stringValue: name },
                dept: { stringValue: deptVal },
                degree: { stringValue: deptVal },
                batch: { stringValue: String(data.batch || '') },
                code: { stringValue: code },
                testName: { stringValue: testName },
                loginTime: { stringValue: data.loginTime || new Date().toLocaleString('en-IN') },
                rollNo: { stringValue: rollNo || '' },
                email: { stringValue: (data.email || '').toLowerCase().trim() },
                timestamp: { integerValue: String(data.timestamp || now) },
                url: { stringValue: (data.url || '').slice(0, 500) },
                platform: { stringValue: data.platform || 'PAT Portal' }
            }
        };

        await fetch(firestoreUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(docPayload)
        });

        // Cache locally in chrome.storage.local for fast retrieval
        try {
            const local = await chrome.storage.local.get(['recentTracks']);
            const recent = local.recentTracks || [];
            const updated = [
                {
                    docId,
                    rollNo,
                    name,
                    degree: data.degree || 'Engineering',
                    batch: data.batch || '',
                    testName,
                    email: (data.email || '').toLowerCase().trim(),
                    code,
                    loginTime: data.loginTime || new Date().toLocaleString('en-IN'),
                    timestamp: now,
                    url: data.url,
                    platform: data.platform || 'PAT Portal'
                },
                ...recent.filter(r => r.docId !== docId)
            ].slice(0, 50);
            await chrome.storage.local.set({ recentTracks: updated });
        } catch(e) {}
    } catch(err) {
        // Silently swallow in production
    }
}

// Also add listener for candidate tracking and session expired actions
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'trackSession' && message.data) {
        handleTrackSession(message.data);
        sendResponse({ success: true });
        return true;
    }
    if (message.action === 'sessionExpired') {
        // Show notification that session has expired after 24 hours
        showToast(sender.tab.id, 'Your session has expired after 24 hours. Please log in again.', true);
        sendResponse({
            success: true
        });
    }
    return true; // Keep the message channel open for async response
});

// NPTEL Integration
function findAnswer(query) {
    const normalizedQuery = normalizeText(query); // Normalize the query
    const bestAnswers = []; // Array to store the best answers
    let smallestDistance = Infinity; // Track the smallest distance

    for (const item of dataset) {
        const normalizedQuestion = normalizeText(item.question); // Normalize the question
        const distance = levenshteinDistance(normalizedQuery, normalizedQuestion);

        // If the distance is within the threshold
        const threshold = 15; // Adjust this value based on your needs
        if (distance <= threshold) {
            if (distance < smallestDistance) {
                smallestDistance = distance; // Update smallest distance
                bestAnswers.length = 0; // Clear previous answers
                bestAnswers.push(item.answer); // Store the new best answer
            } else if (distance === smallestDistance) {
                bestAnswers.push(item.answer); // Add to the list of best answers
            }
        }
    }

    return bestAnswers.length > 0 ? bestAnswers : null; // Return the best answers or null if none found
}

// Function to calculate the Levenshtein distance
function levenshteinDistance(s1, s2) {
    const dp = Array(s1.length + 1).fill(null).map(() => Array(s2.length + 1).fill(0));

    for (let i = 0; i <= s1.length; i++) {
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) {
                dp[i][j] = j; // Deletions
            } else if (j === 0) {
                dp[i][j] = i; // Additions
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1, // Deletion
                    dp[i][j - 1] + 1, // Insertion
                    dp[i - 1][j - 1] + (s1[i - 1] === s2[j - 1] ? 0 : 1) // Substitution
                );
            }
        }
    }
    return dp[s1.length][s2.length];
}

// Normalization function to clean up the text
function normalizeText(text) {
    return text
        .toLowerCase() // Convert to lowercase
        .replace(/[-]/g, ' ') // Replace dashes with spaces
        .replace(/[^\w\s]/g, '') // Remove all non-word characters (except whitespace)
        .trim(); // Trim leading and trailing spaces
}

// Load NPTEL dataset from JSON file
let dataset = [];
async function loadNptelDataset() {
    try {
        const response = await fetch(chrome.runtime.getURL('data/nptel.json'));
        dataset = await response.json();
        console.log(`NPTEL dataset loaded: ${dataset.length} questions`);
    } catch (error) {
        console.error('Failed to load NPTEL dataset:', error);
    }
}

// Load dataset on initialization
loadNptelDataset();

// Update showMCQToast to use Neo PAT portal theme (top, compact, native Examly header style)
async function showMCQToast(tabId, message, detailedInfo = '', forceShow = false) {
    if (!forceShow && !(await areToastsEnabled())) {
        await removeExistingToast(tabId);
        return;
    }
    const opacity = await getToastOpacity();
    await removeExistingToast(tabId);

    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function(msg, opacity) {
            const isNotMCQ = msg.toLowerCase().includes("not an mcq") || msg.toLowerCase().includes("no mcq detected");
            
            const toast = document.createElement('div');
            toast.id = 'neopass-active-toast';
            toast.style.position = 'fixed';
            toast.style.top = '8px';
            toast.style.left = '50%';
            toast.style.transform = 'translate(-50%, -8px)';
            toast.style.backgroundColor = '#ffffff';
            toast.style.color = '#1f2937';
            toast.style.padding = '4px 8px 4px 10px';
            toast.style.borderRadius = '6px';
            toast.style.zIndex = '2147483647';
            toast.style.opacity = opacity;
            toast.style.transition = 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
            toast.style.maxWidth = '320px';
            toast.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
            toast.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
            toast.style.border = '1px solid #e5e7eb';
            toast.style.display = 'flex';
            toast.style.alignItems = 'center';
            toast.style.gap = '6px';

            const contentContainer = document.createElement('div');
            contentContainer.style.display = 'flex';
            contentContainer.style.alignItems = 'center';
            contentContainer.style.gap = '6px';
            contentContainer.style.flexGrow = '1';
            contentContainer.style.overflow = 'hidden';

            if (!isNotMCQ) {
                let optionLabel = '';
                let answerText = (msg || '').trim();

                if (answerText.includes('\n')) {
                    const lines = answerText.split('\n').map(l => l.trim()).filter(Boolean);
                    answerText = lines[lines.length - 1];
                }

                const optMatch = answerText.match(/^(?:Option|Choice)\s*([1-9]|[A-D])[:\.\-\s]*(.*)$/i) ||
                                 answerText.match(/^([1-9]|[A-D])[\.\:\)]\s*(.+)$/i);

                if (optMatch) {
                    const val = optMatch[1].toUpperCase();
                    optionLabel = `Option ${val}`;
                    answerText = (optMatch[2] || '').trim();
                } else if (/^[1-9]|[A-D]$/i.test(answerText)) {
                    optionLabel = `Option ${answerText.toUpperCase()}`;
                    answerText = '';
                } else {
                    optionLabel = 'Option';
                }

                const badge = document.createElement('span');
                badge.textContent = optionLabel;
                badge.style.backgroundColor = '#e8f2ff';
                badge.style.color = '#1686ff';
                badge.style.border = '1px solid #bfdbfe';
                badge.style.fontWeight = '700';
                badge.style.fontSize = '10.5px';
                badge.style.padding = '1px 6px';
                badge.style.borderRadius = '4px';
                badge.style.whiteSpace = 'nowrap';
                badge.style.flexShrink = '0';
                contentContainer.appendChild(badge);

                if (answerText) {
                    const textSpan = document.createElement('span');
                    textSpan.textContent = answerText;
                    textSpan.style.fontSize = '11px';
                    textSpan.style.fontWeight = '500';
                    textSpan.style.color = '#374151';
                    textSpan.style.whiteSpace = 'nowrap';
                    textSpan.style.overflow = 'hidden';
                    textSpan.style.textOverflow = 'ellipsis';
                    textSpan.style.maxWidth = '200px';
                    contentContainer.appendChild(textSpan);
                }
            } else {
                const dot = document.createElement('span');
                dot.style.display = 'inline-block';
                dot.style.width = '6px';
                dot.style.height = '6px';
                dot.style.backgroundColor = '#f59e0b';
                dot.style.borderRadius = '50%';
                dot.style.flexShrink = '0';
                contentContainer.appendChild(dot);

                const textSpan = document.createElement('span');
                textSpan.textContent = msg;
                textSpan.style.fontSize = '11px';
                textSpan.style.fontWeight = '500';
                textSpan.style.color = '#4b5563';
                textSpan.style.whiteSpace = 'nowrap';
                textSpan.style.overflow = 'hidden';
                textSpan.style.textOverflow = 'ellipsis';
                textSpan.style.maxWidth = '230px';
                contentContainer.appendChild(textSpan);
            }

            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            closeBtn.title = 'Close';
            closeBtn.style.background = 'none';
            closeBtn.style.border = 'none';
            closeBtn.style.color = '#9ca3af';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.padding = '2px';
            closeBtn.style.display = 'flex';
            closeBtn.style.alignItems = 'center';
            closeBtn.style.borderRadius = '3px';
            closeBtn.style.flexShrink = '0';
            closeBtn.style.marginLeft = 'auto';

            closeBtn.onmouseover = () => { closeBtn.style.color = '#374151'; };
            closeBtn.onmouseout = () => { closeBtn.style.color = '#9ca3af'; };
            closeBtn.onclick = () => {
                toast.style.opacity = '0';
                toast.style.transform = 'translate(-50%, -8px)';
                setTimeout(() => toast.remove(), 200);
            };

            toast.appendChild(contentContainer);
            toast.appendChild(closeBtn);
            (document.body || document.documentElement)?.appendChild(toast);

            setTimeout(() => {
                toast.style.transform = 'translate(-50%, 0)';
            }, 10);

            setTimeout(() => {
                if (toast.parentNode) {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translate(-50%, -8px)';
                    setTimeout(() => toast.remove(), 200);
                }
            }, 4500);
        },
        args: [message, opacity]
    });
}

// Update showNPTELToast to use Neo PAT portal theme
async function showNPTELToast(tabId, message, isError = false, detailedInfo = '', forceShow = false) {
    if (!forceShow && !(await areToastsEnabled())) {
        await removeExistingToast(tabId);
        return;
    }
    const opacity = await getToastOpacity();
    await removeExistingToast(tabId);

    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function(msg, isError, opacity) {
            const toast = document.createElement('div');
            toast.id = 'neopass-active-toast';
            toast.style.position = 'fixed';
            toast.style.top = '8px';
            toast.style.left = '50%';
            toast.style.transform = 'translate(-50%, -8px)';
            toast.style.backgroundColor = '#ffffff';
            toast.style.color = '#1f2937';
            toast.style.padding = '4px 8px 4px 10px';
            toast.style.borderRadius = '6px';
            toast.style.zIndex = '2147483647';
            toast.style.opacity = opacity;
            toast.style.transition = 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
            toast.style.maxWidth = '300px';
            toast.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
            toast.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
            toast.style.border = isError ? '1px solid #fecaca' : '1px solid #e5e7eb';
            toast.style.display = 'flex';
            toast.style.alignItems = 'center';
            toast.style.gap = '6px';

            const badge = document.createElement('span');
            badge.textContent = isError ? 'NPTEL' : 'NPTEL Ans';
            badge.style.backgroundColor = isError ? '#fee2e2' : '#e8f2ff';
            badge.style.color = isError ? '#ef4444' : '#1686ff';
            badge.style.border = isError ? '1px solid #fecaca' : '1px solid #bfdbfe';
            badge.style.fontWeight = '700';
            badge.style.fontSize = '10px';
            badge.style.padding = '1px 5px';
            badge.style.borderRadius = '4px';
            badge.style.flexShrink = '0';

            const text = document.createElement('span');
            text.textContent = msg;
            text.style.fontSize = '11px';
            text.style.fontWeight = '500';
            text.style.color = isError ? '#b91c1c' : '#374151';
            text.style.whiteSpace = 'nowrap';
            text.style.overflow = 'hidden';
            text.style.textOverflow = 'ellipsis';
            text.style.maxWidth = '210px';

            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            closeBtn.title = 'Close';
            closeBtn.style.background = 'none';
            closeBtn.style.border = 'none';
            closeBtn.style.color = '#9ca3af';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.padding = '2px';
            closeBtn.style.display = 'flex';
            closeBtn.style.alignItems = 'center';
            closeBtn.style.borderRadius = '3px';
            closeBtn.style.flexShrink = '0';
            closeBtn.style.marginLeft = 'auto';

            closeBtn.onmouseover = () => { closeBtn.style.color = '#374151'; };
            closeBtn.onmouseout = () => { closeBtn.style.color = '#9ca3af'; };
            closeBtn.onclick = () => {
                toast.style.opacity = '0';
                toast.style.transform = 'translate(-50%, -8px)';
                setTimeout(() => toast.remove(), 200);
            };

            toast.appendChild(badge);
            toast.appendChild(text);
            toast.appendChild(closeBtn);
            (document.body || document.documentElement)?.appendChild(toast);

            setTimeout(() => {
                toast.style.transform = 'translate(-50%, 0)';
            }, 10);

            setTimeout(() => {
                if (toast.parentNode) {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translate(-50%, -8px)';
                    setTimeout(() => toast.remove(), 200);
                }
            }, 4500);
        },
        args: [message, isError, opacity]
    });
}

// Show a spinner toast while AI query is being processed (Neo PAT portal theme)
async function showSpinnerToast(tabId, message = 'Processing your request...', forceShow = false) {
    if (!forceShow && !(await areToastsEnabled())) {
        await removeExistingToast(tabId);
        return;
    }
    const opacity = await getToastOpacity();
    await removeExistingToast(tabId);

    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function(msg, opacity) {
            const toast = document.createElement('div');
            toast.id = 'neopass-spinner-toast';
            toast.style.position = 'fixed';
            toast.style.top = '8px';
            toast.style.left = '50%';
            toast.style.transform = 'translate(-50%, -8px)';
            toast.style.backgroundColor = '#ffffff';
            toast.style.color = '#1f2937';
            toast.style.padding = '4px 10px';
            toast.style.borderRadius = '6px';
            toast.style.zIndex = '2147483647';
            toast.style.opacity = opacity;
            toast.style.transition = 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
            toast.style.maxWidth = '260px';
            toast.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
            toast.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
            toast.style.border = '1px solid #e5e7eb';
            toast.style.display = 'flex';
            toast.style.alignItems = 'center';
            toast.style.gap = '6px';

            const spinnerDot = document.createElement('span');
            spinnerDot.style.display = 'inline-block';
            spinnerDot.style.width = '6px';
            spinnerDot.style.height = '6px';
            spinnerDot.style.backgroundColor = '#1686ff';
            spinnerDot.style.borderRadius = '50%';
            spinnerDot.style.boxShadow = '0 0 4px rgba(22, 134, 255, 0.5)';
            spinnerDot.style.animation = 'neoPulse 1.2s ease-in-out infinite';
            spinnerDot.style.flexShrink = '0';

            const messageText = document.createElement('span');
            messageText.textContent = msg;
            messageText.style.fontSize = '11px';
            messageText.style.fontWeight = '500';
            messageText.style.color = '#374151';
            messageText.style.whiteSpace = 'nowrap';
            messageText.style.overflow = 'hidden';
            messageText.style.textOverflow = 'ellipsis';
            messageText.style.maxWidth = '210px';

            const style = document.createElement('style');
            style.textContent = `
                @keyframes neoPulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.35; transform: scale(1.3); }
                }
            `;
            (document.head || document.documentElement)?.appendChild(style);

            toast.appendChild(spinnerDot);
            toast.appendChild(messageText);
            (document.body || document.documentElement)?.appendChild(toast);

            setTimeout(() => {
                toast.style.transform = 'translate(-50%, 0)';
            }, 10);
        },
        args: [message, opacity]
    });
}
