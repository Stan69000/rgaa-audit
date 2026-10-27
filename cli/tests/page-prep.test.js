'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, fixtureUrl } = require('./helpers/browser');
const { createPagePreparer, applyAlternateTheme } = require('../src/page-prep');
const { runAlternateThemeContrast, evaluateEngine } = require('../src/rules');

let browser;
let page;
const URL_FIXTURE = fixtureUrl('engine/consent-theme.html');

before(async () => {
  ({ browser, page } = await launch());
});

after(async () => {
  await browser.close();
});

test('ferme le bandeau cookies en refusant', async () => {
  await page.goto(URL_FIXTURE);
  await createPagePreparer(page)();
  assert.equal(await page.$('#banner'), null);
  assert.equal(await page.evaluate(() => localStorage.getItem('consent')), 'refused');
});

test('--dismiss off laisse le bandeau', async () => {
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_FIXTURE);
  await createPagePreparer(page, { dismiss: 'off' })();
  assert.notEqual(await page.$('#banner'), null);
});

test('mesure les contrastes du thème alternatif puis revient au thème initial', async () => {
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_FIXTURE);
  const prepare = createPagePreparer(page);
  await prepare();

  const base = await evaluateEngine(page, { themes: ['colors'] });
  assert.equal(base.results.filter((r) => r.id === '3.2' && r.status === 'NC').length, 0);

  const results = await runAlternateThemeContrast(page, {
    apply: () => applyAlternateTheme(page, { click: '#theme-toggle' }),
    revert: () => applyAlternateTheme(page, { click: '#theme-toggle' }),
    reload: async () => { await page.goto(URL_FIXTURE); await prepare(); },
  });
  const nc = results.filter((r) => r.status === 'NC');
  assert.ok(nc.length >= 1);
  assert.ok(nc.some((r) => /theme-text/.test(JSON.stringify(r.examples))));
  for (const r of nc) {
    assert.match(r.message, /\[thème alternatif\]/);
    assert.equal(r.context, 'thème alternatif');
  }
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
});
