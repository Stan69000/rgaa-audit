'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  _aggregateCriterionStatuses,
  _updateCriteriaRows,
} = require('../src/reporters/ods-grid');

test('aggregateCriterionStatuses : NC > à vérifier (NT) > C > NA', () => {
  const summary = _aggregateCriterionStatuses([
    { id: '1.1', status: 'C', message: 'ok' },
    { id: '1.1', status: 'NC', message: 'missing alt' },
    { id: '1.2', status: 'NA', message: 'aucune image' },
    { id: '1.3', status: 'C', message: 'ok' },
    { id: '6.1', status: 'C', message: 'ok' },
    { id: '6.1', status: 'NT', resultType: 'heuristic_warning', message: 'intitulé « ici »' },
    { id: '6.1', status: 'NT', resultType: 'manual_only', message: 'rappel générique' },
  ]);

  assert.equal(summary.get('1.1').status, 'NC');
  assert.equal(summary.get('1.2').status, 'NA');
  assert.equal(summary.get('1.3').status, 'C');
  assert.equal(summary.get('6.1').status, 'NT');
  assert.match(summary.get('1.1').notes, /missing alt/);
  assert.equal(summary.get('6.1').notes, 'À vérifier : intitulé « ici »');
});

test('updateCriteriaRows met à jour le statut et les notes de remédiation', () => {
  const rowXml = [
    '<table:table-row>',
    '<table:table-cell table:style-name="ce65" office:string-value="1.1"><text:p>1.1</text:p></table:table-cell>',
    '<table:table-cell table:style-name="ce139" table:content-validation-name="val1" office:value-type="string"><text:p>NT</text:p></table:table-cell>',
    '<table:table-cell table:style-name="ce140" table:content-validation-name="val2" office:value-type="string"><text:p>N</text:p></table:table-cell>',
    '<table:table-cell table:style-name="ce156" table:number-columns-repeated="2"/>',
    '</table:table-row>',
  ].join('');

  const updated = _updateCriteriaRows(rowXml, new Map([
    ['1.1', { status: 'NC', notes: 'Image sans attribut alt' }],
  ]));

  assert.match(updated, /table:content-validation-name="val1"[^>]*office:string-value="NC"/);
  assert.match(updated, /<text:p>NC<\/text:p>/);
  assert.match(updated, /Image sans attribut alt/);
});
