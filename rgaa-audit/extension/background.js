// background.js — v0.2.1
// Ajout : relai appel Claude API (contourne CORS extension Chrome MV3)

'use strict';

chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // ── Relai audit DOM ──
  if (message.action === 'getAuditResults') {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'runAudit' }, response => {
        sendResponse(response);
      });
    });
    return true;
  }

  // ── Relai appel Claude API ──
  // Le background service worker n'a pas les restrictions CORS du popup
  if (message.action === 'callClaude') {
    const { apiKey, prompt } = message;

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => {
          sendResponse({ error: `API ${res.status} : ${err?.error?.message || res.statusText}` });
        });
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
