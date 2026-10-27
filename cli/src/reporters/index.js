// src/reporters/index.js
'use strict';

const { requireShared } = require('../shared');

const { generateVulgarizedReport } = requireShared('vulgarized-report-template.js');
const { RGAA_CRITERIA } = requireShared('rgaa-criteria.js');

async function generateReport(report, format = 'json') {
  switch (format) {
    case 'html':
    case 'vulgarized':
      return generateVulgarizedReport(report, { includeCliLink: false });
    case 'csv':
      return generateCsv(report);
    default:
      return JSON.stringify(report, null, 2);
  }
}

/**
 * Cellule CSV sûre : guillemets doublés, retours à la ligne aplatis, et neutralisation des
 * débuts de formule (=, +, -, @) puisque les messages reprennent des textes de la page auditée.
 */
function csvCell(value, max = 0) {
  let text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (max && text.length > max) text = `${text.slice(0, max)}…`;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function generateCsv(report) {
  const headers = [
    'Page', 'Critère', 'Intitulé du critère', 'Statut', 'Type résultat', 'Gravité', 'Confiance',
    'Revue manuelle', 'Occurrences', 'Message', 'Justification', 'Remédiation', 'Source', 'Contexte',
    'Sélecteur', 'Extrait',
  ];
  const rows = (report.results || []).map((r) => [
    csvCell(r.pageUrl || report.url || ''),
    csvCell(r.id),
    csvCell(RGAA_CRITERIA[r.id] || ''),
    csvCell(r.status),
    csvCell(r.resultType || ''),
    csvCell(r.severity || ''),
    csvCell(r.confidence || ''),
    csvCell(r.manualReviewRecommended ? 'oui' : 'non'),
    csvCell(r.count || 1),
    csvCell(r.message),
    csvCell(r.rationale),
    csvCell(r.remediationHint),
    csvCell(r.source || 'dom'),
    csvCell(r.context || ''),
    csvCell(r.selector || ''),
    csvCell(r.snippet || '', 200),
  ].join(';'));
  return [headers.map((h) => csvCell(h)).join(';'), ...rows].join('\n');
}

module.exports = { generateReport, _internals: { csvCell, generateCsv } };
