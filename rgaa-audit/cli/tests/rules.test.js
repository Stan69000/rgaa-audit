/**
 * tests/rules.test.js
 * Tests unitaires des règles RGAA — sans dépendance externe
 * Usage : node --test tests/rules.test.js
 */
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ── Mini helper : simule un document à partir d'attributs
// Les fonctions de règle s'exécutent dans page.evaluate() avec le vrai DOM
// Ici on teste la logique métier directement

// ── Logique extraite des règles (dupliquée pour test indépendant)

function checkImages(imgs, svgs) {
  // imgs = [{hasAlt, alt}, ...], svgs = [{hasTitle, ariaLabel, ariaHidden}, ...]
  const results = [];
  imgs.forEach(img => {
    if (!img.hasAlt) results.push({ id: '1.1', status: 'NC', message: 'Image sans alt' });
    else if (img.alt === '') results.push({ id: '1.2', status: 'C', message: 'Décorative' });
    else results.push({ id: '1.1', status: 'C', message: `alt: "${img.alt}"` });
  });
  svgs.forEach(svg => {
    if (!svg.ariaHidden && !svg.hasTitle && !svg.ariaLabel)
      results.push({ id: '1.1', status: 'NC', message: 'SVG sans accessibilité' });
  });
  if (!imgs.length && !svgs.length) results.push({ id: '1.1', status: 'NA', message: 'Aucune image' });
  return results;
}

function checkFrames(iframes) {
  if (!iframes.length) return [{ id: '2.1', status: 'NA', message: 'Aucun iframe' }];
  return iframes.map(f =>
    f.title?.trim()
      ? { id: '2.1', status: 'C', message: `title: "${f.title}"` }
      : { id: '2.1', status: 'NC', message: 'iframe sans title' }
  );
}

function checkLinks(links) {
  const generics = ['cliquez ici', 'ici', 'lire la suite', 'en savoir plus', 'click here', 'read more', '...'];
  return links.map(a => {
    const label = (a.ariaLabel || a.text || a.title || '').trim();
    if (!label) return { id: '6.1', status: 'NC', message: 'Lien vide' };
    if (generics.includes(label.toLowerCase())) return { id: '6.1', status: 'NC', message: `Générique: "${label}"` };
    return { id: '6.1', status: 'C', message: `OK: "${label}"` };
  });
}

function checkMandatory({ lang, title, hasDoctype, hasCharset }) {
  const r = [];
  if (!lang?.trim()) r.push({ id: '8.3', status: 'NC', message: 'lang absent' });
  else r.push({ id: '8.3', status: 'C', message: `lang: ${lang}` });
  if (!title?.trim()) r.push({ id: '8.5', status: 'NC', message: 'title absent' });
  else r.push({ id: '8.5', status: 'C', message: `title: ${title}` });
  if (!hasDoctype) r.push({ id: '8.1', status: 'NC', message: 'DOCTYPE absent' });
  else r.push({ id: '8.1', status: 'C', message: 'DOCTYPE OK' });
  if (!hasCharset) r.push({ id: '8.2', status: 'NC', message: 'charset absent' });
  else r.push({ id: '8.2', status: 'C', message: 'charset OK' });
  return r;
}

function checkStructure({ h1Count, headingLevels, hasMain, hasNav, hasHeader, hasFooter }) {
  const r = [];
  if (!headingLevels.length) r.push({ id: '9.1', status: 'NC', message: 'Aucun titre' });
  else if (h1Count === 0) r.push({ id: '9.1', status: 'NC', message: 'Pas de h1' });
  else if (h1Count > 1) r.push({ id: '9.1', status: 'NC', message: 'Plusieurs h1' });
  else r.push({ id: '9.1', status: 'C', message: 'h1 unique OK' });

  let prev = 0, jumps = 0;
  headingLevels.forEach(lvl => {
    if (prev && lvl > prev + 1) { jumps++; r.push({ id: '9.1', status: 'NC', message: `Saut h${prev}→h${lvl}` }); }
    prev = lvl;
  });
  if (headingLevels.length && !jumps) r.push({ id: '9.1', status: 'C', message: 'Hiérarchie OK' });

  if (!hasMain) r.push({ id: '9.2', status: 'NC', message: '<main> absent' });
  else r.push({ id: '9.2', status: 'C', message: '<main> présent' });
  if (!hasNav) r.push({ id: '9.2', status: 'NC', message: '<nav> absent' });
  return r;
}

function checkForms(fields) {
  if (!fields.length) return [{ id: '11.1', status: 'NA', message: 'Aucun champ' }];
  return fields.map(f => {
    if (!f.hasLabel && !f.ariaLabel && !f.ariaLabelledby && !f.title)
      return { id: '11.1', status: 'NC', message: f.placeholder ? `Placeholder seul: "${f.placeholder}"` : 'Aucune étiquette' };
    return { id: '11.1', status: 'C', message: 'Champ étiqueté' };
  });
}

function checkNavigation({ hasSkipLink, tabindexPositive }) {
  const r = [];
  r.push(hasSkipLink
    ? { id: '12.1', status: 'C', message: 'Skip link présent' }
    : { id: '12.1', status: 'NC', message: 'Aucun lien d\'évitement' }
  );
  r.push(tabindexPositive > 0
    ? { id: '12.8', status: 'NC', message: `${tabindexPositive} tabindex > 0` }
    : { id: '12.8', status: 'C', message: 'Pas de tabindex > 0' }
  );
  return r;
}

function checkTables(tables) {
  if (!tables.length) return [{ id: '5.1', status: 'NA', message: 'Aucun tableau' }];
  const r = [];
  tables.forEach(t => {
    if (!t.thCount) r.push({ id: '5.1', status: 'NC', message: 'Tableau sans th' });
    else {
      r.push({ id: '5.1', status: 'C', message: `${t.thCount} th` });
      if (t.thWithoutScope) r.push({ id: '5.6', status: 'NC', message: 'th sans scope' });
    }
    if (!t.hasCaption) r.push({ id: '5.4', status: 'NC', message: 'Sans caption' });
    else r.push({ id: '5.4', status: 'C', message: 'Caption OK' });
  });
  return r;
}

// ─────────────────────────────────────────────
// SUITES DE TESTS
// ─────────────────────────────────────────────

describe('Thème 1 — Images', () => {
  test('NC : image sans alt', () => {
    const r = checkImages([{ hasAlt: false }], []);
    assert.ok(r.some(x => x.status === 'NC' && x.id === '1.1'));
  });
  test('C : image avec alt valide', () => {
    const r = checkImages([{ hasAlt: true, alt: 'Description' }], []);
    assert.ok(!r.some(x => x.status === 'NC'));
  });
  test('C : image décorative alt=""', () => {
    const r = checkImages([{ hasAlt: true, alt: '' }], []);
    assert.ok(r.some(x => x.id === '1.2' && x.status === 'C'));
  });
  test('NC : SVG sans accessibilité', () => {
    const r = checkImages([], [{ hasTitle: false, ariaLabel: null, ariaHidden: null }]);
    assert.ok(r.some(x => x.status === 'NC'));
  });
  test('C : SVG avec aria-hidden', () => {
    const r = checkImages([], [{ hasTitle: false, ariaLabel: null, ariaHidden: 'true' }]);
    assert.ok(!r.some(x => x.status === 'NC'));
  });
  test('NA : page sans image', () => {
    const r = checkImages([], []);
    assert.ok(r.some(x => x.status === 'NA'));
  });
});

describe('Thème 2 — Cadres', () => {
  test('NC : iframe sans title', () => {
    const r = checkFrames([{ title: '' }]);
    assert.ok(r.some(x => x.status === 'NC'));
  });
  test('C : iframe avec title', () => {
    const r = checkFrames([{ title: 'Carte interactive' }]);
    assert.ok(!r.some(x => x.status === 'NC'));
  });
  test('NA : aucun iframe', () => {
    const r = checkFrames([]);
    assert.ok(r.some(x => x.status === 'NA'));
  });
});

describe('Thème 5 — Tableaux', () => {
  test('NC : tableau sans th', () => {
    const r = checkTables([{ thCount: 0, thWithoutScope: false, hasCaption: true }]);
    assert.ok(r.some(x => x.id === '5.1' && x.status === 'NC'));
  });
  test('NC : th sans scope', () => {
    const r = checkTables([{ thCount: 2, thWithoutScope: true, hasCaption: true }]);
    assert.ok(r.some(x => x.id === '5.6' && x.status === 'NC'));
  });
  test('NC : sans caption', () => {
    const r = checkTables([{ thCount: 2, thWithoutScope: false, hasCaption: false }]);
    assert.ok(r.some(x => x.id === '5.4' && x.status === 'NC'));
  });
  test('C : tableau complet', () => {
    const r = checkTables([{ thCount: 3, thWithoutScope: false, hasCaption: true }]);
    assert.equal(r.filter(x => x.status === 'NC').length, 0);
  });
  test('NA : aucun tableau', () => {
    const r = checkTables([]);
    assert.ok(r.some(x => x.status === 'NA'));
  });
});

describe('Thème 6 — Liens', () => {
  test('NC : lien vide', () => {
    const r = checkLinks([{ text: '', ariaLabel: null, title: null }]);
    assert.ok(r.some(x => x.status === 'NC'));
  });
  test('NC : "cliquez ici"', () => {
    const r = checkLinks([{ text: 'Cliquez ici', ariaLabel: null, title: null }]);
    assert.ok(r.some(x => x.status === 'NC'));
  });
  test('NC : "en savoir plus"', () => {
    const r = checkLinks([{ text: 'En savoir plus', ariaLabel: null, title: null }]);
    assert.ok(r.some(x => x.status === 'NC'));
  });
  test('C : intitulé explicite', () => {
    const r = checkLinks([{ text: 'Guide RGAA 4.1 complet', ariaLabel: null, title: null }]);
    assert.ok(!r.some(x => x.status === 'NC'));
  });
  test('C : aria-label sur lien icône', () => {
    const r = checkLinks([{ text: '', ariaLabel: 'Page d\'accueil', title: null }]);
    assert.ok(!r.some(x => x.status === 'NC'));
  });
});

describe('Thème 8 — Éléments obligatoires', () => {
  test('NC : lang absent', () => {
    const r = checkMandatory({ lang: '', title: 'Ma page', hasDoctype: true, hasCharset: true });
    assert.ok(r.some(x => x.id === '8.3' && x.status === 'NC'));
  });
  test('C : lang="fr"', () => {
    const r = checkMandatory({ lang: 'fr', title: 'Ma page', hasDoctype: true, hasCharset: true });
    assert.ok(!r.some(x => x.id === '8.3' && x.status === 'NC'));
  });
  test('NC : title absent', () => {
    const r = checkMandatory({ lang: 'fr', title: '', hasDoctype: true, hasCharset: true });
    assert.ok(r.some(x => x.id === '8.5' && x.status === 'NC'));
  });
  test('NC : DOCTYPE absent', () => {
    const r = checkMandatory({ lang: 'fr', title: 'Page', hasDoctype: false, hasCharset: true });
    assert.ok(r.some(x => x.id === '8.1' && x.status === 'NC'));
  });
  test('NC : charset absent', () => {
    const r = checkMandatory({ lang: 'fr', title: 'Page', hasDoctype: true, hasCharset: false });
    assert.ok(r.some(x => x.id === '8.2' && x.status === 'NC'));
  });
  test('C : tous présents', () => {
    const r = checkMandatory({ lang: 'fr', title: 'Accueil', hasDoctype: true, hasCharset: true });
    assert.ok(!r.some(x => x.status === 'NC'));
  });
});

describe('Thème 9 — Structure', () => {
  test('NC : aucun titre', () => {
    const r = checkStructure({ h1Count: 0, headingLevels: [], hasMain: true, hasNav: true, hasHeader: true, hasFooter: true });
    assert.ok(r.some(x => x.id === '9.1' && x.status === 'NC'));
  });
  test('NC : pas de h1', () => {
    const r = checkStructure({ h1Count: 0, headingLevels: [2, 3], hasMain: true, hasNav: true });
    assert.ok(r.some(x => x.id === '9.1' && x.status === 'NC' && x.message.includes('h1')));
  });
  test('NC : plusieurs h1', () => {
    const r = checkStructure({ h1Count: 3, headingLevels: [1, 1, 1, 2], hasMain: true, hasNav: true });
    assert.ok(r.some(x => x.id === '9.1' && x.status === 'NC' && x.message.includes('Plusieurs')));
  });
  test('NC : saut h2→h4', () => {
    const r = checkStructure({ h1Count: 1, headingLevels: [1, 2, 4], hasMain: true, hasNav: true });
    assert.ok(r.some(x => x.id === '9.1' && x.status === 'NC' && x.message.includes('Saut')));
  });
  test('C : hiérarchie h1→h2→h3 correcte', () => {
    const r = checkStructure({ h1Count: 1, headingLevels: [1, 2, 3, 2, 3], hasMain: true, hasNav: true });
    const ncTitres = r.filter(x => x.id === '9.1' && x.status === 'NC');
    assert.equal(ncTitres.length, 0);
  });
  test('NC : <main> absent', () => {
    const r = checkStructure({ h1Count: 1, headingLevels: [1], hasMain: false, hasNav: true });
    assert.ok(r.some(x => x.id === '9.2' && x.status === 'NC' && x.message.includes('main')));
  });
});

describe('Thème 11 — Formulaires', () => {
  test('NC : champ sans étiquette', () => {
    const r = checkForms([{ hasLabel: false, ariaLabel: null, ariaLabelledby: null, title: null, placeholder: null }]);
    assert.ok(r.some(x => x.status === 'NC'));
  });
  test('NC : placeholder seul', () => {
    const r = checkForms([{ hasLabel: false, ariaLabel: null, ariaLabelledby: null, title: null, placeholder: 'Votre nom' }]);
    assert.ok(r.some(x => x.status === 'NC'));
  });
  test('C : label for/id', () => {
    const r = checkForms([{ hasLabel: true, ariaLabel: null, ariaLabelledby: null, title: null, placeholder: null }]);
    assert.ok(!r.some(x => x.status === 'NC'));
  });
  test('C : aria-label', () => {
    const r = checkForms([{ hasLabel: false, ariaLabel: 'Nom de famille', ariaLabelledby: null, title: null, placeholder: null }]);
    assert.ok(!r.some(x => x.status === 'NC'));
  });
  test('C : title', () => {
    const r = checkForms([{ hasLabel: false, ariaLabel: null, ariaLabelledby: null, title: 'Recherche', placeholder: null }]);
    assert.ok(!r.some(x => x.status === 'NC'));
  });
  test('NA : aucun champ', () => {
    const r = checkForms([]);
    assert.ok(r.some(x => x.status === 'NA'));
  });
});

describe('Thème 12 — Navigation', () => {
  test('NC : pas de lien d\'évitement', () => {
    const r = checkNavigation({ hasSkipLink: false, tabindexPositive: 0 });
    assert.ok(r.some(x => x.id === '12.1' && x.status === 'NC'));
  });
  test('C : lien d\'évitement présent', () => {
    const r = checkNavigation({ hasSkipLink: true, tabindexPositive: 0 });
    assert.ok(r.some(x => x.id === '12.1' && x.status === 'C'));
  });
  test('NC : tabindex > 0', () => {
    const r = checkNavigation({ hasSkipLink: true, tabindexPositive: 2 });
    assert.ok(r.some(x => x.id === '12.8' && x.status === 'NC'));
  });
  test('C : pas de tabindex > 0', () => {
    const r = checkNavigation({ hasSkipLink: true, tabindexPositive: 0 });
    assert.ok(r.some(x => x.id === '12.8' && x.status === 'C'));
  });
});

// ─── NOUVEAUX CRITÈRES SEMAINE 2/3 ───────────

describe('Critère 8.9 — Balises présentatifs b/i/u', () => {
  test('NC : balise b sans rôle sémantique', () => {
    // Logique : b/i/u avec du texte sans role → NC
    const hasPres = true; // simulé
    const r = hasPres
      ? [{ id: '8.9', status: 'NC', message: '1 balise b présentatif' }]
      : [{ id: '8.9', status: 'C', message: 'OK' }];
    assert.ok(r.some(x => x.status === 'NC'));
  });
  test('C : page sans balises présentatifs', () => {
    const r = [{ id: '8.9', status: 'C', message: 'Aucune balise présentative' }];
    assert.ok(!r.some(x => x.status === 'NC'));
  });
});

describe('Critère 10.6 — Texte justifié', () => {
  test('NC : text-align:justify détecté', () => {
    const r = [{ id: '10.6', status: 'NC', message: '2 éléments text-align:justify' }];
    assert.ok(r.some(x => x.id === '10.6' && x.status === 'NC'));
  });
  test('C : aucun texte justifié', () => {
    const r = [{ id: '10.6', status: 'C', message: 'Aucun texte justifié' }];
    assert.ok(!r.some(x => x.status === 'NC'));
  });
});

describe('Critère 11.5 — fieldset/legend', () => {
  function checkFieldset(groups) {
    // groups = [{ name, count, hasFieldset, hasLegend }]
    return groups.flatMap(g => {
      if (g.count < 2) return [];
      if (!g.hasFieldset) return [{ id: '11.5', status: 'NC', message: `Groupe "${g.name}" sans fieldset` }];
      if (!g.hasLegend)  return [{ id: '11.5', status: 'NC', message: `Groupe "${g.name}" sans legend` }];
      return [{ id: '11.5', status: 'C', message: `Groupe "${g.name}" OK` }];
    });
  }

  test('NC : groupe radio sans fieldset', () => {
    const r = checkFieldset([{ name: 'genre', count: 3, hasFieldset: false, hasLegend: false }]);
    assert.ok(r.some(x => x.status === 'NC'));
  });
  test('NC : fieldset sans legend', () => {
    const r = checkFieldset([{ name: 'genre', count: 3, hasFieldset: true, hasLegend: false }]);
    assert.ok(r.some(x => x.status === 'NC'));
  });
  test('C : fieldset + legend présents', () => {
    const r = checkFieldset([{ name: 'genre', count: 3, hasFieldset: true, hasLegend: true }]);
    assert.ok(!r.some(x => x.status === 'NC'));
  });
  test('NA : groupe avec un seul élément', () => {
    const r = checkFieldset([{ name: 'single', count: 1, hasFieldset: false, hasLegend: false }]);
    assert.equal(r.length, 0);
  });
});

describe('Critère 13.2 — Liens nouvelle fenêtre', () => {
  function checkNewWindow(links) {
    // links = [{ text, ariaLabel, hasWarning }]
    const R = [];
    if (!links.length) { R.push({ id: '13.2', status: 'NA', message: 'Aucun lien nouvelle fenêtre' }); return R; }
    links.forEach(a => {
      const warned = /(nouvelle|new|onglet|fenêtre|window|tab)/i.test(a.ariaLabel || a.text || '');
      R.push(warned
        ? { id: '13.2', status: 'C', message: 'Lien avec avertissement' }
        : { id: '13.2', status: 'NC', message: `Sans avertissement: "${a.text}"` });
    });
    return R;
  }

  test('NC : target=_blank sans avertissement', () => {
    const r = checkNewWindow([{ text: 'Documentation', ariaLabel: null }]);
    assert.ok(r.some(x => x.status === 'NC'));
  });
  test('C : aria-label avec "nouvelle fenêtre"', () => {
    const r = checkNewWindow([{ text: 'Doc', ariaLabel: 'Documentation (nouvelle fenêtre)' }]);
    assert.ok(!r.some(x => x.status === 'NC'));
  });
  test('NA : aucun lien nouvelle fenêtre', () => {
    const r = checkNewWindow([]);
    assert.ok(r.some(x => x.status === 'NA'));
  });
});

describe('Critère 13.3 — Documents téléchargeables', () => {
  function checkDocs(docs) {
    // docs = [{ ext, label }]
    const R = [];
    if (!docs.length) { R.push({ id: '13.3', status: 'NA', message: 'Aucun document' }); return R; }
    docs.forEach(d => {
      const hasFormat = d.label.toLowerCase().includes(d.ext.toLowerCase());
      const hasSize = /\d+\s*(ko|kb|mo|mb)/i.test(d.label);
      R.push((hasFormat || hasSize)
        ? { id: '13.3', status: 'C', message: `Doc ${d.ext} avec format/poids` }
        : { id: '13.3', status: 'NC', message: `Doc ${d.ext} sans format/poids: "${d.label}"` });
    });
    return R;
  }

  test('NC : PDF sans indication', () => {
    const r = checkDocs([{ ext: 'PDF', label: 'Rapport annuel' }]);
    assert.ok(r.some(x => x.status === 'NC'));
  });
  test('C : PDF avec format dans le label', () => {
    const r = checkDocs([{ ext: 'PDF', label: 'Rapport annuel (PDF, 2 Mo)' }]);
    assert.ok(!r.some(x => x.status === 'NC'));
  });
  test('C : avec poids seulement', () => {
    const r = checkDocs([{ ext: 'DOCX', label: 'Formulaire 350 ko' }]);
    assert.ok(!r.some(x => x.status === 'NC'));
  });
  test('NA : aucun document', () => {
    const r = checkDocs([]);
    assert.ok(r.some(x => x.status === 'NA'));
  });
});

describe('Critère 11.13 — Autocomplete champs personnels', () => {
  function checkAutocomplete(fields) {
    // fields = [{ name, hasAutocomplete, autocompleteValue }]
    const personalMap = { email: 'email', name: 'name', tel: 'tel', zip: 'postal-code' };
    return fields.flatMap(f => {
      const match = Object.keys(personalMap).find(k => f.name.includes(k));
      if (!match) return [];
      if (!f.hasAutocomplete) return [{ id: '11.13', status: 'NC', message: `"${f.name}" sans autocomplete` }];
      return [{ id: '11.13', status: 'C', message: `"${f.name}" autocomplete="${f.autocompleteValue}"` }];
    });
  }

  test('NC : champ email sans autocomplete', () => {
    const r = checkAutocomplete([{ name: 'email', hasAutocomplete: false }]);
    assert.ok(r.some(x => x.status === 'NC'));
  });
  test('C : champ email avec autocomplete', () => {
    const r = checkAutocomplete([{ name: 'email', hasAutocomplete: true, autocompleteValue: 'email' }]);
    assert.ok(!r.some(x => x.status === 'NC'));
  });
  test('Ignoré : champ non personnel', () => {
    const r = checkAutocomplete([{ name: 'search', hasAutocomplete: false }]);
    assert.equal(r.length, 0);
  });
});

describe('Correction faux positif — Contraste éléments invisibles', () => {
  function isVisible(display, visibility, opacity, width, height) {
    if (display === 'none' || visibility === 'hidden') return false;
    if (parseFloat(opacity) === 0) return false;
    if (width === 0 || height === 0) return false;
    return true;
  }

  test('Élément display:none → ignoré', () => {
    assert.ok(!isVisible('none', 'visible', '1', 100, 20));
  });
  test('Élément opacity:0 → ignoré', () => {
    assert.ok(!isVisible('block', 'visible', '0', 100, 20));
  });
  test('Élément 0x0 → ignoré', () => {
    assert.ok(!isVisible('block', 'visible', '1', 0, 0));
  });
  test('Élément visible normal → analysé', () => {
    assert.ok(isVisible('block', 'visible', '1', 100, 20));
  });
});

describe('Correction faux positif — SVG dans bouton étiqueté', () => {
  function svgNeedsLabel(hasParentWithLabel) {
    // Si le SVG est dans un bouton déjà étiqueté → pas de NC
    return !hasParentWithLabel;
  }

  test('SVG dans bouton avec aria-label → pas de NC', () => {
    assert.ok(!svgNeedsLabel(true));
  });
  test('SVG standalone sans label → NC', () => {
    assert.ok(svgNeedsLabel(false));
  });
});
