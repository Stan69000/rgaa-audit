'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMessage, findTemplateIssues, compareWithBaseline } = require('../src/aggregate');

const nc = (pageUrl, id, rule, message, count = 1) => ({ status: 'NC', pageUrl, id, rule, message, count });

test('un même constat est reconnu malgré compteurs et ratios', () => {
  assert.equal(
    normalizeMessage('Contraste insuffisant 2.77:1 (requis 4.5:1) — texte #8e8677 sur fond #e8e1d3. (6 occurrences)'),
    normalizeMessage('Contraste insuffisant 2.81:1 (requis 4.5:1) — texte #8e8677 sur fond #e8e1d3.'),
  );
  assert.notEqual(normalizeMessage('texte #8e8677'), normalizeMessage('texte #8e8678'));
});

test('défauts de gabarit : même non-conformité sur plusieurs pages', () => {
  const issues = findTemplateIssues([
    nc('https://s.fr/', '6.2', 'link-name', 'Lien sans intitulé. (2 occurrences)', 2),
    nc('https://s.fr/a', '6.2', 'link-name', 'Lien sans intitulé.'),
    nc('https://s.fr/b', '6.2', 'link-name', 'Lien sans intitulé. (3 occurrences)', 3),
    nc('https://s.fr/a', '1.1', 'img-alt-missing', 'Image sans attribut alt.'),
    { status: 'NT', pageUrl: 'https://s.fr/', id: '6.1', rule: 'link-generic', message: 'x' },
  ]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].pageCount, 3);
  assert.equal(issues[0].occurrences, 6);
});

test('comparaison avec la référence : nouvelles et résolues, par page', () => {
  const baseline = { engineVersion: '0.3.0', timestamp: '2026-10-01T00:00:00Z', results: [
    nc('https://s.fr/', '6.2', 'link-name', 'Lien sans intitulé. (2 occurrences)', 2),
    nc('https://s.fr/a', '1.1', 'img-alt-missing', 'Image sans attribut alt.'),
  ] };
  const current = { engineVersion: '0.3.0', results: [
    nc('https://s.fr/', '6.2', 'link-name', 'Lien sans intitulé. (5 occurrences)', 5),
    nc('https://s.fr/b', '1.1', 'img-alt-missing', 'Image sans attribut alt.'),
  ] };
  const diff = compareWithBaseline(current, baseline);
  assert.equal(diff.newCount, 1);
  assert.equal(diff.added[0].page, '/b');
  assert.equal(diff.resolvedCount, 1);
  assert.equal(diff.resolved[0].page, '/a');
  assert.equal(diff.engineChanged, false);
});
