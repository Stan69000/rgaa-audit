/**
 * Panneau de l'extension chargé dans Chromium avec un faux runtime chrome :
 * rendu, filtres, neutralisation du HTML venu de la page auditée, et accessibilité
 * du panneau lui-même mesurée par le moteur partagé.
 */
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { launch } = require('./helpers/browser');
const { evaluateEngine } = require('../src/rules');

const PANEL_URL = pathToFileURL(path.join(__dirname, '..', '..', 'extension', 'panel', 'panel.html')).href;

const REPORT = {
  engineVersion: 'test',
  url: 'https://exemple.test/',
  timestamp: '2026-10-26T10:00:00.000Z',
  results: [
    { id: '1.1', status: 'NC', rule: 'img-alt-missing', message: '<img src=x onerror="window.__xss=1">', snippet: '<script>window.__xss=2</script>', selector: 'main > img', count: 1, examples: [{ selector: 'main > img', snippet: '<img src="a.png">' }], confidence: 'high', remediationHint: 'Ajouter un alt.' },
    { id: '6.1', status: 'NT', rule: 'link-generic', message: 'Intitulé de lien peu explicite : « ici ».', count: 2, examples: [], confidence: 'medium' },
    { id: '8.5', status: 'C', rule: 'page-title-ok', message: 'Titre de page présent.', count: 1, examples: [] },
    { id: '2.1', status: 'NA', rule: 'frame-none', message: 'Aucun cadre.', count: 1, examples: [] },
  ],
  score: { taux: 50, conformes: 1, nonConformes: 1, aVerifier: 1, na: 1, total: 4, criteria: { '1.1': 'NC', '6.1': 'NT', '8.5': 'C', '2.1': 'NA' } },
  internalErrors: [],
};

let browser;
let page;

before(async () => {
  ({ browser, page } = await launch());
  await page.addInitScript((report) => {
    window.__messages = [];
    window.__sidePanel = [];
    window.chrome = {
      tabs: { query: (q, cb) => cb([{ id: 1, windowId: 7 }]) },
      sidePanel: { open: async (opts) => { window.__sidePanel.push(opts); } },
      runtime: {
        lastError: null,
        sendMessage(message, callback) {
          window.__messages.push(message);
          setTimeout(() => callback(message.action === 'getAuditResults' ? { success: true, report } : { success: true }), 0);
        },
      },
    };
  }, REPORT);
  await page.goto(PANEL_URL);
  // Avant l'audit : seuls les deux parcours sont proposés.
  for (const id of ['#scoreBar', '#filters', '#footer', '#guideCallout']) {
    assert.equal(await page.isVisible(id), false, `${id} ne doit pas s’afficher avant l’audit`);
  }
  assert.equal(await page.isVisible('#btnGuide'), true);
  await page.click('#btnAudit');
  await page.waitForSelector('details.criterion');
});

after(async () => {
  await browser.close();
});

test('affiche les critères avec leur intitulé officiel, non-conformités d’abord', async () => {
  const ids = await page.$$eval('.criterion-id', (els) => els.map((e) => e.textContent));
  assert.deepEqual(ids, ['1.1', '6.1', '8.5', '2.1']);
  const title = await page.textContent('details.criterion .criterion-title');
  assert.match(title, /image porteuse d’information/);
  assert.equal(await page.getAttribute('details.criterion', 'open'), '');
});

test('le HTML venu de la page auditée est affiché comme du texte', async () => {
  const message = await page.textContent('.result-message');
  assert.equal(message, REPORT.results[0].message);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.equal(await page.$('details img'), null);
});

test('filtres exposés comme boutons à bascule', async () => {
  await page.click('[data-filter="NT"]');
  assert.equal(await page.getAttribute('[data-filter="NT"]', 'aria-pressed'), 'true');
  assert.equal(await page.getAttribute('[data-filter="all"]', 'aria-pressed'), 'false');
  assert.deepEqual(await page.$$eval('.criterion-id', (els) => els.map((e) => e.textContent)), ['6.1']);
  assert.match(await page.textContent('#status'), /1 critère/);
  await page.click('[data-filter="all"]');
});

test('le bouton « Voir » demande la mise en évidence de l’élément', async () => {
  await page.click('.btn-locate');
  const messages = await page.evaluate(() => window.__messages);
  assert.deepEqual(messages.at(-1), { action: 'highlightElement', selector: 'main > img' });
});

test('après l’audit, invitation à la vérification guidée qui ouvre le panneau latéral', async () => {
  assert.equal(await page.isVisible('#guideCallout'), true);
  assert.equal(await page.isVisible('#btnGuide'), false, 'un seul bouton vers le guide après l’audit');
  assert.match(await page.textContent('#calloutTitle'), /1 critère\(s\) restent à vérifier/);
  await page.evaluate(() => { window.close = () => {}; });
  await page.click('#guideCallout button');
  assert.deepEqual(await page.evaluate(() => window.__sidePanel), [{ windowId: 7 }]);
});

test('le panneau passe son propre audit sans non-conformité', async () => {
  const report = await evaluateEngine(page);
  const nc = report.results.filter((r) => r.status === 'NC').map((r) => `${r.id} ${r.message} ${r.snippet || ''}`);
  assert.deepEqual(nc, []);
});
