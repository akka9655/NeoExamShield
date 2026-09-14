// Production stealth: silence all console logs and errors from extension safely
try {
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
    console.info = () => {};
    console.debug = () => {};
} catch (e) {}

window.addEventListener('blur', function() {
    window.focus();
});

// Declare shared isMac variable (this will be the first to run)
window.isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || 
               navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;

// Automatically enable text selection on all websites
(function() {
    // Function to enable text selection globally
    function enableTextSelectionGlobally() {
        // Remove CSS rules that disable text selection
        const style = document.createElement('style');
        style.id = 'force-text-selection-style';
        style.innerHTML = `
            * {
                -webkit-user-select: text !important;
                -moz-user-select: text !important;
                -ms-user-select: text !important;
                user-select: text !important;
                -webkit-touch-callout: default !important;
            }
            /* Override common classes that disable text selection */
            .no-select, .noselect, .unselectable,
            .qaas-disable-text-selection,
            .qaas-disable-text-selection *,
            [data-disable-text-selection],
            [data-disable-text-selection] *,
            [unselectable="on"],
            [onselectstart],
            [ondragstart] {
                -webkit-user-select: text !important;
                -moz-user-select: text !important;
                -ms-user-select: text !important;
                user-select: text !important;
                -webkit-touch-callout: default !important;
            }
        `;
        
        // Only add if not already present
        if (!document.getElementById('force-text-selection-style')) {
            document.head.appendChild(style);
        }
        
        // Remove specific attributes and classes that disable text selection
        const disabledElements = document.querySelectorAll(`
            .no-select, .noselect, .unselectable,
            .qaas-disable-text-selection, 
            [data-disable-text-selection],
            [unselectable="on"],
            [onselectstart],
            [ondragstart]
        `);
        
        disabledElements.forEach(element => {
            // Remove classes
            element.classList.remove('no-select', 'noselect', 'unselectable', 'qaas-disable-text-selection');
            
            // Remove attributes
            element.removeAttribute('data-disable-text-selection');
            element.removeAttribute('unselectable');
            element.removeAttribute('onselectstart');
            element.removeAttribute('ondragstart');
            
            // Force styles
            element.style.userSelect = 'text';
            element.style.webkitUserSelect = 'text';
            element.style.mozUserSelect = 'text';
            element.style.msUserSelect = 'text';
            element.style.webkitTouchCallout = 'default';
        });
        
        // Override common event handlers that prevent text selection
        document.onselectstart = null;
        document.ondragstart = null;
        document.oncontextmenu = null;
        
        // Remove event listeners that might interfere with text selection
        const body = document.body;
        if (body) {
            body.onselectstart = null;
            body.ondragstart = null;
        }
    }
    
    // Apply immediately
    enableTextSelectionGlobally();
    
    // Apply when DOM is fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', enableTextSelectionGlobally);
    }
    
    // Re-apply when new content is added (for dynamic websites)
    const observer = new MutationObserver(function(mutations) {
        let shouldReapply = false;
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Check if any added nodes have text selection disabled
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const hasDisabledSelection = node.matches && node.matches(`
                            .no-select, .noselect, .unselectable,
                            .qaas-disable-text-selection,
                            [data-disable-text-selection],
                            [unselectable="on"],
                            [onselectstart],
                            [ondragstart]
                        `);
                        if (hasDisabledSelection || node.querySelector) {
                            shouldReapply = true;
                        }
                    }
                });
            }
        });
        
        if (shouldReapply) {
            enableTextSelectionGlobally();
        }
    });
    
    // Start observing
    observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
    });
})();

// Function to convert HTML to readable text with proper formatting
function htmlToText(element) {
    if (!element) return '';
    
    // Clone the element to avoid modifying the original
    const clone = element.cloneNode(true);
    
    // Handle superscripts - convert <sup>text</sup> to ^text
    clone.querySelectorAll('sup').forEach(sup => {
        sup.textContent = '^' + sup.textContent;
    });
    
    // Handle subscripts - convert <sub>text</sub> to _text
    clone.querySelectorAll('sub').forEach(sub => {
        sub.textContent = '_' + sub.textContent;
    });
    
    // Handle line breaks
    clone.querySelectorAll('br').forEach(br => {
        br.replaceWith('\n');
    });
    
    // Get the text content
    return clone.innerText.trim();
}

// Robust multi-selector helpers for question and option containers
function findQuestionElement() {
    return document.querySelector('div[aria-labelledby="question-data"]') ||
           document.querySelector('testtaking-question .ql-editor') ||
           document.querySelector('div.ql-editor') ||
           document.querySelector('[aria-labelledby="question-answer"] .ql-editor') ||
           document.querySelector('[aria-labelledby="question-answer"]') ||
           document.querySelector('.question-view') ||
           document.querySelector('.grouped-mcq__question');
}

function findOptionElements() {
    // Check 1: aria-labelledby="each-option"
    let opts = document.querySelectorAll('div[aria-labelledby="each-option"]');
    if (opts && opts.length > 0) return Array.from(opts);

    // Check 2: tt-option-* elements
    opts = document.querySelectorAll('[id^="tt-option-"]');
    if (opts && opts.length > 0) return Array.from(opts);

    // Check 3: each-option-card / each-option container
    opts = document.querySelectorAll('[aria-labelledby="each-option-card"], [aria-labelledby="each-option-container"], .each-option');
    if (opts && opts.length > 0) return Array.from(opts);

    // Check 4: testtaking-options or radio/checkbox groups
    opts = document.querySelectorAll('testtaking-options .t-flex.t-flex-row, .grouped-mcq__options label, [role="radiogroup"] [role="radio"]');
    if (opts && opts.length > 0) return Array.from(opts);

    // Check 5: Look for radio or checkbox inputs strictly inside testtaking-options or MCQ containers
    const inputs = document.querySelectorAll('testtaking-options input[type="radio"], testtaking-options input[type="checkbox"], div[aria-labelledby="testtaking-options"] input, .grouped-mcq input, [aria-labelledby="question-answer"] input[type="radio"], [aria-labelledby="question-answer"] input[type="checkbox"]');
    if (inputs && inputs.length > 0) {
        const optionContainers = [];
        inputs.forEach(inp => {
            const parent = inp.closest('[aria-labelledby*="option"], [id*="option"], label, .t-cursor-pointer, .t-flex') || inp.parentElement;
            if (parent && !optionContainers.includes(parent)) {
                optionContainers.push(parent);
            }
        });
        if (optionContainers.length > 0) return optionContainers;
    }

    return [];
}

// Helper to extract diagrams/images synchronously without hanging on cross-origin fetches
function extractImagesFromElement(container) {
    if (!container) return [];
    const imgs = container.querySelectorAll('img');
    const images = [];

    for (const img of imgs) {
        // Filter out tiny icons, decorative curve SVGs, UI indicators (< 25px)
        const isIcon = (img.width > 0 && img.width < 25) || 
                       (img.height > 0 && img.height < 25) ||
                       (img.src && (
                           img.src.includes('clock.svg') || 
                           img.src.includes('test_curve.svg') ||
                           img.src.includes('next.svg') ||
                           img.src.includes('arrow_down.svg') ||
                           img.src.includes('pattern.png') ||
                           img.src.includes('user-pic')
                       ));
        
        if (isIcon) continue;

        if (img.src) {
            if (img.src.startsWith('data:image/')) {
                images.push(img.src);
            } else if (img.src.startsWith('http://') || img.src.startsWith('https://')) {
                let exported = false;
                try {
                    if (img.complete && img.naturalWidth > 20) {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        images.push(canvas.toDataURL('image/jpeg', 0.85));
                        exported = true;
                    }
                } catch (e) {
                    // Tainted canvas on cross-origin images (expected)
                }
                // If canvas cannot export due to CORS, pass the full URL.
                // worker.js has host_permissions (*://*/*) and will fetch/convert to base64 seamlessly.
                if (!exported) {
                    images.push(img.src);
                }
            }
        }
    }

    return images;
}

// Function to extract the question, code, and options
function extractQuestionCodeAndOptions() {
    // Extracting the question text
    const questionElement = findQuestionElement();
    const questionText = questionElement ? htmlToText(questionElement) : '';

    // Extracting the code
    const codeLines = [];
    const codeElements = document.querySelectorAll('.ace_layer.ace_text-layer .ace_line');

    codeElements.forEach(line => {
        codeLines.push(line.innerText.trim());
    });

    const codeText = codeLines.length > 0 ? codeLines.join('\n') : null;

    // Extracting options
    const optionsElements = findOptionElements();
    const optionsText = [];
    optionsElements.forEach((option, index) => {
        optionsText.push(`Option ${index + 1}: ${htmlToText(option)}`);
    });

    return {
        question: questionText,
        code: codeText,
        options: optionsText.join('\n')
    };
}

// MCQ state tracking for Alt+A (solve/reveal) and Alt+S (human-like click only)
let lastSolvedMCQ = null;
let isMCQSolving = false;
let pendingMCQAutoClick = false;
let currentActiveQuestionSignature = '';
let activeMCQMode = 'autoSelect';

// Helper to get a unique signature of the currently visible question
function getQuestionSignature() {
    try {
        const qEl = findQuestionElement();
        const qText = qEl ? htmlToText(qEl).trim() : '';
        const optEls = findOptionElements();
        const optsText = Array.from(optEls).map(el => {
            const clone = el.cloneNode(true);
            clone.querySelectorAll('#neo-mcq-dot').forEach(d => d.remove());
            return htmlToText(clone).trim();
        }).filter(Boolean).join('|||');

        if (!qText && !optsText) return '';
        return `${qText.substring(0, 300)}:::${optsText.substring(0, 300)}`;
    } catch (e) {
        return '';
    }
}

// Function to handle when question changes to a new one
function checkAndHandleQuestionChange() {
    const newSig = getQuestionSignature();
    if (newSig && currentActiveQuestionSignature && newSig !== currentActiveQuestionSignature) {
        currentActiveQuestionSignature = newSig;
        lastSolvedMCQ = null;
        isMCQSolving = false;
        pendingMCQAutoClick = false;
        removeMCQDot();
    } else if (newSig && !currentActiveQuestionSignature) {
        currentActiveQuestionSignature = newSig;
    }
}

// Check for question change periodically and on navigation clicks
setInterval(checkAndHandleQuestionChange, 400);

document.addEventListener('click', (e) => {
    const navClick = e.target.closest('button, [tooltip], .back-btn, [id*="question"], [id*="section"], [aria-labelledby*="question"], [aria-labelledby*="section"], .t-cursor-pointer, .t-rounded-full');
    if (navClick) {
        checkAndHandleQuestionChange();
        setTimeout(checkAndHandleQuestionChange, 50);
        setTimeout(checkAndHandleQuestionChange, 150);
        setTimeout(checkAndHandleQuestionChange, 300);
    }
}, true);

// Function to handle question, code, and options extraction with full image & diagram support
async function handleQuestionExtraction(autoClick = true) {
    console.log('[MCQ] Starting question extraction with autoClick =', autoClick);
    checkAndHandleQuestionChange();
    currentActiveQuestionSignature = getQuestionSignature();
    isMCQSolving = true;
    pendingMCQAutoClick = Boolean(autoClick);

    // 1. Extract question text
    const questionElement = findQuestionElement();
    const questionText = questionElement ? htmlToText(questionElement) : '';

    // 2. Extract code
    const codeLines = [];
    const codeElements = document.querySelectorAll('.ace_layer.ace_text-layer .ace_line');
    codeElements.forEach(line => codeLines.push(line.innerText.trim()));
    const codeText = codeLines.length > 0 ? codeLines.join('\n') : null;

    // 3. Extract question diagrams first
    const allImages = [];
    let imageCounter = 1;
    const visualGuide = [];

    if (questionElement) {
        const qImages = extractImagesFromElement(questionElement);
        for (const img of qImages) {
            allImages.push(img);
            visualGuide.push(`[Image ${imageCounter++}: Question diagram]`);
        }
    }

    // 4. Extract options and option images specifically
    const optionsElements = findOptionElements();
    const optionsText = [];
    const rawOptions = [];

    for (let index = 0; index < optionsElements.length; index++) {
        const opt = optionsElements[index];
        const rawText = htmlToText(opt);
        rawOptions.push(rawText);
        const optImages = extractImagesFromElement(opt);
        
        let label = `Option ${index + 1}`;
        if (optImages.length > 0) {
            const startRef = imageCounter;
            for (const img of optImages) {
                allImages.push(img);
                visualGuide.push(`[Image ${imageCounter++}: Choice for ${label}]`);
            }
            const refText = optImages.length === 1 ? `Image ${startRef}` : `Images ${startRef}-${imageCounter - 1}`;
            optionsText.push(`${label} (Visual: see ${refText}): ${rawText || '(Image Option)'}`);
        } else {
            optionsText.push(`${label}: ${rawText}`);
        }
    }

    if (!questionText && optionsText.length === 0 && allImages.length === 0) {
        console.warn('[MCQ] No question or options detected on page.');
        isMCQSolving = false;
        pendingMCQAutoClick = false;
        chrome.runtime.sendMessage({
            action: 'showMCQToast',
            message: 'No MCQ detected. Make sure an MCQ question is open.'
        });
        return;
    }

    let finalQuestion = questionText;
    if (!finalQuestion && allImages.length > 0) {
        finalQuestion = "Analyze the provided question diagram/image carefully and select the correct option.";
    }
    if (visualGuide.length > 0) {
        finalQuestion += `\n\n[Visual Attachments: ${visualGuide.join(', ')}]`;
    }

    console.log('[MCQ] Final Question:', finalQuestion);
    console.log('[MCQ] Options:\n', optionsText.join('\n'));
    console.log('[MCQ] Total Diagrams/Images:', allImages.length);

    chrome.runtime.sendMessage({
        action: 'extractData',
        question: finalQuestion,
        code: codeText,
        options: optionsText.join('\n'),
        rawOptions: rawOptions,
        images: allImages,
        isMCQ: true,
        autoClick: autoClick
    });
}

// Function to extract coding question details
async function extractCodingQuestion(isTyped = false) {
    // Extract programming language
    const programmingLanguageElement = document.querySelector('span.inner-text');
    let programmingLanguage = programmingLanguageElement ? programmingLanguageElement.innerText.trim() : 'Programming language not found.';
    programmingLanguage = programmingLanguage.replace(/\s*\(\d+\)/g, '').trim();

    // Extract question components
    const questionElement = document.querySelector('div[aria-labelledby="question-data"]');
    const questionText = questionElement ? htmlToText(questionElement) : 'Question not found.';
    const images = await extractImagesFromElement(questionElement);

    const constraintsElement = document.querySelector('div[aria-labelledby="code-constraints"], div[aria-labelledby="constraints"]');
    const constraintsText = constraintsElement ? htmlToText(constraintsElement) : '';

    const inputFormatElement = document.querySelector('div[aria-labelledby="input-format"]');
    const inputFormatText = inputFormatElement ? htmlToText(inputFormatElement) : '';

    const outputFormatElement = document.querySelector('div[aria-labelledby="output-format"]');
    const outputFormatText = outputFormatElement ? htmlToText(outputFormatElement) : '';

    // Extract sample test cases with robust fallback method
    const testCases = [];
    
    // Try Method 1: Find test case containers with aria-labelledby="each-tc-card"
    let containers = document.querySelectorAll('div[aria-labelledby="each-tc-card"]');
    
    if (containers.length > 0) {
        console.log('[Test Cases] Method 1: Found', containers.length, 'test case containers');
        containers.forEach((container) => {
            const inputPre = container.querySelector('div[aria-labelledby="each-tc-input-container"] pre');
            const outputPre = container.querySelector('div[aria-labelledby="each-tc-output-container"] pre');
            
            if (inputPre && outputPre) {
                testCases.push({
                    input: inputPre.textContent.trim(),
                    output: outputPre.textContent.trim()
                });
            }
        });
    }
    
    // Try Method 2: Find by aria-labelledby="each-tc-container"
    if (testCases.length === 0) {
        console.log('[Test Cases] Method 1 failed. Trying Method 2...');
        containers = document.querySelectorAll('[aria-labelledby="each-tc-container"]');
        
        if (containers.length > 0) {
            console.log('[Test Cases] Method 2: Found', containers.length, 'test case containers');
            containers.forEach((container) => {
                const inputPre = container.querySelector('[aria-labelledby="each-tc-input"]');
                const outputPre = container.querySelector('[aria-labelledby="each-tc-output"]');
                
                if (inputPre && outputPre) {
                    testCases.push({
                        input: inputPre.textContent.trim(),
                        output: outputPre.textContent.trim()
                    });
                }
            });
        }
    }
    
    // Try Method 3: Find pre elements with Input/Output labels
    if (testCases.length === 0) {
        console.log('[Test Cases] Method 2 failed. Trying Method 3...');
        const allPres = document.querySelectorAll('pre');
        const inputs = [];
        const outputs = [];
        
        allPres.forEach(pre => {
            const text = pre.textContent.trim();
            const prevElement = pre.previousElementSibling;
            
            if (prevElement) {
                const labelText = prevElement.textContent.toLowerCase();
                if (labelText.includes('input') && !labelText.includes('output')) {
                    inputs.push(text);
                } else if (labelText.includes('output')) {
                    outputs.push(text);
                }
            }
        });
        
        console.log('[Test Cases] Method 3: Found', inputs.length, 'inputs and', outputs.length, 'outputs');
        
        // Pair inputs and outputs
        for (let i = 0; i < Math.min(inputs.length, outputs.length); i++) {
            testCases.push({
                input: inputs[i],
                output: outputs[i]
            });
        }
    }
    
    let testCasesText = '';
    if (testCases.length > 0) {
        testCases.forEach((testCase, index) => {
            testCasesText += `Sample Test Case ${index + 1}:\nInput:\n${testCase.input}\nOutput:\n${testCase.output}\n\n`;
        });
        console.log('[Test Cases] Successfully extracted', testCases.length, 'test cases');
    } else {
        console.warn('[Test Cases] All methods failed. No test cases extracted.');
        testCasesText = 'No test cases found. Please check the page structure.';
    }

    // Extract whitelist keywords from instruction cards
    let whitelistText = '';
    const instructionCards = document.querySelectorAll('div[aria-labelledby="instruction-card"]');
    instructionCards.forEach(card => {
        const header = card.querySelector('[aria-labelledby="instruction-header"]');
        if (header && header.textContent.trim().toLowerCase().includes('whitelist')) {
            const sets = card.querySelectorAll('[aria-labelledby="list"]');
            sets.forEach(set => {
                const setHeader = set.querySelector('[aria-labelledby="set-header"]');
                const values = set.querySelectorAll('[aria-labelledby="list-value-card"]');
                const keywords = Array.from(values).map(v => v.textContent.trim()).filter(Boolean);
                if (keywords.length > 0) {
                    const setName = setHeader ? setHeader.textContent.trim() : '';
                    whitelistText += (setName ? setName + ' ' : '') + keywords.join(', ') + '\n';
                }
            });
        }
    });
    whitelistText = whitelistText.trim();

    // Extract header and footer snippet code from readonly editors
    let headerSnippet = '';
    let footerSnippet = '';
    const headerEditorEl = document.querySelector('[aria-labelledby="editor-question"][id*="ttHeaderEditor"]');
    const footerEditorEl = document.querySelector('[aria-labelledby="editor-question"][id*="ttFooterEditor"]');
    if (headerEditorEl) {
        const headerLines = headerEditorEl.querySelectorAll('.ace_line');
        headerSnippet = Array.from(headerLines).map(line => line.textContent).join('\n').trim();
    }
    if (footerEditorEl) {
        const footerLines = footerEditorEl.querySelectorAll('.ace_line');
        footerSnippet = Array.from(footerLines).map(line => line.textContent).join('\n').trim();
    }

    // Send data to background.js for querying
    chrome.runtime.sendMessage({
        action: 'extractData',
        programmingLanguage: programmingLanguage,
        question: questionText,
        constraints: constraintsText,
        inputFormat: inputFormatText,
        outputFormat: outputFormatText,
        testCases: testCasesText,
        headerSnippet: headerSnippet,
        footerSnippet: footerSnippet,
        whitelist: whitelistText,
        images: images,
        isCoding: true,
        isTyped: isTyped
    }, (response) => {
        // Injection is handled directly by worker.js via chrome.scripting.executeScript.
        // Silently ignore errors - do NOT log to page console to prevent telemetry detection.
    });
}

// Throttle guard to prevent rapid accidental double-triggering while allowing quick action switching
const lastActionTimestamps = {};
function isActionThrottled(actionType = 'default') {
    const now = Date.now();
    const last = lastActionTimestamps[actionType] || 0;
    if (now - last < 600) {
        return true;
    }
    lastActionTimestamps[actionType] = now;
    return false;
}

// Helper to accurately detect if current page is a coding question vs an MCQ
function isCodingQuestionPage() {
    // 1. Explicit coding elements on Examly / Iamneo / HackerRank
    const codingElement = document.querySelector('programming-question, programming-answer, #programme-compile, app-language-dropdown, div[aria-labelledby="code-constraints"], div[aria-labelledby="input-format"], div[aria-labelledby="editor-answer"], [id*="ttAnswerEditor"], .hr-monaco-editor, .monaco-editor');
    if (codingElement) return true;

    // 2. Ace editor (must be visible/active)
    const aceEl = document.querySelector('.ace_editor');
    if (aceEl && (aceEl.offsetWidth > 0 || aceEl.offsetHeight > 0)) {
        return true;
    }

    // 3. If MCQ options exist on the page, it is an MCQ
    const optionElements = findOptionElements();
    if (optionElements && optionElements.length > 0) return false;
    if (document.querySelector('[id^="tt-option-"], div[aria-labelledby="each-option"], [aria-labelledby="each-option-card"], .grouped-mcq__options, [role="radiogroup"], testtaking-options')) {
        return false;
    }

    return false;
}

function solveIamneoExamly(){
    // Check if on HackerRank (strictly via hostname)
    const isHackerRankSite = window.location.hostname.includes('hackerrank.com') || window.location.hostname.includes('hackerrank');
    if (isHackerRankSite) {
        handleHackerRankMCQ(false);
        return;
    }

    // Check if this is a coding question or MCQ
    if (isCodingQuestionPage()) {
        extractCodingQuestion(false);
    } else {
        handleQuestionExtraction(false); // Alt+A: solve & show small dot indicator
    }
}

// Alt+A (Option+A on macOS): Solve MCQ or Coding question (Reveal mode: shows small dot, NEVER clicks)
document.addEventListener('keydown', (event) => {
    const modifierKey = event.altKey;
    const isKeyA = event.code === 'KeyA' || 
                   (event.key && event.key.toLowerCase() === 'a') || 
                   event.keyCode === 65 || event.which === 65 ||
                   event.key === 'å' || event.key === 'Å';

    if (modifierKey && !event.ctrlKey && !event.shiftKey && !event.metaKey && isKeyA) {
        event.preventDefault();
        event.stopPropagation();
        if (isActionThrottled('alt_a')) return;
        activeMCQMode = 'reveal';
        solveIamneoExamly();
    }
}, true); // useCapture: true to intercept before portal listeners

// Alt+S (Option+S on macOS): Auto-select the correct MCQ option like a human (Auto-select mode: clicks option, NEVER shows dot)
document.addEventListener('keydown', (event) => {
    const modifierKey = event.altKey;
    const isKeyS = event.code === 'KeyS' || 
                   (event.key && event.key.toLowerCase() === 's') || 
                   event.keyCode === 83 || event.which === 83 ||
                   event.key === 'ß' || event.key === 'Ó' || event.key === 'ó';

    if (modifierKey && !event.ctrlKey && !event.shiftKey && !event.metaKey && isKeyS) {
        event.preventDefault();
        event.stopPropagation();
        if (isActionThrottled('alt_s')) return;

        if (isCodingQuestionPage()) {
            return;
        }

        activeMCQMode = 'autoSelect';
        removeMCQDot(); // Remove any dot from prior Alt+A immediately

        checkAndHandleQuestionChange();
        const currentSig = getQuestionSignature();
        const currentQEl = findQuestionElement();
        const currentQText = currentQEl ? htmlToText(currentQEl).trim() : '';

        // Check if we have a valid solved answer matching the CURRENT question
        const isMatch = lastSolvedMCQ && lastSolvedMCQ.optionIndex !== null && lastSolvedMCQ.optionIndex >= 0 && (
            (lastSolvedMCQ.signature && currentSig && lastSolvedMCQ.signature === currentSig) ||
            (lastSolvedMCQ.questionText && currentQText && (
                lastSolvedMCQ.questionText === currentQText ||
                lastSolvedMCQ.questionText.includes(currentQText.substring(0, 40)) ||
                currentQText.includes(lastSolvedMCQ.questionText.substring(0, 40))
            )) ||
            (!currentSig && !currentQText)
        );

        if (isMatch) {
            console.log('[Alt+S] Instantly auto-selecting previously solved MCQ option:', lastSolvedMCQ.optionIndex);
            autoSelectMCQOption(lastSolvedMCQ.optionIndex, lastSolvedMCQ.isHackerRank, lastSolvedMCQ.isMultipleChoice, lastSolvedMCQ.uniqueOptionNumbers);
            return;
        }

        // If AI is currently solving this question, queue auto-click so it clicks as soon as AI finishes
        if (isMCQSolving) {
            console.log('[Alt+S] AI is currently solving - queued auto-click');
            pendingMCQAutoClick = true;
            return;
        }

        // If AI hasn't solved this question yet, trigger solve with auto-click enabled
        console.log('[Alt+S] Triggering AI solve and auto-select');
        pendingMCQAutoClick = true;
        const isHackerRankSite = window.location.hostname.includes('hackerrank.com') || window.location.hostname.includes('hackerrank');
        if (isHackerRankSite) {
            handleHackerRankMCQ(true);
        } else {
            handleQuestionExtraction(true);
        }
    }
}, true); // useCapture: true to intercept before portal listeners



// Alt+T (Option+T on macOS): Instant code insertion into editor
document.addEventListener('keydown', (event) => {
    const modifierKey = event.altKey;
    const isKeyT = event.code === 'KeyT' || 
                   (event.key && event.key.toLowerCase() === 't') ||
                   event.keyCode === 84 || event.which === 84 ||
                   event.key === '†';

    if (modifierKey && !event.ctrlKey && !event.shiftKey && !event.metaKey && isKeyT) {
        event.preventDefault();
        event.stopPropagation();
        if (isActionThrottled('alt_t')) return;

        const isHackerRankSite = window.location.hostname.includes('hackerrank.com') || window.location.hostname.includes('hackerrank');
        if (isHackerRankSite) {
            handleHackerRankMCQ(false);
            return;
        }

        // Only fetch if this is a coding question
        if (!isCodingQuestionPage()) return;

        extractCodingQuestion(false); // Direct instant mode
    }
}, true); // useCapture: true to intercept before portal listeners

// Alt+X (Option+X on macOS): Random Key Press Typing Mode (Hacker Typer mode)
document.addEventListener('keydown', (event) => {
    const modifierKey = event.altKey;
    const isKeyX = event.code === 'KeyX' || 
                   (event.key && event.key.toLowerCase() === 'x') ||
                   event.keyCode === 88 || event.which === 88 ||
                   event.key === '≈';

    if (modifierKey && !event.ctrlKey && !event.shiftKey && !event.metaKey && isKeyX) {
        event.preventDefault();
        event.stopPropagation();
        if (isActionThrottled('alt_x')) return;

        if (!isCodingQuestionPage()) return;

        extractCodingQuestion(true); // Random key press typing mode
    }
}, true); // useCapture: true to intercept before portal listeners

// Alt+C (Option+C on macOS): Toggle AI Chatbot & Stop Typing Mode
document.addEventListener('keydown', (event) => {
    const modifierKey = event.altKey;
    const isKeyC = event.code === 'KeyC' || 
                   (event.key && event.key.toLowerCase() === 'c') ||
                   event.keyCode === 67 || event.which === 67 ||
                   event.key === 'ç' || event.key === 'Ç';

    if (modifierKey && !event.ctrlKey && !event.shiftKey && !event.metaKey && isKeyC) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('neoStopTyping'));
        window.dispatchEvent(new CustomEvent('neoToggleChat'));
    }
}, true); // useCapture: true to intercept before portal listeners

// Alt+Z (Option+Z on macOS): Toggle Toast Visibility (Color Toast ON/OFF)
document.addEventListener('keydown', (event) => {
    const modifierKey = event.altKey;
    const isKeyZ = event.code === 'KeyZ' || 
                   (event.key && event.key.toLowerCase() === 'z') ||
                   event.keyCode === 90 || event.which === 90 ||
                   event.key === 'Ω';

    if (modifierKey && !event.ctrlKey && !event.shiftKey && !event.metaKey && isKeyZ) {
        event.preventDefault();
        event.stopPropagation();
        chrome.runtime.sendMessage({
            action: 'toggleToastVisibility'
        });
    }
}, true); // useCapture: true to intercept before portal listeners

// Listen for typing events from exam.js
window.addEventListener('neoTypingComplete', () => {
    chrome.runtime.sendMessage({
        action: 'showCustomToast',
        message: 'Code Typing Complete!'
    });
});

window.addEventListener('neoTypingStopped', () => {
    chrome.runtime.sendMessage({
        action: 'showCustomToast',
        message: 'Typing Mode Stopped'
    });
});

// Add event listener for Alt+O to toggle toast opacity.
document.addEventListener('keydown', (event) => {
    const modifierKey = event.altKey;
    const isKeyO = event.code === 'KeyO' || 
                   (event.key && event.key.toLowerCase() === 'o') ||
                   event.keyCode === 79 || event.which === 79 ||
                   event.key === 'ø' || event.key === 'Ø';
    
    if (modifierKey && !event.ctrlKey && !event.shiftKey && !event.metaKey && isKeyO) {
        event.preventDefault();
        chrome.runtime.sendMessage({
            action: 'toggleToastOpacity'
        });
    }
});

// Function to extract code from snippets
function extractSnippets() {
    const headerContainer = Array.from(document.querySelectorAll('div[aria-labelledby="tt-header"]'))
        .find(container => container.innerText.includes('Header Snippet'));
    const footerContainer = Array.from(document.querySelectorAll('div[aria-labelledby="footer"]'))
        .find(container => container.innerText.includes('Footer Snippet'));

    const extractCode = container => {
        if (!container) return '';
        const codeLines = container.querySelectorAll('.ace_line');
        return Array.from(codeLines).map(line => line.textContent).join('\n');
    };

    const snippets = {
        header: extractCode(headerContainer),
        footer: extractCode(footerContainer)
    };

    // Send snippets directly to background.js
    chrome.runtime.sendMessage({
        action: 'processSnippets',
        snippets: snippets
    });
}

// Remove old listener and add new one
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractSnippets') {
        extractSnippets();
    }
    if (message.action === 'solveIamneoExamly') {
        solveIamneoExamly();
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateChatHistory") {
        const { role, content } = message;
        
        // Remove loading indicator if it exists
        const loadingMessage = document.getElementById("loading-message");
        if (loadingMessage) {
            loadingMessage.remove();
        }
        
        // Add the actual message
        chatHistory.push({
            role: role,
            content: content
        });
        addMessageToChat(content, role);
    }
});

// High-accuracy multi-tier MCQ answer parser
function parseMCQAnswer(response, rawOptionTexts = []) {
    if (!response || typeof response !== 'string') return null;
    const clean = response.trim();

    // 1. Explicit "Option X" or "Choice X" pattern
    const optMatch = clean.match(/(?:Option|Choice)\s*[:\-\*]*\s*([1-9]|[A-D])\b/i);
    if (optMatch) {
        const val = optMatch[1].toUpperCase();
        return isNaN(val) ? (val.charCodeAt(0) - 65) : (parseInt(val, 10) - 1);
    }

    // 2. Explicit "Answer is X" or "Correct: X" or "Ans: X"
    const ansMatch = clean.match(/(?:Answer|Correct|Ans)\s*(?:is\s*)?(?:Option\s*)?[:\-\*\s]*([1-9]|[A-D])\b/i);
    if (ansMatch) {
        const val = ansMatch[1].toUpperCase();
        return isNaN(val) ? (val.charCodeAt(0) - 65) : (parseInt(val, 10) - 1);
    }

    // 3. Leading number or letter: "1. True", "B) 42", "2: foo"
    const startMatch = clean.match(/^[\s\*#\-]*([1-9]|[A-D])[\.\:\)\s]/i);
    if (startMatch) {
        const val = startMatch[1].toUpperCase();
        return isNaN(val) ? (val.charCodeAt(0) - 65) : (parseInt(val, 10) - 1);
    }

    // 4. Whole response is just a single number (1-9) or letter (A-D)
    const exactMatch = clean.match(/^[\s\*#\-]*([1-9]|[A-D])[\s\*]*$/i);
    if (exactMatch) {
        const val = exactMatch[1].toUpperCase();
        return isNaN(val) ? (val.charCodeAt(0) - 65) : (parseInt(val, 10) - 1);
    }

    // 5. Match against actual option texts
    if (Array.isArray(rawOptionTexts) && rawOptionTexts.length > 0) {
        for (let i = 0; i < rawOptionTexts.length; i++) {
            const optText = (rawOptionTexts[i] || '').trim();
            if (optText.length > 1 && clean.toLowerCase().includes(optText.toLowerCase())) {
                return i;
            }
        }
    }

    // 6. Fallback: isolated single digit or letter
    const fallbackMatch = clean.match(/\b([1-4]|[A-D])\b/i);
    if (fallbackMatch) {
        const val = fallbackMatch[1].toUpperCase();
        return isNaN(val) ? (val.charCodeAt(0) - 65) : (parseInt(val, 10) - 1);
    }

    return null;
}

// Discreet small blue dot indicator for MCQ options (Alt+A)
function removeMCQDot() {
    try {
        const dots = document.querySelectorAll('#neo-mcq-dot');
        dots.forEach(dot => dot.remove());
    } catch (e) {}
}

function showMCQSmallDot(optionIndex, shouldClear = true) {
    if (optionIndex === null || optionIndex === undefined || optionIndex < 0) return null;
    if (shouldClear) {
        removeMCQDot();
    }

    // Locate target option container
    const optionElements = findOptionElements();
    let target = null;
    if (optionElements && optionElements.length > optionIndex) {
        target = optionElements[optionIndex];
    }
    if (!target) {
        target = document.querySelector(`#tt-option-${optionIndex}`) ||
                 document.querySelector(`#tt-option-${optionIndex + 1}`) ||
                 document.querySelector(`div[aria-labelledby="each-option"]:nth-of-type(${optionIndex + 1})`);
    }
    if (!target) {
        const hrRadios = document.querySelectorAll('[role="radio"], [role="checkbox"]');
        if (hrRadios && hrRadios.length > optionIndex) {
            target = hrRadios[optionIndex];
        }
    }

    if (!target) return null;

    // Locate the radio checkmark / bullet inside target
    let checkmarkEl = target.querySelector('span.checkmark1, .checkmark, .checkmark-custom');
    if (!checkmarkEl) {
        checkmarkEl = document.querySelector(`#tt-option-${optionIndex} span.checkmark1`) ||
                      document.querySelector(`#tt-option-${optionIndex + 1} span.checkmark1`);
    }
    if (!checkmarkEl) {
        checkmarkEl = target.querySelector('[role="radio"], [role="checkbox"]');
    }

    // Create the tiny small blue dot element (discreet 6px circle)
    const dot = document.createElement('span');
    dot.id = 'neo-mcq-dot';
    dot.style.cssText = 'display: inline-block !important; width: 6px !important; height: 6px !important; min-width: 6px !important; min-height: 6px !important; max-width: 6px !important; max-height: 6px !important; background-color: #2563eb !important; border-radius: 50% !important; pointer-events: none !important; position: absolute !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; z-index: 99999 !important; box-shadow: 0 0 2px rgba(37, 99, 235, 0.7) !important;';

    let anchor = checkmarkEl;
    if (anchor && anchor.tagName && anchor.tagName.toLowerCase() !== 'input') {
        try {
            const computedPos = window.getComputedStyle(anchor).position;
            if (computedPos === 'static') {
                anchor.style.setProperty('position', 'relative', 'important');
            }
            anchor.appendChild(dot);
        } catch (e) {
            try { target.appendChild(dot); } catch (err) {}
        }
    } else {
        const labelOrTarget = target.querySelector('label') || target;
        try {
            const computedPos = window.getComputedStyle(labelOrTarget).position;
            if (computedPos === 'static') {
                labelOrTarget.style.setProperty('position', 'relative', 'important');
            }
            dot.style.left = '12px';
            dot.style.transform = 'translateY(-50%)';
            labelOrTarget.appendChild(dot);
        } catch (e) {
            try { target.appendChild(dot); } catch (err) {}
        }
    }

    try {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {}

    return dot;
}

// Backward compatibility alias for showMCQSmallDot
function highlightMCQOption(optionIndex) {
    return showMCQSmallDot(optionIndex, true);
}

// Helper to dispatch a complete, realistic human pointer & click sequence
function dispatchHumanClick(el) {
    if (!el) return;
    try {
        el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window }));
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    } catch (e) {
        try {
            el.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
        } catch (e2) {}
    }
    try {
        el.click();
    } catch (e) {}
}

// Deep click selector that firmly clicks and selects the MCQ option on the portal
function autoSelectMCQOption(optionIndex, isHackerRank = false, isMultipleChoice = false, uniqueOptionNumbers = null) {
    if (optionIndex === null || optionIndex === undefined || optionIndex < 0) return false;

    console.log(`[MCQ Auto-Select] Auto-selecting option index ${optionIndex}`);

    // Remove any previous dot/UI so auto-select has zero extra UI
    removeMCQDot();

    // HackerRank platform handling
    if (isHackerRank) {
        if (isMultipleChoice && Array.isArray(uniqueOptionNumbers)) {
            const checkboxes = document.querySelectorAll('[role="checkbox"]');
            uniqueOptionNumbers.forEach(idx => {
                if (checkboxes[idx]) {
                    const isCurrentlyChecked = checkboxes[idx].getAttribute('aria-checked') === 'true' || 
                                             checkboxes[idx].getAttribute('data-state') === 'checked' ||
                                             checkboxes[idx].checked === true;
                    if (!isCurrentlyChecked) {
                        dispatchHumanClick(checkboxes[idx]);
                    }
                }
            });
            return true;
        }

        const hrRadios = document.querySelectorAll('[role="radio"]');
        if (hrRadios && hrRadios.length > optionIndex) {
            dispatchHumanClick(hrRadios[optionIndex]);
            try { hrRadios[optionIndex].setAttribute('aria-checked', 'true'); } catch(e) {}
            return true;
        }
        const hrBoxes = document.querySelectorAll('[role="checkbox"]');
        if (hrBoxes && hrBoxes.length > optionIndex) {
            dispatchHumanClick(hrBoxes[optionIndex]);
            return true;
        }
    }

    // Examly / Iamneo platform handling
    let target = null;
    const optionElements = findOptionElements();
    if (optionElements && optionElements.length > optionIndex) {
        target = optionElements[optionIndex];
    }
    if (!target) {
        target = document.querySelector(`#tt-option-${optionIndex}`) ||
                 document.querySelector(`#tt-option-${optionIndex + 1}`) ||
                 document.querySelector(`div[aria-labelledby="each-option"]:nth-of-type(${optionIndex + 1})`);
    }

    let checkmark = target ? target.querySelector('span.checkmark1, .checkmark, .checkmark-custom') : null;
    if (!checkmark) {
        checkmark = document.querySelector(`#tt-option-${optionIndex} > label > span.checkmark1`) ||
                    document.querySelector(`#tt-option-${optionIndex} span.checkmark1`) ||
                    document.querySelector(`#tt-option-${optionIndex + 1} > label > span.checkmark1`) ||
                    document.querySelector(`#tt-option-${optionIndex + 1} span.checkmark1`);
    }

    let label = target ? (target.querySelector('label') || (target.tagName && target.tagName.toLowerCase() === 'label' ? target : null)) : null;
    if (!label) {
        label = document.querySelector(`#tt-option-${optionIndex} label`) ||
                document.querySelector(`#tt-option-${optionIndex + 1} label`);
    }

    let input = target ? target.querySelector('input[type="radio"], input[type="checkbox"]') : null;
    if (!input) {
        input = document.querySelector(`#tt-option-${optionIndex} input`) ||
                document.querySelector(`#tt-option-${optionIndex + 1} input`);
    }

    // Scroll into view
    try {
        const scrollTarget = checkmark || label || input || target;
        if (scrollTarget) scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch(e) {}

    // Trigger clicks on checkmark, label, input, and container to guarantee Angular selection
    if (checkmark) {
        try { checkmark.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); } catch(e) {}
        try { checkmark.click(); } catch(e) {}
    }

    if (label) {
        try { label.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); } catch(e) {}
        try { label.click(); } catch(e) {}
    }

    if (input) {
        try {
            input.checked = true;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            input.click();
        } catch(e) {}
    }

    if (target) {
        try { target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); } catch(e) {}
        try { target.click(); } catch(e) {}
    }

    // Ensure input is checked and dispatch Angular change events
    if (input && !input.checked) {
        try {
            input.checked = true;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        } catch(e) {}
    }

    // Post to MAIN world for Angular Zone.js trigger
    try {
        window.postMessage({
            source: 'neo-extension',
            action: 'forceSelectMCQOption',
            optionIndex: optionIndex
        }, '*');
    } catch (e) {}

    return true;
}

// Reliable option click simulator for Angular / Examly / HackerRank (alias for compatibility)
function triggerOptionClick(optionIndex) {
    return autoSelectMCQOption(optionIndex);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'clickMCQOption') {
        (async () => {
            try {
                isMCQSolving = false;
                const isAutoClick = (request.autoClick === true) || (activeMCQMode === 'autoSelect') || pendingMCQAutoClick;
                pendingMCQAutoClick = false;

                // Check if this is HackerRank
                if (request.isHackerRank) {
                    let clicked = false;
                    
                    // Handle multiple choice questions (checkboxes) differently
                    if (request.isMultipleChoice) {
                        console.log('Multiple choice question detected, response:', request.response);
                        
                        const optionNumbers = [];
                        let matches = request.response.match(/([A-Z]|\d+)\.\s*[^,]+/gi);
                        if (matches) {
                            matches.forEach(match => {
                                const num = match.match(/^([A-Z]|\d+)\./);
                                if (num) {
                                    let optionIndex = isNaN(num[1]) ? (num[1].charCodeAt(0) - 'A'.charCodeAt(0)) : (parseInt(num[1]) - 1);
                                    if (optionIndex >= 0) {
                                        optionNumbers.push(optionIndex);
                                    }
                                }
                            });
                        }
                        
                        if (optionNumbers.length === 0) {
                            const simpleMatches = request.response.match(/(?:^|[,\s])([A-Z]|\d+)(?=[,\s]|$)/gi);
                            if (simpleMatches) {
                                simpleMatches.forEach(match => {
                                    const cleaned = match.trim().replace(/^[,\s]+|[,\s]+$/g, '');
                                    let optionIndex = isNaN(cleaned) ? (cleaned.charCodeAt(0) - 'A'.charCodeAt(0)) : (parseInt(cleaned) - 1);
                                    if (optionIndex >= 0) {
                                        optionNumbers.push(optionIndex);
                                    }
                                });
                            }
                        }
                        
                        const uniqueOptionNumbers = [...new Set(optionNumbers)];
                        console.log('Parsed multiple choice options:', uniqueOptionNumbers.map(n => n + 1));
                        
                        lastSolvedMCQ = {
                            signature: getQuestionSignature(),
                            questionText: findQuestionElement() ? htmlToText(findQuestionElement()).trim() : '',
                            optionIndex: uniqueOptionNumbers[0] !== undefined ? uniqueOptionNumbers[0] : 0,
                            response: request.response,
                            isHackerRank: true,
                            isMultipleChoice: true,
                            uniqueOptionNumbers: uniqueOptionNumbers
                        };

                        if (isAutoClick) {
                            removeMCQDot();
                            autoSelectMCQOption(uniqueOptionNumbers[0], true, true, uniqueOptionNumbers);
                        } else {
                            removeMCQDot();
                            uniqueOptionNumbers.forEach(idx => showMCQSmallDot(idx, false));
                            chrome.runtime.sendMessage({
                                action: 'showMCQToast',
                                message: request.response,
                            });
                        }
                    } else {
                        // Single choice question
                        const optionMatch = request.response.match(/(?:options?\s*)?([A-Z]|\d+)\.?/i);
                        if (optionMatch) {
                            let optionNumber = isNaN(optionMatch[1]) ? (optionMatch[1].toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0)) : (parseInt(optionMatch[1]) - 1);
                            
                            console.log(`Single choice detected, option: ${optionNumber + 1}`);

                            lastSolvedMCQ = {
                                signature: getQuestionSignature(),
                                questionText: findQuestionElement() ? htmlToText(findQuestionElement()).trim() : '',
                                optionIndex: optionNumber,
                                response: request.response,
                                isHackerRank: true,
                                isMultipleChoice: false
                            };

                            if (isAutoClick) {
                                removeMCQDot();
                                autoSelectMCQOption(optionNumber, true, false);
                            } else {
                                showMCQSmallDot(optionNumber);
                                chrome.runtime.sendMessage({
                                    action: 'showMCQToast',
                                    message: request.response,
                                });
                            }
                        }
                    }
                } else {
                    // Examly / Iamneo platform
                    console.log('[MCQ] Received answer for Examly:', request.response);
                    let optionIndex = parseMCQAnswer(request.response, request.rawOptions);
                    if (optionIndex === null || optionIndex < 0) {
                        const optionMatch = request.response.match(/(?:options?\s*)?(\d+)\.?/i);
                        if (optionMatch) {
                            optionIndex = parseInt(optionMatch[1]) - 1;
                        }
                    }

                    const qEl = findQuestionElement();
                    const qText = qEl ? htmlToText(qEl).trim() : '';

                    if (optionIndex !== null && optionIndex >= 0) {
                        lastSolvedMCQ = {
                            signature: getQuestionSignature(),
                            questionText: qText,
                            optionIndex: optionIndex,
                            response: request.response,
                            rawOptions: request.rawOptions,
                            isHackerRank: false
                        };

                        if (isAutoClick) {
                            removeMCQDot();
                            autoSelectMCQOption(optionIndex);
                            console.log(`[MCQ] Auto-selected option index ${optionIndex} (no extra UI)`);
                        } else {
                            showMCQSmallDot(optionIndex);
                            console.log(`[MCQ] Indicated option index ${optionIndex} with small dot`);
                            let cleanResponse = (request.response || '').trim();
                            let toastMsg = cleanResponse;
                            if (optionIndex !== null && optionIndex >= 0 && 
                                !cleanResponse.toLowerCase().startsWith(`option ${optionIndex + 1}`) && 
                                !cleanResponse.toLowerCase().startsWith('option')) {
                                toastMsg = `Option ${optionIndex + 1}: ${cleanResponse}`;
                            }

                            chrome.runtime.sendMessage({
                                action: 'showMCQToast',
                                message: toastMsg || request.response
                            });
                        }
                    } else {
                        // If optionIndex could not be resolved, show toast ONLY if in Alt+A mode
                        if (!isAutoClick) {
                            console.warn('[MCQ] Could not resolve option index from AI response:', request.response);
                            chrome.runtime.sendMessage({
                                action: 'showMCQToast',
                                message: request.response
                            });
                        }
                    }
                }
            } catch (error) {
                if (!isAutoClick) {
                    chrome.runtime.sendMessage({
                        action: 'showMCQToast',
                        message: request.response,
                    });
                }
            }
        })();
    }
});

// Function to extract HackerRank MCQ data (updated for new layout)
function extractHackerRankMCQ() {
    const questions = [];
    
    // Try new layout first (2024+ layout)
    const newLayoutQuestions = document.querySelectorAll('.QuestionDetails_container__AIu0X');
    
    if (newLayoutQuestions.length > 0) {
        // New layout processing
        newLayoutQuestions.forEach((container, index) => {
            const questionData = {
                questionNumber: index + 1,
                title: '',
                instruction: '',
                options: [],
                selectedAnswer: null
            };
            
            // Extract question title from new layout
            const titleElement = container.querySelector('.qaas-block-question-title, h2');
            if (titleElement) {
                // Remove bookmark icon and get clean title
                const titleText = titleElement.textContent || titleElement.innerText;
                questionData.title = titleText.replace(/Bookmark question \d+/g, '').trim();
            }
            
            // Extract question instruction/content from new layout
            const instructionElement = container.querySelector('.qaas-block-question-instruction, .RichTextPreview_richText__1vKu5');
            if (instructionElement) {
                let instructionText = instructionElement.textContent || instructionElement.innerText;
                instructionText = instructionText.replace(/\s+/g, ' ').trim();
                questionData.instruction = instructionText;
            }
            
            // Look for options in multiple possible containers
            let optionsContainer = container.nextElementSibling;
            let attempts = 0;
            while (optionsContainer && attempts < 5) {
                // Check for both radio buttons and checkboxes
                const hasOptions = optionsContainer.querySelector('[role="checkbox"], [role="radio"], .ui-radio');
                if (hasOptions) {
                    break;
                }
                optionsContainer = optionsContainer.nextElementSibling;
                attempts++;
            }
            
            // Also check for options within the same container or nearby
            if (!optionsContainer || !optionsContainer.querySelector('[role="checkbox"], [role="radio"]')) {
                optionsContainer = container.parentElement?.querySelector('.Control_container__F35yA') ||
                                document.querySelector('.Control_container__F35yA');
            }
            
            if (optionsContainer) {
                // Try radio buttons first (new layout)
                let optionElements = optionsContainer.querySelectorAll('[role="radio"]');
                
                // If no radio buttons, try checkboxes
                if (optionElements.length === 0) {
                    optionElements = optionsContainer.querySelectorAll('[role="checkbox"]');
                }
                
                optionElements.forEach((option, optionIndex) => {
                    const labelId = option.getAttribute('aria-labelledby');
                    const labelElement = labelId ? document.getElementById(labelId) : 
                                      option.closest('.Control_optionList__vIubt, li')?.querySelector('label');
                    
                    if (labelElement) {
                        const optionText = labelElement.textContent.trim();
                        const isChecked = option.getAttribute('aria-checked') === 'true' || 
                                        option.getAttribute('data-state') === 'checked';
                        
                        questionData.options.push({
                            value: option.value || optionIndex.toString(),
                            text: optionText,
                            isSelected: isChecked
                        });
                        
                        if (isChecked) {
                            questionData.selectedAnswer = option.value || optionIndex.toString();
                        }
                    }
                });
            }
            
            // Only add question if it has options (to distinguish from coding questions)
            if (questionData.options.length > 0) {
                questions.push(questionData);
            }
        });
    } else {
        // Fallback to old layout
        const oldLayoutQuestions = document.querySelectorAll('.grouped-mcq__question');
        
        oldLayoutQuestions.forEach((container, index) => {
            const questionData = {
                questionNumber: index + 1,
                title: '',
                instruction: '',
                options: [],
                selectedAnswer: null
            };
            
            // Extract question title from old layout
            const titleElement = container.querySelector('.question-view__title');
            if (titleElement) {
                questionData.title = titleElement.textContent.trim();
            }
            
            // Extract question instruction/content from old layout
            const instructionElement = container.querySelector('.question-view__instruction');
            if (instructionElement) {
                let instructionText = instructionElement.textContent.trim();
                instructionText = instructionText.replace(/\s+/g, ' ').trim();
                questionData.instruction = instructionText;
            }
            
            // Extract options from old layout
            const optionElements = container.querySelectorAll('.ui-radio');
            optionElements.forEach((option, optionIndex) => {
                const labelElement = option.querySelector('.label');
                const inputElement = option.querySelector('input[type="radio"]');
                
                if (labelElement && inputElement) {
                    const optionText = labelElement.textContent.trim();
                    const optionValue = inputElement.value;
                    const isChecked = inputElement.checked;
                    
                    questionData.options.push({
                        value: optionValue,
                        text: optionText,
                        isSelected: isChecked
                    });
                    
                    if (isChecked) {
                        questionData.selectedAnswer = optionValue;
                    }
                }
            });
            
            questions.push(questionData);
        });
    }
    
    return questions;
}

// Function to extract HackerRank coding question (updated for new layout)
function extractHackerRankCoding() {
    const getCleanText = el => el?.innerText?.trim() || "";

    // Try new layout first (2024+ layout)
    let language = "Unknown";
    let title = "No Title Found";
    let instruction = "No Instructions Found";
    let details = "";
    let starterCode = "";

    // Check for new layout language selector
    const newLanguageSelector = document.querySelector('.select-language .css-3d4y2u-singleValue, .select-language .css-x7738g');
    if (newLanguageSelector) {
        language = getCleanText(newLanguageSelector);
    } else {
        // Fallback to old layout
        language = getCleanText(document.querySelector('.select-language .css-x7738g')) || "Unknown";
    }

    // Try new layout question container
    let container = document.querySelector('.QuestionDetails_container__AIu0X');
    if (container) {
        // New layout
        const titleElement = container.querySelector('.qaas-block-question-title, h2');
        if (titleElement) {
            const titleText = titleElement.textContent || titleElement.innerText;
            title = titleText.replace(/Bookmark question \d+/g, '').trim();
        }
        
        const instructionElement = container.querySelector('.qaas-block-question-instruction, .RichTextPreview_richText__1vKu5');
        if (instructionElement) {
            instruction = getCleanText(instructionElement);
        }
        
        // Look for details sections in new layout
        const detailsElements = container.querySelectorAll('details');
        if (detailsElements.length > 0) {
            details = Array.from(detailsElements).map(detail => {
                const summary = getCleanText(detail.querySelector('summary'));
                const content = getCleanText(detail.querySelector('.collapsable-details'));
                return `\n${summary}\n${'-'.repeat(summary.length)}\n${content}`;
            }).join('\n');
        }
    } else {
        // Fallback to old layout
        container = document.querySelector('#main-splitpane-left');
        if (container) {
            title = getCleanText(container.querySelector('.question-view__title')) || "No Title Found";
            instruction = getCleanText(container.querySelector('.question-view__instruction')) || "No Instructions Found";
            
            details = Array.from(container.querySelectorAll('details') || []).map(detail => {
                const summary = getCleanText(detail.querySelector('summary'));
                const content = getCleanText(detail.querySelector('.collapsable-details'));
                return `\n${summary}\n${'-'.repeat(summary.length)}\n${content}`;
            }).join('\n');
        }
    }

    // Get starter code from Monaco editor (works for both layouts)
    const codeLines = Array.from(document.querySelectorAll('.view-lines .view-line')).map(line =>
        line.innerText
    ).join('\n').trim();
    
    starterCode = codeLines;

    return {
        language,
        title,
        instruction,
        details,
        starterCode: starterCode
    };
}

// Function to normalize code indentation
function normalizeCodeIndentation(code) {
    if (!code) return code;
    
    const lines = code.split('\n');
    
    // Remove empty lines at the beginning and end
    while (lines.length > 0 && lines[0].trim() === '') {
        lines.shift();
    }
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
        lines.pop();
    }
    
    if (lines.length === 0) return '';
    
    // Find the minimum indentation (excluding empty lines)
    let minIndent = Infinity;
    for (const line of lines) {
        if (line.trim() !== '') {
            const indent = line.match(/^\s*/)[0].length;
            minIndent = Math.min(minIndent, indent);
        }
    }
    
    // Remove the common indentation from all lines
    if (minIndent > 0 && minIndent !== Infinity) {
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() !== '') {
                lines[i] = lines[i].substring(minIndent);
            }
        }
    }
    
    return lines.join('\n');
}

// Function to insert code into Monaco editor with proper formatting
async function insertCodeIntoMonacoEditor(text) {
    console.log('insertCodeIntoMonacoEditor called with text length:', text.length);
    
    // Normalize the code indentation first
    const normalizedText = normalizeCodeIndentation(text);
    console.log('Text after normalization:', normalizedText);
    
    // 1. Try to find Monaco editor instance through the global scope
    if (typeof monaco !== 'undefined' && window.monaco) {
        try {
            const editor = window.monaco.editor.getEditors()[0];
            if (editor) {
                console.log('Found Monaco editor instance, setting value directly...');
                editor.setValue(normalizedText);
                editor.focus();
                return true;
            }
        } catch (error) {
            console.log('Monaco API method failed, trying alternative approaches...');
        }
    }
    
    // 2. Try to access Monaco editor through DOM manipulation
    const monacoEditor = document.querySelector('.monaco-editor');
    console.log('Monaco editor DOM element found:', !!monacoEditor);
    
    if (!monacoEditor) {
        console.error("❌ Monaco editor not found.");
        return false;
    }

    try {
        // 3. Focus the editor properly
        const editorTextArea = monacoEditor.querySelector('textarea.inputarea') || 
                              monacoEditor.querySelector('textarea') ||
                              monacoEditor.querySelector('.monaco-editor-background');
        
        if (editorTextArea) {
            console.log('Found Monaco textarea, focusing...');
            editorTextArea.focus();
            editorTextArea.click();
        } else {
            console.log('Monaco textarea not found, clicking editor container...');
            monacoEditor.focus();
            monacoEditor.click();
        }
        
        // 4. Wait a bit for focus to settle
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // 5. Clear existing content using keyboard shortcuts
        console.log('Clearing existing content...');
        
        // Use Select All (Cmd+A on macOS, Ctrl+A elsewhere)
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'a',
            code: 'KeyA',
            ctrlKey: !window.isMac,
            metaKey: window.isMac,
            bubbles: true
        }));
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Use Delete or Backspace to clear
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Delete',
            code: 'Delete',
            bubbles: true
        }));
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 6. Copy normalized text to clipboard
        await navigator.clipboard.writeText(normalizedText);
        console.log('Text copied to clipboard');
        
        // 7. Paste (Cmd+V on macOS, Ctrl+V elsewhere)
        console.log('Pasting content...');
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'v',
            code: 'KeyV',
            ctrlKey: !window.isMac,
            metaKey: window.isMac,
            bubbles: true
        }));
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // 8. Try input event as fallback
        if (editorTextArea) {
            console.log('Trying input event fallback...');
            
            // Set the value directly on the textarea
            editorTextArea.value = normalizedText;
            
            // Trigger input events
            editorTextArea.dispatchEvent(new Event('input', { bubbles: true }));
            editorTextArea.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Try to trigger Monaco's internal update
            editorTextArea.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'End',
                code: 'End',
                bubbles: true
            }));
        }
        
        console.log('✅ Successfully inserted code into Monaco editor');
        return true;
        
    } catch (error) {
        console.error("❌ Error inserting code into Monaco editor:", error);
        
        // Final fallback: copy to clipboard
        try {
            await navigator.clipboard.writeText(normalizedText);
            console.log('Fallback: copied normalized text to clipboard');
        } catch (clipboardError) {
            console.error('Clipboard fallback also failed:', clipboardError);
        }
        
        return false;
    }
}

// Function to handle HackerRank extraction (both MCQ and coding, updated for new layout)
function handleHackerRankMCQ(autoClick = false) {
    // Check if it's a coding question first (Monaco editor present)
    const monacoEditor = document.querySelector('.monaco-editor, .hr-monaco-editor');
    
    // Check for MCQ options specifically (more precise detection)
    const hasRadioOptions = document.querySelector('[role="radio"], [role="radiogroup"]');
    const hasCheckboxOptions = document.querySelector('[role="checkbox"]');
    const hasOldMcqOptions = document.querySelector('.grouped-mcq__question .ui-radio');
    const hasOptionsControl = document.querySelector('.Control_container__F35yA');
    
    // More precise MCQ detection
    const isMCQ = hasRadioOptions || hasCheckboxOptions || hasOldMcqOptions || 
                  (hasOptionsControl && !monacoEditor);
    
    if (monacoEditor && !isMCQ) {
        // This is definitely a coding question
        const codingData = extractHackerRankCoding();
        
        if (!codingData.instruction || codingData.instruction === "No Instructions Found") {
            chrome.runtime.sendMessage({
                action: 'showToast',
                message: 'No HackerRank coding question found.',
                isError: true
            });
            return;
        }

        // Format the question for AI
        const questionText = `
Language: ${codingData.language}

Title: ${codingData.title}

Instructions:
${codingData.instruction}

${codingData.details}

Starter Code:
-------------
${codingData.starterCode}
        `.trim();

        console.log('HackerRank Coding Question:', questionText);

        // Send the extracted data to background.js
        chrome.runtime.sendMessage({
            action: 'extractData',
            programmingLanguage: codingData.language,
            question: questionText,
            inputFormat: codingData.details,
            outputFormat: '',
            testCases: '',
            isHackerRank: true,
            isCoding: true        }, async (response) => {
            console.log('HackerRank coding response received:', response);
            
            if (response && response.success && response.response) {
                try {
                    console.log('Raw AI response:', response.response);
                    
                    // Clean the response more thoroughly
                    let cleanedResponse = response.response.trim();
                    console.log('Response after trim:', cleanedResponse);
                    
                    // Remove code block delimiters if present (more comprehensive)
                    cleanedResponse = cleanedResponse
                        .replace(/^```[a-zA-Z]*\s*\n/, '')     // Remove opening ``` with optional language
                        .replace(/\n\s*```\s*$/, '')          // Remove closing ``` with optional whitespace
                        .replace(/^```[a-zA-Z]*\s*/, '')      // Remove opening ``` without newline
                        .replace(/\s*```\s*$/, '');           // Remove closing ``` without newline
                    
                    // Remove any leading/trailing whitespace after code block removal
                    cleanedResponse = cleanedResponse.trim();
                    
                    console.log('Cleaned response (after removing code blocks):', cleanedResponse);
                    
                    // Insert code into Monaco editor with proper formatting
                    console.log('Attempting to insert code into Monaco editor...');
                    const success = await insertCodeIntoMonacoEditor(cleanedResponse);
                    console.log('Monaco editor insertion result:', success);
                    
                    if (!success) {
                        // If insertion fails, copy to clipboard as fallback
                        console.log('Monaco insertion failed, copying to clipboard as fallback');
                        await navigator.clipboard.writeText(cleanedResponse);
                        chrome.runtime.sendMessage({
                            action: 'showToast',
                            message: 'Copied to clipboard - paste manually',
                            isError: false
                        });
                    } else {
                        console.log('Successfully inserted code into Monaco editor');
                        chrome.runtime.sendMessage({
                            action: 'showToast',
                            message: 'Code inserted successfully',
                            isError: false
                        });
                    }
                } catch (error) {
                    console.error("Error processing coding response:", error);
                    chrome.runtime.sendMessage({
                        action: 'showToast',
                        message: 'Error processing response',
                        isError: true
                    });
                }
            } else {
                console.error('Invalid response received:', response);
            }
        });
        
    } else if (isMCQ) {
        // This is an MCQ question
        const extractedData = extractHackerRankMCQ();
        
        if (extractedData.length === 0) {
            chrome.runtime.sendMessage({
                action: 'showToast',
                message: 'No HackerRank MCQ questions found.',
                isError: true
            });
            return;
        }

        // Process the first question
        const firstQuestion = extractedData[0];
        
        if (!firstQuestion.instruction && !firstQuestion.title) {
            chrome.runtime.sendMessage({
                action: 'showToast',
                message: 'No question text found.',
                isError: true
            });
            return;
        }

        if (firstQuestion.options.length === 0) {
            chrome.runtime.sendMessage({
                action: 'showToast',
                message: 'No options found for MCQ question.',
                isError: true
            });
            return;
        }

        // Format the question and options for AI with explicit instructions
        const questionText = firstQuestion.title ? `${firstQuestion.title}\n${firstQuestion.instruction}` : firstQuestion.instruction;
        const optionsText = firstQuestion.options.map((option, index) => 
            `Option ${index + 1}: ${option.text}`
        ).join('\n');

        // Detect if this is a multiple choice question (checkboxes) or single choice (radio buttons)
        const hasCheckboxes = document.querySelector('[role="checkbox"]');
        const isMultipleChoice = hasCheckboxes && !document.querySelector('[role="radio"]');
        
        // Add explicit instruction for multiple choice questions
        let finalQuestionText = questionText;
        if (isMultipleChoice) {
            finalQuestionText = `[MULTIPLE CHOICE QUESTION - SELECT ALL CORRECT OPTIONS]\n\n${questionText}\n\nIMPORTANT: This question allows multiple correct answers. Please respond with ALL correct option numbers separated by commas (e.g., "Options 1, 3, 5" or "1, 3, 5").`;
        } else {
            finalQuestionText = `[SINGLE CHOICE QUESTION - SELECT ONE OPTION]\n\n${questionText}\n\nIMPORTANT: This question allows only ONE correct answer. Please respond with the single correct option number (e.g., "Option 2" or "2").`;
        }
        
        console.log('HackerRank MCQ Question:', finalQuestionText);
        console.log('Options:\n', optionsText);
        console.log('Question type:', isMultipleChoice ? 'Multiple Choice (checkboxes)' : 'Single Choice (radio buttons)');

        // Send the extracted data to background.js
        chrome.runtime.sendMessage({
            action: 'extractData',
            question: finalQuestionText,  // Use the enhanced question text
            code: null,
            options: optionsText,
            isHackerRank: true,
            isMCQ: true,
            isMultipleChoice: isMultipleChoice,  // Add flag for multiple choice questions
            autoClick: autoClick
        }, (response) => {
            console.log("Response from background:", response);
        });
    } else {
        chrome.runtime.sendMessage({
            action: 'showToast',
            message: 'No HackerRank question found on this page.',
            isError: true
        });
    }
}

// Alt+K (Option+K on macOS): Solve HackerRank question (MCQ or Coding)
document.addEventListener('keydown', (event) => {
    const modifierKey = event.altKey;
    const isKeyK = event.code === 'KeyK' || 
                   (event.key && event.key.toLowerCase() === 'k') || 
                   event.keyCode === 75 || event.which === 75 ||
                   event.key === '˚' || event.key === '';

    if (modifierKey && !event.ctrlKey && !event.shiftKey && !event.metaKey && isKeyK) {
        event.preventDefault();
        event.stopPropagation();
        if (isActionThrottled('alt_k')) return;
        handleHackerRankMCQ(false);
    }
}, true); // useCapture: true to intercept before Monaco/HackerRank portal listeners

