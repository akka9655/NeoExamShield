// Production stealth: silence all console logs and errors from extension safely
try {
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
    console.info = () => {};
    console.debug = () => {};
} catch (e) {}

// Listen for real-time pause status from background (pauses all features when code is paused by admin)
let neoCodePaused = false;
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'neoCodePauseStatus') {
        neoCodePaused = !!msg.paused;
    }
});

// Guard function: returns false only if code was paused by admin
function neoFeaturesAllowed() {
    if (neoCodePaused) {
        chrome.runtime.sendMessage({
            action: 'showToast',
            message: 'Code is invalid',
            isError: true,
            forceShow: true
        });
        return false;
    }
    return true;
}

window.addEventListener('blur', function() {
    window.focus();
});

// Alt+J: Live browser identity bypass toggle (Off → NeoBrowser → Chrome → Off)
(function() {
    const BYPASS_MODES = ['off', 'neobrowser', 'chrome'];
    const MODE_LABELS = { 
        'off': 'Native Browser (Off)', 
        'neobrowser': 'Neo Browser (v2.0.10)', 
        'chrome': 'Google Chrome (v128)' 
    };
    let reloadCountdownTimer = null;
    let toastHost = null;

    function removeToast() {
        if (reloadCountdownTimer) {
            clearTimeout(reloadCountdownTimer);
            reloadCountdownTimer = null;
        }
        if (toastHost) {
            toastHost.remove();
            toastHost = null;
        }
    }

    // Cancel reload on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && reloadCountdownTimer) {
            removeToast();
            try {
                chrome.runtime.sendMessage({
                    action: 'showToast',
                    message: 'Page reload cancelled. Identity saved.',
                    isError: false
                });
            } catch(err) {}
        }
    }, true);

    function showBypassToast(mode) {
        removeToast();

        const host = document.createElement('div');
        host.id = 'neo-bypass-toast-host';
        host.style.cssText = `
            position: fixed;
            top: 16px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 2147483647;
            background: #0F172A;
            color: #FFFFFF;
            padding: 10px 18px;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 13px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.15);
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            animation: neoSlideDown 0.2s ease-out;
        `;

        const isExamPage = window.location.href.includes('examly') || 
                           window.location.href.includes('psgtech') || 
                           window.location.href.includes('iamneo') || 
                           window.location.href.includes('vit.ac.in');

        const label = MODE_LABELS[mode] || mode;
        const icon = mode === 'chrome' ? '🌐' : (mode === 'neobrowser' ? '🛡️' : '⚪');

        host.innerHTML = `
            <span style="font-size: 16px;">${icon}</span>
            <div>
                <div style="font-weight: 700; color: #38BDF8;">Browser Mode: ${label}</div>
                <div style="font-size: 11px; color: #94A3B8;">${isExamPage ? 'Reloading page in 1.4s to apply... (Esc to cancel)' : 'Active identity updated'}</div>
            </div>
            <button type="button" style="background:none;border:none;color:#64748B;font-size:14px;cursor:pointer;margin-left:6px;">✕</button>
        `;

        host.onclick = (e) => {
            e.stopPropagation();
            removeToast();
        };

        (document.body || document.documentElement).appendChild(host);
        toastHost = host;

        if (isExamPage) {
            reloadCountdownTimer = setTimeout(() => {
                window.location.reload();
            }, 1400);
        } else {
            setTimeout(removeToast, 3000);
        }
    }
    
    document.addEventListener('keydown', function(e) {
        if (e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey && (e.code === 'KeyJ' || (e.key && e.key.toLowerCase() === 'j'))) {
            e.preventDefault();
            e.stopPropagation();
            
            let currentMode = 'off';
            try {
                currentMode = localStorage.getItem('neo_browser_bypass_mode') || 'off';
            } catch(err) {}
            
            const currentIdx = BYPASS_MODES.indexOf(currentMode);
            const nextMode = BYPASS_MODES[(currentIdx + 1) % BYPASS_MODES.length];
            
            try {
                localStorage.setItem('neo_browser_bypass_mode', nextMode);
            } catch(err) {}
            
            // Dispatch event to MAIN world bypass engine
            window.dispatchEvent(new CustomEvent('neoBrowserBypassChange', { detail: { mode: nextMode } }));
            
            // Notify service worker to persist mode and update DNR headers
            try {
                chrome.runtime.sendMessage({ action: 'setBrowserBypass', mode: nextMode });
            } catch(err) {}
            
            // Show interactive countdown toast
            showBypassToast(nextMode);
        }
    }, true);
})();

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
            (document.head || document.documentElement)?.appendChild(style);
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
    
    // Start observing safely
    const targetObs = document.body || document.documentElement;
    if (targetObs) {
        try {
            observer.observe(targetObs, {
                childList: true,
                subtree: true
            });
        } catch (e) {}
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            try {
                observer.observe(document.body || document.documentElement, {
                    childList: true,
                    subtree: true
                });
            } catch (e) {}
        }, { once: true });
    }
})();

// Function to convert HTML to readable text with proper formatting
function htmlToText(element) {
    if (!element) return '';
    
    // Clone the element to avoid modifying the original
    const clone = element.cloneNode(true);

    // Strip code editor gutter/line numbers and proctoring/extension UI from the clone
    clone.querySelectorAll('.ace_gutter, .ace_gutter-layer, .ace_gutter-cell, .cm-gutters, .cm-lineNumbers, .line-numbers, .gutter, #neo-mcq-dot, #chat-overlay-shadow-host, #neo-quick-hud-host, #neo-sync-hud-container').forEach(el => {
        el.remove();
    });
    
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
    let text = clone.innerText.trim();

    // Clean redundant portal headers (from data2 & b.md)
    text = text.replace(/^Question\s*No\s*:\s*\d+\s*(?:\/\s*\d+)?\s*(?:Multi|Single)?\s*Choice\s*Type\s*Question\s*/i, '');
    text = text.replace(/^(?:Multi|Single)\s*Choice\s*Type\s*Question\s*/i, '');
    text = text.replace(/^Question\s*\d+\s*:\s*/i, '');

    return text.trim();
}

// Robust multi-selector helpers for question and option containers
function findQuestionElement() {
    return document.querySelector('div[aria-labelledby="question-data"]') ||
           document.querySelector('.rich-text-content, div[class*="rich-text-content"]') ||
           document.querySelector('div[class*="overflow-y-auto"] .rich-text-content') ||
           document.querySelector('testtaking-question .ql-editor') ||
           document.querySelector('div.ql-editor') ||
           document.querySelector('[aria-labelledby="question-answer"] .ql-editor') ||
           document.querySelector('[aria-labelledby="question-answer"]') ||
           document.querySelector('.question-view') ||
           document.querySelector('.grouped-mcq__question') ||
           document.querySelector('div.w-full div.h-px, div.h-px.bg-gray-500')?.previousElementSibling ||
           document.querySelector('[data-testid="reading-passage"]') ||
           document.querySelector('div[class*="overflow-y-auto"] .w-full');
}

function findOptionElements() {
    // Check 0: FacePrep options
    let opts = document.querySelectorAll('button[data-testid^="mcq-option-"]');
    if (opts && opts.length > 0) return Array.from(opts);

    // Check 1: aria-labelledby="each-option"
    opts = document.querySelectorAll('div[aria-labelledby="each-option"]');
    if (opts && opts.length > 0) return Array.from(opts);

    // Check 2: tt-option-* elements
    opts = document.querySelectorAll('[id^="tt-option-"]');
    if (opts && opts.length > 0) return Array.from(opts);

    // Check 3: each-option-card / each-option container / modern radio groups
    opts = document.querySelectorAll('[aria-labelledby="each-option-card"], [aria-labelledby="each-option-container"], .each-option, [data-slot="radio-group-item"], div[role="radiogroup"] > div, [role="radiogroup"] [data-slot="card"], .option-card');
    if (opts && opts.length > 0) return Array.from(opts);

    // Check 4: testtaking-options or radio/checkbox groups
    opts = document.querySelectorAll('testtaking-options .t-flex.t-flex-row, .grouped-mcq__options label, [role="radiogroup"] [role="radio"], [role="radiogroup"] [role="checkbox"], .Control_optionList__vIubt [role="radio"], .Control_optionList__vIubt [role="checkbox"]');
    if (opts && opts.length > 0) return Array.from(opts);

    // Check 5: Look for radio or checkbox inputs strictly inside MCQ containers (never inside coding editors or proctoring)
    const inputs = document.querySelectorAll('mcqsinglecorrect-answer input[type="radio"], mcqsinglecorrect-answer input[type="checkbox"], mcqmultiplecorrect-answer input[type="radio"], mcqmultiplecorrect-answer input[type="checkbox"], testtaking-options input[type="radio"], testtaking-options input[type="checkbox"], div[aria-labelledby="testtaking-options"] input, .grouped-mcq input, [role="radiogroup"] input, .Control_optionList__vIubt input');
    if (inputs && inputs.length > 0) {
        const optionContainers = [];
        inputs.forEach(inp => {
            // Strictly exclude coding answer area, proctoring, custom input toggles, and chat containers
            if (inp.closest('programming-answer, programming-question, #programme-compile, tt-proctoring, #chat-overlay-shadow-host, #chat-button-shadow-host')) return;
            const label = inp.closest('label');
            if (label && (label.innerText || label.textContent || '').includes('Custom Input')) return;

            const parent = inp.closest('[aria-labelledby*="option"], [id*="option"], label, .t-cursor-pointer, .t-flex') || inp.parentElement;
            if (parent && !optionContainers.includes(parent)) {
                optionContainers.push(parent);
            }
        });
        if (optionContainers.length > 0) return optionContainers;
    }

    return [];
}

// Helper to extract diagrams/images synchronously with optimal downscaling to minimize Gemini token usage.
// Gemini counts images <= 384x384 as exactly 258 tokens. Larger images are tiled in 768x768 blocks (258 tokens each).
// By clamping max dimensions and using JPEG 0.72, token consumption is reduced by 75-85% while keeping diagrams crisp.
function extractImagesFromElement(container, maxDim = 512) {
    if (!container) return [];
    const imgs = container.querySelectorAll('img');
    const images = [];
    const seenSrcs = new Set();

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

        const rawSrc = img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('src');
        if (rawSrc) {
            let fullSrc = rawSrc;
            if (!rawSrc.startsWith('data:') && !rawSrc.startsWith('http://') && !rawSrc.startsWith('https://')) {
                try {
                    fullSrc = new URL(rawSrc, window.location.href).href;
                } catch(e) {}
            }

            if (seenSrcs.has(fullSrc)) continue;
            seenSrcs.add(fullSrc);

            if (fullSrc.startsWith('data:image/')) {
                let downscaled = false;
                try {
                    if (img.complete && img.naturalWidth > 20) {
                        let w = img.naturalWidth;
                        let h = img.naturalHeight;
                        if (w > maxDim || h > maxDim) {
                            if (w > h) {
                                h = Math.round((h * maxDim) / w);
                                w = maxDim;
                            } else {
                                w = Math.round((w * maxDim) / h);
                                h = maxDim;
                            }
                            const canvas = document.createElement('canvas');
                            canvas.width = w;
                            canvas.height = h;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, w, h);
                            images.push(canvas.toDataURL('image/jpeg', 0.72));
                            downscaled = true;
                        }
                    }
                } catch(e) {}
                if (!downscaled) images.push(fullSrc);
            } else if (fullSrc.startsWith('http://') || fullSrc.startsWith('https://')) {
                let exported = false;
                try {
                    if (img.complete && img.naturalWidth > 20) {
                        let w = img.naturalWidth;
                        let h = img.naturalHeight;
                        if (w > maxDim || h > maxDim) {
                            if (w > h) {
                                h = Math.round((h * maxDim) / w);
                                w = maxDim;
                            } else {
                                w = Math.round((w * maxDim) / h);
                                h = maxDim;
                            }
                        }
                        const canvas = document.createElement('canvas');
                        canvas.width = w;
                        canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        images.push(canvas.toDataURL('image/jpeg', 0.72));
                        exported = true;
                    }
                } catch (e) {
                    // Tainted canvas on cross-origin images (expected)
                }
                // If canvas cannot export due to CORS, pass the full URL.
                // worker.js has host_permissions (*://*/*) and will fetch, downscale and convert seamlessly.
                if (!exported) {
                    images.push(fullSrc);
                }
            }
        }
    }

    // Also extract CSS background-image diagrams if present
    try {
        const bgEls = container.querySelectorAll('[style*="background-image"], [style*="background:"]');
        for (const el of bgEls) {
            const bg = el.style.backgroundImage || el.style.background || '';
            const m = bg.match(/url\(['"]?(.*?)['"]?\)/);
            if (m && m[1]) {
                const url = m[1];
                if (!url.includes('clock.svg') && !url.includes('pattern.png') && !url.includes('header_banner') && !url.includes('test_curve.svg') && !url.includes('arrow_down.svg')) {
                    const fullUrl = url.startsWith('data:') ? url : (new URL(url, window.location.href).href);
                    if (!seenSrcs.has(fullUrl)) {
                        seenSrcs.add(fullUrl);
                        images.push(fullUrl);
                    }
                }
            }
        }
    } catch(e) {}

    // Also extract HTML5 canvas graphics (diagrams, circuits, coordinate graphs)
    try {
        const canvases = container.querySelectorAll('canvas');
        for (const cvs of canvases) {
            if (cvs.width > 20 && cvs.height > 20) {
                try {
                    let w = cvs.width;
                    let h = cvs.height;
                    let targetCvs = cvs;
                    if (w > maxDim || h > maxDim) {
                        if (w > h) {
                            h = Math.round((h * maxDim) / w);
                            w = maxDim;
                        } else {
                            w = Math.round((w * maxDim) / h);
                            h = maxDim;
                        }
                        const scaled = document.createElement('canvas');
                        scaled.width = w;
                        scaled.height = h;
                        const ctx = scaled.getContext('2d');
                        ctx.drawImage(cvs, 0, 0, w, h);
                        targetCvs = scaled;
                    }
                    const dataUrl = targetCvs.toDataURL('image/jpeg', 0.72);
                    if (dataUrl && dataUrl.length > 80 && !dataUrl.startsWith('data:,')) {
                        images.push(dataUrl);
                    }
                } catch(e) {}
            }
        }
    } catch(e) {}

    // Also extract inline <svg> diagrams (geometry, logic gates, flowcharts)
    try {
        const svgs = container.querySelectorAll('svg');
        for (const svg of svgs) {
            const rect = svg.getBoundingClientRect();
            if (rect.width < 35 || rect.height < 35) continue;
            if (svg.closest('#chat-overlay-shadow-host, #neo-quick-hud-host')) continue;
            try {
                const s = new XMLSerializer().serializeToString(svg);
                const bytes = new TextEncoder().encode(s);
                let bin = '';
                for (let i = 0; i < bytes.length; i += 8192) {
                    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
                }
                const svg64 = btoa(bin);
                images.push('data:image/svg+xml;base64,' + svg64);
            } catch(e) {}
        }
    } catch(e) {}

    return images;
}

// Function to extract the question, code, and options
function extractQuestionCodeAndOptions() {
    const questionElement = findQuestionElement();

    // Extracting the code (Ace editor inside question, or pre/code blocks)
    let codeText = null;
    const qContainer = questionElement || document.querySelector('testtaking-question, mcqsinglecorrect-question, #content-left, [aria-labelledby="question-answer"]');
    const aceLineElements = (qContainer || document).querySelectorAll('.ace_layer.ace_text-layer .ace_line');
    if (aceLineElements && aceLineElements.length > 0) {
        const codeLines = [];
        aceLineElements.forEach(line => {
            const txt = (line.innerText !== undefined ? line.innerText : line.textContent || '').replace(/\r/g, '');
            codeLines.push(txt);
        });
        if (codeLines.some(l => l.trim().length > 0)) {
            codeText = codeLines.join('\n');
        }
    }

    if (!codeText && qContainer) {
        const preCode = qContainer.querySelector('pre code, pre, .ql-syntax');
        if (preCode) {
            codeText = (preCode.innerText || preCode.textContent || '').trim();
        }
    }

    // Extracting the question text (cleaning out duplicate code containers if codeText was extracted)
    let questionText = '';
    if (questionElement) {
        if (codeText) {
            const qClone = questionElement.cloneNode(true);
            qClone.querySelectorAll('.ace_editor, pre, .ql-syntax').forEach(el => el.remove());
            questionText = htmlToText(qClone);
            if (!questionText.trim()) {
                questionText = htmlToText(questionElement);
            }
        } else {
            questionText = htmlToText(questionElement);
        }
    }

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

// Helper to get raw options text array directly from current DOM
function getRawOptionsFromDOM() {
    try {
        const optEls = findOptionElements();
        return Array.from(optEls).map(el => {
            const clone = el.cloneNode(true);
            clone.querySelectorAll('#neo-mcq-dot').forEach(d => d.remove());
            return htmlToText(clone).trim();
        }).filter(Boolean);
    } catch (e) {
        return [];
    }
}

// MCQ state tracking for Alt+A (solve/reveal) and Alt+S (human-like click only)
let lastSolvedMCQ = null;
let isMCQSolving = false;
let pendingMCQAutoClick = false;
let currentActiveQuestionSignature = '';
let activeMCQMode = 'autoSelect';
let lastTriggeredMode = 'autoSelect';

// Helper to get a unique signature of the currently visible question
function getQuestionSignature() {
    try {
        const qEl = findQuestionElement();
        const qText = qEl ? htmlToText(qEl).trim() : '';
        const rawOpts = getRawOptionsFromDOM();
        const optsText = rawOpts.join('|||');

        // Also extract code snippet inside question container if present
        let codeSnippet = '';
        const qContainer = document.querySelector('testtaking-question, mcqsinglecorrect-question, programming-question, #content-left, [aria-labelledby="question-container"], [aria-labelledby="question-data-container"], [aria-labelledby="question-answer"]') || qEl;
        if (qContainer) {
            const aceLines = qContainer.querySelectorAll('.ace_layer.ace_text-layer .ace_line');
            if (aceLines && aceLines.length > 0) {
                codeSnippet = Array.from(aceLines).map(l => (l.innerText !== undefined ? l.innerText : l.textContent || '').replace(/\r/g, '')).join('\n').trim();
            }
            if (!codeSnippet) {
                const preCode = qContainer.querySelector('pre code, pre, .ql-syntax');
                if (preCode) {
                    codeSnippet = (preCode.innerText || preCode.textContent || '').trim();
                }
            }
        }

        // Also extract question number indicator from portal header if available
        let qNum = '';
        const qNumEl = document.querySelector('div[class*="t-bg-primary"], div.t-whitespace-nowrap, .question-number, [aria-labelledby="question-no"]');
        if (qNumEl) {
            const m = (qNumEl.innerText || qNumEl.textContent || '').match(/Question\s*(?:No)?\s*[:\.]?\s*(\d+)/i);
            if (m) qNum = `Q${m[1]}`;
        }

        if (!qText && !optsText && !codeSnippet && !qNum) return '';
        // Uniquely identifies the question; never truncates to avoid prefix collisions across programming MCQs
        return `${qNum}:::${qText}:::${codeSnippet}:::${optsText}`;
    } catch (e) {
        return '';
    }
}

// Question equality helper: Determines if a cached solve matches the current active question
function isSameQuestion(cachedSolve, currentSig, currentQText, currentRawOptions) {
    if (!cachedSolve) return false;

    // 1. Signature match
    if (cachedSolve.signature && currentSig && cachedSolve.signature === currentSig) {
        return true;
    }

    // 2. Full question text match
    if (cachedSolve.questionText && currentQText && cachedSolve.questionText.trim() === currentQText.trim()) {
        return true;
    }

    // 3. Option texts match
    if (cachedSolve.rawOptions && Array.isArray(cachedSolve.rawOptions) && Array.isArray(currentRawOptions) && currentRawOptions.length > 0) {
        if (cachedSolve.rawOptions.length === currentRawOptions.length) {
            let allMatch = true;
            for (let i = 0; i < cachedSolve.rawOptions.length; i++) {
                if ((cachedSolve.rawOptions[i] || '').trim() !== (currentRawOptions[i] || '').trim()) {
                    allMatch = false;
                    break;
                }
            }
            if (allMatch) return true;
        }
    }

    // 4. Question prefix match (handles dynamic math rendering / latex / katex)
    if (cachedSolve.questionText && currentQText) {
        const c1 = cachedSolve.questionText.trim().slice(0, 40);
        const c2 = currentQText.trim().slice(0, 40);
        if (c1 && c2 && (c1 === c2 || cachedSolve.questionText.includes(c2) || currentQText.includes(c1))) {
            return true;
        }
    }

    return false;
}

// Function to handle when question changes to a new one
function checkAndHandleQuestionChange() {
    const newSig = getQuestionSignature();
    if (!newSig) return; // DOM not ready yet

    if (!currentActiveQuestionSignature) {
        currentActiveQuestionSignature = newSig;
        return;
    }

    if (newSig !== currentActiveQuestionSignature) {
        console.log('[MCQ] Question change detected! Invalidating previous question solve cache.');
        currentActiveQuestionSignature = newSig;
        lastSolvedMCQ = null;
        isMCQSolving = false;
        pendingMCQAutoClick = false;
        removeMCQDot();

        // Stop hacker typing mode and writing immediately on question change
        try {
            if (typeof window._neoStopTyping === 'function') {
                window._neoStopTyping();
            }
            window.dispatchEvent(new CustomEvent('neoStopTyping'));
        } catch(e) {}

        // Broadcast abort signal to cancel in-flight AI generation
        try {
            window.dispatchEvent(new CustomEvent('neoAbortAIRequest'));
        } catch(e) {}
    }
}

// Check for question change periodically and on navigation clicks
setInterval(checkAndHandleQuestionChange, 250);

// Efficient mutation observer to immediately detect question swaps without high CPU usage
let mcqMutationTimer = null;
const mcqMutationObserver = new MutationObserver((mutations) => {
    let relevant = false;
    for (let i = 0; i < mutations.length; i++) {
        const target = mutations[i].target;
        if (target && target.nodeType === 1) {
            const el = target;
            if (el.id === 'neo-mcq-dot' || (el.closest && el.closest('#neo-mcq-dot, #chat-overlay-shadow-host, #chat-button-shadow-host'))) {
                continue;
            }
            if (el.closest && el.closest('testtaking-question, mcqsinglecorrect-question, [aria-labelledby="question-answer"], [aria-labelledby="each-option"], [id^="tt-option-"], .ql-editor')) {
                relevant = true;
                break;
            }
        }
    }
    if (relevant) {
        if (mcqMutationTimer) clearTimeout(mcqMutationTimer);
        mcqMutationTimer = setTimeout(checkAndHandleQuestionChange, 60);
    }
});
try {
    mcqMutationObserver.observe(document.body, { childList: true, subtree: true });
} catch (e) {}

document.addEventListener('click', (e) => {
    // If clicking inside an MCQ option, checkmark, or radio, NEVER treat it as question navigation!
    if (e.target.closest('[id^="tt-option-"], div[aria-labelledby="each-option"], testtaking-options, [role="radiogroup"], mcqsinglecorrect-answer, mcqmultiplecorrect-answer, [role="radio"], [role="checkbox"], label, span.checkmark1')) {
        return;
    }

    const rawTxt = (e.target.innerText || e.target.textContent || '').trim().toLowerCase();
    const isNavText = ['next', 'skip', 'prev', 'previous', 'back'].includes(rawTxt) || /^\d+$/.test(rawTxt);
    const navClick = isNavText || e.target.closest('.back-btn, .next-btn, .prev-btn, .palette-bubble, [id*="palette"], [aria-labelledby="each-question"]');
    if (navClick) {
        // Clear any old solved question immediately on user navigation
        lastSolvedMCQ = null;
        isMCQSolving = false;
        pendingMCQAutoClick = false;
        removeMCQDot();
        currentActiveQuestionSignature = '';
        setTimeout(checkAndHandleQuestionChange, 50);
        setTimeout(checkAndHandleQuestionChange, 150);
        setTimeout(checkAndHandleQuestionChange, 300);
    }
}, true);

// Function to handle question, code, and options extraction with full image & diagram support
async function handleQuestionExtraction(autoClick = true) {
    const isAuto = Boolean(autoClick || activeMCQMode === 'autoSelect' || lastTriggeredMode === 'autoSelect');
    console.log('[MCQ] Starting question extraction with autoClick =', isAuto);
    checkAndHandleQuestionChange();
    currentActiveQuestionSignature = getQuestionSignature();
    lastSolvedMCQ = null; // Always reset before fresh extraction
    isMCQSolving = true;
    pendingMCQAutoClick = isAuto;
    activeMCQMode = isAuto ? 'autoSelect' : 'reveal';
    lastTriggeredMode = activeMCQMode;
    removeMCQDot();

    // 1. Extract question text
    const questionElement = findQuestionElement();
    const questionText = questionElement ? htmlToText(questionElement) : '';

    // 2. Extract code (Ace editor inside question, or pre/code blocks)
    let codeText = null;
    const qContainer = document.querySelector('testtaking-question, mcqsinglecorrect-question, programming-question, #content-left, [aria-labelledby="question-container"], [aria-labelledby="question-data-container"], [aria-labelledby="question-answer"]') || questionElement;

    // Check for Ace editor inside question container (e.g. Examly output prediction questions)
    const qAceEl = (qContainer || document).querySelector('.ace_editor');
    if (qAceEl) {
        if (window.ace && typeof window.ace.edit === 'function') {
            try {
                const ed = window.ace.edit(qAceEl);
                if (ed && typeof ed.getValue === 'function') {
                    codeText = ed.getValue().trim();
                }
            } catch(e) {}
        }
        if (!codeText) {
            const aceLineElements = qAceEl.querySelectorAll('.ace_layer.ace_text-layer .ace_line');
            if (aceLineElements && aceLineElements.length > 0) {
                const codeLines = [];
                aceLineElements.forEach(line => {
                    const txt = (line.innerText !== undefined ? line.innerText : line.textContent || '').replace(/\r/g, '');
                    codeLines.push(txt);
                });
                if (codeLines.some(l => l.trim().length > 0)) {
                    codeText = codeLines.join('\n');
                }
            }
        }
    }

    if (!codeText && qContainer) {
        const preCode = qContainer.querySelector('pre code, pre, .ql-syntax');
        if (preCode) {
            codeText = (preCode.innerText || preCode.textContent || '').trim();
        }
    }

    // 3. Extract question diagrams first
    const allImages = [];
    let imageCounter = 1;
    const visualGuide = [];

    if (questionElement) {
        const qImages = extractImagesFromElement(questionElement, 512);
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
        const optImages = extractImagesFromElement(opt, 384);
        
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

    // Detect multiple-correct question (checkboxes used instead of radio buttons)
    const hasCheckboxInputs = !!document.querySelector('mcqmultiplecorrect-answer, [aria-labelledby="mcqmultiplecorrect-container"]');
    const hasCheckboxRoles = !hasCheckboxInputs && optionsElements.length > 0 && optionsElements.every(el => {
        const inp = el.querySelector('input[type="checkbox"]') || el.querySelector('[role="checkbox"]');
        return !!inp;
    });
    const isMultipleChoice = hasCheckboxInputs || hasCheckboxRoles;

    chrome.runtime.sendMessage({
        action: 'extractData',
        question: finalQuestion,
        code: codeText,
        options: optionsText.join('\n'),
        rawOptions: rawOptions,
        images: allImages,
        isMCQ: true,
        isMultipleChoice: isMultipleChoice,
        autoClick: isAuto,
        mode: isAuto ? 'autoSelect' : 'reveal',
        shortcut: isAuto ? 'alt_s' : 'alt_a',
        questionSignature: currentActiveQuestionSignature || getQuestionSignature(),
        questionText: (questionText || '').trim()
    });
}

// Function to extract coding question details
async function extractCodingQuestion(isTyped = false) {
    // 1. Extract programming language with full multi-portal support
    let programmingLanguage = 'C';
    const programmingLanguageElement = document.querySelector(
        '#programming-editor[data-language], ' +
        'div[data-language], ' +
        '.cm-content[data-language], ' +
        'button[role="combobox"] [data-slot="select-value"], ' +
        'span.inner-text, ' +
        '.select-language .select__single-value, ' +
        '[aria-labelledby="select-language"]'
    );
    if (programmingLanguageElement) {
        if (programmingLanguageElement.hasAttribute && programmingLanguageElement.hasAttribute('data-language')) {
            programmingLanguage = programmingLanguageElement.getAttribute('data-language').trim();
        } else {
            programmingLanguage = (programmingLanguageElement.innerText || programmingLanguageElement.textContent || '').trim();
        }
    }
    programmingLanguage = programmingLanguage.replace(/\s*\(\d+\)/g, '').trim();
    if (!programmingLanguage || programmingLanguage.toLowerCase().includes('not found')) {
        const dLang = document.querySelector('[data-language]');
        if (dLang) programmingLanguage = dLang.getAttribute('data-language').trim();
        else programmingLanguage = 'C';
    }

    // Inspect editor placeholder or existing code for GCC / language signatures (from data2 & r.md)
    try {
        const editorContent = document.querySelector('.ace_content, .ace_text-layer, .cm-content, #programming-editor')?.innerText || '';
        if (editorContent.includes('// You are using GCC') || editorContent.includes('#include <stdio.h>')) {
            programmingLanguage = 'C';
        } else if (editorContent.includes('#include <iostream>') || editorContent.includes('using namespace std')) {
            programmingLanguage = 'C++';
        } else if (editorContent.includes('public class') || editorContent.includes('import java.')) {
            programmingLanguage = 'Java';
        } else if (editorContent.includes('def ') || editorContent.includes('import numpy') || editorContent.includes('input(')) {
            programmingLanguage = 'Python';
        }
    } catch(e) {}

    // 2. Extract question components
    const questionElement = document.querySelector('div[aria-labelledby="question-data"]') ||
                            document.querySelector('.rich-text-content, div[class*="rich-text-content"]') ||
                            document.querySelector('div[class*="overflow-y-auto"] .rich-text-content') ||
                            document.querySelector('testtaking-question .ql-editor') ||
                            document.querySelector('[aria-labelledby="question-answer"]');
    const questionText = questionElement ? htmlToText(questionElement) : 'Question not found.';
    const images = extractImagesFromElement(questionElement, 512);

    // 3. Extract constraints
    const constraintsElement = document.querySelector('div[aria-labelledby="code-constraints"], div[aria-labelledby="constraints"]');
    let constraintsText = constraintsElement ? htmlToText(constraintsElement) : '';
    if (!constraintsText) {
        const allHeadings = document.querySelectorAll('div, p, span, h3, h4');
        for (const h of allHeadings) {
            const txt = (h.innerText || h.textContent || '').trim();
            if (txt === 'Code Constraints' || txt === 'Constraints') {
                const parentBox = h.closest('.rounded-lg, .rounded-xl, .bg-surface-secondary, .flex-col') || h.parentElement;
                if (parentBox) {
                    constraintsText = htmlToText(parentBox).replace(txt, '').trim();
                    break;
                }
            }
        }
    }

    // 4. Extract input and output format
    const inputFormatElement = document.querySelector('div[aria-labelledby="input-format"]');
    let inputFormatText = inputFormatElement ? htmlToText(inputFormatElement) : '';
    if (!inputFormatText) {
        const allHeadings = document.querySelectorAll('div, p, span, h3, h4');
        for (const h of allHeadings) {
            const txt = (h.innerText || h.textContent || '').trim();
            if (txt === 'Input Format') {
                const parentBox = h.closest('.rounded-lg, .rounded-xl, .bg-surface-secondary, .flex-col') || h.parentElement;
                if (parentBox) {
                    inputFormatText = htmlToText(parentBox).replace(txt, '').trim();
                    break;
                }
            }
        }
    }

    const outputFormatElement = document.querySelector('div[aria-labelledby="output-format"]');
    let outputFormatText = outputFormatElement ? htmlToText(outputFormatElement) : '';
    if (!outputFormatText) {
        const allHeadings = document.querySelectorAll('div, p, span, h3, h4');
        for (const h of allHeadings) {
            const txt = (h.innerText || h.textContent || '').trim();
            if (txt === 'Output Format') {
                const parentBox = h.closest('.rounded-lg, .rounded-xl, .bg-surface-secondary, .flex-col') || h.parentElement;
                if (parentBox) {
                    outputFormatText = htmlToText(parentBox).replace(txt, '').trim();
                    break;
                }
            }
        }
    }

    // 5. Extract sample test cases with multi-method fallbacks
    const testCases = [];
    
    // Method 1: Find test case containers with aria-labelledby="each-tc-card"
    let containers = document.querySelectorAll('div[aria-labelledby="each-tc-card"]');
    if (containers.length > 0) {
        containers.forEach((container) => {
            const inputPre = container.querySelector('pre[aria-labelledby*="input"], div[aria-labelledby*="input"] pre, div[class*="input"] pre, pre:first-of-type');
            const outputPre = container.querySelector('pre[aria-labelledby*="output"], [aria-label*="output"] pre, [arai-label*="output"] pre, div[aria-labelledby*="output"] pre, div[class*="output"] pre');
            if (inputPre && outputPre) {
                testCases.push({
                    input: inputPre.textContent.trim(),
                    output: outputPre.textContent.trim()
                });
            }
        });
    }
    
    // Method 2: Find by aria-labelledby="each-tc-container"
    if (testCases.length === 0) {
        containers = document.querySelectorAll('[aria-labelledby="each-tc-container"]');
        if (containers.length > 0) {
            containers.forEach((container) => {
                const inputPre = container.querySelector('pre[aria-labelledby*="input"], [aria-labelledby="each-tc-input"], pre');
                const outputPre = container.querySelector('pre[aria-labelledby*="output"], [aria-label*="output"] pre, [arai-label*="output"] pre, [aria-labelledby="each-tc-output"]');
                if (inputPre && outputPre) {
                    testCases.push({
                        input: inputPre.textContent.trim(),
                        output: outputPre.textContent.trim()
                    });
                }
            });
        }
    }

    // Method 3: Find by Case 1 / Case 2 headers with whitespace-pre inputs/outputs (modern Next.js UI in new m.md)
    if (testCases.length === 0) {
        const caseHeaders = Array.from(document.querySelectorAll('div, p, span, h3, h4')).filter(el => {
            const t = (el.innerText || el.textContent || '').trim();
            return /^Case\s*\d+$/i.test(t);
        });
        caseHeaders.forEach(ch => {
            const card = ch.closest('.flex-col, .rounded-xl, .rounded-lg') || ch.parentElement;
            if (card) {
                let inpVal = '';
                let outVal = '';
                const labels = card.querySelectorAll('div, p, span');
                labels.forEach(lbl => {
                    const lt = (lbl.innerText || lbl.textContent || '').trim();
                    if (lt === 'Input') {
                        const container = lbl.closest('.flex-col, .flex, div') || lbl.parentElement;
                        const valEl = container?.querySelector('.whitespace-pre, pre, code, [class*="whitespace-pre"]');
                        if (valEl) inpVal = valEl.textContent.trim();
                    } else if (lt === 'Output') {
                        const container = lbl.closest('.flex-col, .flex, div') || lbl.parentElement;
                        const valEl = container?.querySelector('.whitespace-pre, pre, code, [class*="whitespace-pre"]');
                        if (valEl) outVal = valEl.textContent.trim();
                    }
                });
                if (inpVal && outVal) {
                    testCases.push({ input: inpVal, output: outVal });
                }
            }
        });
    }
    
    // Method 4: Find pre elements with Input/Output labels
    if (testCases.length === 0) {
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

    // Helper to safely extract full editor content (handles Ace virtualization and textarea)
    function getEditorSnippet(el) {
        if (!el) return '';
        try {
            if (el.env && el.env.editor && typeof el.env.editor.getValue === 'function') {
                const v = el.env.editor.getValue().trim();
                if (v) return v;
            }
            const aceObj = (typeof ace !== 'undefined') ? ace : (window.ace || document.defaultView?.ace);
            if (aceObj && typeof aceObj.edit === 'function') {
                const ed = aceObj.edit(el.id || el);
                if (ed && typeof ed.getValue === 'function') {
                    const v = ed.getValue().trim();
                    if (v) return v;
                }
            }
        } catch(e) {}
        const lines = el.querySelectorAll('.ace_line');
        if (lines && lines.length > 0) {
            return Array.from(lines).map(line => line.textContent).join('\n').trim();
        }
        return (el.innerText || el.textContent || '').trim();
    }

    // Extract header and footer snippet code from readonly editors, plus starter code from center editor
    let headerSnippet = '';
    let footerSnippet = '';
    let starterCode = '';

    // First attempt: Request 100% full un-virtualized snippets from MAIN world exam.js via synchronous custom event bridge
    try {
        document.dispatchEvent(new CustomEvent('neoGetMainSnippets'));
        const bridgeEl = document.getElementById('neo-snippets-data');
        if (bridgeEl && bridgeEl.textContent) {
            const data = JSON.parse(bridgeEl.textContent);
            if (data) {
                if (data.headerSnippet) headerSnippet = data.headerSnippet;
                if (data.footerSnippet) footerSnippet = data.footerSnippet;
                if (data.starterCode) starterCode = data.starterCode;
            }
        }
    } catch(e) {}

    // Fallback if MAIN world bridge didn't find snippets or wasn't available
    if (!headerSnippet) {
        const headerEditorEl = document.querySelector('div[aria-labelledby="tt-header"] .ace_editor, [id*="ttHeaderEditor"], [id*="HeaderEditor"], [id*="headerEditor"], .header-content .ace_editor, .header-editor');
        if (headerEditorEl) {
            headerSnippet = getEditorSnippet(headerEditorEl);
        }
    }
    if (!footerSnippet) {
        const footerEditorEl = document.querySelector('div[aria-labelledby="footer"] .ace_editor, [id*="ttFooterEditor"], [id*="FooterEditor"], [id*="footerEditor"], .footer-content .ace_editor, .footer-editor');
        if (footerEditorEl) {
            footerSnippet = getEditorSnippet(footerEditorEl);
        }
    }
    if (!starterCode) {
        const centerEditorCandidates = [
            document.querySelector('div[aria-labelledby="answer"] .ace_editor'),
            document.querySelector('[id*="ttAnswerEditor"]'),
            document.querySelector('[aria-labelledby="editor-answer"]'),
            document.querySelector('.answer-content .ace_editor'),
            document.querySelector('#programming-editor .ace_editor')
        ];
        for (const cand of centerEditorCandidates) {
            if (cand) {
                const id = (cand.id || '').toLowerCase();
                if (!id.includes('header') && !id.includes('footer')) {
                    starterCode = getEditorSnippet(cand);
                    if (starterCode) break;
                }
            }
        }
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
        starterCode: starterCode,
        whitelist: whitelistText,
        images: images,
        isCoding: true,
        isTyped: isTyped
    }, (response) => {
        isCodingExtractionInProgress = false;
        if (codingExtractionTimeout) {
            clearTimeout(codingExtractionTimeout);
            codingExtractionTimeout = null;
        }
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
    // 1. Check explicit Examly question type header badge first
    const qTypeBadge = document.querySelector('testtaking-question [aria-labelledby="question-type"], div[aria-labelledby="question-type"]');
    if (qTypeBadge) {
        const qTypeText = (qTypeBadge.innerText || qTypeBadge.textContent || '').trim().toLowerCase();
        // If badge explicitly says Multi Choice / MCQ / Multiple Choice / Single Correct
        if (qTypeText.includes('multi choice') || qTypeText.includes('multiple choice') || 
            qTypeText.includes('mcq') || qTypeText.includes('single correct') || 
            qTypeText.includes('multiple correct')) {
            return false;
        }
        // If badge explicitly says Single File Programming / Programming / Coding
        if (qTypeText.includes('programming') || qTypeText.includes('single file') || 
            qTypeText.includes('coding')) {
            return true;
        }
    }

    // 2. Check for explicit MCQ answer containers and option elements
    // If ANY MCQ answer container or option element is present, this is an MCQ (even if question contains code snippets)
    if (document.querySelector('mcqsinglecorrect-answer, mcqmultiplecorrect-answer, [aria-labelledby="mcqsinglecorrect-container"], [aria-labelledby="mcqmultiplecorrect-container"], button[data-testid^="mcq-option-"]')) {
        return false;
    }

    const optionElements = findOptionElements();
    if (optionElements && optionElements.length > 0) {
        return false;
    }

    if (document.querySelector('[id^="tt-option-"], div[aria-labelledby="each-option"], [aria-labelledby="each-option-card"], .grouped-mcq__options, [role="radiogroup"] [role="radio"], [role="radiogroup"] [role="checkbox"], testtaking-options')) {
        return false;
    }

    // 3. Check for explicit coding answer/solution elements
    // Examly: programming-answer, compile bar, language dropdown, or solution editor
    const codingAnswerElement = document.querySelector('programming-answer, #programme-compile, app-language-dropdown, div[aria-labelledby="editor-answer"], [id*="ttAnswerEditor"], .editor-answer');
    if (codingAnswerElement) {
        return true;
    }

    // Check for explicit coding question elements (only if not an MCQ)
    const codingQuestionElement = document.querySelector('programming-question, div[aria-labelledby="code-constraints"], div[aria-labelledby="input-format"]');
    if (codingQuestionElement) {
        return true;
    }

    // 4. Check for coding editors:
    // For Ace editor: must NOT be inside question container (like question-data or testtaking-question)
    // and must be in an editable/answer container (like programming-answer or ttAnswerEditor)
    const aceEl = document.querySelector('.ace_editor');
    if (aceEl && (aceEl.offsetWidth > 0 || aceEl.offsetHeight > 0)) {
        // If Ace editor is inside an MCQ question or read-only in question-data, it is NOT a coding question
        const isInsideQuestionData = aceEl.closest('question-data, testtaking-question, mcqsinglecorrect-question, mcqmultiplecorrect-question, #content-left');
        const isInsideAnswerContainer = aceEl.closest('programming-answer, #content-right, [id*="ttAnswerEditor"]');
        if (isInsideQuestionData && !isInsideAnswerContainer) {
            return false;
        }
        if (isInsideAnswerContainer) {
            return true;
        }
    }

    // Monaco editor (HackerRank / FacePrep coding challenge)
    const monacoEl = document.querySelector('.hr-monaco-editor, .monaco-editor');
    if (monacoEl && (monacoEl.offsetWidth > 0 || monacoEl.offsetHeight > 0)) {
        // Ensure not on an MCQ page with options
        return true;
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

// Helper to extract currently selected text from document, inputs, or code editors
function getPageSelectedText() {
    let text = '';
    const sel = window.getSelection();
    if (sel && sel.toString()) {
        text = sel.toString().trim();
    }
    if (!text && document.activeElement) {
        const el = document.activeElement;
        if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && typeof el.selectionStart === 'number') {
            const start = Math.min(el.selectionStart, el.selectionEnd);
            const end = Math.max(el.selectionStart, el.selectionEnd);
            if (start !== end) {
                text = (el.value || '').substring(start, end).trim();
            }
        }
    }
    if (!text) {
        try {
            const aceEditors = document.querySelectorAll('.ace_editor');
            for (const ed of aceEditors) {
                if (ed.env && ed.env.editor) {
                    const aceText = ed.env.editor.getSelectedText();
                    if (aceText && aceText.trim()) {
                        text = aceText.trim();
                        break;
                    }
                }
            }
        } catch (e) {}
    }
    return text;
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
        if (!neoFeaturesAllowed()) return;
        if (isActionThrottled('alt_a')) return;

        activeMCQMode = 'reveal';
        lastTriggeredMode = 'reveal';
        pendingMCQAutoClick = false;
        solveIamneoExamly();
    }
}, true); // useCapture: true to intercept before portal listeners

// Alt+M (Option+M on macOS): Toggle Transparent Floating Quick Short Answer HUD (selected text or active question)
document.addEventListener('keydown', (event) => {
    const modifierKey = event.altKey;
    const isKeyM = event.code === 'KeyM' || 
                   (event.key && event.key.toLowerCase() === 'm') || 
                   event.keyCode === 77 || event.which === 77 ||
                   event.key === 'µ' || event.key === 'Â';

    if (modifierKey && !event.ctrlKey && !event.shiftKey && !event.metaKey && isKeyM) {
        event.preventDefault();
        event.stopPropagation();
        if (!neoFeaturesAllowed()) return;
        if (isActionThrottled('alt_m')) return;

        const hudHost = document.getElementById('neo-quick-hud-host');
        const hudEl = hudHost?.shadowRoot?.getElementById('neo-quick-hud') || document.getElementById('neo-quick-hud');
        const selectedText = getPageSelectedText();

        // If HUD is already open and user presses Alt+M without a new selection, toggle it closed
        if (hudEl && hudEl.style.display !== 'none' && (!selectedText || !selectedText.trim())) {
            window.dispatchEvent(new CustomEvent('neoHideQuickHUD'));
            return;
        }

        let queryText = selectedText ? selectedText.trim() : '';

        // If no text is selected, fallback to extracting active question from DOM
        if (!queryText) {
            const qEl = findQuestionElement();
            if (qEl) {
                const qText = htmlToText(qEl).trim();
                const rawOpts = getRawOptionsFromDOM();
                if (qText) {
                    queryText = qText;
                    if (rawOpts && rawOpts.length > 0) {
                        queryText += '\n\nOptions:\n' + rawOpts.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt.text}`).join('\n');
                    }
                }
            }
        }

        if (queryText) {
            chrome.runtime.sendMessage({
                action: 'showMCQToast',
                message: '⚡ Getting quick short answer...'
            });
            if (typeof window.neoQuickAnswer === 'function') {
                window.neoQuickAnswer(queryText);
            } else {
                window.dispatchEvent(new CustomEvent('neoQuickAnswer', { detail: { text: queryText } }));
            }
        } else {
            chrome.runtime.sendMessage({
                action: 'showMCQToast',
                message: 'Select text or open a question to get quick answer'
            });
        }
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
        if (!neoFeaturesAllowed()) return;
        if (isActionThrottled('alt_s')) return;

        if (isCodingQuestionPage()) {
            return;
        }

        activeMCQMode = 'autoSelect';
        lastTriggeredMode = 'autoSelect';
        pendingMCQAutoClick = true;
        removeMCQDot(); // Remove any dot from prior Alt+A immediately

        checkAndHandleQuestionChange();
        const currentSig = getQuestionSignature();
        const currentQEl = findQuestionElement();
        const currentQText = currentQEl ? htmlToText(currentQEl).trim() : '';
        const currentRawOptions = getRawOptionsFromDOM();

        // Check if we have a valid solved answer matching the CURRENT question strictly
        const isMatch = lastSolvedMCQ && 
                        lastSolvedMCQ.optionIndex !== null && 
                        lastSolvedMCQ.optionIndex >= 0 && 
                        isSameQuestion(lastSolvedMCQ, currentSig, currentQText, currentRawOptions);

        if (isMatch) {
            console.log('[Alt+S] Instantly auto-selecting previously solved MCQ option:', lastSolvedMCQ.optionIndex);
            removeMCQDot();
            autoSelectMCQOption(lastSolvedMCQ.optionIndex, lastSolvedMCQ.isHackerRank, lastSolvedMCQ.isMultipleChoice, lastSolvedMCQ.uniqueOptionNumbers);
            let cleanResponse = (lastSolvedMCQ.response || '').trim();
            let toastMsg = cleanResponse || `Option ${lastSolvedMCQ.optionIndex + 1}`;
            if (lastSolvedMCQ.optionIndex !== null && lastSolvedMCQ.optionIndex >= 0 && 
                !toastMsg.toLowerCase().startsWith(`option ${lastSolvedMCQ.optionIndex + 1}`) && 
                !toastMsg.toLowerCase().startsWith('option')) {
                toastMsg = `Option ${lastSolvedMCQ.optionIndex + 1}: ${toastMsg}`;
            }
            chrome.runtime.sendMessage({
                action: 'showMCQToast',
                message: `Selected: ${toastMsg}`
            });
            return;
        }

        // If AI is currently solving this question, ensure auto-click is armed
        if (isMCQSolving) {
            console.log('[Alt+S] AI is currently solving - armed auto-click');
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



let isCodingExtractionInProgress = false;
let codingExtractionTimeout = null;

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
        if (!neoFeaturesAllowed()) return;
        if (isActionThrottled('alt_t')) return;

        // Ignore keydown in iframes that do not contain code editors to prevent duplicate multi-frame triggers
        if (window.self !== window.top && !document.querySelector('.ace_editor, #programming-editor, .cm-editor, .monaco-editor, programming-answer, [id*="ttAnswerEditor"]')) {
            return;
        }

        // Prevent concurrent extraction if one is already in progress
        if (isCodingExtractionInProgress) {
            chrome.runtime.sendMessage({
                action: 'showToast',
                message: 'Solution generation in progress...',
                isError: false
            });
            return;
        }

        const isHackerRankSite = window.location.hostname.includes('hackerrank.com') || window.location.hostname.includes('hackerrank');
        if (isHackerRankSite) {
            handleHackerRankMCQ(false);
            return;
        }

        // Only fetch if this is a coding question
        if (!isCodingQuestionPage()) return;

        isCodingExtractionInProgress = true;
        if (codingExtractionTimeout) clearTimeout(codingExtractionTimeout);
        codingExtractionTimeout = setTimeout(() => { isCodingExtractionInProgress = false; }, 8000);

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
        if (!neoFeaturesAllowed()) return;
        if (isActionThrottled('alt_x')) return;

        // Ignore keydown in iframes that do not contain code editors to prevent duplicate multi-frame triggers
        if (window.self !== window.top && !document.querySelector('.ace_editor, #programming-editor, .cm-editor, .monaco-editor, programming-answer, [id*="ttAnswerEditor"]')) {
            return;
        }

        // Prevent concurrent extraction if one is already in progress
        if (isCodingExtractionInProgress) {
            chrome.runtime.sendMessage({
                action: 'showToast',
                message: 'Solution generation in progress...',
                isError: false
            });
            return;
        }

        if (!isCodingQuestionPage()) return;

        isCodingExtractionInProgress = true;
        if (codingExtractionTimeout) clearTimeout(codingExtractionTimeout);
        codingExtractionTimeout = setTimeout(() => { isCodingExtractionInProgress = false; }, 8000);

        extractCodingQuestion(true); // Random key press typing mode
    }
}, true); // useCapture: true to intercept before portal listeners

// Alt+D / Alt+C (Option+D / Option+C on macOS): Toggle AI Chatbot & Stop Typing Mode
document.addEventListener('keydown', (event) => {
    const modifierKey = event.altKey;
    const isKeyD = event.code === 'KeyD' || 
                   (event.key && event.key.toLowerCase() === 'd') ||
                   event.keyCode === 68 || event.which === 68 ||
                   event.key === '∂';
    const isKeyC = event.code === 'KeyC' || 
                   (event.key && event.key.toLowerCase() === 'c') ||
                   event.keyCode === 67 || event.which === 67 ||
                   event.key === 'ç' || event.key === 'Ç';

    if (modifierKey && !event.ctrlKey && !event.shiftKey && !event.metaKey && (isKeyD || isKeyC)) {
        event.preventDefault();
        event.stopPropagation();
        try {
            if (typeof window._neoStopTyping === 'function') {
                window._neoStopTyping();
            }
        } catch(e) {}
        window.dispatchEvent(new CustomEvent('neoStopTyping'));
        window.dispatchEvent(new CustomEvent('neoToggleChat'));
    }
}, true); // useCapture: true to intercept before portal listeners

// Alt+Z (Option+Z on macOS): Toggle Toast Visibility (Color Toast ON/OFF - Default: OFF / Ghost Mode)
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

// Alt+K (Option+K on macOS): Toggle Small Stealth Code Entry HUD
document.addEventListener('keydown', (event) => {
    const modifierKey = event.altKey;
    const isKeyK = event.code === 'KeyK' || 
                   (event.key && event.key.toLowerCase() === 'k') || 
                   event.keyCode === 75 || event.which === 75 ||
                   event.key === '˚' || event.key === '';

    if (modifierKey && !event.ctrlKey && !event.shiftKey && !event.metaKey && isKeyK) {
        event.preventDefault();
        event.stopPropagation();
        toggleSyncCodeHUD();
    }
}, true);

// Sync bypass mode from chrome.storage.local to localStorage on start (default: 'off')
try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['browserBypassMode'], (result) => {
            const mode = (result && result.browserBypassMode) ? result.browserBypassMode : 'off';
            try {
                if (localStorage.getItem('neo_browser_bypass_mode') !== mode) {
                    localStorage.setItem('neo_browser_bypass_mode', mode);
                }
            } catch (e) {}
        });
    } else {
        try {
            if (!localStorage.getItem('neo_browser_bypass_mode')) {
                localStorage.setItem('neo_browser_bypass_mode', 'off');
            }
        } catch (e) {}
    }
} catch (e) {}

// Alt + , (Option + , on macOS): Instantly hide Quick Answer HUD & Sync Code HUD
document.addEventListener('keydown', (event) => {
    const modifierKey = event.altKey;
    const isKeyComma = event.code === 'Comma' || 
                       (event.key && (event.key === ',' || event.key === '≤')) || 
                       event.keyCode === 188 || event.which === 188;

    if (modifierKey && !event.ctrlKey && !event.shiftKey && !event.metaKey && isKeyComma) {
        event.preventDefault();
        event.stopPropagation();
        window.dispatchEvent(new CustomEvent('neoHideQuickHUD'));
        const existingSync = document.getElementById('neo-sync-hud-container');
        if (existingSync) existingSync.remove();
    }
}, true);

function toggleSyncCodeHUD() {
    let existing = document.getElementById('neo-sync-hud-container');
    if (existing) {
        existing.remove();
        return;
    }

    const host = document.createElement('div');
    host.id = 'neo-sync-hud-container';
    host.style.cssText = 'position:fixed;top:16px;right:18px;z-index:2147483647;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;user-select:none;';

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
        <style>
            @keyframes neoSlideIn {
                from { opacity: 0; transform: translateY(-6px) scale(0.96); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .hud-card {
                width: 168px;
                background: rgba(15, 23, 42, 0.26);
                backdrop-filter: blur(14px) saturate(180%);
                -webkit-backdrop-filter: blur(14px) saturate(180%);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 7px;
                padding: 5px 6px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
                animation: neoSlideIn 0.16s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                box-sizing: border-box;
                color: #e2e8f0;
            }
            .hud-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 4px;
                cursor: move;
            }
            .hud-title {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 8.5px;
                font-weight: 700;
                color: #38bdf8;
                letter-spacing: 0.4px;
                text-transform: uppercase;
            }
            .hud-dot {
                width: 4px;
                height: 4px;
                background: #fbbf24;
                border-radius: 50%;
                display: inline-block;
                transition: background 0.2s;
            }
            .hud-close {
                cursor: pointer;
                color: #94a3b8;
                font-size: 11px;
                line-height: 1;
                border: none;
                background: none;
                padding: 0 2px;
                border-radius: 3px;
            }
            .hud-close:hover {
                color: #f1f5f9;
                background: rgba(255, 255, 255, 0.12);
            }
            .hud-row {
                display: flex;
                gap: 4px;
            }
            .hud-input {
                flex: 1;
                min-width: 0;
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.18);
                border-radius: 4px;
                color: #ffffff;
                font-size: 12px;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-weight: 700;
                text-align: center;
                letter-spacing: 1.5px;
                padding: 2px 4px;
                outline: none;
                transition: border-color 0.15s, box-shadow 0.15s;
                height: 22px;
                box-sizing: border-box;
            }
            .hud-input:focus {
                border-color: #38bdf8;
                box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.22);
            }
            .hud-btn {
                background: rgba(2, 132, 199, 0.8);
                color: #ffffff;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 4px;
                padding: 0 7px;
                font-size: 9.5px;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.15s;
                height: 22px;
                box-sizing: border-box;
                white-space: nowrap;
            }
            .hud-btn:hover {
                background: rgba(2, 132, 199, 1);
            }
            .hud-status {
                font-size: 8px;
                color: #94a3b8;
                margin-top: 3px;
                text-align: center;
                min-height: 11px;
                line-height: 11px;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
            }
            .hud-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 4px;
                padding-top: 3px;
                border-top: 1px solid rgba(255, 255, 255, 0.07);
            }
            .hud-link {
                background: none;
                border: none;
                color: #64748b;
                font-size: 7.5px;
                font-weight: 600;
                cursor: pointer;
                padding: 1px 2px;
                border-radius: 2px;
                transition: color 0.12s;
            }
            .hud-link:hover {
                color: #94a3b8;
            }
            .hud-link.danger:hover {
                color: #f87171;
            }
            .hud-shortcuts {
                display: none;
                margin-top: 4px;
                padding-top: 4px;
                border-top: 1px dashed rgba(255, 255, 255, 0.1);
                font-size: 7.5px;
                line-height: 1.35;
                color: #94a3b8;
            }
            .sc-item {
                display: flex;
                justify-content: space-between;
                margin-bottom: 2px;
            }
            .sc-k {
                color: #38bdf8;
                font-family: monospace;
                font-weight: 700;
            }
            .bypass-row {
                display: flex;
                gap: 3px;
                margin-top: 4px;
                padding-top: 3px;
                border-top: 1px solid rgba(255, 255, 255, 0.07);
            }
            .bypass-btn {
                flex: 1;
                background: rgba(255,255,255,0.06);
                color: #94a3b8;
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 3px;
                font-size: 7.5px;
                font-weight: 600;
                cursor: pointer;
                padding: 2px 0;
                transition: background 0.12s, color 0.12s, border-color 0.12s;
                text-align: center;
                white-space: nowrap;
            }
            .bypass-btn:hover {
                background: rgba(255,255,255,0.12);
                color: #e2e8f0;
            }
            .bypass-btn.active-chrome {
                background: rgba(2, 132, 199, 0.75);
                color: #fff;
                border-color: rgba(56,189,248,0.4);
            }
            .bypass-btn.active-neo {
                background: rgba(16, 185, 129, 0.7);
                color: #fff;
                border-color: rgba(74,222,128,0.4);
            }
            .bypass-btn.active-off {
                background: rgba(100,116,139,0.5);
                color: #cbd5e1;
                border-color: rgba(148,163,184,0.3);
            }
            .bypass-label {
                font-size: 7px;
                color: #64748b;
                text-align: center;
                margin-top: 2px;
                letter-spacing: 0.3px;
            }
        </style>
        <div class="hud-card">
            <div class="hud-header">
                <div class="hud-title"><span class="hud-dot"></span>NeoExamShield</div>
                <button class="hud-close" title="Close (Esc)">✕</button>
            </div>
            <div class="hud-row">
                <input class="hud-input" type="text" placeholder="000" maxlength="50" autocomplete="off" />
                <button class="hud-btn" type="button">Link</button>
            </div>
            <div class="hud-status">Enter code (e.g. 000)</div>
            <div class="bypass-row" id="hud-bypass-row">
                <button class="bypass-btn" data-mode="off" id="bp-off" title="No browser spoofing — native browser">Off</button>
                <button class="bypass-btn" data-mode="neobrowser" id="bp-neo" title="Spoof as Neo Browser (for NeoBrowser-only tests)">Neo</button>
                <button class="bypass-btn" data-mode="chrome" id="bp-chrome" title="Spoof as Chrome browser">Chrome</button>
            </div>
            <div class="bypass-label" id="hud-bypass-label">Browser: loading…</div>
            <div class="hud-footer">
                <button class="hud-link" id="hud-toggle-sc" title="Toggle shortcut guide">Keys</button>
                <button class="hud-link" id="hud-unlink" title="Clear linked API keys">Unlink</button>
                <button class="hud-link danger" id="hud-uninstall" title="Uninstall extension">Uninstall</button>
            </div>
            <div class="hud-shortcuts" id="hud-shortcuts-list">
                <div class="sc-item"><span>Alt+Z</span><span class="sc-k">Toasts ON/OFF (Default: OFF)</span></div>
                <div class="sc-item"><span>Alt+A</span><span class="sc-k">MCQ solve+dot</span></div>
                <div class="sc-item"><span>Alt+S</span><span class="sc-k">MCQ select</span></div>
                <div class="sc-item"><span>Alt+T</span><span class="sc-k">Code inject</span></div>
                <div class="sc-item"><span>Alt+X</span><span class="sc-k">Hacker type</span></div>
                <div class="sc-item"><span>Alt+M</span><span class="sc-k">Quick Ans HUD</span></div>
                <div class="sc-item"><span>Alt+J</span><span class="sc-k">Browser bypass</span></div>
                <div class="sc-item"><span>Alt+P</span><span class="sc-k">Force paste</span></div>
                <div class="sc-item"><span>Alt+C</span><span class="sc-k">AI Chat</span></div>
                <div class="sc-item"><span>Alt+K</span><span class="sc-k">This HUD</span></div>
                <div class="sc-item"><span>Alt+,</span><span class="sc-k">Hide all HUDs</span></div>
            </div>
        </div>
    `;

    (document.body || document.documentElement).appendChild(host);

    const input = shadow.querySelector('.hud-input');
    const btn = shadow.querySelector('.hud-btn');
    const closeBtn = shadow.querySelector('.hud-close');
    const status = shadow.querySelector('.hud-status');
    const dot = shadow.querySelector('.hud-dot');
    const toggleScBtn = shadow.querySelector('#hud-toggle-sc');
    const scList = shadow.querySelector('#hud-shortcuts-list');
    const unlinkBtn = shadow.querySelector('#hud-unlink');
    const uninstallBtn = shadow.querySelector('#hud-uninstall');
    const bpChrome = shadow.querySelector('#bp-chrome');
    const bpNeo = shadow.querySelector('#bp-neo');
    const bpOff = shadow.querySelector('#bp-off');
    const bypassLabel = shadow.querySelector('#hud-bypass-label');

    // Helper: update bypass button UI from mode string
    const updateBypassBtns = (mode) => {
        [bpChrome, bpNeo, bpOff].forEach(b => b && b.classList.remove('active-chrome', 'active-neo', 'active-off'));
        const modeLabels = { chrome: 'Chrome (spoof)', neobrowser: 'Neo Browser', off: 'Native / Off' };
        if (mode === 'chrome' && bpChrome) bpChrome.classList.add('active-chrome');
        else if (mode === 'neobrowser' && bpNeo) bpNeo.classList.add('active-neo');
        else if (mode === 'off' && bpOff) bpOff.classList.add('active-off');
        if (bypassLabel) bypassLabel.textContent = 'Browser: ' + (modeLabels[mode] || mode);
    };

    // Load current bypass mode
    chrome.runtime.sendMessage({ action: 'getBypassMode' }, (res) => {
        const m = (res && res.mode) ? res.mode : 'chrome';
        updateBypassBtns(m);
    });

    // Bypass button click handlers
    [bpChrome, bpNeo, bpOff].forEach(btn2 => {
        if (!btn2) return;
        btn2.addEventListener('click', () => {
            resetAutoHideTimer();
            const newMode = btn2.getAttribute('data-mode');
            chrome.runtime.sendMessage({ action: 'setBrowserBypass', mode: newMode }, (res) => {
                updateBypassBtns(newMode);
                if (bypassLabel) bypassLabel.textContent = 'Browser: set → reloading…';
                setTimeout(() => chrome.runtime.sendMessage({ action: 'reloadActiveTab' }), 600);
            });
        });
    });

    // Query current linked status
    chrome.runtime.sendMessage({ action: 'getSyncStatus' }, (res) => {
        if (res && res.linked) {
            if (neoCodePaused) {
                dot.style.background = '#ef4444';
                status.innerHTML = `<span style="color:#ef4444;font-weight:600;">Code invalid</span>`;
            } else {
                dot.style.background = '#4ade80';
                status.innerHTML = `<span style="color:#4ade80;">✓ Linked (${res.count} key${res.count > 1 ? 's' : ''})</span>`;
            }
            if (res.linkedCode) {
                input.placeholder = res.linkedCode;
                chrome.runtime.sendMessage({ action: 'checkCodePaused', code: res.linkedCode }, (pRes) => {
                    if (pRes && pRes.paused) {
                        neoCodePaused = true;
                        dot.style.background = '#ef4444';
                        status.innerHTML = `<span style="color:#ef4444;font-weight:600;">Code invalid</span>`;
                    }
                });
            }
        } else {
            dot.style.background = '#fbbf24';
            status.innerHTML = 'Enter code (e.g. 000)';
        }
    });

    let autoHideTimer = null;
    const handleOutsideClick = (e) => {
        // If click occurred inside the HUD container or its shadow DOM, ignore
        if (e.target === host || host.contains(e.target)) return;
        if (e.composedPath && e.composedPath().includes(host)) return;
        closeHUD(true);
    };

    const closeHUD = (instant = false) => {
        if (autoHideTimer) {
            clearTimeout(autoHideTimer);
            autoHideTimer = null;
        }
        document.removeEventListener('pointerdown', handleOutsideClick, true);
        if (instant) {
            host.style.transition = 'opacity 0.12s, transform 0.12s';
            host.style.opacity = '0';
            host.style.transform = 'translateY(-4px)';
            setTimeout(() => host.remove(), 130);
        } else {
            host.style.transition = 'opacity 0.22s, transform 0.22s';
            host.style.opacity = '0';
            host.style.transform = 'translateY(-6px)';
            setTimeout(() => host.remove(), 230);
        }
    };

    // Auto-hide in 7 seconds always
    const resetAutoHideTimer = () => {
        if (autoHideTimer) clearTimeout(autoHideTimer);
        autoHideTimer = setTimeout(() => {
            closeHUD(false);
        }, 7000);
    };
    resetAutoHideTimer();

    // Auto-hide if user clicks anywhere on the screen outside the dialog
    setTimeout(() => {
        document.addEventListener('pointerdown', handleOutsideClick, true);
    }, 80);

    setTimeout(() => input.focus(), 60);

    closeBtn.onclick = () => closeHUD(true);

    toggleScBtn.onclick = () => {
        resetAutoHideTimer();
        const isShown = scList.style.display === 'block';
        scList.style.display = isShown ? 'none' : 'block';
        toggleScBtn.style.color = isShown ? '#64748b' : '#38bdf8';
    };

    unlinkBtn.onclick = () => {
        resetAutoHideTimer();
        chrome.runtime.sendMessage({ action: 'unlinkCode' }, () => {
            dot.style.background = '#fbbf24';
            status.innerHTML = '<span style="color:#f87171;">Unlinked</span>';
            input.placeholder = '000';
            input.value = '';
        });
    };

    uninstallBtn.onclick = () => {
        if (confirm('Uninstall NeoExamShield?')) {
            chrome.runtime.sendMessage({ action: 'uninstallExtension' });
        }
    };

    let isSyncing = false;
    const doSync = () => {
        if (isSyncing) return;
        const val = input.value.trim();
        if (!val) {
            status.innerHTML = '<span style="color:#f87171;">Enter 3-digit code</span>';
            return;
        }

        isSyncing = true;
        status.innerHTML = '<span style="color:#38bdf8;">Syncing...</span>';
        btn.disabled = true;

        chrome.runtime.sendMessage({
            action: 'syncByCode',
            code: val
        }, (res) => {
            isSyncing = false;
            btn.disabled = false;
            if (res && res.success) {
                dot.style.background = '#4ade80';
                status.innerHTML = `<span style="color:#4ade80;font-weight:600;">✓ Synced (${res.count || 1} keys)</span>`;
                input.style.borderColor = '#4ade80';
                // Hide instantly once verified (220ms flash so student sees confirmation)
                setTimeout(() => closeHUD(true), 220);
            } else {
                status.innerHTML = `<span style="color:#f87171;">✕ ${res?.error || 'Sync failed'}</span>`;
                resetAutoHideTimer();
            }
        });
    };

    // Auto-trigger sync as soon as user types a 3-digit code (no button click needed!)
    input.addEventListener('input', () => {
        resetAutoHideTimer();
        const val = input.value.trim();
        if (val.length === 3 && /^[0-9A-Za-z]{3}$/.test(val)) {
            doSync();
        } else if (val.length >= 25 && (val.startsWith('AIza') || val.startsWith('AQ.'))) {
            doSync();
        }
    });

    btn.onclick = doSync;
    input.addEventListener('keydown', (e) => {
        resetAutoHideTimer();
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            doSync();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            closeHUD(true);
        }
    });

    // Draggable by header
    const header = shadow.querySelector('.hud-header');
    let isDragging = false, startX = 0, startY = 0, initRight = 18, initTop = 16;
    header.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = host.getBoundingClientRect();
        initTop = rect.top;
        initRight = window.innerWidth - rect.right;
        e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dy = e.clientY - startY;
        const dx = startX - e.clientX;
        host.style.top = Math.max(10, initTop + dy) + 'px';
        host.style.right = Math.max(10, initRight + dx) + 'px';
    });
    document.addEventListener('mouseup', () => { isDragging = false; });
}

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
    if (message.action === 'toggleSyncCodeHUD') {
        toggleSyncCodeHUD();
    }
    if (message.action === 'neoCodePauseStatus') {
        neoCodePaused = !!message.paused;
        const hud = document.getElementById('neo-sync-hud-container');
        if (hud && hud.shadowRoot) {
            const dot = hud.shadowRoot.querySelector('.hud-dot');
            const status = hud.shadowRoot.querySelector('.hud-status');
            if (dot) dot.style.background = message.paused ? '#ef4444' : '#4ade80';
            if (status) {
                status.innerHTML = message.paused 
                    ? '<span style="color:#ef4444;font-weight:600;">Code invalid</span>'
                    : '<span style="color:#4ade80;">✓ Linked</span>';
            }
        }
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

    // 1. Explicit "Option X" or "Choice X" pattern (e.g. "Option A", "Choice 2", "(B)")
    const optMatch = clean.match(/(?:Option|Choice)\s*[:\-\*]*\s*(?:\(?)([1-9]|[A-H])(?:\)?)\b/i);
    if (optMatch) {
        const val = optMatch[1].toUpperCase();
        return isNaN(val) ? (val.charCodeAt(0) - 65) : (parseInt(val, 10) - 1);
    }

    // 2. Explicit "Answer is X" or "Correct: X" or "Ans: X"
    const ansMatch = clean.match(/(?:Answer|Correct|Ans)\s*(?:is\s*)?(?:Option\s*)?[:\-\*\s]*(?:\(?)([1-9]|[A-H])(?:\)?)\b/i);
    if (ansMatch) {
        const val = ansMatch[1].toUpperCase();
        return isNaN(val) ? (val.charCodeAt(0) - 65) : (parseInt(val, 10) - 1);
    }

    // 3. Parenthesized option: "(A)", "(B)", "(1)", "(2)"
    const parenMatch = clean.match(/(?:^|\s)\(([1-9]|[A-H])\)(?:\s|$|[\.\,\:])/i);
    if (parenMatch) {
        const val = parenMatch[1].toUpperCase();
        return isNaN(val) ? (val.charCodeAt(0) - 65) : (parseInt(val, 10) - 1);
    }

    // 4. Leading number or letter: "1. True", "B) 42", "2: foo"
    const startMatch = clean.match(/^[\s\*#\-]*([1-9]|[A-H])[\.\:\)\s]/i);
    if (startMatch) {
        const val = startMatch[1].toUpperCase();
        return isNaN(val) ? (val.charCodeAt(0) - 65) : (parseInt(val, 10) - 1);
    }

    // 5. Whole response is just a single number (1-9) or letter (A-H)
    const exactMatch = clean.match(/^[\s\*#\-]*([1-9]|[A-H])[\s\*]*$/i);
    if (exactMatch) {
        const val = exactMatch[1].toUpperCase();
        return isNaN(val) ? (val.charCodeAt(0) - 65) : (parseInt(val, 10) - 1);
    }

    // 6. Match against actual option texts
    if (Array.isArray(rawOptionTexts) && rawOptionTexts.length > 0) {
        // Exact match first
        for (let i = 0; i < rawOptionTexts.length; i++) {
            const optText = (rawOptionTexts[i] || '').trim().toLowerCase();
            if (optText.length > 0 && clean.toLowerCase() === optText) {
                return i;
            }
        }
        // Longest match first with word boundary to avoid false substring matching (e.g. "0", "1")
        const sortedIndices = rawOptionTexts
            .map((text, index) => ({ text: (text || '').trim().toLowerCase(), index }))
            .filter(item => item.text.length > 2)
            .sort((a, b) => b.text.length - a.text.length);

        for (const item of sortedIndices) {
            const escaped = item.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp('(?:^|\\b|\\s)' + escaped + '(?:\\b|\\s|$)', 'i');
            if (regex.test(clean)) {
                return item.index;
            }
        }
    }

    // 7. Fallback: isolated single digit or letter
    const fallbackMatch = clean.match(/\b([1-9]|[A-H])\b/i);
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

    // Locate the radio checkmark / bullet inside target (or option badge on FacePrep)
    let checkmarkEl = target.querySelector('span.checkmark1, .checkmark, .checkmark-custom, span.min-w-8, span.rounded-md');
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

// Helper to dispatch a single, realistic human click with correct mouse button states
function dispatchHumanClick(el) {
    if (!el) return;
    // Safety guard: Never allow automated clicks on Submit Test or Submit Code buttons
    const elId = (el.id || '').toLowerCase();
    const elText = (el.innerText || el.textContent || '').trim().toLowerCase();
    if (elId === 'tt-header-submit' || elId === 'tt-footer-submit-answer' ||
        (el.closest && el.closest('#tt-header-submit, #tt-footer-submit-answer, .submission')) ||
        elText === 'submit test' || elText === 'submit code') {
        console.warn('[Safety Guard] Blocked automated click on Submit button');
        return;
    }
    try {
        const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { left: 100, top: 100, width: 20, height: 20 };
        const cx = Math.round(rect.left + (rect.width / 2) || 100);
        const cy = Math.round(rect.top + (rect.height / 2) || 100);
        
        // Down phase: button 0 (left click), buttons 1 (depressed)
        const downOpts = { bubbles: true, cancelable: true, view: window, composed: true, detail: 1, clientX: cx, clientY: cy, screenX: cx, screenY: cy, button: 0, buttons: 1 };
        const pd = new PointerEvent('pointerdown', downOpts);
        pd.__neoTrusted = true;
        el.dispatchEvent(pd);
        const md = new MouseEvent('mousedown', downOpts);
        md.__neoTrusted = true;
        el.dispatchEvent(md);
        
        if (typeof el.focus === 'function') el.focus();
        
        // Up & click phase: button 0 (left click), buttons 0 (released)
        const upOpts = { bubbles: true, cancelable: true, view: window, composed: true, detail: 1, clientX: cx, clientY: cy, screenX: cx, screenY: cy, button: 0, buttons: 0 };
        const pu = new PointerEvent('pointerup', upOpts);
        pu.__neoTrusted = true;
        el.dispatchEvent(pu);
        const mu = new MouseEvent('mouseup', upOpts);
        mu.__neoTrusted = true;
        el.dispatchEvent(mu);
        
        const clk = new MouseEvent('click', upOpts);
        clk.__neoTrusted = true;
        el.dispatchEvent(clk);
    } catch (e) {}
    try {
        el.click();
    } catch (e) {
        try {
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 0 }));
        } catch (e2) {}
    }
}

// Deep click selector that firmly clicks and selects the MCQ option on the portal
function autoSelectMCQOption(optionIndex, isHackerRank = false, isMultipleChoice = false, uniqueOptionNumbers = null) {
    if (optionIndex === null || optionIndex === undefined || optionIndex < 0) return false;

    console.log(`[MCQ Auto-Select] Auto-selecting option index ${optionIndex}`);

    // Remove any previous dot/UI so auto-select has zero extra UI
    removeMCQDot();

    // Multi-choice handling (select all correct options)
    if (isMultipleChoice && Array.isArray(uniqueOptionNumbers) && uniqueOptionNumbers.length > 0) {
        let allSuccess = true;
        for (const idx of uniqueOptionNumbers) {
            const ok = autoSelectSingleOption(idx, isHackerRank);
            if (!ok) allSuccess = false;
        }
        return allSuccess;
    }

    return autoSelectSingleOption(optionIndex, isHackerRank);
}

function autoSelectSingleOption(optionIndex, isHackerRank = false) {
    if (optionIndex === null || optionIndex === undefined || optionIndex < 0) return false;

    // HackerRank platform handling
    if (isHackerRank) {
        const checkboxes = document.querySelectorAll('[role="checkbox"], input[type="checkbox"]');
        if (checkboxes && checkboxes.length > optionIndex) {
            const cb = checkboxes[optionIndex];
            const isCurrentlyChecked = cb.getAttribute('aria-checked') === 'true' || 
                                     cb.getAttribute('data-state') === 'checked' ||
                                     cb.checked === true;
            if (!isCurrentlyChecked) {
                dispatchHumanClick(cb);
            }
            return true;
        }

        const hrRadios = document.querySelectorAll('[role="radio"], input[type="radio"]');
        if (hrRadios && hrRadios.length > optionIndex) {
            const r = hrRadios[optionIndex];
            const isCurrentlyChecked = r.getAttribute('aria-checked') === 'true' || r.checked === true;
            if (!isCurrentlyChecked) {
                dispatchHumanClick(r);
                try { r.setAttribute('aria-checked', 'true'); } catch(e) {}
            }
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

    // Identify card container, label, checkmark, input, and button targets
    const cardContainer = (target && target.matches && (target.matches('[id^="tt-option-"]') || target.matches('[aria-labelledby="each-option"]'))) ? target :
                          (target ? target.closest('[id^="tt-option-"], div[aria-labelledby="each-option"]') : null) ||
                          document.querySelector(`#tt-option-${optionIndex}`) ||
                          document.querySelector(`#tt-option-${optionIndex + 1}`) ||
                          document.querySelector(`div[aria-labelledby="each-option"]:nth-of-type(${optionIndex + 1})`) ||
                          target;

    const label = (target ? target.querySelector('label') : null) || 
                  (cardContainer ? cardContainer.querySelector('label') : null) ||
                  document.querySelector(`#tt-option-${optionIndex} label`) ||
                  document.querySelector(`#tt-option-${optionIndex + 1} label`);

    const checkmark = (target ? target.querySelector('span.checkmark1, .checkmark, .checkmark-custom') : null) ||
                      (cardContainer ? cardContainer.querySelector('span.checkmark1, .checkmark, .checkmark-custom') : null) ||
                      document.querySelector(`#tt-option-${optionIndex} span.checkmark1`) ||
                      document.querySelector(`#tt-option-${optionIndex + 1} span.checkmark1`);

    const input = (target ? target.querySelector('input[type="radio"], input[type="checkbox"]') : null) || 
                  (cardContainer ? cardContainer.querySelector('input[type="radio"], input[type="checkbox"]') : null) ||
                  document.querySelector(`#tt-option-${optionIndex} input`) ||
                  document.querySelector(`#tt-option-${optionIndex + 1} input`);

    const button = (target && target.tagName === 'BUTTON') ? target : 
                   (target ? target.querySelector('button') : null) ||
                   document.querySelector(`button[data-testid="mcq-option-${optionIndex}"]`);

    const clickTarget = cardContainer || checkmark || label || input || button;

    if (!clickTarget && !cardContainer && !input) {
        console.warn(`[MCQ Auto-Select] No element found for option index ${optionIndex}`);
        return false;
    }

    // Scroll into view smoothly
    try {
        (cardContainer || clickTarget).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch(e) {}

    // Checkbox protection: if it's a checkbox and already checked, do not click again (prevents unchecking)
    if (input && input.type === 'checkbox') {
        const isChecked = input.checked === true || 
                          (cardContainer && (cardContainer.getAttribute('aria-checked') === 'true' || cardContainer.classList.contains('!t-bg-primary')));
        if (isChecked) return true;
    }

    // Multi-layer robust selection:
    // 1. Click outer card container FIRST (Angular attaches (click)="selectOption(opt)" directly on div[id^="tt-option-"])
    if (cardContainer && cardContainer !== label && cardContainer !== checkmark) {
        dispatchHumanClick(cardContainer);
    }

    // 2. Click label (standard HTML form label clicks toggle radio input)
    if (label) {
        dispatchHumanClick(label);
    }

    // 3. Click checkmark (the visible radio bullet where users usually click)
    if (checkmark && checkmark !== label && checkmark !== cardContainer) {
        dispatchHumanClick(checkmark);
    }

    // 4. Update native radio/checkbox input state & dispatch change events for Angular model binding
    if (input) {
        try {
            input.checked = true;
        } catch (e) {}
        dispatchHumanClick(input);
        try {
            input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        } catch (e) {}
    }

    // 5. Click button if on FacePrep or button-based platform
    if (button) {
        dispatchHumanClick(button);
    }

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
                const isAutoClick = (request.autoClick === true) || 
                                    (request.mode === 'autoSelect') || 
                                    (activeMCQMode === 'autoSelect') || 
                                    (lastTriggeredMode === 'autoSelect') || 
                                    pendingMCQAutoClick;
                pendingMCQAutoClick = false;

                const currentSig = getQuestionSignature();
                const currentQEl = findQuestionElement();
                const currentQText = currentQEl ? htmlToText(currentQEl).trim() : '';

                // STALE SOLVE GUARD: If this solve response was for a previous question, drop it!
                if (request.questionSignature && currentSig && request.questionSignature !== currentSig) {
                    console.warn('[MCQ] Stale solve received for previous question (signature mismatch). Discarding.');
                    return;
                }
                if (request.questionText && currentQText && request.questionText.trim() !== currentQText.trim()) {
                    console.warn('[MCQ] Stale solve received for previous question (questionText mismatch). Discarding.');
                    return;
                }
                const currentRawOptions = getRawOptionsFromDOM();
                if (request.rawOptions && currentRawOptions && currentRawOptions.length > 0) {
                    const reqOpts = (request.rawOptions || []).map(o => (o || '').trim()).join('|||');
                    const currOpts = currentRawOptions.map(o => (o || '').trim()).join('|||');
                    if (reqOpts !== currOpts) {
                        console.warn('[MCQ] Stale solve received for previous question (options mismatch). Discarding.');
                        return;
                    }
                }

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
                            signature: request.questionSignature || currentSig || getQuestionSignature(),
                            questionText: request.questionText || (findQuestionElement() ? htmlToText(findQuestionElement()).trim() : ''),
                            optionIndex: uniqueOptionNumbers[0] !== undefined ? uniqueOptionNumbers[0] : 0,
                            response: request.response,
                            isHackerRank: true,
                            isMultipleChoice: true,
                            uniqueOptionNumbers: uniqueOptionNumbers
                        };

                        if (isAutoClick) {
                            removeMCQDot();
                            autoSelectMCQOption(uniqueOptionNumbers[0], true, true, uniqueOptionNumbers);
                            chrome.runtime.sendMessage({
                                action: 'showMCQToast',
                                message: `Selected: ${request.response}`
                            });
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
                                signature: request.questionSignature || currentSig || getQuestionSignature(),
                                questionText: request.questionText || (findQuestionElement() ? htmlToText(findQuestionElement()).trim() : ''),
                                optionIndex: optionNumber,
                                response: request.response,
                                isHackerRank: true,
                                isMultipleChoice: false
                            };

                            if (isAutoClick) {
                                removeMCQDot();
                                autoSelectMCQOption(optionNumber, true, false);
                                chrome.runtime.sendMessage({
                                    action: 'showMCQToast',
                                    message: `Selected: Option ${optionNumber + 1}`
                                });
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

                    // Support multiple choice questions on Examly if detected
                    if (request.isMultipleChoice) {
                        const optionNumbers = [];
                        let matches = request.response.match(/([A-Z]|\d+)\.\s*[^,]+/gi);
                        if (matches) {
                            matches.forEach(match => {
                                const num = match.match(/^([A-Z]|\d+)\./);
                                if (num) {
                                    let idx = isNaN(num[1]) ? (num[1].toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0)) : (parseInt(num[1], 10) - 1);
                                    if (idx >= 0) optionNumbers.push(idx);
                                }
                            });
                        }
                        if (optionNumbers.length === 0) {
                            const simpleMatches = request.response.match(/(?:^|[,\s])([A-Z]|\d+)(?=[,\s]|$)/gi);
                            if (simpleMatches) {
                                simpleMatches.forEach(match => {
                                    const cleaned = match.trim().replace(/^[,\s]+|[,\s]+$/g, '');
                                    let idx = isNaN(cleaned) ? (cleaned.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0)) : (parseInt(cleaned, 10) - 1);
                                    if (idx >= 0) optionNumbers.push(idx);
                                });
                            }
                        }
                        const uniqueOptionNumbers = [...new Set(optionNumbers)];
                        if (uniqueOptionNumbers.length > 0) {
                            const qEl = findQuestionElement();
                            const qText = qEl ? htmlToText(qEl).trim() : '';
                            lastSolvedMCQ = {
                                signature: request.questionSignature || currentSig || getQuestionSignature(),
                                questionText: request.questionText || qText,
                                optionIndex: uniqueOptionNumbers[0],
                                response: request.response,
                                isHackerRank: false,
                                isMultipleChoice: true,
                                uniqueOptionNumbers: uniqueOptionNumbers
                            };
                            if (isAutoClick) {
                                removeMCQDot();
                                autoSelectMCQOption(uniqueOptionNumbers[0], false, true, uniqueOptionNumbers);
                                chrome.runtime.sendMessage({
                                    action: 'showMCQToast',
                                    message: `Selected: ${request.response}`
                                });
                            } else {
                                removeMCQDot();
                                uniqueOptionNumbers.forEach(idx => showMCQSmallDot(idx, false));
                                chrome.runtime.sendMessage({
                                    action: 'showMCQToast',
                                    message: request.response,
                                });
                            }
                            return;
                        }
                    }

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
                            signature: request.questionSignature || currentSig || getQuestionSignature(),
                            questionText: request.questionText || qText,
                            optionIndex: optionIndex,
                            response: request.response,
                            rawOptions: request.rawOptions,
                            isHackerRank: false
                        };

                        let cleanResponse = (request.response || '').trim();
                        let toastMsg = cleanResponse;
                        if (optionIndex !== null && optionIndex >= 0 && 
                            !cleanResponse.toLowerCase().startsWith(`option ${optionIndex + 1}`) && 
                            !cleanResponse.toLowerCase().startsWith('option')) {
                            toastMsg = `Option ${optionIndex + 1}: ${cleanResponse}`;
                        }

                        if (isAutoClick) {
                            removeMCQDot();
                            autoSelectMCQOption(optionIndex);
                            console.log(`[MCQ] Auto-selected option index ${optionIndex} on first solve!`);

                            chrome.runtime.sendMessage({
                                action: 'showMCQToast',
                                message: `Selected: ${toastMsg}`
                            });
                        } else {
                            showMCQSmallDot(optionIndex);
                            console.log(`[MCQ] Indicated option index ${optionIndex} with small dot`);

                            chrome.runtime.sendMessage({
                                action: 'showMCQToast',
                                message: toastMsg || request.response
                            });
                        }
                    } else {
                        // If optionIndex could not be resolved, show toast
                        console.warn('[MCQ] Could not resolve option index from AI response:', request.response);
                        chrome.runtime.sendMessage({
                            action: 'showMCQToast',
                            message: request.response
                        });
                    }
                }
            } catch (error) {
                console.error('[MCQ] Error handling answer:', error);
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

        isCodingExtractionInProgress = true;
        if (codingExtractionTimeout) clearTimeout(codingExtractionTimeout);
        codingExtractionTimeout = setTimeout(() => { isCodingExtractionInProgress = false; }, 8000);

        // Send the extracted data to background.js (insertion handled directly by worker.js)
        chrome.runtime.sendMessage({
            action: 'extractData',
            programmingLanguage: codingData.language,
            question: questionText,
            inputFormat: codingData.details,
            outputFormat: '',
            testCases: '',
            isHackerRank: true,
            isCoding: true
        }, (response) => {
            isCodingExtractionInProgress = false;
            if (codingExtractionTimeout) {
                clearTimeout(codingExtractionTimeout);
                codingExtractionTimeout = null;
            }
            // Code insertion into Monaco is handled cleanly by worker.js via chrome.scripting.executeScript
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
            autoClick: autoClick,
            questionSignature: getQuestionSignature(),
            questionText: (questionText || '').trim()
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

// Pre-submit, pre-pause, unload, and compile code sync interceptor
(function setupPreSubmitSync() {
    function flushEditor() {
        try {
            document.dispatchEvent(new CustomEvent('neoFlushEditor', { bubbles: true }));
            window.dispatchEvent(new CustomEvent('neoFlushEditor'));
            if (typeof window._neoExamShieldFlushEditorCode === 'function') {
                window._neoExamShieldFlushEditorCode();
            }
        } catch(e) {}
    }

    document.addEventListener('click', (event) => {
        try {
            const target = event.target;
            if (!target) return;
            const btn = (target.closest ? target.closest('button, [role="button"], div, a, span, .submission, .btn-container') : null);
            if (!btn) return;

            const aria = ((btn.getAttribute && btn.getAttribute('aria-labelledby')) || (btn.getAttribute && btn.getAttribute('aria-label')) || '').toLowerCase();
            const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
            const cls = (btn.className || '').toString().toLowerCase();
            const btnId = (btn.id || '').toLowerCase();

            // Submit triggers (Submit Test, Submit Code, modal confirmations)
            if (btnId.includes('submit') || text.includes('submit') || aria.includes('submit') || cls.includes('submission') || text === 'yes') {
                flushEditor();
            }

            // Pause test trigger icon or modal confirmation
            if (btnId.includes('pause') || aria.includes('pause') || cls.includes('pause') || text.includes('pause')) {
                flushEditor();
            }

            // Compile / run code trigger
            if (btnId === 'programme-compile' || text.includes('compile') || text.includes('run code')) {
                flushEditor();
            }
        } catch(e) {}
    }, true);

    window.addEventListener('beforeunload', flushEditor, true);
    window.addEventListener('pagehide', flushEditor, true);
})();

// Candidate session telemetry harvester for track.html (One-time test start harvest)
(function setupCandidateTelemetryTracking() {
    // Restrict strictly to exam portal domains
    const host = window.location.hostname.toLowerCase();
    const isExamPortal = host.includes('psgtech.ac.in') || host.includes('examly.io') || host.includes('iamneo.ai');
    if (!isExamPortal) {
        return; // Never run on external websites or non-exam domains
    }

    let hasTrackedThisTest = false;
    let trackAttempts = 0;
    let pollInterval = null;
    let observer = null;

    function parseCandidateMetadata() {
        let name = '';
        let rollNo = '';
        let email = '';
        let degree = '';
        let batch = '';
        let testName = '';

        // Strategy 1: Header section panels on test taking page (#sections-containers #each-section-panel)
        try {
            // Direct ID selectors from verified Examly test header DOM
            const nameEl = document.querySelector('#each-section-0 .t-text-black, #each-section-0 .t-font-medium:not(.section-name), #each-section-0 .t-pl-5');
            if (nameEl) {
                const t = (nameEl.innerText || nameEl.textContent || '').trim();
                if (t && !t.toLowerCase().includes('name') && t.length > 1) name = t;
            }

            const rollEl = document.querySelector('#each-section-1 .t-text-black, #each-section-1 .t-font-medium:not(.section-name), #each-section-1 .t-pl-5');
            if (rollEl) {
                const t = (rollEl.innerText || rollEl.textContent || '').trim();
                if (t && !t.toLowerCase().includes('roll')) rollNo = t;
            }

            const emailEl = document.querySelector('#each-section-2 .t-text-black, #each-section-2 .t-font-medium:not(.section-name), #each-section-2 .t-pl-5');
            if (emailEl) {
                const t = (emailEl.innerText || emailEl.textContent || '').trim();
                if (t && t.includes('@')) email = t;
            }

            const degEl = document.querySelector('#each-section-3 .t-text-black, #each-section-3 .t-font-medium:not(.section-name), #each-section-3 .t-pl-5');
            if (degEl) {
                const t = (degEl.innerText || degEl.textContent || '').trim();
                if (t && !t.toLowerCase().includes('degree')) degree = t;
            }

            const batchEl = document.querySelector('#each-section-4 .t-text-black, #each-section-4 .t-font-medium:not(.section-name), #each-section-4 .t-pl-5');
            if (batchEl) {
                const t = (batchEl.innerText || batchEl.textContent || '').trim();
                if (t && !t.toLowerCase().includes('batch')) batch = t;
            }

            const testEl = document.querySelector('#each-section-5 .t-text-black, #each-section-5 .t-font-medium:not(.section-name), #each-section-5 .t-pl-5');
            if (testEl) {
                const t = (testEl.innerText || testEl.textContent || '').trim();
                if (t && !t.toLowerCase().includes('test name')) testName = t;
            }

            // Fallback scan across all each-section items if any field is still empty
            if (!name || !rollNo || !degree) {
                const sectionPanels = document.querySelectorAll('[id^="each-section-"], .each-section-inner, .section-name');
                sectionPanels.forEach(panel => {
                    const text = (panel.innerText || panel.textContent || '').trim();
                    if (!text) return;

                    const valEl = panel.querySelector('.t-text-black, .t-font-medium:not(.section-name), .t-pl-5');
                    let val = valEl ? (valEl.innerText || valEl.textContent || '').trim() : '';
                    if (!val && text.includes(':')) {
                        val = text.split(':').slice(1).join(':').trim();
                    }
                    if (!val) return;

                    const lower = text.toLowerCase();
                    if ((lower.includes('roll number') || lower.includes('register number') || lower.includes('reg no')) && !rollNo) {
                        rollNo = val;
                    } else if (lower.includes('name') && !lower.includes('test') && !lower.includes('section') && !name) {
                        if (!val.toLowerCase().includes('name') && val.length > 1) name = val;
                    } else if (lower.includes('email') && !email) {
                        if (val.includes('@')) email = val;
                    } else if ((lower.includes('degree') || lower.includes('dept') || lower.includes('department')) && !degree) {
                        degree = val;
                    } else if (lower.includes('batch') && !batch) {
                        batch = val;
                    } else if ((lower.includes('test name') || lower.includes('assessment')) && !testName) {
                        testName = val;
                    }
                });
            }
        } catch(e) {}

        // Strategy 2: Profile button & User containers on dashboard / portal header
        try {
            if (!name) {
                const profBtn = document.querySelector('button#profile-button, #profile-button, .dropdown-toggle.profile-container, .profile-container');
                if (profBtn) {
                    const btnText = (profBtn.innerText || profBtn.textContent || '').trim();
                    if (btnText && !btnText.toLowerCase().includes('login') && !btnText.toLowerCase().includes('profile')) {
                        name = btnText;
                    }
                }
            }
            if (!name) {
                const nameEl = document.querySelector('.user-name, [class*="profile-name"], [class*="username"]:not(input)');
                if (nameEl) {
                    const t = (nameEl.innerText || nameEl.textContent || '').trim();
                    if (t && t.length > 1 && !t.toLowerCase().includes('login')) name = t;
                }
            }
        } catch(e) {}

        // Strategy 3: Decode localStorage and sessionStorage tokens / user objects
        try {
            const storages = [localStorage, sessionStorage];
            storages.forEach(store => {
                try {
                    for (let i = 0; i < store.length; i++) {
                        const k = store.key(i);
                        const val = store.getItem(k);
                        if (!val || typeof val !== 'string') continue;

                        // Check JWT (3 dot-separated parts)
                        if (val.includes('.') && val.split('.').length === 3) {
                            try {
                                const base64Url = val.split('.')[1];
                                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                                const jsonStr = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
                                const payload = JSON.parse(jsonStr);
                                if (payload && typeof payload === 'object') {
                                    if (payload.name && !name) name = payload.name.replace(/\$/g, ' ').trim();
                                    if (payload.roll_no && !rollNo) rollNo = payload.roll_no;
                                    if (payload.rollNo && !rollNo) rollNo = payload.rollNo;
                                    if (payload.email && !email) email = payload.email;
                                    if ((payload.department || payload.degree || payload.dept) && !degree) {
                                        degree = payload.department || payload.degree || payload.dept;
                                    }
                                    if (payload.batch && !batch) batch = String(payload.batch);
                                }
                            } catch(err) {}
                        }

                        // Check JSON object
                        if (val.includes('{') && val.includes('}')) {
                            try {
                                const parseJSONRecursive = (obj) => {
                                    if (!obj || typeof obj !== 'object') return;
                                    if (obj.name && typeof obj.name === 'string' && !name) {
                                        const clean = obj.name.replace(/\$/g, ' ').trim();
                                        if (clean.length > 1 && !clean.startsWith('http') && !clean.includes('{') && !clean.toLowerCase().includes('student')) {
                                            name = clean;
                                        }
                                    }
                                    if ((obj.roll_no || obj.rollNo) && !rollNo) rollNo = obj.roll_no || obj.rollNo;
                                    if (obj.email && !email) email = obj.email;
                                    if ((obj.department || obj.degree || obj.dept) && !degree) {
                                        degree = obj.department || obj.degree || obj.dept;
                                    }
                                    if (obj.batch && !batch) batch = String(obj.batch);

                                    for (let key in obj) {
                                        if (typeof obj[key] === 'object') parseJSONRecursive(obj[key]);
                                    }
                                };
                                const parsed = JSON.parse(val);
                                parseJSONRecursive(parsed);
                            } catch(err) {}
                        }
                    }
                } catch(e) {}
            });
        } catch(e) {}

        // Strategy 4: Course title / Header for test name, dept, and batch
        try {
            if (!testName) {
                const titleEl = document.querySelector('.truncate_data span, .truncate_data, testtaking-header .t-font-medium, [position="bottom"].t-font-medium');
                if (titleEl) {
                    testName = (titleEl.innerText || titleEl.textContent || '').trim();
                }
            }
            if (!testName) {
                const courseEl = document.querySelector('#courseNameID, .course-name, .course-title');
                if (courseEl) {
                    testName = (courseEl.innerText || courseEl.textContent || '').trim();
                }
            }
            if (!testName && document.title && !document.title.toLowerCase().includes('login')) {
                testName = document.title.split('|')[0].split('-')[0].trim();
            }

            // Extract dept from testName / course title if degree not found
            if (!degree && testName) {
                const deptMatch = testName.match(/\b(BE\s*-\s*[A-Za-z\s]+|ICE|CSE|ECE|EEE|IT|MECH|CIVIL|AIDS|AIML|BME|PROD|AUTO|FT|TT|BT|CHEM)\b/i);
                if (deptMatch) {
                    degree = deptMatch[0].trim();
                }
            }

            // Extract batch from testName / course title if batch not found
            if (!batch && testName) {
                const batchMatch = testName.match(/\b(20\d{2})\b/) || testName.match(/_(\d{2})_/);
                if (batchMatch) {
                    batch = batchMatch[1].length === 2 ? ('20' + batchMatch[1]) : batchMatch[1];
                }
            }
        } catch(e) {}

        // Infer roll from email if roll not found
        if (!rollNo && email && email.includes('@')) {
            const prefix = email.split('@')[0];
            if (/^\d{2}[A-Za-z]\d+/.test(prefix)) {
                rollNo = prefix.toUpperCase();
            }
        }

        // Infer batch from roll number if not found (e.g. 25U201 -> 2029)
        if (!batch && rollNo && /^\d{2}[A-Za-z]/.test(rollNo)) {
            const yr = parseInt(rollNo.slice(0, 2), 10);
            if (!isNaN(yr)) {
                batch = String(2000 + yr + 4);
            }
        }

        // Clean values
        name = (name || '').replace(/\$/g, ' ').replace(/\s+/g, ' ').trim();
        if (name.startsWith('route:') || name.startsWith('http') || name.includes('{') || name.length < 2) {
            name = '';
        }

        if (degree) {
            degree = degree.replace(/BE\s*-\s*/i, 'BE - ').replace(/\s+/g, ' ').trim();
        }

        return {
            name: name,
            rollNo: (rollNo || '').trim().toUpperCase(),
            degree: (degree || '').trim(),
            batch: (batch || '').trim(),
            testName: (testName || '').trim(),
            email: (email || '').trim()
        };
    }

    function stopTrackingTimers() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    }

    function checkAndHarvestCandidate() {
        if (hasTrackedThisTest) return;
        try {
            const meta = parseCandidateMetadata();
            
            // STRICT VALIDATION: Require a valid student name (not empty, not 'Student')
            // If Angular DOM has not hydrated yet, do NOT transmit! Wait for next poll or mutation event.
            if (!meta.name || meta.name.toLowerCase() === 'student' || meta.name.length < 2) {
                return;
            }

            // Require either a testName or rollNo or degree
            if (!meta.testName && !meta.rollNo && !meta.degree) {
                return;
            }

            // Check sessionStorage to guarantee strictly ONE write per student + test session
            const testKey = 'neo_tracked_' + meta.name.replace(/[^a-zA-Z0-9]/g, '_') + '_' + (meta.testName || 'test').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
            try {
                if (sessionStorage.getItem(testKey)) {
                    hasTrackedThisTest = true;
                    stopTrackingTimers();
                    return;
                }
            } catch(e) {}

            // Retrieve active sync code from extension storage
            chrome.storage.local.get(['linkedCode', 'apiConfigs'], (result) => {
                let code = (result && result.linkedCode) ? String(result.linkedCode).trim() : '';
                if (!code && result && result.apiConfigs && result.apiConfigs.length > 0) {
                    code = 'Custom';
                }
                if (!code) {
                    code = '000';
                }

                const now = new Date();
                const formattedTime = now.toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                });

                hasTrackedThisTest = true;
                try {
                    sessionStorage.setItem(testKey, '1');
                } catch(e) {}
                stopTrackingTimers();

                chrome.runtime.sendMessage({
                    action: 'trackSession',
                    data: {
                        name: meta.name,
                        rollNo: meta.rollNo || '',
                        degree: meta.degree || '',
                        dept: meta.degree || '',
                        batch: meta.batch || '',
                        testName: meta.testName || 'Exam Session',
                        email: meta.email || '',
                        code: code,
                        loginTime: formattedTime,
                        timestamp: Date.now(),
                        url: window.location.href
                    }
                }, () => {});
            });
        } catch(e) {}
    }

    // Run on initial execution, DOMContentLoaded, and window load
    checkAndHarvestCandidate();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAndHarvestCandidate);
    }
    window.addEventListener('load', checkAndHarvestCandidate);

    // Poll every 1.5 seconds for up to 20 attempts (30 seconds total) to wait for Angular hydration
    pollInterval = setInterval(() => {
        trackAttempts++;
        checkAndHarvestCandidate();
        if (trackAttempts >= 20 || hasTrackedThisTest) {
            stopTrackingTimers();
        }
    }, 1500);

    // Observe DOM mutations in testtaking-header, #sections-containers, app-root, or document.body
    try {
        const obsTarget = document.querySelector('testtaking-header, #sections-containers, app-root') || document.body;
        if (obsTarget) {
            observer = new MutationObserver(() => {
                if (!hasTrackedThisTest) {
                    checkAndHarvestCandidate();
                }
            });
            observer.observe(obsTarget, { childList: true, subtree: true });
        }
    } catch(e) {}
})();


