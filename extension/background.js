// background.js — v0.2.2
// Fix : injection fiable du content script avant runAudit + relai Claude API

'use strict';

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs.length ? tabs[0] : null;
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function isSafeAction(action) {
  return action === 'getAuditResults' || action === 'callClaude';
}

function validateClaudePayload(message) {
  if (!isPlainObject(message)) return 'Format de message invalide.';
  if (typeof message.apiKey !== 'string' || !message.apiKey.startsWith('sk-ant-')) {
    return 'Clé API invalide.';
  }
  if (typeof message.prompt !== 'string' || message.prompt.trim().length < 10) {
    return 'Prompt invalide.';
  }
  if (message.prompt.length > 12000) {
    return 'Prompt trop long.';
  }
  return null;
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

  // ── Relai appel Claude API ──
  // Le background service worker n'a pas les restrictions CORS du popup
  if (message.action === 'callClaude') {
    const validationError = validateClaudePayload(message);
    if (validationError) {
      sendResponse({ error: validationError });
      return false;
    }

    const { apiKey, prompt } = message;

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    .then(async res => {
      if (!res.ok) {
        let err;
        try {
          err = await res.json();
        } catch {
          err = null;
        }
        sendResponse({ error: `API ${res.status} : ${err?.error?.message || res.statusText}` });
        return null;
      }
      return res.json();
    })
    .then(data => {
      if (!data) return;
      const text = data.content?.find(b => b.type === 'text')?.text;
      sendResponse({ text: text || null, error: text ? null : 'Contenu vide dans la réponse API' });
    })
    .catch(err => {
      sendResponse({ error: err.message });
    });

    return true; // garder le canal ouvert pour la réponse async
  }
});
