// Use shared isMac variable if it exists, otherwise declare it
if (typeof window.isMac === 'undefined') {
    window.isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || 
                   navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
}

// Auto-answering and Random Key Press Typing mechanism
(function () {
  try {
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
  } catch (e) {}
  let editor;
  let currentCode = "";
  let charIndex = 0;
  let isRandomTypingActive = false;
  let lastQuestionIdentifier = null;

  // Helper to ensure an editor element is strictly the center answer editor and NEVER a header or footer snippet editor
  function isStrictAnswerEditor(el) {
    if (!el) return false;
    const id = (el.id || '').toLowerCase();
    if (id.includes('header') || id.includes('footer') || id.includes('correct') || id.endsWith('editor2')) return false;
    if (el.closest && (el.closest('[aria-labelledby="tt-header"]') || el.closest('[aria-labelledby="footer"]') || el.closest('[aria-labelledby="correct-answer-cont"]') || el.closest('[aria-labelledby="correct-answer-mark-cont"]') || el.closest('.header-content') || el.closest('.footer-content'))) {
      return false;
    }
    // CodeMirror 6 checks: exclude if inside a card labeled Header or Footer Snippet, or if readonly
    if (el.closest) {
      const card = el.closest('.rounded-xl, .rounded-lg, .border, .flex-col');
      if (card) {
        const txt = card.innerText || card.textContent || '';
        if (txt.includes('Header Snippet') || txt.includes('Footer Snippet')) return false;
      }
    }
    if (el.getAttribute && el.getAttribute('contenteditable') === 'false') return false;
    const content = el.querySelector?.('.cm-content');
    if (content && content.getAttribute('contenteditable') === 'false') return false;
    return true;
  }

  // Retrieve unvirtualized CodeMirror 6 EditorView instance directly or via React Fiber
  function getCodeMirror6View(el) {
    if (!el) return null;
    if (el.cmView && el.cmView.view) return el.cmView.view;
    if (el._view && typeof el._view.dispatch === 'function') return el._view;
    if (el.view && typeof el.view.dispatch === 'function') return el.view;

    const content = el.classList?.contains('cm-content') ? el : el.querySelector?.('.cm-content');
    if (content) {
      if (content.cmView && content.cmView.view) return content.cmView.view;
      if (content._view && typeof content._view.dispatch === 'function') return content._view;
    }

    const editor = el.classList?.contains('cm-editor') ? el : (el.closest?.('.cm-editor') || el.querySelector?.('.cm-editor'));
    if (editor) {
      if (editor.cmView && editor.cmView.view) return editor.cmView.view;
      if (editor._view && typeof editor._view.dispatch === 'function') return editor._view;
    }

    // Traverse React Fiber to locate CodeMirrorEditor state hooks
    const targets = [el, content, editor, el.parentElement, document.getElementById('programming-editor')].filter(Boolean);
    for (const target of targets) {
      try {
        const fiberKey = Object.keys(target).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
        if (!fiberKey) continue;
        let fiber = target[fiberKey];
        let depth = 0;
        while (fiber && depth < 12) {
          let hook = fiber.memoizedState;
          let hookDepth = 0;
          while (hook && hookDepth < 25) {
            if (hook.memoizedState && typeof hook.memoizedState === 'object') {
              const candidate = hook.memoizedState.current || hook.memoizedState;
              if (candidate && typeof candidate.dispatch === 'function' && candidate.state && candidate.state.doc) {
                return candidate;
              }
            }
            hook = hook.next;
            hookDepth++;
          }
          if (fiber.stateNode && typeof fiber.stateNode.dispatch === 'function' && fiber.stateNode.state?.doc) {
            return fiber.stateNode;
          }
          fiber = fiber.return;
          depth++;
        }
      } catch(e) {}
    }
    return null;
  }

  // Read clean code text from CodeMirror 6 editor without gutter line numbers or virtualization gaps
  function getCodeMirror6Text(el) {
    if (!el) return '';
    const view = getCodeMirror6View(el);
    if (view && view.state && view.state.doc) {
      try {
        const str = view.state.doc.toString();
        if (str && str.trim()) return str.trim();
      } catch(e) {}
    }
    const content = el.classList?.contains('cm-content') ? el : el.querySelector?.('.cm-content');
    const root = content || el;
    const lines = root.querySelectorAll?.('.cm-line');
    if (lines && lines.length > 0) {
      return Array.from(lines).map(l => l.textContent).join('\n').trim();
    }
    const clone = root.cloneNode ? root.cloneNode(true) : null;
    if (clone) {
      clone.querySelectorAll?.('.cm-gutters, .cm-gap, .cm-announced').forEach(g => g.remove());
      return (clone.innerText || clone.textContent || '').trim();
    }
    return (root.innerText || root.textContent || '').trim();
  }

  // Find the answer editor on the page (supports Ace, CodeMirror 6, Monaco, Textarea)
  function findAnswerEditor() {
    const aceObj = (typeof ace !== 'undefined') ? ace : (window.ace || document.defaultView?.ace);

    // Check 1: Explicit center answer editor container, ID, or aria label (PSG PAT / Examly / Iamneo)
    const answerElCandidates = [
      document.querySelector('div[aria-labelledby="answer"] .ace_editor'),
      document.querySelector('div[aria-labelledby="answer"] [id*="ttAnswerEditor"]'),
      document.querySelector('[id*="ttAnswerEditor"]:not([id*="Editor2"])'),
      document.querySelector('[aria-labelledby="editor-answer"]:not([id*="Editor2"])'),
      document.querySelector('.answer-content .ace_editor'),
      document.querySelector('#programming-editor .ace_editor')
    ];

    for (const answerEl of answerElCandidates) {
      if (answerEl && isStrictAnswerEditor(answerEl)) {
        if (answerEl.env && answerEl.env.editor) return answerEl.env.editor;
        const childAce = answerEl.querySelector?.('.ace_editor');
        if (childAce?.env?.editor && isStrictAnswerEditor(childAce)) return childAce.env.editor;
        if (aceObj) {
          try {
            const ed = aceObj.edit(answerEl.id || answerEl);
            if (ed) return ed;
          } catch(e) {}
        }
      }
    }

    // Check 2: First non-readonly ACE editor (skipping all Header and Footer snippet editors)
    const aceEditors = document.querySelectorAll('.ace_editor');
    for (const el of aceEditors) {
      try {
        if (!isStrictAnswerEditor(el)) continue;
        const ed = (el.env && el.env.editor) ? el.env.editor : (aceObj ? aceObj.edit(el.id || el) : null);
        if (ed && typeof ed.setValue === 'function' && !ed.getReadOnly()) return ed;
      } catch(e) {}
    }

    // Check 3: Modern CodeMirror 6 editor (used in new Iamneo / PAT portal UI in data3 / m.md)
    let cmContent = document.querySelector('#programming-editor .cm-content[contenteditable="true"], .cm-content[contenteditable="true"]');
    if (!cmContent) {
      const allCm = document.querySelectorAll('.cm-content');
      for (const cm of allCm) {
        if (isStrictAnswerEditor(cm) && cm.getAttribute('contenteditable') !== 'false') {
          cmContent = cm;
          break;
        }
      }
    }
    if (!cmContent) {
      const pe = document.querySelector('#programming-editor');
      if (pe) {
        cmContent = pe.querySelector('.cm-content');
      }
    }
    if (cmContent && isStrictAnswerEditor(cmContent)) {
      const cmEditor = cmContent.closest('.cm-editor') || cmContent;
      return {
        isCodeMirror6: true,
        element: cmContent,
        getReadOnly: () => cmContent.getAttribute('contenteditable') === 'false',
        setValue: function(code) {
          const view = getCodeMirror6View(cmEditor) || getCodeMirror6View(cmContent);
          if (view && view.dispatch && view.state) {
            try {
              view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: code },
                selection: { anchor: code.length }
              });
              return;
            } catch(e) {}
          }

          // Fallback via DOM selection & execCommand
          try {
            cmContent.focus();
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(cmContent);
            sel.removeAllRanges();
            sel.addRange(range);
            let ok = false;
            try {
              ok = document.execCommand('insertText', false, code);
            } catch(e) {}
            if (!ok) {
              cmContent.textContent = code;
              cmContent.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: code }));
            }
            cmContent.dispatchEvent(new Event('input', { bubbles: true }));
            cmContent.dispatchEvent(new Event('change', { bubbles: true }));
          } catch(e) {}
        },
        clearSelection: function() {
          const sel = window.getSelection();
          if (sel && sel.removeAllRanges) sel.removeAllRanges();
        },
        navigateFileEnd: function() {
          try {
            const view = getCodeMirror6View(cmEditor) || getCodeMirror6View(cmContent);
            if (view && view.dispatch && view.state) {
              view.dispatch({ selection: { anchor: view.state.doc.length } });
              return;
            }
            cmContent.focus();
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(cmContent);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          } catch(e) {}
        },
        focus: function() {
          try {
            const view = getCodeMirror6View(cmEditor) || getCodeMirror6View(cmContent);
            if (view && typeof view.focus === 'function') {
              view.focus();
              return;
            }
            cmContent.focus();
          } catch(e) {}
        },
        insert: function(ch) {
          const view = getCodeMirror6View(cmEditor) || getCodeMirror6View(cmContent);
          if (view && view.dispatch && view.state) {
            try {
              const pos = view.state.selection.main.head;
              view.dispatch({
                changes: { from: pos, to: pos, insert: ch },
                selection: { anchor: pos + ch.length }
              });
              return;
            } catch(e) {}
          }
          try {
            document.execCommand('insertText', false, ch);
            cmContent.dispatchEvent(new Event('input', { bubbles: true }));
          } catch(e) {}
        }
      };
    }

    // Check 4: Monaco Editor
    if (window.monaco && window.monaco.editor) {
      try {
        const monacoModels = window.monaco.editor.getModels();
        if (monacoModels && monacoModels.length > 0) {
          const model = monacoModels[monacoModels.length - 1];
          return {
            isMonaco: true,
            model: model,
            getReadOnly: () => false,
            setValue: function(code) { model.setValue(code); },
            clearSelection: function() {},
            navigateFileEnd: function() {},
            focus: function() {
              const el = document.querySelector('.monaco-editor');
              if (el) el.focus();
            },
            insert: function(ch) {
              const val = model.getValue();
              model.setValue(val + ch);
            }
          };
        }
      } catch(e) {}
    }

    return null;
  }

  // Get unique identifier for the currently displayed question
  function getQuestionIdentifier() {
    const qEl = document.querySelector('div[aria-labelledby="question-data"]') ||
                document.querySelector('.rich-text-content, div[class*="rich-text-content"]') ||
                document.querySelector('#content-left content-left testtaking-question') ||
                document.querySelector('.qaas-block-question-title') ||
                document.querySelector('[aria-labelledby="code-constraints"]');
    if (qEl) {
      return (qEl.innerText || qEl.textContent || '').slice(0, 120).trim();
    }
    const qNumEl = document.querySelector('div.t-whitespace-nowrap') || document.querySelector('.question-number') || document.querySelector('[id*="question-nav"]');
    return qNumEl ? (qNumEl.innerText || qNumEl.textContent || '').trim() : null;
  }

  // Stop typing mode and clear current question buffer
  window._neoStopTyping = function() {
    if (isRandomTypingActive || currentCode) {
      isRandomTypingActive = false;
      currentCode = "";
      charIndex = 0;
    }
  };

  // Detect question change and automatically stop typing feature
  function checkForQuestionChange() {
    const currentQ = getQuestionIdentifier();
    if (currentQ && lastQuestionIdentifier && currentQ !== lastQuestionIdentifier) {
      window._neoStopTyping();
    }
    if (currentQ) {
      lastQuestionIdentifier = currentQ;
    }
  }

  setInterval(checkForQuestionChange, 350);

  // Stop typing on question navigation clicks
  document.addEventListener('click', function(e) {
    const navBtn = e.target.closest('button, [aria-labelledby="each-question-card"], .question-card, [id*="next"], [id*="prev"], .tab-btn');
    if (navBtn) {
      setTimeout(function() {
        const currentQ = getQuestionIdentifier();
        if (currentQ && currentQ !== lastQuestionIdentifier) {
          window._neoStopTyping();
          lastQuestionIdentifier = currentQ;
        }
      }, 150);
    }
  }, true);

  // Stop typing on URL or history changes
  window.addEventListener('popstate', window._neoStopTyping);
  window.addEventListener('hashchange', window._neoStopTyping);
  window.addEventListener('neoStopTyping', window._neoStopTyping);

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
        if (ch === '/' && next === '/') {
          i += 2;
          while (i < code.length && code[i] !== '\n') {
            i++;
          }
          continue;
        }
        if (ch === '/' && next === '*') {
          i += 2;
          while (i + 1 < code.length && !(code[i] === '*' && code[i + 1] === '/')) {
            i++;
          }
          i += 2;
          continue;
        }
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
      const mainMatch = /(?:int|void)?\s*main\s*\([^)]*\)\s*\{/.exec(result);
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

  // Pure code cleaner: extract exactly ONE clean solution code, strip markdown fences and comments, and enforce center code only
  function cleanPureCode(raw, programmingLanguage = '', headerSnippet = '', footerSnippet = '') {
    if (!raw) return '';
    let code = extractSingleCleanCode(raw, programmingLanguage);
    return cleanCenterCode(code, headerSnippet, footerSnippet);
  }

  // Bridge for content script to get 100% full un-virtualized editor snippets from MAIN world
  function getFullEditorSnippets() {
    const aceObj = (typeof ace !== 'undefined') ? ace : (window.ace || document.defaultView?.ace);
    function getVal(el) {
      if (!el) return '';
      try {
        if (el.env && el.env.editor && typeof el.env.editor.getValue === 'function') {
          return el.env.editor.getValue().trim();
        }
        if (aceObj && typeof aceObj.edit === 'function') {
          const ed = aceObj.edit(el.id || el);
          if (ed && typeof ed.getValue === 'function') return ed.getValue().trim();
        }
      } catch(e) {}
      const lines = el.querySelectorAll('.ace_line');
      if (lines && lines.length > 0) return Array.from(lines).map(l => l.textContent).join('\n').trim();
      return (el.innerText || el.textContent || '').trim();
    }

    const headerEl = document.querySelector('[id*="ttHeaderEditor"], [id*="HeaderEditor"], [id*="headerEditor"], [aria-labelledby="tt-header"] .ace_editor, .header-content .ace_editor');
    const footerEl = document.querySelector('[id*="ttFooterEditor"], [id*="FooterEditor"], [id*="footerEditor"], [aria-labelledby="footer"] .ace_editor, .footer-content .ace_editor');
    const centerEl = document.querySelector('div[aria-labelledby="answer"] .ace_editor, [id*="ttAnswerEditor"]:not([id*="Editor2"]), [aria-labelledby="editor-answer"]:not([id*="Editor2"]), .answer-content .ace_editor');

    let headerSnippet = getVal(headerEl);
    let footerSnippet = getVal(footerEl);
    let starterCode = getVal(centerEl);

    // CodeMirror 6 Three-Part Split detection (Iamneo / Next.js UI in data3)
    if (!headerSnippet || !footerSnippet || !starterCode) {
      const cmEditors = Array.from(document.querySelectorAll('.cm-editor'));
      if (cmEditors.length > 0) {
        let cmHeader = null;
        let cmFooter = null;
        let cmCenter = null;

        cmEditors.forEach((ed, idx) => {
          const card = ed.closest('.rounded-xl, .rounded-lg, .border, .flex-col') || ed.parentElement;
          const cardText = card ? (card.innerText || card.textContent || '') : '';
          const isHeader = cardText.includes('Header Snippet');
          const isFooter = cardText.includes('Footer Snippet');
          const content = ed.querySelector('.cm-content');
          const isReadOnly = content ? (content.getAttribute('contenteditable') === 'false') : false;
          const isProgrammingEditor = Boolean(ed.closest('#programming-editor') || ed.id === 'programming-editor');

          if (isHeader) {
            cmHeader = ed;
          } else if (isFooter) {
            cmFooter = ed;
          } else if (isProgrammingEditor || (!isReadOnly && !isHeader && !isFooter)) {
            cmCenter = ed;
          } else if (isReadOnly) {
            if (!cmHeader && idx === 0) cmHeader = ed;
            else if (!cmFooter) cmFooter = ed;
          }
        });

        if (!headerSnippet && cmHeader) headerSnippet = getCodeMirror6Text(cmHeader);
        if (!footerSnippet && cmFooter) footerSnippet = getCodeMirror6Text(cmFooter);
        if (!starterCode && cmCenter) starterCode = getCodeMirror6Text(cmCenter);
      }
    }

    return {
      headerSnippet: headerSnippet || '',
      footerSnippet: footerSnippet || '',
      starterCode: starterCode || ''
    };
  }

  // Handle sync bridge request from isolated content.js
  document.addEventListener('neoGetMainSnippets', function() {
    try {
      const snippets = getFullEditorSnippets();
      let bridgeEl = document.getElementById('neo-snippets-data');
      if (!bridgeEl) {
        bridgeEl = document.createElement('div');
        bridgeEl.id = 'neo-snippets-data';
        bridgeEl.style.display = 'none';
        (document.body || document.documentElement).appendChild(bridgeEl);
      }
      bridgeEl.textContent = JSON.stringify(snippets);
    } catch(e) {}
  });

  // Comprehensive editor sync helper (propagates code to Ace session, Angular model, and DOM cleanly without duplicate pasting)
  function syncEditorValue(ed, code) {
    if (!ed) return;
    try {
      if (typeof ed.setValue === 'function') {
        ed.setValue(code, 1);
      }
      if (typeof ed.clearSelection === 'function') {
        ed.clearSelection();
      }
      if (typeof ed.navigateFileEnd === 'function') {
        ed.navigateFileEnd();
      }
      if (typeof ed.focus === 'function') {
        try { ed.focus(); } catch(e) {}
      }

      // Ace Editor specific safe handling:
      if (ed.session) {
        if (ed.renderer && typeof ed.renderer.updateFull === 'function') {
          try { ed.renderer.updateFull(true); } catch(e) {}
        }
        // Reset Ace's internal keyboard buffer to prevent duplicate insertion
        if (ed.textInput && typeof ed.textInput.getElement === 'function') {
          const inputEl = ed.textInput.getElement();
          if (inputEl) {
            inputEl.value = '';
          }
        }
      }

      // Notify container element for Angular / React / Vue form binding without triggering Ace's hidden TextInput listener
      const containerEl = ed.container || document.querySelector('[id*="ttAnswerEditor"]:not([id*="Editor2"]), [aria-labelledby="editor-answer"]:not([id*="Editor2"]), programming-answer .ace_editor, #programming-editor');
      if (containerEl) {
        try {
          containerEl.dispatchEvent(new Event('input', { bubbles: true }));
          containerEl.dispatchEvent(new Event('change', { bubbles: true }));
        } catch(e) {}
      }

      // Plain textarea fallback (strictly for non-Ace native textareas, never touch .ace_text-input or .inputarea)
      if (!ed.session && !ed.isCodeMirror6 && !ed.isMonaco) {
        const plainTextareas = document.querySelectorAll('textarea:not(.ace_text-input):not(.inputarea)');
        plainTextareas.forEach(t => {
          try {
            t.value = code;
            t.dispatchEvent(new Event('input', { bubbles: true }));
            t.dispatchEvent(new Event('change', { bubbles: true }));
          } catch(e) {}
        });
      }
    } catch(e) {}
  }

  // Pre-submit, pre-pause, and pre-compile flush function: sync container without re-inserting or duplicating code
  window._neoExamShieldFlushEditorCode = function() {
    try {
      const ed = findAnswerEditor();
      if (ed) {
        const containerEl = ed.container || document.querySelector('[id*="ttAnswerEditor"]:not([id*="Editor2"]), [aria-labelledby="editor-answer"]:not([id*="Editor2"]), programming-answer .ace_editor, #programming-editor');
        if (containerEl) {
          try {
            containerEl.dispatchEvent(new Event('input', { bubbles: true }));
            containerEl.dispatchEvent(new Event('change', { bubbles: true }));
          } catch(e) {}
        }
      }
    } catch(e) {}
  };
  window.addEventListener('neoFlushEditor', window._neoExamShieldFlushEditorCode);
  document.addEventListener('neoFlushEditor', window._neoExamShieldFlushEditorCode);

  // Directly capture submit, compile, and pause clicks in MAIN world before Angular/portal handlers run
  document.addEventListener('click', function(event) {
    try {
      const target = event.target;
      if (!target) return;
      const btn = (target.closest ? target.closest('button, [role="button"], a, div.btn-container, div.submission, [id*="submit"], [id*="pause"]') : null);
      const targetId = ((target.id || '') + ' ' + (btn && btn.id ? btn.id : '')).toLowerCase();
      const targetText = ((target.innerText || target.textContent || '') + ' ' + (btn ? (btn.innerText || btn.textContent || '') : '')).trim().toLowerCase();
      const targetAria = (((target.getAttribute && target.getAttribute('aria-labelledby')) || '') + ' ' + 
                          ((target.getAttribute && target.getAttribute('aria-label')) || '') + ' ' +
                          (btn && btn.getAttribute && (btn.getAttribute('aria-labelledby') || btn.getAttribute('aria-label')) || '')).toLowerCase();
      const targetClass = ((target.className || '') + ' ' + (btn && btn.className ? btn.className : '')).toLowerCase();

      // Submit actions (Submit Test, Submit Code, Yes / Confirm in submit modal)
      const isSubmit = targetId.includes('submit') ||
                       targetText.includes('submit test') ||
                       targetText.includes('submit code') ||
                       targetText.includes('yes, submit') ||
                       targetText.includes('submit answer') ||
                       targetText.includes('end test') ||
                       targetAria.includes('submit') ||
                       targetClass.includes('submission') ||
                       targetText === 'yes' ||
                       targetText === 'submit';

      // Compile/run code actions
      const isCompile = targetId.includes('compile') ||
                        targetText.includes('compile') ||
                        targetText.includes('run code');

      // Pause actions
      const isPause = targetId.includes('pause') ||
                      targetText.includes('pause') ||
                      targetAria.includes('pause') ||
                      targetClass.includes('pause');

      if (isSubmit || isCompile || isPause) {
        window._neoExamShieldFlushEditorCode();
      }
    } catch(e) {}
  }, true);

  // Fast Instant code insertion into editor (Alt+T)
  window._neopassStartTyping = function(codeToType, programmingLanguage = '', headerSnippet = '', footerSnippet = '') {
    if (!codeToType) return;
    window._neoStopTyping(); // Stop any pending random typing

    // Auto-detect header/footer from live page if not explicitly supplied
    if (!headerSnippet || !footerSnippet) {
      try {
        const snips = getFullEditorSnippets();
        headerSnippet = headerSnippet || snips.headerSnippet;
        footerSnippet = footerSnippet || snips.footerSnippet;
      } catch(e) {}
    }

    const cleanCode = cleanPureCode(codeToType, programmingLanguage, headerSnippet, footerSnippet);
    const found = findAnswerEditor();
    if (found) {
      try {
        editor = found;
        syncEditorValue(editor, cleanCode);
      } catch (error) {}
    }
  };

  // Initialize Random Key Press Typing Mode (Alt+X)
  window._neoExamShieldInitRandomTyping = function(codeToType, headerSnippet = '', footerSnippet = '') {
    if (!codeToType) return;

    // Auto-detect header/footer from live page if not explicitly supplied
    if (!headerSnippet || !footerSnippet) {
      try {
        const snips = getFullEditorSnippets();
        headerSnippet = headerSnippet || snips.headerSnippet;
        footerSnippet = footerSnippet || snips.footerSnippet;
      } catch(e) {}
    }

    currentCode = cleanPureCode(codeToType, '', headerSnippet, footerSnippet);
    charIndex = 0;
    isRandomTypingActive = true;
    lastQuestionIdentifier = getQuestionIdentifier();
    editor = findAnswerEditor();
    if (editor) {
      try {
        editor.setValue('', 1);
        editor.clearSelection();
        editor.focus();
        editor.navigateFileEnd();
      } catch(e) {}
    }
  };

  // Keyboard listener for Alt+D / Alt+C (stop) and Random Key Typing
  function handleTypingKeydown(event) {
    // Alt+D / Alt+C: Stop/Off typing mode
    const isAltStop = event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey && 
                   (event.code === 'KeyD' || event.code === 'KeyC' || 
                    (event.key && (event.key.toLowerCase() === 'd' || event.key.toLowerCase() === 'c')));
    if (isAltStop) {
      event.preventDefault();
      event.stopPropagation();
      window._neoStopTyping();
      return;
    }

    // Process typing only if mode is active and not holding modifier keys (except Shift)
    if (!isRandomTypingActive || !currentCode) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    // Ignore standalone modifier keys
    const ignoredKeys = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape'];
    if (ignoredKeys.includes(event.key)) return;

    // Reveal one character from clean solution code on any keypress
    event.preventDefault();
    event.stopPropagation();

    if (charIndex < currentCode.length) {
      const nextChar = currentCode[charIndex];
      charIndex++;

      if (!editor) {
        editor = findAnswerEditor();
      }

      if (editor) {
        try {
          if (charIndex === 1) {
            editor.setValue(nextChar, 1);
          } else {
            editor.insert(nextChar);
          }
        } catch(e) {
          try {
            editor.setValue(currentCode.substring(0, charIndex), 1);
          } catch(err) {}
        }

        if (charIndex >= currentCode.length) {
          isRandomTypingActive = false;
          try { syncEditorValue(editor, currentCode); } catch(e) {}
          window.dispatchEvent(new CustomEvent('neoTypingComplete'));
        }
      } else {
        isRandomTypingActive = false;
      }
    }
  }

  // Defend against Examly calcTime null pointer crash when test is paused/resumed
  function ensureTimerMediaElement() {
    try {
      if (!document.getElementById('active-tab-audio')) {
        const aud = document.createElement('audio');
        aud.id = 'active-tab-audio';
        aud.src = 'https://images.examly.io/scripts/audio/race2.ogg';
        aud.style.display = 'none';
        (document.body || document.documentElement).appendChild(aud);
      }
    } catch(e) {}
  }
  ensureTimerMediaElement();
  setInterval(ensureTimerMediaElement, 2500);

  // Auto-save & restore code per question so pause / resume never loses student's written code
  function setupCodeAutoPersistence() {
    try {
      const getActiveQKey = () => {
        const url = window.location.href;
        const qHeader = document.querySelector('div[aria-labelledby="question-no font16"], [aria-labelledby="question-no"]');
        const qNum = qHeader ? qHeader.textContent.trim() : 'default';
        return `neo_saved_code_${encodeURIComponent(url)}_${encodeURIComponent(qNum)}`;
      };

      // Periodic auto-backup of editor code
      setInterval(() => {
        try {
          const ed = findAnswerEditor();
          if (ed && typeof ed.getValue === 'function') {
            const val = ed.getValue();
            if (val && val.trim().length > 15 && !val.includes('// You are using GCC')) {
              const key = getActiveQKey();
              sessionStorage.setItem(key, val);
            }
          }
        } catch(e) {}
      }, 1500);

      // Auto-restore on question mount if editor is empty or defaulted
      setTimeout(() => {
        try {
          const key = getActiveQKey();
          const saved = sessionStorage.getItem(key);
          if (saved && saved.trim().length > 15) {
            const ed = findAnswerEditor();
            if (ed && typeof ed.getValue === 'function') {
              const current = ed.getValue().trim();
              if (!current || current === '// You are using GCC' || current.length < 10) {
                syncEditorValue(ed, saved);
              }
            }
          }
        } catch(e) {}
      }, 1000);
    } catch(e) {}
  }
  setupCodeAutoPersistence();

  window.addEventListener('keydown', handleTypingKeydown, true);
  document.addEventListener('keydown', handleTypingKeydown, true);
})();
