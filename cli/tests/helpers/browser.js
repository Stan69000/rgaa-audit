'use strict';

const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { evaluateEngine } = require('../../src/rules');

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');

function fixtureUrl(relativePath) {
  return pathToFileURL(path.join(FIXTURES_DIR, relativePath)).href;
}

/** Lance un Chromium partagé par les tests d'un fichier. */
async function launch() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'fr-FR' });
  const page = await context.newPage();
  return { browser, context, page };
}

async function auditFixture(page, relativePath, options = {}) {
  await page.goto(fixtureUrl(relativePath), { waitUntil: 'load' });
  return evaluateEngine(page, options);
}

/** Tous les extraits (premier et exemples) des constats d'un critère et d'un statut donnés. */
function snippetsOf(report, { id, status, rule } = {}) {
  return report.results
    .filter((r) => (!id || r.id === id) && (!status || r.status === status) && (!rule || r.rule === rule))
    .flatMap((r) => [r.snippet, ...(r.examples || []).map((e) => e.snippet)])
    .filter(Boolean)
    .join('\n');
}

function findResults(report, filter) {
  return report.results.filter((r) => Object.entries(filter).every(([k, v]) => r[k] === v));
}

module.exports = { launch, auditFixture, fixtureUrl, snippetsOf, findResults };
