/**
 * src/audit.js — Orchestrateur v0.2.0
 * Support SPA via loadPage()
 */
'use strict';

const { createBrowser, closeBrowser, loadPage } = require('./browser');
const { simulateHumanActions }                  = require('./simulator');
const { runDomRules }                            = require('./rules');
const { analyzeWithClaude }                      = require('./ai/claude-analysis');
const { generateReport }                         = require('./reporters');
const { log, success, warn, error }              = require('./logger');

async function runAudit(url, opts = {}) {
  const {
    output   = 'json',
    save     = '',
    simulate = true,
    depth    = 1,
    apiKey   = '',
    headless = true,
    waitFor  = 'networkidle',   // ✅ NOUVEAU : configurable pour SPA
    extraWait = 1500,           // ✅ NOUVEAU : délai hydration SPA
  } = opts;

  log(`\n♿  RGAA Audit CLI v0.2.0 — ${url}\n`);
  const startTime = Date.now();
  let browser, page;

  try {
    log('🌐 Lancement du navigateur…');
    ({ browser, page } = await createBrowser({ headless }));

    // ✅ Support SPA : loadPage gère networkidle + stabilisation DOM
    await loadPage(page, url, { waitFor, extraWait });

    const pageTitle = await page.title();
    success(`   Titre : "${pageTitle}"`);

    let simulationResults = null;
    if (simulate) {
      log('\n⌨️  Simulation d\'actions humaines…');
      simulationResults = await simulateHumanActions(page);
    }

    log('\n🔍 Audit DOM (règles RGAA 4.1)…');
    const domResults = await runDomRules(page);

    const allResults = [...domResults, ...(simulationResults?.findings || [])];
    const score = computeScore(allResults);

    printSummary(score, pageTitle, url);

    let aiAnalysis = null;
    if (apiKey) {
      log('\n🤖 Analyse IA via Claude…');
      aiAnalysis = await analyzeWithClaude(apiKey, url, score, allResults);
      if (aiAnalysis) success('   Recommandations IA générées');
    }

    const report = {
      url, title: pageTitle,
      timestamp: new Date().toISOString(),
      duration: Math.round((Date.now() - startTime) / 1000),
      score, results: allResults,
      simulation: simulationResults?.summary || null,
      aiAnalysis,
    };

    const output_str = await generateReport(report, output);
    if (save) {
      require('node:fs').writeFileSync(save, output_str, 'utf8');
      success(`\n📁 Rapport sauvegardé : ${save}`);
    } else {
      console.log('\n' + output_str);
    }

    return report;

  } finally {
    if (browser) await closeBrowser(browser);
  }
}

function computeScore(results) {
  const by = {};
  results.forEach(r => { (by[r.id] = by[r.id] || []).push(r.status); });
  let conformes=0, nonConformes=0, na=0;
  Object.values(by).forEach(statuses => {
    if (statuses.includes('NC')) nonConformes++;
    else if (statuses.every(s => s === 'NA')) na++;
    else conformes++;
  });
  const applicable = conformes + nonConformes;
  return { taux: applicable > 0 ? Math.round((conformes/applicable)*100) : 0, conformes, nonConformes, na, total: Object.keys(by).length };
}

function printSummary(score, title, url) {
  const bar = '█'.repeat(Math.round(score.taux/5)) + '░'.repeat(20-Math.round(score.taux/5));
  const color = score.taux >= 75 ? '\x1b[32m' : score.taux >= 50 ? '\x1b[33m' : '\x1b[31m';
  const reset = '\x1b[0m';
  console.log(`\n${color}┌─────────────────────────────────────────┐
│  Taux de conformité : ${String(score.taux+'%').padEnd(5)}  ${bar} │
│  Conformes    : ${String(score.conformes).padEnd(4)} critères             │
│  Non conformes: ${String(score.nonConformes).padEnd(4)} critères             │
│  N/A          : ${String(score.na).padEnd(4)} critères             │
└─────────────────────────────────────────┘${reset}\n`);
}

module.exports = { runAudit, computeScore };
