'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadScript(filePath, extraContext) {
  const source = fs.readFileSync(filePath, 'utf8');
  const context = vm.createContext({
    module: { exports: {} },
    exports: {},
    console: { log: () => {} },
    ...extraContext,
  });
  vm.runInContext(source, context, { filename: filePath });
  return { context, exports: context.module.exports };
}

function createFakeElement(tagName = 'div') {
  return {
    tagName: tagName.toUpperCase(),
    attributes: {},
    children: [],
    style: {},
    dataset: {},
    textContent: '',
    disabled: false,
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    addEventListener() {},
    remove() {},
    click() {},
  };
}

test('panel: renderResultItem utilise textContent et neutralise HTML non fiable', () => {
  const ids = [
    'btnAudit', 'results', 'scoreBar', 'filters', 'footer', 'urlDisplay', 'scoreExplain',
    'btnExport', 'btnExportHtml', 'scoreCircle', 'scoreValue', 'statNC', 'statC', 'statNA', 'statTotal',
  ];
  const byId = Object.fromEntries(ids.map((id) => [id, createFakeElement()]));

  const document = {
    body: createFakeElement('body'),
    createElement: (tag) => createFakeElement(tag),
    getElementById: (id) => byId[id] || createFakeElement(),
    querySelectorAll: () => [],
  };

  const panelPath = path.resolve(__dirname, '..', 'panel', 'panel.js');
  const { exports } = loadScript(panelPath, {
    document,
    chrome: { runtime: { sendMessage() {} } },
    URL: { createObjectURL: () => 'blob:fake', revokeObjectURL() {} },
    Blob: function Blob() {},
    window: {},
  });

  const item = exports.renderResultItem({
    id: '1.1',
    status: 'NC',
    message: '<img src=x onerror=alert(1)>',
    snippet: '<script>alert(2)</script>',
    xpath: '//*[@id="x"]',
  });

  assert.equal(item.attributes.class, 'result-item');
  assert.equal(item.children[2].textContent, '<img src=x onerror=alert(1)>');
  assert.equal(item.children[2].children[0].textContent, '<script>alert(2)</script>');
});

test('content: ids spéciaux sont échappés dans les sélecteurs CSS', () => {
  const contentPath = path.resolve(__dirname, '..', 'content.js');
  const { exports: withCss } = loadScript(contentPath, {
    CSS: { escape: (value) => `ESC(${value})` },
    location: { href: 'https://example.test' },
    chrome: { runtime: { id: 'ext-id', onMessage: { addListener() {} } } },
    document: { querySelectorAll: () => [] },
  });
  assert.equal(withCss.buildLabelForSelectorById('x"y'), 'label[for="ESC(x"y)"]');

  const { exports: withoutCss } = loadScript(contentPath, {
    location: { href: 'https://example.test' },
    chrome: { runtime: { id: 'ext-id', onMessage: { addListener() {} } } },
    document: { querySelectorAll: () => [] },
  });
  assert.equal(
    withoutCss.buildLabelForSelectorById('field"]#id'),
    'label[for="field\\\"\\]\\#id"]',
  );
});

test('content: un cas isolé dans auditForms ne casse pas toute la boucle', () => {
  const contentPath = path.resolve(__dirname, '..', 'content.js');
  const input1 = {
    nodeType: 1,
    tagName: 'INPUT',
    outerHTML: '<input id="broken" />',
    getAttribute(name) {
      if (name === 'id') return 'broken';
      return null;
    },
    hasAttribute() { return false; },
    closest() { return null; },
  };
  const input2 = {
    nodeType: 1,
    tagName: 'INPUT',
    outerHTML: '<input id="safe" aria-label="Nom" />',
    getAttribute(name) {
      if (name === 'id') return 'safe';
      if (name === 'aria-label') return 'Nom';
      return null;
    },
    hasAttribute() { return false; },
    closest() { return null; },
  };

  const { exports } = loadScript(contentPath, {
    location: { href: 'https://example.test' },
    chrome: { runtime: { id: 'ext-id', onMessage: { addListener() {} } } },
    document: {
      querySelectorAll(selector) {
        if (selector.startsWith('input:not')) return [input1, input2];
        if (selector === 'button, input[type="submit"], input[type="button"]') return [];
        return [];
      },
      querySelector(selector) {
        if (selector.includes('broken')) {
          throw new Error('invalid selector');
        }
        return null;
      },
    },
  });

  exports._results.length = 0;
  assert.doesNotThrow(() => exports.auditForms());
  assert.ok(exports._results.length > 0);
});

test('background: rejette les actions non autorisées côté listener', () => {
  let listener;
  const backgroundPath = path.resolve(__dirname, '..', 'background.js');
  loadScript(backgroundPath, {
    chrome: {
      runtime: {
        lastError: null,
        onMessage: { addListener(fn) { listener = fn; } },
      },
      tabs: { query: async () => [] },
      scripting: { executeScript: async () => {} },
    },
  });

  let payload;
  const keepAlive = listener({ action: 'hack' }, { id: 'bad-sender' }, (response) => {
    payload = response;
  });
  assert.equal(keepAlive, false);
  assert.equal(payload.success, false);
  assert.match(payload.error, /Action non autorisée/);
});

test('background: valide la forme minimale du rapport', () => {
  const backgroundPath = path.resolve(__dirname, '..', 'background.js');
  const { exports } = loadScript(backgroundPath, {
    chrome: {
      runtime: { lastError: null, onMessage: { addListener() {} } },
      tabs: { query: async () => [] },
      scripting: { executeScript: async () => {} },
    },
  });

  assert.equal(exports.isValidReportShape({ results: [], score: {} }), true);
  assert.equal(exports.isValidReportShape({ results: 'x', score: {} }), false);
  assert.equal(exports.isValidReportShape({ results: [], score: null }), false);

  const fallback = exports.createFallbackReport({ url: 'https://example.test' });
  assert.equal(Array.isArray(fallback.results), true);
  assert.equal(typeof fallback.score, 'object');
  assert.equal(typeof fallback.score.taux, 'number');
});
