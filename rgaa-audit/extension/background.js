// background.js — Service Worker MV3

chrome.action.onClicked.addListener((tab) => {
  // Ouvre le panel si clic sur l'icône sans popup
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });
});

// Relai de messages entre panel et content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getAuditResults') {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'runAudit' }, response => {
        sendResponse(response);
      });
    });
    return true;
  }
});
