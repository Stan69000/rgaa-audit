'use strict';

(function init(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.RgaaSharedReport = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function factory() {
  function escHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function generateVulgarizedReport(report, opts) {
    const options = opts || {};
    const includeCliLink = options.includeCliLink !== false;
    const score = report && report.score ? report.score : { taux: 0, nonConformes: 0, conformes: 0, na: 0, total: 0 };
    const pages = Array.isArray(report && report.pages) && report.pages.length
      ? report.pages
      : [{ url: report && report.url ? report.url : '', title: report && (report.title || report.url) ? (report.title || report.url) : 'Page', score }];
    const skipped = Array.isArray(report && report.pagesSkipped) ? report.pagesSkipped : [];
    const results = Array.isArray(report && report.results) ? report.results : [];
    const topNc = results.filter((r) => r.status === 'NC').slice(0, 20);
    const ods = report && report.odsDownload ? report.odsDownload : null;
    const hasOds = Boolean(ods && ods.base64 && ods.fileName);

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

    const ncRows = topNc.map((r) =>
      `<li><strong>${escHtml(r.id || '')}</strong> — ${escHtml(r.message || '')}${r.pageUrl ? `<br><span style="color:#475569">Page: ${escHtml(r.pageUrl)}</span>` : ''}</li>`
    ).join('');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport vulgarisé — ${escHtml((report && (report.title || report.url)) || 'Audit RGAA')}</title>
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
    <div class="sub">${escHtml((report && (report.title || report.url)) || '')} · ${new Date((report && report.timestamp) || Date.now()).toLocaleString('fr-FR')}</div>
    <div class="disclaimer"><strong>Avertissement:</strong> ce rapport ne remplace pas un audit professionnel et n'est pas certifiant.</div>
    <div class="tools">
      <button class="btn" type="button" onclick="downloadHtmlReport()">Télécharger HTML</button>
      <button class="btn" type="button" onclick="window.print()">Exporter PDF</button>
      <button class="btn" type="button" onclick="downloadJson()">Télécharger JSON</button>
      ${hasOds ? '<button class="btn" type="button" onclick="downloadOds()">Télécharger ODS</button>' : ''}
      ${hasOds ? '<a class="btn" href="https://products.aspose.app/cells/fr/viewer/ods" target="_blank" rel="noopener noreferrer">Lire ODS en ligne</a>' : ''}
      ${includeCliLink ? '<a class="btn" href="https://stan69000.github.io/rgaa-audit/" target="_blank" rel="noopener noreferrer">Audit complet CLI</a>' : ''}
    </div>
    ${!hasOds ? '<div class="hint">ODS non disponible dans ce rapport.</div>' : ''}

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
    const REPORT_DATA = ${JSON.stringify(report || {})};
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

  return { generateVulgarizedReport };
});
