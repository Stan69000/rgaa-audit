// background.js — v0.2.3
// Injection fiable du content script avant runAudit

'use strict';

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs.length ? tabs[0] : null;
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function isSafeAction(action) {
  return action === 'getAuditResults';
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isPlainObject(message) || !isSafeAction(message.action)) {
    sendResponse({ success: false, error: 'Action non autorisée.' });
    return false;
  }

  // ── Relai audit DOM ──
  if (message.action === 'getAuditResults') {
    (async () => {
      try {
        const tab = await getActiveTab();
        if (!tab?.id) {
          sendResponse({ success: false, error: 'Aucun onglet actif détecté.' });
          return;
        }

        // Toujours (ré)injecter content.js pour éviter "Receiving end does not exist"
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });

        chrome.tabs.sendMessage(tab.id, { action: 'runAudit' }, response => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
            return;
          }
          sendResponse(response || { success: false, error: 'Réponse vide du content script.' });
        });
      } catch (e) {
        sendResponse({ success: false, error: e.message || String(e) });
      }
    })();

    return true;
  }
});
