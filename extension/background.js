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

function waitForTabComplete(tabId, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error('Timeout de chargement de la page.'));
    }, timeoutMs);

    function onUpdated(updatedTabId, info) {
      if (updatedTabId !== tabId) return;
      if (info.status !== 'complete') return;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

function normalizeUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    if (u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1) || '/';
    return u.href;
  } catch {
    return '';
  }
}

function detectSectionPrefix(pathname) {
  const path = String(pathname || '/');
  const segments = path.split('/').filter(Boolean);
  if (!segments.length) return '';
  return `/${segments[0]}`;
}

function isPageLike(url) {
  return !/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|xml)$/i.test(url);
}

function computeScore(results = []) {
  const byCriterion = {};
  for (const r of results) {
    if (!r?.id) continue;
    if (!byCriterion[r.id]) byCriterion[r.id] = [];
    byCriterion[r.id].push(r.status);
  }

  let conformes = 0;
  let nonConformes = 0;
  let na = 0;
  for (const statuses of Object.values(byCriterion)) {
    if (statuses.includes('NC')) nonConformes++;
    else if (statuses.every((s) => s === 'NA')) na++;
    else conformes++;
  }

  const applicable = conformes + nonConformes;
  return {
    taux: applicable > 0 ? Math.round((conformes / applicable) * 100) : 0,
    conformes,
    nonConformes,
    na,
    total: Object.keys(byCriterion).length,
  };
}

async function collectInternalLinks(tabId) {
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => Array.from(document.querySelectorAll('a[href]'))
      .map((a) => a.getAttribute('href') || '')
      .filter(Boolean)
      .map((href) => new URL(href, location.href).href),
  });
  return Array.isArray(result) ? result : [];
}

function mergePageResults(pageReport, pageUrl, pageTitle) {
  const sourceResults = Array.isArray(pageReport?.results) ? pageReport.results : [];
  return sourceResults.map((r) => ({
    ...r,
    pageUrl,
    pageTitle: pageTitle || pageUrl,
  }));
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

async function runSinglePageAudit(tab) {
  return injectAndRunAudit(tab.id);
}

async function runMultiPageAudit(tab, depthRaw) {
  const tabId = tab.id;
  const startUrl = normalizeUrl(tab.url || '');
  const maxPages = Math.max(1, Math.min(20, Number(depthRaw) || 5));
  const startParsed = new URL(startUrl);
  const sectionPrefix = detectSectionPrefix(startParsed.pathname);
  const sameOrigin = (u) => {
    try {
      return new URL(u).origin === startParsed.origin;
    } catch {
      return false;
    }
  };
  const inSameSection = (u) => {
    if (!sectionPrefix) return true;
    try {
      const p = new URL(u).pathname || '/';
      return p === sectionPrefix || p.startsWith(`${sectionPrefix}/`);
    } catch {
      return false;
    }
  };

  const unique = new Set([startUrl]);
  const queue = [startUrl];

  while (queue.length && unique.size < maxPages) {
    const current = queue.shift();
    try {
      await chrome.tabs.update(tabId, { url: current });
      await waitForTabComplete(tabId, 45000);
      const links = await collectInternalLinks(tabId);
      for (const raw of links) {
        const normalized = normalizeUrl(raw);
        if (!normalized || unique.size >= maxPages) continue;
        if (!sameOrigin(normalized) || !inSameSection(normalized) || !isPageLike(normalized)) continue;
        if (unique.has(normalized)) continue;
        unique.add(normalized);
        queue.push(normalized);
      }
    } catch {
      // Ignore link discovery failures; page-level errors are handled during audit phase.
    }
  }

  const targets = Array.from(unique).slice(0, maxPages);
  const pages = [];
  const pagesSkipped = [];
  const allResults = [];

  for (const target of targets) {
    try {
      await chrome.tabs.update(tabId, { url: target });
      await waitForTabComplete(tabId, 45000);
      const pageReport = await injectAndRunAudit(tabId);
      const pageTitle = pageReport.title || pageReport.pageTitle || target;
      const pageResults = mergePageResults(pageReport, target, pageTitle);
      const pageScore = computeScore(pageResults);

      allResults.push(...pageResults);
      pages.push({
        url: target,
        title: pageTitle,
        score: pageScore,
        nonConformes: pageScore.nonConformes,
        conformes: pageScore.conformes,
      });
    } catch (err) {
      pagesSkipped.push({
        url: target,
        reason: /Timeout/i.test(String(err?.message || '')) ? 'timeout' : 'navigation error',
      });
    }
  }

  // Restore user tab to start URL after crawl.
  try {
    await chrome.tabs.update(tabId, { url: startUrl });
  } catch {}

  const score = computeScore(allResults);
  return {
    url: startUrl,
    title: pages[0]?.title || startUrl,
    timestamp: new Date().toISOString(),
    pagesAudited: pages.length,
    pages,
    pagesSkipped,
    score,
    results: allResults,
  };
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

        const mode = message.mode === 'multi' ? 'multi' : 'single';
        const depth = Math.max(1, Math.min(20, Number(message.depth) || 5));
        const report = mode === 'multi'
          ? await runMultiPageAudit(tab, depth)
          : await runSinglePageAudit(tab);

        sendResponse({ success: true, report });
      } catch (e) {
        sendResponse({ success: false, error: e.message || String(e) });
      }
    })();

    return true;
  }
});
