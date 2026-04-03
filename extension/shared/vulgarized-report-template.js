'use strict';

(function init(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.RgaaSharedReport = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function factory() {
  function generateVulgarizedReport(report, opts) {
    const options = opts || {};
    const includeCliLink = options.includeCliLink !== false;

    const safeReport = report || {};
    const summary = summarizeCriteria(Array.isArray(safeReport.results) ? safeReport.results : []);
    const top = buildTopPriorities(summary.byCriterion).slice(0, 5);
    const score = safeReport.score || { taux: 0, nonConformes: 0, conformes: 0, na: 0, total: 0 };
    const positives = buildPositiveSignals(safeReport);
    const encouragement = buildEncouragement(score);
    const actionLevers = buildActionLevers(top, summary.byCriterion);

    const cards = top.map((item) => `
      <div class="card">
        <div class="chip chip-${item.priority.toLowerCase()}">${item.priority}</div>
        <h3>${esc(item.title)}</h3>
        <p><strong>Constat :</strong> ${esc(item.issue)}</p>
        <p><strong>Impact :</strong> ${esc(item.impact)}</p>
        <p><strong>Action :</strong> ${esc(item.action)}</p>
        <p class="meta">Critère RGAA ${esc(item.criterion)} · Effort ${esc(item.effort)}</p>
      </div>
    `).join('');

    const avg = top.length ? Math.round(top.reduce((acc, item) => acc + effortToPoints(item.effort), 0) / top.length) : 0;
    const effortLabel = avg <= 1 ? 'Faible' : avg === 2 ? 'Moyen' : 'Élevé';

    const ods = safeReport.odsDownload || null;
    const hasOds = Boolean(ods && ods.base64 && ods.fileName);

    const reportDataScript = toInlineJson(safeReport);
    const odsDataScript = toInlineJson(hasOds ? ods : null);

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport vulgarisé — ${esc(safeReport.title || safeReport.url || 'Audit RGAA')}</title>
  <style>
    body { margin:0; font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, sans-serif; background:#f7f8fc; color:#1d2433; }
    .wrap { max-width: 980px; margin: 0 auto; padding: 28px 20px 40px; }
    h1 { margin: 0 0 6px; font-size: 28px; }
    .sub { color:#5b6476; margin-bottom:20px; overflow-wrap:anywhere; }
    .grid { display:grid; grid-template-columns: repeat(4, minmax(140px,1fr)); gap:12px; margin:18px 0 24px; }
    .kpi { background:#fff; border:1px solid #dfe4ef; border-radius:12px; padding:12px 14px; }
    .kpi .v { font-size:30px; font-weight:700; line-height:1.05; }
    .kpi .l { font-size:12px; color:#5b6476; margin-top:4px; }
    .box { background:#fff; border:1px solid #dfe4ef; border-radius:12px; padding:14px; margin-bottom:16px; }
    .cards { display:grid; grid-template-columns: repeat(auto-fit, minmax(280px,1fr)); gap:12px; }
    .card { background:#fff; border:1px solid #dfe4ef; border-radius:12px; padding:14px; }
    .card p, .card li, .where, .where li { overflow-wrap:anywhere; word-break:break-word; }
    .chip { display:inline-block; font-size:11px; font-weight:700; border-radius:999px; padding:4px 8px; margin-bottom:8px; }
    .chip-p1 { background:#ffdfe0; color:#a3181f; }
    .chip-p2 { background:#fff1d6; color:#9b5d00; }
    .chip-p3 { background:#dff6ff; color:#0a5271; }
    .meta { font-size:12px; color:#5b6476; margin-top:8px; }
    ul { margin: 8px 0 0 18px; }
    li { margin: 4px 0; }
    .tools { display:flex; flex-wrap:wrap; gap:10px; margin: 8px 0 14px; }
    .btn { border:1px solid #c9d4ea; background:#fff; color:#1f2a44; border-radius:10px; padding:8px 12px; font-weight:600; cursor:pointer; text-decoration:none; }
    .btn:hover { background:#f3f7ff; }
    .where { margin-top:8px; font-size:13px; color:#334155; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:8px; }
    .hint { margin-top:8px; color:#5b6476; font-size:12px; }
    .disclaimer { margin-bottom:16px; padding:10px 12px; border-radius:10px; background:#fff7e6; border:1px solid #f5c96a; color:#7a4a00; font-size:12px; }
    a { color:#0f4fbf; word-break:break-all; }
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
    <div class="sub">${esc(safeReport.title || safeReport.url || '')} · ${new Date(safeReport.timestamp || Date.now()).toLocaleString('fr-FR')}</div>
    <div class="disclaimer"><strong>Projet associatif vibe codé —</strong> Cet outil est développé bénévolement par Le Singe Du Numérique dans une démarche d'ouverture de l'accessibilité au plus grand nombre. Il s'agit d'un pré-audit automatique, non certifié, basé sur le RGAA 4.1. Les résultats peuvent comporter des erreurs et ne remplacent pas un audit réalisé par un professionnel certifié, ni un accompagnement spécialisé. Utilisez-le comme point de départ, pas comme conclusion.</div>

    <div class="tools">
      <button type="button" class="btn" id="btnDownloadHtml">Télécharger HTML</button>
      <button type="button" class="btn" id="btnExportPdf">Exporter PDF</button>
      <button type="button" class="btn" id="btnDownloadJson">Télécharger JSON</button>
      ${hasOds ? '<button type="button" class="btn" id="btnDownloadOds">Télécharger ODS</button>' : ''}
      ${hasOds ? '<a class="btn" href="https://products.aspose.app/cells/fr/viewer/ods" target="_blank" rel="noopener noreferrer">Lire ODS en ligne</a>' : ''}
      ${includeCliLink ? '<a class="btn" href="https://stan69000.github.io/rgaa-audit/" target="_blank" rel="noopener noreferrer">Audit complet CLI</a>' : ''}
    </div>
    ${!hasOds ? '<div class="hint">ODS non disponible dans ce rapport.</div>' : ''}

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
        ${positives.map((item) => `<li>${esc(item)}</li>`).join('')}
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

    ${renderVulgarizedPages(safeReport)}
    ${renderVulgarizedSkippedPages(safeReport)}

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
    const REPORT_DATA = ${reportDataScript};
    const ODS_DOWNLOAD = ${odsDataScript};

    const btnHtml = document.getElementById('btnDownloadHtml');
    const btnPdf = document.getElementById('btnExportPdf');
    const btnJson = document.getElementById('btnDownloadJson');
    const btnOds = document.getElementById('btnDownloadOds');

    if (btnHtml) btnHtml.addEventListener('click', downloadHtmlReport);
    if (btnPdf) btnPdf.addEventListener('click', () => window.print());
    if (btnJson) btnJson.addEventListener('click', downloadJson);
    if (btnOds) btnOds.addEventListener('click', downloadOdsReport);

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
      const statuses = items.map((i) => i.status);
      if (!statuses.includes('NC')) continue;
      const firstMessage = items.find((i) => i.status === 'NC')?.message || 'Non-conformité détectée';
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

  function renderVulgarizedSkippedPages(report) {
    const skipped = Array.isArray(report.pagesSkipped) ? report.pagesSkipped : [];
    if (!skipped.length) return '';

    const rows = skipped.map((p) => {
      const href = esc(p.url || '');
      const urlLine = href
        ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${href}</a>`
        : 'URL indisponible';
      return `<li>${urlLine} — ${esc(p.reason || 'erreur')}</li>`;
    }).join('');

    return `
      <div class="box" style="margin-top:16px;">
        <strong>Pages non auditées (${skipped.length})</strong>
        <ul>${rows}</ul>
        <p style="margin-top:8px;color:#5b6476;">Ces pages ont été détectées mais ignorées (ex: timeout). Le reste de l'audit est conservé.</p>
      </div>
    `;
  }

  function esc(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toInlineJson(value) {
    return JSON.stringify(value)
      .replace(/</g, '\\u003C')
      .replace(/>/g, '\\u003E')
      .replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  }

  return { generateVulgarizedReport };
});
