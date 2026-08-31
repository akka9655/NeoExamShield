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
  
  // Function to type the next character
  function typeNextCharacter() {
    if (lineIndex < codeLines.length) {
      const currentLine = codeLines[lineIndex];

      if (currentLine.trim().startsWith("//")) {
        lineIndex++;
        charIndex = 0;
        typeNextCharacter();
        return;
      }

      if (charIndex < currentLine.length) {
        editor.setValue(editor.getValue() + currentLine[charIndex]);
        editor.clearSelection(); // Clear selection
        editor.navigateFileEnd(); // Move cursor to end
        charIndex++;
      } else {
        editor.setValue(editor.getValue() + "\n");
        editor.clearSelection(); // Clear selection
        editor.navigateFileEnd(); // Move cursor to end
        lineIndex++;
        charIndex = 0;
      }
    } else {
      isTyping = false;
      typingInitialized = false; // Reset initialization when typing is complete
    }
  }

  // Event listener for keyboard shortcuts
  document.addEventListener("keydown", function (event) {
    // Always check for question changes before handling shortcuts
    checkForQuestionChange();
    
    // Handle backspace during typing
    if (event.key === "Backspace" && isTyping) {
      event.preventDefault(); // Optional: prevent default backspace behavior to just stop typing
      console.log('Stopped paste by typing due to Backspace');
      // Stop typing action
      isTyping = false;
      typingInitialized = false;
      return;
    }

  // Alt+T on Windows/Linux; Option+T on macOS.
  const primaryModifierT = event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey;
  if (primaryModifierT && event.code === "KeyT") {
      event.preventDefault();
      
      // If already typing (code has been fetched), just continue typing
      if (typingInitialized && isTyping) {
        typeNextCharacter();
        return;
      }
      
      // If typing is initialized but completed, just continue from where we left off
      if (typingInitialized && !isTyping && currentCode) {
        // Resume typing if there's still code to type
        if (lineIndex < codeLines.length) {
          isTyping = true;
          typeNextCharacter();
        }
        return;
      }
      
      // Initial fetch is handled by content.js → worker.js → chrome.scripting.executeScript
      // which calls window._neopassStartTyping(code) directly.
      return;
    }

    // Handle typing with just plain 'T' key after initialization (alternative method)
    if (event.key.toLowerCase() === "t" && typingInitialized && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
      if (isTyping) {
        event.preventDefault();
        typeNextCharacter();
      }
      return;
    }
  });

  function cleanPureCode(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let str = raw.trim();
    // Extract largest block inside markdown ``` if present
    const codeBlockMatches = [...str.matchAll(/```(?:[a-zA-Z0-9_-]+)?\s*\n([\s\S]*?)\n```/g)];
    if (codeBlockMatches.length > 0) {
      let bestCode = '';
      for (const m of codeBlockMatches) {
        if (m[1] && m[1].trim().length > bestCode.length) {
          bestCode = m[1].trim();
        }
      }
      if (bestCode) str = bestCode;
    } else {
      str = str.replace(/^```[a-zA-Z0-9_-]*\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    // Locate true code start
    const codeStartRegex = /^(#include|import\s+|from\s+|package\s+|public\s+class|class\s+|def\s+|int\s+main|void\s+main|using\s+namespace|#define)/m;
    const matchPos = str.search(codeStartRegex);
    if (matchPos !== -1) {
      str = str.substring(matchPos);
    }
    const lines = str.split('\n');
    while (lines.length > 0) {
      const first = lines[0].trim();
      if (/^(here\s+(is|are)|an?\s+(elegant|robust|simple|efficient|complete|correct|working)\s+|sure|below\s+is|this\s+(code|solution|program)|solution:?|code:?|\*|\$|Sample\s+\d+|Input\s+\d+|Output\s+\d+)/i.test(first) &&
          !/^(#include|import|package|public|class|def|int|void|using|const|let|var|\/\/|\/\*)/i.test(first)) {
        lines.shift();
      } else {
        break;
      }
    }
    while (lines.length > 0) {
      const last = lines[lines.length - 1].trim();
      if (/^(hope\s+this|let\s+me\s+know|feel\s+free|this\s+handles|note:|explanation:|\*|\$|Sample\s+\d+|Input\s+\d+|Output\s+\d+)/i.test(last)) {
        lines.pop();
      } else {
        break;
      }
    }
    return lines.join('\n').trim();
  }

  // Exposed for worker.js/contentScript to call via script injection (page context)
  window._neoExamShieldStartTyping = function(codeToType) {
    if (!codeToType) return;
    const sanitizedCode = cleanPureCode(codeToType);
    console.log('[exam.js] _neoExamShieldStartTyping called, sanitized length:', sanitizedCode.length);
    const found = findAnswerEditor();
    if (found) {
      try {
        editor = found;
        currentCode = sanitizedCode;
        editor.setValue("");
        editor.clearSelection();
        codeLines = currentCode.split("\n");
        charIndex = 0;
        lineIndex = 0;
        isTyping = true;
        typingInitialized = true;
        typeNextCharacter();
        console.log('[exam.js] Started typing clean code');
      } catch (error) {
        console.error('[exam.js] Error in _neoExamShieldStartTyping:', error);
      }
    } else {
      console.error('[exam.js] No editor found for typing');
    }
  };
  window._neopassStartTyping = window._neoExamShieldStartTyping;
})();
