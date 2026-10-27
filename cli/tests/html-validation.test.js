'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { launch, fixtureUrl } = require('./helpers/browser');
const { validatePageHtml } = require('../src/html-validation');

test('8.2 : erreurs d’imbrication du code généré, sans doublon avec le contrôle des id', async () => {
  const { browser, page } = await launch();
  try {
    await page.goto(fixtureUrl('engine/structure.html'));
    const findings = await validatePageHtml(page);
    assert.ok(findings.every((f) => f.id === '8.2' && f.source === 'html-validate'));
    assert.ok(findings.some((f) => f.rule === 'html-element-permitted-content' && f.status === 'NC'));
    assert.ok(!findings.some((f) => f.rule === 'html-no-dup-id'));

    await page.setContent('<!DOCTYPE html><html lang="fr"><head><title>Valide</title></head><body><main><p>Bonjour</p></main></body></html>');
    const clean = await validatePageHtml(page);
    assert.deepEqual(clean.map((f) => f.status), ['C']);
  } finally {
    await browser.close();
  }
});
