/**
 * Panneau du guide chargé dans Chromium. Le faux runtime `chrome` relaie les appels
 * chrome.scripting vers une seconde page (la page auditée), comme le fait l'extension.
 */
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { launch, fixtureUrl } = require('./helpers/browser');
const { evaluateEngine } = require('../src/rules');

const EXT = path.join(__dirname, '..', '..', 'extension');
const GUIDE_URL = pathToFileURL(path.join(EXT, 'guide', 'guide.html')).href;

let browser;
let context;
let guide;
let target;
let exported;

async function openGuide() {
  const g = await context.newPage();
  await g.exposeFunction('__runFiles', async (files) => {
    for (const f of files) await target.addScriptTag({ path: path.join(EXT, f) });
  });
  await g.exposeFunction('__runFunc', async (source, args) => target.evaluate(
    ([src, a]) => (0, eval)(`(${src})`)(...a), [source, args],
  ));
  await g.exposeFunction('__targetUrl', () => target.url());
  await g.addInitScript(() => {
    window.chrome = {
      tabs: { query: async () => [{ id: 1, windowId: 1, url: await window.__targetUrl() }] },
      scripting: {
        executeScript: async ({ files, func, args = [] }) => {
          if (files) {
            await window.__runFiles(files);
            return [{ result: undefined }];
          }
          return [{ result: await window.__runFunc(func.toString(), args) }];
        },
      },
    };
  });
  await g.goto(GUIDE_URL);
  return g;
}

before(async () => {
  ({ browser, context } = await launch());
  target = await context.newPage();
  await target.goto(fixtureUrl('guide/page.html'));
  guide = await openGuide();
});

after(async () => {
  if (exported) fs.rmSync(exported, { force: true });
  await browser.close();
});

const clickText = (p, text) => p.getByRole('button', { name: text, exact: false }).first().click();

test('profil puis analyse de la page : plan des questions applicables', async () => {
  await clickText(guide, 'Je découvre');
  await clickText(guide, 'Analyser la page affichée');
  await guide.waitForSelector('text=Plan de vérification');
  const plan = await guide.locator('.plan .crit').allTextContents();
  const ids = plan.map((t) => t.replace(/[^\d.]/g, ''));
  assert.ok(ids.includes('1.3') && ids.includes('6.1') && ids.includes('13.3') && ids.includes('4.3'));
  assert.ok(!ids.includes('12.8'), 'profil « Je découvre » : pas de question « avec pratique »');
  assert.ok(ids.indexOf('1.3') < ids.indexOf('6.1'));
});

test('question élément par élément : aide affichée dans la page, réponses enregistrées', async () => {
  await clickText(guide, 'Commencer');
  await guide.waitForSelector('h2:has-text("Le texte qui remplace cette image")');
  const overlay = await target.evaluate(() => Boolean(document.getElementById('rgaa-guide-overlay')));
  assert.ok(overlay, 'surimpression des alternatives affichée dans la page');
  const focused = await guide.evaluate(() => document.activeElement.tagName);
  assert.equal(focused, 'H2', 'le focus va au titre de la question');

  const total = Number((await guide.locator('.card .eyebrow').textContent()).match(/sur (\d+)/)[1]);
  for (let i = 0; i < total; i++) {
    const label = await guide.locator('.card .label-text').textContent();
    await clickText(guide, label === 'IMG_2045' ? 'Non, à reformuler' : 'Oui, c’est clair');
  }
  await guide.waitForFunction(() => /Non conforme/.test(document.getElementById('status').textContent));
  const focusedAfter = await guide.evaluate(() => document.activeElement.textContent);
  assert.match(focusedAfter, /Non, à reformuler|Oui, c’est clair/, 'le focus reste sur les réponses');
});

test('question en liste : signaler un lien rend le critère non conforme', async () => {
  await clickText(guide, 'Plan');
  await guide.locator('.plan button', { hasText: 'Chaque lien dit-il où il mène' }).click();
  await guide.getByRole('button', { name: 'Pas clair : En savoir plus' }).click();
  assert.equal(await guide.getByRole('button', { name: 'Pas clair : En savoir plus' }).getAttribute('aria-pressed'), 'true');
  assert.match(await guide.locator('.notice').textContent(), /non conforme/);
});

test('export de la session puis import dans un panneau neuf', async () => {
  await clickText(guide, 'Plan');
  const [download] = await Promise.all([guide.waitForEvent('download'), clickText(guide, 'Exporter la session')]);
  exported = path.join(require('node:os').tmpdir(), `session-${Date.now()}.json`);
  await download.saveAs(exported);
  const session = JSON.parse(fs.readFileSync(exported, 'utf8'));
  assert.equal(session.format, 'rgaa-audit-session/1');
  assert.equal(session.profil, 'decouverte');
  const criteres = Object.values(session.pages)[0].criteres;
  assert.equal(criteres['1.3'].elements[Object.keys(criteres['1.3'].elements).find((k) => criteres['1.3'].elements[k].label === 'IMG_2045')].reponse, 'non');
  assert.equal(criteres['6.1'].signales[0].label, 'En savoir plus');

  const fresh = await openGuide();
  await clickText(fresh, 'Je découvre');
  await fresh.setInputFiles('#importFile', exported);
  await fresh.waitForSelector('text=Session importée');
  await clickText(fresh, 'Voir la synthèse');
  const text = await fresh.locator('main').textContent();
  assert.match(text, /IMG_2045/);
  assert.match(text, /En savoir plus/);
  assert.match(text, /Non conforme/);
  await fresh.close();
});

test('le panneau passe son propre audit sans non-conformité', async () => {
  const planButton = guide.getByRole('button', { name: 'Plan', exact: true });
  if (await planButton.count()) await planButton.click();
  await guide.waitForSelector('.plan button');
  const planReport = await evaluateEngine(guide);
  assert.deepEqual(planReport.results.filter((r) => r.status === 'NC').map((r) => `${r.id} ${r.message}`), [], 'écran du plan');
  await guide.locator('.plan button').first().click();
  await guide.waitForSelector('.answers');
  const report = await evaluateEngine(guide);
  const nc = report.results.filter((r) => r.status === 'NC').map((r) => `${r.id} ${r.message} ${r.snippet || ''}`);
  assert.deepEqual(nc, []);
});
