// Régénère docs/RGAA-mapping.md et le détail par thème de docs/criteres.html
// à partir de scripts/coverage.js et du référentiel officiel (extension/shared/rgaa-criteria.js).
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { COVERAGE } = require('./coverage');
const { RGAA_CRITERIA, RGAA_TOPICS, RGAA_VERSION } = require('../../extension/shared/rgaa-criteria.js');

const ROOT = path.join(__dirname, '..', '..');
const LEVELS = {
  auto: { icon: '✅', label: 'Automatisé' },
  partial: { icon: '⚠️', label: 'Partiel' },
  manual: { icon: '❌', label: 'Manuel' },
};
const WHERE = { dom: 'CLI + extension', cli: 'CLI (simulation)', both: 'CLI + extension (+ simulation CLI)' };

function summarize(ids) {
  const counts = { auto: 0, partial: 0, manual: 0 };
  ids.forEach((id) => { counts[COVERAGE[id].level]++; });
  return counts;
}

function pct(n, total) {
  return `${((n / total) * 100).toFixed(1)} %`;
}

function buildMarkdown() {
  const ids = Object.keys(RGAA_CRITERIA);
  const total = ids.length;
  const counts = summarize(ids);
  const lines = [
    `# RGAA ${RGAA_VERSION} — couverture de l’outil, critère par critère`,
    '',
    '> ⚠️ Projet associatif vibe codé — Cet outil est développé bénévolement par Le Singe Du Numérique dans une démarche d\'ouverture de l\'accessibilité au plus grand nombre. Il s\'agit d\'un pré-audit automatique, non certifié, basé sur le RGAA 4.1.2. Les résultats peuvent comporter des erreurs et ne remplacent pas un audit réalisé par un professionnel certifié, ni un accompagnement spécialisé. Utilisez-le comme point de départ, pas comme conclusion.',
    '',
    '_Fichier généré par `npm run docs:coverage` (dossier `cli/`) à partir de `cli/scripts/coverage.js`. Ne pas modifier à la main : un test vérifie que ce tableau correspond au code._',
    '',
    'Légende :',
    '- ✅ **Automatisé** : l’outil détecte de façon fiable des non-conformités sur ce critère. Une partie du critère peut rester à vérifier à la main.',
    '- ⚠️ **Partiel** : l’outil remonte des indices « à vérifier » ou ne contrôle qu’une petite partie du critère.',
    '- ❌ **Manuel** : jugement humain nécessaire (sens, pertinence, usage réel).',
    '',
    'Les règles s’exécutent dans un moteur unique (`extension/shared/rgaa-rules.js`) partagé par la CLI et l’extension. La colonne « Où » précise les contrôles qui demandent la simulation Playwright de la CLI (clavier, zoom, 320 px…).',
    '',
    '## Synthèse',
    '',
    '| Niveau | Critères | Part |',
    '|---|---|---|',
    `| ✅ Automatisé | ${counts.auto} | ${pct(counts.auto, total)} |`,
    `| ⚠️ Partiel | ${counts.partial} | ${pct(counts.partial, total)} |`,
    `| ❌ Manuel | ${counts.manual} | ${pct(counts.manual, total)} |`,
    `| **Total** | **${total}** | |`,
    '',
  ];
  for (const [topic, title] of Object.entries(RGAA_TOPICS)) {
    lines.push(`## Thème ${topic} — ${title}`, '', '| Critère | Intitulé | Couverture | Où | Ce qui est contrôlé |', '|---|---|---|---|---|');
    ids.filter((id) => id.split('.')[0] === topic).forEach((id) => {
      const c = COVERAGE[id];
      const level = LEVELS[c.level];
      lines.push(`| ${id} | ${RGAA_CRITERIA[id].replace(/\|/g, '\\|')} | ${level.icon} ${level.label} | ${c.where ? WHERE[c.where] : '—'} | ${c.note || '—'} |`);
    });
    lines.push('');
  }
  return { markdown: lines.join('\n'), counts, total };
}

const THEME_BLURBS = {
  1: 'Les images ont-elles une alternative lisible et utile ?',
  2: 'Les cadres (iframe) sont-ils identifiables ?',
  3: 'Le texte est-il assez contrasté, l’information pas uniquement portée par la couleur ?',
  4: 'Vidéos et sons : sous-titres, transcription, audiodescription, contrôle de la lecture.',
  5: 'Les tableaux de données sont-ils correctement structurés ?',
  6: 'Les liens ont-ils un intitulé compréhensible ?',
  7: 'Les composants interactifs sont-ils utilisables au clavier et au lecteur d’écran ?',
  8: 'Langue, titre, validité du code : les bases du document.',
  9: 'Titres, zones, listes : la page est-elle structurée ?',
  10: 'Focus visible, zoom, affichage mobile, contenus masqués.',
  11: 'Étiquettes, regroupements, erreurs et aide à la saisie.',
  12: 'Liens d’évitement, ordre de tabulation, pièges clavier.',
  13: 'Rafraîchissements, documents, animations et mouvements.',
};

function buildCriteresCards() {
  const ids = Object.keys(RGAA_CRITERIA);
  return Object.entries(RGAA_TOPICS).map(([topic, title]) => {
    const own = ids.filter((id) => id.split('.')[0] === topic);
    const counts = summarize(own);
    const badge = counts.auto ? 'auto' : counts.partial ? 'partiel' : 'manuel';
    const parts = [
      counts.auto && `${counts.auto} auto`,
      counts.partial && `${counts.partial} partiel${counts.partial > 1 ? 's' : ''}`,
      counts.manual && `${counts.manual} manuel${counts.manual > 1 ? 's' : ''}`,
    ].filter(Boolean).join(' / ');
    const checked = own.filter((id) => COVERAGE[id].level !== 'manual')
      .map((id) => `<li>${id} — ${COVERAGE[id].note}</li>`).join('');
    return `      <article class="card">
        <div class="card-head"><h2>${topic}. ${title}</h2><span class="badge ${badge}">${parts}</span></div>
        <p class="meta">${own.length} critère${own.length > 1 ? 's' : ''}</p>
        <p>${THEME_BLURBS[topic]}</p>
        ${checked ? `<ul>${checked}</ul>` : '<ul><li>Vérification humaine uniquement.</li></ul>'}
      </article>`;
  }).join('\n');
}

function replaceBetween(file, start, end, content) {
  const source = fs.readFileSync(file, 'utf8');
  const a = source.indexOf(start);
  const b = source.indexOf(end);
  if (a === -1 || b === -1 || b < a) throw new Error(`Marqueurs ${start} / ${end} introuvables dans ${file}`);
  fs.writeFileSync(file, `${source.slice(0, a + start.length)}\n${content}\n${source.slice(b)}`);
}

if (require.main === module) {
  const { markdown, counts, total } = buildMarkdown();
  fs.writeFileSync(path.join(ROOT, 'docs', 'RGAA-mapping.md'), `${markdown}\n`);
  const criteres = path.join(ROOT, 'docs', 'criteres.html');
  replaceBetween(criteres, '<!-- couverture:themes:debut -->', '<!-- couverture:themes:fin -->', buildCriteresCards());
  replaceBetween(criteres, '<!-- couverture:resume:debut -->', '<!-- couverture:resume:fin -->',
    `      <p><strong>État de couverture actuel (RGAA ${RGAA_VERSION}) :</strong> ${counts.auto} critères automatisés (${pct(counts.auto, total)}), ${counts.partial} partiels (${pct(counts.partial, total)}), ${counts.manual} manuels (${pct(counts.manual, total)}).</p>`);
  console.log(`docs/RGAA-mapping.md et docs/criteres.html régénérés — auto ${counts.auto}, partiel ${counts.partial}, manuel ${counts.manual} / ${total}`);
}

module.exports = { buildMarkdown, summarize };
