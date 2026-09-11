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

// Handle context menu clicks
function isLoggedIn(callback) {
    chrome.storage.local.get(['loggedIn'], function(result) {
        callback(result.loggedIn);
    });
}

// Function to prompt user to log in
function showLoginPrompt(tabId) {
    showToast(tabId, 'Please log in to use this feature.', true);
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

function handleQueryResponseForIamNeoExamly(response, tabId, isMCQ = false, isHackerRank = false, isMultipleChoice = false, isTyped = false, rawOptions = []) {
    if (response && typeof response === 'string') {
        // Success case - response is the actual text
        if (isMCQ) {
            chrome.tabs.sendMessage(tabId, {
                action: 'clickMCQOption',
                response: response,
                rawOptions: rawOptions,
                isHackerRank: isHackerRank,
                isMultipleChoice: isMultipleChoice
            });

            // MAIN world backup click for rock-solid DOM trigger
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: function(respText) {
                    try {
                        const clean = (respText || '').trim();
                        const optMatch = clean.match(/(?:Option|Choice)\s*[:\-\*]*\s*([1-9]|[A-D])\b/i) ||
                                         clean.match(/(?:Answer|Correct|Ans)\s*(?:is\s*)?(?:Option\s*)?[:\-\*\s]*([1-9]|[A-D])\b/i) ||
                                         clean.match(/^[\s\*#\-]*([1-9]|[A-D])[\.\:\)\s]/i) ||
                                         clean.match(/^[\s\*#\-]*([1-9]|[A-D])[\s\*]*$/i);
                        if (!optMatch) return;
                        const val = optMatch[1].toUpperCase();
                        const idx = isNaN(val) ? (val.charCodeAt(0) - 65) : (parseInt(val, 10) - 1);
                        if (idx < 0) return;

                        let el = document.querySelector('#tt-option-' + idx) ||
                                 document.querySelector('#tt-option-' + (idx + 1));
                        if (!el) {
                            const all = document.querySelectorAll('div[aria-labelledby="each-option"], [id^="tt-option-"]');
                            if (all && all.length > idx) el = all[idx];
                        }
                        if (el) {
                            const inp = el.querySelector('input[type="radio"], input[type="checkbox"]');
                            const chk = el.querySelector('span.checkmark1, .checkmark, label');
                            (chk || inp || el).click();
                            if (inp) {
                                inp.checked = true;
                                inp.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }
                    } catch(e) {}
                },
                args: [response],
                world: 'MAIN'
            }).catch(() => {});
        } else {
            // Clean code block markers and any intro/outro markdown to get 100% pure code
            let cleanedCode = response.trim();
            const codeBlockMatch = cleanedCode.match(/```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)```/);
            if (codeBlockMatch) {
                cleanedCode = codeBlockMatch[1].trim();
            } else {
                cleanedCode = cleanedCode.replace(/^```[a-zA-Z0-9]*\s*\n?/, '').replace(/\n?```\s*$/, '');
            }

            // Copy to clipboard as fallback
            copyToClipboard(cleanedCode);

            // If isTyped is true (Alt+X), initialize Random Key Press Typing Mode
            if (isTyped) {
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: function(code) {
                        if (typeof window._neoExamShieldInitRandomTyping === 'function') {
                            window._neoExamShieldInitRandomTyping(code);
                        }
                    },
                    args: [cleanedCode],
                    world: 'MAIN'
                }).catch(function(err) {
                    console.error('[worker.js] executeScript typing init failed:', err);
                });
                showToast(tabId, 'Typing Mode Ready: Type any keys to write code');
            } else {
                // Alt+T: Fast Instant direct code insertion into Ace editor
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: function(code) {
                        if (typeof window._neopassStartTyping === 'function') {
                            window._neopassStartTyping(code);
                        }
                        var answerEl = document.querySelector('[aria-labelledby="editor-answer"]');
                        if (answerEl && typeof ace !== 'undefined') {
                            try {
                                var ed = ace.edit(answerEl);
                                ed.setValue(code, 1);
                                ed.clearSelection();
                                ed.navigateFileEnd();
                            } catch(e) {}
                        } else if (typeof ace !== 'undefined') {
                            var editors = document.querySelectorAll('.ace_editor');
                            editors.forEach(function(el) {
                                try {
                                    var ed = ace.edit(el);
                                    if (!ed.getReadOnly()) {
                                        ed.setValue(code, 1);
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
                showToast(tabId, 'Code Solution Inserted');
            }

            // Clean up spinner toast
            removeExistingToast(tabId);
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

// Smart API key tracking for fast switching & Gemini free-tier optimization
const keyCooldowns = new Map(); // apiKey -> timestamp until which it's on cooldown
let preferredKey = null; // currently active, fast-responding key

function getPrioritizedConfigs(configs) {
    if (!configs || configs.length <= 1) return configs;
    const now = Date.now();
    const ready = [];
    const cooling = [];

    for (const cfg of configs) {
        const until = keyCooldowns.get(cfg.apiKey) || 0;
        if (now >= until) {
            ready.push(cfg);
        } else {
            cooling.push({ cfg, until });
        }
    }

    // Sort cooling keys by shortest remaining wait time
    cooling.sort((a, b) => a.until - b.until);
    const sortedCooling = cooling.map(c => c.cfg);

    // Prioritize the preferred working key first among ready keys
    if (preferredKey) {
        const prefIdx = ready.findIndex(c => c.apiKey === preferredKey);
        if (prefIdx > 0) {
            const [pk] = ready.splice(prefIdx, 1);
            ready.unshift(pk);
        }
    }

    return [...ready, ...sortedCooling];
}

// Enhanced queryRequest function with comprehensive error handling
// Returns either:
// - String: successful response text
// - Object: { error: string, errorType: string, detailedInfo: string }
async function queryRequest(text, isMCQ = false, isMultipleChoice = false, tabId = null, image = null) {
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
        const customAPIConfigs = await getCustomAPIConfigs();
        
        if (customAPIConfigs.length > 0) {
            const prioritizedConfigs = getPrioritizedConfigs(customAPIConfigs);
            let lastResult = null;
            
            for (const config of prioritizedConfigs) {
                const result = await queryCustomAPI(text, isMCQ, isMultipleChoice, config, image);
                if (typeof result === 'string') {
                    // Fast success: remember working key and clear any cooldown
                    preferredKey = config.apiKey;
                    keyCooldowns.delete(config.apiKey);
                    unblockRequests();
                    return result; // Success
                }
                
                // Track failures: if rate limited (429) or quota exhausted, cool down this key for 45s (free tier 15 RPM)
                const isRateLimit = result && (
                    result.status === 429 || 
                    (result.detailedInfo && result.detailedInfo.toLowerCase().includes('quota')) ||
                    (result.detailedInfo && result.detailedInfo.toLowerCase().includes('resource_exhausted'))
                );
                if (isRateLimit) {
                    keyCooldowns.set(config.apiKey, Date.now() + 45000);
                } else if (result && result.status === 400) {
                    const errStr = ((result.detailedInfo || '') + ' ' + (result.error || '')).toLowerCase();
                    if (errStr.includes('api_key_invalid') || errStr.includes('key not valid') || errStr.includes('invalid api key')) {
                        keyCooldowns.set(config.apiKey, Date.now() + 3600000); // 1 hr for genuinely invalid key
                    }
                }

                if (preferredKey === config.apiKey) {
                    preferredKey = null;
                }

                console.warn("API Key failed, falling back to next...", result);
                lastResult = result;
            }
            unblockRequests();
            return lastResult; // Return the last error if all failed
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
                showToast(tabId, 'Please configure your API key or login with Pro', true, 'Free users must provide their own API keys in the Settings tab. Click the extension icon to configure.');
            }
            
            // Open popup to Pro tab after a short delay
            setTimeout(() => {
                try {
                    chrome.action.openPopup();
                } catch (e) {
                    console.log('Could not open popup automatically:', e.message);
                }
            }, 1000);
            
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

            if (result.customAPIKey && String(result.customAPIKey).trim().length > 0) {
                return resolve([{
                    aiProvider: result.aiProvider || 'google',
                    customEndpoint: result.customEndpoint || '',
                    apiKey: String(result.customAPIKey).trim(),
                    modelName: result.customModelName || ''
                }]);
            }

            // Fallback default API key pool (works out-of-the-box for free tier)
            const defaultKeys = [
                "AQ." + "Ab8RN6J3t6AhS3FkISPJGwFh1ZAhXjUq8Qwjm08Tytmgj47egg",
                "AQ." + "Ab8RN6JrHKAIam58g9156k-s_WDtRWnhXMA7rYS_uYhBweoWtg",
                "AQ." + "Ab8RN6IGp1i-8N286OQYAm9lTkEWwPZIyGY1odW3d4t-H-Zy0A",
                "AQ." + "Ab8RN6LjCd2XuoPvjeZubrfrnRcPIRtyb6uxVJSz-I9o_v0H3w"
            ];
            resolve(defaultKeys.map(key => ({
                aiProvider: 'google',
                customEndpoint: '',
                apiKey: key,
                modelName: 'gemini-3.5-flash'
            })));
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

// Helper to resolve an image (data URL or HTTP/HTTPS URL) to valid base64 data for LLM APIs
async function resolveImageToBase64(imgUrlOrData) {
    if (!imgUrlOrData || typeof imgUrlOrData !== 'string') return null;
    if (imgUrlOrData.startsWith('data:')) {
        const match = imgUrlOrData.match(/^data:([^;]+);base64,(.+)$/s);
        if (match) {
            return { mimeType: match[1], data: match[2] };
        }
        return null;
    }
    if (imgUrlOrData.startsWith('http://') || imgUrlOrData.startsWith('https://')) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            const resp = await fetch(imgUrlOrData, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!resp.ok) return null;
            const blob = await resp.blob();
            const buffer = await blob.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);
            const mimeType = resp.headers.get('content-type') || blob.type || 'image/jpeg';
            return { mimeType: mimeType.split(';')[0], data: base64 };
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
    const defaultModel = 'gemini-3.5-flash';
    const primary = (modelName && String(modelName).trim()) ? String(modelName).trim() : defaultModel;
    const fallbackModels = [primary, 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-flash-latest'];
    const modelsToTry = [...new Set(fallbackModels)];

    let lastError = null;
    for (const currentModel of modelsToTry) {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
        
        const googleParts = [{ text: prompt }];
        for (const img of resolvedImages) {
            if (img && img.data && img.mimeType) {
                googleParts.push({
                    inlineData: {
                        mimeType: img.mimeType,
                        data: img.data
                    }
                });
            }
        }

        const generationConfig = {
            temperature: 0.1,
            maxOutputTokens: isMCQ ? 300 : 4096
        };

        const requestBody = {
            contents: [{ parts: googleParts }],
            generationConfig
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6500);

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text && text.trim().length > 0) {
                    return text.trim();
                }
            } else {
                const errData = await response.json().catch(() => ({}));
                const errMsg = errData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
                
                // If rate limit (429) or quota exhausted, immediately break and return error so key rotation takes over
                if (response.status === 429 || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('resource_exhausted')) {
                    return {
                        error: `Gemini rate limit exceeded: ${response.status}`,
                        errorType: 'api',
                        status: 429,
                        detailedInfo: errMsg
                    };
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
        const resolvedImages = (await Promise.all(imageList.map(img => resolveImageToBase64(img)))).filter(Boolean);
        
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
` + (request.constraints ? `\nConstraints:\n${request.constraints}\n` : '') + `
Respond with ONLY the ${request.programmingLanguage} code:`;
                    } else {
                        // Original prompt for other platforms
                        queryText = `Instructions: You are tasked with solving a programming problem. Respond strictly with the solution code in the required programming language. 
                            Ensure the code: Meets the requirements outlined in the problem statement.
                            Stricly Passes all test cases, including edge cases and boundary conditions.
                            Always get the input from the users.` +
                            `Question:\n${request.question}\n\n` +
                            (request.programmingLanguage ? `Solve Striclty Using This Programing Language:\n${request.programmingLanguage}\n\n` : '') +
                            (request.constraints ? `Constraints:\n${request.constraints}\n\n` : '') +
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

                // Show spinner toast immediately so the user has visual feedback
                showSpinnerToast(sender.tab.id, request.isMCQ ? 'Solving MCQ...' : 'Generating code solution...');

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
                    
                    handleQueryResponseForIamNeoExamly(response, sender.tab.id, request.isMCQ, request.isHackerRank, request.isMultipleChoice, request.isTyped, request.rawOptions);
                    sendResponse({
                        success: true,
                        response,
                        status: 'success'
                    });
                } else if (response && response.error) {
                    // Error case - handle the error through the response handler
                    handleQueryResponseForIamNeoExamly(response, sender.tab.id, request.isMCQ, request.isHackerRank, request.isMultipleChoice, request.isTyped, request.rawOptions);
                    sendResponse({
                        error: response.error,
                        status: 'error',
                        errorType: response.errorType
                    });
                } else {
                    // Fallback case
                    console.error('No response received from AI service');
                    handleQueryResponseForIamNeoExamly(null, sender.tab.id, request.isMCQ, request.isHackerRank, request.isMultipleChoice, false, request.rawOptions);
                    sendResponse({
                        error: 'No response from query service',
                        status: 'error',
                        errorType: 'general'
                    });
                }

            } catch (error) {
                console.error("Query processing error:", error);
                
                removeExistingToast(sender.tab.id);
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
        const customAPIConfigs = await getCustomAPIConfigs();
        
        if (customAPIConfigs.length > 0) {
            let lastResult = null;
            for (const config of customAPIConfigs) {
                const result = await queryCustomAPI(text, isMCQ, isMultipleChoice, config);
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
            document.body.appendChild(toast);

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

// Helper to check if toasts are globally enabled (toggled via Alt+Z)
async function areToastsEnabled() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['toastsEnabled'], (result) => {
            resolve(result.toastsEnabled !== false); // default true
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
            document.body.appendChild(toast);

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
async function showStealthToast(tabId, message, stealthEnabled) {
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
            document.body.appendChild(toast);

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
            showToast(sender.tab.id, newState ? 'Toasts: ON' : 'Toasts: OFF (Silent)', false, '', true);
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
            document.body.appendChild(toast);

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
async function showNPTELToast(tabId, message, isError = false, detailedInfo = '') {
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
            document.body.appendChild(toast);

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
            document.head.appendChild(style);

            toast.appendChild(spinnerDot);
            toast.appendChild(messageText);
            document.body.appendChild(toast);

            setTimeout(() => {
                toast.style.transform = 'translate(-50%, 0)';
            }, 10);
        },
        args: [message, opacity]
    });
}
