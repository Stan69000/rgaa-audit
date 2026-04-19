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

function isValidReportShape(report) {
  return Boolean(isPlainObject(report)
    && Array.isArray(report.results)
    && isPlainObject(report.score));
}

function createFallbackReport(report) {
  return {
    results: [],
    score: { taux: 0, conformes: 0, nonConformes: 0, na: 0, total: 0 },
    url: typeof report?.url === 'string' ? report.url : '',
    timestamp: typeof report?.timestamp === 'string' ? report.timestamp : new Date().toISOString(),
    internalErrors: [
      ...(Array.isArray(report?.internalErrors) ? report.internalErrors : []),
      {
        section: 'background-validation',
        message: 'Structure de rapport invalide reçue depuis content.js',
      },
    ],
  };
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
      resolve(isValidReportShape(response.report) ? response.report : createFallbackReport(response.report));
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isPlainObject,
    isSafeAction,
    isValidReportShape,
    createFallbackReport,
  };
}
