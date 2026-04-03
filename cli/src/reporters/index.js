// src/reporters/index.js
'use strict';

async function generateReport(report, format = 'json') {
  switch (format) {
    case 'html': return generateHtml(report);
    case 'csv':  return generateCsv(report);
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

function esc(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

module.exports = { generateReport };
