// background.js
// Injecte le moteur partagé dans l'onglet actif et renvoie le rapport au panneau.
// Aucune donnée ne quitte le navigateur : tout s'exécute dans la page courante.

'use strict';

const ENGINE_FILE = 'shared/rgaa-rules.js';
const MAX_SELECTOR_LENGTH = 512;
const GUIDE_PORT = 'rgaa-guide';

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs.length ? tabs[0] : null;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSafeAction(action) {
  return action === 'getAuditResults' || action === 'highlightElement';
}

function isValidReportShape(report) {
  return Boolean(isPlainObject(report)
    && Array.isArray(report.results)
    && isPlainObject(report.score));
}

function createFallbackReport(report) {
  return {
    results: [],
    score: { taux: 0, conformes: 0, nonConformes: 0, aVerifier: 0, na: 0, total: 0, criteria: {} },
    url: typeof report?.url === 'string' ? report.url : '',
    timestamp: typeof report?.timestamp === 'string' ? report.timestamp : new Date().toISOString(),
    internalErrors: [
      ...(Array.isArray(report?.internalErrors) ? report.internalErrors : []),
      {
        section: 'background-validation',
        message: 'Structure de rapport invalide reçue depuis la page.',
      },
    ],
  };
}

function explainInjectionError(error) {
  const message = String(error?.message || error || '');
  if (/cannot be scripted|cannot access|chrome:\/\/|extensions gallery|webstore/i.test(message)) {
    return 'Cette page est protégée par le navigateur (pages chrome://, Chrome Web Store, PDF intégré…) : l’audit y est impossible.';
  }
  return message || 'Injection impossible dans cette page.';
}

async function runAuditInTab(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: [ENGINE_FILE] });
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => globalThis.RgaaRules.runAudit(),
    });
    const report = injection ? injection.result : null;
    return isValidReportShape(report) ? report : createFallbackReport(report);
  } catch (error) {
    throw new Error(explainInjectionError(error));
  }
}

/** Fait défiler jusqu'à l'élément et l'entoure brièvement (exécuté dans la page). */
function highlightInPage(selector) {
  let el = null;
  try {
    el = document.querySelector(selector);
  } catch {
    return false;
  }
  if (!el) return false;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const previous = el.style.outline;
  const previousOffset = el.style.outlineOffset;
  el.style.outline = '4px solid #FF00AA';
  el.style.outlineOffset = '2px';
  setTimeout(() => {
    el.style.outline = previous;
    el.style.outlineOffset = previousOffset;
  }, 2500);
  return true;
}

async function highlightInTab(tabId, selector) {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: highlightInPage,
    args: [selector],
  });
  return Boolean(injection && injection.result);
}

/** Retire les surimpressions du guide (exécuté dans la page). */
function clearGuideOverlays() {
  if (globalThis.RgaaGuidePage) globalThis.RgaaGuidePage.clear();
  const overlay = document.getElementById('rgaa-guide-overlay');
  if (overlay) overlay.remove();
  const grayscale = document.getElementById('rgaa-guide-grayscale');
  if (grayscale) grayscale.remove();
  return true;
}

/**
 * Le panneau latéral ne peut pas nettoyer la page pendant sa propre fermeture : il garde
 * une connexion ouverte avec le service worker, qui retire les surimpressions de l'onglet
 * suivi dès que cette connexion se coupe (panneau fermé).
 */
function onGuideConnect(port) {
  if (!port || port.name !== GUIDE_PORT) return;
  if (port.sender && port.sender.id && port.sender.id !== chrome.runtime.id) return;
  let tabId = null;
  port.onMessage.addListener((message) => {
    if (isPlainObject(message) && Number.isInteger(message.tabId)) tabId = message.tabId;
  });
  port.onDisconnect.addListener(() => {
    if (tabId === null) return;
    chrome.scripting.executeScript({ target: { tabId }, func: clearGuideOverlays }).catch(() => {});
  });
}

chrome.runtime.onConnect.addListener(onGuideConnect);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isPlainObject(message) || !isSafeAction(message.action)) {
    sendResponse({ success: false, error: 'Action non autorisée.' });
    return false;
  }
  if (sender && sender.id && sender.id !== chrome.runtime.id) {
    sendResponse({ success: false, error: 'Émetteur non autorisé.' });
    return false;
  }

  (async () => {
    try {
      const tab = await getActiveTab();
      if (!tab?.id) {
        sendResponse({ success: false, error: 'Aucun onglet actif détecté.' });
        return;
      }
      if (message.action === 'getAuditResults') {
        const report = await runAuditInTab(tab.id);
        sendResponse({ success: true, report });
        return;
      }
      const selector = typeof message.selector === 'string' ? message.selector : '';
      if (!selector || selector.length > MAX_SELECTOR_LENGTH) {
        sendResponse({ success: false, error: 'Sélecteur invalide.' });
        return;
      }
      sendResponse({ success: await highlightInTab(tab.id, selector) });
    } catch (e) {
      sendResponse({ success: false, error: e.message || String(e) });
    }
  })();

  return true;
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isPlainObject,
    isSafeAction,
    isValidReportShape,
    createFallbackReport,
    explainInjectionError,
    highlightInPage,
    onGuideConnect,
    clearGuideOverlays,
  };
}
