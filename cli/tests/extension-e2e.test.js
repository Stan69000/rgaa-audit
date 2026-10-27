/**
 * Extension réellement chargée dans Chromium : service worker, injection du moteur partagé
 * dans un onglet, relance sur la même page, mise en évidence d'un élément.
 *
 * activeTab n'est accordé qu'après un clic sur l'icône, impossible à simuler : la copie de
 * test de l'extension reçoit donc host_permissions sur le serveur local. Le reste du code
 * (background.js, shared/) est exactement celui publié.
 */
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const EXTENSION_DIR = path.join(__dirname, '..', '..', 'extension');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

let server;
let origin;
let context;
let worker;
let tmp;

before(async () => {
  server = http.createServer((req, res) => {
    const file = path.join(FIXTURES_DIR, path.normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!file.startsWith(FIXTURES_DIR) || !fs.existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(fs.readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;

  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rgaa-ext-'));
  const extCopy = path.join(tmp, 'extension');
  fs.cpSync(EXTENSION_DIR, extCopy, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(extCopy, 'manifest.json'), 'utf8'));
  manifest.host_permissions = [`${origin}/*`];
  fs.writeFileSync(path.join(extCopy, 'manifest.json'), JSON.stringify(manifest));

  context = await chromium.launchPersistentContext(path.join(tmp, 'profile'), {
    channel: 'chromium',
    args: [`--disable-extensions-except=${extCopy}`, `--load-extension=${extCopy}`],
  });
  worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
});

after(async () => {
  await context?.close();
  server?.close();
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

async function auditActiveTab() {
  return worker.evaluate(async () => {
    const tab = await getActiveTab();
    return runAuditInTab(tab.id);
  });
}

test('le service worker injecte le moteur et renvoie un rapport complet', async () => {
  const page = await context.newPage();
  await page.goto(`${origin}/non-conforme.html`);
  await page.bringToFront();
  const report = await auditActiveTab();
  assert.ok(report.engineVersion);
  assert.equal(report.url, `${origin}/non-conforme.html`);
  assert.equal(report.score.criteria['8.3'], 'NC');
  assert.equal(report.score.criteria['6.2'], 'NC');
  assert.deepEqual(report.internalErrors, []);

  const again = await auditActiveTab();
  assert.equal(again.results.length, report.results.length, 'relancer l’audit sur la même page');
  await page.close();
});

test('panneau latéral : API disponible et guide chargé dans l’extension', async () => {
  const hasSidePanel = await worker.evaluate(() => Boolean(chrome.sidePanel && chrome.sidePanel.open));
  assert.equal(hasSidePanel, true);
  const options = await worker.evaluate(() => chrome.sidePanel.getOptions({}));
  assert.equal(options.path, 'guide/guide.html');
  const extensionId = new URL(worker.url()).host;
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/guide/guide.html`);
  assert.equal(await page.locator('h1').textContent(), 'Vérification guidée');
  assert.equal(await page.locator('[role="group"] button').count(), 3, 'trois profils proposés');
  await page.close();
});

test('mise en évidence d’un élément signalé', async () => {
  const page = await context.newPage();
  await page.goto(`${origin}/non-conforme.html`);
  await page.bringToFront();
  const report = await auditActiveTab();
  const target = report.results.find((r) => r.status === 'NC' && r.selector);
  assert.ok(target);
  const ok = await worker.evaluate(async (selector) => highlightInTab((await getActiveTab()).id, selector), target.selector);
  assert.equal(ok, true);
  const outline = await page.evaluate((s) => document.querySelector(s).style.outline, target.selector);
  assert.match(outline, /solid/);
  await page.close();
});
