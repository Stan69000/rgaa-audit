/**
 * src/rules/index.js — Exécution du moteur de règles partagé dans la page Playwright.
 * Le moteur lui-même vit dans extension/shared/rgaa-rules.js : la CLI et l'extension
 * appliquent exactement les mêmes contrôles.
 */

'use strict';

const { log, warn } = require('../logger');
const { readSharedSource, requireShared } = require('../shared');

const { computeScore } = requireShared('rgaa-rules.js');

/**
 * Évalue le moteur dans la page. On passe par une expression (et non par new Function)
 * pour ne pas dépendre de la politique CSP 'unsafe-eval' du site audité.
 */
async function evaluateEngine(page, options = {}) {
  const source = readSharedSource('rgaa-rules.js');
  return page.evaluate(`(() => {\n${source}\n;return globalThis.RgaaRules.runAudit(${JSON.stringify(options)});\n})()`);
}

/**
 * Attend la fin des animations et transitions finies (apparitions au défilement, fondus…) :
 * mesurer un contraste au milieu d'un fondu donnerait un faux positif. Les animations en
 * boucle sont ignorées, la durée d'attente est plafonnée.
 */
async function waitForAnimations(page, maxMs = 1500) {
  await page.evaluate(async (limit) => {
    const finite = document.getAnimations().filter((a) => {
      if (a.playState !== 'running') return false;
      const timing = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
      return !timing || Number.isFinite(timing.endTime);
    });
    if (!finite.length) return;
    await Promise.race([
      Promise.all(finite.map((a) => a.finished.catch(() => {}))),
      new Promise((resolve) => setTimeout(resolve, limit)),
    ]);
  }, maxMs).catch(() => {});
}

/**
 * Fait défiler toute la page puis revient en haut : déclenche les contenus chargés ou
 * révélés au défilement (lazy loading, animations d'apparition) avant de les auditer.
 */
async function settlePage(page, { maxSteps = 30 } = {}) {
  await page.evaluate(async (steps) => {
    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const html = document.documentElement;
    const previous = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    for (let i = 0; i < steps; i++) {
      const before = window.scrollY;
      window.scrollBy(0, window.innerHeight * 0.9);
      await pause(120);
      if (window.scrollY === before) break;
    }
    window.scrollTo(0, 0);
    html.style.scrollBehavior = previous;
  }, maxSteps).catch(() => {});
  await page.waitForTimeout(200);
  await waitForAnimations(page);
}

async function runDomRules(page, options = {}) {
  await settlePage(page);
  const report = await evaluateEngine(page, options);
  for (const error of report.internalErrors || []) {
    warn(`   Règles « ${error.section} » interrompues : ${error.message}`);
  }
  const { score } = report;
  log(`   → ${report.results.length} constats (${score.nonConformes} critère(s) NC, ${score.aVerifier} à vérifier, ${score.conformes} C) en ${report.durationMs} ms`);
  return report.results;
}

/** Empreinte des couleurs de base, pour savoir si la page réagit à prefers-color-scheme. */
async function themeSignature(page) {
  return page.evaluate(() => {
    const read = (el) => {
      if (!el) return '';
      const s = window.getComputedStyle(el);
      return `${s.color}|${s.backgroundColor}`;
    };
    const sample = document.querySelector('main, [role="main"], header, nav');
    return [read(document.documentElement), read(document.body), read(sample)].join('||');
  });
}

/**
 * Rejoue la page en thème sombre et ne mesure que le contraste du texte.
 * Retourne null si la page ne change pas d'apparence (thème unique).
 */
async function runDarkSchemeContrast(page, { reload }) {
  const before = await themeSignature(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  try {
    await reload();
    const after = await themeSignature(page);
    if (after === before) return null;
    await settlePage(page);
    log('   Thème sombre détecté : mesure des contrastes en prefers-color-scheme: dark…');
    const report = await evaluateEngine(page, { themes: ['colors'], colorScheme: 'dark', contrastOnly: true });
    return report.results.filter((r) => r.id === '3.2');
  } finally {
    await page.emulateMedia({ colorScheme: 'light' });
  }
}

/**
 * Mesure les contrastes dans le thème alternatif du site (bouton de bascule ou script),
 * puis recharge la page pour revenir à l'état initial.
 */
async function runAlternateThemeContrast(page, { apply, revert, reload, label = 'thème alternatif' }) {
  const before = await themeSignature(page);
  let applied = false;
  try {
    await apply();
    applied = true;
    const after = await themeSignature(page);
    if (after === before) {
      warn('   Le thème alternatif ne change pas les couleurs de la page : passe ignorée.');
      return null;
    }
    await settlePage(page);
    log(`   Mesure des contrastes en ${label}…`);
    const report = await evaluateEngine(page, { themes: ['colors'], contextLabel: label, contrastOnly: true });
    return report.results.filter((r) => r.id === '3.2');
  } finally {
    // Un thème mémorisé par le site (localStorage, cookie) survivrait au rechargement.
    if (applied && revert) await revert().catch(() => {});
    await reload();
  }
}

module.exports = {
  runDomRules,
  settlePage,
  waitForAnimations,
  runDarkSchemeContrast,
  runAlternateThemeContrast,
  evaluateEngine,
  computeScore,
};
