/**
 * Simulation clavier et affichage sur une page piège (focus invisible, piège clavier,
 * débordement à 320 px, texte tronqué par l'espacement).
 */
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { launch, fixtureUrl } = require('./helpers/browser');
const { simulateHumanActions } = require('../src/simulator');

let browser;
let simulation;
let screenshotsDir;

before(async () => {
  let page;
  ({ browser, page } = await launch());
  screenshotsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rgaa-sim-'));
  const url = fixtureUrl('engine/simulator.html');
  await page.goto(url);
  simulation = await simulateHumanActions(page, {
    screenshotsDir,
    reload: () => page.goto(url, { waitUntil: 'load' }),
  });
});

after(async () => {
  await browser.close();
  fs.rmSync(screenshotsDir, { recursive: true, force: true });
});

const finding = (id, status) => simulation.findings.find((f) => f.id === id && (!status || f.status === status));

test('10.7 : repère le focus invisible et seulement lui', () => {
  const nc = finding('10.7', 'NC');
  assert.ok(nc, 'focus invisible attendu');
  assert.equal(nc.count, 1);
  assert.match(nc.snippet, /nofocus/);
});

test('3.3 : indicateur de focus peu contrasté', () => {
  const weak = finding('3.3', 'NT');
  assert.ok(weak, 'indicateur faible attendu');
  assert.match(JSON.stringify(weak.examples), /Bouton au focus discret/);
  assert.doesNotMatch(JSON.stringify(weak.examples), /Bouton avec focus visible/);
});

test('3.2 : contraste du texte au focus et au survol', () => {
  const states = simulation.findings.filter((f) => f.id === '3.2' && f.status === 'NC');
  const focus = states.find((f) => /au focus/.test(f.message));
  const hover = states.find((f) => /au survol/.test(f.message));
  assert.ok(focus && /Lien pâle au focus/.test(JSON.stringify(focus.examples)));
  assert.ok(hover && /Lien pâle au survol/.test(JSON.stringify(hover.examples)));
  assert.doesNotMatch(JSON.stringify(hover.examples), /focusbad|Lien pâle au focus/);
});

test('12.9 : détecte le piège clavier', () => {
  const trap = finding('12.9', 'NC');
  assert.ok(trap);
  assert.match(trap.message, /Zone qui retient le focus/);
});

test('12.7 : lien d’évitement visible au focus et fonctionnel', () => {
  assert.ok(finding('12.7', 'C'));
});

test('10.11 : défilement horizontal à 320 px', () => {
  const reflow = finding('10.11', 'NC');
  assert.ok(reflow);
  assert.match(JSON.stringify(reflow.examples), /wide/);
});

test('10.12 : texte tronqué quand l’espacement augmente', () => {
  const spacing = finding('10.12', 'NC');
  assert.ok(spacing);
  assert.match(spacing.snippet, /clip/);
});

test('captures d’écran écrites dans le dossier demandé', () => {
  assert.ok(simulation.screenshots.length >= 3);
  for (const file of simulation.screenshots) assert.ok(file.startsWith(screenshotsDir) && fs.existsSync(file));
});
