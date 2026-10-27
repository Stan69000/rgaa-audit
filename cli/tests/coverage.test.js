/**
 * La documentation de couverture ne doit pas mentir : chaque critère annoncé comme contrôlé
 * l'est dans le code, chaque critère contrôlé est documenté, et docs/RGAA-mapping.md est à jour.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { COVERAGE } = require('../scripts/coverage');
const { buildMarkdown } = require('../scripts/generate-docs');
const { RGAA_CRITERIA } = require('../../extension/shared/rgaa-criteria.js');

const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function criteriaReferencedIn(source) {
  return new Set([...source.matchAll(/'(\d{1,2}\.\d{1,2})'/g)].map((m) => m[1]).filter((id) => RGAA_CRITERIA[id]));
}

const engine = criteriaReferencedIn(read('extension/shared/rgaa-rules.js'));
const simulator = criteriaReferencedIn(read('cli/src/simulator.js'));

test('les 106 critères du référentiel sont décrits', () => {
  assert.deepEqual(Object.keys(COVERAGE).sort(), Object.keys(RGAA_CRITERIA).sort());
});

test('aucun critère documenté « manuel » ne produit de non-conformité', async () => {
  const { launch, auditFixture } = require('./helpers/browser');
  const { browser, page } = await launch();
  const flagged = new Set([...read('cli/src/simulator.js').matchAll(/out\.error\('(\d+\.\d+)'/g)].map((m) => m[1]));
  try {
    const fixtures = fs.readdirSync(path.join(__dirname, 'fixtures', 'engine')).map((f) => `engine/${f}`);
    for (const fixture of [...fixtures, 'non-conforme.html', 'conforme.html']) {
      const report = await auditFixture(page, fixture);
      report.results.filter((r) => r.status === 'NC').forEach((r) => flagged.add(r.id));
    }
  } finally {
    await browser.close();
  }
  assert.ok(flagged.size > 20, `seulement ${flagged.size} critères exercés par les fixtures`);
  for (const id of flagged) {
    assert.notEqual(COVERAGE[id].level, 'manual', `${id} produit des non-conformités mais est documenté « manuel »`);
  }
});

test('tout critère documenté comme contrôlé est réellement référencé dans le code', () => {
  for (const [id, c] of Object.entries(COVERAGE)) {
    if (c.level === 'manual') continue;
    const inCode = c.where === 'cli' ? simulator.has(id) : engine.has(id) || simulator.has(id);
    assert.ok(inCode, `${id} annoncé « ${c.level} » (${c.where}) mais absent du code`);
  }
});

test('docs/RGAA-mapping.md est à jour (npm run docs:coverage)', () => {
  assert.equal(read('docs/RGAA-mapping.md'), `${buildMarkdown().markdown}\n`);
});
