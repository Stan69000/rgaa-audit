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
    const score = safeReport.score || { taux: 0, nonConformes: 0, conformes: 0, aVerifier: 0, na: 0, total: 0 };
    const positives = buildPositiveSignals(safeReport);
    const encouragement = buildEncouragement(score);
    const actionLevers = buildActionLevers(top, summary.byCriterion);
    const transparencyBox = renderTransparency(safeReport);
    const toCheck = renderToCheck(summary.byCriterion);

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
    const newWindowHint = '<span class="sr-only"> (ouvre dans une nouvelle fenêtre)</span>';

    // Les captures sont déjà dans la page : inutile de les dupliquer dans le JSON téléchargeable.
    const { captures: _captures, ...reportForJson } = safeReport;
    const reportDataScript = toInlineJson(reportForJson);
    const odsDataScript = toInlineJson(hasOds ? ods : null);

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport vulgarisé — ${esc(safeReport.title || safeReport.url || 'Audit RGAA')}</title>
  <style>
    :root {
      --bg-1:#f5f8ff;
      --bg-2:#eef8f3;
      --panel:#ffffff;
      --border:#d8e1ee;
      --ink:#142033;
      --muted:#4f5e74;
      --brand:#0f4fbf;
      --brand-dark:#0d3f97;
      --ok-bg:#e6f5ee;
      --ok-fg:#085a3a;
      --warn-bg:#fff4df;
      --warn-fg:#9b5d00;
      --high-bg:#ffe5e6;
      --high-fg:#9f1d1d;
      --shadow:0 12px 28px rgba(15, 37, 74, 0.08);
    }
    body {
      margin:0;
      font-family: "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      line-height:1.5;
      background:
        radial-gradient(circle at 0 0, #dce9ff 0, transparent 42%),
        radial-gradient(circle at 100% 15%, #d9f3e5 0, transparent 36%),
        linear-gradient(180deg, var(--bg-1), var(--bg-2));
      color:var(--ink);
    }
    .skip-link {
      position:absolute;
      left:8px;
      top:8px;
      transform:translateY(-140%);
      padding:8px 12px;
      border-radius:8px;
      background:#0f4fbf;
      color:#fff;
      font-weight:700;
      z-index:1000;
      transition:transform .2s ease;
    }
    .skip-link:focus { transform:translateY(0); }
    .wrap { max-width: 1020px; margin: 0 auto; padding: 28px 20px 40px; }
    h1 { margin: 0 0 8px; font-size: 34px; line-height:1.1; letter-spacing:-0.02em; }
    h2 { font-size: 24px; letter-spacing: -0.01em; }
    .sub { color:var(--muted); margin-bottom:18px; overflow-wrap:anywhere; }
    .hero {
      background:linear-gradient(120deg, #11284f 0%, #0f4fbf 58%, #2f7fff 100%);
      color:#fff;
      border-radius:16px;
      padding:18px 18px 16px;
      margin-bottom:16px;
      box-shadow:var(--shadow);
    }
    .hero p { margin:6px 0 0; color:#e9f0ff; }
    .badge {
      display:inline-block;
      padding:5px 9px;
      border-radius:999px;
      background:rgba(255,255,255,0.16);
      border:1px solid rgba(255,255,255,0.25);
      font-size:12px;
      font-weight:700;
    }
    .grid { display:grid; grid-template-columns: repeat(5, minmax(120px,1fr)); gap:12px; margin:18px 0 24px; }
    .kpi { background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:12px 14px; box-shadow:0 8px 18px rgba(15, 37, 74, 0.05); transition:transform .25s ease, box-shadow .25s ease; }
    .kpi:hover { transform:translateY(-2px); box-shadow:0 14px 24px rgba(15, 37, 74, 0.09); }
    .kpi .v { font-size:30px; font-weight:700; line-height:1.05; }
    .kpi .l { font-size:12px; color:var(--muted); margin-top:4px; }
    .box { background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:14px; margin-bottom:16px; box-shadow:0 8px 18px rgba(15, 37, 74, 0.04); }
    .cards { display:grid; grid-template-columns: repeat(auto-fit, minmax(280px,1fr)); gap:12px; }
    .card { background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:14px; box-shadow:0 8px 18px rgba(15, 37, 74, 0.04); transition:transform .25s ease, box-shadow .25s ease, border-color .25s ease; }
    .card:hover { transform:translateY(-3px); box-shadow:0 18px 28px rgba(15, 37, 74, 0.1); border-color:#c6d7f0; }
    .card p, .card li, .where, .where li { overflow-wrap:anywhere; word-break:break-word; }
    .chip { display:inline-block; font-size:11px; font-weight:700; border-radius:999px; padding:4px 8px; margin-bottom:8px; }
    .chip-p1 { background:var(--high-bg); color:var(--high-fg); }
    .chip-p2 { background:var(--warn-bg); color:var(--warn-fg); }
    .chip-p3 { background:#def3ff; color:#0b5470; }
    .meta { font-size:12px; color:var(--muted); margin-top:8px; }
    ul { margin: 8px 0 0 18px; }
    li { margin: 4px 0; }
    .tools { display:flex; flex-wrap:wrap; gap:10px; margin: 8px 0 14px; }
    .btn { border:1px solid #bfd0eb; background:var(--panel); color:#19315a; border-radius:10px; padding:8px 12px; font-weight:700; cursor:pointer; text-decoration:none; transition:all .2s ease; }
    .btn:hover { background:#eef4ff; border-color:#a8c1e8; transform:translateY(-1px); }
    .btn:focus-visible, a:focus-visible, button:focus-visible { outline:3px solid #0f4fbf; outline-offset:2px; }
    .criterion-block { border-top:1px solid var(--border); padding:8px 0; }
    .criterion-block summary { cursor:pointer; line-height:1.5; }
    .issues { list-style:none; padding:0; margin:8px 0 0; }
    .issue { padding:8px 0 8px 12px; border-left:3px solid #d8e1ee; margin:6px 0; overflow-wrap:anywhere; }
    .examples { margin:6px 0 0 18px; font-size:12px; }
    .examples code { font-size:12px; }
    code.snippet { color:var(--muted); }
    .capture { margin:8px 0 0; }
    .capture img { max-width:100%; height:auto; border:1px solid var(--border); border-radius:8px; }
    .capture figcaption { font-size:12px; color:var(--muted); }
    .where { margin-top:8px; font-size:13px; color:#334155; background:#f8fbff; border:1px solid #dfebfb; border-radius:10px; padding:8px; }
    .hint { margin-top:8px; color:var(--muted); font-size:12px; }
    .disclaimer { margin-bottom:16px; padding:10px 12px; border-radius:12px; background:var(--warn-bg); border:1px solid #f2c066; color:#6a4200; font-size:12px; }
    .intro-impact { font-size:16px; margin:0; }
    .pillars { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-top:12px; }
    .pillar { background:#f8fbff; border:1px solid #dbe7f8; border-radius:10px; padding:10px; font-size:13px; }
    .pillar strong { display:block; margin-bottom:3px; color:#17325f; }
    .punchline { margin:10px 0 0; font-weight:700; color:#17325f; }
    .resources a { margin-right:12px; }
    .transparency-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:10px; margin-top:10px; }
    .transparency-item { border-radius:10px; padding:10px; border:1px solid #d8e4f8; background:#f6faff; transition:transform .2s ease, border-color .2s ease; }
    .transparency-item:hover { transform:translateY(-2px); border-color:#bad0f2; }
    .transparency-item strong { display:block; color:#16335f; margin-bottom:3px; }
    .transparency-score { margin-top:10px; padding:10px; border-radius:10px; border:1px solid #dce7f8; background:#f9fbff; }
    .sr-only {
      position:absolute;
      width:1px;
      height:1px;
      padding:0;
      margin:-1px;
      overflow:hidden;
      clip:rect(0, 0, 0, 0);
      white-space:nowrap;
      border:0;
    }
    a { color:var(--brand); overflow-wrap:anywhere; word-break:normal; }
    a:hover { color:var(--brand-dark); }
    .reveal {
      opacity:0;
      transform:translateY(12px);
      animation:fadeLift .55s ease forwards;
    }
    .delay-1 { animation-delay:.06s; }
    .delay-2 { animation-delay:.12s; }
    .delay-3 { animation-delay:.18s; }
    .delay-4 { animation-delay:.24s; }
    @keyframes fadeLift {
      from { opacity:0; transform:translateY(12px); }
      to { opacity:1; transform:translateY(0); }
    }
    @media (max-width: 900px) {
      .grid { grid-template-columns: repeat(2, minmax(120px,1fr)); }
      .pillars { grid-template-columns:1fr; }
      h1 { font-size:30px; }
    }
    @media (max-width: 520px) {
      .grid { grid-template-columns: 1fr; }
      h1 { font-size:28px; }
      .hero { padding:14px; }
    }
    @media print {
      .tools { display:none; }
      body { background:#fff; }
      .wrap { max-width: none; }
      .box, .kpi, .card { break-inside: avoid; }
    }
    @media (prefers-reduced-motion: reduce) {
      * { animation:none !important; transition:none !important; }
      .reveal { opacity:1; transform:none; }
    }
  </style>
</head>
<body>
  <a href="#main-content" class="skip-link">Aller au contenu principal</a>
  <main id="main-content" class="wrap" tabindex="-1">
    <div class="hero reveal">
      <span class="badge">Pré-audit RGAA vulgarisé</span>
      <h1>Votre accessibilité, en version claire et actionnable</h1>
      <p class="intro-impact">En moins de 3 minutes, vous savez quoi corriger d’abord pour débloquer le plus d’utilisateurs.</p>
    </div>
    <div class="sub reveal delay-1">${esc(safeReport.title || safeReport.url || '')} · ${new Date(safeReport.timestamp || Date.now()).toLocaleString('fr-FR')}</div>
    <div class="disclaimer reveal delay-1"><strong>Projet associatif vibe codé —</strong> Cet outil est développé bénévolement par Le Singe Du Numérique dans une démarche d'ouverture de l'accessibilité au plus grand nombre. Il s'agit d'un pré-audit automatique, non certifié, basé sur le RGAA 4.1.2. Les résultats peuvent comporter des erreurs et ne remplacent pas un audit réalisé par un professionnel certifié, ni un accompagnement spécialisé. Utilisez-le comme point de départ, pas comme conclusion.</div>

    <div class="tools reveal delay-2">
      <button type="button" class="btn" id="btnDownloadHtml">Télécharger HTML</button>
      <button type="button" class="btn" id="btnExportPdf">Exporter PDF</button>
      <button type="button" class="btn" id="btnDownloadJson">Télécharger JSON</button>
      ${hasOds ? '<button type="button" class="btn" id="btnDownloadOds">Télécharger ODS</button>' : ''}
      ${hasOds ? `<a class="btn" href="https://products.aspose.app/cells/fr/viewer/ods" target="_blank" rel="noopener noreferrer">Lire ODS en ligne${newWindowHint}</a>` : ''}
      ${includeCliLink ? `<a class="btn" href="https://stan69000.github.io/rgaa-audit/" target="_blank" rel="noopener noreferrer">Site du projet RGAA Audit${newWindowHint}</a>` : ''}
      <a class="btn" href="https://lesingedunumerique.fr/" target="_blank" rel="noopener noreferrer">Le Singe Du Numérique${newWindowHint}</a>
    </div>
    ${!hasOds ? '<div class="hint">ODS non disponible dans ce rapport.</div>' : ''}

    <div class="grid reveal delay-2">
      <div class="kpi"><div class="v">${score.taux}%</div><div class="l">Score technique auto</div></div>
      <div class="kpi"><div class="v">${score.nonConformes}</div><div class="l">Critères non conformes</div></div>
      <div class="kpi"><div class="v">${score.aVerifier || 0}</div><div class="l">Critères à vérifier</div></div>
      <div class="kpi"><div class="v">${score.conformes}</div><div class="l">Critères conformes</div></div>
      <div class="kpi"><div class="v">${effortLabel}</div><div class="l">Effort moyen estimé</div></div>
    </div>

    <div class="box reveal delay-3">
      <strong>Lecture rapide</strong>
      <ul>
        <li>Ce rapport montre où des personnes peuvent être bloquées dès maintenant.</li>
        <li>Le score ne compte que les critères tranchés automatiquement (conformes ou non conformes) : il mesure une progression, il ne certifie pas une conformité RGAA.</li>
        <li>Les critères « à vérifier » signalent des indices à confirmer par une personne ; ils n’entrent pas dans le score.</li>
        <li>Les priorités P1 sont les corrections qui ont le plus d’impact utilisateur immédiat.</li>
        <li>La validation finale reste humaine, surtout sur la compréhension et le sens des contenus.</li>
      </ul>
      <div class="pillars">
        <div class="pillar"><strong>P1</strong>Blocages forts. À corriger en premier.</div>
        <div class="pillar"><strong>P2</strong>Gêne réelle. À traiter juste après.</div>
        <div class="pillar"><strong>P3</strong>Amélioration utile. À planifier ensuite.</div>
      </div>
      <p class="punchline">Logique recommandée: P1 d’abord, puis stabilisation P2/P3.</p>
    </div>
    ${transparencyBox}

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

    ${toCheck}

    <h2 style="margin-top:16px;">Leviers actionnables</h2>
    <div class="cards">
      ${actionLevers || '<div class="card"><h3>Aucun levier critique détecté</h3><p>Les points non conformes sont mineurs ou absents sur cet échantillon.</p></div>'}
    </div>

    ${renderTemplateIssues(safeReport)}
    ${renderAllIssues(summary.byCriterion, safeReport)}
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
    <div class="box resources reveal delay-4">
      <strong>Ressources utiles</strong>
      <p><a href="https://stan69000.github.io/rgaa-audit/" target="_blank" rel="noopener noreferrer">Site du projet${newWindowHint}</a></p>
      <p><a href="https://lesingedunumerique.fr/" target="_blank" rel="noopener noreferrer">Site de l'association${newWindowHint}</a></p>
      <p><a href="https://stan-bouchet.com/" target="_blank" rel="noopener noreferrer">Le créateur${newWindowHint}</a></p>
    </div>
  </main>

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
      const ncItems = items.filter((i) => i.status === 'NC');
      const firstMessage = ncItems[0]?.message || 'Non-conformité détectée';
      const occurrences = ncItems.reduce((acc, i) => acc + (Number(i.count) || 1), 0);
      priorities.push({ ...enrichPriority(criterion, firstMessage), occurrences });
    }
    return priorities.sort((a, b) => priorityScore(b.priority) - priorityScore(a.priority) || b.occurrences - a.occurrences);
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
      '6': {
        title: 'Liens incompréhensibles',
        impact: 'Un lien sans intitulé clair est annoncé « lien » sans indiquer où il mène.',
        action: 'Donner à chaque lien un intitulé qui décrit sa destination.',
        priority: 'P1',
        effort: 'S',
      },
      '7': {
        title: 'Composants interactifs mal codés',
        impact: 'Menus, onglets ou boutons personnalisés sont inutilisables au clavier ou au lecteur d’écran.',
        action: 'Préférer les éléments HTML natifs, sinon corriger rôles, états et gestion clavier.',
        priority: 'P1',
        effort: 'M',
      },
      '8': {
        title: 'Éléments obligatoires manquants',
        impact: 'Langue, titre ou validité du code mal définis perturbent les aides techniques.',
        action: 'Corriger la langue, le titre de page et les identifiants en double.',
        priority: 'P2',
        effort: 'S',
      },
      '9': {
        title: 'Structure de page peu lisible',
        impact: 'Sans titres ni zones balisées, la navigation rapide au lecteur d’écran devient impossible.',
        action: 'Baliser titres, listes et zones (header, nav, main, footer).',
        priority: 'P2',
        effort: 'S',
      },
      '13': {
        title: 'Consultation perturbée',
        impact: 'Redirections, rafraîchissements ou animations non contrôlables gênent la lecture.',
        action: 'Laisser l’utilisateur maître du temps et des mouvements.',
        priority: 'P2',
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

    const decided = Number(score.conformes || 0) + Number(score.nonConformes || 0);
    if (typeof score.conformes === 'number' && decided > 0) {
      positives.push(`${score.conformes} critère(s) conforme(s) sur ${decided} critère(s) tranché(s) automatiquement.`);
    }
    if (typeof score.na === 'number' && score.na > 0) {
      positives.push(`${score.na} critères sont non applicables sur cette page (pas de faux signal à corriger).`);
    }

    const simulation = report.simulation || {};
    if (typeof simulation.c === 'number' && simulation.c > 0) {
      positives.push(`${simulation.c} vérifications utilisateur (clavier, responsive, CSS) sont passées.`);
    }
    const focusOk = (Array.isArray(report.results) ? report.results : [])
      .some((r) => r && r.source === 'simulation' && r.id === '10.7' && r.status === 'C');
    if (focusOk && simulation.focusElementsTested > 0) {
      positives.push(`Le focus clavier est visible sur les ${simulation.focusElementsTested} éléments parcourus.`);
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
      const nt = Number(p.score?.aVerifier ?? p.aVerifier ?? 0);
      const href = esc(p.url || '');
      const urlLine = href
        ? `<a href="${href}" target="_blank" rel="noopener noreferrer" style="word-break:break-all;">${href}</a>`
        : 'URL indisponible';
      return `<li><strong>${esc(p.title || p.url || 'Page')}</strong><br>${urlLine}<br>Conformité: <strong>${taux}%</strong> · Critères non conformes: <strong>${nc}</strong> · À vérifier: <strong>${nt}</strong> · Critères conformes: <strong>${c}</strong></li>`;
    }).join('');

    return `
      <div class="box" style="margin-top:16px;">
        <strong>Pages auditées (${data.length})</strong>
        <ul>${rows}</ul>
      </div>
    `;
  }

  function renderTransparency(report) {
    const findings = Array.isArray(report?.results) ? report.results : [];
    const byType = { probable_error: 0, heuristic_warning: 0, good_signal: 0, manual_only: 0, unknown: 0 };
    const byConfidence = { high: 0, medium: 0, low: 0, unknown: 0 };
    let manualRecommended = 0;

    for (const item of findings) {
      const type = String(item?.resultType || 'unknown');
      const confidence = String(item?.confidence || 'unknown');
      if (Object.prototype.hasOwnProperty.call(byType, type)) byType[type]++;
      else byType.unknown++;
      if (Object.prototype.hasOwnProperty.call(byConfidence, confidence)) byConfidence[confidence]++;
      else byConfidence.unknown++;
      if (item?.manualReviewRecommended) manualRecommended++;
    }

    return `
      <div class="box">
        <strong>Transparence des contrôles: comment lire ces chiffres</strong>
        <p style="margin:8px 0 0;color:#44556f;">Objectif: vous dire clairement ce qui est quasi certain, ce qui est probable, et ce qui doit être confirmé par un humain.</p>
        <div class="transparency-grid">
          <div class="transparency-item">
            <strong>Erreurs probables (${byType.probable_error})</strong>
            Le code montre un problème technique très plausible à corriger.
          </div>
          <div class="transparency-item">
            <strong>Alertes heuristiques (${byType.heuristic_warning})</strong>
            Indices de risque. La piste est utile, mais nécessite une vérification.
          </div>
          <div class="transparency-item">
            <strong>Signaux positifs (${byType.good_signal})</strong>
            Points où un comportement accessible a été détecté automatiquement.
          </div>
          <div class="transparency-item">
            <strong>Manuel uniquement (${byType.manual_only})</strong>
            Sujets impossibles à certifier automatiquement (sens, contexte, compréhension).
          </div>
        </div>
        <div class="transparency-score">
          <strong>Niveau de confiance de la détection</strong>
          <p style="margin:6px 0 0;">Haute: <strong>${byConfidence.high}</strong> · Moyenne: <strong>${byConfidence.medium}</strong> · Basse: <strong>${byConfidence.low}</strong></p>
          <p style="margin:6px 0 0;">Vérification manuelle recommandée: <strong>${manualRecommended}</strong> résultat(s).</p>
        </div>
      </div>
    `;
  }

  function criteriaTitles() {
    if (typeof globalThis !== 'undefined' && globalThis.RgaaCriteria) return globalThis.RgaaCriteria.RGAA_CRITERIA;
    try {
      return require('./rgaa-criteria.js').RGAA_CRITERIA;
    } catch {
      return {};
    }
  }

  function compareIds(a, b) {
    const [ta, ca] = String(a).split('.').map(Number);
    const [tb, cb] = String(b).split('.').map(Number);
    return ta - tb || ca - cb;
  }

  function pagePathOf(url) {
    try {
      const u = new URL(url);
      return u.pathname + u.search;
    } catch {
      return String(url || '');
    }
  }

  function renderTemplateIssues(report) {
    const issues = Array.isArray(report.templateIssues) ? report.templateIssues : [];
    if (!issues.length) return '';
    const total = Array.isArray(report.pages) ? report.pages.length : 0;
    const rows = issues.slice(0, 15).map((i) => `<li><strong>${esc(i.id)}</strong> — ${esc(i.message)} <span class="meta">(${i.pageCount}${total ? `/${total}` : ''} pages)</span></li>`).join('');
    return `
      <h2 style="margin-top:16px;">Défauts de gabarit</h2>
      <div class="box">
        <p style="margin:0 0 8px;color:#44556f;">Ces non-conformités se répètent sur plusieurs pages : elles viennent sans doute d’un élément commun (en-tête, pied de page, composant). Une seule correction les fait disparaître partout.</p>
        <ul>${rows}</ul>
      </div>
    `;
  }

  function renderAllIssues(byCriterion, report) {
    const titles = criteriaTitles();
    const captures = report.captures || {};
    const multiPage = Array.isArray(report.pages) && report.pages.length > 1;
    const ids = [...byCriterion.keys()].filter((id) => byCriterion.get(id).some((i) => i.status === 'NC')).sort(compareIds);
    if (!ids.length) return '';
    const total = ids.reduce((n, id) => n + byCriterion.get(id).filter((i) => i.status === 'NC').length, 0);
    const blocks = ids.map((id) => {
      const items = byCriterion.get(id).filter((i) => i.status === 'NC');
      const list = items.map((item) => {
        const examples = (Array.isArray(item.examples) && item.examples.length ? item.examples : (item.snippet ? [{ selector: item.selector, snippet: item.snippet }] : []))
          .slice(0, 3)
          .map((e) => `<li>${e.selector ? `<code>${esc(e.selector)}</code><br>` : ''}${e.snippet ? `<code class="snippet">${esc(e.snippet)}</code>` : ''}</li>`).join('');
        const capture = item.capture && captures[item.capture]
          ? `<figure class="capture"><img src="${esc(captures[item.capture])}" alt="Capture de l’élément signalé, entouré en magenta${item.selector ? ` (${esc(item.selector)})` : ''}" loading="lazy"><figcaption>Élément entouré en magenta</figcaption></figure>`
          : '';
        return `<li class="issue">
          <p><strong>${esc(item.message)}</strong>${multiPage && item.pageUrl ? ` <span class="meta">— ${esc(pagePathOf(item.pageUrl))}</span>` : ''}</p>
          ${item.remediationHint ? `<p class="meta">Piste : ${esc(item.remediationHint)}</p>` : ''}
          ${examples ? `<ul class="examples">${examples}</ul>` : ''}
          ${capture}
        </li>`;
      }).join('');
      return `<details class="criterion-block"${items.length <= 3 ? ' open' : ''}>
        <summary><strong>${esc(id)}</strong> ${esc(titles[id] || '')} <span class="meta">(${items.length})</span></summary>
        <ul class="issues">${list}</ul>
      </details>`;
    }).join('');
    return `
      <h2 style="margin-top:16px;">Toutes les non-conformités (${total})</h2>
      <div class="box all-issues">${blocks}</div>
    `;
  }

  function renderToCheck(byCriterion) {
    const rows = [];
    for (const [criterion, items] of byCriterion.entries()) {
      if (items.some((i) => i.status === 'NC')) continue;
      items
        .filter((i) => i.status === 'NT' && i.resultType === 'heuristic_warning')
        .forEach((i) => rows.push({ criterion, message: i.message, hint: i.remediationHint }));
    }
    if (!rows.length) return '';
    const list = rows.slice(0, 12).map((r) => `<li><strong>${esc(r.criterion)}</strong> — ${esc(r.message)}${r.hint ? `<br><span class="meta">${esc(r.hint)}</span>` : ''}</li>`).join('');
    return `
      <h2 style="margin-top:16px;">À vérifier par une personne</h2>
      <div class="box">
        <p style="margin:0 0 8px;color:#44556f;">Indices détectés automatiquement mais qui dépendent du contexte : à confirmer avant de les corriger.</p>
        <ul>${list}</ul>
        ${rows.length > 12 ? `<p class="meta">${rows.length - 12} autre(s) point(s) dans le rapport JSON.</p>` : ''}
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
