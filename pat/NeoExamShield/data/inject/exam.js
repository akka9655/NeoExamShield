// Use shared isMac variable if it exists, otherwise declare it
if (typeof window.isMac === 'undefined') {
    window.isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || 
                   navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
}

// Auto-answering and Random Key Press Typing mechanism
(function () {
  const console = { log: () => {}, warn: () => {}, error: () => {}, info: () => {}, debug: () => {} };
  let editor;
  let currentCode = "";
  let charIndex = 0;
  let isRandomTypingActive = false;
  let lastQuestionIdentifier = null;

  // Find the answer Ace editor on the page (only the editable answer editor)
  function findAnswerEditor() {
    const answerEl = document.querySelector('[aria-labelledby="editor-answer"]');
    if (answerEl && typeof ace !== 'undefined') {
      try {
        return ace.edit(answerEl);
      } catch(e) {}
    }
    // Fallback: find first non-readonly ACE editor
    if (typeof ace !== 'undefined') {
      const editors = document.querySelectorAll('.ace_editor');
      for (const el of editors) {
        try {
          const ed = ace.edit(el);
          if (!ed.getReadOnly()) return ed;
        } catch(e) {}
      }
    }
    return null;
  }

  // Get unique identifier for the currently displayed question
  function getQuestionIdentifier() {
    const qEl = document.querySelector('div[aria-labelledby="question-data"]') ||
                document.querySelector('#content-left content-left testtaking-question') ||
                document.querySelector('.qaas-block-question-title') ||
                document.querySelector('[aria-labelledby="code-constraints"]');
    if (qEl) {
      return (qEl.innerText || qEl.textContent || '').slice(0, 120).trim();
    }
    const qNumEl = document.querySelector('div.t-whitespace-nowrap') || document.querySelector('.question-number');
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

    while (i < code.length) {
      const ch = code[i];
      const next = i + 1 < code.length ? code[i + 1] : '';

      if (!inChar && (ch === '"') && (i === 0 || code[i - 1] !== '\\')) {
        inString = !inString;
        result += ch;
        i++;
        continue;
      }

      if (!inString && (ch === "'") && (i === 0 || code[i - 1] !== '\\')) {
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

  // Fast Instant code insertion into Ace editor (Alt+T)
  window._neopassStartTyping = function(codeToType) {
    if (!codeToType) return;
    window._neoStopTyping(); // Stop any pending random typing
    const cleanCode = stripCodeComments(codeToType.replace(/\r\n/g, '\n')).trim();
    const found = findAnswerEditor();
    if (found) {
      try {
        editor = found;
        editor.setValue(cleanCode, 1);
        editor.clearSelection();
        editor.navigateFileEnd();
      } catch (error) {}
    }
  };

  // Initialize Random Key Press Typing Mode (Alt+X)
  window._neoExamShieldInitRandomTyping = function(codeToType) {
    if (!codeToType) return;
    currentCode = stripCodeComments(codeToType.replace(/\r\n/g, '\n')).trim();
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

  // Keyboard listener for Alt+C (stop) and Random Key Typing
  function handleTypingKeydown(event) {
    // Alt+C: Stop/Off typing mode
    const isAltC = event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey && 
                   (event.code === 'KeyC' || (event.key && event.key.toLowerCase() === 'c'));
    if (isAltC) {
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
      charIndex++;
      const partialCode = currentCode.substring(0, charIndex);

      if (!editor) {
        editor = findAnswerEditor();
      }

      if (editor) {
        try {
          editor.setValue(partialCode, 1);
          editor.clearSelection();
          editor.navigateFileEnd();
        } catch(e) {
          try {
            editor.insert(currentCode[charIndex - 1]);
          } catch(err) {}
        }

        if (charIndex >= currentCode.length) {
          isRandomTypingActive = false;
          window.dispatchEvent(new CustomEvent('neoTypingComplete'));
        }
      } else {
        isRandomTypingActive = false;
      }
    }
  }

  window.addEventListener('keydown', handleTypingKeydown, true);
  document.addEventListener('keydown', handleTypingKeydown, true);
})();
