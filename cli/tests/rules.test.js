/**
 * tests/rules.test.js
 * Validation des règles enrichies du pré-audit RGAA.
 */
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { _internals } = require('../src/rules');

const {
  auditImagesAdvanced,
  auditLinksAndButtons,
  auditHeadingsAdvanced,
  auditFormsAdvanced,
  auditTablesAdvanced,
} = _internals;

function withDom(doc, fn) {
  const previousDocument = global.document;
  const previousWindow = global.window;
  const previousCSS = global.CSS;

  global.document = doc;
  global.window = { getComputedStyle: () => ({}) };
  global.CSS = { escape: (v) => String(v).replace(/"/g, '\\"') };

  try {
    return fn();
  } finally {
    global.document = previousDocument;
    global.window = previousWindow;
    global.CSS = previousCSS;
  }
}

function createNode({
  tagName = 'div',
  attrs = {},
  text = '',
  innerText = '',
  outerHTML,
  className = '',
  query = {},
  queryAll = {},
  closest = {},
  children = [],
  naturalWidth = 0,
  naturalHeight = 0,
} = {}) {
  return {
    tagName: String(tagName).toUpperCase(),
    className,
    textContent: text,
    innerText: innerText || text,
    outerHTML: outerHTML || `<${tagName}></${tagName}>`,
    children,
    naturalWidth,
    naturalHeight,
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name);
    },
    querySelector(selector) {
      return Object.prototype.hasOwnProperty.call(query, selector) ? query[selector] : null;
    },
    querySelectorAll(selector) {
      return Object.prototype.hasOwnProperty.call(queryAll, selector) ? queryAll[selector] : [];
    },
    closest(selector) {
      return Object.prototype.hasOwnProperty.call(closest, selector) ? closest[selector] : null;
    },
  };
}

function createDoc(map, bodyText = '') {
  return {
    body: { innerText: bodyText },
    documentElement: { getAttribute: () => 'fr' },
    title: 'Test',
    doctype: { name: 'html' },
    querySelectorAll(selector) {
      return Object.prototype.hasOwnProperty.call(map, selector) ? map[selector] : [];
    },
    querySelector(selector) {
      return Object.prototype.hasOwnProperty.call(map, selector) ? map[selector][0] || null : null;
    },
    getElementById() {
      return null;
    },
  };
}

describe('Phase 3 — Images', () => {
  test('image sans alt => probable_error / confidence high', () => {
    const img = createNode({ tagName: 'img', attrs: { src: '/hero.jpg' }, outerHTML: '<img src="/hero.jpg">' });
    const doc = createDoc({ 'img': [img], 'a img': [] });

    const results = withDom(doc, () => auditImagesAdvanced());
    const finding = results.find((r) => r.message.includes('sans attribut alt'));

    assert.ok(finding);
    assert.equal(finding.resultType, 'probable_error');
    assert.equal(finding.confidence, 'high');
  });

  test('alt générique => heuristic_warning / confidence medium', () => {
    const img = createNode({
      tagName: 'img',
      attrs: { alt: 'image', src: '/photo.jpg' },
      outerHTML: '<img alt="image" src="/photo.jpg">',
      naturalWidth: 120,
      naturalHeight: 120,
    });
    const doc = createDoc({ 'img': [img], 'a img': [] });

    const results = withDom(doc, () => auditImagesAdvanced());
    const finding = results.find((r) => r.message.includes('trop générique'));

    assert.ok(finding);
    assert.equal(finding.resultType, 'heuristic_warning');
    assert.equal(finding.confidence, 'medium');
  });
});

describe('Phase 3 — Liens et boutons', () => {
  test('lien icône sans nom => probable_error', () => {
    const img = createNode({ tagName: 'img', attrs: { alt: '' }, outerHTML: '<img alt="">' });
    const link = createNode({
      tagName: 'a',
      attrs: { href: '/home' },
      text: '',
      query: { 'img': img },
      outerHTML: '<a href="/home"><img alt=""></a>',
    });

    const doc = createDoc({
      'a[href]': [link],
      'button, input[type="button"], input[type="submit"], input[type="reset"]': [],
      'div[onclick], span[onclick]': [],
    });

    const results = withDom(doc, () => auditLinksAndButtons());
    const finding = results.find((r) => r.message.includes('Lien sans nom accessible'));

    assert.ok(finding);
    assert.equal(finding.resultType, 'probable_error');
  });

  test('"cliquez ici" => heuristic_warning', () => {
    const link = createNode({
      tagName: 'a',
      attrs: { href: '/x' },
      text: 'Cliquez ici',
      outerHTML: '<a href="/x">Cliquez ici</a>',
    });
    const doc = createDoc({
      'a[href]': [link],
      'button, input[type="button"], input[type="submit"], input[type="reset"]': [],
      'div[onclick], span[onclick]': [],
    });

    const results = withDom(doc, () => auditLinksAndButtons());
    const finding = results.find((r) => r.message.includes('ambigu'));

    assert.ok(finding);
    assert.equal(finding.resultType, 'heuristic_warning');
  });
});

describe('Phase 3 — Titres et structure', () => {
  test('absence de h1 => probable_error', () => {
    const h2 = createNode({ tagName: 'h2', text: 'Section', outerHTML: '<h2>Section</h2>' });
    const doc = createDoc({
      'h1,h2,h3,h4,h5,h6': [h2],
      'h1': [],
      'div, p, span': [],
    }, 'Contenu'.repeat(400));

    const results = withDom(doc, () => auditHeadingsAdvanced());
    const finding = results.find((r) => r.message.includes('Absence de h1'));

    assert.ok(finding);
    assert.equal(finding.resultType, 'probable_error');
  });

  test('saut de niveau => heuristic_warning', () => {
    const h1 = createNode({ tagName: 'h1', text: 'Titre', outerHTML: '<h1>Titre</h1>' });
    const h3 = createNode({ tagName: 'h3', text: 'Sous titre', outerHTML: '<h3>Sous titre</h3>' });
    const doc = createDoc({
      'h1,h2,h3,h4,h5,h6': [h1, h3],
      'h1': [h1],
      'div, p, span': [],
    });

    const results = withDom(doc, () => auditHeadingsAdvanced());
    const finding = results.find((r) => r.message.includes('Saut de niveau'));

    assert.ok(finding);
    assert.equal(finding.resultType, 'heuristic_warning');
  });
});

describe('Phase 3 — Formulaires', () => {
  test('placeholder seul => résultat cohérent', () => {
    const input = createNode({
      tagName: 'input',
      attrs: { id: 'name', placeholder: 'Votre nom' },
      outerHTML: '<input id="name" placeholder="Votre nom">',
    });

    const doc = createDoc({
      'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]), select, textarea': [input],
      'form': [],
      'label[for="name"]': [],
    });

    const results = withDom(doc, () => auditFormsAdvanced());
    const finding = results.find((r) => r.message.includes('Placeholder utilisé'));

    assert.ok(finding);
    assert.equal(finding.resultType, 'probable_error');
    assert.equal(finding.confidence, 'high');
  });
});

describe('Phase 3 — Tableaux', () => {
  test('tableau sans th => probable_error sur cas simple', () => {
    const tr1 = createNode({ tagName: 'tr', children: [{}, {}] });
    const tr2 = createNode({ tagName: 'tr', children: [{}, {}] });
    const table = createNode({
      tagName: 'table',
      outerHTML: '<table><tr><td>A</td><td>B</td></tr><tr><td>1</td><td>2</td></tr></table>',
      queryAll: {
        'tr': [tr1, tr2],
        'th': [],
      },
      query: {
        'caption': null,
      },
    });

    const doc = createDoc({
      'table': [table],
    });

    const results = withDom(doc, () => auditTablesAdvanced());
    const finding = results.find((r) => r.message.includes('sans cellule d’en-tête'));

    assert.ok(finding);
    assert.equal(finding.resultType, 'probable_error');
  });
});

describe('Phase 3 — Structure enrichie', () => {
  test('les champs enrichis sont toujours présents', () => {
    const img = createNode({ tagName: 'img', attrs: { src: '/hero.jpg' }, outerHTML: '<img src="/hero.jpg">' });
    const doc = createDoc({ 'img': [img], 'a img': [] });

    const results = withDom(doc, () => auditImagesAdvanced());
    assert.ok(results.length > 0);

    for (const item of results) {
      assert.ok(Object.prototype.hasOwnProperty.call(item, 'severity'));
      assert.ok(Object.prototype.hasOwnProperty.call(item, 'confidence'));
      assert.ok(Object.prototype.hasOwnProperty.call(item, 'resultType'));
      assert.ok(Object.prototype.hasOwnProperty.call(item, 'manualReviewRecommended'));
      assert.ok(Object.prototype.hasOwnProperty.call(item, 'rationale'));
      assert.ok(Object.prototype.hasOwnProperty.call(item, 'remediationHint'));
    }
  });
});
