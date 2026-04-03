// panel.js — Logique du popup RGAA Audit

let currentReport = null;
let currentFilter = 'all';

const btnAudit = document.getElementById('btnAudit');
const resultsEl = document.getElementById('results');
const scoreBar = document.getElementById('scoreBar');
const filters = document.getElementById('filters');
const footer = document.getElementById('footer');
const urlDisplay = document.getElementById('urlDisplay');
const scoreExplain = document.getElementById('scoreExplain');
const modeSelect = document.getElementById('modeSelect');
const depthInput = document.getElementById('depthInput');
const depthWrap = document.getElementById('depthWrap');

// ── LANCEMENT AUDIT ──────────────────────────

btnAudit.addEventListener('click', () => {
  const mode = modeSelect.value === 'multi' ? 'multi' : 'single';
  const depth = Math.max(2, Math.min(20, Number(depthInput.value) || 5));

  btnAudit.disabled = true;
  btnAudit.textContent = '⏳ Analyse en cours…';
  resultsEl.innerHTML = '<div style="text-align:center;padding:32px;color:#445;font-family:\'DM Mono\',monospace;font-size:12px;">Scan en cours…</div>';

  chrome.runtime.sendMessage({ action: 'getAuditResults', mode, depth }, response => {
    btnAudit.disabled = false;
    btnAudit.textContent = '↻ Relancer l\'audit';

    if (!response || !response.success) {
      resultsEl.innerHTML = `<div style="color:#FF4444;padding:16px;font-size:12px;">Erreur : ${response?.error || 'Impossible de communiquer avec la page.'}</div>`;
      return;
    }

    currentReport = response.report;
    renderScore(currentReport.score);
    renderResults(currentReport.results, currentFilter);
    urlDisplay.textContent = currentReport.url;
    scoreBar.style.display = 'flex';
    scoreExplain.style.display = 'block';
    filters.style.display = 'flex';
    footer.style.display = 'flex';
  });
});

// ── SCORE ────────────────────────────────────

function renderScore(score) {
  const circ = 2 * Math.PI * 22; // r=22
  const offset = circ - (score.taux / 100) * circ;
  const color = score.taux >= 75 ? '#00C896' : score.taux >= 50 ? '#FFB800' : '#FF4444';

  document.getElementById('scoreCircle').style.strokeDashoffset = offset;
  document.getElementById('scoreCircle').style.stroke = color;
  document.getElementById('scoreValue').textContent = score.taux + '%';
  document.getElementById('scoreValue').style.color = color;

  document.getElementById('statNC').textContent = score.nonConformes;
  document.getElementById('statC').textContent = score.conformes;
  document.getElementById('statNA').textContent = score.na;
  document.getElementById('statTotal').textContent = score.total;

  const pagesCount = Number(currentReport?.pagesAudited || (currentReport?.pages?.length || 1));
  scoreExplain.textContent = `Conformité: ${score.taux}% · Critères non conformes: ${score.nonConformes} · Critères conformes: ${score.conformes} · Critères non applicables: ${score.na} · Pages auditées: ${pagesCount}`;
}

// ── RÉSULTATS ────────────────────────────────

function renderResults(results, filter) {
  const filtered = filter === 'all' ? results : results.filter(r => r.status === filter);

  if (!filtered.length) {
    resultsEl.innerHTML = `<div style="text-align:center;padding:24px;color:#445;font-size:12px;">Aucun résultat pour ce filtre.</div>`;
    return;
  }

  // Dédoublonner par critère + message
  const seen = new Set();
  const deduped = filtered.filter(r => {
    const key = `${r.id}-${r.status}-${r.message.slice(0, 40)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  resultsEl.innerHTML = deduped.map(r => `
    <div class="result-item" title="${r.xpath || ''}">
      <span class="result-id">${r.id}</span>
      <span class="result-badge badge-${r.status}">${r.status}</span>
      <div class="result-text">
        ${escHtml(r.message)}
        ${r.pageUrl ? `<div class="result-snippet" title="${escHtml(r.pageUrl)}">Page: ${escHtml(r.pageUrl)}</div>` : ''}
        ${r.snippet ? `<div class="result-snippet">${escHtml(r.snippet)}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── FILTRES ──────────────────────────────────

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    if (currentReport) renderResults(currentReport.results, currentFilter);
  });
});

// ── EXPORT JSON ──────────────────────────────

document.getElementById('btnExport').addEventListener('click', () => {
  if (!currentReport) return;
  const blob = new Blob([JSON.stringify(currentReport, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rgaa-audit-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btnExportHtml').addEventListener('click', () => {
  if (!currentReport) return;
  const html = buildVulgarizedHtml(currentReport);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  chrome.tabs.create({ url });
});

modeSelect.addEventListener('change', () => {
  const isMulti = modeSelect.value === 'multi';
  depthInput.disabled = !isMulti;
  depthWrap.classList.toggle('hidden', !isMulti);
});
depthInput.disabled = modeSelect.value !== 'multi';
depthWrap.classList.toggle('hidden', modeSelect.value !== 'multi');

function buildVulgarizedHtml(report) {
  const score = report.score || { taux: 0, nonConformes: 0, conformes: 0, na: 0, total: 0 };
  const pages = Array.isArray(report.pages) && report.pages.length
    ? report.pages
    : [{ url: report.url || '', title: report.title || report.url || 'Page', score }];
  const skipped = Array.isArray(report.pagesSkipped) ? report.pagesSkipped : [];
  const results = Array.isArray(report.results) ? report.results : [];
  const topNc = results.filter((r) => r.status === 'NC').slice(0, 20);
  const ods = report.odsDownload || null;
  const hasOds = Boolean(ods?.base64 && ods?.fileName);

  const pageRows = pages.map((p) => {
    const pScore = p.score || {};
    const taux = Number(pScore.taux ?? 0);
    const nc = Number(pScore.nonConformes ?? p.nonConformes ?? 0);
    const c = Number(pScore.conformes ?? p.conformes ?? 0);
    const url = escHtml(p.url || '');
    return `<li><strong>${escHtml(p.title || p.url || 'Page')}</strong><br><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a><br>Conformité: <strong>${taux}%</strong> · Critères non conformes: <strong>${nc}</strong> · Critères conformes: <strong>${c}</strong></li>`;
  }).join('');

  const skippedRows = skipped.map((p) =>
    `<li>${escHtml(p.url || '')} — ${escHtml(p.reason || 'erreur')}</li>`
  ).join('');

  const ncRows = topNc.map((r) => `
    <li><strong>${escHtml(r.id || '')}</strong> — ${escHtml(r.message || '')}${r.pageUrl ? `<br><span style="color:#475569">Page: ${escHtml(r.pageUrl)}</span>` : ''}</li>
  `).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport vulgarisé — ${escHtml(report.title || report.url || 'Audit RGAA')}</title>
  <style>
    body { margin:0; font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, sans-serif; background:#f7f8fc; color:#1d2433; }
    .wrap { max-width:980px; margin:0 auto; padding:28px 20px 40px; }
    h1 { margin:0 0 6px; font-size:28px; }
    .sub { color:#5b6476; margin-bottom:20px; }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(140px,1fr)); gap:12px; margin:18px 0 24px; }
    .kpi { background:#fff; border:1px solid #dfe4ef; border-radius:12px; padding:12px 14px; }
    .kpi .v { font-size:30px; font-weight:700; line-height:1.05; }
    .kpi .l { font-size:12px; color:#5b6476; margin-top:4px; }
    .box { background:#fff; border:1px solid #dfe4ef; border-radius:12px; padding:14px; margin-bottom:16px; }
    .disclaimer { margin-bottom:16px; padding:10px 12px; border-radius:10px; background:#fff7e6; border:1px solid #f5c96a; color:#7a4a00; font-size:12px; }
    .tools { display:flex; flex-wrap:wrap; gap:10px; margin: 8px 0 14px; }
    .btn { border:1px solid #c9d4ea; background:#fff; color:#1f2a44; border-radius:10px; padding:8px 12px; font-weight:600; cursor:pointer; text-decoration:none; }
    .btn:hover { background:#f3f7ff; }
    .btn:disabled { opacity:.5; cursor:not-allowed; }
    .hint { margin-top:8px; color:#5b6476; font-size:12px; }
    ul { margin: 8px 0 0 18px; }
    li { margin: 6px 0; line-height:1.45; }
    a { color:#0f4fbf; word-break:break-all; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Rapport vulgarisé d’accessibilité</h1>
    <div class="sub">${escHtml(report.title || report.url || '')} · ${new Date(report.timestamp || Date.now()).toLocaleString('fr-FR')}</div>
    <div class="disclaimer"><strong>Avertissement:</strong> ce rapport ne remplace pas un audit professionnel et n'est pas certifiant.</div>
    <div class="tools">
      <button class="btn" type="button" onclick="window.print()">Exporter PDF</button>
      <button class="btn" type="button" onclick="downloadJson()">Télécharger JSON</button>
      <button class="btn" type="button" onclick="downloadOds()" ${hasOds ? '' : 'disabled'}>Télécharger ODS</button>
      <a class="btn" href="https://products.aspose.app/cells/fr/viewer/ods" target="_blank" rel="noopener noreferrer">Lire ODS en ligne</a>
    </div>
    ${hasOds ? '' : '<div class="hint">ODS non généré depuis l’extension. Utiliser le CLI pour produire la grille ODS.</div>'}

    <div class="grid">
      <div class="kpi"><div class="v">${score.taux}%</div><div class="l">Niveau global</div></div>
      <div class="kpi"><div class="v">${score.nonConformes}</div><div class="l">Critères non conformes</div></div>
      <div class="kpi"><div class="v">${score.conformes}</div><div class="l">Critères conformes</div></div>
      <div class="kpi"><div class="v">${pages.length}</div><div class="l">Pages auditées</div></div>
    </div>

    <div class="box">
      <strong>Pages auditées (${pages.length})</strong>
      <ul>${pageRows}</ul>
    </div>

    ${skipped.length ? `<div class="box"><strong>Pages non auditées (${skipped.length})</strong><ul>${skippedRows}</ul></div>` : ''}

    <div class="box">
      <strong>Principales non-conformités détectées (${topNc.length})</strong>
      <ul>${ncRows || '<li>Aucune non-conformité détectée.</li>'}</ul>
    </div>
  </div>
  <script>
    const REPORT_DATA = ${JSON.stringify(report)};
    const ODS_DOWNLOAD = ${JSON.stringify(hasOds ? ods : null)};
    function downloadJson() {
      const blob = new Blob([JSON.stringify(REPORT_DATA, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rgaa-audit.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
    function downloadOds() {
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
