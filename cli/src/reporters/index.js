// src/reporters/index.js
'use strict';
const { generateVulgarizedReport } = require('../../../extension/shared/vulgarized-report-template');

async function generateReport(report, format = 'json') {
  switch (format) {
    case 'html': return generateVulgarized(report);
    case 'csv':  return generateCsv(report);
    case 'vulgarized': return generateVulgarized(report);
    default:     return JSON.stringify(report, null, 2);
  }
}

// ── CSV ──────────────────────────────────────
function generateCsv(report) {
  const headers = ['Page', 'Critère', 'Statut', 'Message', 'Source', 'Extrait'];
  const rows = report.results.map(r => [
    `"${(r.pageUrl || report.url || '').replace(/"/g, '""')}"`,
    r.id, r.status,
    `"${(r.message || '').replace(/"/g, '""')}"`,
    r.source || 'dom',
    `"${(r.snippet || '').replace(/"/g, '""').replace(/\n/g, ' ').slice(0, 100)}"`,
  ]);
  return [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
}

function generateVulgarized(report) {
  return generateVulgarizedReport(report, { includeCliLink: false });
}

function summarizeCriteria(results) {
  const byCriterion = new Map();
  for (const item of results) {
    if (!item || !item.id) continue;
    if (!byCriterion.has(item.id)) byCriterion.set(item.id, []);
    byCriterion.get(item.id).push(item);
  }
  return { byCriterion };
}

function buildTopPriorities(byCriterion) {
  const priorities = [];
  for (const [criterion, items] of byCriterion.entries()) {
    const statuses = items.map(i => i.status);
    if (!statuses.includes('NC')) continue;
    const firstMessage = items.find(i => i.status === 'NC')?.message || 'Non-conformité détectée';
    priorities.push(enrichPriority(criterion, firstMessage));
  }
  return priorities.sort((a, b) => priorityScore(b.priority) - priorityScore(a.priority));
}

function enrichPriority(criterion, issue) {
  const key = String(criterion || '').split('.')[0];
  const fallback = {
    title: 'Accessibilité à améliorer',
    impact: 'Certaines personnes peuvent avoir des difficultés à utiliser la page.',
    action: 'Corriger la non-conformité signalée puis valider sur parcours clavier.',
    priority: 'P2',
    effort: 'M',
  };

  const map = {
    '3': {
      title: 'Lisibilité insuffisante (contrastes)',
      impact: 'Les personnes malvoyantes lisent difficilement le contenu.',
      action: 'Augmenter les contrastes texte/fond pour atteindre les seuils RGAA.',
      priority: 'P1',
      effort: 'M',
    },
    '10': {
      title: 'Mise en page fragile au zoom',
      impact: 'Le contenu devient difficile à lire/atteindre à fort agrandissement.',
      action: 'Supprimer les largeurs fixes et rendre les blocs fluides.',
      priority: 'P1',
      effort: 'M',
    },
    '11': {
      title: 'Formulaire insuffisamment accessible',
      impact: 'Saisie difficile pour clavier/lecteurs d’écran.',
      action: 'Associer chaque champ à une étiquette explicite et un focus visible.',
      priority: 'P1',
      effort: 'M',
    },
    '12': {
      title: 'Navigation clavier imparfaite',
      impact: 'Les utilisateurs clavier perdent du temps ou restent bloqués.',
      action: 'Garantir un ordre de tabulation cohérent et des liens d’évitement fonctionnels.',
      priority: 'P1',
      effort: 'S',
    },
    '1': {
      title: 'Images non accessibles',
      impact: 'Les personnes aveugles ne perçoivent pas l’information portée par les images.',
      action: 'Ajouter des alternatives textuelles pertinentes.',
      priority: 'P2',
      effort: 'S',
    },
  };

  const preset = map[key] || fallback;
  return { criterion, issue, ...preset };
}

function priorityScore(priority) {
  if (priority === 'P1') return 3;
  if (priority === 'P2') return 2;
  return 1;
}

function effortToPoints(effort) {
  if (effort === 'S') return 1;
  if (effort === 'M') return 2;
  return 3;
}

function buildPositiveSignals(report) {
  const score = report.score || {};
  const positives = [];

  if (typeof score.conformes === 'number' && typeof score.total === 'number' && score.total > 0) {
    positives.push(`${score.conformes} critères conformes sur ${score.total} critères applicables sur cet échantillon.`);
  }
  if (typeof score.na === 'number' && score.na > 0) {
    positives.push(`${score.na} critères sont non applicables sur cette page (pas de faux signal à corriger).`);
  }

  const simulation = report.simulation || {};
  if (typeof simulation.c === 'number' && simulation.c > 0) {
    positives.push(`${simulation.c} vérifications utilisateur (clavier, responsive, CSS) sont passées.`);
  }
  if (typeof simulation.focusElementsTested === 'number' && simulation.focusElementsTested > 0) {
    positives.push(`Le focus clavier est visible sur ${simulation.focusElementsTested} éléments testés.`);
  }

  if (!positives.length) {
    positives.push('Aucun signal positif automatique disponible, mais la base est prête pour progresser rapidement.');
  }
  return positives;
}

function buildEncouragement(score) {
  const taux = Number(score?.taux || 0);
  if (taux >= 90) return 'Très bonne base: quelques ajustements ciblés suffisent pour consolider un niveau déjà élevé.';
  if (taux >= 75) return 'Bonne dynamique: en traitant les points P1 d’abord, le service peut monter rapidement en qualité d’accès.';
  if (taux >= 50) return 'Base exploitable: prioriser les blocages majeurs donnera des gains utilisateurs visibles.';
  return 'Point de départ clair: en corrigeant les priorités critiques, l’amélioration sera rapidement perceptible.';
}

function buildActionLevers(top, byCriterion) {
  return top.map((item) => {
    const ncItems = (byCriterion.get(item.criterion) || []).filter((i) => i.status === 'NC');
    const where = ncItems.map((entry) => describeWhereToFix(entry)).filter(Boolean).slice(0, 3);
    const fixes = where.length
      ? where.map((line) => `<li>${esc(line)}</li>`).join('')
      : '<li>Emplacement précis non fourni: reprendre le message de constat et inspecter les composants liés.</li>';

    return `
      <div class="card">
        <div class="chip chip-${item.priority.toLowerCase()}">${item.priority}</div>
        <h3>${esc(item.title)}</h3>
        <p><strong>Levier :</strong> ${esc(item.action)}</p>
        <p><strong>Résultat attendu :</strong> ${esc(item.impact)}</p>
        <p class="meta">Critère RGAA ${esc(item.criterion)} · Effort ${esc(item.effort)}</p>
        <div class="where">
          <strong>Où corriger :</strong>
          <ul>${fixes}</ul>
        </div>
      </div>
    `;
  }).join('');
}

function describeWhereToFix(entry) {
  const source = entry?.source || 'dom';
  const message = entry?.message || 'non-conformité détectée';

  if (source === 'simulation') {
    return `Parcours simulé (zoom/clavier) : ${message}`;
  }

  const snippet = String(entry?.snippet || '').trim();
  if (!snippet) {
    return `Analyse DOM : ${message}`;
  }

  const hint = extractElementHint(snippet);
  if (hint) {
    return `${hint} : ${message}`;
  }
  return `Extrait DOM : ${message}`;
}

function extractElementHint(snippet) {
  const tag = snippet.match(/^<([a-zA-Z0-9-]+)/)?.[1];
  const id = snippet.match(/\sid="([^"]+)"/)?.[1];
  const cls = snippet.match(/\sclass="([^"]+)"/)?.[1]?.split(/\s+/).filter(Boolean)[0];

  if (!tag && !id && !cls) return '';

  let out = tag ? `<${tag}>` : 'élément';
  if (id) out += ` #${id}`;
  if (cls) out += ` .${cls}`;
  return out;
}

function renderPagesSummary(report) {
  const pages = Array.isArray(report.pages) ? report.pages : [];
  const fallback = report.url ? [{ url: report.url, title: report.title || report.url, score: report.score || {} }] : [];
  const data = pages.length ? pages : fallback;
  if (!data.length) return '';

  const items = data.map((p) => {
    const taux = Number(p.score?.taux ?? 0);
    const nc = Number(p.score?.nonConformes ?? p.nonConformes ?? 0);
    const c = Number(p.score?.conformes ?? p.conformes ?? 0);
    return `<li><strong>${esc(p.title || p.url || 'Page')}</strong> — ${esc(p.url || '')} · ${taux}% · NC ${nc} · C ${c}</li>`;
  }).join('');

  return `
    <div style="background:#0D0D1A;border:1px solid #1A1A2E;border-radius:12px;padding:14px;margin-bottom:16px;">
      <div style="font-size:12px;color:#8ea0c8;font-family:'DM Mono',monospace;margin-bottom:8px;">Pages auditées (${data.length})</div>
      <ul style="margin:0 0 0 18px;padding:0;color:#c8d2f2;font-size:13px;line-height:1.6">${items}</ul>
    </div>
  `;
}

function renderVulgarizedPages(report) {
  const pages = Array.isArray(report.pages) ? report.pages : [];
  const fallback = report.url ? [{ url: report.url, title: report.title || report.url, score: report.score || {} }] : [];
  const data = pages.length ? pages : fallback;
  if (!data.length) return '';

  const rows = data.map((p) => {
    const taux = Number(p.score?.taux ?? 0);
    const nc = Number(p.score?.nonConformes ?? p.nonConformes ?? 0);
    const c = Number(p.score?.conformes ?? p.conformes ?? 0);
    const href = esc(p.url || '');
    const urlLine = href
      ? `<a href="${href}" target="_blank" rel="noopener noreferrer" style="word-break:break-all;">${href}</a>`
      : 'URL indisponible';
    return `<li><strong>${esc(p.title || p.url || 'Page')}</strong><br>${urlLine}<br>Conformité: <strong>${taux}%</strong> · Critères non conformes: <strong>${nc}</strong> · Critères conformes: <strong>${c}</strong></li>`;
  }).join('');

  return `
    <div class="box" style="margin-top:16px;">
      <strong>Pages auditées (${data.length})</strong>
      <ul>${rows}</ul>
    </div>
  `;
}

function renderSkippedPagesSummary(report) {
  const skipped = Array.isArray(report.pagesSkipped) ? report.pagesSkipped : [];
  if (!skipped.length) return '';
  const rows = skipped.map((p) => `<li>${esc(p.url || '')} — ${esc(p.reason || 'erreur')}</li>`).join('');
  return `
    <div style="background:#231a0f;border:1px solid #4a3417;border-radius:12px;padding:14px;margin-bottom:16px;">
      <div style="font-size:12px;color:#fbbf24;font-family:'DM Mono',monospace;margin-bottom:8px;">Pages ignorées (${skipped.length})</div>
      <ul style="margin:0 0 0 18px;padding:0;color:#fde68a;font-size:13px;line-height:1.6">${rows}</ul>
    </div>
  `;
}

function renderVulgarizedSkippedPages(report) {
  const skipped = Array.isArray(report.pagesSkipped) ? report.pagesSkipped : [];
  if (!skipped.length) return '';
  const rows = skipped.map((p) => `<li>${esc(p.url || '')} — ${esc(p.reason || 'erreur')}</li>`).join('');
  return `
    <div class="box" style="margin-top:16px;">
      <strong>Pages non auditées (${skipped.length})</strong>
      <ul>${rows}</ul>
      <p style="margin-top:8px;color:#5b6476;">Ces pages ont été détectées mais ignorées (ex: timeout). Le reste de l'audit est conservé.</p>
    </div>
  `;
}

function esc(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

module.exports = { generateReport };
