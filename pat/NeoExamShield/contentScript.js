// Check if the chrome object is available (for compatibility)
if (typeof chrome === "undefined") {
  // Handle the case where chrome is not defined (like in Firefox)
}

// Always inject mock_code.js interceptor to handle extension detection (even when not logged in)
(function injectMockCode() {
  const mockScript = document.createElement('script');
  mockScript.src = chrome.runtime.getURL('data/inject/mock_code.js');
  mockScript.onload = function () {
      console.log('✅ Mock code interceptor loaded');
      this.remove(); // Clean up after execution
  };
  mockScript.onerror = function() {
      console.error('❌ Failed to load mock code interceptor');
  };
  // Inject as early as possible
  (document.head || document.documentElement).prepend(mockScript);
})();

// Inject exam.js (no login required)
const script = document.createElement('script');
script.src = chrome.runtime.getURL('data/inject/exam.js');
(document.head || document.documentElement).appendChild(script);

// Login prompt and status sync removed - extension features now available to all users

// Function removed - login check no longer required for extension features

// Clean up any previously injected browser unlock button if present
try {
  const existingBtn = document.getElementById('neoexamshield-browser-btn');
  if (existingBtn) existingBtn.remove();
  const existingStyle = document.querySelector('style[data-neobrowser-style]');
  if (existingStyle) existingStyle.remove();
} catch (e) {}

// Function to detect browser restriction dialogs and inject 1-click Chrome bypass
function checkAndHandleBrowserWarning() {
  const elements = document.querySelectorAll('div, p, span, h3, h4, app-modal, .modal-body, .alert');
  for (const el of elements) {
    if (el.dataset && el.dataset.neoBypassChecked) continue;
    const txt = (el.innerText || el.textContent || '').trim();
    if (txt.includes('Please use latest version of Google Chrome') || 
        txt.includes('This Browser will be supported soon')) {
      el.dataset.neoBypassChecked = 'true';

      const isBrave = Boolean(navigator.brave || window.brave);
      const bLabel = isBrave ? 'Brave' : (navigator.userAgent.includes('Edg') ? 'Edge' : 'Browser');

      const fixBtn = document.createElement('button');
      fixBtn.type = 'button';
      fixBtn.id = 'neo-fix-chrome-btn';
      fixBtn.innerHTML = `⚡ Unlock in ${bLabel} (Switch to Chrome Mode)`;
      fixBtn.style.cssText = `
        margin-top: 10px;
        padding: 8px 18px;
        background: #1686FF;
        color: white;
        font-weight: 700;
        font-size: 13px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        display: inline-block;
        box-shadow: 0 4px 12px rgba(22, 134, 255, 0.35);
        transition: transform 0.15s ease;
      `;
      fixBtn.onclick = (e) => {
        e.preventDefault();
        fixBtn.textContent = 'Switching to Chrome Mode...';
        chrome.runtime.sendMessage({ action: 'setBrowserBypass', mode: 'chrome' }, () => {
          try { localStorage.setItem('neo_browser_bypass_mode', 'chrome'); } catch(err) {}
          setTimeout(() => window.location.reload(), 350);
        });
      };
      el.appendChild(fixBtn);
      break;
    }
  }
}

// Observer to detect browser restriction dialogs
const buttonObserver = new MutationObserver((mutations) => {
  checkAndHandleBrowserWarning();
});

// Start observing for button changes safely
function startButtonObserver() {
  const target = document.body || document.documentElement;
  if (target) {
    try {
      buttonObserver.observe(target, { 
        childList: true, 
        subtree: true 
      });
    } catch (e) {}
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      try {
        buttonObserver.observe(document.body || document.documentElement, { 
          childList: true, 
          subtree: true 
        });
      } catch (e) {}
    }, { once: true });
  }
}
startButtonObserver();

// Initial check for browser warnings (in case already loaded)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    checkAndHandleBrowserWarning();
  });
} else {
  checkAndHandleBrowserWarning();
}

// Listen for window messages
window.addEventListener("message", function(event) {
  if (!event || !event.data) return;

  // Handle portal extension heartbeat / template base key verification
  if (event.data.currentKey) {
    sendMessageToWebsite(event.data);
    return;
  }

  // Handle messages targeted for extension API execution
  if (event.data.target === "extension" && event.data.message) {
    chrome.runtime.sendMessage(event.data.message, response => {
      window.postMessage({
        source: "extension",
        response: response
      }, "*");
    });
  }
});

// Listen for pagehide to clean up template elements
window.addEventListener("pagehide", removeInjectedElement);

// Function to send verification response to portal
function sendMessageToWebsite(messageData) {
  removeInjectedElement();
  if (!messageData || !messageData.currentKey) return;

  const injectedElement = document.createElement("span");
  injectedElement.id = "x-template-base-" + messageData.currentKey;
  injectedElement.style.display = "none";

  (document.body || document.documentElement).appendChild(injectedElement);
  window.postMessage(0, "*");
}

// Function to remove injected elements from the DOM
function removeInjectedElement() {
  const injectedElements = document.querySelectorAll("[id^='x-template-base-']");
  injectedElements.forEach(el => el.remove());
}

