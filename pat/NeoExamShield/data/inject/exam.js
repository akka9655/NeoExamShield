// Use shared isMac variable if it exists, otherwise declare it
if (typeof window.isMac === 'undefined') {
    window.isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || 
                   navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
}

// Auto-answering mechanism
(function () {
  let editor;
  let codeLines = [];

  // Find the answer Ace editor on the page (only the editable answer editor)
  function findAnswerEditor() {
    // First try to find the specific answer editor by aria-labelledby
    const answerEl = document.querySelector('[aria-labelledby="editor-answer"]');
    if (answerEl) {
      try {
        return ace.edit(answerEl);
      } catch(e) {}
    }
    // Fallback: find first non-readonly ACE editor
    const editors = document.querySelectorAll('.ace_editor');
    for (const el of editors) {
      try {
        const ed = ace.edit(el);
        if (!ed.getReadOnly()) return ed;
      } catch(e) {}
    }
    return null;
  }
  let charIndex = 0;
  let lineIndex = 0;
  let currentCode = ""; // Store the current question's complete code
  let isTyping = false; // Flag to track if currently typing
  let typingInitialized = false; // Flag to track if Cmd+Shift+T was pressed first
  let lastQuestionNumber = null; // Track the last question number to detect changes

  // Function to detect question changes and reset typing state
  function checkForQuestionChange() {
    const questionElement = document.querySelector("#content-left > content-left > div > div.t-h-full > testtaking-question > div > div.t-flex.t-items-center.t-justify-between.t-whitespace-nowrap.t-px-10.t-py-8.lg\\:t-py-8.lg\\:t-px-20.t-bg-primary\\/\\[0\\.1\\].t-border-b.t-border-solid.t-border-b-neutral-2.t-min-h-\\[30px\\].lg\\:t-min-h-\\[35px\\].ng-star-inserted > div:nth-child(1) > div > div");
    
    if (questionElement) {
      const questionText = questionElement.textContent;
      const match = questionText.match(/Question No : (\d+) \/ \d+/);
      const currentQuestionNumber = match ? match[1] : null;
      
      // If question changed, reset typing state
      if (currentQuestionNumber && currentQuestionNumber !== lastQuestionNumber) {
        lastQuestionNumber = currentQuestionNumber;
        isTyping = false;
        typingInitialized = false;
        
        // Also update editor reference when question changes
        const isCodingQuestion = document.querySelector("#programme-compile");
        if (isCodingQuestion) {
          const found = findAnswerEditor();
          if (found) editor = found;
        }
      }
    }
  }

  // Check for question changes periodically
  setInterval(checkForQuestionChange, 500);
  
  // Direct code insertion into Ace editor (instant, no human typing simulator)
  window._neopassStartTyping = function(codeToType) {
    if (!codeToType) return;
    console.log('[exam.js] Direct code insertion called, length:', codeToType.length);
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
})();
