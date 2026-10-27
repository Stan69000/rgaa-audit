// Génère les captures 1280 × 800 de la fiche Chrome Web Store dans cli/store/.
// La fenêtre de l'extension est rejouée sur le site du projet (docs/index.html), le guide sur
// une page riche en images (par défaut rvaz.fr, site de l'association ; STORE_SITE pour en
// changer), avec un faux runtime `chrome` qui relaie les appels vers la page, comme dans les tests.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { evaluateEngine, settlePage } = require('../src/rules');
const { createPagePreparer } = require('../src/page-prep');

const ROOT = path.join(__dirname, '..', '..');
const EXT = path.join(ROOT, 'extension');
const OUT = path.join(__dirname, '..', 'store');
// Adresse publique : elle apparaît dans « Page analysée » sur les captures.
const SITE = process.env.STORE_POPUP_SITE || 'https://stan69000.github.io/rgaa-audit/';
const GUIDE_SITE = process.env.STORE_SITE || 'https://rvaz.fr/';
const W = 1280;
const H = 800;
const PANEL_W = 400;

async function openSite(context, width, url = SITE) {
  const page = await context.newPage();
  await page.setViewportSize({ width, height: H });
  await page.goto(url, { waitUntil: 'networkidle' });
  await createPagePreparer(page)();
  await settlePage(page);
  return page;
}

async function popupShot(context, report, afterAudit) {
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 480, height: 600 });
  await popup.addInitScript((r) => {
    window.chrome = {
      tabs: { query: (q, cb) => cb([{ id: 1, windowId: 1 }]) },
      sidePanel: { open: async () => {} },
      runtime: { lastError: null, sendMessage: (m, cb) => setTimeout(() => cb({ success: true, report: r }), 0) },
    };
  }, report);
  await popup.goto(pathToFileURL(path.join(EXT, 'panel', 'panel.html')).href);
  if (afterAudit) {
    await popup.click('#btnAudit');
    await popup.waitForSelector('#guideCallout:not([hidden])');
  }
  const png = await popup.screenshot();
  await popup.close();
  return png;
}

async function openGuide(context, target) {
  const guide = await context.newPage();
  await guide.setViewportSize({ width: PANEL_W, height: H });
  await guide.exposeFunction('__runFiles', async (files) => {
    for (const f of files) await target.addScriptTag({ path: path.join(EXT, f) });
  });
  await guide.exposeFunction('__runFunc', async (src, args) => target.evaluate(([s, a]) => (0, eval)(`(${s})`)(...a), [src, args]));
  await guide.exposeFunction('__targetUrl', () => target.url());
  await guide.addInitScript(() => {
    window.chrome = {
      tabs: { query: async () => [{ id: 1, url: await window.__targetUrl() }] },
      scripting: {
        executeScript: async ({ files, func, args = [] }) => (files
          ? (await window.__runFiles(files), [{}])
          : [{ result: await window.__runFunc(func.toString(), args) }]),
      },
    };
  });
  await guide.goto(pathToFileURL(path.join(EXT, 'guide', 'guide.html')).href);
  return guide;
}

/** Assemble les images dans une page 1280 × 800 et la photographie. */
async function compose(context, file, layout) {
  const page = await context.newPage();
  await page.setViewportSize({ width: W, height: H });
  const img = (buf) => `data:image/png;base64,${buf.toString('base64')}`;
  const html = layout === 'popup'
    ? `<body style="margin:0;width:${W}px;height:${H}px;overflow:hidden;position:relative">
        <img src="${img(this.background)}" style="position:absolute;inset:0;width:${W}px;height:${H}px;filter:brightness(.82)">
        <img src="${img(this.popup)}" style="position:absolute;top:16px;right:24px;width:480px;border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.55)">
      </body>`
    : `<body style="margin:0;width:${W}px;height:${H}px;overflow:hidden;display:flex;background:#fff">
        <img src="${img(this.page)}" style="width:${W - PANEL_W}px;height:${H}px">
        <img src="${img(this.panel)}" style="width:${PANEL_W}px;height:${H}px;border-left:1px solid #d9dee7">
      </body>`;
  await page.setContent(html);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, file) });
  await page.close();
  console.log(`store/${file}`);
}

async function guideStep(context, fichePattern, file, profile = 'Je découvre') {
  const target = await openSite(context, W - PANEL_W, GUIDE_SITE);
  const guide = await openGuide(context, target);
  await guide.getByRole('button', { name: profile }).click();
  await guide.getByRole('button', { name: 'Analyser la page affichée' }).click();
  await guide.waitForSelector('.plan button');
  await guide.locator('.plan button', { hasText: fichePattern }).first().click();
  await guide.waitForSelector('.answers');
  await target.waitForTimeout(400);
  await compose.call({ page: await target.screenshot(), panel: await guide.screenshot() }, context, file, 'guide');
  await guide.close();
  await target.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ locale: 'fr-FR', deviceScaleFactor: 1, colorScheme: 'light' });
  try {
    const site = await openSite(context, W);
    const report = await evaluateEngine(site);
    const background = await site.screenshot();
    await site.close();

    await compose.call({ background, popup: await popupShot(context, report, false) }, context, '1-deux-parcours.png', 'popup');
    await compose.call({ background, popup: await popupShot(context, report, true) }, context, '2-resultats.png', 'popup');
    await guideStep(context, 'texte qui remplace cette image', '3-guide-images.png');
    await guideStep(context, 'plan des titres', '4-guide-titres.png');
    await guideStep(context, 'ordre de passage au clavier', '5-guide-clavier.png', 'J’ai l’habitude');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
