/**
 * Aides visuelles du guide (shared/rgaa-guide-page.js) dans une vraie page.
 */
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { launch, fixtureUrl } = require('./helpers/browser');
const { evaluateEngine } = require('../src/rules');

const FILES = ['rgaa-rules.js', 'rgaa-guide-page.js'].map((f) => path.join(__dirname, '..', '..', 'extension', 'shared', f));

let browser;
let page;
let inv;

before(async () => {
  ({ browser, page } = await launch());
  await page.goto(fixtureUrl('guide/page.html'));
  for (const file of FILES) await page.addScriptTag({ path: file });
  inv = await page.evaluate(() => globalThis.RgaaGuidePage.inventory());
});

after(async () => {
  await browser.close();
});

const labels = (key) => inv.collections[key].map((i) => i.label);

test('inventaire : images informatives et décoratives', () => {
  assert.deepEqual(labels('imagesInformative').sort(), ['Diapositive visible', 'Graphique des adhésions', 'IMG_2045', 'Logo de l’association', 'Photo de la carte'].sort());
  assert.equal(inv.collections.imagesDecorative.length, 1);
});

test('carrousel : la diapositive recouverte est ignorée, pas l’image sous un lien étiré', () => {
  assert.ok(!labels('imagesInformative').includes('Diapositive cachée'));
  assert.ok(labels('imagesInformative').includes('Photo de la carte'));
});

test('inventaire : liens, liens dans le texte, titres, zones', () => {
  assert.ok(labels('links').includes('En savoir plus'));
  assert.deepEqual(labels('textLinks'), ['tous les détails ici']);
  assert.deepEqual(inv.collections.headings.map((h) => `${h.level}:${h.label}`), ['1:Bienvenue', '2:Actualités', '3:Documents']);
  const zones = labels('landmarks').join(' | ');
  assert.match(zones, /En-tête/);
  assert.match(zones, /Navigation « Principale »/);
  assert.match(zones, /Contenu principal/);
  assert.match(zones, /Pied de page/);
});

test('inventaire : ordre de tabulation (tabindex positif en premier)', () => {
  assert.equal(inv.collections.tabOrder[0].label, 'Contact');
  assert.equal(inv.collections.tabOrder[1].label, 'Aller au contenu');
});

test('inventaire : cadres, champs, boutons, médias, documents', () => {
  assert.deepEqual(labels('frames'), ['Carte du local']);
  assert.deepEqual(labels('fields'), ['Nom', 'Champ']);
  assert.deepEqual(labels('buttons'), ['OK']);
  assert.equal(inv.collections.media.length, 1);
  assert.deepEqual(labels('documents'), ['Statuts de l’association']);
  assert.equal(inv.lang, 'fr');
});

test('surimpressions : affichées dans un shadow DOM ignoré, puis retirées', async () => {
  for (const aid of ['alternatives', 'headings', 'landmarks', 'links', 'taborder']) {
    const count = await page.evaluate((a) => globalThis.RgaaGuidePage.showAid(a), aid);
    const boxes = await page.evaluate(() => {
      const host = document.getElementById('rgaa-guide-overlay');
      return host ? { hidden: host.getAttribute('aria-hidden'), n: host.shadowRoot.querySelectorAll('.box, .num').length } : null;
    });
    assert.ok(count > 0, aid);
    assert.equal(boxes.hidden, 'true');
    assert.ok(boxes.n >= 1, `${aid} : aucune marque affichée`);
  }
  const report = await evaluateEngine(page);
  assert.deepEqual(report.internalErrors, []);
  assert.ok(!JSON.stringify(report.results).includes('rgaa-guide-overlay'), 'le moteur ignore la surimpression');

  await page.evaluate(() => globalThis.RgaaGuidePage.showAid('grayscale'));
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).filter), 'grayscale(1)');
  await page.evaluate(() => globalThis.RgaaGuidePage.clear());
  assert.equal(await page.evaluate(() => Boolean(document.getElementById('rgaa-guide-overlay'))), false);
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).filter), 'none');
});

test('mise en évidence d’un élément par son sélecteur', async () => {
  const key = inv.collections.imagesInformative.find((i) => i.label === 'IMG_2045').key;
  assert.equal(await page.evaluate((k) => globalThis.RgaaGuidePage.highlight(k, 'IMG_2045'), key), true);
  assert.equal(await page.evaluate(() => document.getElementById('rgaa-guide-overlay').shadowRoot.querySelectorAll('.box.current').length), 1);
  assert.equal(await page.evaluate(() => globalThis.RgaaGuidePage.highlight('a[[', '')), false);
  await page.evaluate(() => globalThis.RgaaGuidePage.clear());
});
