/**
 * src/audit.js — Orchestrateur principal
 * Coordonne : browser → simulator → rules → reporter
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { createBrowser, closeBrowser } = require('./browser');
const { simulateHumanActions } = require('./simulator');
const { runDomRules } = require('./rules');
const { generateReport } = require('./reporters');
const { fillRgaaGridFromReports } = require('./reporters/ods-grid');
const { log, success, warn } = require('./logger');

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const EXPLICITLY_BLOCKED_PROTOCOLS = new Set(['file:', 'data:', 'javascript:']);
const TRACKING_PARAM_PREFIXES = ['utm_'];
const TRACKING_PARAMS = new Set(['gclid', 'fbclid', 'mc_cid', 'mc_eid', '_hsenc', '_hsmi', 'pk_campaign', 'pk_kwd']);
const PARASITIC_PATH_PATTERNS = [/(?:^|\/)cdn-cgi\//i, /(?:^|\/)track(?:ing)?(?:\/|$)/i, /(?:^|\/)analytics(?:\/|$)/i];

const DEFAULT_MAX_PAGES = 100;
const SAFE_CRAWL_MAX_PAGES = 20;
const MAX_LINK_CANDIDATES = 2500;
const MAX_SITEMAP_BYTES = 2 * 1024 * 1024;

async function runAudit(url, opts = {}) {
  const {
    output = 'json',
    save = '',
    vulgarizedSave = '',
    odsTemplate = '',
    odsSave = '',
    odsReplicateAllSheets = false,
    simulate = true,
    depth = 1,
    headless = true,
    outputDir = '',
    debug = false,
    verbose = false,
    safeCrawl = false,
    strictSecurity = false,
  } = opts;

  const debugEnabled = Boolean(debug || verbose);
  const safeCrawlEnabled = Boolean(safeCrawl || strictSecurity);
  const debugLog = createDebugLogger(debugEnabled);

  const auditedUrl = validateAuditUrl(url, { safeCrawl: safeCrawlEnabled });
  const resolvedSave = resolveOutputPath(save, { outputDir });
  const resolvedVulgarizedSave = resolveOutputPath(vulgarizedSave, { outputDir });
  const resolvedOdsTemplate = odsTemplate ? path.resolve(odsTemplate) : '';
  const resolvedOdsSave = resolveOutputPath(odsSave, { outputDir });

  log(`\n♿  RGAA Audit CLI — ${auditedUrl}\n`);

  const startTime = Date.now();
  let browser;
  let page;
  const navigationProfile = {
    preferDomContentLoadedOrigins: new Set(),
    warnedOrigins: new Set(),
  };
  const browserDebugEvents = [];

  try {
    // ── 1. NAVIGATEUR ────────────────────────
    log('🌐 Lancement du navigateur…');
    ({ browser, page } = await createBrowser({
      headless,
      debug: debugEnabled,
      onDebugEvent: (event) => {
        if (browserDebugEvents.length >= 200) return;
        browserDebugEvents.push(event);
      },
    }));

    log(`📄 Chargement de ${auditedUrl}…`);
    await navigateWithFallback(page, auditedUrl, navigationProfile, debugLog);
    await page.waitForTimeout(1000);

    const rootTitle = await page.title();
    success(`   Titre : "${rootTitle}"`);

    // ── 2. SÉLECTION DES PAGES À AUDITER ─────
    const targetPlan = await buildAuditTargets(page, auditedUrl, {
      depth,
      safeCrawl: safeCrawlEnabled,
      debugLog,
    });

    if (targetPlan.requestedDepth > targetPlan.maxPages) {
      debugLog(`Profondeur demandée (${targetPlan.requestedDepth}) limitée à ${targetPlan.maxPages}`);
    }

    const targets = targetPlan.targets;
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
          await navigateWithFallback(page, targetUrl, navigationProfile, debugLog);
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
    const transparency = summarizeResultQualification(allResults);
    printSummary(score, rootTitle, auditedUrl, pages.length, transparency);

    // ── 5. RAPPORT ────────────────────────────
    const report = {
      url: auditedUrl,
      title: rootTitle,
      timestamp: new Date().toISOString(),
      duration: Math.round((Date.now() - startTime) / 1000),
      requestedDepth: Math.max(1, Number(depth) || 1),
      pagesAudited: pages.length,
      pages,
      pagesSkipped,
      score,
      transparency,
      results: allResults,
      simulation: simulationResults?.summary || null,
    };

    if (debugEnabled) {
      report.debug = {
        browserEvents: browserDebugEvents,
        crawlIgnored: targetPlan.ignored,
        safeCrawl: safeCrawlEnabled,
      };
    }

    if (resolvedOdsTemplate && resolvedOdsSave) {
      const perPageReports = buildPerPageReports(report);
      const odsResult = fillRgaaGridFromReports({
        reports: perPageReports,
        templatePath: resolvedOdsTemplate,
        outputPath: resolvedOdsSave,
        replicateToAllSheets: !!odsReplicateAllSheets,
      });
      const resolvedOdsPath = path.resolve(odsResult.outputPath);
      report.ods = {
        outputPath: resolvedOdsPath,
        filledSheets: odsResult.filledSheets,
        filledCriteria: odsResult.filledCriteria,
      };
      success(`📊 Grille ODS sauvegardée : ${resolvedOdsPath}`);
    } else if (resolvedOdsTemplate || resolvedOdsSave) {
      warn('   Export ODS ignoré: fournir --ods-template et --ods-save ensemble.');
    }

    const outputStr = await generateReport(report, output);

    if (resolvedSave) {
      safeWriteReport(resolvedSave, outputStr);
      success(`\n📁 Rapport sauvegardé : ${resolvedSave}`);
    } else {
      console.log('\n' + outputStr);
    }

    if (resolvedVulgarizedSave) {
      const reportForVulgarized = attachOdsDownloadPayload(report);
      const vulgarized = await generateReport(reportForVulgarized, 'vulgarized');
      safeWriteReport(resolvedVulgarizedSave, vulgarized);
      success(`📄 Rapport vulgarisé sauvegardé : ${resolvedVulgarizedSave}`);
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

function buildPerPageReports(report) {
  const pages = Array.isArray(report.pages) ? report.pages : [];
  const byPage = new Map();
  for (const result of report.results || []) {
    const pageUrl = result?.pageUrl || report.url || '';
    if (!byPage.has(pageUrl)) byPage.set(pageUrl, []);
    byPage.get(pageUrl).push(result);
  }

  return pages
    .map((p) => ({
      title: p.title || p.url || 'Page',
      url: p.url || '',
      results: byPage.get(p.url || '') || [],
    }))
    .filter((p) => p.results.length > 0);
}

function attachOdsDownloadPayload(report) {
  if (!report?.ods?.outputPath) return report;
  try {
    const bytes = fs.readFileSync(report.ods.outputPath);
    return {
      ...report,
      odsDownload: {
        fileName: path.basename(report.ods.outputPath) || 'rgaa-grille.ods',
        mimeType: 'application/vnd.oasis.opendocument.spreadsheet',
        base64: bytes.toString('base64'),
      },
    };
  } catch (err) {
    warn(`   Impossible d’intégrer le téléchargement ODS dans le rapport vulgarisé: ${err.message}`);
    return report;
  }
}

function computeScore(results) {
  const byCriterion = {};
  results.forEach((r) => {
    if (!byCriterion[r.id]) byCriterion[r.id] = [];
    byCriterion[r.id].push(r.status || statusFromResultType(r.resultType));
  });

  let conformes = 0;
  let nonConformes = 0;
  let na = 0;
  Object.entries(byCriterion).forEach(([, statuses]) => {
    if (statuses.includes('NC')) nonConformes++;
    else if (statuses.every((s) => s === 'NA')) na++;
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

function summarizeResultQualification(results = []) {
  const output = {
    method: {
      automaticChecks: 'Contrôles techniques automatiques sur le DOM et quelques interactions.',
      heuristicChecks: 'Signaux probables mais contextuels. Ils peuvent contenir des faux positifs.',
      manualChecks: 'Points nécessitant une vérification humaine (contexte, pertinence, parcours réels).',
    },
    disclaimers: [
      'Ce rapport est un pré-audit automatique basé sur le RGAA 4.1.',
      'Le score est un indicateur de progression technique, non une conformité RGAA certifiée.',
    ],
    resultTypeCounts: {},
    confidenceCounts: {},
    severityCounts: {},
    manualReviewRecommendedCount: 0,
    totalFindings: 0,
  };

  for (const result of results) {
    output.totalFindings++;
    const resultType = String(result?.resultType || 'unknown');
    const confidence = String(result?.confidence || 'unknown');
    const severity = String(result?.severity || 'unknown');

    output.resultTypeCounts[resultType] = (output.resultTypeCounts[resultType] || 0) + 1;
    output.confidenceCounts[confidence] = (output.confidenceCounts[confidence] || 0) + 1;
    output.severityCounts[severity] = (output.severityCounts[severity] || 0) + 1;
    if (result?.manualReviewRecommended) output.manualReviewRecommendedCount++;
  }

  return output;
}

function printSummary(score, title, url, pagesAudited = 1, transparency = null) {
  const bar = '█'.repeat(Math.round(score.taux / 5)) + '░'.repeat(20 - Math.round(score.taux / 5));
  const color = score.taux >= 75 ? '\x1b[32m' : score.taux >= 50 ? '\x1b[33m' : '\x1b[31m';
  const reset = '\x1b[0m';
  const stripAnsi = (value) => String(value).replace(/\x1B\[[0-9;]*m/g, '');

  const lines = [
    `  Score technique détectable : ${String(score.taux + '%').padEnd(5)}  ${bar}`,
    `  Conformes    : ${String(score.conformes).padEnd(4)} critères`,
    `  Non conformes: ${String(score.nonConformes).padEnd(4)} critères`,
    `  N/A          : ${String(score.na).padEnd(4)} critères`,
    `  Pages auditées: ${String(pagesAudited).padEnd(4)}`,
  ];
  const innerWidth = Math.max(...lines.map((line) => stripAnsi(line).length));
  const framed = [`┌${'─'.repeat(innerWidth)}┐`, ...lines.map((line) => `│${line.padEnd(innerWidth)}│`), `└${'─'.repeat(innerWidth)}┘`].join('\n');

  console.log(`
${color}${framed}${reset}
  Indicateur technique automatique (non équivalent à une conformité RGAA).
  `);

  if (!transparency) return;

  const typeCounts = transparency.resultTypeCounts || {};
  const confidenceCounts = transparency.confidenceCounts || {};
  const severityCounts = transparency.severityCounts || {};

  const formatCounts = (counts) => Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => `${key}:${value}`)
    .join(' · ') || 'aucun';

  console.log(`  Types de résultats : ${formatCounts(typeCounts)}`);
  console.log(`  Niveaux confiance  : ${formatCounts(confidenceCounts)}`);
  console.log(`  Gravité            : ${formatCounts(severityCounts)}`);
  console.log(`  Vérif. manuelle recommandée: ${transparency.manualReviewRecommendedCount}/${transparency.totalFindings}`);
}

function statusFromResultType(resultType) {
  if (resultType === 'good_signal') return 'C';
  if (resultType === 'manual_only') return 'NA';
  return 'NC';
}

function createDebugLogger(enabled, sink = log) {
  return (message) => {
    if (!enabled) return;
    sink(`   [debug] ${message}`);
  };
}

function isAllowedProtocol(protocol) {
  return ALLOWED_PROTOCOLS.has(String(protocol || '').toLowerCase());
}

function validateAuditUrl(input, { safeCrawl = false } = {}) {
  let parsed;
  try {
    parsed = new URL(String(input || '').trim());
  } catch {
    throw new Error('URL invalide: fournir une URL absolue (http:// ou https://).');
  }

  const protocol = parsed.protocol.toLowerCase();
  if (EXPLICITLY_BLOCKED_PROTOCOLS.has(protocol)) {
    throw new Error(`Schéma interdit pour des raisons de sécurité: ${protocol}`);
  }
  if (!isAllowedProtocol(protocol)) {
    throw new Error(`Schéma non supporté: ${protocol}. Seuls http: et https: sont autorisés.`);
  }

  if (!parsed.hostname) {
    throw new Error('URL invalide: hôte manquant.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('URL invalide: identifiants dans l’URL non autorisés.');
  }

  if (safeCrawl && parsed.search) {
    throw new Error('Mode safe-crawl: URL de départ avec paramètres de requête non autorisée.');
  }

  parsed.hash = '';
  return parsed.href;
}

function resolveDepthLimit(depth, { safeCrawl = false } = {}) {
  const requested = Math.max(1, Number(depth) || 1);
  const hardLimit = safeCrawl ? SAFE_CRAWL_MAX_PAGES : DEFAULT_MAX_PAGES;
  return Math.min(requested, hardLimit);
}

function resolveOutputPath(targetPath, { outputDir = '' } = {}) {
  if (!targetPath) return '';

  const candidate = String(targetPath);
  if (candidate.includes('\0')) {
    throw new Error('Chemin de sortie invalide.');
  }

  const baseDir = outputDir ? path.resolve(String(outputDir)) : process.cwd();
  return path.isAbsolute(candidate) ? path.resolve(candidate) : path.resolve(baseDir, candidate);
}

function safeWriteReport(filePath, content) {
  const dirPath = path.dirname(filePath);

  // Crée l’arborescence de sortie pour éviter les erreurs d’écriture implicites.
  fs.mkdirSync(dirPath, { recursive: true, mode: 0o750 });
  fs.writeFileSync(filePath, content, {
    encoding: 'utf8',
    mode: 0o600,
  });
}

async function buildAuditTargets(page, startUrl, options = {}) {
  const { depth = 1, safeCrawl = false, debugLog = () => {} } = options;

  const requestedDepth = Math.max(1, Number(depth) || 1);
  const maxPages = resolveDepthLimit(requestedDepth, { safeCrawl });
  if (maxPages === 1) {
    return {
      targets: [startUrl],
      ignored: [],
      requestedDepth,
      maxPages,
    };
  }

  const base = new URL(startUrl);
  const sectionPrefix = detectSectionPrefix(base.pathname);
  const unique = new Set([startUrl]);
  const ignored = [];

  const noteIgnored = (source, raw, reason) => {
    if (ignored.length >= 500) return;
    const entry = {
      source,
      reason,
      url: typeof raw === 'string' ? raw : String(raw || ''),
    };
    ignored.push(entry);
    debugLog(`URL ignorée [${source}] (${reason}) : ${entry.url}`);
  };

  const addMany = (urls = [], source = 'unknown') => {
    for (const raw of urls) {
      if (unique.size >= maxPages) break;
      const normalized = normalizeAuditTargetUrl(raw, {
        base,
        sectionPrefix,
        safeCrawl,
      });

      if (!normalized.ok) {
        noteIgnored(source, raw, normalized.reason);
        continue;
      }

      if (unique.has(normalized.value)) {
        continue;
      }
      unique.add(normalized.value);
    }
  };

  addMany(await fetchSitemapUrls(base, { safeCrawl, debugLog }), 'sitemap');
  if (unique.size < maxPages) addMany(await collectInternalLinks(page), 'dom-links');

  return {
    targets: Array.from(unique).slice(0, maxPages),
    ignored,
    requestedDepth,
    maxPages,
  };
}

function normalizeAuditTargetUrl(rawUrl, { base, sectionPrefix = '', safeCrawl = false } = {}) {
  const raw = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!raw) return { ok: false, reason: 'url vide' };

  let parsed;
  try {
    parsed = new URL(raw, base.href);
  } catch {
    return { ok: false, reason: 'url invalide' };
  }

  const protocol = parsed.protocol.toLowerCase();
  if (!isAllowedProtocol(protocol)) {
    return { ok: false, reason: `schéma non autorisé (${protocol})` };
  }

  if (parsed.origin !== base.origin) {
    return { ok: false, reason: 'origine externe' };
  }

  const pathname = parsed.pathname || '/';
  if (sectionPrefix && pathname !== sectionPrefix && !pathname.startsWith(`${sectionPrefix}/`)) {
    return { ok: false, reason: 'hors section cible' };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'identifiants dans url' };
  }

  if (isPageAsset(pathname)) {
    return { ok: false, reason: 'ressource non auditée' };
  }

  if (PARASITIC_PATH_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return { ok: false, reason: 'chemin parasite/tracking' };
  }

  parsed.hash = '';
  stripTrackingParams(parsed.searchParams);

  if (safeCrawl && parsed.search) {
    return { ok: false, reason: 'query refusée en safe-crawl' };
  }

  if (parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1) || '/';
  }

  const normalized = parsed.href;
  if (normalized.length > 2048) {
    return { ok: false, reason: 'url trop longue' };
  }

  return { ok: true, value: normalized };
}

function stripTrackingParams(searchParams) {
  for (const key of Array.from(searchParams.keys())) {
    const lower = key.toLowerCase();
    const isTrackingPrefix = TRACKING_PARAM_PREFIXES.some((prefix) => lower.startsWith(prefix));
    if (isTrackingPrefix || TRACKING_PARAMS.has(lower)) {
      searchParams.delete(key);
    }
  }
}

function isPageAsset(urlPath) {
  return /\.(?:pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|xml|webm|ico|woff2?|ttf|eot|css|js)(?:$|\?)/i.test(urlPath);
}

function detectSectionPrefix(pathname) {
  const urlPath = String(pathname || '/');
  const segments = urlPath.split('/').filter(Boolean);
  if (!segments.length) return '';
  return `/${segments[0]}`;
}

async function fetchSitemapUrls(baseUrl, { safeCrawl = false, debugLog = () => {} } = {}) {
  const sitemapUrl = `${baseUrl.origin}/sitemap.xml`;
  const timeoutMs = safeCrawl ? 3000 : 6000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(sitemapUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.1',
      },
    });

    if (!res.ok) {
      debugLog(`Sitemap ignoré (${res.status}) : ${sitemapUrl}`);
      return [];
    }

    const xml = await res.text();
    if (xml.length > MAX_SITEMAP_BYTES) {
      debugLog(`Sitemap trop volumineux (${xml.length} octets) : ${sitemapUrl}`);
      return [];
    }

    const urls = [];
    const re = /<loc>(.*?)<\/loc>/gims;
    const maxEntries = safeCrawl ? 300 : 1200;
    let match;
    while ((match = re.exec(xml)) !== null && urls.length < maxEntries) {
      urls.push((match[1] || '').trim());
    }

    return urls;
  } catch (err) {
    debugLog(`Sitemap inaccessible : ${sitemapUrl} (${String(err?.message || err)})`);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function collectInternalLinks(page) {
  try {
    return await page.evaluate((maxCandidates) =>
      Array.from(document.querySelectorAll('a[href]'))
        .map((a) => a.getAttribute('href') || '')
        .filter(Boolean)
        .slice(0, maxCandidates)
        .map((href) => {
          try {
            return new URL(href, location.href).href;
          } catch {
            return '';
          }
        })
        .filter(Boolean),
    MAX_LINK_CANDIDATES);
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
  const msg = String(err?.message || err || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (/Timeout/i.test(msg)) return 'timeout';
  if (/ERR_|net::|Navigation/i.test(msg)) return 'navigation error';
  return 'unexpected error';
}

async function navigateWithFallback(page, url, profile = {}, debugLog = () => {}) {
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
    debugLog(`Fallback navigation domcontentloaded activée pour ${url}`);
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

module.exports = {
  runAudit,
  computeScore,
  _internals: {
    createDebugLogger,
    isAllowedProtocol,
    validateAuditUrl,
    resolveDepthLimit,
    resolveOutputPath,
    safeWriteReport,
    normalizeAuditTargetUrl,
    stripTrackingParams,
    isPageAsset,
  },
};
