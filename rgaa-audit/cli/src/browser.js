/**
 * src/browser.js — Playwright wrapper v0.2.0
 * Ajout : support SPA (attente hydration JS)
 */
'use strict';

async function createBrowser({ headless = true } = {}) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'fr-FR',
    userAgent: 'Mozilla/5.0 (compatible; RGAA-Audit-Bot/0.2)',
  });
  const page = await context.newPage();
  page.on('pageerror', () => {});
  page.on('requestfailed', () => {});
  return { browser, page, context };
}

/**
 * Charge une page avec support SPA :
 * 1. Attend networkidle (chargement initial)
 * 2. Attend que le DOM se stabilise (mutations MutationObserver)
 * 3. Timeout configurable pour les SPA lentes
 */
async function loadPage(page, url, opts = {}) {
  const { waitFor = 'networkidle', extraWait = 1500, timeout = 30000 } = opts;
  const { log, warn } = require('./logger');

  log(`   Chargement ${url}…`);

  try {
    await page.goto(url, { waitUntil: waitFor, timeout });
  } catch (e) {
    // networkidle peut timeout sur des pages avec polling — fallback sur domcontentloaded
    if (e.message.includes('Timeout')) {
      warn('   networkidle timeout — fallback sur domcontentloaded');
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    } else throw e;
  }

  // Attendre la stabilisation du DOM (SPA : React/Vue/Angular hydration)
  await waitForDomStability(page, extraWait);

  // Scroll pour déclencher le lazy-loading
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
}

/**
 * Attend que le DOM ne change plus pendant `stableMs` millisecondes
 * Utile pour les SPA qui hydratent après le chargement initial
 */
async function waitForDomStability(page, maxWait = 2000) {
  const stableMs = 300;
  const start = Date.now();

  try {
    await page.evaluate((stableMs) => {
      return new Promise(resolve => {
        let timer = null;
        const reset = () => {
          clearTimeout(timer);
          timer = setTimeout(resolve, stableMs);
        };
        const observer = new MutationObserver(reset);
        observer.observe(document.body || document.documentElement, {
          childList: true, subtree: true, attributes: true,
        });
        reset(); // démarrer le timer initial
        // Timeout de sécurité
        setTimeout(() => { observer.disconnect(); resolve(); }, 4000);
      });
    }, stableMs);
  } catch {
    // Si evaluate échoue (page déchargée), on continue
  }
}

async function closeBrowser(browser) {
  try { await browser.close(); } catch {}
}

module.exports = { createBrowser, closeBrowser, loadPage };
