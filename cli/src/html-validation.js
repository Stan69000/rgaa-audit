// src/html-validation.js
// Validation du code source généré (RGAA 8.2) avec html-validate, exécuté localement :
// la page n'est envoyée à aucun service. Option --validate-html.
'use strict';

const MAX_RESULTS_PER_RULE = 5;
// Déjà contrôlés par le moteur de règles (8.2 id en double) : pas de double compte.
const SKIPPED_RULES = new Set(['no-dup-id']);

function loadValidator() {
  try {
    const { HtmlValidate } = require('html-validate');
    return new HtmlValidate({ extends: ['html-validate:standard'] });
  } catch (err) {
    throw new Error(`html-validate indisponible (Node.js 22.22 ou plus requis) : ${err.message}`);
  }
}

function contextAround(source, line, column) {
  const text = source.split('\n')[line - 1] || '';
  const start = Math.max(0, column - 60);
  return text.slice(start, start + 160).replace(/\s+/g, ' ').trim();
}

/** Transforme les messages html-validate en constats RGAA 8.2 regroupés par règle. */
function toFindings(messages, source) {
  const byRule = new Map();
  for (const m of messages) {
    if (SKIPPED_RULES.has(m.ruleId)) continue;
    if (!byRule.has(m.ruleId)) byRule.set(m.ruleId, []);
    byRule.get(m.ruleId).push(m);
  }
  return [...byRule.entries()].map(([ruleId, items]) => ({
    id: '8.2',
    rule: `html-${ruleId}`,
    status: 'NC',
    resultType: 'probable_error',
    severity: 'medium',
    confidence: 'high',
    manualReviewRecommended: false,
    source: 'html-validate',
    message: `Code source non valide (${ruleId}) : ${items[0].message}${items.length > 1 ? ` (${items.length} occurrences)` : ''}`,
    count: items.length,
    snippet: contextAround(source, items[0].line, items[0].column),
    examples: items.slice(0, MAX_RESULTS_PER_RULE).map((m) => ({
      selector: m.selector || `ligne ${m.line}, colonne ${m.column}`,
      snippet: contextAround(source, m.line, m.column),
    })),
    rationale: 'Un code mal imbriqué ou invalide peut être interprété différemment par les technologies d’assistance (test 8.2.1).',
    remediationHint: `Voir la règle html-validate « ${ruleId} » : https://html-validate.org/rules/${ruleId}.html`,
  }));
}

async function validatePageHtml(page) {
  const validator = loadValidator();
  const source = await page.content();
  const report = await validator.validateString(source);
  const messages = (report.results[0] && report.results[0].messages) || [];
  const findings = toFindings(messages, source);
  if (!findings.length) {
    findings.push({
      id: '8.2', rule: 'html-valid', status: 'C', resultType: 'good_signal', severity: 'low', confidence: 'high',
      manualReviewRecommended: false, source: 'html-validate', count: 1, examples: [], snippet: null,
      message: 'Code source généré valide (html-validate, règles de conformité au standard).',
      rationale: '', remediationHint: '',
    });
  }
  return findings;
}

module.exports = { validatePageHtml, _internals: { toFindings, contextAround } };
