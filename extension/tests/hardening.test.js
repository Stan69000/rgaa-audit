'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const BACKGROUND = path.resolve(__dirname, '..', 'background.js');

function loadBackground(chromeStub, extra = {}) {
  let listener = null;
  const chrome = {
    runtime: {
      id: 'ext-id',
      lastError: null,
      onMessage: { addListener(fn) { listener = fn; } },
    },
    tabs: { query: async () => [{ id: 7 }] },
    scripting: { executeScript: async () => [] },
    ...chromeStub,
  };
  const context = vm.createContext({ module: { exports: {} }, exports: {}, console, setTimeout, chrome, ...extra });
  vm.runInContext(fs.readFileSync(BACKGROUND, 'utf8'), context, { filename: BACKGROUND });
  return { exports: context.module.exports, listener: () => listener, chrome };
}

function send(listener, message, sender = { id: 'ext-id' }) {
  return new Promise((resolve) => {
    const keepAlive = listener(message, sender, resolve);
    if (keepAlive === false) return;
  });
}

test('background : rejette les actions non autorisées', async () => {
  const { listener } = loadBackground();
  const response = await send(listener(), { action: 'hack' });
  assert.equal(response.success, false);
  assert.match(response.error, /Action non autorisée/);
});

test('background : rejette un émetteur étranger', async () => {
  const { listener } = loadBackground();
  const response = await send(listener(), { action: 'getAuditResults' }, { id: 'autre-extension' });
  assert.equal(response.success, false);
  assert.match(response.error, /Émetteur non autorisé/);
});

test('background : injecte le moteur partagé puis renvoie le rapport', async () => {
  const calls = [];
  const report = { results: [], score: { taux: 100 }, url: 'https://exemple.test' };
  const { listener } = loadBackground({
    scripting: {
      executeScript: async (details) => {
        calls.push(details);
        return details.func ? [{ result: report }] : [];
      },
    },
  });
  const response = await send(listener(), { action: 'getAuditResults' });
  assert.equal(response.success, true);
  assert.deepEqual([...calls[0].files], ['shared/rgaa-rules.js']);
  assert.equal(calls[0].target.tabId, 7);
  assert.equal(typeof calls[1].func, 'function');
  assert.equal(response.report.url, 'https://exemple.test');
});

test('background : remplace un rapport mal formé par un rapport de secours', async () => {
  const { listener } = loadBackground({
    scripting: { executeScript: async (d) => (d.func ? [{ result: { results: 'x' } }] : []) },
  });
  const response = await send(listener(), { action: 'getAuditResults' });
  assert.equal(response.success, true);
  assert.equal(response.report.results.length, 0);
  assert.match(response.report.internalErrors[0].message, /invalide/);
});

test('background : message clair sur les pages protégées', async () => {
  const { listener } = loadBackground({
    scripting: { executeScript: async () => { throw new Error('Cannot access a chrome:// URL'); } },
  });
  const response = await send(listener(), { action: 'getAuditResults' });
  assert.equal(response.success, false);
  assert.match(response.error, /protégée par le navigateur/);
});

test('background : la mise en évidence refuse un sélecteur vide ou démesuré', async () => {
  const { listener } = loadBackground();
  assert.equal((await send(listener(), { action: 'highlightElement', selector: '' })).success, false);
  assert.equal((await send(listener(), { action: 'highlightElement', selector: 'a'.repeat(600) })).success, false);
});

test('background : highlightInPage ne plante pas sur un sélecteur invalide', () => {
  const { exports } = loadBackground({}, {
    document: { querySelector() { throw new Error('SyntaxError'); } },
  });
  assert.equal(exports.highlightInPage('a[['), false);
});
