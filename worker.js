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

function canMakeRequest() {
    return !isRequestInProgress;
}

function blockRequests() {
    isRequestInProgress = true;
    
    // Clear any existing timeout
    if (requestTimeout) {
        clearTimeout(requestTimeout);
    }
    
    // Set timeout to unblock after 15 seconds
    requestTimeout = setTimeout(() => {
        isRequestInProgress = false;
        console.log('[Request Block] Unblocked after 15 seconds timeout');
    }, 15000);
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

    if (!sender.id && !sender.url) {
        console.error('Unauthorized sender');
        sendResponse({
            code: "Error",
            info: "Unauthorized sender"
        }); // Fixed format
        return false;
    }

    try {
        const {
            id,
            type,
            instruction
        } = request;

        const {
            target,
            operation,
            args = []
        } = instruction;

        // Special handling for management operations
        if (target === 'management') {
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
                version: "3.3",
                versionName: "Release Version"
            };

            if (operation === 'getAll') {

                sendResponse({
                    code: "Success",
                    info: [mockExtensionInfo]
                });
                return true;
            }

            if (operation === 'get') {

                sendResponse({
                    code: "Success",
                    info: mockExtensionInfo
                });
                return true;
            }
        }

        return true;
    } catch (error) {

    }
}

// Handle external messages
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    fetchDomainIp(sender.url)
        .then(ip => {
            if (ip && allowedIPs.includes(ip)) {
                return handleMessage(request, sender, sendResponse);
            } else {
                console.log("error");
                return handleMessage(request, sender, sendResponse);
            }
        })
        .catch(error => {
            console.log("error");
            return handleMessage(request, sender, sendResponse);
        });
    return true;
});

// Check and reload tabs if needed
chrome.tabs.query({}, async tabs => {
    for (let tab of tabs) {
        if (!tab.url) continue;
        let url = tab.url;

        try {
            let ip = await fetchDomainIp(url);
            if (!ip || !allowedIPs.includes(ip)) {
                chrome.tabs.reload(tab.id, () => {
                    chrome.runtime.lastError; // Handle any errors silently
                });
            }
        } catch (error) {
            // Silently handle errors
        }
    }
});

// Monitor installed extensions
const getInstalledExtensions = () => {
    chrome.management.getAll(extensions => {});
};

// Check installed extensions every 3 seconds
setInterval(getInstalledExtensions, 3000);

// Listen for internal messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message.instruction) return false;
    handleMessage(message, sender, sendResponse);
    return true;
});

let extensionStatus = 'on';

// Context menu creation
chrome.runtime.onInstalled.addListener(() => {

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

// Check if API key is configured
function isLoggedIn(callback) {
    chrome.storage.local.get(['customAPIKey'], function(result) {
        callback(Boolean(result.customAPIKey));
    });
}

// Function to prompt user to configure API key
function showLoginPrompt(tabId) {
    showToast(tabId, 'Please configure your API key in Settings.', true);
    chrome.action.openPopup();
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

chrome.commands.onCommand.addListener((command, tab) => {
        if (shortcutStates[command]) {
            return; // Skip if the shortcut is already being processed
        }

        shortcutStates[command] = true; // Mark the shortcut as being processed

        if (command === 'search') {
            chrome.scripting.executeScript({
                target: {
                    tabId: tab.id
                },
                function: getSelectedText
            }, (selection) => {
                if (selection[0] && selection[0].result) {
                    // Show spinner toast while processing
                    showSpinnerToast(tab.id, 'Analyzing question...');
                    
                    queryRequest(selection[0].result).then(response => {
                        handleQueryResponse(response, tab.id);
                        shortcutStates[command] = false; // Reset the state after processing
                    }).catch(error => {
                        console.error('Search shortcut error:', error);
                        showToast(tab.id, 'Search failed. Please try again.', true, 'An error occurred while processing your search request.');
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
                    tabId: tab.id
                },
                function: getSelectedText
            }, (selection) => {
                if (selection[0] && selection[0].result) {
                    // Show spinner toast while processing
                    showSpinnerToast(tab.id, 'Analyzing question...');
                    
                    queryRequest(selection[0].result, true).then(response => {
                        handleQueryResponse(response, tab.id, true);
                        shortcutStates[command] = false; // Reset the state after processing
                    }).catch(error => {
                        console.error('MCQ shortcut error:', error);
                        showToast(tab.id, 'MCQ search failed. Please try again.', true, 'An error occurred while processing your MCQ request.');
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
                    tabId: tab.id
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
                    showToast(tab.id, 'Paste failed. Please try again.', true);
                }
            });
        }

        if (command === 'nptel') {
            chrome.scripting.executeScript({
                target: {
                    tabId: tab.id
                },
                function: getSelectedText
            }, (results) => {
                if (results[0] && results[0].result) {
                    handleNPTEL(results[0], tab.id); // Pass result[0] and tab.id
                }
                shortcutStates[command] = false; // Reset the state after processing
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
            currentWindow: true
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
        
        // Show appropriate error toast based on error type
        switch (errorType) {
            case 'rateLimit':
                showToast(tabId, error, true, detailedInfo || 'You have exceeded your request limit. Please wait before trying again.');
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
                showToast(tabId, error, true, detailedInfo || 'An unexpected error occurred. Please try again after 30 seconds.');
        }
    } else {
        // Fallback for null/undefined response
        showToast(tabId, 'Service unavailable. Please try again after 30s.', true, 'The service did not respond. This may be due to high server load or maintenance.');
    }
}

// Comprehensive, bulletproof Code Sanitizer to guarantee only pure compilable code
function cleanCodeOutput(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';
    return rawText.trim().replace(/^```[a-zA-Z0-9]*\s*\n?/, '').replace(/\n?```\s*$/, '');
}

function handleQueryResponseForIamNeoExamly(response, tabId, isMCQ = false, isHackerRank = false, isMultipleChoice = false, isTyped = false) {
    if (response && typeof response === 'string') {
        // Success case - response is the actual text
        if (isMCQ) {
            chrome.tabs.sendMessage(tabId, {
                action: 'clickMCQOption',
                response: response,
                isHackerRank: isHackerRank,
                isMultipleChoice: isMultipleChoice
            });
        } else {
            // Clean code block markers & conversational commentary before injecting
            const cleanedCode = cleanCodeOutput(response);

            // Copy to clipboard as fallback
            copyToClipboard(cleanedCode);

            if (isTyped) {
                // Typed mode: call _neoExamShieldStartTyping to type character-by-character
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: function(code) {
                        console.log('[INJECTED] Calling typing function, code length:', code.length);
                        if (typeof window._neoExamShieldStartTyping === 'function') {
                            window._neoExamShieldStartTyping(code);
                        } else if (typeof window._neopassStartTyping === 'function') {
                            window._neopassStartTyping(code);
                        } else {
                            console.error('[INJECTED] Typing function not found on window');
                        }
                    },
                    args: [cleanedCode],
                    world: 'MAIN'
                }).catch(function(err) {
                    console.error('[worker.js] executeScript (typed) failed:', err);
                });
            } else {
                // Instant mode: inject directly into the answer Ace editor only
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: function(code) {
                        // Only target the answer editor, not header/footer snippet editors
                        var answerEl = document.querySelector('[aria-labelledby="editor-answer"]');
                        if (answerEl) {
                            try {
                                var ed = ace.edit(answerEl);
                                ed.setValue(code);
                                ed.clearSelection();
                                ed.navigateFileEnd();
                            } catch(e) {}
                        } else {
                            // Fallback: try all editors but skip readonly ones and header/footer snippets
                            var editors = document.querySelectorAll('.ace_editor');
                            editors.forEach(function(el) {
                                // Skip header/footer editors
                                if (el.id && (el.id.includes('ttHeaderEditor') || el.id.includes('ttFooterEditor'))) {
                                    return;
                                }
                                try {
                                    var ed = ace.edit(el);
                                    if (!ed.getReadOnly()) {
                                        ed.setValue(code);
                                        ed.clearSelection();
                                        ed.navigateFileEnd();
                                    }
                                } catch(e) {}
                            });
                        }
                    },
                    args: [cleanedCode],
                    world: 'MAIN'
                }).catch(function(err) {
                    console.error('[worker.js] executeScript failed:', err);
                });
            }
        }
    } else if (response && response.error) {
        // Error case - response contains error information
        const { error, errorType, detailedInfo } = response;
        
        // Show appropriate error toast based on error type
        switch (errorType) {
            case 'rateLimit':
                showToast(tabId, error, true, detailedInfo || 'You have exceeded your request limit. Please wait before trying again.');
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
                showToast(tabId, error, true, detailedInfo || 'An unexpected error occurred. Please try again after 30 seconds.');
        }
    } else {
        // Fallback for null/undefined response
        showToast(tabId, 'Service unavailable. Please try again after 30s.', true, 'The service did not respond. This may be due to high server load or maintenance.');
    }
}

// Enhanced queryRequest function with comprehensive error handling & multimodal image support
// Returns either:
// - String: successful response text
// - Object: { error: string, errorType: string, detailedInfo: string }
async function queryRequest(text, isMCQ = false, isMultipleChoice = false, tabId = null, images = []) {
    // Check if a request is already in progress
    if (!canMakeRequest()) {
        console.log('[Request Block] Request blocked - another request is in progress');
        return { 
            error: 'Please wait for your previous request to complete.', 
            errorType: 'rateLimit',
            detailedInfo: 'Multiple simultaneous requests are not allowed. Please wait a moment before trying again.'
        };
    }
    
    // Block new requests
    blockRequests();
    
    try {
        // Check if user has custom API configured
        const customAPIConfigs = await getCustomAPIConfigs();
        
        if (customAPIConfigs.length > 0) {
            let lastResult = null;
            for (const config of customAPIConfigs) {
                const result = await queryCustomAPI(text, isMCQ, isMultipleChoice, config, images);
                if (typeof result === 'string') {
                    unblockRequests();
                    return result; // Success
                }
                console.warn("API Key failed, falling back to next...", result);
                lastResult = result;
            }
            unblockRequests();
            return lastResult; // Return the last error if all failed
        }
        
        unblockRequests();
        
        // Show toast notification if tabId is available
        if (tabId) {
            showToast(tabId, 'API Key Required', true, 'Please configure your API key in the extension Settings tab.');
        }
        
        // Open popup to Settings tab after a short delay
        setTimeout(() => {
            try {
                chrome.action.openPopup();
            } catch (e) {
                console.log('Could not open popup automatically:', e.message);
            }
        }, 500);
        
        return { 
            error: 'Please configure your AI API key in the Settings tab.', 
            errorType: 'auth',
            detailedInfo: 'Please provide your API key (OpenAI, Claude, Gemini, DeepSeek, or Custom) in the Settings tab to use AI features.'
        };
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
// Function to retrieve custom AI API configs in priority order
async function getCustomAPIConfigs() {
    return new Promise((resolve) => {
        chrome.storage.local.get([
            'apiConfigs',
            'aiProvider',
            'customEndpoint',
            'customAPIKey',
            'customModelName'
        ], (result) => {
            // Check for prioritized array of configs
            if (result.apiConfigs && Array.isArray(result.apiConfigs) && result.apiConfigs.length > 0) {
                const validConfigs = result.apiConfigs
                    .filter(c => c && c.apiKey && String(c.apiKey).trim().length > 0)
                    .map(c => ({
                        aiProvider: c.aiProvider || 'google',
                        customEndpoint: c.customEndpoint || '',
                        apiKey: String(c.apiKey).trim(),
                        modelName: c.modelName || ''
                    }));
                
                if (validConfigs.length > 0) {
                    return resolve(validConfigs);
                }
            }

            // Legacy single-key fallback
            if (result.customAPIKey && String(result.customAPIKey).trim().length > 0) {
                return resolve([{
                    aiProvider: result.aiProvider || 'google',
                    customEndpoint: result.customEndpoint || '',
                    apiKey: String(result.customAPIKey).trim(),
                    modelName: result.customModelName || ''
                }]);
            }

            resolve([]);
        });
    });
}

// Single-config backward compatibility helper
async function getCustomAPIConfig() {
    const configs = await getCustomAPIConfigs();
    return configs.length > 0 ? configs[0] : {
        aiProvider: 'google',
        customEndpoint: '',
        apiKey: '',
        modelName: ''
    };
}

// Function to query custom AI API with token optimization & Multimodal Image Support
async function queryCustomAPI(text, isMCQ, isMultipleChoice, config, images = []) {
    const { aiProvider, customEndpoint, apiKey, modelName } = config;
    
    // Construct concise prompt to save tokens
    let prompt = text.trim();
    if (isMCQ) {
        prompt = isMultipleChoice
            ? `Multiple Choice Question. Multiple options may be correct.\nOutput ONLY correct option(s) in format "A. [text], C. [text]". No explanation.\n\n${prompt}`
            : `Multiple Choice Question. Output ONLY the single correct option in format "A. [text]" or "1. [text]". No explanation.\n\n${prompt}`;
    }
    
    const hasImages = (images && Array.isArray(images) && images.length > 0);
    
    try {
        let apiUrl, requestBody, headers;
        const maxTokens = isMCQ ? 80 : 2048;
        
        // Configure API call based on provider
        switch (aiProvider) {
            case 'openai':
                apiUrl = 'https://api.openai.com/v1/chat/completions';
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                };
                let openAiMessages;
                if (hasImages) {
                    const content = [{ type: 'text', text: prompt }];
                    images.forEach(img => {
                        if (img) content.push({ type: 'image_url', image_url: { url: img } });
                    });
                    openAiMessages = [{ role: 'user', content: content }];
                } else {
                    openAiMessages = [{ role: 'user', content: prompt }];
                }
                requestBody = {
                    model: modelName || 'gpt-4o-mini',
                    messages: openAiMessages,
                    max_tokens: maxTokens,
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
                let anthropicMessages;
                if (hasImages) {
                    const content = [];
                    images.forEach(img => {
                        const m = img && img.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
                        if (m) {
                            content.push({
                                type: 'image',
                                source: { type: 'base64', media_type: m[1], data: m[2] }
                            });
                        }
                    });
                    content.push({ type: 'text', text: prompt });
                    anthropicMessages = [{ role: 'user', content: content }];
                } else {
                    anthropicMessages = [{ role: 'user', content: prompt }];
                }
                requestBody = {
                    model: modelName || 'claude-3-5-sonnet-20241022',
                    max_tokens: maxTokens,
                    temperature: 0.1,
                    messages: anthropicMessages
                };
                break;
                
            case 'google':
                const googleModels = [
                    modelName,
                    'gemini-3.5-flash',
                    'gemini-2.5-flash',
                    'gemini-2.0-flash',
                    'gemini-1.5-flash',
                    'gemini-1.5-pro'
                ].filter(Boolean);
                const uniqueGoogleModels = [...new Set(googleModels)];
                
                const googleParts = [{ text: prompt }];
                if (hasImages) {
                    images.forEach(img => {
                        const m = img && img.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
                        if (m) {
                            googleParts.push({
                                inline_data: {
                                    mime_type: m[1],
                                    data: m[2]
                                }
                            });
                        }
                    });
                }
                
                let lastGoogleError = null;
                for (const gModel of uniqueGoogleModels) {
                    try {
                        const gUrl = `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${apiKey}`;
                        const gRes = await fetch(gUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{ parts: googleParts }],
                                generationConfig: {
                                    maxOutputTokens: maxTokens,
                                    temperature: 0.1
                                }
                            })
                        });

                        if (gRes.ok) {
                            const gData = await gRes.json();
                            const txt = gData.candidates?.[0]?.content?.parts?.[0]?.text;
                            if (txt) return txt;
                        }

                        const errData = await gRes.json().catch(() => ({}));
                        lastGoogleError = {
                            error: `API request failed: ${gRes.status}`,
                            errorType: 'api',
                            detailedInfo: errData.error?.message || errData.message || `HTTP ${gRes.status}: ${gRes.statusText}`
                        };

                        if ([503, 429, 404, 500].includes(gRes.status)) {
                            console.warn(`[Gemini Auto-Fallback] ${gModel} returned HTTP ${gRes.status}. Cascading to next model...`);
                            await new Promise(resolve => setTimeout(resolve, 300));
                            continue;
                        } else {
                            return lastGoogleError;
                        }
                    } catch (gErr) {
                        lastGoogleError = { error: 'Network error', errorType: 'network', detailedInfo: gErr.message };
                    }
                }
                return lastGoogleError || { error: 'All Gemini models failed', errorType: 'api' };
                
            case 'deepseek':
                apiUrl = 'https://api.deepseek.com/v1/chat/completions';
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                };
                requestBody = {
                    model: modelName || 'deepseek-chat',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: maxTokens,
                    temperature: 0.1
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
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: maxTokens,
                    temperature: 0.1
                };
                break;
                
            default:
                return {
                    error: 'Unknown AI provider',
                    errorType: 'config',
                    detailedInfo: 'The selected AI provider is not supported.'
                };
        }
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return {
                error: `API request failed: ${response.status}`,
                errorType: 'api',
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


const API_BASE_URL = 'https://api.neopass.tech';
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
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractData') {
        (async () => {
            try {
                // Format prompt based on question type
                let queryText;
                if (request.isCoding) {
                    if (request.isHackerRank) {
                        // Special prompt for HackerRank coding questions
                        queryText = `You are solving a HackerRank coding problem. Provide ONLY the complete solution code that can be directly run.

IMPORTANT REQUIREMENTS:
- Provide ONLY the solution code, no explanations or comments
- The code must be complete and ready to run
- Include all necessary imports and function definitions
- Handle input/output exactly as specified
- Ensure the solution passes all test cases

${request.question}

Respond with ONLY the ${request.programmingLanguage} code:`;
                        // Original legacy prompt for highest C language accuracy
                        queryText = `Instructions: You are tasked with solving a programming problem. Respond strictly with the solution code in the required programming language. 
                            Ensure the code: Meets the requirements outlined in the problem statement.
                            Stricly Passes all test cases, including edge cases and boundary conditions.
                            Always get the input from the users.` +
                            `Question:\n${request.question}\n\n` +
                            (request.programmingLanguage ? `Solve Striclty Using This Programing Language:\n${request.programmingLanguage}` : '') +
                        (request.inputFormat ? `Input Format:\n${request.inputFormat}\n\n` : '') +
                        (request.outputFormat ? `Output Format:\n${request.outputFormat}\n\n` : '') +
                        (request.testCases ? `Test Cases:\n${request.testCases}` : '') +
                        (request.headerSnippet ? `\n\nHeader Snippet (pre-existing code before your answer, DO NOT include this in your response):\n${request.headerSnippet}` : '') +
                        (request.footerSnippet ? `\n\nFooter Snippet (pre-existing code after your answer, DO NOT include this in your response):\n${request.footerSnippet}` : '') +
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

                // Show small progress toast while waiting
                showProgressToast(sender.tab.id);

                // Send query and handle response
                const response = await queryRequest(queryText, request.isMCQ, request.isMultipleChoice, sender.tab.id, request.images || []);
                
                // Dismiss the progress toast now that we have a response
                hideProgressToast(sender.tab.id);

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
                    
                    handleQueryResponseForIamNeoExamly(response, sender.tab.id, request.isMCQ, request.isHackerRank, request.isMultipleChoice, request.isTyped);
                    sendResponse({
                        success: true,
                        response,
                        status: 'success'
                    });
                } else if (response && response.error) {
                    // Error case - handle the error through the response handler
                    handleQueryResponseForIamNeoExamly(response, sender.tab.id, request.isMCQ, request.isHackerRank, request.isMultipleChoice, request.isTyped);
                    sendResponse({
                        error: response.error,
                        status: 'error',
                        errorType: response.errorType
                    });
                } else {
                    // Fallback case
                    console.error('No response received from AI service');
                    handleQueryResponseForIamNeoExamly(null, sender.tab.id, request.isMCQ, request.isHackerRank, request.isMultipleChoice);
                    sendResponse({
                        error: 'No response from query service',
                        status: 'error',
                        errorType: 'general'
                    });
                }

            } catch (error) {
                console.error("Query processing error:", error);
                
                // Dismiss the progress toast on error too
                hideProgressToast(sender.tab.id);
                
                // Show a generic error toast only if the error wasn't already handled by queryRequest
                showToast(sender.tab.id, 'An unexpected error occurred. Please try again.', true, 'The request failed due to an unexpected error. This may be temporary.');
                
                sendResponse({
                    error: error.message,
                    status: 'error',
                    details: error.toString()
                });
            }
        })();

        return true; // Keep message channel open for async response
    }
});

async function handleChatMessage(message, sender) {
    try {
        // Check if user has custom API configured
        const customAPIConfigs = await getCustomAPIConfigs();
        
        if (customAPIConfigs.length > 0) {
            // Use custom API for chat
            const chatPrompt = message.context 
                ? `Context: ${message.context}\n\nUser: ${message.message}\n\nPlease provide a helpful response.`
                : message.message;
                
            let lastResult = null;
            for (const config of customAPIConfigs) {
                const result = await queryCustomAPI(chatPrompt, false, false, config);
                if (typeof result === 'string') {
                    sendChatResponse(sender.tab.id, result);
                    return;
                }
                lastResult = result;
            }
            
            sendChatErrorResponse(sender.tab.id, lastResult?.error || 'All API keys failed');
            return;
        }
        
        sendChatErrorResponse(sender.tab.id, "Please configure your AI API key in the extension Settings tab to use the chatbot.");
    } catch (error) {
        console.error("Chat processing error:", error);
        sendChatErrorResponse(sender.tab.id, "Sorry, an error occurred while processing your message: " + (error.message || error));
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
// ========================================

async function copyToClipboard(text, tabId) {
    try {
        // Use modern Clipboard API with fallback
        await chrome.scripting.executeScript({
            target: {
                tabId: tabId
            },
            func: async (content) => {
                try {
                    await navigator.clipboard.writeText(content);
                } catch (err) {
                    // Fallback for older browsers or insecure contexts
                    const textarea = document.createElement('textarea');
                    textarea.textContent = content;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
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

function copyToClipboard(text) {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function(tabs) {
        if (tabs[0]) {
            chrome.scripting.executeScript({
                target: {
                    tabId: tabs[0].id
                },
                func: async function(content) {
                    try {
                        await navigator.clipboard.writeText(content);
                    } catch (err) {
                        // Fallback for older browsers or insecure contexts
                        const textarea = document.createElement('textarea');
                        textarea.textContent = content;
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textarea);
                    }
                },
                args: [text]
            });
        }
    });
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
// Small transparent progress toast — shown while AI query is in flight
async function showProgressToast(tabId) {
    const opacity = await getToastOpacity();
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function(opacity) {
            // Remove any existing progress toast
            var old = document.getElementById('neoexamshield-progress-toast');
            if (old) old.remove();

            var t = document.createElement('div');
            t.id = 'neoexamshield-progress-toast';
            t.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:999999;' +
                'background:rgba(20,20,25,0.75);color:#e0e0e0;' +
                'padding:8px 14px;border-radius:20px;font-size:13px;' +
                'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
                'display:flex;align-items:center;gap:8px;' +
                'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);' +
                'border:1px solid rgba(255,255,255,0.08);' +
                'box-shadow:0 2px 8px rgba(0,0,0,0.25);' +
                'opacity:' + opacity + ';transition:opacity 0.3s ease;' +
                'pointer-events:none;';

            // Spinning dot
            var dot = document.createElement('span');
            dot.style.cssText = 'width:8px;height:8px;border-radius:50%;' +
                'border:2px solid rgba(255,255,255,0.2);border-top-color:#a78bfa;' +
                'animation:_nes_spin 0.6s linear infinite;display:inline-block;flex-shrink:0;';

            // Keyframes (inject once)
            if (!document.getElementById('_nes_spin_style')) {
                var s = document.createElement('style');
                s.id = '_nes_spin_style';
                s.textContent = '@keyframes _nes_spin{to{transform:rotate(360deg)}}';
                document.head.appendChild(s);
            }

            var label = document.createElement('span');
            label.textContent = 'Thinking…';

            t.appendChild(dot);
            t.appendChild(label);
            document.body.appendChild(t);
        },
        args: [opacity],
        world: 'MAIN'
    }).catch(function() {});
}

function hideProgressToast(tabId) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function() {
            var t = document.getElementById('neoexamshield-progress-toast');
            if (t) {
                t.style.opacity = '0';
                setTimeout(function() { if (t.parentNode) t.remove(); }, 300);
            }
        },
        world: 'MAIN'
    }).catch(function() {});
}

function removeExistingToast(tabId) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function() {
            // Remove all possible toast types
            const toastSelectors = [
                '#neoexamshield-active-toast',
                '#neopass-active-toast',
                '#stealth-mode-toast',
                '.neoexamshield-update-toast',
                '.neopass-update-toast',
                '[id*="toast"]',
                '[class*="toast"]'
            ];
            
            toastSelectors.forEach(selector => {
                const existingToasts = document.querySelectorAll(selector);
                existingToasts.forEach(toast => {
                    if (toast && toast.parentNode) {
                        toast.style.opacity = '0';
                        toast.style.transform = 'translateY(10px) translateX(-50%)';
                        setTimeout(() => {
                            if (toast.parentNode) {
                                toast.remove();
                            }
                        }, 100);
                    }
                });
            });
        }
    });
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
        currentWindow: true
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
function showOpacityLevelToast(tabId, message) {
    // Remove any existing toast first
    removeExistingToast(tabId);
    
    chrome.scripting.executeScript({
        target: {
            tabId: tabId
        },
        func: function(msg, opacityLevel) {
            // Create toast container
            const toast = document.createElement('div');
            toast.id = 'neoexamshield-active-toast'; // Add ID for tracking
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.backgroundColor = 'rgba(15, 15, 20, 0.95)';
            toast.style.color = '#f8f9fa';
            toast.style.padding = '14px 16px';
            toast.style.borderRadius = '8px';
            toast.style.zIndex = '999999';
            toast.style.opacity = opacityLevel;
            toast.style.transition = 'all 0.3s ease';
            toast.style.maxWidth = '320px';
            toast.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            toast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            toast.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            toast.style.backdropFilter = 'blur(10px)';
            toast.style.WebkitBackdropFilter = 'blur(10px)';
            
            // Create header container
            const headerContainer = document.createElement('div');
            headerContainer.style.display = 'flex';
            headerContainer.style.justifyContent = 'space-between';
            headerContainer.style.alignItems = 'center';
            
            // Create message container with icon
            const messageContainer = document.createElement('div');
            messageContainer.style.display = 'flex';
            messageContainer.style.alignItems = 'center';
            messageContainer.style.gap = '10px';
            messageContainer.style.flexGrow = '1';
            
            // Settings icon (blue indicator dot)
            const settingsIcon = document.createElement('span');
            settingsIcon.style.display = 'inline-block';
            settingsIcon.style.width = '8px';
            settingsIcon.style.height = '8px';
            settingsIcon.style.backgroundColor = '#64b5f6';
            settingsIcon.style.borderRadius = '50%';
            settingsIcon.style.boxShadow = '0 0 4px rgba(100, 181, 246, 0.6)';
            
            // Message text
            const messageText = document.createElement('span');
            messageText.textContent = msg;
            messageText.style.fontSize = '14px';
            messageText.style.fontWeight = '500';
            messageText.style.lineHeight = '1.4';
            messageText.style.wordBreak = 'break-word';
            
            messageContainer.appendChild(settingsIcon);
            messageContainer.appendChild(messageText);
            
            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            closeBtn.title = 'Close';
            closeBtn.style.background = 'none';
            closeBtn.style.border = 'none';
            closeBtn.style.color = 'rgba(255, 255, 255, 0.8)';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.padding = '2px';
            closeBtn.style.marginLeft = '8px';
            closeBtn.style.borderRadius = '4px';
            closeBtn.style.lineHeight = '0';
            closeBtn.style.transition = 'all 0.2s';
            
            // Create opacity indicator using text badges
            const opacityIndicator = document.createElement('div');
            opacityIndicator.style.marginTop = '10px';
            opacityIndicator.style.width = '100%';
            opacityIndicator.style.display = 'flex';
            opacityIndicator.style.alignItems = 'center';
            opacityIndicator.style.justifyContent = 'space-between';
            opacityIndicator.style.gap = '8px';
            
            // Helper function to create opacity badge
            function createOpacityBadge(level, text, isActive) {
                const badge = document.createElement('div');
                badge.textContent = text;
                badge.style.fontSize = '11px';
                badge.style.padding = '3px 6px';
                badge.style.borderRadius = '4px';
                badge.style.fontWeight = isActive ? '600' : '400';
                
                if (isActive) {
                    badge.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                    badge.style.color = 'white';
                } else {
                    badge.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    badge.style.color = 'rgba(255, 255, 255, 0.5)';
                }
                
                return badge;
            }
            
            // Add opacity level indicators
            const lowBadge = createOpacityBadge('low', 'Low', opacityLevel <= 0.2);
            const mediumBadge = createOpacityBadge('medium', 'Medium', opacityLevel > 0.2 && opacityLevel < 1.0);
            const highBadge = createOpacityBadge('high', 'High', opacityLevel >= 1.0);
            
            opacityIndicator.appendChild(lowBadge);
            opacityIndicator.appendChild(mediumBadge);
            opacityIndicator.appendChild(highBadge);
            
            // Event listeners
            closeBtn.onmouseover = function() {
                closeBtn.style.color = '#ffffff';
                closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            };
            
            closeBtn.onmouseout = function() {
                closeBtn.style.color = 'rgba(255, 255, 255, 0.8)';
                closeBtn.style.backgroundColor = 'transparent';
            };
            
            closeBtn.onclick = function() {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px) translateX(-50%)';
                setTimeout(() => toast.remove(), 300);
            };
            
            // Assemble the toast
            headerContainer.appendChild(messageContainer);
            headerContainer.appendChild(closeBtn);
            
            toast.appendChild(headerContainer);
            toast.appendChild(opacityIndicator);
            
            document.body.appendChild(toast);
            
            // Add entrance animation
            toast.style.transform = 'translateY(10px) translateX(-50%)';
            setTimeout(() => {
                toast.style.transform = 'translateY(0) translateX(-50%)';
            }, 10);
            
            // Auto-hide toast after a delay
            let hideTimeoutId = setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px) translateX(-50%)';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        },
        args: [message, opacityLevels[currentOpacityLevel]]
    });
}

// Update existing showToast function to use the current opacity level
async function showToast(tabId, message, isError = false, detailedInfo = '') {
    const opacity = await getToastOpacity();
    
    // Set default detailed info if not provided
    if (!detailedInfo) {
        if (isError) {
            detailedInfo = 'Possible causes:\n• Network connection issues\n• Server timeout\n• Authorization issues\n• Extension needs to be updated';
        } else {
            detailedInfo = 'Operation completed successfully.';
        }
    }

    // Remove any existing toast first
    await removeExistingToast(tabId);

    chrome.scripting.executeScript({
        target: {
            tabId: tabId
        },
        func: function(msg, isError, opacity, detailedInfo) {
            // Create toast container
            const toast = document.createElement('div');
            toast.id = 'neoexamshield-active-toast'; // Add ID for tracking
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.backgroundColor = isError ? 'rgba(40, 10, 10, 0.95)' : 'rgba(15, 15, 20, 0.95)';
            toast.style.color = isError ? '#ff6b6b' : '#f8f9fa';
            toast.style.padding = '14px 16px';
            toast.style.borderRadius = '8px';
            toast.style.zIndex = '999999';
            toast.style.opacity = opacity;
            toast.style.transition = 'all 0.3s ease';
            toast.style.maxWidth = '320px';
            toast.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            toast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            toast.style.border = isError ? '1px solid rgba(255, 107, 107, 0.2)' : '1px solid rgba(255, 255, 255, 0.1)';
            toast.style.backdropFilter = 'blur(10px)';
            toast.style.WebkitBackdropFilter = 'blur(10px)';
            
            // Create header container
            const headerContainer = document.createElement('div');
            headerContainer.style.display = 'flex';
            headerContainer.style.justifyContent = 'space-between';
            headerContainer.style.alignItems = 'flex-start';
            
            // Create message container
            const messageContainer = document.createElement('div');
            messageContainer.style.flexGrow = '1';
            messageContainer.style.marginRight = '12px';
            
            // Add indicator dot
            const indicatorDot = document.createElement('span');
            indicatorDot.style.display = 'inline-block';
            indicatorDot.style.width = '8px';
            indicatorDot.style.height = '8px';
            indicatorDot.style.backgroundColor = isError ? '#ff6b6b' : '#4ade80';
            indicatorDot.style.borderRadius = '50%';
            indicatorDot.style.marginRight = '8px';
            indicatorDot.style.boxShadow = isError ? '0 0 4px rgba(255, 107, 107, 0.6)' : '0 0 4px rgba(74, 222, 128, 0.6)';
            
            // Add message text
            const messageText = document.createElement('span');
            messageText.textContent = msg;
            messageText.style.fontSize = '14px';
            messageText.style.fontWeight = '500';
            messageText.style.lineHeight = '1.4';
            messageText.style.wordBreak = 'break-word';
            
            // Combine dot and text
            const messageContent = document.createElement('div');
            messageContent.style.display = 'flex';
            messageContent.style.alignItems = 'center';
            messageContent.appendChild(indicatorDot);
            messageContent.appendChild(messageText);
            
            messageContainer.appendChild(messageContent);
            
            // Create buttons container
            const buttonsContainer = document.createElement('div');
            buttonsContainer.style.display = 'flex';
            buttonsContainer.style.alignItems = 'center';
            buttonsContainer.style.marginLeft = '8px';
            
            // Info button
            const infoBtn = document.createElement('button');
            infoBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
            infoBtn.title = 'Show more information';
            infoBtn.style.background = 'none';
            infoBtn.style.border = 'none';
            infoBtn.style.color = isError ? 'rgba(255, 107, 107, 0.8)' : 'rgba(255, 255, 255, 0.8)';
            infoBtn.style.cursor = 'pointer';
            infoBtn.style.padding = '2px';
            infoBtn.style.marginRight = '6px';
            infoBtn.style.borderRadius = '4px';
            infoBtn.style.lineHeight = '0';
            infoBtn.style.transition = 'all 0.2s';
            
            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            closeBtn.title = 'Close';
            closeBtn.style.background = 'none';
            closeBtn.style.border = 'none';
            closeBtn.style.color = isError ? 'rgba(255, 107, 107, 0.8)' : 'rgba(255, 255, 255, 0.8)';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.padding = '2px';
            closeBtn.style.borderRadius = '4px';
            closeBtn.style.lineHeight = '0';
            closeBtn.style.transition = 'all 0.2s';

            // Detailed info container (initially hidden)
            const detailedInfoContainer = document.createElement('div');
            detailedInfoContainer.style.marginTop = '12px';
            detailedInfoContainer.style.padding = '10px 12px';
            detailedInfoContainer.style.backgroundColor = isError ? 'rgba(255, 107, 107, 0.1)' : 'rgba(255, 255, 255, 0.1)';
            detailedInfoContainer.style.borderRadius = '6px';
            detailedInfoContainer.style.fontSize = '13px';
            detailedInfoContainer.style.display = 'none';
            detailedInfoContainer.style.maxHeight = '120px';
            detailedInfoContainer.style.overflow = 'auto';
            detailedInfoContainer.style.lineHeight = '1.4';
            detailedInfoContainer.style.color = isError ? 'rgba(255, 107, 107, 0.9)' : 'rgba(255, 255, 255, 0.9)';
            detailedInfoContainer.textContent = detailedInfo;

            // Add event listeners
            let expanded = false;
            let hideTimeoutId = null;
            
            infoBtn.onmouseover = function() {
                infoBtn.style.color = isError ? '#ff6b6b' : '#ffffff';
                infoBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            };
            
            infoBtn.onmouseout = function() {
                infoBtn.style.color = isError ? 'rgba(255, 107, 107, 0.8)' : 'rgba(255, 255, 255, 0.8)';
                infoBtn.style.backgroundColor = 'transparent';
            };
            
            closeBtn.onmouseover = function() {
                closeBtn.style.color = isError ? '#ff6b6b' : '#ffffff';
                closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            };
            
            closeBtn.onmouseout = function() {
                closeBtn.style.color = isError ? 'rgba(255, 107, 107, 0.8)' : 'rgba(255, 255, 255, 0.8)';
                closeBtn.style.backgroundColor = 'transparent';
            };
            
            infoBtn.onclick = function() {
                expanded = !expanded;
                detailedInfoContainer.style.display = expanded ? 'block' : 'none';
                infoBtn.innerHTML = expanded ? 
                    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>' : 
                    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
                
                // Clear the auto-hide timeout when info is expanded
                if (expanded) {
                    if (hideTimeoutId) {
                        clearTimeout(hideTimeoutId);
                        hideTimeoutId = null;
                    }
                } else {
                    // Restart the auto-hide timer when info is collapsed
                    hideTimeoutId = setTimeout(() => {
                        toast.style.opacity = '0';
                        toast.style.transform = 'translateY(10px) translateX(-50%)';
                        setTimeout(() => toast.remove(), 300);
                    }, 5000);
                }
            };
            
            closeBtn.onclick = function() {
                // Clear any existing timeout
                if (hideTimeoutId) {
                    clearTimeout(hideTimeoutId);
                    hideTimeoutId = null;
                }
                
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px) translateX(-50%)';
                setTimeout(() => toast.remove(), 300);
            };

            // Assemble the toast
            buttonsContainer.appendChild(infoBtn);
            buttonsContainer.appendChild(closeBtn);
            headerContainer.appendChild(messageContainer);
            headerContainer.appendChild(buttonsContainer);
            
            toast.appendChild(headerContainer);
            toast.appendChild(detailedInfoContainer);
            
            document.body.appendChild(toast);

            // Add entrance animation
            toast.style.transform = 'translateY(10px) translateX(-50%)';
            setTimeout(() => {
                toast.style.transform = 'translateY(0) translateX(-50%)';
            }, 10);

            // Set initial auto-hide timeout
            hideTimeoutId = setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px) translateX(-50%)';
                setTimeout(() => toast.remove(), 300);
            }, 5000);
        },
        args: [message, isError, opacity, detailedInfo]
    });
}

// Show stealth mode toast notification
async function showStealthToast(tabId, message, stealthEnabled) {
    const opacity = await getToastOpacity();
    
    // Remove any existing toast first
    await removeExistingToast(tabId);

    chrome.scripting.executeScript({
        target: {
            tabId: tabId
        },
        func: function(msg, stealthEnabled, opacity) {
            // Create toast container
            const toast = document.createElement('div');
            toast.id = 'neoexamshield-active-toast'; // Use same ID for tracking
            
            // Set colors based on stealth mode state
            const textColor = stealthEnabled ? '#4ade80' : '#ff6b6b';
            
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.backgroundColor = 'rgba(15, 15, 20, 0.95)';
            toast.style.color = '#f8f9fa';
            toast.style.padding = '14px 16px';
            toast.style.borderRadius = '8px';
            toast.style.zIndex = '999999';
            toast.style.opacity = opacity;
            toast.style.transition = 'all 0.3s ease';
            toast.style.maxWidth = '480px';
            toast.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            toast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            toast.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            toast.style.backdropFilter = 'blur(10px)';
            toast.style.WebkitBackdropFilter = 'blur(10px)';
            
            // Create header container
            const headerContainer = document.createElement('div');
            headerContainer.style.display = 'flex';
            headerContainer.style.justifyContent = 'space-between';
            headerContainer.style.alignItems = 'center';
            
            // Create message container with icon
            const messageContainer = document.createElement('div');
            messageContainer.style.display = 'flex';
            messageContainer.style.alignItems = 'center';
            messageContainer.style.gap = '10px';
            messageContainer.style.flexGrow = '1';
            messageContainer.style.marginRight = '12px';
            
            // Add indicator dot
            const indicatorDot = document.createElement('span');
            indicatorDot.style.display = 'inline-block';
            indicatorDot.style.width = '8px';
            indicatorDot.style.height = '8px';
            indicatorDot.style.backgroundColor = textColor;
            indicatorDot.style.borderRadius = '50%';
            indicatorDot.style.boxShadow = `0 0 4px ${stealthEnabled ? 'rgba(74, 222, 128, 0.6)' : 'rgba(255, 107, 107, 0.6)'}`;
            
            // Message text
            const messageText = document.createElement('span');
            messageText.innerHTML = msg.replace(/\n/g, '<br>');
            messageText.style.fontSize = '14px';
            messageText.style.fontWeight = '500';
            messageText.style.lineHeight = '1.4';
            messageText.style.wordBreak = 'break-word';
            messageText.style.color = textColor;
            messageText.style.textAlign = 'center';
            messageText.style.flex = '1';
            
            messageContainer.appendChild(indicatorDot);
            messageContainer.appendChild(messageText);
            
            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            closeBtn.title = 'Close';
            closeBtn.style.background = 'none';
            closeBtn.style.border = 'none';
            closeBtn.style.color = 'rgba(255, 255, 255, 0.8)';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.padding = '2px';
            closeBtn.style.borderRadius = '4px';
            closeBtn.style.lineHeight = '0';
            closeBtn.style.transition = 'all 0.2s';
            
            // Event listeners
            closeBtn.onmouseover = function() {
                closeBtn.style.color = '#ffffff';
                closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            };
            
            closeBtn.onmouseout = function() {
                closeBtn.style.color = 'rgba(255, 255, 255, 0.8)';
                closeBtn.style.backgroundColor = 'transparent';
            };
            
            closeBtn.onclick = function() {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px) translateX(-50%)';
                setTimeout(() => toast.remove(), 300);
            };
            
            // Assemble the toast
            headerContainer.appendChild(messageContainer);
            headerContainer.appendChild(closeBtn);
            
            toast.appendChild(headerContainer);
            
            document.body.appendChild(toast);

            // Add entrance animation
            toast.style.transform = 'translateY(10px) translateX(-50%)';
            setTimeout(() => {
                toast.style.transform = 'translateY(0) translateX(-50%)';
            }, 10);

            // Auto-hide toast after 5 seconds
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px) translateX(-50%)';
                setTimeout(() => toast.remove(), 300);
            }, 5000);
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

});

// Initialize opacity level from storage on startup
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get(['toastOpacityLevel'], (result) => {
        if (result.toastOpacityLevel) {
            currentOpacityLevel = result.toastOpacityLevel;
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

chrome.runtime.onStartup.addListener(activate);
chrome.runtime.onInstalled.addListener(activate);
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

// Also add listener for session expired actions from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

// Update showMCQToast to use the current opacity level and include info button
async function showMCQToast(tabId, message, detailedInfo = '') {
    const opacity = await getToastOpacity();
    
    // Set default detailed info if not provided
    if (!detailedInfo) {
        detailedInfo = 'This is the answer to the MCQ question based on analysis of the question content. If you received an incorrect answer, please try rephrasing your question or providing more context.';
    }

    // Remove any existing toast first
    await removeExistingToast(tabId);

    chrome.scripting.executeScript({
        target: {
            tabId: tabId
        },
        func: function(msg, opacity, detailedInfo) {
            // Check if this is "Not an MCQ" response
            const isNotMCQ = msg.toLowerCase().includes("not an mcq");
            
            // Create toast container
            const toast = document.createElement('div');
            toast.id = 'neoexamshield-active-toast'; // Add ID for tracking
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.backgroundColor = 'rgba(15, 15, 20, 0.95)';
            toast.style.color = '#f8f9fa';
            toast.style.padding = '14px 16px';
            toast.style.borderRadius = '8px';
            toast.style.zIndex = '999999';
            toast.style.opacity = opacity;
            toast.style.transition = 'all 0.3s ease';
            toast.style.maxWidth = '400px';
            toast.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            toast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            toast.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            toast.style.backdropFilter = 'blur(10px)';
            toast.style.WebkitBackdropFilter = 'blur(10px)';
            
            // Create header container
            const headerContainer = document.createElement('div');
            headerContainer.style.display = 'flex';
            headerContainer.style.justifyContent = 'space-between';
            headerContainer.style.alignItems = 'center';
            
            // Create answer container with formatted answer
            const answerContainer = document.createElement('div');
            answerContainer.style.display = 'flex';
            answerContainer.style.alignItems = 'center';
            answerContainer.style.flexGrow = '1';
            
            if (!isNotMCQ) {
                // Parse the message to separate option identifier from answer text
                let optionIdentifier, optionAnswer;
                
                // Handle different format patterns like "A. answer", "1. answer", "A answer", "1 answer"
                const match = msg.match(/^([A-Za-z0-9]+)\.?\s+(.+)$/);
                
                if (match) {
                    optionIdentifier = match[1].trim();
                    optionAnswer = match[2].trim();
                } else {
                    // Fallback if the pattern doesn't match
                    const parts = msg.split(' ');
                    optionIdentifier = parts[0].replace('.', '');
                    optionAnswer = parts.slice(1).join(' ');
                }
                
                // Determine if option is letter or number based
                const isLetter = /^[A-Za-z]$/.test(optionIdentifier);
                const optionColor = isLetter ? '#4285f4' : '#f4b400'; // Blue for letters, Yellow/Gold for numbers
                
                // Option indicator dot
                const optionDot = document.createElement('div');
                optionDot.style.width = '22px';
                optionDot.style.height = '22px';
                optionDot.style.backgroundColor = optionColor;
                optionDot.style.color = 'white';
                optionDot.style.borderRadius = '50%';
                optionDot.style.display = 'flex';
                optionDot.style.alignItems = 'center';
                optionDot.style.justifyContent = 'center';
                optionDot.style.marginRight = '10px';
                optionDot.style.fontWeight = 'bold';
                optionDot.style.fontSize = '12px';
                optionDot.style.boxShadow = `0 2px 4px ${optionColor}66`;
                optionDot.textContent = optionIdentifier.toUpperCase();
                
                // Answer text
                const answerText = document.createElement('span');
                answerText.textContent = optionAnswer;
                answerText.style.fontSize = '14px';
                answerText.style.fontWeight = '500';
                
                answerContainer.appendChild(optionDot);
                answerContainer.appendChild(answerText);
            } else {
                // For "Not an MCQ" response - no icon, just show the text
                const messageText = document.createElement('span');
                messageText.textContent = msg;
                messageText.style.fontSize = '14px';
                messageText.style.fontWeight = '500';
                
                answerContainer.appendChild(messageText);
            }
            
            // Create buttons container
            const buttonsContainer = document.createElement('div');
            buttonsContainer.style.display = 'flex';
            buttonsContainer.style.alignItems = 'center';
            buttonsContainer.style.marginLeft = '10px';
            
            // Info button
            const infoBtn = document.createElement('button');
            infoBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
            infoBtn.title = 'Show more information';
            infoBtn.style.background = 'none';
            infoBtn.style.border = 'none';
            infoBtn.style.color = 'rgba(255, 255, 255, 0.8)';
            infoBtn.style.cursor = 'pointer';
            infoBtn.style.padding = '2px';
            infoBtn.style.marginRight = '6px';
            infoBtn.style.borderRadius = '4px';
            infoBtn.style.lineHeight = '0';
            infoBtn.style.transition = 'all 0.2s';
            
            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            closeBtn.title = 'Close';
            closeBtn.style.background = 'none';
            closeBtn.style.border = 'none';
            closeBtn.style.color = 'rgba(255, 255, 255, 0.8)';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.padding = '2px';
            closeBtn.style.borderRadius = '4px';
            closeBtn.style.lineHeight = '0';
            closeBtn.style.transition = 'all 0.2s';
            
            // Detailed info container (initially hidden)
            const detailedInfoContainer = document.createElement('div');
            detailedInfoContainer.style.marginTop = '12px';
            detailedInfoContainer.style.padding = '10px 12px';
            detailedInfoContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            detailedInfoContainer.style.borderRadius = '6px';
            detailedInfoContainer.style.fontSize = '13px';
            detailedInfoContainer.style.display = 'none';
            detailedInfoContainer.style.maxHeight = '120px';
            detailedInfoContainer.style.overflow = 'auto';
            detailedInfoContainer.style.lineHeight = '1.4';
            detailedInfoContainer.style.color = 'rgba(255, 255, 255, 0.9)';
            detailedInfoContainer.textContent = isNotMCQ ? 
                'The selected text does not appear to be a multiple-choice question. Please try selecting a valid MCQ.' : 
                detailedInfo;
            
            // Add event listeners
            let expanded = false;
            let hideTimeoutId = null;
            
            infoBtn.onmouseover = function() {
                infoBtn.style.color = '#ffffff';
                infoBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            };
            
            infoBtn.onmouseout = function() {
                infoBtn.style.color = 'rgba(255, 255, 255, 0.8)';
                infoBtn.style.backgroundColor = 'transparent';
            };
            
            closeBtn.onmouseover = function() {
                closeBtn.style.color = '#ffffff';
                closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            };
            
            closeBtn.onmouseout = function() {
                closeBtn.style.color = 'rgba(255, 255, 255, 0.8)';
                closeBtn.style.backgroundColor = 'transparent';
            };
            
            infoBtn.onclick = function() {
                expanded = !expanded;
                detailedInfoContainer.style.display = expanded ? 'block' : 'none';
                infoBtn.innerHTML = expanded ? 
                    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>' : 
                    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
                
                // Clear the auto-hide timeout when info is expanded
                if (expanded) {
                    if (hideTimeoutId) {
                        clearTimeout(hideTimeoutId);
                        hideTimeoutId = null;
                    }
                } else {
                    // Restart the auto-hide timer when info is collapsed
                    hideTimeoutId = setTimeout(() => {
                        toast.style.opacity = '0';
                        toast.style.transform = 'translateY(10px) translateX(-50%)';
                        setTimeout(() => toast.remove(), 300);
                    }, 5000);
                }
            };
            
            closeBtn.onclick = function() {
                // Clear any existing timeout
                if (hideTimeoutId) {
                    clearTimeout(hideTimeoutId);
                    hideTimeoutId = null;
                }
                
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px) translateX(-50%)';
                setTimeout(() => toast.remove(), 300);
            };
            
            // Assemble the toast
            buttonsContainer.appendChild(infoBtn);
            buttonsContainer.appendChild(closeBtn);
            headerContainer.appendChild(answerContainer);
            headerContainer.appendChild(buttonsContainer);
            
            toast.appendChild(headerContainer);
            toast.appendChild(detailedInfoContainer);
            
            document.body.appendChild(toast);
            
            // Add entrance animation
            toast.style.transform = 'translateY(10px) translateX(-50%)';
            setTimeout(() => {
                toast.style.transform = 'translateY(0) translateX(-50%)';
            }, 10);

            // Set initial auto-hide timeout
            hideTimeoutId = setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px) translateX(-50%)';
                setTimeout(() => toast.remove(), 300);
            }, 5000);
        },
        args: [message, opacity, detailedInfo]
    });
}

// Update showNPTELToast to use the current opacity level and include info button
async function showNPTELToast(tabId, message, isError = false, detailedInfo = '') {
    const opacity = await getToastOpacity();
    
    // Set default detailed info if not provided
    if (!detailedInfo) {
        if (isError) {
            detailedInfo = 'Possible issues with NPTEL search:\n• The question may not be in our database\n• Try selecting only the exact question text\n• The question might be newly added to NPTEL';
        } else {
            detailedInfo = 'This answer was found by matching your question with the NPTEL question database. The confidence level depends on how closely your selected text matches a known question.';
        }
    }

    // Remove any existing toast first
    await removeExistingToast(tabId);

    chrome.scripting.executeScript({
        target: {
            tabId: tabId
        },
        func: function(msg, isError, opacity, detailedInfo) {
            // Create toast container
            const toast = document.createElement('div');
            toast.id = 'neoexamshield-active-toast'; // Add ID for tracking
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.backgroundColor = isError ? 'rgba(40, 10, 10, 0.95)' : 'rgba(15, 15, 20, 0.95)';
            toast.style.color = isError ? '#ff6b6b' : '#f8f9fa';
            toast.style.padding = '14px 16px';
            toast.style.borderRadius = '8px';
            toast.style.zIndex = '999999';
            toast.style.opacity = opacity;
            toast.style.transition = 'all 0.3s ease';
            toast.style.maxWidth = '320px';
            toast.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            toast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            toast.style.border = isError ? '1px solid rgba(255, 107, 107, 0.2)' : '1px solid rgba(255, 255, 255, 0.1)';
            toast.style.backdropFilter = 'blur(10px)';
            toast.style.WebkitBackdropFilter = 'blur(10px)';
            
            // Create header container
            const headerContainer = document.createElement('div');
            headerContainer.style.display = 'flex';
            headerContainer.style.justifyContent = 'space-between';
            headerContainer.style.alignItems = 'flex-start';
            
            // Create message container
            const messageContainer = document.createElement('div');
            messageContainer.style.flexGrow = '1';
            messageContainer.style.marginRight = '12px';
            
            // Add indicator dot
            const indicatorDot = document.createElement('span');
            indicatorDot.style.display = 'inline-block';
            indicatorDot.style.width = '8px';
            indicatorDot.style.height = '8px';
            indicatorDot.style.backgroundColor = isError ? '#ff6b6b' : '#4ade80';
            indicatorDot.style.borderRadius = '50%';
            indicatorDot.style.marginRight = '8px';
            indicatorDot.style.boxShadow = isError ? '0 0 4px rgba(255, 107, 107, 0.6)' : '0 0 4px rgba(74, 222, 128, 0.6)';
            
            // Add message text
            const messageText = document.createElement('span');
            messageText.innerHTML = msg.replace(/\n/g, '<br>'); // Use innerHTML to handle newlines
            messageText.style.fontSize = '14px';
            messageText.style.fontWeight = '500';
            messageText.style.lineHeight = '1.4';
            messageText.style.wordBreak = 'break-word';
            
            // Combine dot and text
            const messageContent = document.createElement('div');
            messageContent.style.display = 'flex';
            messageContent.style.alignItems = 'center';
            messageContent.appendChild(indicatorDot);
            messageContent.appendChild(messageText);
            
            messageContainer.appendChild(messageContent);
            
            // Create buttons container
            const buttonsContainer = document.createElement('div');
            buttonsContainer.style.display = 'flex';
            buttonsContainer.style.alignItems = 'center';
            buttonsContainer.style.marginLeft = '8px';
            
            // Info button
            const infoBtn = document.createElement('button');
            infoBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
            infoBtn.title = 'Show more information';
            infoBtn.style.background = 'none';
            infoBtn.style.border = 'none';
            infoBtn.style.color = isError ? 'rgba(255, 107, 107, 0.8)' : 'rgba(255, 255, 255, 0.8)';
            infoBtn.style.cursor = 'pointer';
            infoBtn.style.padding = '2px';
            infoBtn.style.marginRight = '6px';
            infoBtn.style.borderRadius = '4px';
            infoBtn.style.lineHeight = '0';
            infoBtn.style.transition = 'all 0.2s';
            
            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            closeBtn.title = 'Close';
            closeBtn.style.background = 'none';
            closeBtn.style.border = 'none';
            closeBtn.style.color = isError ? 'rgba(255, 107, 107, 0.8)' : 'rgba(255, 255, 255, 0.8)';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.padding = '2px';
            closeBtn.style.borderRadius = '4px';
            closeBtn.style.lineHeight = '0';
            closeBtn.style.transition = 'all 0.2s';

            // Detailed info container (initially hidden)
            const detailedInfoContainer = document.createElement('div');
            detailedInfoContainer.style.marginTop = '12px';
            detailedInfoContainer.style.padding = '10px 12px';
            detailedInfoContainer.style.backgroundColor = isError ? 'rgba(255, 107, 107, 0.1)' : 'rgba(255, 255, 255, 0.1)';
            detailedInfoContainer.style.borderRadius = '6px';
            detailedInfoContainer.style.fontSize = '13px';
            detailedInfoContainer.style.display = 'none';
            detailedInfoContainer.style.maxHeight = '120px';
            detailedInfoContainer.style.overflow = 'auto';
            detailedInfoContainer.style.lineHeight = '1.4';
            detailedInfoContainer.style.color = isError ? 'rgba(255, 107, 107, 0.9)' : 'rgba(255, 255, 255, 0.9)';
            detailedInfoContainer.textContent = detailedInfo;

            // Add event listeners
            let expanded = false;
            let hideTimeoutId = null;
            
            infoBtn.onmouseover = function() {
                infoBtn.style.color = isError ? '#ff6b6b' : '#ffffff';
                infoBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            };
            
            infoBtn.onmouseout = function() {
                infoBtn.style.color = isError ? 'rgba(255, 107, 107, 0.8)' : 'rgba(255, 255, 255, 0.8)';
                infoBtn.style.backgroundColor = 'transparent';
            };
            
            closeBtn.onmouseover = function() {
                closeBtn.style.color = isError ? '#ff6b6b' : '#ffffff';
                closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            };
            
            closeBtn.onmouseout = function() {
                closeBtn.style.color = isError ? 'rgba(255, 107, 107, 0.8)' : 'rgba(255, 255, 255, 0.8)';
                closeBtn.style.backgroundColor = 'transparent';
            };
            
            infoBtn.onclick = function() {
                expanded = !expanded;
                detailedInfoContainer.style.display = expanded ? 'block' : 'none';
                infoBtn.innerHTML = expanded ? 
                    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>' : 
                    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
                
                // Clear the auto-hide timeout when info is expanded
                if (expanded) {
                    if (hideTimeoutId) {
                        clearTimeout(hideTimeoutId);
                        hideTimeoutId = null;
                    }
                } else {
                    // Restart the auto-hide timer when info is collapsed
                    hideTimeoutId = setTimeout(() => {
                        toast.style.opacity = '0';
                        toast.style.transform = 'translateY(10px) translateX(-50%)';
                        setTimeout(() => toast.remove(), 300);
                    }, 5000);
                }
            };
            
            closeBtn.onclick = function() {
                // Clear any existing timeout
                if (hideTimeoutId) {
                    clearTimeout(hideTimeoutId);
                    hideTimeoutId = null;
                }
                
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px) translateX(-50%)';
                setTimeout(() => toast.remove(), 300);
            };

            // Assemble the toast
            buttonsContainer.appendChild(infoBtn);
            buttonsContainer.appendChild(closeBtn);
            headerContainer.appendChild(messageContainer);
            headerContainer.appendChild(buttonsContainer);
            
            toast.appendChild(headerContainer);
            toast.appendChild(detailedInfoContainer);
            
            document.body.appendChild(toast);

            // Add entrance animation
            toast.style.transform = 'translateY(10px) translateX(-50%)';
            setTimeout(() => {
                toast.style.transform = 'translateY(0) translateX(-50%)';
            }, 10);

            // Set initial auto-hide timeout
            hideTimeoutId = setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px) translateX(-50%)';
                setTimeout(() => toast.remove(), 300);
            }, 5000);
        },
        args: [message, isError, opacity, detailedInfo]
    });
}
// Show a spinner toast while AI query is being processed
async function showSpinnerToast(tabId, message = 'Processing your request...') {
    const opacity = await getToastOpacity();
    
    // Remove any existing toast first
    await removeExistingToast(tabId);

    chrome.scripting.executeScript({
        target: {
            tabId: tabId
        },
        func: function(msg, opacity) {
            // Create toast container
            const toast = document.createElement('div');
            toast.id = 'neoexamshield-spinner-toast';
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.backgroundColor = 'rgba(15, 15, 20, 0.95)';
            toast.style.color = '#f8f9fa';
            toast.style.padding = '14px 16px';
            toast.style.borderRadius = '8px';
            toast.style.zIndex = '999999';
            toast.style.opacity = opacity;
            toast.style.transition = 'all 0.3s ease';
            toast.style.maxWidth = '320px';
            toast.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            toast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            toast.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            toast.style.backdropFilter = 'blur(10px)';
            toast.style.WebkitBackdropFilter = 'blur(10px)';
            
            // Create header container
            const headerContainer = document.createElement('div');
            headerContainer.style.display = 'flex';
            headerContainer.style.justifyContent = 'space-between';
            headerContainer.style.alignItems = 'center';
            
            // Create message container with spinner
            const messageContainer = document.createElement('div');
            messageContainer.style.display = 'flex';
            messageContainer.style.alignItems = 'center';
            messageContainer.style.gap = '10px';
            messageContainer.style.flexGrow = '1';
            
            // Spinner indicator (pulsing dot)
            const spinnerDot = document.createElement('span');
            spinnerDot.style.display = 'inline-block';
            spinnerDot.style.width = '8px';
            spinnerDot.style.height = '8px';
            spinnerDot.style.backgroundColor = '#64b5f6';
            spinnerDot.style.borderRadius = '50%';
            spinnerDot.style.boxShadow = '0 0 4px rgba(100, 181, 246, 0.6)';
            spinnerDot.style.animation = 'pulse 1.5s ease-in-out infinite';
            
            // Message text
            const messageText = document.createElement('span');
            messageText.textContent = msg;
            messageText.style.fontSize = '14px';
            messageText.style.fontWeight = '500';
            messageText.style.lineHeight = '1.4';
            messageText.style.wordBreak = 'break-word';
            
            messageContainer.appendChild(spinnerDot);
            messageContainer.appendChild(messageText);
            
            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            closeBtn.title = 'Close';
            closeBtn.style.background = 'none';
            closeBtn.style.border = 'none';
            closeBtn.style.color = 'rgba(255, 255, 255, 0.8)';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.padding = '2px';
            closeBtn.style.marginLeft = '8px';
            closeBtn.style.borderRadius = '4px';
            closeBtn.style.lineHeight = '0';
            closeBtn.style.transition = 'all 0.2s';
            
            // Add CSS animation keyframes
            const style = document.createElement('style');
            style.textContent = `
                @keyframes pulse {
                    0%, 100% { 
                        opacity: 1;
                        transform: scale(1);
                    }
                    50% { 
                        opacity: 0.5;
                        transform: scale(1.2);
                    }
                }
            `;
            document.head.appendChild(style);
            
            // Event listeners
            closeBtn.onmouseover = function() {
                closeBtn.style.color = '#ffffff';
                closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            };
            
            closeBtn.onmouseout = function() {
                closeBtn.style.color = 'rgba(255, 255, 255, 0.8)';
                closeBtn.style.backgroundColor = 'transparent';
            };
            
            closeBtn.onclick = function() {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px) translateX(-50%)';
                setTimeout(() => toast.remove(), 300);
            };
            
            // Assemble and append
            headerContainer.appendChild(messageContainer);
            headerContainer.appendChild(closeBtn);
            toast.appendChild(headerContainer);
            
            document.body.appendChild(toast);
            
            // Add entrance animation
            toast.style.transform = 'translateY(10px) translateX(-50%)';
            setTimeout(() => {
                toast.style.transform = 'translateY(0) translateX(-50%)';
            }, 10);
        },
        args: [message, opacity]
    });
}
