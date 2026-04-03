// src/reporters/index.js
'use strict';

async function generateReport(report, format = 'json') {
  switch (format) {
    case 'html': return generateHtml(report);
    case 'csv':  return generateCsv(report);
    case 'vulgarized': return generateVulgarized(report);
    default:     return JSON.stringify(report, null, 2);
  }
}

// ── CSV ──────────────────────────────────────
function generateCsv(report) {
  const headers = ['Critère', 'Statut', 'Message', 'Source', 'Extrait'];
  const rows = report.results.map(r => [
    r.id, r.status,
    `"${(r.message || '').replace(/"/g, '""')}"`,
    r.source || 'dom',
    `"${(r.snippet || '').replace(/"/g, '""').replace(/\n/g, ' ').slice(0, 100)}"`,
  ]);
  return [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
}

// ── HTML ─────────────────────────────────────
function generateHtml(report) {
  const { url, title, timestamp, score, results, simulation, aiAnalysis } = report;

  const ncItems = results.filter(r => r.status === 'NC');
  const cItems  = results.filter(r => r.status === 'C');

  const statusColor = { NC: '#FF4444', C: '#00C896', NA: '#888' };
  const statusBg    = { NC: '#FF444415', C: '#00C89615', NA: '#88888815' };

  const itemsHtml = results.map(r => `
    <tr style="border-bottom:1px solid #1a1a2e">
      <td style="padding:8px 12px;font-family:monospace;font-size:12px;color:#FF6B35;font-weight:700">${r.id}</td>
      <td style="padding:8px 12px">
        <span style="background:${statusBg[r.status]};color:${statusColor[r.status]};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;font-family:monospace">
          ${r.status}
        </span>
      </td>
      <td style="padding:8px 12px;font-size:13px;color:#C8C8E8">${esc(r.message)}</td>
      <td style="padding:8px 12px;font-size:11px;color:#445;font-family:monospace">${r.source || 'dom'}</td>
    </tr>
  `).join('');

  const taux = score.taux;
  const color = taux >= 75 ? '#00C896' : taux >= 50 ? '#FFB800' : '#FF4444';
  const circ = 2 * Math.PI * 54;
  const offset = circ - (taux / 100) * circ;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport RGAA — ${esc(title || url)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;600;700;800&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:#07071A; color:#E8E8FF; font-family:'DM Sans',sans-serif; padding:32px; }
  h1 { font-size:28px; font-weight:800; margin-bottom:4px; }
  .meta { font-family:'DM Mono',monospace; font-size:12px; color:#445; margin-bottom:32px; }
  .cards { display:grid; grid-template-columns:200px 1fr; gap:24px; margin-bottom:32px; }
  .card { background:#0D0D1A; border:1px solid #1A1A2E; border-radius:16px; padding:24px; }
  .stat { display:inline-block; margin-right:32px; }
  .stat-val { font-size:36px; font-weight:800; font-family:'DM Mono',monospace; }
  .stat-lbl { font-size:12px; color:#445; margin-top:4px; }
  table { width:100%; border-collapse:collapse; background:#0D0D1A; border-radius:12px; overflow:hidden; }
  thead { background:#0A0A18; }
  th { padding:10px 12px; text-align:left; font-size:11px; color:#445; font-family:'DM Mono',monospace; font-weight:500; }
  .ai-box { background:#0D0A1A; border:1px solid #2A1A3A; border-radius:12px; padding:20px; margin-bottom:24px; }
  .ai-label { font-family:'DM Mono',monospace; font-size:11px; color:#A855F7; margin-bottom:10px; }
  .ai-text { font-size:13px; color:#C8C8E8; line-height:1.8; white-space:pre-wrap; }
  .sim-box { background:#0A1A0D; border:1px solid #00C89620; border-radius:12px; padding:16px; margin-bottom:24px; }
  .sim-label { font-family:'DM Mono',monospace; font-size:11px; color:#00C896; margin-bottom:8px; }
  .screenshots { display:flex; gap:12px; flex-wrap:wrap; margin-top:12px; }
  .screenshots img { width:200px; border-radius:8px; border:1px solid #1A2A1A; }
</style>
</head>
<body>
<h1>♿ Rapport RGAA 4.1</h1>
<div class="meta">
  ${esc(url)} — ${new Date(timestamp).toLocaleString('fr-FR')} — Durée : ${report.duration}s
</div>

<div class="cards">
  <div class="card" style="display:flex;align-items:center;justify-content:center;flex-direction:column">
    <svg width="120" height="120" style="transform:rotate(-90deg)">
      <circle cx="60" cy="60" r="54" fill="none" stroke="#1A1A2E" stroke-width="10"/>
      <circle cx="60" cy="60" r="54" fill="none" stroke="${color}" stroke-width="10"
        stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
        stroke-linecap="round"/>
    </svg>
    <div style="font-size:32px;font-weight:800;color:${color};font-family:'DM Mono',monospace;margin-top:-8px">${taux}%</div>
    <div style="font-size:11px;color:#445;margin-top:4px">Taux de conformité</div>
  </div>
  <div class="card">
    <div class="stat"><div class="stat-val" style="color:#FF4444">${score.nonConformes}</div><div class="stat-lbl">Non conformes</div></div>
    <div class="stat"><div class="stat-val" style="color:#00C896">${score.conformes}</div><div class="stat-lbl">Conformes</div></div>
    <div class="stat"><div class="stat-val" style="color:#888">${score.na}</div><div class="stat-lbl">N/A</div></div>
    <div class="stat"><div class="stat-val" style="color:#4A9EFF">${score.total}</div><div class="stat-lbl">Critères</div></div>
    ${simulation ? `
    <br><br>
    <div style="font-family:'DM Mono',monospace;font-size:11px;color:#445;margin-top:16px">SIMULATION</div>
    <div style="font-size:13px;color:#778;margin-top:6px">
      ${simulation.focusElementsTested} éléments testés au clavier •
      ${simulation.screenshotsDir ? simulation.screenshotsDir : ''} screenshots
    </div>` : ''}
  </div>
</div>

${aiAnalysis ? `
<div class="ai-box">
  <div class="ai-label">✨ Analyse IA — Claude</div>
  <div class="ai-text">${esc(aiAnalysis)}</div>
</div>` : ''}

<div style="margin-bottom:16px;display:flex;gap:12px;align-items:center">
  <h2 style="font-size:18px;font-weight:700">Résultats détaillés</h2>
  <span style="background:#FF444415;color:#FF4444;padding:2px 10px;border-radius:999px;font-size:12px;font-family:'DM Mono',monospace">${score.nonConformes} NC</span>
  <span style="background:#00C89615;color:#00C896;padding:2px 10px;border-radius:999px;font-size:12px;font-family:'DM Mono',monospace">${score.conformes} C</span>
</div>

<table>
  <thead>
    <tr>
      <th>Critère</th><th>Statut</th><th>Message</th><th>Source</th>
    </tr>
  </thead>
  <tbody>${itemsHtml}</tbody>
</table>

</body>
</html>`;
}

function generateVulgarized(report) {
  const summary = summarizeCriteria(report.results || []);
  const top = buildTopPriorities(summary.byCriterion).slice(0, 5);
  const score = report.score || { taux: 0, nonConformes: 0, conformes: 0, na: 0, total: 0 };

  const cards = top.map(item => `
    <div class="card">
      <div class="chip chip-${item.priority.toLowerCase()}">${item.priority}</div>
      <h3>${item.title}</h3>
      <p><strong>Constat :</strong> ${esc(item.issue)}</p>
      <p><strong>Impact :</strong> ${esc(item.impact)}</p>
      <p><strong>Action :</strong> ${esc(item.action)}</p>
      <p class="meta">Critère RGAA ${esc(item.criterion)} · Effort ${esc(item.effort)}</p>
    </div>
  `).join('');

  const avg = top.length ? Math.round(top.reduce((acc, item) => acc + effortToPoints(item.effort), 0) / top.length) : 0;
  const effortLabel = avg <= 1 ? 'Faible' : avg === 2 ? 'Moyen' : 'Élevé';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Rapport vulgarisé — ${esc(report.title || report.url || 'Audit RGAA')}</title>
  <style>
    body { margin:0; font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, sans-serif; background:#f7f8fc; color:#1d2433; }
    .wrap { max-width: 980px; margin: 0 auto; padding: 28px 20px 40px; }
    h1 { margin: 0 0 6px; font-size: 28px; }
    .sub { color:#5b6476; margin-bottom:20px; }
    .grid { display:grid; grid-template-columns: repeat(4, minmax(140px,1fr)); gap:12px; margin:18px 0 24px; }
    .kpi { background:#fff; border:1px solid #dfe4ef; border-radius:12px; padding:12px 14px; }
    .kpi .v { font-size:30px; font-weight:700; line-height:1.05; }
    .kpi .l { font-size:12px; color:#5b6476; margin-top:4px; }
    .box { background:#fff; border:1px solid #dfe4ef; border-radius:12px; padding:14px; margin-bottom:16px; }
    .cards { display:grid; grid-template-columns: repeat(auto-fit, minmax(280px,1fr)); gap:12px; }
    .card { background:#fff; border:1px solid #dfe4ef; border-radius:12px; padding:14px; }
    .chip { display:inline-block; font-size:11px; font-weight:700; border-radius:999px; padding:4px 8px; margin-bottom:8px; }
    .chip-p1 { background:#ffdfe0; color:#a3181f; }
    .chip-p2 { background:#fff1d6; color:#9b5d00; }
    .chip-p3 { background:#dff6ff; color:#0a5271; }
    .meta { font-size:12px; color:#5b6476; margin-top:8px; }
    ul { margin: 8px 0 0 18px; }
    li { margin: 4px 0; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Rapport vulgarisé d’accessibilité</h1>
    <div class="sub">${esc(report.title || report.url || '')} · ${new Date(report.timestamp).toLocaleString('fr-FR')}</div>

    <div class="grid">
      <div class="kpi"><div class="v">${score.taux}%</div><div class="l">Niveau global</div></div>
      <div class="kpi"><div class="v">${score.nonConformes}</div><div class="l">Points bloquants</div></div>
      <div class="kpi"><div class="v">${score.conformes}</div><div class="l">Points conformes</div></div>
      <div class="kpi"><div class="v">${effortLabel}</div><div class="l">Effort moyen estimé</div></div>
    </div>

    <div class="box">
      <strong>Lecture rapide</strong>
      <ul>
        <li>L’outil automatise la collecte de preuves techniques; la validation complète RGAA reste humaine.</li>
        <li>Les priorités ci-dessous sont orientées impact utilisateur (navigation clavier, lisibilité, compréhension).</li>
        <li>Objectif: corriger d’abord les points P1, puis sécuriser P2/P3.</li>
      </ul>
    </div>

    <h2>Top priorités</h2>
    <div class="cards">
      ${cards || '<div class="card"><h3>Aucun point prioritaire détecté</h3><p>Aucun critère non conforme n’a été détecté automatiquement sur cet échantillon.</p></div>'}
    </div>

    <div class="box" style="margin-top:16px;">
      <strong>Ce qui reste à vérifier manuellement</strong>
      <ul>
        <li>Pertinence rédactionnelle des alternatives (images, liens, formulaires).</li>
        <li>Tests lecteurs d’écran et cohérence de parcours sur des scénarios réels.</li>
        <li>Vérification des contenus/processus non couverts automatiquement.</li>
      </ul>
    </div>
  </div>
</body>
</html>`;
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

function esc(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

module.exports = { generateReport };
