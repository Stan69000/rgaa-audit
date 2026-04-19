// src/browser.js
'use strict';

const { warn } = require('./logger');

function formatBrowserIssue(issue) {
  if (!issue) return '[browser] issue inconnue';
  if (issue.type === 'pageerror') {
    return `[browser][pageerror] ${issue.message || 'Erreur JavaScript inconnue'}`;
  }
  if (issue.type === 'requestfailed') {
    const method = issue.method || 'GET';
    const target = issue.url || '(url inconnue)';
    const failure = issue.failureText || 'échec réseau';
    return `[browser][requestfailed] ${method} ${target} — ${failure}`;
  }
  return `[browser][${issue.type || 'event'}] ${issue.message || 'événement navigateur'}`;
}

async function createBrowser({ headless = true, debug = false, onDebugEvent } = {}) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'fr-FR',
    userAgent: 'Mozilla/5.0 (compatible; RGAA-Audit-Bot/0.1)',
  });
  const page = await context.newPage();

  const emitDebugEvent = (payload) => {
    if (typeof onDebugEvent === 'function') onDebugEvent(payload);
    if (debug) warn(`   ${formatBrowserIssue(payload)}`);
  };

  // On capte les incidents navigateur sans polluer la sortie standard.
  page.on('pageerror', (error) => {
    emitDebugEvent({
      type: 'pageerror',
      message: String(error?.message || error || '').trim(),
    });
  });

  page.on('requestfailed', (request) => {
    emitDebugEvent({
      type: 'requestfailed',
      url: request?.url?.() || '',
      method: request?.method?.() || '',
      failureText: request?.failure?.()?.errorText || '',
    });
  });

  return { browser, page, context };
}

async function closeBrowser(browser) {
  try { await browser.close(); } catch {}
}

module.exports = { createBrowser, closeBrowser, formatBrowserIssue };
