/**
 * src/audit.js — Orchestrateur principal
 * Coordonne : browser → simulator → rules → AI → reporter
 */

'use strict';

const { createBrowser, closeBrowser } = require('./browser');
const { simulateHumanActions }        = require('./simulator');
const { runDomRules }                  = require('./rules');
const { analyzeWithClaude }            = require('./ai/claude-analysis');
const { generateReport }               = require('./reporters');
const { log, success, warn, error }    = require('./logger');

async function runAudit(url, opts = {}) {
  const {
    output   = 'json',
    save     = '',
    vulgarizedSave = '',
    simulate = true,
    depth    = 1,
    apiKey   = '',
    headless = true,
  } = opts;

  log(`\n♿  RGAA Audit CLI — ${url}\n`);

  const startTime = Date.now();
  let browser, page;

  try {
    // ── 1. NAVIGATEUR ────────────────────────
    log('🌐 Lancement du navigateur…');
    ({ browser, page } = await createBrowser({ headless }));

    log(`📄 Chargement de ${url}…`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    const pageTitle = await page.title();
    success(`   Titre : "${pageTitle}"`);

    // ── 2. SIMULATION D'ACTIONS HUMAINES ─────
    let simulationResults = null;
    if (simulate) {
      log('\n⌨️  Simulation d\'actions humaines…');
      simulationResults = await simulateHumanActions(page);
    }

    // ── 3. RÈGLES DOM AUTOMATIQUES ───────────
    log('\n🔍 Audit DOM (règles RGAA 4.1)…');
    const domResults = await runDomRules(page);

    // ── 4. FUSION DES RÉSULTATS ───────────────
    const allResults = mergeResults(domResults, simulationResults);
    const score = computeScore(allResults);

    printSummary(score, pageTitle, url);

    // ── 5. ANALYSE IA (OPTIONNELLE) ───────────
    let aiAnalysis = null;
    if (apiKey) {
      log('\n🤖 Analyse IA via Claude…');
      aiAnalysis = await analyzeWithClaude(apiKey, url, score, allResults);
      if (aiAnalysis) success('   Recommandations IA générées');
    }

    // ── 6. RAPPORT ────────────────────────────
    const report = {
      url,
      title: pageTitle,
      timestamp: new Date().toISOString(),
      duration: Math.round((Date.now() - startTime) / 1000),
      score,
      results: allResults,
      simulation: simulationResults?.summary || null,
      aiAnalysis,
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

function mergeResults(domResults, simResults) {
  const all = [...domResults];
  if (simResults?.findings) all.push(...simResults.findings);
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

function printSummary(score, title, url) {
  const bar = '█'.repeat(Math.round(score.taux / 5)) + '░'.repeat(20 - Math.round(score.taux / 5));
  const color = score.taux >= 75 ? '\x1b[32m' : score.taux >= 50 ? '\x1b[33m' : '\x1b[31m';
  const reset = '\x1b[0m';

  console.log(`
${color}┌─────────────────────────────────────────┐
│  Taux de conformité : ${String(score.taux + '%').padEnd(5)}  ${bar} │
│  Conformes    : ${String(score.conformes).padEnd(4)} critères             │
│  Non conformes: ${String(score.nonConformes).padEnd(4)} critères             │
│  N/A          : ${String(score.na).padEnd(4)} critères             │
└─────────────────────────────────────────┘${reset}
  `);
}

module.exports = { runAudit, computeScore };
