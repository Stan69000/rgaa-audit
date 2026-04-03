// src/browser.js
'use strict';

async function createBrowser({ headless = true } = {}) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'fr-FR',
    userAgent: 'Mozilla/5.0 (compatible; RGAA-Audit-Bot/0.1)',
  });
  const page = await context.newPage();

  // Ignorer les erreurs non-critiques (analytics, tracking…)
  page.on('pageerror', () => {});
  page.on('requestfailed', () => {});

  return { browser, page, context };
}

async function closeBrowser(browser) {
  try { await browser.close(); } catch {}
}

module.exports = { createBrowser, closeBrowser };
