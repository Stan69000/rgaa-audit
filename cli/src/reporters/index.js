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

// ── HTML ─────────────────────────────────────
function generateHtml(report) {
  const { url, title, timestamp, score, results, simulation } = report;

  const ncItems = results.filter(r => r.status === 'NC');
  const cItems  = results.filter(r => r.status === 'C');

  const statusColor = { NC: '#FF4444', C: '#00C896', NA: '#888' };
  const statusBg    = { NC: '#FF444415', C: '#00C89615', NA: '#88888815' };

  const itemsHtml = results.map(r => `
    <tr style="border-bottom:1px solid #1a1a2e">
      <td style="padding:8px 12px;font-size:11px;color:#8ea0c8;font-family:monospace">${esc(r.pageUrl || url || '')}</td>
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

<div style="margin-bottom:16px;display:flex;gap:12px;align-items:center">
  <h2 style="font-size:18px;font-weight:700">Résultats détaillés</h2>
  <span style="background:#FF444415;color:#FF4444;padding:2px 10px;border-radius:999px;font-size:12px;font-family:'DM Mono',monospace">${score.nonConformes} NC</span>
  <span style="background:#00C89615;color:#00C896;padding:2px 10px;border-radius:999px;font-size:12px;font-family:'DM Mono',monospace">${score.conformes} C</span>
</div>

${renderPagesSummary(report)}
${renderSkippedPagesSummary(report)}

<table>
  <thead>
    <tr>
      <th>Page</th><th>Critère</th><th>Statut</th><th>Message</th><th>Source</th>
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
  const positives = buildPositiveSignals(report);
  const encouragement = buildEncouragement(score);
  const actionLevers = buildActionLevers(top, summary.byCriterion);

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

  const ods = report.odsDownload || null;
  const hasOds = Boolean(ods?.base64 && ods?.fileName);

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
    .tools { display:flex; flex-wrap:wrap; gap:10px; margin: 8px 0 14px; }
    .btn { border:1px solid #c9d4ea; background:#fff; color:#1f2a44; border-radius:10px; padding:8px 12px; font-weight:600; cursor:pointer; }
    .btn:hover { background:#f3f7ff; }
    .where { margin-top:8px; font-size:13px; color:#334155; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:8px; }
    @media print {
      .tools { display:none; }
      body { background:#fff; }
      .wrap { max-width: none; }
      .box, .kpi, .card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Rapport vulgarisé d’accessibilité</h1>
    <div class="sub">${esc(report.title || report.url || '')} · ${new Date(report.timestamp).toLocaleString('fr-FR')}</div>
    <div class="tools">
      <button type="button" class="btn" onclick="downloadHtmlReport()">Télécharger HTML</button>
      <button type="button" class="btn" onclick="window.print()">Exporter PDF</button>
      ${hasOds ? `<button type="button" class="btn" onclick="downloadOdsReport()">Télécharger ODS</button>` : ''}
    </div>

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

    <div class="box">
      <strong>Ce qui fonctionne déjà</strong>
      <ul>
        ${positives.map(item => `<li>${esc(item)}</li>`).join('')}
      </ul>
      <p style="margin-top:10px;color:#334155;"><strong>${esc(encouragement)}</strong></p>
    </div>

    <h2>Top priorités</h2>
    <div class="cards">
      ${cards || '<div class="card"><h3>Aucun point prioritaire détecté</h3><p>Aucun critère non conforme n’a été détecté automatiquement sur cet échantillon.</p></div>'}
    </div>

    <h2 style="margin-top:16px;">Leviers actionnables</h2>
    <div class="cards">
      ${actionLevers || '<div class="card"><h3>Aucun levier critique détecté</h3><p>Les points non conformes sont mineurs ou absents sur cet échantillon.</p></div>'}
    </div>

    ${renderVulgarizedPages(report)}
    ${renderVulgarizedSkippedPages(report)}

    <div class="box" style="margin-top:16px;">
      <strong>Ce qui reste à vérifier manuellement</strong>
      <ul>
        <li>Pertinence rédactionnelle des alternatives (images, liens, formulaires).</li>
        <li>Tests lecteurs d’écran et cohérence de parcours sur des scénarios réels.</li>
        <li>Vérification des contenus/processus non couverts automatiquement.</li>
      </ul>
    </div>
  </div>
  <script>
    const ODS_DOWNLOAD = ${JSON.stringify(hasOds ? ods : null)};

    function downloadHtmlReport() {
      const html = '<!DOCTYPE html>\\n' + document.documentElement.outerHTML;
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rapport-vulgarise.html';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    function downloadOdsReport() {
      if (!ODS_DOWNLOAD || !ODS_DOWNLOAD.base64) return;
      const bin = atob(ODS_DOWNLOAD.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: ODS_DOWNLOAD.mimeType || 'application/vnd.oasis.opendocument.spreadsheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = ODS_DOWNLOAD.fileName || 'rgaa-grille.ods';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  </script>
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
