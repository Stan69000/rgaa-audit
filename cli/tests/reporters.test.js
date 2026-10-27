'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateReport, _internals } = require('../src/reporters');

const REPORT = {
  url: 'https://exemple.test/',
  title: 'Exemple',
  timestamp: '2026-10-26T10:00:00.000Z',
  score: { taux: 50, conformes: 1, nonConformes: 1, aVerifier: 1, na: 0, total: 3, criteria: {} },
  results: [
    { id: '6.2', status: 'NC', resultType: 'probable_error', message: '=HYPERLINK("http://evil")', count: 3, selector: 'a', snippet: '<a href="#"></a>' },
    { id: '6.1', status: 'NT', resultType: 'heuristic_warning', message: 'Intitulé « ici »', remediationHint: 'Préciser' },
    { id: '8.5', status: 'C', resultType: 'good_signal', message: 'Titre présent' },
  ],
};

test('CSV : neutralise les formules et ajoute l’intitulé du critère', async () => {
  const csv = await generateReport(REPORT, 'csv');
  const lines = csv.split('\n');
  assert.equal(lines.length, 4);
  assert.match(lines[1], /"'=HYPERLINK\(""http:\/\/evil""\)"/);
  assert.match(lines[1], /Dans chaque page web, chaque lien a-t-il un intitulé/);
  assert.equal(_internals.csvCell('@SUM(A1)'), `"'@SUM(A1)"`);
  assert.equal(_internals.csvCell('a\nb'), '"a b"');
});

test('rapport vulgarisé : compte les critères à vérifier et liste les indices', async () => {
  const html = await generateReport(REPORT, 'vulgarized');
  assert.match(html, /Critères à vérifier/);
  assert.match(html, /À vérifier par une personne/);
  assert.match(html, /Intitulé « ici »/);
  assert.doesNotMatch(html, /=HYPERLINK\("http/);
});
