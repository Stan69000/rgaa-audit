'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  _aggregateCriterionStatuses,
  _updateCriteriaRows,
} = require('../src/reporters/ods-grid');

test('aggregateCriterionStatuses applies NC > NA > C precedence', () => {
  const summary = _aggregateCriterionStatuses([
    { id: '1.1', status: 'C', message: 'ok' },
    { id: '1.1', status: 'NC', message: 'missing alt' },
    { id: '1.2', status: 'NA', message: 'manual' },
    { id: '1.2', status: 'NA', message: 'manual 2' },
    { id: '1.3', status: 'C', message: 'ok' },
  ]);

  assert.equal(summary.get('1.1').status, 'NC');
  assert.equal(summary.get('1.2').status, 'NA');
  assert.equal(summary.get('1.3').status, 'C');
  assert.match(summary.get('1.1').notes, /missing alt/);
});

test('updateCriteriaRows updates val1 status and remediation notes', () => {
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
