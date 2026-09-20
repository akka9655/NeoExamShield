if (typeof chrome === "undefined") {}

if (typeof window.isMac === 'undefined') {
    window.isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || 
                   navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
}

(function() {
    chrome.storage.local.get(['stealth'], function(result) {
        if (window.chatOverlayInjected) {
            console.log("Chat overlay script already injected.");
            return;
        }
        window.chatOverlayInjected = true;
        
        const isStealthModeEnabled = result.stealth === true;
        console.log("Initial stealth mode state:", isStealthModeEnabled);


        function loadShowdown() {
            return new Promise((resolve, reject) => {
                if (typeof showdown !== 'undefined') {
                    resolve();
                    return;
                }

                const script = document.createElement('script');
                script.src = chrome.runtime.getURL('data/lib/showdown.min.js'); // Local path
                script.onload = resolve;
                script.onerror = reject;
                (document.head || document.documentElement)?.appendChild(script);
            });
        }

        function loadPrism() {
            return new Promise((resolve) => {
                // Create a lightweight inline syntax highlighter to bypass CSP
                window.SimplePrism = {
                    highlightElement: function(codeElement) {
                        const code = codeElement.textContent;
                        const language = codeElement.className.replace('language-', '');
                        
                        // Use a simpler approach to avoid overlapping replacements
                        let highlightedCode = this.simpleHighlight(code, language);
                        codeElement.innerHTML = highlightedCode;
                    },
                    
                    simpleHighlight: function(code, language) {
                        // Escape HTML first
                        let highlighted = code.replace(/&/g, '&amp;')
                                             .replace(/</g, '&lt;')
                                             .replace(/>/g, '&gt;');
                        
                        // Apply basic highlighting based on language
                        if (language === 'python') {
                            highlighted = this.highlightPython(highlighted);
                        } else if (language === 'javascript' || language === 'js') {
                            highlighted = this.highlightJavaScript(highlighted);
                        } else if (language === 'java') {
                            highlighted = this.highlightJava(highlighted);
                        } else if (language === 'css') {
                            highlighted = this.highlightCSS(highlighted);
                        } else if (language === 'html') {
                            highlighted = this.highlightHTML(highlighted);
                        } else if (language === 'sql') {
                            highlighted = this.highlightSQL(highlighted);
                        } else if (language === 'json') {
                            highlighted = this.highlightJSON(highlighted);
                        } else {
                            // Default to javascript-like highlighting
                            highlighted = this.highlightJavaScript(highlighted);
                        }
                        
                        return highlighted;
                    },
                    
                    highlightPython: function(code) {
                        // Use a token-based approach to avoid overlapping
                        let tokens = [];
                        let currentIndex = 0;
                        
                        // First, find all comments
                        let match;
                        const commentRegex = /#.*$/gm;
                        while ((match = commentRegex.exec(code)) !== null) {
                            tokens.push({
                                start: match.index,
                                end: match.index + match[0].length,
                                type: 'comment',
                                content: match[0]
                            });
                        }
                        
                        // Find strings (avoiding those inside comments)
                        const stringRegex = /(['"])((?:\\.|(?!\1)[^\\])*?)\1/g;
                        while ((match = stringRegex.exec(code)) !== null) {
                            if (!this.isInsideToken(match.index, tokens)) {
                                tokens.push({
                                    start: match.index,
                                    end: match.index + match[0].length,
                                    type: 'string',
                                    content: match[0]
                                });
                            }
                        }
                        
                        // Find keywords (avoiding those inside comments and strings)
                        const keywordRegex = /\b(def|class|if|elif|else|for|while|return|import|from|try|except|finally|with|as|and|or|not|in|is)\b/g;
                        while ((match = keywordRegex.exec(code)) !== null) {
                            if (!this.isInsideToken(match.index, tokens)) {
                                tokens.push({
                                    start: match.index,
                                    end: match.index + match[0].length,
                                    type: 'keyword',
                                    content: match[0]
                                });
                            }
                        }
                        
                        // Find booleans and None
                        const booleanRegex = /\b(True|False|None)\b/g;
                        while ((match = booleanRegex.exec(code)) !== null) {
                            if (!this.isInsideToken(match.index, tokens)) {
                                tokens.push({
                                    start: match.index,
                                    end: match.index + match[0].length,
                                    type: 'boolean',
                                    content: match[0]
                                });
                            }
                        }
                        
                        // Find numbers
                        const numberRegex = /\b\d+(\.\d+)?\b/g;
                        while ((match = numberRegex.exec(code)) !== null) {
                            if (!this.isInsideToken(match.index, tokens)) {
                                tokens.push({
                                    start: match.index,
                                    end: match.index + match[0].length,
                                    type: 'number',
                                    content: match[0]
                                });
                            }
                        }
                        
                        // Sort tokens by position
                        tokens.sort((a, b) => a.start - b.start);
                        
                        // Build highlighted code
                        let result = '';
                        let lastIndex = 0;
                        
                        tokens.forEach(token => {
                            // Add unhighlighted text before this token
                            result += code.slice(lastIndex, token.start);
                            // Add highlighted token
                            result += `<span class="${token.type}">${token.content}</span>`;
                            lastIndex = token.end;
                        });
                        
                        // Add remaining text
                        result += code.slice(lastIndex);
                        
                        return result;
                    },
                    
                    buildHighlightedCode: function(code, tokens) {
                        // Sort tokens by their start position
                        tokens.sort((a, b) => a.start - b.start);
                        
                        let result = '';
                        let lastIndex = 0;
                        
                        for (let token of tokens) {
                            // Add text before this token
                            result += code.slice(lastIndex, token.start);
                            
                            // Add the highlighted token
                            result += `<span class="${token.type}">${token.content}</span>`;
                            
                            lastIndex = token.end;
                        }
                        
                        // Add remaining text
                        result += code.slice(lastIndex);
                        
                        return result;
                    },
                    
                    isInsideToken: function(position, tokens) {
                        return tokens.some(token => position >= token.start && position < token.end);
                    },
                    
                    highlightJavaScript: function(code) {
                        let tokens = [];
                        let match;
                        
                        // Find comments first
                        const singleLineCommentRegex = /\/\/.*$/gm;
                        while ((match = singleLineCommentRegex.exec(code)) !== null) {
                            tokens.push({
                                start: match.index,
                                end: match.index + match[0].length,
                                type: 'comment',
                                content: match[0]
                            });
                        }
                        
                        const multiLineCommentRegex = /\/\*[\s\S]*?\*\//g;
                        while ((match = multiLineCommentRegex.exec(code)) !== null) {
                            tokens.push({
                                start: match.index,
                                end: match.index + match[0].length,
                                type: 'comment',
                                content: match[0]
                            });
                        }
                        
                        // Find strings
                        const stringRegex = /(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g;
                        while ((match = stringRegex.exec(code)) !== null) {
                            if (!this.isInsideToken(match.index, tokens)) {
                                tokens.push({
                                    start: match.index,
                                    end: match.index + match[0].length,
                                    type: 'string',
                                    content: match[0]
                                });
                            }
                        }
                        
                        // Find keywords
                        const keywordRegex = /\b(function|const|let|var|if|else|for|while|return|import|export|class|extends|new|this|typeof|instanceof)\b/g;
                        while ((match = keywordRegex.exec(code)) !== null) {
                            if (!this.isInsideToken(match.index, tokens)) {
                                tokens.push({
                                    start: match.index,
                                    end: match.index + match[0].length,
                                    type: 'keyword',
                                    content: match[0]
                                });
                            }
                        }
                        
                        // Find booleans
                        const booleanRegex = /\b(true|false|null|undefined)\b/g;
                        while ((match = booleanRegex.exec(code)) !== null) {
                            if (!this.isInsideToken(match.index, tokens)) {
                                tokens.push({
                                    start: match.index,
                                    end: match.index + match[0].length,
                                    type: 'boolean',
                                    content: match[0]
                                });
                            }
                        }
                        
                        // Find numbers
                        const numberRegex = /\b\d+(\.\d+)?\b/g;
                        while ((match = numberRegex.exec(code)) !== null) {
                            if (!this.isInsideToken(match.index, tokens)) {
                                tokens.push({
                                    start: match.index,
                                    end: match.index + match[0].length,
                                    type: 'number',
                                    content: match[0]
                                });
                            }
                        }
                        
                        return this.buildHighlightedCode(code, tokens);
                    },
                    
                    highlightJava: function(code) {
                        let tokens = [];
                        let match;
                        
                        // Find comments first
                        const singleLineCommentRegex = /\/\/.*$/gm;
                        while ((match = singleLineCommentRegex.exec(code)) !== null) {
                            tokens.push({
                                start: match.index,
                                end: match.index + match[0].length,
                                type: 'comment',
                                content: match[0]
                            });
                        }
                        
                        const multiLineCommentRegex = /\/\*[\s\S]*?\*\//g;
                        while ((match = multiLineCommentRegex.exec(code)) !== null) {
                            tokens.push({
                                start: match.index,
                                end: match.index + match[0].length,
                                type: 'comment',
                                content: match[0]
                            });
                        }
                        
                        // Find strings
                        const stringRegex = /(['"])((?:\\.|(?!\1)[^\\])*?)\1/g;
                        while ((match = stringRegex.exec(code)) !== null) {
                            if (!this.isInsideToken(match.index, tokens)) {
                                tokens.push({
                                    start: match.index,
                                    end: match.index + match[0].length,
                                    type: 'string',
                                    content: match[0]
                                });
                            }
                        }
                        
                        // Find keywords
                        const keywordRegex = /\b(public|private|protected|static|final|class|interface|extends|implements|if|else|for|while|return|import|package|new|this)\b/g;
                        while ((match = keywordRegex.exec(code)) !== null) {
                            if (!this.isInsideToken(match.index, tokens)) {
                                tokens.push({
                                    start: match.index,
                                    end: match.index + match[0].length,
                                    type: 'keyword',
                                    content: match[0]
                                });
                            }
                        }
                        
                        // Find booleans
                        const booleanRegex = /\b(true|false|null)\b/g;
                        while ((match = booleanRegex.exec(code)) !== null) {
                            if (!this.isInsideToken(match.index, tokens)) {
                                tokens.push({
                                    start: match.index,
                                    end: match.index + match[0].length,
                                    type: 'boolean',
                                    content: match[0]
                                });
                            }
                        }
                        
                        // Find numbers
                        const numberRegex = /\b\d+(\.\d+)?[fFdDlL]?\b/g;
                        while ((match = numberRegex.exec(code)) !== null) {
                            if (!this.isInsideToken(match.index, tokens)) {
                                tokens.push({
                                    start: match.index,
                                    end: match.index + match[0].length,
                                    type: 'number',
                                    content: match[0]
                                });
                            }
                        }
                        
                        return this.buildHighlightedCode(code, tokens);
                    },
                    
                    highlightCSS: function(code) {
                        // Comments first
                        code = code.replace(/\/\*[\s\S]*?\*\//g, '<span class="comment">$&</span>');
                        // Selectors
                        code = code.replace(/([.#][a-zA-Z][a-zA-Z0-9_-]*)/g, '<span class="selector">$1</span>');
                        // Properties
                        code = code.replace(/([a-zA-Z-]+)(\s*:)/g, '<span class="property">$1</span>$2');
                        // Values
                        code = code.replace(/(#[0-9a-fA-F]+)/g, '<span class="value">$1</span>');
                        return code;
                    },
                    
                    highlightHTML: function(code) {
                        // Comments first
                        code = code.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="comment">$1</span>');
                        // Tags
                        code = code.replace(/(&lt;\/?[^&gt;]+&gt;)/g, '<span class="tag">$1</span>');
                        return code;
                    },
                    
                    highlightSQL: function(code) {
                        // Comments first
                        code = code.replace(/--.*$/gm, '<span class="comment">$&</span>');
                        // Strings
                        code = code.replace(/'[^']*'/g, '<span class="string">$&</span>');
                        // Keywords
                        code = code.replace(/\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE|INDEX|PRIMARY|KEY|FOREIGN|NOT|NULL|DEFAULT|AND|OR|ORDER|BY|GROUP|HAVING|LIMIT)\b/gi, '<span class="keyword">$1</span>');
                        // Numbers
                        code = code.replace(/\b\d+(\.\d+)?\b/g, '<span class="number">$&</span>');
                        return code;
                    },
                    
                    highlightJSON: function(code) {
                        // Property keys first (before general strings)
                        code = code.replace(/"([^"]*)"(\s*:)/g, '<span class="property">"$1"</span>$2');
                        // Remaining strings
                        code = code.replace(/"([^"]*)"/g, '<span class="string">"$1"</span>');
                        // Booleans and null
                        code = code.replace(/\b(true|false|null)\b/g, '<span class="boolean">$1</span>');
                        // Numbers
                        code = code.replace(/\b\d+(\.\d+)?\b/g, '<span class="number">$&</span>');
                        return code;
                    }
                };
                
                // Add CSS for syntax highlighting with clean default theme
                // Styles will be added to shadow DOM later, not to document.head
                window._chatSyntaxHighlightCSS = `
                    .keyword { color: #0066CC; font-weight: bold; }
                    .string { color: #008000; }
                    .comment { color: #808080; font-style: italic; }
                    .number { color: #FF6600; }
                    .boolean { color: #0066CC; font-weight: bold; }
                    .property { color: #9932CC; }
                    .selector { color: #008000; font-weight: bold; }
                    .value { color: #FF6600; }
                    .tag { color: #0066CC; }
                `;
                
                resolve();
            });
        }

        // Chat icon SVG data URL (matching Crisp style)
        const CHAT_ICON_SVG_URL = 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20width%3D%2235%22%20height%3D%2230%22%20viewBox%3D%220%200%2035%2030%22%3E%3Cdefs%3E%3Cfilter%20id%3D%22c%22%20width%3D%22123.1%25%22%20height%3D%22127.9%25%22%20x%3D%22-11.5%25%22%3E%3CfeOffset%20dy%3D%221%22%20in%3D%22SourceAlpha%22%20result%3D%22shadowOffsetOuter1%22%2F%3E%3CfeGaussianBlur%20in%3D%22shadowOffsetOuter1%22%20result%3D%22shadowBlurOuter1%22%20stdDeviation%3D%221%22%2F%3E%3CfeColorMatrix%20in%3D%22shadowBlurOuter1%22%20values%3D%220%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200.07%200%22%2F%3E%3C%2Ffilter%3E%3Cfilter%20id%3D%22e%22%20width%3D%22129.7%25%22%20height%3D%22135.9%25%22%20x%3D%22-14.8%25%22%20y%3D%22-14%25%22%3E%3CfeMorphology%20in%3D%22SourceAlpha%22%20radius%3D%221%22%20result%3D%22shadowSpreadInner1%22%2F%3E%3CfeGaussianBlur%20in%3D%22shadowSpreadInner1%22%20result%3D%22shadowBlurInner1%22%20stdDeviation%3D%222%22%2F%3E%3CfeOffset%20in%3D%22shadowBlurInner1%22%20result%3D%22shadowOffsetInner1%22%2F%3E%3CfeComposite%20in%3D%22shadowOffsetInner1%22%20in2%3D%22SourceAlpha%22%20k2%3D%22-1%22%20k3%3D%221%22%20operator%3D%22arithmetic%22%20result%3D%22shadowInnerInner1%22%2F%3E%3CfeColorMatrix%20in%3D%22shadowInnerInner1%22%20values%3D%220%200%200%200%201%200%200%200%200%201%200%200%200%200%201%200%200%200%200.750191215%200%22%2F%3E%3C%2Ffilter%3E%3ClinearGradient%20id%3D%22d%22%20x1%3D%2246.514%25%22%20x2%3D%2256.692%25%22%20y1%3D%2215.835%25%22%20y2%3D%2275.847%25%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%23fff%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23fff%22%20stop-opacity%3D%22.601%22%2F%3E%3C%2FlinearGradient%3E%3Cpath%20id%3D%22a%22%20d%3D%22m40.34%2016.878.005.052%201.327%2014.35a2%202%200%200%201-1.754%202.17l-7.814.934-3.293%205.326a1%201%200%200%201-1.574.165l-4.207-4.407-8.113.969a2%202%200%200%201-2.228-1.802l-1.328-14.35a2%202%200%200%201%201.755-2.17l25-2.986a2%202%200%200%201%202.223%201.749%22%2F%3E%3C%2Fdefs%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%20transform%3D%22translate%28-9%20-14%29%22%3E%3Cuse%20xlink%3Ahref%3D%22%23a%22%20fill%3D%22%23000%22%20filter%3D%22url%28%23c%29%22%2F%3E%3Cuse%20xlink%3Ahref%3D%22%23a%22%20fill%3D%22url%28%23d%29%22%2F%3E%3Cuse%20xlink%3Ahref%3D%22%23a%22%20fill%3D%22%23000%22%20filter%3D%22url%28%23e%29%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E")';

        // State variables
        let isOverlayVisible = false;
        let chatHistory = [];
        let isDragging = false;
        let isResizing = false;
        let markdownConverter = null; // Will be initialized when showdown loads
        let currentStreamingDiv = null; // Tracks the current assistant message being streamed
        let chatAboutQuestionEnabled = false; // Toggle for chat about question feature
        let extractedQuestion = null; // Store extracted question

        // Helper function to access elements in shadow DOM
        function getShadowElement(id) {
            const root = window._neoChatShadowRoot || (window._neoChatShadowHost && window._neoChatShadowHost.shadowRoot) || document.getElementById('chat-overlay-shadow-host')?.shadowRoot;
            if (!root) return null;
            return root.getElementById(id);
        }
        
        function getShadowRoot() {
            return window._neoChatShadowRoot || (window._neoChatShadowHost && window._neoChatShadowHost.shadowRoot) || document.getElementById('chat-overlay-shadow-host')?.shadowRoot;
        }
        
        function getChatButton() {
            return null; // Button permanently eliminated for maximum stealth
        }

        // Drag and resize state
        let dragOffsetX;
        let dragOffsetY;
        let initialWidth;
        let initialHeight;
        let resizeStartX;
        let resizeStartY;

        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap';
        fontLink.rel = 'stylesheet';
        (document.head || document.documentElement)?.appendChild(fontLink);

        // Question extraction functions
        function detectPlatform() {
            // Check for FacePrep (student.faceprep.in or FacePrep UI elements)
            if (window.location.hostname.includes('faceprep.in') ||
                document.querySelector('button[data-testid^="mcq-option-"]') ||
                document.querySelector('[data-testid="prev-question-btn"]') ||
                document.querySelector('[data-testid="reading-passage"]') ||
                document.querySelector('[data-testid="assessment-card"]') ||
                document.querySelector('img[src*="faceprep"]')) {
                return 'faceprep';
            }
            // Check for Examly/IamNeo
            if (document.querySelector('div[aria-labelledby="question-data"], testtaking-playground, test-taking, testtaking-question, mcqsinglecorrect-question, mcqmultiplecorrect-question, programming-question')) {
                return 'examly';
            }
            // Check for HackerRank
            if (document.querySelector('.QuestionDetails_container__AIu0X') || 
                document.querySelector('.monaco-editor') ||
                document.querySelector('.grouped-mcq__question')) {
                return 'hackerrank';
            }
            return null;
        }

        function extractFacePrepQuestion() {
            try {
                // 1. Check for MCQ options
                const optionButtons = document.querySelectorAll('button[data-testid^="mcq-option-"]');
                if (optionButtons && optionButtons.length > 0) {
                    // FacePrep MCQ
                    let headerText = "";
                    const headerEl = document.querySelector('.bg-white.rounded-xl header, header, .shadow-brutal-header');
                    if (headerEl) headerText = headerEl.innerText.trim();

                    // In MCQUI, question markdown is inside div.w-full before the h-px divider
                    let questionText = "";
                    const divider = document.querySelector('div.w-full div.h-px, div.h-px.bg-gray-500');
                    if (divider && divider.previousElementSibling) {
                        questionText = divider.previousElementSibling.innerText.trim();
                    } else {
                        const questionContainers = document.querySelectorAll('div[class*="overflow-y-auto"] .w-full, div.w-full');
                        if (questionContainers.length > 0) {
                            questionText = questionContainers[0].innerText.trim();
                        }
                    }

                    // Reading passage if present
                    const passageEl = document.querySelector('[data-testid="reading-passage"]');
                    const passageText = passageEl ? passageEl.innerText.trim() : "";

                    const optionsText = [];
                    optionButtons.forEach((btn, idx) => {
                        const clone = btn.cloneNode(true);
                        const badge = clone.querySelector('span.rounded-md, span.min-w-8');
                        const letter = badge ? badge.innerText.trim() : String.fromCharCode(65 + idx);
                        if (badge) badge.remove();
                        const optContent = clone.innerText.trim();
                        optionsText.push(`Option ${letter}: ${optContent}`);
                    });

                    return {
                        type: 'mcq',
                        title: headerText || (passageText ? 'Reading Comprehension Question' : 'MCQ Question'),
                        instruction: passageText ? `Passage:\n${passageText}` : '',
                        question: questionText,
                        options: optionsText.join('\n')
                    };
                }

                // 2. Check for Coding Challenge (Monaco Editor)
                const monacoEl = document.querySelector('.monaco-editor');
                if (monacoEl) {
                    let title = "Coding Challenge";
                    const titleBadge = document.querySelector('.w-full span.inline-flex, span[class*="rounded-lg"]');
                    if (titleBadge) title = titleBadge.innerText.trim();

                    let questionText = "";
                    const descContainer = document.querySelector('div[class*="overflow-y-auto"] .w-full, div.w-full');
                    if (descContainer) questionText = descContainer.innerText.trim();

                    let language = "Unknown";
                    const selectEl = document.querySelector('select');
                    if (selectEl) {
                        language = selectEl.options[selectEl.selectedIndex]?.text || selectEl.value;
                    }

                    let currentCode = "";
                    if (typeof monaco !== 'undefined' && window.monaco && window.monaco.editor) {
                        const editors = window.monaco.editor.getEditors();
                        if (editors && editors.length > 0) {
                            currentCode = editors[0].getValue();
                        }
                    }

                    return {
                        type: 'coding',
                        language: language,
                        title: title,
                        question: questionText,
                        code: currentCode
                    };
                }

                return null;
            } catch (err) {
                console.error('[FacePrep] Extraction error:', err);
                return null;
            }
        }

        function extractExamlyQuestion() {
            const questionElement = document.querySelector('div[aria-labelledby="question-data"], testtaking-question .ql-editor, div.ql-editor') ||
                                   document.querySelector('testtaking-question');
            if (!questionElement) return null;

            const questionText = questionElement.innerText.trim();

            // Check if MCQ answer elements or options exist
            const mcqAnswerEl = document.querySelector('mcqsinglecorrect-answer, mcqmultiplecorrect-answer, [aria-labelledby="mcqsinglecorrect-container"], [aria-labelledby="mcqmultiplecorrect-container"]');
            const optionsElements = document.querySelectorAll('div[aria-labelledby="each-option"], [id^="tt-option-"]');

            const qTypeBadge = document.querySelector('testtaking-question [aria-labelledby="question-type"], div[aria-labelledby="question-type"]');
            const qTypeText = qTypeBadge ? (qTypeBadge.innerText || qTypeBadge.textContent || '').trim().toLowerCase() : '';
            const isExplicitMCQ = qTypeText.includes('multi choice') || qTypeText.includes('multiple choice') || qTypeText.includes('mcq') || qTypeText.includes('single correct') || qTypeText.includes('multiple correct');
            const isExplicitCoding = qTypeText.includes('programming') || qTypeText.includes('single file') || qTypeText.includes('coding');

            const isMCQ = isExplicitMCQ || (mcqAnswerEl !== null) || (optionsElements.length > 0 && !isExplicitCoding);

            if (!isMCQ) {
                // Coding question
                const programmingLanguageElement = document.querySelector('app-language-dropdown span.inner-text, span.inner-text');
                const programmingLanguage = programmingLanguageElement ? programmingLanguageElement.innerText.trim() : 'Programming language not found.';

                const inputFormatElement = document.querySelector('div[aria-labelledby="input-format"]');
                const inputFormatText = inputFormatElement ? inputFormatElement.innerText.trim() : '';

                const outputFormatElement = document.querySelector('div[aria-labelledby="output-format"]');
                const outputFormatText = outputFormatElement ? outputFormatElement.innerText.trim() : '';

                const sampleTestCaseElements = document.querySelectorAll('div[aria-labelledby="each-tc-card"]');
                let testCasesText = '';
                sampleTestCaseElements.forEach((testCase, index) => {
                    const inputElement = testCase.querySelector('div[aria-labelledby="each-tc-input-container"] pre');
                    const outputElement = testCase.querySelector('div[aria-labelledby="each-tc-output-container"] pre');

                    const inputText = inputElement ? inputElement.innerText.trim() : 'Input not found';
                    const outputText = outputElement ? outputElement.innerText.trim() : 'Output not found';

                    testCasesText += `Sample Test Case ${index + 1}:\nInput:\n${inputText}\nOutput:\n${outputText}\n\n`;
                });

                return {
                    type: 'coding',
                    language: programmingLanguage,
                    question: questionText,
                    inputFormat: inputFormatText,
                    outputFormat: outputFormatText,
                    testCases: testCasesText
                };
            } else {
                // MCQ question (including MCQs with code snippets)
                const codeLines = [];
                const codeElements = document.querySelectorAll('.ace_layer.ace_text-layer .ace_line');
                codeElements.forEach(line => {
                    const txt = (line.innerText !== undefined ? line.innerText : line.textContent || '').replace(/\r/g, '');
                    codeLines.push(txt);
                });
                let codeText = (codeLines.length > 0 && codeLines.some(l => l.trim().length > 0)) ? codeLines.join('\n') : null;

                if (!codeText) {
                    const preCode = document.querySelector('testtaking-question pre code, testtaking-question pre, .ql-syntax');
                    if (preCode) codeText = preCode.innerText.trim();
                }

                const optionsText = [];
                const seenOptions = new Set();
                optionsElements.forEach((option) => {
                    const txt = option.innerText.trim();
                    if (txt && !seenOptions.has(txt)) {
                        seenOptions.add(txt);
                        optionsText.push(`Option ${optionsText.length + 1}: ${txt}`);
                    }
                });

                return {
                    type: 'mcq',
                    question: questionText,
                    code: codeText,
                    options: optionsText.join('\n')
                };
            }
        }

        function extractHackerRankQuestion() {
            const getCleanText = el => el?.innerText?.trim() || "";

            // Check if it's a coding question (has Monaco editor)
            const monacoEditor = document.querySelector('.monaco-editor, .hr-monaco-editor');
            
            if (monacoEditor) {
                // Coding question
                let language = "Unknown";
                let title = "No Title Found";
                let instruction = "No Instructions Found";
                let details = "";

                const newLanguageSelector = document.querySelector('.select-language .css-3d4y2u-singleValue, .select-language .css-x7738g');
                if (newLanguageSelector) {
                    language = getCleanText(newLanguageSelector);
                } else {
                    language = getCleanText(document.querySelector('.select-language .css-x7738g')) || "Unknown";
                }

                let container = document.querySelector('.QuestionDetails_container__AIu0X');
                if (container) {
                    const titleElement = container.querySelector('.qaas-block-question-title, h2');
                    if (titleElement) {
                        const titleText = titleElement.textContent || titleElement.innerText;
                        title = titleText.replace(/Bookmark question \d+/g, '').trim();
                    }
                    
                    const instructionElement = container.querySelector('.qaas-block-question-instruction, .RichTextPreview_richText__1vKu5');
                    if (instructionElement) {
                        instruction = getCleanText(instructionElement);
                    }
                    
                    const detailsElements = container.querySelectorAll('details');
                    if (detailsElements.length > 0) {
                        details = Array.from(detailsElements).map(detail => {
                            const summary = getCleanText(detail.querySelector('summary'));
                            const content = getCleanText(detail.querySelector('.collapsable-details'));
                            return `\n${summary}\n${'-'.repeat(summary.length)}\n${content}`;
                        }).join('\n');
                    }
                } else {
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

                return {
                    type: 'coding',
                    language: language,
                    title: title,
                    instruction: instruction,
                    details: details
                };
            } else {
                // MCQ question
                const newLayoutQuestions = document.querySelectorAll('.QuestionDetails_container__AIu0X');
                
                if (newLayoutQuestions.length > 0) {
                    // New layout
                    const container = newLayoutQuestions[0]; // Get first question
                    let title = '';
                    let instruction = '';
                    let options = [];

                    const titleElement = container.querySelector('.qaas-block-question-title, h2');
                    if (titleElement) {
                        const titleText = titleElement.textContent || titleElement.innerText;
                        title = titleText.replace(/Bookmark question \d+/g, '').trim();
                    }

                    const instructionElement = container.querySelector('.qaas-block-question-instruction, .RichTextPreview_richText__1vKu5');
                    if (instructionElement) {
                        instruction = getCleanText(instructionElement);
                    }

                    let optionsContainer = container.nextElementSibling;
                    let attempts = 0;
                    while (optionsContainer && attempts < 5) {
                        const hasOptions = optionsContainer.querySelector('[role="checkbox"], [role="radio"]');
                        if (hasOptions) break;
                        optionsContainer = optionsContainer.nextElementSibling;
                        attempts++;
                    }

                    if (optionsContainer) {
                        let optionElements = optionsContainer.querySelectorAll('[role="radio"]');
                        if (optionElements.length === 0) {
                            optionElements = optionsContainer.querySelectorAll('[role="checkbox"]');
                        }

                        optionElements.forEach((option, index) => {
                            const labelId = option.getAttribute('aria-labelledby');
                            const labelElement = labelId ? document.getElementById(labelId) : 
                                              option.closest('.Control_optionList__vIubt, li')?.querySelector('label');
                            
                            if (labelElement) {
                                options.push(`Option ${index + 1}: ${labelElement.textContent.trim()}`);
                            }
                        });
                    }

                    return {
                        type: 'mcq',
                        title: title,
                        instruction: instruction,
                        options: options.join('\n')
                    };
                } else {
                    // Old layout
                    const oldLayoutQuestion = document.querySelector('.grouped-mcq__question');
                    if (oldLayoutQuestion) {
                        let title = '';
                        let instruction = '';
                        let options = [];

                        const titleElement = oldLayoutQuestion.querySelector('.question-view__title');
                        if (titleElement) {
                            title = titleElement.textContent.trim();
                        }

                        const instructionElement = oldLayoutQuestion.querySelector('.question-view__instruction');
                        if (instructionElement) {
                            instruction = instructionElement.textContent.trim();
                        }

                        const optionElements = oldLayoutQuestion.querySelectorAll('.ui-radio');
                        optionElements.forEach((option, index) => {
                            const labelElement = option.querySelector('.label');
                            if (labelElement) {
                                options.push(`Option ${index + 1}: ${labelElement.textContent.trim()}`);
                            }
                        });

                        return {
                            type: 'mcq',
                            title: title,
                            instruction: instruction,
                            options: options.join('\n')
                        };
                    }
                }
            }

            return null;
        }

        function extractCurrentQuestion() {
            const platform = detectPlatform();
            
            if (platform === 'faceprep') {
                return extractFacePrepQuestion();
            } else if (platform === 'examly') {
                return extractExamlyQuestion();
            } else if (platform === 'hackerrank') {
                return extractHackerRankQuestion();
            }
            
            return null;
        }

        function formatQuestionForChat(questionData) {
            if (!questionData) return null;

            let formattedQuestion = '';

            if (questionData.type === 'coding') {
                if (questionData.language) {
                    // Examly or HackerRank coding
                    formattedQuestion += `[Coding Question - ${questionData.language}]\n\n`;
                    
                    if (questionData.title) {
                        formattedQuestion += `Title: ${questionData.title}\n\n`;
                    }
                    
                    if (questionData.question) {
                        formattedQuestion += `Question:\n${questionData.question}\n\n`;
                    }
                    
                    if (questionData.instruction) {
                        formattedQuestion += `Instruction:\n${questionData.instruction}\n\n`;
                    }
                    
                    if (questionData.inputFormat) {
                        formattedQuestion += `Input Format:\n${questionData.inputFormat}\n\n`;
                    }
                    
                    if (questionData.outputFormat) {
                        formattedQuestion += `Output Format:\n${questionData.outputFormat}\n\n`;
                    }
                    
                    if (questionData.testCases) {
                        formattedQuestion += `Test Cases:\n${questionData.testCases}\n\n`;
                    }
                    
                    if (questionData.details) {
                        formattedQuestion += `Additional Details:${questionData.details}\n\n`;
                    }
                }
            } else if (questionData.type === 'mcq') {
                formattedQuestion += `[MCQ Question]\n\n`;
                
                if (questionData.title) {
                    formattedQuestion += `Title: ${questionData.title}\n\n`;
                }
                
                if (questionData.question) {
                    formattedQuestion += `Question:\n${questionData.question}\n\n`;
                }
                
                if (questionData.instruction) {
                    formattedQuestion += `${questionData.instruction}\n\n`;
                }
                
                if (questionData.code) {
                    formattedQuestion += `Code:\n${questionData.code}\n\n`;
                }
                
                if (questionData.options) {
                    formattedQuestion += `Options:\n${questionData.options}\n`;
                }
            }

            return formattedQuestion.trim();
        }

        // Create the main chat overlay UI
        function createChatOverlay() {
            // Check if shadow host already exists
            let shadowHost = document.getElementById("chat-overlay-shadow-host");
            if (shadowHost) {
                return shadowHost.shadowRoot.querySelector("#chat-overlay");
            }

            // Create shadow host element
            shadowHost = document.createElement("div");
            shadowHost.id = "chat-overlay-shadow-host";
            shadowHost.setAttribute("data-neo-stealth", "true");
            shadowHost.setAttribute("aria-hidden", "true");
            shadowHost.style.cssText = `
                position: fixed;
                bottom: 0;
                right: 0;
                z-index: 2147483647;
                pointer-events: none;
            `;

            // Attach shadow root
            const shadowRoot = shadowHost.attachShadow({ mode: 'open' });

            const overlay = document.createElement("div");
            overlay.id = "chat-overlay";
            overlay.setAttribute("data-neo-stealth", "true");
            overlay.style.cssText = `
                display: ${isOverlayVisible ? "flex" : "none"};
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 390px;
                height: 520px;
                background-color: rgba(255, 255, 255, 0.78);
                backdrop-filter: blur(20px) saturate(180%);
                -webkit-backdrop-filter: blur(20px) saturate(180%);
                border: 1px solid rgba(255, 255, 255, 0.6);
                border-radius: 18px;
                box-shadow: 0 16px 40px rgba(0, 0, 0, 0.14), inset 0 0 0 1px rgba(255, 255, 255, 0.4);
                z-index: 2147483647;
                flex-direction: column;
                font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                overflow: hidden;
                transition: opacity 0.25s ease, background-color 0.25s ease;
                pointer-events: auto;
                opacity: 0.88;
            `;

            // Create header
            const header = document.createElement("div");
            header.style.cssText = `
            padding: 13px 18px !important;
            font-weight: 500 !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            background-color: rgba(255, 255, 255, 0.65) !important;
            backdrop-filter: blur(12px) !important;
            -webkit-backdrop-filter: blur(12px) !important;
            border-bottom: 1px solid rgba(0, 0, 0, 0.06) !important;
            color: #333 !important;
            cursor: move !important;
            user-select: none !important;
        `;

            header.innerHTML = `
        <div style="display: flex !important; flex-direction: column !important; align-items: flex-start !important; gap: 2px !important;">
            <span style="display: flex !important; align-items: center !important; gap: 8px !important; font-size: 17px !important; font-weight: 700 !important; color: rgb(60, 84, 114) !important;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                Chat
            </span>
            <span style="font-size: 11px !important; font-weight: 500 !important; color: #777 !important; margin-left: 28px !important;">
                ${window.isMac ? 'Option+D' : 'Alt+D'} to hide
            </span>
        </div>
        <div style="display: flex !important; gap: 8px !important; align-items: center !important;">
            <button id="ghost-toggle" title="Cycle transparency (Glass / Ghost / Normal)" style="background: rgba(60, 84, 114, 0.08); border: 1px solid rgba(60, 84, 114, 0.2); border-radius: 6px; padding: 3px 9px; font-size: 11px; font-weight: 600; color: rgb(60, 84, 114); cursor: pointer; transition: all 0.2s ease;">Ghost</button>
            <span id="clear-chat" style="cursor: pointer !important; font-size: 13px !important; font-weight: 600 !important; color: rgb(220, 53, 69) !important; padding: 4px 6px !important; transition: all 0.2s ease !important;" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">Clear</span>
            <span id="close-chat" style="cursor: pointer !important; font-size: 22px !important; line-height: 1 !important; color: #888 !important; transition: color 0.2s ease !important; font-weight: 500 !important; padding: 0 4px !important;" onmouseover="this.style.color='#333'" onmouseout="this.style.color='#888'">×</span>
        </div>
        `;

            // Create opacity slider container (Stealth mode control)
            const sliderContainer = document.createElement("div");
            sliderContainer.style.cssText = `
                width: 100%;
                height: 3px;
                background-color: rgba(60, 84, 114, 0.12);
                position: relative;
                z-index: 10;
                display: flex;
                align-items: center;
            `;

            const opacitySlider = document.createElement("input");
            opacitySlider.type = "range";
            opacitySlider.min = "10";
            opacitySlider.max = "100";
            opacitySlider.value = "88";
            opacitySlider.id = "opacity-slider";
            opacitySlider.title = "Adjust opacity / Enable Stealth Mode";
            sliderContainer.appendChild(opacitySlider);

            // Create messages container
            const messagesContainer = document.createElement("div");
            messagesContainer.id = "chat-messages";
            messagesContainer.style.cssText = `
        padding: 16px;
        flex: 1;
        overflow-y: auto;
        background-color: rgba(248, 249, 251, 0.45);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        color: #222;
        scroll-behavior: smooth;
        white-space: pre-wrap;
        display: flex;
        flex-direction: column;
        gap: 12px;
        `;

            // Create input area
            const inputArea = document.createElement("div");
            inputArea.style.cssText = `
        padding: 10px 14px 14px 14px;
        background-color: rgba(255, 255, 255, 0.65);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-top: 1px solid rgba(0, 0, 0, 0.06);
        display: flex;
        flex-direction: column;
        gap: 8px;
        z-index: 10;
        `;

            // Create button container (which now acts as the pill wrapper)
            const buttonContainer = document.createElement("div");
            buttonContainer.style.cssText = `
        display: flex;
        align-items: stretch; /* Stretch children to fill height */
        background-color: rgba(242, 245, 248, 0.85);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 24px;
        padding: 0; /* Remove all padding from container */
        transition: all 0.2s ease;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
        gap: 0;
        overflow: hidden; /* Ensures inner elements don't break the pill curve */
        min-height: 44px;
        `;

            // Hover effect for the pill container
            buttonContainer.addEventListener('mouseenter', () => {
                buttonContainer.style.border = '1px solid rgba(60, 84, 114, 0.3)';
                buttonContainer.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
            });
            buttonContainer.addEventListener('mouseleave', () => {
                buttonContainer.style.border = '1px solid rgba(0, 0, 0, 0.08)';
                buttonContainer.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.02)';
            });

            // Create input field with plain text only
            const inputField = document.createElement("div");
            inputField.contentEditable = "plaintext-only"; // Force plain text only
            inputField.placeholder = "Message...";
            inputField.style.cssText = `
        flex: 1;
        padding: 12px 12px 12px 16px; /* Put padding on the input instead */
        border: none;
        outline: none;
        background-color: transparent;
        color: #222;
        font-family: 'Poppins', sans-serif;
        font-size: 14px;
        line-height: 1.5;
        font-weight: 400;
        min-height: 45px; /* Minimum height for 1 line */
        max-height: 66px; /* Max height for exactly 2 lines (14px font * 1.5 line height * 2 + 24px padding = 66px) */
        overflow-y: auto;
        overflow-x: hidden;
        white-space: pre-wrap;
        word-wrap: break-word; /* Ensure text breaks into new lines */
        -webkit-user-modify: read-write-plaintext-only;
        display: block; /* Removed flex to allow proper text wrapping */
        `;

            // Simple paste event to ensure consistency (optional fallback)
            inputField.addEventListener('paste', async function(e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                try {
                    let clipText = '';
                    
                    // First try native clipboard (prioritize external app copies)
                    try {
                        clipText = await navigator.clipboard.readText();
                        console.log('[ChatBot Paste] Using native clipboard, length:', clipText.length);
                    } catch (err) {
                        console.log('[ChatBot Paste] Native clipboard read failed:', err.message);
                    }
                    
                    // If empty, fall back to neoExamShieldClipboard
                    const customClip = window.neoExamShieldClipboard || window.neoPassClipboard;
                    if (!clipText && customClip) {
                        clipText = customClip;
                        console.log('[ChatBot Paste] Using neoExamShieldClipboard, length:', clipText.length);
                    }
                    
                    // Also try clipboardData from the paste event
                    if (!clipText && e.clipboardData) {
                        clipText = e.clipboardData.getData('text/plain');
                        console.log('[ChatBot Paste] Using event clipboardData, length:', clipText.length);
                    }
                    
                    if (clipText) {
                        console.log('[ChatBot Paste] Attempting to insert text...');
                        let inserted = false;
                        
                        // Try method 1: Use selection API
                        try {
                            const selection = window.getSelection();
                            if (selection && selection.rangeCount > 0) {
                                const range = selection.getRangeAt(0);
                                
                                // Ensure the range is within our input field
                                if (this.contains(range.commonAncestorContainer)) {
                                    range.deleteContents();
                                    const textNode = document.createTextNode(clipText);
                                    range.insertNode(textNode);
                                    range.setStartAfter(textNode);
                                    range.setEndAfter(textNode);
                                    selection.removeAllRanges();
                                    selection.addRange(range);
                                    inserted = true;
                                    console.log('[ChatBot Paste] Inserted using selection API');
                                }
                            }
                        } catch (selErr) {
                            console.log('[ChatBot Paste] Selection API failed:', selErr.message);
                        }
                        
                        // Fallback method 2: Direct textContent manipulation
                        if (!inserted) {
                            console.log('[ChatBot Paste] Using fallback: direct insertion');
                            const currentText = this.textContent || '';
                            this.textContent = currentText + clipText;
                            
                            // Move cursor to end
                            const range = document.createRange();
                            const selection = window.getSelection();
                            range.selectNodeContents(this);
                            range.collapse(false);
                            selection.removeAllRanges();
                            selection.addRange(range);
                            inserted = true;
                        }
                        
                        if (inserted) {
                            // Dispatch input event to trigger any listeners
                            this.dispatchEvent(new InputEvent('input', { 
                                bubbles: true, 
                                cancelable: true,
                                inputType: 'insertText',
                                data: clipText
                            }));
                            console.log('[ChatBot Paste] Paste successful');
                        }
                    }
                    
                    // Clean any potential HTML that might slip through
                    setTimeout(() => {
                        if (this.children.length > 0) {
                            const text = this.textContent || this.innerText;
                            this.textContent = text;
                        }
                    }, 10);
                } catch (err) {
                    console.error('[ChatBot Paste] Error:', err);
                    // Fallback: let browser handle it
                    setTimeout(() => {
                        if (this.children.length > 0) {
                            const text = this.textContent || this.innerText;
                            this.textContent = text;
                        }
                    }, 10);
                }
            }, true); // Use capture phase to intercept before document-level handlers
            
            // Add Ctrl+V / Cmd+V handler for paste
            inputField.addEventListener('keydown', async function(e) {
                const ctrlKey = e.ctrlKey || e.metaKey; // Support both Ctrl (Windows/Linux) and Cmd (macOS)
                
                // Handle Enter key for sending messages
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendButton.click();
                    return;
                }
                
                // Handle Ctrl+V / Cmd+V for paste
                if (ctrlKey && (e.key === 'V' || e.key === 'v')) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    
                    try {
                        let clipText = '';
                        
                        // First try native clipboard (prioritize external app copies)
                        try {
                            clipText = await navigator.clipboard.readText();
                            console.log('[ChatBot Ctrl+V] Using native clipboard, length:', clipText.length);
                        } catch (err) {
                            console.log('[ChatBot Ctrl+V] Native clipboard read failed:', err.message);
                        }
                        
                        // If empty, fall back to neoExamShieldClipboard
                        const customClip = window.neoExamShieldClipboard || window.neoPassClipboard;
                        if (!clipText && customClip) {
                            clipText = customClip;
                            console.log('[ChatBot Ctrl+V] Using neoExamShieldClipboard, length:', clipText.length);
                        }
                        
                        if (clipText) {
                            console.log('[ChatBot Ctrl+V] Attempting to insert text...');
                            let inserted = false;
                            
                            // Try method 1: Use selection API
                            try {
                                const selection = window.getSelection();
                                if (selection && selection.rangeCount > 0) {
                                    const range = selection.getRangeAt(0);
                                    
                                    // Ensure the range is within our input field
                                    if (this.contains(range.commonAncestorContainer)) {
                                        range.deleteContents();
                                        const textNode = document.createTextNode(clipText);
                                        range.insertNode(textNode);
                                        range.setStartAfter(textNode);
                                        range.setEndAfter(textNode);
                                        selection.removeAllRanges();
                                        selection.addRange(range);
                                        inserted = true;
                                        console.log('[ChatBot Ctrl+V] Inserted using selection API');
                                    }
                                }
                            } catch (selErr) {
                                console.log('[ChatBot Ctrl+V] Selection API failed:', selErr.message);
                            }
                            
                            // Fallback method 2: Direct textContent manipulation
                            if (!inserted) {
                                console.log('[ChatBot Ctrl+V] Using fallback: direct insertion');
                                const currentText = this.textContent || '';
                                this.textContent = currentText + clipText;
                                
                                // Move cursor to end
                                const range = document.createRange();
                                const selection = window.getSelection();
                                range.selectNodeContents(this);
                                range.collapse(false);
                                selection.removeAllRanges();
                                selection.addRange(range);
                                inserted = true;
                            }
                            
                            if (inserted) {
                                // Dispatch input event to trigger any listeners
                                this.dispatchEvent(new InputEvent('input', { 
                                    bubbles: true, 
                                    cancelable: true,
                                    inputType: 'insertText',
                                    data: clipText
                                }));
                                console.log('[ChatBot Ctrl+V] Paste successful');
                            }
                        } else {
                            console.log('[ChatBot Ctrl+V] No clipboard content available');
                        }
                    } catch (err) {
                        console.error('[ChatBot Ctrl+V] Error:', err);
                    }
                }
            }, true); // Use capture phase to intercept before document-level handlers

            // Create checkbox container for "Chat about question"
            const checkboxContainer = document.createElement("div");
            checkboxContainer.style.cssText = `
        display: none;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
        `;

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.id = "chat-about-question-checkbox";
            checkbox.style.cssText = `
        width: 16px;
        height: 16px;
        cursor: pointer;
        accent-color: rgb(60, 84, 114);
        `;

            const checkboxLabel = document.createElement("label");
            checkboxLabel.htmlFor = "chat-about-question-checkbox";
            checkboxLabel.style.cssText = `
        font-family: 'Poppins', sans-serif;
        font-size: 13px;
        color: #666;
        cursor: pointer;
        user-select: none;
        display: flex;
        align-items: center;
        gap: 6px;
        `;

            const questionIcon = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        `;

            checkboxLabel.innerHTML = questionIcon + '<span>Chat about question</span>';

            checkboxContainer.appendChild(checkbox);
            checkboxContainer.appendChild(checkboxLabel);

            // Store last question hash to detect question changes
            let lastQuestionHash = null;

            // Function to generate a simple hash from question data
            function getQuestionHash(questionData) {
                if (!questionData) return null;
                
                // Create a unique string from the question data
                let hashString = '';
                if (questionData.type) hashString += questionData.type;
                if (questionData.question) hashString += questionData.question;
                if (questionData.title) hashString += questionData.title;
                if (questionData.instruction) hashString += questionData.instruction;
                if (questionData.options) hashString += questionData.options;
                if (questionData.code) hashString += questionData.code;
                
                // Simple hash function
                let hash = 0;
                for (let i = 0; i < hashString.length; i++) {
                    const char = hashString.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash; // Convert to 32-bit integer
                }
                return hash;
            }

            // Function to check and update checkbox visibility based on platform detection
            function updateCheckboxVisibility() {
                const platform = detectPlatform();
                if (platform) {
                    // Valid platform detected, show the checkbox
                    checkboxContainer.style.display = 'flex';
                    
                    // If checkbox is enabled, check if question has changed
                    if (chatAboutQuestionEnabled && checkbox.checked) {
                        const currentQuestionData = extractCurrentQuestion();
                        const currentQuestionHash = getQuestionHash(currentQuestionData);
                        
                        // If question hash changed, re-extract the question
                        if (currentQuestionHash !== lastQuestionHash && lastQuestionHash !== null) {
                            if (currentQuestionData) {
                                extractedQuestion = formatQuestionForChat(currentQuestionData);
                                lastQuestionHash = currentQuestionHash;
                                console.log('Question changed and re-extracted for chat');
                                
                                // Clear chat history when question changes
                                clearChatHistoryAndUI('question-switch');
                                
                                // Show notification that question was updated and chat cleared
                                addNotificationMessage('Question updated - Chat cleared');
                            } else {
                                // Question no longer available
                                checkbox.checked = false;
                                chatAboutQuestionEnabled = false;
                                extractedQuestion = null;
                                lastQuestionHash = null;
                                checkboxLabel.style.color = '#666';
                                checkboxLabel.style.fontWeight = '400';
                                addNotificationMessage('Question no longer detected');
                            }
                        }
                    }
                } else {
                    // No valid platform, hide the checkbox and reset state
                    checkboxContainer.style.display = 'none';
                    checkbox.checked = false;
                    chatAboutQuestionEnabled = false;
                    extractedQuestion = null;
                    lastQuestionHash = null;
                    checkboxLabel.style.color = '#666';
                    checkboxLabel.style.fontWeight = '400';
                }
            }

            // Initial check when overlay is created
            updateCheckboxVisibility();

            // Re-check periodically in case user navigates to a different page
            setInterval(updateCheckboxVisibility, 2000);

            // Handle checkbox change
            checkbox.addEventListener('change', function() {
                chatAboutQuestionEnabled = this.checked;
                
                if (chatAboutQuestionEnabled) {
                    // Extract question when enabled
                    const questionData = extractCurrentQuestion();
                    if (questionData) {
                        extractedQuestion = formatQuestionForChat(questionData);
                        lastQuestionHash = getQuestionHash(questionData);
                        console.log('Question extracted for chat:', extractedQuestion);
                        
                        // Update label to show question is attached
                        checkboxLabel.style.color = 'rgb(60, 84, 114)';
                        checkboxLabel.style.fontWeight = '500';
                    } else {
                        // No question found, disable checkbox
                        this.checked = false;
                        chatAboutQuestionEnabled = false;
                        extractedQuestion = null;
                        lastQuestionHash = null;
                        
                        // Show notification
                        addNotificationMessage('No question detected on this page');
                    }
                } else {
                    // Reset styles when disabled
                    checkboxLabel.style.color = '#666';
                    checkboxLabel.style.fontWeight = '400';
                    extractedQuestion = null;
                    lastQuestionHash = null;
                }
            });

            // Create send button
            const sendButton = document.createElement("button");
            sendButton.innerHTML = "Send";
            sendButton.style.cssText = `
        padding: 0 20px 0 16px; /* Wider padding for text */
        margin: 0;
        background-color: rgb(60, 84, 114);
        color: #fff;
        border: none;
        border-radius: 0; /* Let the container's overflow:hidden handle the curve */
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Poppins', sans-serif;
        font-weight: 500;
        font-size: 14px;
        letter-spacing: 0.3px;
        transition: all 0.2s ease;
        flex-shrink: 0;
        height: auto; /* Stretch to fill parent height */
        box-shadow: -1px 0 3px rgba(0, 0, 0, 0.05); /* Very subtle separation */
        `;

            // Create resize handle
            const resizeHandle = document.createElement("div");
            resizeHandle.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 12px;
        height: 12px;
        background-color: rgb(60, 84, 114);
        cursor: nw-resize;
        border-radius: 12px 0 12px 0;
        opacity: 0.8;
        `;

            // Add custom scrollbar styles and Prism theme overrides
            const scrollbarStyles = document.createElement("style");
            scrollbarStyles.innerHTML = `
        ${window._chatSyntaxHighlightCSS || ''}
        
        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }

        #chat-overlay ::-webkit-scrollbar-thumb {
            background-color: rgba(0, 0, 0, 0.2);
            border-radius: 3px;
            transition: background-color 0.2s ease;
        }

        #chat-overlay ::-webkit-scrollbar-thumb:hover {
            background-color: rgba(0, 0, 0, 0.3);
        }

        #chat-overlay ::-webkit-scrollbar-track {
            background-color: transparent;
        }

        #chat-overlay [contenteditable]:empty:before {
            content: attr(placeholder);
            color: rgba(0, 0, 0, 0.4);
            font-weight: 300;
        }

        /* Prism theme customizations for chat overlay */
        #chat-overlay pre[class*="language-"] {
            background: #f8f9fa !important;
            border: 1px solid #e1e4e8 !important;
            border-radius: 6px !important;
            margin: 15px 0 !important;
            padding: 12px !important;
            overflow-x: auto !important;
        }

        #chat-overlay code[class*="language-"] {
            background: transparent !important;
            font-family: 'SFMono-Regular', 'Consolas', 'Liberation Mono', Menlo, monospace !important;
            font-size: 13px !important;
            line-height: 1.4 !important;
            color: #24292e !important;
        }

        /* Token colors for better readability */
        #chat-overlay .token.comment,
        #chat-overlay .token.prolog,
        #chat-overlay .token.doctype,
        #chat-overlay .token.cdata {
            color: #6a737d !important;
        }

        #chat-overlay .token.punctuation {
            color: #24292e !important;
        }

        #chat-overlay .token.property,
        #chat-overlay .token.tag,
        #chat-overlay .token.boolean,
        #chat-overlay .token.number,
        #chat-overlay .token.constant,
        #chat-overlay .token.symbol,
        #chat-overlay .token.deleted {
            color: #005cc5 !important;
        }

        #chat-overlay .token.selector,
        #chat-overlay .token.attr-name,
        #chat-overlay .token.string,
        #chat-overlay .token.char,
        #chat-overlay .token.builtin,
        #chat-overlay .token.inserted {
            color: #032f62 !important;
        }

        #chat-overlay .token.operator,
        #chat-overlay .token.entity,
        #chat-overlay .token.url,
        #chat-overlay .language-css .token.string,
        #chat-overlay .style .token.string {
            color: #e36209 !important;
        }

        #chat-overlay .token.atrule,
        #chat-overlay .token.attr-value,
        #chat-overlay .token.keyword {
            color: #d73a49 !important;
        }

        #chat-overlay .token.function,
        #chat-overlay .token.class-name {
            color: #6f42c1 !important;
        }

        #chat-overlay .token.regex,
        #chat-overlay .token.important,
        #chat-overlay .token.variable {
            color: #e36209 !important;
        }

        /* Remove any pseudo-elements that might cause overlay effects */
        #chat-overlay pre[class*="language-"]:before,
        #chat-overlay pre[class*="language-"]:after,
        #chat-overlay code[class*="language-"]:before,
        #chat-overlay code[class*="language-"]:after {
            display: none !important;
        }

        /* Ensure no box-shadow or other effects */
        #chat-overlay pre[class*="language-"] {
            box-shadow: none !important;
            text-shadow: none !important;
        }

        #chat-overlay code[class*="language-"] {
            box-shadow: none !important;
            text-shadow: none !important;
        }
        `;

            // Assemble the components
            buttonContainer.appendChild(inputField);
            buttonContainer.appendChild(sendButton);
            inputArea.appendChild(checkboxContainer);
            inputArea.appendChild(buttonContainer);
            // Create comprehensive CSS reset and styles for shadow DOM
            const shadowStyles = document.createElement('style');
            shadowStyles.textContent = `
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap');
                
                /* CSS Reset for Shadow DOM */
                * {
                    box-sizing: border-box;
                }
                
                #opacity-slider {
                    -webkit-appearance: none;
                    width: 100%;
                    height: 2px;
                    background: transparent;
                    outline: none;
                    margin: 0;
                    padding: 0;
                }
                
                #opacity-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 16px;
                    height: 8px;
                    border-radius: 4px;
                    background: rgb(60, 84, 114);
                    cursor: pointer;
                    transition: transform 0.2s, background 0.2s;
                }
                
                #opacity-slider::-webkit-slider-thumb:hover {
                    transform: scale(1.2);
                    background: rgb(80, 104, 134);
                }
                
                #opacity-slider::-moz-range-thumb {
                    width: 16px;
                    height: 8px;
                    border-radius: 4px;
                    background: rgb(60, 84, 114);
                    cursor: pointer;
                    border: none;
                    transition: transform 0.2s, background 0.2s;
                }
                
                #opacity-slider::-moz-range-thumb:hover {
                    transform: scale(1.2);
                    background: rgb(80, 104, 134);
                }
                
                /* Re-apply base styles needed */
                div, span, p {
                    display: block;
                    margin: 0;
                    padding: 0;
                }
                
                button {
                    cursor: pointer;
                    border: none;
                    background: none;
                    color: inherit;
                    font-family: 'Poppins', sans-serif;
                }
                
                input[type="checkbox"] {
                    cursor: pointer;
                    width: 16px;
                    height: 16px;
                }
                
                label {
                    cursor: pointer;
                    font-family: 'Poppins', sans-serif;
                }
                
                pre {
                    display: block;
                    margin: 0;
                    padding: 0;
                    font-family: monospace;
                    white-space: pre-wrap;
                }
                
                code {
                    font-family: monospace;
                }
                
                strong, b {
                    font-weight: bold;
                }
                
                em, i {
                    font-style: italic;
                }
                
                a {
                    color: #0066cc;
                    text-decoration: underline;
                    cursor: pointer;
                }
                
                ul, ol {
                    display: block;
                    margin: 10px 0;
                    padding-left: 20px;
                }
                
                li {
                    display: list-item;
                    margin: 5px 0;
                }
                
                p {
                    margin: 10px 0;
                    line-height: 1.5;
                }
                
                h1, h2, h3, h4, h5, h6 {
                    font-weight: bold;
                    margin: 15px 0 10px 0;
                    line-height: 1.3;
                }
                
                h1 { font-size: 2em; }
                h2 { font-size: 1.5em; }
                h3 { font-size: 1.3em; }
                h4 { font-size: 1.1em; }
                h5 { font-size: 1em; }
                h6 { font-size: 0.9em; }
                
                ${scrollbarStyles.innerHTML}
            `;
            
            // Assemble the components in shadow DOM
            shadowRoot.appendChild(shadowStyles);
            overlay.appendChild(header);
            overlay.appendChild(sliderContainer);
            overlay.appendChild(messagesContainer);
            overlay.appendChild(inputArea);
            overlay.appendChild(resizeHandle);
            shadowRoot.appendChild(overlay);
            
            // Store shadow host and shadow root references (lazy attached on Alt+D)
            shadowHost._shadowRoot = shadowRoot;
            window._neoChatShadowHost = shadowHost;
            window._neoChatShadowRoot = shadowRoot;

            // Add placeholder behavior after element is in DOM
            inputField.addEventListener('focus', function() {
                if (this.textContent.trim() === '') {
                    this.setAttribute('data-placeholder', 'Type a message...');
                }
            });

            inputField.addEventListener('blur', function() {
                if (this.textContent.trim() === '') {
                    this.removeAttribute('data-placeholder');
                }
            });

            // Add hover effect to send button
            sendButton.addEventListener('mouseenter', () => {
                sendButton.style.transform = 'translateY(-1px)';
                sendButton.style.boxShadow = '0 4px 8px rgba(60, 84, 114, 0.3)';
            });

            sendButton.addEventListener('mouseleave', () => {
                sendButton.style.transform = 'translateY(0)';
                sendButton.style.boxShadow = '0 2px 4px rgba(60, 84, 114, 0.2)';
            });

            // Add event listeners for dragging
            header.addEventListener("mousedown", (e) => {
                isDragging = true;
                dragOffsetX = e.clientX - overlay.getBoundingClientRect().left;
                dragOffsetY = e.clientY - overlay.getBoundingClientRect().top;
            });

            // Wire up Ghost transparency button
            const ghostBtn = header.querySelector("#ghost-toggle");
            if (ghostBtn) {
                ghostBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    let cur = parseFloat(overlay.style.opacity) || 0.88;
                    let next;
                    if (cur > 0.65) {
                        next = 0.45;
                        ghostBtn.textContent = "Ghost 45%";
                    } else if (cur > 0.30) {
                        next = 0.20;
                        ghostBtn.textContent = "Ghost 20%";
                    } else {
                        next = 0.88;
                        ghostBtn.textContent = "Ghost";
                    }
                    overlay.style.opacity = next.toString();
                    const slider = shadowRoot.querySelector("#opacity-slider");
                    if (slider) slider.value = Math.round(next * 100);
                    chrome.storage.local.set({ 
                        stealthOpacity: Math.round(next * 100) 
                    });
                });
            }

            // Add event listeners for stealth-mode & transparency slider
            chrome.storage.local.get(['stealth', 'stealthOpacity'], function(result) {
                let stealthModeEnabled = result.stealth === true;
                let currentOpacity = result.stealthOpacity || (stealthModeEnabled ? 20 : 88);
                
                const slider = shadowRoot.querySelector("#opacity-slider");
                if (slider) {
                    slider.value = currentOpacity;
                    overlay.style.opacity = (currentOpacity / 100).toString();
                    if (ghostBtn) {
                        if (currentOpacity <= 25) ghostBtn.textContent = `Ghost ${currentOpacity}%`;
                        else if (currentOpacity <= 55) ghostBtn.textContent = `Ghost ${currentOpacity}%`;
                        else ghostBtn.textContent = "Ghost";
                    }
                    
                    slider.addEventListener("input", (e) => {
                        const val = parseInt(e.target.value);
                        overlay.style.opacity = (val / 100).toString();
                        if (ghostBtn) {
                            if (val <= 30) ghostBtn.textContent = `Ghost ${val}%`;
                            else if (val <= 65) ghostBtn.textContent = `Ghost ${val}%`;
                            else ghostBtn.textContent = "Ghost";
                        }
                    });
                    
                    slider.addEventListener("change", (e) => {
                        const val = parseInt(e.target.value);
                        const isStealth = val < 88;
                        chrome.storage.local.set({ 
                            stealth: isStealth,
                            stealthOpacity: val
                        });
                    });
                }
                
                // Listen for storage changes to update stealth mode state across all tabs
                chrome.storage.onChanged.addListener((changes, namespace) => {
                    if (namespace === 'local' && slider) {
                        if (changes.stealthOpacity) {
                            currentOpacity = changes.stealthOpacity.newValue;
                            slider.value = currentOpacity;
                            if (overlay) overlay.style.opacity = (currentOpacity / 100).toString();
                        }
                        
                        if (changes.stealth) {
                            const newStealthMode = changes.stealth.newValue === true;
                            stealthModeEnabled = newStealthMode;
                            
                            if (newStealthMode) {
                                slider.value = currentOpacity;
                                if (overlay) overlay.style.opacity = currentOpacity / 100;
                            } else {
                                slider.value = 100;
                                if (overlay) overlay.style.opacity = "1";
                            }
                            
                            // Update chat button visibility
                            const chatButton = getChatButton();
                            if (chatButton) {
                                chatButton.style.opacity = newStealthMode ? "0" : "1";
                                chatButton.style.pointerEvents = "auto";
                            }
                        }
                    }
                });
            });

            // Add event listeners for resizing
            // Add minimum size constants at the top with the other state variables
            const MIN_WIDTH = 250; // Minimum width in pixels
            const MIN_HEIGHT = 200; // Minimum height in pixels
            const MAX_WIDTH = window.innerWidth - 40; // Maximum width (leaving 20px padding on each side)
            const MAX_HEIGHT = window.innerHeight - 40; // Maximum height (leaving 20px padding on each side)

            // Replace the resize event listener section with this updated version
            resizeHandle.addEventListener("mousedown", (e) => {
                isResizing = true;
                resizeStartX = e.clientX;
                resizeStartY = e.clientY;
                initialWidth = overlay.offsetWidth;
                initialHeight = overlay.offsetHeight;
                e.stopPropagation(); // Prevent dragging when resizing
            });

            resizeHandle.addEventListener("mouseenter", () => {
                resizeHandle.style.opacity = "1";
            });

            resizeHandle.addEventListener("mouseleave", () => {
                resizeHandle.style.opacity = "0.8";
            });

            // Update the mousemove event listener to include size constraints
            // This should be outside the createChatOverlay function as it's document level

            // Add window resize handler to keep overlay within bounds
            window.addEventListener('resize', () => {
                const overlay = getShadowElement('chat-overlay');
                if (overlay) {
                    const rect = overlay.getBoundingClientRect();

                    // Update maximum constraints
                    const newMaxWidth = window.innerWidth - 40;
                    const newMaxHeight = window.innerHeight - 40;

                    // Adjust size if necessary
                    if (rect.width > newMaxWidth) {
                        overlay.style.width = newMaxWidth + 'px';
                    }
                    if (rect.height > newMaxHeight) {
                        overlay.style.height = newMaxHeight + 'px';
                    }

                    // Keep overlay within viewport
                    if (rect.right > window.innerWidth) {
                        overlay.style.left = (window.innerWidth - rect.width) + "px";
                    }
                    if (rect.bottom > window.innerHeight) {
                        overlay.style.top = (window.innerHeight - rect.height) + "px";
                    }
                }
            });

            // Add button event listeners
            const closeButton = header.querySelector("#close-chat");
            if (closeButton) {
                closeButton.addEventListener("click", () => {
                    toggleChatOverlay(false);
                });
            }

            const clearChatButton = header.querySelector("#clear-chat");
            if (clearChatButton) {
                clearChatButton.addEventListener("click", () => {
                    clearChatHistoryAndUI('manual');
                });
            }

            // Reusable function to send a message to the AI chatbot and display response
            async function sendChatMessageToAI(messageText) {
                const message = (messageText || "").trim();
                if (!message) return;

                // Ensure overlay is open and visible
                toggleChatOverlay(true);

                try {
                    // Clear any error state before sending new message
                    clearErrorState();
                    
                    // Prepare the final message to send
                    let finalMessage = message;
                    
                    // If "Chat about question" is enabled, prepend the question
                    if (chatAboutQuestionEnabled && extractedQuestion) {
                        finalMessage = `Context: Below is the question I'm working on:\n\n${extractedQuestion}\n\n---\n\nMy Question: ${message}`;
                    }
                    
                    chatHistory.push({
                        role: "user",
                        content: message
                    });

                    addMessageToChat(message, "user");

                    const currentInputField = getShadowRoot()?.querySelector('[contenteditable]');
                    if (currentInputField && currentInputField.innerText.trim() === message) {
                        currentInputField.innerText = "";
                    }

                    // Add enhanced loading indicator
                    const currentMessagesContainer = getShadowElement("chat-messages");
                    const loadingDiv = addLoadingIndicator();
                    if (currentMessagesContainer) {
                        currentMessagesContainer.appendChild(loadingDiv);
                        currentMessagesContainer.scrollTop = currentMessagesContainer.scrollHeight;
                    }

                    // Send message and wait for response with timeout
                    await new Promise((resolve, reject) => {
                        let timeoutId;
                        let resolved = false;
                        
                        // Set up timeout (30 seconds)
                        timeoutId = setTimeout(() => {
                            if (!resolved) {
                                resolved = true;
                                reject(new Error('Request timed out. Please try again.'));
                            }
                        }, 30000);
                        
                        // Listen for response
                        const messageListener = (msg) => {
                            if (msg.action === "updateChatHistory" && !resolved) {
                                resolved = true;
                                clearTimeout(timeoutId);
                                chrome.runtime.onMessage.removeListener(messageListener);
                                resolve(msg);
                            }
                        };
                        
                        chrome.runtime.onMessage.addListener(messageListener);
                        
                        // Send the message
                        const validContext = createValidContext(chatHistory);
                        chrome.runtime.sendMessage({
                            action: "processChatMessage",
                            message: finalMessage,
                            context: validContext
                        }).catch((error) => {
                            if (!resolved) {
                                resolved = true;
                                clearTimeout(timeoutId);
                                chrome.runtime.onMessage.removeListener(messageListener);
                                reject(error);
                            }
                        });
                    });
                    
                    // Remove loading indicator
                    const loadingMessage = getShadowElement("loading-message");
                    if (loadingMessage) {
                        loadingMessage.remove();
                    }
                }
                catch (error) {
                    console.error("Error sending message:", error);
                    
                    // Remove loading indicator if it exists
                    const loadingMessage = getShadowElement("loading-message");
                    if (loadingMessage) {
                        loadingMessage.remove();
                    }
                    
                    // Handle different types of errors with appropriate messages
                    let errorMessage = "I encountered an error processing your message. Please try again.";
                    let isRateLimitError = false;
                    
                    if (error.message) {
                        if (error.message.includes('timeout') || error.message.includes('timed out')) {
                            errorMessage = "The request timed out. The service might be experiencing high load. Please try again in a moment.";
                        } else if (error.message.includes('rate limit') || error.message.includes('Daily request limit')) {
                            errorMessage = "You've reached your daily chat limit. Please try again tomorrow.";
                            isRateLimitError = true;
                        } else if (error.message.includes('Network') || error.message.includes('connection')) {
                            errorMessage = "Unable to connect to the chat service. Please check your internet connection and try again.";
                        } else if (error.message.includes('login') || error.message.includes('authentication')) {
                            errorMessage = "Please log in to use the chat feature. Click the extension icon to log in.";
                        } else {
                            errorMessage = error.message;
                        }
                    }
                    
                    // Add error message to chat with special styling
                    addErrorMessageToChat(errorMessage, isRateLimitError);
                }
            }

            // Expose globally for content.js and other scripts to invoke
            window.neoAskChatbot = sendChatMessageToAI;

            // Handle message sending via send button
            sendButton.addEventListener("click", async () => {
                const message = inputField.innerText.trim();
                if (message) {
                    inputField.innerText = "";
                    await sendChatMessageToAI(message);
                }
            });
            
            return overlay;
        }

        // Add notification message function
        function addNotificationMessage(message) {
            const messagesContainer = getShadowElement("chat-messages");
            if (!messagesContainer) return;
            
            const messageDiv = document.createElement("div");
            messageDiv.textContent = message;
            messageDiv.style.cssText = `
                margin: 12px auto;
                padding: 6px 12px;
                background-color: rgba(60, 84, 114, 0.08);
                border-radius: 12px;
                color: rgb(60, 84, 114);
                font-size: 11px;
                text-align: center;
                font-family: 'Poppins', sans-serif;
                font-weight: 500;
                letter-spacing: 0.2px;
                width: fit-content;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
            `;
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // Chat button permanently eliminated - overlay opens strictly via Alt+D (Option+D on Mac)
        function createChatButton() {
            return null;
        }

        // Helper function to detect programming language from code content
        function detectLanguage(code) {
            const codeText = code.toLowerCase().trim();
            
            // TypeScript detection (check before JavaScript)
            if (codeText.includes('interface ') || codeText.includes('type ') || codeText.includes(': string') ||
                codeText.includes(': number') || codeText.includes(': boolean') || codeText.includes('export interface') ||
                codeText.includes('import type') || codeText.includes('as const') || codeText.includes('enum ')) {
                return 'typescript';
            }
            
            // JSX/TSX detection
            if (codeText.includes('<') && codeText.includes('>') && 
                (codeText.includes('return (') || codeText.includes('jsx') || codeText.includes('tsx') ||
                 codeText.includes('component') || codeText.includes('props'))) {
                return codeText.includes(': ') ? 'tsx' : 'jsx';
            }
            
            // JavaScript detection
            if (codeText.includes('function') || codeText.includes('const ') || codeText.includes('let ') ||
                codeText.includes('var ') || codeText.includes('=>') || codeText.includes('console.log') ||
                codeText.includes('document.') || codeText.includes('window.') || codeText.includes('require(') ||
                codeText.includes('import ') || codeText.includes('export ')) {
                return 'javascript';
            }
            
            // Python detection
            if (codeText.includes('def ') || codeText.includes('import ') || codeText.includes('from ') ||
                codeText.includes('print(') || codeText.includes('if __name__') || codeText.includes('self.') ||
                codeText.includes('class ') || codeText.includes('elif ') || codeText.includes('range(') ||
                codeText.includes('lambda ') || codeText.includes('yield ')) {
                return 'python';
            }
            
            // Java detection
            if (codeText.includes('public class') || codeText.includes('private ') || codeText.includes('public ') ||
                codeText.includes('import java') || codeText.includes('system.out.println') || codeText.includes('string ') ||
                codeText.includes('void main') || codeText.includes('extends ') || codeText.includes('implements ') ||
                codeText.includes('@override') || codeText.includes('new ')) {
                return 'java';
            }
            
            // C# detection
            if (codeText.includes('using system') || codeText.includes('namespace ') || codeText.includes('public static void main') ||
                codeText.includes('console.writeline') || codeText.includes('[attribute]') || codeText.includes('var ')) {
                return 'csharp';
            }
            
            // C++ detection (check before C)
            if (codeText.includes('std::') || codeText.includes('cout <<') || codeText.includes('cin >>') ||
                codeText.includes('#include <iostream>') || codeText.includes('using namespace std') ||
                codeText.includes('class ') || codeText.includes('template<')) {
                return 'cpp';
            }
            
            // C detection
            if (codeText.includes('#include') || codeText.includes('printf(') || codeText.includes('scanf(') ||
                codeText.includes('int main') || codeText.includes('malloc(') || codeText.includes('free(') ||
                codeText.includes('sizeof(')) {
                return 'c';
            }
            
            // PHP detection
            if (codeText.includes('<?php') || codeText.includes('echo ') || codeText.includes('$') ||
                codeText.includes('function ') || codeText.includes('class ') || codeText.includes('->')) {
                return 'php';
            }
            
            // Ruby detection
            if (codeText.includes('def ') || codeText.includes('end') || codeText.includes('puts ') ||
                codeText.includes('require ') || codeText.includes('class ') || codeText.includes('@')) {
                return 'ruby';
            }
            
            // Go detection
            if (codeText.includes('package ') || codeText.includes('func ') || codeText.includes('import (') ||
                codeText.includes('fmt.println') || codeText.includes('go ') || codeText.includes('defer ')) {
                return 'go';
            }
            
            // Rust detection
            if (codeText.includes('fn ') || codeText.includes('let mut') || codeText.includes('println!') ||
                codeText.includes('use ') || codeText.includes('struct ') || codeText.includes('impl ')) {
                return 'rust';
            }
            
            // Swift detection
            if (codeText.includes('import swift') || codeText.includes('var ') || codeText.includes('let ') ||
                codeText.includes('func ') || codeText.includes('class ') || codeText.includes('print(')) {
                return 'swift';
            }
            
            // Kotlin detection
            if (codeText.includes('fun ') || codeText.includes('val ') || codeText.includes('var ') ||
                codeText.includes('class ') || codeText.includes('println(') || codeText.includes('import kotlin')) {
                return 'kotlin';
            }
            
            // HTML detection
            if (codeText.includes('<!doctype') || codeText.includes('<html') || codeText.includes('<head') ||
                codeText.includes('<body') || codeText.includes('<div') || codeText.includes('<span') ||
                codeText.includes('<script') || codeText.includes('<style')) {
                return 'html';
            }
            
            // CSS/SCSS detection
            if (codeText.includes('{') && codeText.includes('}') && (codeText.includes(':') && codeText.includes(';'))) {
                if (codeText.includes('$') || codeText.includes('@mixin') || codeText.includes('@include')) {
                    return 'scss';
                }
                return 'css';
            }
            
            // SQL detection
            if (codeText.includes('select ') || codeText.includes('from ') || codeText.includes('where ') ||
                codeText.includes('insert ') || codeText.includes('update ') || codeText.includes('delete ') ||
                codeText.includes('create table') || codeText.includes('alter table') || codeText.includes('drop table')) {
                return 'sql';
            }
            
            // JSON detection
            if ((codeText.trim().startsWith('{') && codeText.trim().endsWith('}')) ||
                (codeText.trim().startsWith('[') && codeText.trim().endsWith(']'))) {
                try {
                    JSON.parse(code);
                    return 'json';
                } catch (e) {
                    // Not valid JSON, continue with other detections
                }
            }
            
            // YAML detection
            if (codeText.includes('---') || (codeText.includes(':') && !codeText.includes(';') && !codeText.includes('{')) ||
                codeText.includes('- ') || codeText.includes('version:') || codeText.includes('name:')) {
                return 'yaml';
            }
            
            // XML detection
            if (codeText.includes('<?xml') || codeText.includes('<') && codeText.includes('/>') ||
                (codeText.includes('<') && codeText.includes('>') && !codeText.includes('function'))) {
                return 'xml';
            }
            
            // Bash/Shell detection
            if (codeText.includes('#!/bin/bash') || codeText.includes('#!/bin/sh') || 
                codeText.includes('echo ') || codeText.includes('grep ') || codeText.includes('awk ') ||
                codeText.includes('sed ') || codeText.includes('chmod ') || codeText.includes('sudo ') ||
                codeText.includes('ls ') || codeText.includes('cd ') || codeText.includes('mkdir ')) {
                return 'bash';
            }
            
            // Default fallback
            return 'javascript';
        }

        // Render content (for initial or streaming updates)
        function renderChatContent(messageContainer, content) {
            try {
                // Convert markdown to HTML using showdown library
                if (typeof showdown !== 'undefined') {
                    // Initialize markdown converter if not already done
                    if (!markdownConverter) {
                        markdownConverter = new showdown.Converter();
                    }
                    const htmlContent = markdownConverter.makeHtml(content);
                    
                    // Clear and set new content
                    messageContainer.innerHTML = "";
                    const contentContainer = document.createElement("div");
                    contentContainer.innerHTML = htmlContent;
                    
                    // Style code blocks and add copy functionality
                    contentContainer.querySelectorAll("pre code").forEach(codeBlock => {
                        // Detect language from class name first (from markdown ```language)
                        let language = '';
                        const classNames = codeBlock.className.split(' ');
                        for (const className of classNames) {
                            if (className.startsWith('language-')) {
                                language = className.replace('language-', '');
                                break;
                            }
                        }
                        
                        // If no language specified in markdown, use auto-detection
                        if (!language || language === '') {
                            language = detectLanguage(codeBlock.textContent);
                        }
                        
                        // Set the language class for Prism (ensure it's set even if detected)
                        codeBlock.className = `language-${language}`;
                        
                        // Apply SimplePrism highlighting if available
                        if (typeof SimplePrism !== 'undefined') {
                            try {
                                SimplePrism.highlightElement(codeBlock);
                            } catch (error) {
                                console.warn('Failed to highlight code block:', error);
                                // Continue without highlighting
                            }
                        }
                        
                        // Style the parent <pre> element to ensure clean translucent background
                        const preElement = codeBlock.parentNode;
                        if (preElement && preElement.tagName === 'PRE') {
                            preElement.style.cssText = `
                                background: rgba(244, 246, 250, 0.75) !important;
                                backdrop-filter: blur(8px) !important;
                                -webkit-backdrop-filter: blur(8px) !important;
                                border: 1px solid rgba(0, 0, 0, 0.08) !important;
                                border-radius: 8px !important;
                                margin: 12px 0 !important;
                                padding: 0 !important;
                                overflow: visible !important;
                                position: relative !important;
                            `;
                        }
                        
                        // Style the code block (let Prism handle syntax colors)
                        codeBlock.style.cssText = `
                            background: transparent !important;
                            border: none !important;
                            border-radius: 0 !important;
                            padding: 12px !important;
                            display: block !important;
                            margin: 0 !important;
                            overflow-x: auto !important;
                            white-space: pre !important;
                            font-family: 'SFMono-Regular', 'Consolas', 'Liberation Mono', Menlo, monospace !important;
                            font-size: 13px !important;
                            line-height: 1.4 !important;
                        `;
                
                        // Create a wrapper for the code block to handle hover events
                        const codeWrapper = document.createElement("div");
                        codeWrapper.style.cssText = `
                            position: relative;
                            background: transparent;
                            border: none;
                            margin: 0;
                            padding: 0;
                        `;
                        
                        // Move the code block into the wrapper
                        codeBlock.parentNode.insertBefore(codeWrapper, codeBlock);
                        codeWrapper.appendChild(codeBlock);
                
                        // Create copy button with new styling
                        const copyButton = document.createElement("button");
                        copyButton.innerText = "Copy";
                        copyButton.style.cssText = `
                            position: absolute;
                            right: 8px;
                            top: 8px;
                            background-color: rgb(60, 84, 114);
                            color: #fff;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            padding: 6px 12px;
                            font-size: 12px;
                            font-family: 'Poppins', sans-serif;
                            opacity: 0;
                            transition: opacity 0.2s ease;
                            z-index: 10;
                        `;
                
                        // Add hover effects
                        codeWrapper.addEventListener('mouseenter', () => {
                            copyButton.style.opacity = "1";
                        });
                
                        codeWrapper.addEventListener('mouseleave', () => {
                            copyButton.style.opacity = "0";
                        });
                
                        // Add copy functionality
                        copyButton.addEventListener("click", () => {
                            navigator.clipboard.writeText(codeBlock.innerText)
                                .then(() => {
                                    copyButton.innerText = "Copied";
                                    setTimeout(() => {
                                        copyButton.innerText = "Copy";
                                    }, 5000);
                                })
                                .catch(error => {
                                    console.error("Failed to copy: ", error);
                                });
                        });
                
                        // Add the copy button to the wrapper
                        codeWrapper.appendChild(copyButton);
                    });
                    
                    // Add the content to the message container
                    messageContainer.appendChild(contentContainer);
                } else {
                    // Fallback for when showdown is not available
                    messageContainer.textContent = content;
                }
            } catch (error) {
                console.error('Error rendering chat content:', error);
                // Fallback to plain text
                messageContainer.textContent = content;
            }
        }

        // Add message to chat
        function addMessageToChat(message, role) {
            // Get the chat messages container
            const chatMessagesContainer = getShadowElement("chat-messages");
            if (!chatMessagesContainer) return;
            
            // Create a new message container
            const messageContainer = document.createElement("div");
            messageContainer.style.cssText = `
                margin-bottom: 12px;
                padding: 12px 16px;
                border-radius: 16px;
                max-width: 85%;
                width: fit-content;
                word-wrap: break-word;
                font-size: 14px;
                line-height: 1.5;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
            `;
        
            // Style the message differently based on the role (user or assistant)
            if (role === "user") {
                messageContainer.style.backgroundColor = "rgba(60, 84, 114, 0.88)";  // User messages use translucent blue
                messageContainer.style.color = "#ffffff";
                messageContainer.style.alignSelf = "flex-end";
                messageContainer.style.borderBottomRightRadius = "4px";
                messageContainer.style.border = "1px solid rgba(255, 255, 255, 0.25)";
            } else {
                messageContainer.style.backgroundColor = "rgba(255, 255, 255, 0.80)";  // Assistant messages use translucent frosted white
                messageContainer.style.color = "#222222";
                messageContainer.style.alignSelf = "flex-start";
                messageContainer.style.border = "1px solid rgba(255, 255, 255, 0.6)";
                messageContainer.style.borderBottomLeftRadius = "4px";
            }
            
            // Add the message to the chat
            chatMessagesContainer.appendChild(messageContainer);
            
            // Render initial content
            renderChatContent(messageContainer, message);
            
            // Scroll to bottom
            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
            
            return messageContainer;
        }

        // Function to clear error state and remove error messages from chat history
        function clearErrorState() {
            // Remove error messages from chat history (in case any slipped through)
            chatHistory = chatHistory.filter(msg => msg.role !== "error");
            
            // Optionally clear error messages from UI after successful response
            // This helps provide a cleaner experience when the user resolves their issue
            // We keep them for now to maintain transparency, but you could uncomment below to remove them:
            /*
            const chatMessagesContainer = document.getElementById("chat-messages");
            if (chatMessagesContainer) {
                const errorMessages = chatMessagesContainer.querySelectorAll('[style*="f8d7da"], [style*="fff3cd"]');
                errorMessages.forEach(errorMsg => errorMsg.remove());
            }
            */
        }

        // Function to create valid conversation context for the API
        function createValidContext(chatHistory) {
            // First filter out error messages
            let filteredHistory = chatHistory.filter(msg => msg.role !== "error");
            
            // Ensure valid conversation flow (alternating user/assistant roles)
            let validContext = [];
            let lastRole = null;
            
            for (const message of filteredHistory) {
                // Skip consecutive messages with the same role (except the first)
                if (lastRole === message.role) {
                    // If we have consecutive user messages, skip the earlier one
                    // If we have consecutive assistant messages, skip the earlier one
                    if (validContext.length > 0) {
                        validContext.pop(); // Remove the previous message of the same role
                    }
                }
                
                validContext.push(message);
                lastRole = message.role;
            }
            
            // Ensure the conversation doesn't end with an assistant message if we're about to add a user message
            // The API expects user -> assistant -> user flow
            if (validContext.length > 0 && validContext[validContext.length - 1].role === "assistant") {
                // This is fine, we can add a user message next
            } else if (validContext.length > 0 && validContext[validContext.length - 1].role === "user") {
                // We have a trailing user message, which is fine since we're about to send another user message
                // But we should remove the trailing user message to avoid consecutive user messages
                validContext.pop();
            }
            
            return validContext;
        }

        // Add error message to chat with special styling
        function addErrorMessageToChat(errorMessage, isRateLimitError = false) {
            const chatMessagesContainer = getShadowElement("chat-messages");
            if (!chatMessagesContainer) return;
            
            // Create error message container
            const errorContainer = document.createElement("div");
            errorContainer.style.cssText = `
                margin-bottom: 12px;
                padding: 12px 16px;
                border-radius: 8px;
                max-width: 95%;
                word-wrap: break-word;
                background-color: ${isRateLimitError ? '#fff3cd' : '#f8d7da'};
                border: 1px solid ${isRateLimitError ? '#ffeaa7' : '#f5c6cb'};
                color: ${isRateLimitError ? '#856404' : '#721c24'};
                align-self: flex-start;
                font-family: 'Poppins', sans-serif;
                position: relative;
            `;
            
            // Add error icon and message
            const errorContent = document.createElement("div");
            errorContent.style.cssText = `
                display: flex;
                align-items: flex-start;
                gap: 10px;
            `;
            
            // Error icon
            const errorIcon = document.createElement("div");
            errorIcon.innerHTML = isRateLimitError ? 
                `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>` :
                `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
            errorIcon.style.cssText = `
                flex-shrink: 0;
                margin-top: 2px;
                opacity: 0.8;
            `;
            
            // Error text
            const errorText = document.createElement("div");
            errorText.style.cssText = `
                flex-grow: 1;
                font-size: 14px;
                line-height: 1.4;
            `;
            errorText.textContent = errorMessage;
            
            // Add retry suggestion for certain errors
            if (!isRateLimitError && !errorMessage.includes('log in')) {
                const retryText = document.createElement("div");
                retryText.style.cssText = `
                    margin-top: 8px;
                    font-size: 12px;
                    opacity: 0.8;
                    font-style: italic;
                `;
                retryText.textContent = "You can try sending your message again.";
                errorText.appendChild(retryText);
            }
            
            errorContent.appendChild(errorIcon);
            errorContent.appendChild(errorText);
            errorContainer.appendChild(errorContent);
            
            // Note: Don't add error messages to chatHistory to prevent them from being sent as context
            // This prevents error states from persisting across requests
            
            // Add to chat and scroll
            chatMessagesContainer.appendChild(errorContainer);
            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        }

        // Add this new loading indicator function
        function addLoadingIndicator() {
            const loadingDiv = document.createElement("div");
            loadingDiv.id = "loading-message";
            loadingDiv.style.cssText = `
        margin-bottom: 16px;
        padding: 14px 16px;
        border-radius: 14px;
        background-color: #fff;
        align-self: flex-start;
        border: 1px solid rgba(0, 0, 0, 0.08);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: 'Poppins', sans-serif;
        font-size: 14px;
        color: rgba(0, 0, 0, 0.6);
        `;

            // Add typing animation dots
            const dotsContainer = document.createElement("div");
            dotsContainer.style.cssText = `
        display: flex;
        gap: 4px;
        margin-left: 4px;
        `;

            for (let i = 0; i < 3; i++) {
                const dot = document.createElement("div");
                dot.style.cssText = `
            width: 6px;
            height: 6px;
            background-color: rgba(0, 0, 0, 0.4);
            border-radius: 50%;
            animation: typingAnimation 1.4s infinite;
            animation-delay: ${i * 0.2}s;
        `;
                dotsContainer.appendChild(dot);
            }

            loadingDiv.textContent = "Thinking";
            loadingDiv.appendChild(dotsContainer);

            // No need to add keyframes - they're already in shadow DOM styles

            return loadingDiv;
        }

        // Function to toggle chat overlay visibility
        function toggleChatOverlay(forceState) {
            if (typeof forceState === "boolean") {
                isOverlayVisible = forceState;
            } else {
                isOverlayVisible = !isOverlayVisible;
            }

            let shadowHost = window._neoChatShadowHost || document.getElementById("chat-overlay-shadow-host");
            let chatOverlay = shadowHost ? (shadowHost.shadowRoot?.querySelector("#chat-overlay")) : null;

            if (isOverlayVisible) {
                if (!chatOverlay) {
                    chatOverlay = createChatOverlay(); // Creates shadow host and returns overlay
                    shadowHost = window._neoChatShadowHost;
                }

                // Lazy attach to DOM only when visible
                if (shadowHost && !shadowHost.isConnected) {
                    (document.documentElement || document.body).appendChild(shadowHost);
                }

                if (chatOverlay) {
                    chatOverlay.style.display = "flex";
                    
                    // Focus on input field when showing overlay
                    setTimeout(() => {
                        const inputField = getShadowRoot()?.querySelector('[contenteditable]');
                        if (inputField) {
                            inputField.focus();
                            
                            // Place cursor at the end of existing text
                            const range = document.createRange();
                            const sel = window.getSelection();
                            
                            // If there's content, move cursor to the end
                            if (inputField.childNodes.length > 0) {
                                range.setStart(inputField.childNodes[inputField.childNodes.length - 1], 
                                    inputField.childNodes[inputField.childNodes.length - 1].length || 0);
                            } else {
                                range.setStart(inputField, 0);
                            }
                            
                            range.collapse(true);
                            sel.removeAllRanges();
                            sel.addRange(range);
                        }
                    }, 100);
                }
            } else {
                // When hiding, set display none and detach from DOM so portal can never detect it
                if (chatOverlay) {
                    chatOverlay.style.display = "none";
                }
                if (shadowHost && shadowHost.isConnected) {
                    shadowHost.remove();
                }
            }
        }

        // Function to clear chat history and UI (reusable)
        function clearChatHistoryAndUI(reason = 'manual') {
            try {
                const messagesContainer = getShadowElement("chat-messages");
                if (messagesContainer) {
                    // Clear the chat history array
                    chatHistory = [];
                    
                    // Clear the UI
                    messagesContainer.innerHTML = "";
                    
                    // Clear any error state
                    clearErrorState();
                    
                    // Send message to background script to reset context
                    chrome.runtime.sendMessage({
                        action: "resetContext"
                    });
                    
                    // Add a notification message based on the reason
                    let notificationMessage = "Chat history cleared.";
                    if (reason === 'providerChange') {
                        notificationMessage = "Chat history cleared - switched to new AI provider.";
                    }
                    
                    addNotificationMessage(notificationMessage);
                    console.log(`Chat history cleared (${reason})`);
                }
            } catch (error) {
                console.error('Error clearing chat history:', error);
            }
        }

        // Function to detect and block clashing chat elements
        function blockClashingChatElements() {
            // List of class patterns to block (updated class names)
            const blockedClassPatterns = [
                'cc-1m2mf',     // Old class
                'cc-1qbp0',     // New duplicate chatbot icon
                'cc-1o31k',     // New duplicate chatbot icon child
                'cc-otlyh',     // New duplicate chatbot icon child
                'cc-11f3x',     // New duplicate chatbot icon child
                'cc-1v4wj'      // New duplicate chatbot icon child
            ];
            
            // Function to hide elements matching any of the blocked patterns
            function hideBlockedElements() {
                blockedClassPatterns.forEach(className => {
                    // Match elements with the exact class or classes containing this pattern
                    const selector = `[class*="${className}"]`;
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(element => {
                        // Only hide if it's not part of our chat overlay
                        if (!element.closest('#chat-overlay')) {
                            element.style.display = 'none';
                        }
                    });
                });
            }
            
            // Add observer to continuously check for and block the element
            const observer = new MutationObserver((mutations) => {
                hideBlockedElements();
            });
            
            // Start observing document body for changes safely
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
            
            // Also try to block any existing elements immediately
            hideBlockedElements();
            
            // Add CSS to ensure elements with these classes are always hidden
            const styleElement = document.createElement('style');
            const cssRules = blockedClassPatterns.map(className => `
                [class*="${className}"]:not(#chat-overlay):not(#chat-overlay *) {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                }
            `).join('\n');
            
            styleElement.textContent = cssRules;
            (document.head || document.documentElement || document.body)?.appendChild(styleElement);
        }

        // Set up document-level event handlers
        document.addEventListener("mousemove", (e) => {
            const shadowHost = document.getElementById("chat-overlay-shadow-host");
            if (!shadowHost) return;
            const overlay = shadowHost.shadowRoot?.querySelector("#chat-overlay");
            if (!overlay) return;
            
            if (isDragging) {
                const newLeft = e.clientX - dragOffsetX;
                const newTop = e.clientY - dragOffsetY;

                // Prevent dragging outside viewport
                const maxX = window.innerWidth - overlay.offsetWidth;
                const maxY = window.innerHeight - overlay.offsetHeight;

                overlay.style.left = Math.min(Math.max(0, newLeft), maxX) + "px";
                overlay.style.top = Math.min(Math.max(0, newTop), maxY) + "px";
                overlay.style.bottom = "auto";
                overlay.style.right = "auto";
            }

            if (isResizing) {
                const resizeHandle = overlay.querySelector("div[style*='nw-resize']");
                if (!resizeHandle) return;
                
                const MIN_WIDTH = 250;
                const MIN_HEIGHT = 200;
                const MAX_WIDTH = window.innerWidth - 40;
                const MAX_HEIGHT = window.innerHeight - 40;
                
                const dx = resizeStartX - e.clientX;
                const dy = resizeStartY - e.clientY;

                const newWidth = Math.min(Math.max(MIN_WIDTH, initialWidth + dx), MAX_WIDTH);
                const newHeight = Math.min(Math.max(MIN_HEIGHT, initialHeight + dy), MAX_HEIGHT);

                const rect = overlay.getBoundingClientRect();
                const newLeft = rect.right - newWidth;
                const newTop = rect.bottom - newHeight;

                // Ensure the overlay stays within viewport bounds
                if (newLeft >= 0 && newTop >= 0) {
                    overlay.style.width = newWidth + "px";
                    overlay.style.height = newHeight + "px";
                    overlay.style.left = newLeft + "px";
                    overlay.style.top = newTop + "px";
                }
            }
        });

        // Handle mouse up for drag and resize
        document.addEventListener("mouseup", () => {
            isDragging = false;
            isResizing = false;
        });

        // Add global keyboard event listeners
        document.addEventListener("keydown", (e) => {
            const modifierKey = e.altKey;

            // Toggle chat with Alt+D (Option+D on macOS), also support Alt+C
            const isKeyD = e.code === "KeyD" || (e.key && e.key.toLowerCase() === "d") || e.keyCode === 68 || e.key === "∂";
            const isKeyC = e.code === "KeyC" || (e.key && e.key.toLowerCase() === "c") || e.keyCode === 67 || e.key === "ç" || e.key === "Ç";
            if (modifierKey && !e.ctrlKey && !e.shiftKey && !e.metaKey && (isKeyD || isKeyC)) {
                e.preventDefault(); // Prevent default browser behavior
                toggleChatOverlay();
            }

            // Alt+M (Option+M on macOS): If text is selected, show Quick Short Answer HUD
            const isKeyM = e.code === "KeyM" || (e.key && e.key.toLowerCase() === "m") || e.keyCode === 77 || e.key === "µ" || e.key === "Â";
            if (modifierKey && !e.ctrlKey && !e.shiftKey && !e.metaKey && isKeyM) {
                const selectedText = getPageSelectedText();
                if (selectedText && selectedText.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    showQuickAnswerHUD(selectedText);
                }
            }

            // Close quick HUD or chat with Escape
            if (e.key === "Escape") {
                hideQuickAnswerHUD();
                if (isOverlayVisible) {
                    toggleChatOverlay(false);
                }
            }
        });

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

        // ==========================================
        // QUICK SHORT ANSWER HUD (Alt + M)
        // ==========================================
        let quickHudHost = null;
        let quickHudRoot = null;
        let quickHudEl = null;
        let currentQuickText = "";
        let quickHudOpacityIndex = 0;
        const quickHudOpacities = [0.78, 0.40, 0.95];

        function createQuickAnswerHUD() {
            if (quickHudHost && quickHudRoot && quickHudEl) {
                return quickHudEl;
            }

            quickHudHost = document.getElementById("neo-quick-hud-host");
            if (!quickHudHost) {
                quickHudHost = document.createElement("div");
                quickHudHost.id = "neo-quick-hud-host";
                quickHudHost.setAttribute("data-neo-stealth", "true");
                quickHudHost.setAttribute("aria-hidden", "true");
                quickHudHost.style.cssText = `
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 0 !important;
                    height: 0 !important;
                    z-index: 2147483647 !important;
                    pointer-events: none !important;
                `;
                document.documentElement.appendChild(quickHudHost);
            }

            quickHudRoot = quickHudHost.shadowRoot || quickHudHost.attachShadow({ mode: "open" });

            quickHudEl = document.createElement("div");
            quickHudEl.id = "neo-quick-hud";
            quickHudEl.setAttribute("data-neo-stealth", "true");
            quickHudEl.style.cssText = `
                position: fixed !important;
                width: 320px !important;
                max-width: 90vw !important;
                max-height: 250px !important;
                background: rgba(15, 23, 42, 0.78) !important;
                backdrop-filter: blur(16px) saturate(180%) !important;
                -webkit-backdrop-filter: blur(16px) saturate(180%) !important;
                border: 1px solid rgba(255, 255, 255, 0.20) !important;
                border-radius: 12px !important;
                box-shadow: 0 12px 36px rgba(0, 0, 0, 0.38), inset 0 0 0 1px rgba(255, 255, 255, 0.1) !important;
                color: #f1f5f9 !important;
                font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                font-size: 12.5px !important;
                line-height: 1.5 !important;
                display: none !important;
                flex-direction: column !important;
                overflow: hidden !important;
                pointer-events: auto !important;
                user-select: text !important;
                box-sizing: border-box !important;
                z-index: 2147483647 !important;
                transition: opacity 0.2s ease !important;
            `;

            quickHudEl.innerHTML = `
                <div id="quick-hud-header" style="display: flex !important; align-items: center !important; justify-content: space-between !important; padding: 7px 10px !important; background: rgba(255, 255, 255, 0.08) !important; border-bottom: 1px solid rgba(255, 255, 255, 0.12) !important; cursor: move !important; user-select: none !important;">
                    <div style="display: flex !important; align-items: center !important; gap: 6px !important; font-weight: 700 !important; font-size: 11px !important; color: #38bdf8 !important; letter-spacing: 0.3px !important;">
                        <span>⚡</span>
                        <span>Quick Answer</span>
                    </div>
                    <div style="display: flex !important; align-items: center !important; gap: 6px !important;">
                        <button id="quick-hud-ghost" title="Toggle transparency" style="background: rgba(255, 255, 255, 0.12) !important; border: 1px solid rgba(255, 255, 255, 0.2) !important; border-radius: 4px !important; color: #94a3b8 !important; font-size: 10px !important; font-weight: 600 !important; padding: 2px 6px !important; cursor: pointer !important;">Ghost</button>
                        <button id="quick-hud-copy" title="Copy answer" style="background: transparent !important; border: none !important; color: #94a3b8 !important; font-size: 12px !important; cursor: pointer !important; padding: 0 3px !important;">📋</button>
                        <button id="quick-hud-chat" title="Open in full Chatbot" style="background: transparent !important; border: none !important; color: #38bdf8 !important; font-size: 12px !important; cursor: pointer !important; padding: 0 3px !important;">💬</button>
                        <button id="quick-hud-close" title="Close (Esc)" style="background: transparent !important; border: none !important; color: #94a3b8 !important; font-size: 15px !important; line-height: 1 !important; cursor: pointer !important; padding: 0 3px !important;">×</button>
                    </div>
                </div>
                <div id="quick-hud-body" style="padding: 10px 12px !important; overflow-y: auto !important; max-height: 195px !important; font-size: 12px !important; word-break: break-word !important; color: #e2e8f0 !important;">
                    <div id="quick-hud-loading" style="display: flex !important; align-items: center !important; gap: 8px !important; color: #94a3b8 !important;">
                        <span style="display: inline-block !important; animation: quickPulse 1.2s infinite ease-in-out !important; color: #38bdf8 !important;">●</span>
                        <span>Generating short answer...</span>
                    </div>
                    <div id="quick-hud-text" style="display: none !important;"></div>
                </div>
                <style>
                    @keyframes quickPulse {
                        0%, 100% { opacity: 0.3; transform: scale(0.8); }
                        50% { opacity: 1; transform: scale(1.2); }
                    }
                    #quick-hud-body::-webkit-scrollbar { width: 4px; }
                    #quick-hud-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
                </style>
            `;

            quickHudRoot.appendChild(quickHudEl);

            // Dragging handlers for Quick HUD
            const header = quickHudEl.querySelector("#quick-hud-header");
            let isDraggingHud = false;
            let hudStartX = 0, hudStartY = 0;
            let hudInitialLeft = 0, hudInitialTop = 0;

            header.addEventListener("mousedown", (e) => {
                if (e.target.tagName === 'BUTTON') return;
                isDraggingHud = true;
                hudStartX = e.clientX;
                hudStartY = e.clientY;
                const rect = quickHudEl.getBoundingClientRect();
                hudInitialLeft = rect.left;
                hudInitialTop = rect.top;
                e.preventDefault();
            });

            document.addEventListener("mousemove", (e) => {
                if (!isDraggingHud) return;
                const dx = e.clientX - hudStartX;
                const dy = e.clientY - hudStartY;
                let newLeft = hudInitialLeft + dx;
                let newTop = hudInitialTop + dy;
                newLeft = Math.max(10, Math.min(window.innerWidth - 330, newLeft));
                newTop = Math.max(10, Math.min(window.innerHeight - 100, newTop));
                quickHudEl.style.left = newLeft + "px";
                quickHudEl.style.top = newTop + "px";
                quickHudEl.style.right = "auto";
                quickHudEl.style.bottom = "auto";
            });

            document.addEventListener("mouseup", () => {
                isDraggingHud = false;
            });

            // Button handlers
            quickHudEl.querySelector("#quick-hud-close").addEventListener("click", () => {
                hideQuickAnswerHUD();
            });

            quickHudEl.querySelector("#quick-hud-ghost").addEventListener("click", () => {
                quickHudOpacityIndex = (quickHudOpacityIndex + 1) % quickHudOpacities.length;
                const op = quickHudOpacities[quickHudOpacityIndex];
                quickHudEl.style.background = `rgba(15, 23, 42, ${op})`;
            });

            quickHudEl.querySelector("#quick-hud-copy").addEventListener("click", () => {
                const textEl = quickHudEl.querySelector("#quick-hud-text");
                const text = textEl ? textEl.innerText : "";
                if (text) {
                    navigator.clipboard.writeText(text).catch(() => {});
                    const copyBtn = quickHudEl.querySelector("#quick-hud-copy");
                    copyBtn.textContent = "✓";
                    setTimeout(() => { copyBtn.textContent = "📋"; }, 1500);
                }
            });

            quickHudEl.querySelector("#quick-hud-chat").addEventListener("click", () => {
                hideQuickAnswerHUD();
                if (currentQuickText && typeof window.neoAskChatbot === "function") {
                    window.neoAskChatbot(currentQuickText);
                }
            });

            return quickHudEl;
        }

        function hideQuickAnswerHUD() {
            if (quickHudEl) {
                quickHudEl.style.display = "none";
            }
        }

        async function showQuickAnswerHUD(text) {
            if (!text || !text.trim()) return;
            currentQuickText = text.trim();

            const hud = createQuickAnswerHUD();

            // Calculate coordinates near selection or default to top-right
            let targetLeft = window.innerWidth - 340;
            let targetTop = 28;

            try {
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                    const range = sel.getRangeAt(0);
                    const rect = range.getBoundingClientRect();
                    if (rect && rect.width > 0 && rect.height > 0) {
                        targetLeft = rect.left;
                        targetTop = rect.bottom + 8;
                    }
                }
            } catch(e) {}

            // Viewport clamping
            if (targetLeft + 330 > window.innerWidth) {
                targetLeft = Math.max(16, window.innerWidth - 335);
            }
            if (targetLeft < 16) targetLeft = 16;
            if (targetTop + 240 > window.innerHeight) {
                targetTop = Math.max(16, window.innerHeight - 250);
            }

            hud.style.left = targetLeft + "px";
            hud.style.top = targetTop + "px";
            hud.style.right = "auto";
            hud.style.bottom = "auto";
            hud.style.display = "flex";

            const loadingEl = hud.querySelector("#quick-hud-loading");
            const textEl = hud.querySelector("#quick-hud-text");
            if (loadingEl) loadingEl.style.display = "flex";
            if (textEl) {
                textEl.style.display = "none";
                textEl.innerHTML = "";
            }

            try {
                chrome.runtime.sendMessage({
                    action: "getQuickAnswer",
                    text: currentQuickText
                }, (response) => {
                    if (loadingEl) loadingEl.style.display = "none";
                    if (!textEl) return;
                    textEl.style.display = "block";

                    if (response && response.success && response.answer) {
                        // Render clean answer
                        let formatted = response.answer
                            .replace(/</g, "&lt;").replace(/>/g, "&gt;")
                            .replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.15); padding: 1px 4px; border-radius: 3px; font-family: monospace; color: #38bdf8;">$1</code>');
                        textEl.innerHTML = `<div style="line-height: 1.45; font-size: 12px; color: #f8fafc; font-weight: 500;">${formatted}</div>`;
                    } else {
                        const err = (response && response.error) ? response.error : "Could not generate answer. Check API keys.";
                        textEl.innerHTML = `<span style="color: #f87171; font-size: 11.5px;">${err}</span>`;
                    }
                });
            } catch(err) {
                if (loadingEl) loadingEl.style.display = "none";
                if (textEl) {
                    textEl.style.display = "block";
                    textEl.innerHTML = `<span style="color: #f87171; font-size: 11.5px;">Connection error: ${err.message}</span>`;
                }
            }
        }

        window.neoQuickAnswer = showQuickAnswerHUD;
        window.addEventListener("neoQuickAnswer", (e) => {
            if (e.detail && e.detail.text) {
                showQuickAnswerHUD(e.detail.text);
            }
        });

        // Listen for internal toggle event
        window.addEventListener("neoToggleChat", () => {
            toggleChatOverlay();
        });

        // Listen for external selected text answer requests
        window.addEventListener("neoAskChatbot", (e) => {
            if (e.detail && e.detail.text && typeof window.neoAskChatbot === "function") {
                window.neoAskChatbot(e.detail.text);
            }
        });

        // Initialize everything
        async function init() {
            try {
                // Try to load showdown and our inline prism highlighter
                await Promise.all([loadShowdown(), loadPrism()]);
            } catch (error) {
                // Continue even if libraries fail to load
            }
            
            // Block clashing chat elements
            blockClashingChatElements();

            // Note: Neither button nor overlay are created or attached on page load.
            // Everything is lazy created and attached strictly when the user presses Alt+D (Option+D on Mac).
        }
        
        // Start the initialization safely
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init, { once: true });
        } else {
            init();
        }

        // Add global storage change listener for stealth mode updates across tabs
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local') {
                // Clear error state when database or authentication changes occur
                if (changes.accessToken || changes.refreshToken) {
                    clearErrorState();
                }
                
                if (changes.stealth) {
                    const newStealthMode = changes.stealth.newValue === true;
                    // Update overlay opacity if it exists
                    const overlay = getShadowElement("chat-overlay");
                    if (overlay) {
                        overlay.style.opacity = newStealthMode ? "0.20" : "0.88";
                    }
                }
            }
        });

        // Listen for messages from Chrome runtime
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === "updateChatHistory") {
                const {
                    role,
                    content,
                    isStreaming
                } = message;
                
                // First remove loading indicator if it exists
                const loadingMessage = getShadowElement("loading-message");
                if (loadingMessage) {
                    loadingMessage.remove();
                }
                
                // Handle error responses from the background script
                if (role === "error" || content.includes("error") || content.includes("failed")) {
                    // Determine if this is a rate limit error
                    const isRateLimitError = content.includes("limit") || content.includes("exceeded") || content.includes("tomorrow");
                    addErrorMessageToChat(content, isRateLimitError);
                } else if (role === "assistant") {
                    // Clear any existing error state on successful response
                    clearErrorState();
                    
                    if (isStreaming) {
                        if (!currentStreamingDiv) {
                            // Create a new assistant message container for streaming
                            currentStreamingDiv = addMessageToChat("", "assistant");
                        }
                        // Update the content incrementally
                        renderChatContent(currentStreamingDiv, content);
                        
                        // Scroll to bottom during streaming
                        const chatMessagesContainer = getShadowElement("chat-messages");
                        if (chatMessagesContainer) {
                            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
                        }
                    } else {
                        // Stream finished or single response
                        if (currentStreamingDiv) {
                            // Final update for existing stream
                            renderChatContent(currentStreamingDiv, content);
                            currentStreamingDiv = null;
                        } else {
                            // Non-streaming assistant response
                            addMessageToChat(content, "assistant");
                        }
                        
                        // Add to local chat history for conversation context
                        chatHistory.push({
                            role: "assistant",
                            content: content
                        });
                    }
                } else {
                    // Handle other roles (like 'user' echo from server, though usually local)
                    addMessageToChat(content, role);
                }
            }
            
            // Handle clear chat history action
            if (message.action === "clearChatHistory") {
                const reason = message.reason || 'external';
                clearChatHistoryAndUI(reason);
                if (sendResponse) {
                    sendResponse({ success: true });
                }
            }
            
            // Handle direct error messages from background script
            if (message.action === "chatError") {
                // Remove loading indicator if it exists
                const loadingMessage = getShadowElement("loading-message");
                if (loadingMessage) {
                    loadingMessage.remove();
                }
                
                const { error, errorType, detailedInfo } = message;
                let errorMessage = error || "An error occurred processing your message.";
                let isRateLimitError = false;
                
                // Enhance error message based on type
                if (errorType === 'rateLimit') {
                    isRateLimitError = true;
                    if (!errorMessage.includes("tomorrow") && !errorMessage.includes("wait")) {
                        errorMessage += " Please try again later.";
                    }
                } else if (errorType === 'auth') {
                    errorMessage = "Please log in to use the chat feature. Click the extension icon to log in.";
                } else if (errorType === 'network') {
                    errorMessage += " Please check your internet connection and try again.";
                } else if (errorType === 'server') {
                    errorMessage += " The service is temporarily unavailable.";
                }
                
                addErrorMessageToChat(errorMessage, isRateLimitError);
            }
        });
    });
})();
