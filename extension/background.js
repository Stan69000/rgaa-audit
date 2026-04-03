// background.js
// Injection fiable du content script avant runAudit (page courante uniquement)

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

async function injectAndRunAudit(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { action: 'runAudit' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.success || !response.report) {
        reject(new Error(response?.error || 'Réponse vide du content script.'));
        return;
      }
      resolve(response.report);
    });
  });
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

        const report = await injectAndRunAudit(tab.id);

        sendResponse({ success: true, report });
      } catch (e) {
        sendResponse({ success: false, error: e.message || String(e) });
      }
    })();

    return true;
  }
});
