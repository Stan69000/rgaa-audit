// src/aggregate.js
// Regroupements transverses d'un rapport multi-pages : défauts de gabarit (même constat
// sur plusieurs pages) et comparaison avec un audit de référence (--baseline).
'use strict';

/** Message sans compteurs ni mesures, pour reconnaître un même constat d'une page à l'autre. */
function normalizeMessage(message) {
  return String(message || '')
    .replace(/\s*\(\d+ occurrences?\)/g, '')
    .replace(/\b\d+(?:[.,]\d+)?\b/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

function fingerprint(result) {
  return `${result.id}|${result.rule || result.source || ''}|${normalizeMessage(result.message)}`;
}

function pagePath(url) {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}` || '/';
  } catch {
    return String(url || '');
  }
}

/**
 * Non-conformités présentes à l'identique sur plusieurs pages : elles viennent presque
 * toujours d'un gabarit commun (en-tête, pied de page, composant) et se corrigent une fois.
 */
function findTemplateIssues(results, minPages = 2) {
  const byKey = new Map();
  for (const r of results || []) {
    if (r.status !== 'NC' || !r.pageUrl) continue;
    const key = fingerprint(r);
    if (!byKey.has(key)) byKey.set(key, { id: r.id, rule: r.rule || r.source, message: normalizeMessage(r.message).replace(/#/g, '…'), sample: r.message, pages: new Set(), occurrences: 0 });
    const entry = byKey.get(key);
    entry.pages.add(r.pageUrl);
    entry.occurrences += Number(r.count) || 1;
  }
  return [...byKey.values()]
    .filter((e) => e.pages.size >= minPages)
    .map((e) => ({ id: e.id, rule: e.rule, message: e.sample, pages: [...e.pages], pageCount: e.pages.size, occurrences: e.occurrences }))
    .sort((a, b) => b.pageCount - a.pageCount || b.occurrences - a.occurrences);
}

function ncKeys(results) {
  const keys = new Map();
  for (const r of results || []) {
    if (r.status !== 'NC') continue;
    const key = `${pagePath(r.pageUrl || '')}|${fingerprint(r)}`;
    if (!keys.has(key)) keys.set(key, r);
  }
  return keys;
}

/** Nouvelles non-conformités et non-conformités résolues par rapport à un rapport de référence. */
function compareWithBaseline(current, baseline) {
  const now = ncKeys(current.results);
  const before = ncKeys(baseline.results);
  const describe = (r) => ({ id: r.id, rule: r.rule || r.source || null, page: pagePath(r.pageUrl || ''), message: r.message });
  const added = [...now.entries()].filter(([k]) => !before.has(k)).map(([, r]) => describe(r));
  const resolved = [...before.entries()].filter(([k]) => !now.has(k)).map(([, r]) => describe(r));
  const engineChanged = Boolean(baseline.engineVersion !== current.engineVersion);
  return {
    baselineTimestamp: baseline.timestamp || null,
    baselineEngineVersion: baseline.engineVersion || null,
    engineChanged,
    newCount: added.length,
    resolvedCount: resolved.length,
    added,
    resolved,
  };
}

module.exports = { normalizeMessage, fingerprint, findTemplateIssues, compareWithBaseline, pagePath };
