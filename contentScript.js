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

// Neo Browser Download Link - Updated
const neoBrowserDownloadLink = "https://neoexamshield.vercel.app";

// Function to add our NeoExamShield button left of the existing Neo Browser button
function replaceNeoBrowserButton() {
  const neoButton = document.querySelector('button#neobrowser');

  if (neoButton && !neoButton.dataset.replaced) {
    // Create custom styled button/link
    const ourBtn = document.createElement('a');
    ourBtn.innerHTML = `
      <div class="container jcc btn-align">
        <div class="t-whitespace-nowrap ng-star-inserted">
          <span>Download NeoExamShield Launcher</span>
        </div>
      </div>
    `;
    ourBtn.href = neoBrowserDownloadLink;
    ourBtn.target = "_blank";
    ourBtn.className = neoButton.className;
    ourBtn.id = "neoexamshield-browser-btn";
    ourBtn.tabIndex = 0;

    // Apply gradient styling
    ourBtn.style.cssText = `
      position: relative !important;
      display: inline-flex !important;
      padding: 8px 16px !important;
      font-size: 14px !important;
      font-weight: 500 !important;
      color: white !important;
      background-color: black !important;
      border-radius: 8px !important;
      text-align: center !important;
      text-decoration: none !important;
      cursor: pointer !important;
      z-index: 1 !important;
      border: 2px solid transparent !important;
      transition: all 0.3s ease !important;
    `;

    // Create gradient border effect
    const beforeStyle = document.createElement('style');
    beforeStyle.textContent = `
      a#neoexamshield-browser-btn {
        position: relative !important;
        background: linear-gradient(black, black) padding-box,
                    linear-gradient(45deg, #3b82f6, #8b5cf6, #ec4899) border-box !important;
        border: 2px solid transparent !important;
      }
      a#neoexamshield-browser-btn:hover {
        transform: scale(1.05) !important;
        box-shadow: 0 0 20px rgba(139, 92, 246, 0.6) !important;
      }
    `;
    if (!document.querySelector('style[data-neobrowser-style]')) {
      beforeStyle.setAttribute('data-neobrowser-style', 'true');
      (document.head || document.documentElement)?.appendChild(beforeStyle);
    }

    // Insert our button to the left of the existing button
    neoButton.parentNode.insertBefore(ourBtn, neoButton);

    // Make the parent (app-button) a flex row so both buttons sit side by side
    neoButton.parentNode.style.cssText += `
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      gap: 8px !important;
    `;

    neoButton.dataset.replaced = "true";

    console.log('✅ NeoExamShield Launcher button added left of existing Neo Browser button');
  }
}

// Observer to detect Neo Browser button and add our button
const buttonObserver = new MutationObserver((mutations) => {
  replaceNeoBrowserButton();
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

// Initial check for Neo Browser button (in case already loaded)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', replaceNeoBrowserButton);
} else {
  replaceNeoBrowserButton();
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

