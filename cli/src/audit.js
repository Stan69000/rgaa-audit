/**
 * src/audit.js — Orchestrateur principal
 * Coordonne : browser → simulator → rules → reporter
 */

'use strict';

const { createBrowser, closeBrowser } = require('./browser');
const { simulateHumanActions }        = require('./simulator');
const { runDomRules }                  = require('./rules');
const { generateReport }               = require('./reporters');
const { log, success, warn }           = require('./logger');

async function runAudit(url, opts = {}) {
  const {
    output   = 'json',
    save     = '',
    vulgarizedSave = '',
    simulate = true,
    depth    = 1,
    headless = true,
  } = opts;

  log(`\n♿  RGAA Audit CLI — ${url}\n`);

  const startTime = Date.now();
  let browser, page;
  const navigationProfile = {
    preferDomContentLoadedOrigins: new Set(),
    warnedOrigins: new Set(),
  };

  try {
    // ── 1. NAVIGATEUR ────────────────────────
    log('🌐 Lancement du navigateur…');
    ({ browser, page } = await createBrowser({ headless }));

    log(`📄 Chargement de ${url}…`);
    await navigateWithFallback(page, url, navigationProfile);
    await page.waitForTimeout(1000);

    const rootTitle = await page.title();
    success(`   Titre : "${rootTitle}"`);

    // ── 2. SÉLECTION DES PAGES À AUDITER ─────
    const targets = await buildAuditTargets(page, url, depth);
    if (targets.length > 1) {
      success(`   Pages retenues pour audit : ${targets.length}`);
    }

    // ── 3. AUDIT DES PAGES ────────────────────
    const allResults = [];
    const pages = [];
    const pagesSkipped = [];
    let simulationResults = null;

    for (let i = 0; i < targets.length; i++) {
      const targetUrl = targets[i];
      const label = targets.length > 1 ? ` (${i + 1}/${targets.length})` : '';
      log(`\n🔍 Audit DOM (règles RGAA 4.1)${label} — ${targetUrl}`);

      try {
        if (i > 0) {
          await navigateWithFallback(page, targetUrl, navigationProfile);
          await page.waitForTimeout(500);
        }
      } catch (e) {
        const reason = normalizeSkipReason(e);
        warn(`   Page ignorée (${reason}) : ${targetUrl}`);
        pagesSkipped.push({ url: targetUrl, reason });
        continue;
      }

      let pageTitle = targetUrl;
      let domResults = [];
      try {
        pageTitle = await safePageTitle(page, targetUrl);
        domResults = (await runDomRules(page)).map((r) => ({
          ...r,
          pageUrl: targetUrl,
          pageTitle,
        }));
      } catch (e) {
        const reason = normalizeSkipReason(e);
        warn(`   Audit DOM impossible (${reason}) : ${targetUrl}`);
        pagesSkipped.push({ url: targetUrl, reason });
        continue;
      }

      let pageSimulation = null;
      if (simulate && i === 0) {
        log('\n⌨️  Simulation d\'actions humaines (page principale)…');
        pageSimulation = await simulateHumanActions(page);
        simulationResults = pageSimulation;
      }

      const pageResults = mergeResults(domResults, pageSimulation, targetUrl, pageTitle);
      const pageScore = computeScore(pageResults);

      allResults.push(...pageResults);
      pages.push({
        url: targetUrl,
        title: pageTitle,
        score: pageScore,
        nonConformes: pageScore.nonConformes,
        conformes: pageScore.conformes,
      });
    }

    // ── 4. SCORE GLOBAL ───────────────────────
    const score = computeScore(allResults);
    printSummary(score, rootTitle, url, pages.length);

    // ── 5. RAPPORT ────────────────────────────
    const report = {
      url,
      title: rootTitle,
      timestamp: new Date().toISOString(),
      duration: Math.round((Date.now() - startTime) / 1000),
      requestedDepth: Math.max(1, Number(depth) || 1),
      pagesAudited: pages.length,
      pages,
      pagesSkipped,
      score,
      results: allResults,
      simulation: simulationResults?.summary || null,
    };

    const output_str = await generateReport(report, output);
    const fs = require('node:fs');

    if (save) {
      fs.writeFileSync(save, output_str, 'utf8');
      success(`\n📁 Rapport sauvegardé : ${save}`);
    } else {
      console.log('\n' + output_str);
    }

    if (vulgarizedSave) {
      const vulgarized = await generateReport(report, 'vulgarized');
      fs.writeFileSync(vulgarizedSave, vulgarized, 'utf8');
      success(`📄 Rapport vulgarisé sauvegardé : ${vulgarizedSave}`);
    }

    return report;

  } finally {
    if (browser) await closeBrowser(browser);
  }
}

function mergeResults(domResults, simResults, pageUrl, pageTitle) {
  const all = [...domResults];
  if (simResults?.findings) {
    all.push(
      ...simResults.findings.map((finding) => ({
        ...finding,
        pageUrl: finding.pageUrl || pageUrl,
        pageTitle: finding.pageTitle || pageTitle,
      })),
    );
  }
  return all;
}

function computeScore(results) {
  const byCriterion = {};
  results.forEach(r => {
    if (!byCriterion[r.id]) byCriterion[r.id] = [];
    byCriterion[r.id].push(r.status);
  });

  let conformes = 0, nonConformes = 0, na = 0;
  Object.entries(byCriterion).forEach(([, statuses]) => {
    if (statuses.includes('NC')) nonConformes++;
    else if (statuses.every(s => s === 'NA')) na++;
    else conformes++;
  });

  const applicable = conformes + nonConformes;
  return {
    taux: applicable > 0 ? Math.round((conformes / applicable) * 100) : 0,
    conformes,
    nonConformes,
    na,
    total: Object.keys(byCriterion).length,
  };
}

function printSummary(score, title, url, pagesAudited = 1) {
  const bar = '█'.repeat(Math.round(score.taux / 5)) + '░'.repeat(20 - Math.round(score.taux / 5));
  const color = score.taux >= 75 ? '\x1b[32m' : score.taux >= 50 ? '\x1b[33m' : '\x1b[31m';
  const reset = '\x1b[0m';

  console.log(`
${color}┌─────────────────────────────────────────┐
│  Taux de conformité : ${String(score.taux + '%').padEnd(5)}  ${bar} │
│  Conformes    : ${String(score.conformes).padEnd(4)} critères             │
│  Non conformes: ${String(score.nonConformes).padEnd(4)} critères             │
│  N/A          : ${String(score.na).padEnd(4)} critères             │
│  Pages auditées: ${String(pagesAudited).padEnd(4)}                    │
└─────────────────────────────────────────┘${reset}
  `);
}

async function buildAuditTargets(page, startUrl, depth) {
  const maxPages = Math.max(1, Number(depth) || 1);
  if (maxPages === 1) return [startUrl];

  const base = new URL(startUrl);
  const sectionPrefix = detectSectionPrefix(base.pathname);
  const sameOrigin = (u) => {
    try {
      const parsed = new URL(u);
      return parsed.origin === base.origin;
    } catch {
      return false;
    }
  };
  const inSameSection = (u) => {
    if (!sectionPrefix) return true;
    try {
      const parsed = new URL(u);
      const path = parsed.pathname || '/';
      return path === sectionPrefix || path.startsWith(`${sectionPrefix}/`);
    } catch {
      return false;
    }
  };

  const normalize = (u) => {
    try {
      const parsed = new URL(u, base.href);
      parsed.hash = '';
      if (parsed.pathname.endsWith('/')) parsed.pathname = parsed.pathname.slice(0, -1) || '/';
      return parsed.href;
    } catch {
      return '';
    }
  };

  const isPageLike = (u) => !/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|xml)$/i.test(u);
  const unique = new Set([normalize(startUrl)]);
  const addMany = (urls = []) => {
    for (const raw of urls) {
      const n = normalize(raw);
      if (!n || unique.size >= maxPages) continue;
      if (!sameOrigin(n) || !inSameSection(n) || !isPageLike(n)) continue;
      unique.add(n);
    }
  };

  addMany(await fetchSitemapUrls(base));
  if (unique.size < maxPages) addMany(await collectInternalLinks(page));

  return Array.from(unique).slice(0, maxPages);
}

function detectSectionPrefix(pathname) {
  const path = String(pathname || '/');
  const segments = path.split('/').filter(Boolean);
  if (!segments.length) return '';
  return `/${segments[0]}`;
}

async function fetchSitemapUrls(baseUrl) {
  const sitemapUrl = `${baseUrl.origin}/sitemap.xml`;
  try {
    const res = await fetch(sitemapUrl, { method: 'GET' });
    if (!res.ok) return [];
    const xml = await res.text();
    const urls = [];
    const re = /<loc>(.*?)<\/loc>/gims;
    let m;
    while ((m = re.exec(xml)) !== null) {
      urls.push((m[1] || '').trim());
    }
    return urls;
  } catch {
    return [];
  }
}

async function collectInternalLinks(page) {
  try {
    return await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]'))
        .map((a) => a.getAttribute('href') || '')
        .filter(Boolean)
        .map((href) => new URL(href, location.href).href),
    );
  } catch {
    return [];
  }
}

async function safePageTitle(page, fallback) {
  try {
    return await page.title();
  } catch {
    return fallback;
  }
}

function normalizeSkipReason(err) {
  const msg = String(err?.message || err || '').replace(/\s+/g, ' ').trim();
  if (/Timeout/i.test(msg)) return 'timeout';
  if (/ERR_|net::|Navigation/i.test(msg)) return 'navigation error';
  return 'unexpected error';
}

async function navigateWithFallback(page, url, profile = {}) {
  const origin = safeOrigin(url);
  const preferDomContentLoadedOrigins = profile.preferDomContentLoadedOrigins || new Set();
  const warnedOrigins = profile.warnedOrigins || new Set();

  if (origin && preferDomContentLoadedOrigins.has(origin)) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    return;
  }

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 8000 });
    return;
  } catch (err) {
    const isTimeout = /Timeout/i.test(String(err?.message || err || ''));
    if (!isTimeout) throw err;

    if (origin) preferDomContentLoadedOrigins.add(origin);
    if (origin && !warnedOrigins.has(origin)) {
      warn('   networkidle instable sur ce domaine, navigation basculée en domcontentloaded');
      warnedOrigins.add(origin);
    }
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  }
}

function safeOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

module.exports = { runAudit, computeScore };
