/**
 * Moteur de règles partagé (extension/shared/rgaa-rules.js) exécuté dans un vrai Chromium.
 * Chaque fixture rassemble des pièges connus : faux positifs à éviter et vrais défauts à trouver.
 */
'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, auditFixture, snippetsOf, findResults } = require('./helpers/browser');

let browser;
let page;

before(async () => {
  ({ browser, page } = await launch());
});

after(async () => {
  await browser.close();
});

describe('3.2 — contraste du texte', () => {
  let report;
  before(async () => {
    report = await auditFixture(page, 'engine/contrast.html');
  });

  test('ne suppose pas un fond noir derrière une navigation fixe transparente', () => {
    assert.doesNotMatch(snippetsOf(report, { id: '3.2', status: 'NC' }), /nav-link/);
  });

  test('détecte les vrais défauts, couleurs translucides et notations modernes comprises', () => {
    const failing = snippetsOf(report, { id: '3.2', status: 'NC' });
    for (const cls of ['class="fail"', 'overlay-text', 'srgb-fail', 'oklch-fail', 'big-fail', 'bold-fail']) {
      assert.match(failing, new RegExp(cls), `${cls} devrait être signalé`);
    }
  });

  test('applique les seuils RGAA (24 px, ou 18,5 px en gras, à 3:1)', () => {
    const failing = snippetsOf(report, { id: '3.2', status: 'NC' });
    assert.doesNotMatch(failing, /big-pass|bold-pass/);
  });

  test('ignore le texte masqué, désactivé et les couleurs conformes', () => {
    const failing = snippetsOf(report, { id: '3.2', status: 'NC' });
    assert.doesNotMatch(failing, /sr-only|disabled|srgb-pass|dark-card|class="ok"/);
  });

  test('mesure le fond composé d’un voile translucide (#808080 → 3,98:1)', () => {
    const overlay = report.results.find((r) => r.id === '3.2' && r.status === 'NC' && /overlay-text/.test(snippetsOf({ results: [r] })));
    assert.ok(overlay);
    assert.equal(overlay.details.background, '#808080');
    assert.ok(Math.abs(overlay.details.ratio - 3.98) < 0.02, `ratio ${overlay.details.ratio}`);
  });

  test('compose les groupes d’opacité comme le navigateur (texte et fond estompés ensemble)', () => {
    const failing = snippetsOf(report, { id: '3.2', status: 'NC' });
    assert.doesNotMatch(failing, /faded-group/);
    assert.match(failing, /faded-fail/);
  });

  test('3.3 : icône seule d’une commande sous 3:1 (fill, stroke et currentColor)', () => {
    const icons = snippetsOf(report, { id: '3.3', rule: 'icon-contrast' });
    assert.match(icons, /icon-pale/);
    assert.doesNotMatch(icons, /icon-dark|icon-with-text/);
  });

  test('ignore le texte rogné par un conteneur, mesure celui d’une zone défilante', () => {
    const failing = snippetsOf(report, { id: '3.2', status: 'NC' });
    assert.doesNotMatch(failing, /clipped-text/);
    assert.match(failing, /scrolled-text/);
  });

  test('renvoie le texte sur dégradé en « à vérifier », pas en non-conformité', () => {
    const undetermined = findResults(report, { id: '3.2', rule: 'text-contrast-undetermined' });
    assert.equal(undetermined.length, 1);
    assert.equal(undetermined[0].status, 'NT');
  });
});

describe('7.1 / 7.3 / 10.8 — ARIA et scripts', () => {
  let report;
  before(async () => {
    report = await auditFixture(page, 'engine/aria.html');
  });

  test('accepte les rôles valides (tablist, tab, presentation, group, none, rôles de repli)', () => {
    const flagged = snippetsOf(report, { rule: 'aria-role-invalid' });
    assert.doesNotMatch(flagged, /tablist|role="tab"|presentation|role="group"|role="none"|valid-fallback-role/);
    assert.doesNotMatch(snippetsOf(report, { status: 'NC' }), /Onglets valides|tab-1|tab-2|panel-1/);
  });

  test('signale rôles inventés et abstraits', () => {
    const flagged = snippetsOf(report, { rule: 'aria-role-invalid' });
    assert.match(flagged, /invalid-role/);
    assert.match(flagged, /abstract-role/);
  });

  test('vérifie le contexte et le contenu requis des rôles', () => {
    assert.match(snippetsOf(report, { rule: 'aria-required-context' }), /orphan-tab/);
    assert.match(snippetsOf(report, { rule: 'aria-required-owned' }), /empty-tablist/);
  });

  test('détecte attributs mal orthographiés, valeurs invalides et références cassées', () => {
    assert.match(snippetsOf(report, { rule: 'aria-attr-unknown' }), /typo-attr/);
    assert.match(snippetsOf(report, { rule: 'aria-attr-value' }), /bad-value/);
    assert.match(snippetsOf(report, { rule: 'aria-idref-missing', status: 'NC' }), /missing-ref/);
    assert.match(snippetsOf(report, { rule: 'aria-idref-missing', status: 'NT' }), /lazy-controls/);
  });

  test('détecte états requis manquants et composants non focusables', () => {
    assert.match(snippetsOf(report, { rule: 'aria-required-state' }), /checkbox-no-state/);
    assert.match(snippetsOf(report, { id: '7.3', status: 'NC' }), /button-no-tabindex/);
    assert.match(snippetsOf(report, { id: '7.3', status: 'NC' }), /onclick-div/);
    assert.match(snippetsOf(report, { id: '10.8', status: 'NC' }), /Lien caché/);
  });
});

describe('6 / 11 — liens et formulaires', () => {
  let report;
  before(async () => {
    report = await auditFixture(page, 'engine/forms-links.html');
  });

  test('liens : intitulé absent (6.2), nom accessible sans le texte visible (6.1.5)', () => {
    assert.match(snippetsOf(report, { id: '6.2', status: 'NC' }), /link-empty/);
    assert.doesNotMatch(snippetsOf(report, { id: '6.2', status: 'NC' }), /link-icon-sr|link-ok/);
    assert.match(snippetsOf(report, { rule: 'link-label-in-name' }), /link-mismatch/);
    assert.doesNotMatch(snippetsOf(report, { rule: 'link-label-in-name' }), /link-match/);
    assert.match(snippetsOf(report, { rule: 'link-generic', status: 'NT' }), /link-generic/);
  });

  test('étiquettes : placeholder seul, label orphelin, étiquette implicite, nom ≠ visible', () => {
    assert.match(snippetsOf(report, { id: '11.1', status: 'NC', rule: 'field-label' }), /field-placeholder/);
    assert.match(snippetsOf(report, { rule: 'label-for-missing' }), /fantome/);
    assert.match(snippetsOf(report, { rule: 'label-implicit', status: 'NT' }), /field-implicit/);
    assert.match(snippetsOf(report, { rule: 'field-label-in-name' }), /field-mismatch/);
    assert.doesNotMatch(snippetsOf(report, { id: '11.1', status: 'NC' }), /field-ok/);
  });

  test('regroupements (11.5, 11.6) et autocomplete (11.13)', () => {
    assert.match(snippetsOf(report, { rule: 'choice-group' }), /name="choix"/);
    assert.match(snippetsOf(report, { rule: 'choice-group-legend' }), /fieldset-no-legend/);
    assert.doesNotMatch(snippetsOf(report, { rule: 'choice-group' }), /taille/);
    assert.match(snippetsOf(report, { rule: 'autocomplete-invalid' }), /field-bad-autocomplete/);
    assert.doesNotMatch(snippetsOf(report, { rule: 'autocomplete-invalid' }), /field-good-autocomplete/);
  });

  test('boutons : sans intitulé, nom accessible sans le texte visible (11.9)', () => {
    assert.match(snippetsOf(report, { rule: 'button-name' }), /btn-icon/);
    assert.match(snippetsOf(report, { rule: 'button-label-in-name' }), /btn-mismatch/);
    assert.doesNotMatch(snippetsOf(report, { rule: 'button-label-in-name' }), /card-ok/);
  });
});

describe('5 / 8 / 9 / 10 / 12 / 13 — structure et présentation', () => {
  let report;
  before(async () => {
    report = await auditFixture(page, 'engine/structure.html');
  });

  const has = (filter, pattern) => assert.match(snippetsOf(report, filter) + findResults(report, filter).map((r) => r.message).join('\n'), pattern);

  test('éléments obligatoires : id dupliqué, code de langue invalide', () => {
    has({ rule: 'duplicate-id' }, /id="dup"/);
    has({ rule: 'html-lang-valid' }, /francais/);
    has({ rule: 'element-lang-valid' }, /xx-/);
  });

  test('structure : listes, titres, zones', () => {
    has({ rule: 'list-children' }, /bad-list/);
    has({ rule: 'li-orphan' }, /orphan-li/);
    has({ rule: 'heading-empty' }, /<h2>/);
    has({ rule: 'aria-required-state', id: '9.1' }, /heading-no-level/);
    has({ rule: 'main-multiple' }, /main-2/);
  });

  test('présentation : balises et attributs de mise en forme, liens dans le texte', () => {
    has({ rule: 'presentation-tag' }, /center/);
    has({ rule: 'presentation-attr' }, /align/);
    has({ rule: 'link-in-text-distinguishable' }, /class="plain"/);
    assert.doesNotMatch(snippetsOf(report, { rule: 'link-in-text-distinguishable' }), /class="colored"/);
  });

  test('tableaux, navigation et consultation', () => {
    has({ rule: 'layout-table-data-markup' }, /layout-th/);
    has({ rule: 'th-association' }, /<th>Nom<\/th>/);
    has({ rule: 'headers-missing-ids' }, /absent/);
    has({ rule: 'skip-link-target' }, /contenu/);
    has({ rule: 'tabindex-positive' }, /tabindex="3"/);
    has({ rule: 'meta-redirect-delay' }, /30 s/);
    has({ rule: 'marquee-blink' }, /marquee/);
  });
});

describe('contenus révélés au défilement', () => {
  test('la page est parcourue et les fondus terminés avant la mesure', async () => {
    const { runDomRules } = require('../src/rules');
    const { fixtureUrl } = require('./helpers/browser');
    await page.goto(fixtureUrl('engine/reveal.html'));
    const results = await runDomRules(page);
    const failing = snippetsOf({ results }, { id: '3.2', status: 'NC' });
    assert.match(failing, /class="pale"/, 'le texte révélé doit être audité');
    assert.doesNotMatch(failing, /class="ok"/, 'pas de faux positif dû au fondu');
  });
});

describe('fixtures historiques', () => {
  test('la page conforme ne produit aucune non-conformité', async () => {
    const report = await auditFixture(page, 'conforme.html');
    const nc = report.results.filter((r) => r.status === 'NC');
    assert.deepEqual(nc.map((r) => `${r.id} ${r.message}`), []);
    assert.deepEqual(report.internalErrors, []);
  });

  test('la page non conforme est signalée sur les critères attendus', async () => {
    const report = await auditFixture(page, 'non-conforme.html');
    for (const id of ['1.1', '2.1', '6.2', '7.3', '8.3', '9.2', '11.1', '12.8']) {
      assert.equal(report.score.criteria[id], 'NC', `critère ${id}`);
    }
  });

  test('le moteur peut être injecté plusieurs fois dans la même page', async () => {
    await auditFixture(page, 'conforme.html');
    const again = await auditFixture(page, 'conforme.html');
    assert.ok(again.results.length > 0);
  });
});
