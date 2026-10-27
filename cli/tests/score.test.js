'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeScore, criterionStatus, _internals } = require('../../extension/shared/rgaa-rules.js');

test('statut d’un critère : NC > à vérifier > C > NA', () => {
  assert.equal(criterionStatus(['C', 'NT', 'NC']), 'NC');
  assert.equal(criterionStatus(['C', 'NT']), 'NT');
  assert.equal(criterionStatus(['C', 'NA']), 'C');
  assert.equal(criterionStatus(['NA', 'NA']), 'NA');
});

test('le score ne compte que les critères tranchés', () => {
  const score = computeScore([
    { id: '1.1', status: 'C' },
    { id: '1.2', status: 'NT' },
    { id: '3.2', status: 'NC' },
    { id: '3.2', status: 'C' },
    { id: '4.1', status: 'NA' },
  ]);
  assert.equal(score.conformes, 1);
  assert.equal(score.nonConformes, 1);
  assert.equal(score.aVerifier, 1);
  assert.equal(score.na, 1);
  assert.equal(score.taux, 50);
  assert.equal(score.criteria['1.2'], 'NT');
});

test('autocomplete : jetons valides et invalides', () => {
  const { isValidAutocomplete } = _internals;
  for (const v of ['email', 'given-name', 'shipping postal-code', 'section-a billing street-address', 'work email', 'home tel', 'username webauthn', 'off']) {
    assert.equal(isValidAutocomplete(v), true, v);
  }
  for (const v of ['emial', 'work given-name', 'shipping', 'email extra', '']) {
    assert.equal(isValidAutocomplete(v), false, v);
  }
});

test('codes de langue', () => {
  const { isValidLangCode } = _internals;
  for (const v of ['fr', 'fr-FR', 'en-GB', 'gsw', 'zh-Hant-TW']) assert.equal(isValidLangCode(v), true, v);
  for (const v of ['francais', 'xx', 'xx-', 'f', 'fr_FR']) assert.equal(isValidLangCode(v), false, v);
});

test('le nom accessible doit contenir l’intitulé visible', () => {
  const { nameIncludesVisibleLabel } = _internals;
  assert.equal(nameIncludesVisibleLabel('Télécharger le programme', 'Télécharger'), true);
  assert.equal(nameIncludesVisibleLabel('Accueil du site', 'Contact'), false);
  assert.equal(nameIncludesVisibleLabel('Fermer', '×'), null);
  assert.equal(nameIncludesVisibleLabel('Envoyer le message', 'ENVOYER'), true);
});
