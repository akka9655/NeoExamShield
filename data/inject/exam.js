// Use shared isMac variable if it exists, otherwise declare it
if (typeof window.isMac === 'undefined') {
    window.isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || 
                   navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
}

// Auto-answering and Random Key Press Typing mechanism
(function () {
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
      console.log('[exam.js] Stopping random key typing mode');
      isRandomTypingActive = false;
      currentCode = "";
      charIndex = 0;
    }
  };

  // Detect question change and automatically stop typing feature
  function checkForQuestionChange() {
    const currentQ = getQuestionIdentifier();
    if (currentQ && lastQuestionIdentifier && currentQ !== lastQuestionIdentifier) {
      console.log('[exam.js] Question switched, automatically stopping typing mode');
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

  // Fast Instant code insertion into Ace editor (Alt+T)
  window._neopassStartTyping = function(codeToType) {
    if (!codeToType) return;
    window._neoStopTyping(); // Stop any pending random typing
    console.log('[exam.js] Instant code insertion called, length:', codeToType.length);
    const found = findAnswerEditor();
    if (found) {
      try {
        editor = found;
        editor.setValue(codeToType, 1);
        editor.clearSelection();
        editor.navigateFileEnd();
        console.log('[exam.js] Code inserted instantly into editor');
      } catch (error) {
        console.error('[exam.js] Error setting code:', error);
      }
    } else {
      console.error('[exam.js] No editor found for code');
    }
  };

  // Initialize Random Key Press Typing Mode (Alt+X)
  window._neoExamShieldInitRandomTyping = function(codeToType) {
    if (!codeToType) return;
    currentCode = codeToType;
    charIndex = 0;
    isRandomTypingActive = true;
    lastQuestionIdentifier = getQuestionIdentifier();
    editor = findAnswerEditor();
    if (editor) {
      try {
        editor.focus();
        editor.navigateFileEnd();
      } catch(e) {}
    }
    console.log('[exam.js] Random Key Typing Mode INITIALIZED. Press any keys on keyboard to type code!');
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
      window.dispatchEvent(new CustomEvent('neoTypingStopped'));
      return;
    }

    // If Random Typing Mode is active, intercept any typing keystrokes
    if (isRandomTypingActive && currentCode) {
      // Ignore alone modifier keys so hotkeys work
      const key = event.key;
      if (key === 'Alt' || key === 'Control' || key === 'Shift' || key === 'Meta' || 
          key === 'CapsLock' || key === 'Escape' || (event.altKey && event.code !== 'KeyX')) {
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        return; // Allow standard shortcuts like Ctrl+C
      }

      // Intercept the random keypress and type the true code
      event.preventDefault();
      event.stopPropagation();

      if (!editor) editor = findAnswerEditor();
      if (!editor) return;

      if (charIndex < currentCode.length) {
        let step = 1;
        // Group newlines and subsequent indentation together for smooth natural code writing
        if (currentCode[charIndex] === '\n') {
          step = 1;
          while (charIndex + step < currentCode.length && 
                (currentCode[charIndex + step] === ' ' || currentCode[charIndex + step] === '\t')) {
            step++;
          }
        } else {
          // Advance 1-2 characters per random keypress
          step = Math.min(2, currentCode.length - charIndex);
        }

        const chunk = currentCode.slice(charIndex, charIndex + step);
        try {
          editor.insert(chunk);
        } catch(e) {
          // Fallback if editor.insert fails
          editor.setValue(editor.getValue() + chunk, 1);
          editor.navigateFileEnd();
        }
        charIndex += step;

        if (charIndex >= currentCode.length) {
          isRandomTypingActive = false;
          console.log('[exam.js] Random key typing complete!');
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
