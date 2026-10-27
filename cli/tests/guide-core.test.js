'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../../extension/guide/guide-core.js');
const { FICHES, MISSIONS } = require('../../extension/shared/rgaa-guide-fiches.js');
const { RGAA_CRITERIA } = require('../../extension/shared/rgaa-criteria.js');

const COLLECTIONS = ['imagesInformative', 'imagesDecorative', 'frames', 'links', 'textLinks', 'headings', 'landmarks', 'tabOrder', 'fields', 'buttons', 'media', 'documents'];
const AIDS = ['alternatives', 'headings', 'landmarks', 'links', 'taborder', 'grayscale'];

test('fiches : critères, missions, modes, collections et aides valides', () => {
  assert.equal(FICHES.length, 15);
  const ids = new Set();
  for (const f of FICHES) {
    assert.ok(RGAA_CRITERIA[f.id], `${f.id} absent du référentiel`);
    assert.ok(!ids.has(f.id), `${f.id} en double`);
    ids.add(f.id);
    assert.ok(MISSIONS.some((m) => m.key === f.mission), `${f.id} : mission ${f.mission}`);
    assert.ok(['element', 'liste', 'page'].includes(f.mode), `${f.id} : mode`);
    assert.ok(['tous', 'pratique'].includes(f.niveau), `${f.id} : niveau`);
    if (f.mode !== 'page') assert.ok(COLLECTIONS.includes(f.collection), `${f.id} : collection`);
    if (f.collection) assert.ok(COLLECTIONS.includes(f.collection), `${f.id} : collection inconnue`);
    if (f.aide) assert.ok(AIDS.includes(f.aide), `${f.id} : aide ${f.aide}`);
    assert.ok(f.question.endsWith('?'), `${f.id} : la question doit être une question`);
    assert.ok(f.pourquoi && f.etapes.length && f.exemples.bon && f.exemples.mauvais.length && f.correction, `${f.id} : contenu incomplet`);
  }
});

test('plan : seules les fiches applicables, dans l’ordre des missions', () => {
  const inventory = { collections: Object.fromEntries(COLLECTIONS.map((c) => [c, []])) };
  inventory.collections.imagesInformative = [{ key: 'img', label: 'Logo' }];
  inventory.collections.links = [{ key: 'a', label: 'Agenda' }];
  const plan = Core.buildPlan(inventory, FICHES, MISSIONS);
  const ids = plan.map((s) => s.fiche.id);
  assert.ok(ids.includes('1.3') && ids.includes('6.1') && ids.includes('9.1') && ids.includes('3.1'));
  assert.ok(!ids.includes('1.2') && !ids.includes('4.3') && !ids.includes('13.3'));
  assert.ok(ids.indexOf('1.3') < ids.indexOf('6.1'));
});

const page = { url: 'https://asso.fr/agenda?mois=6', title: 'Agenda' };
const fiche = (id) => FICHES.find((f) => f.id === id);

test('statuts : élément par élément, liste et page', () => {
  const s = Core.createSession(page.url, '0.3.1');
  const items = [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }];
  Core.recordElement(s, page, fiche('1.3'), items[0], 'oui', 2);
  const entry = s.pages['/agenda?mois=6'].criteres['1.3'];
  assert.equal(Core.entryStatus(entry), null, 'incomplet');
  Core.recordElement(s, page, fiche('1.3'), items[1], 'oui', 2);
  assert.equal(Core.entryStatus(entry), 'C');
  Core.recordElement(s, page, fiche('1.3'), items[1], 'non', 2);
  assert.equal(Core.entryStatus(entry), 'NC');
  assert.deepEqual(Core.problems(entry), ['B']);

  Core.toggleFlag(s, page, fiche('6.1'), { key: 'l', label: 'En savoir plus' });
  assert.equal(Core.entryStatus(s.pages['/agenda?mois=6'].criteres['6.1']), 'NC');
  Core.toggleFlag(s, page, fiche('6.1'), { key: 'l', label: 'En savoir plus' });
  Core.recordPage(s, page, fiche('6.1'), 'oui');
  assert.equal(Core.entryStatus(s.pages['/agenda?mois=6'].criteres['6.1']), 'C');

  Core.recordPage(s, page, fiche('9.1'), 'nsp');
  assert.equal(Core.entryStatus(s.pages['/agenda?mois=6'].criteres['9.1']), 'NT');
  assert.throws(() => Core.recordPage(s, page, fiche('9.1'), 'peut-être'));
});

test('session : validation et fusion (la réponse la plus récente l’emporte)', () => {
  const a = Core.createSession(page.url);
  Core.recordPage(a, page, fiche('8.6'), 'oui');
  const b = JSON.parse(JSON.stringify(a));
  b.pages['/agenda?mois=6'].criteres['8.6'].reponse = 'non';
  b.pages['/agenda?mois=6'].criteres['8.6'].le = '2999-01-01T00:00:00.000Z';
  b.pages['/autre'] = { url: 'https://asso.fr/autre', titre: 'Autre', criteres: {} };
  assert.equal(Core.validateSession(b).ok, true);
  const merged = Core.mergeSessions(a, b);
  assert.equal(merged.pages['/agenda?mois=6'].criteres['8.6'].reponse, 'non');
  assert.ok(merged.pages['/autre']);

  assert.equal(Core.validateSession({}).ok, false);
  assert.equal(Core.validateSession({ format: Core.FORMAT, pages: { '/': { criteres: { '1.3': { mode: 'x' } } } } }).ok, false);
  assert.equal(Core.validateSession({ format: Core.FORMAT, pages: { '/': { criteres: { '<script>': { mode: 'page', elements: {}, signales: [] } } } } }).ok, false);
});

test('synthèse HTML : échappe le contenu venu de la page et indique la correction', () => {
  const s = Core.createSession(page.url);
  Core.recordElement(s, { url: page.url, title: '<b>Agenda</b>' }, fiche('1.3'), { key: 'x', label: '<img src=x onerror=alert(1)>' }, 'non', 1);
  const html = Core.synthesisHtml(s, { fiches: FICHES });
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /Non conforme/);
  assert.match(html, /Correction :/);
  assert.match(html, /<html lang="fr">/);
});
