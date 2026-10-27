#!/usr/bin/env node
/**
 * RGAA Audit CLI — Point d'entrée
 * Usage: node bin/rgaa-audit.js <url> [options]
 */

'use strict';

const { parseArgs } = require('node:util');
const { runAudit } = require('../src/audit');
const { version } = require('../package.json');

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    output:   { type: 'string',  short: 'o', default: 'json' },   // json | html | csv | vulgarized
    save:     { type: 'string',  short: 's', default: '' },        // chemin fichier
    'output-dir': { type: 'string', default: '' },                 // dossier de sortie
    'vulgarized-save': { type: 'string', default: '' },            // rapport vulgarisé html
    'ods-template': { type: 'string', default: '' },               // modèle ODS RGAA
    'ods-save': { type: 'string', default: '' },                   // sortie ODS pré-remplie
    'ods-replicate-all-sheets': { type: 'boolean', default: false },
    simulate: { type: 'boolean', short: 'S', default: true },      // simulation clavier
    'no-simulate': { type: 'boolean', default: false },
    'no-captures': { type: 'boolean', default: false },           // pas de captures des NC
    'color-scheme': { type: 'string', default: 'auto' },          // auto | light | both
    dismiss: { type: 'string', default: 'auto' },                 // auto | off | sélecteur CSS
    'theme-click': { type: 'string', default: '' },               // bouton du thème alternatif
    'theme-script': { type: 'string', default: '' },              // JS qui active le thème alternatif
    'validate-html': { type: 'boolean', default: false },         // validation du code généré (8.2)
    baseline: { type: 'string', default: '' },                    // rapport JSON de référence
    'fail-on-new': { type: 'boolean', default: false },           // code de sortie 1 si nouvelles NC
    depth:    { type: 'string',  short: 'd', default: '1' },       // nb pages à crawler
    headless: { type: 'boolean', short: 'H', default: true },      // headless ou visible
    verbose:  { type: 'boolean', short: 'v', default: false },     // logs debug
    debug:    { type: 'boolean', default: false },                 // alias verbose
    'safe-crawl': { type: 'boolean', default: false },             // crawl défensif
    'strict-security': { type: 'boolean', default: false },        // alias safe-crawl
    help:     { type: 'boolean', short: 'h', default: false },
  },
  allowPositionals: true,
});

if (values.help || !positionals.length) {
  console.log(`
  ♿  RGAA Audit CLI — v${version}

  Usage:
    rgaa-audit <url> [options]

  Options:
    -o, --output   Format de sortie : json (défaut) | html | csv | vulgarized
    -s, --save     Chemin du fichier de sortie
        --output-dir       Dossier racine de sortie pour les rapports (optionnel)
        --vulgarized-save  Génère un rapport vulgarisé HTML (non-technique)
        --ods-template      Modèle ODS RGAA (pour export grille)
        --ods-save          Chemin du fichier ODS de sortie pré-rempli
        --ods-replicate-all-sheets  Réplique le 1er rapport sur P01..P20
    -S, --simulate Simuler les actions humaines (défaut: true)
        --no-simulate      Désactive la simulation (audit DOM seul, plus rapide)
        --no-captures      Pas de captures annotées des non-conformités
        --color-scheme     auto (défaut) : mesure aussi les contrastes en thème sombre
                           si la page réagit à prefers-color-scheme ; light : thème clair
                           seul ; both : force la double mesure
        --dismiss          Bandeau cookies : auto (défaut, clique « Refuser »), off,
                           ou sélecteur CSS du bouton à cliquer
        --theme-click      Sélecteur du bouton de thème : mesure aussi les contrastes
                           dans le thème alternatif du site
        --theme-script     Script JS qui active le thème alternatif
                           (ex. "document.documentElement.dataset.theme='light'")
        --validate-html    Valide le code source généré (8.2) avec html-validate,
                           en local (Node.js 22.22+)
        --baseline         Rapport JSON de référence : liste les non-conformités
                           nouvelles et résolues depuis cet audit
        --fail-on-new      Avec --baseline : code de sortie 1 s’il y a de nouvelles
                           non-conformités (utile en CI)
    -d, --depth    Nombre de pages à auditer (défaut: 1)
    -H, --headless Mode headless (défaut: true)
    -v, --verbose  Active les logs debug de crawl/navigateur
        --debug            Alias de --verbose
        --safe-crawl       Crawl défensif (validation/filtrage renforcés)
        --strict-security  Alias de --safe-crawl
    -h, --help     Afficher cette aide

  Exemples:
    node bin/rgaa-audit.js https://mon-site.fr
    node bin/rgaa-audit.js https://mon-site.fr -o html -s rapport.html
    node bin/rgaa-audit.js https://mon-site.fr -o json -s rapport.json --vulgarized-save rapport-vulgarise.html
    node bin/rgaa-audit.js https://mon-site.fr -d 8 --ods-template ./grille.ods --ods-save ./grille-remplie.ods --vulgarized-save ./rapport-vulgarise.html
  `);
  process.exit(0);
}

// Compatibilité : « -S false » était documenté mais parseArgs le lit comme un argument positionnel.
const simulateDisabled = values['no-simulate'] || positionals.slice(1).includes('false');
if (!['auto', 'light', 'both'].includes(values['color-scheme'])) {
  console.error(`\n❌ --color-scheme doit valoir auto, light ou both (reçu : ${values['color-scheme']})`);
  process.exit(1);
}

const url = positionals[0];
const opts = {
  output:   values.output,
  save:     values.save,
  outputDir: values['output-dir'],
  vulgarizedSave: values['vulgarized-save'],
  odsTemplate: values['ods-template'],
  odsSave: values['ods-save'],
  odsReplicateAllSheets: values['ods-replicate-all-sheets'],
  simulate: values.simulate && !simulateDisabled,
  colorScheme: values['color-scheme'],
  dismiss: values.dismiss || 'auto',
  themeClick: values['theme-click'],
  themeScript: values['theme-script'],
  validateHtml: values['validate-html'],
  baseline: values.baseline,
  captures: !values['no-captures'],
  depth:    parseInt(values.depth),
  headless: values.headless,
  verbose: values.verbose,
  debug: values.debug,
  safeCrawl: values['safe-crawl'],
  strictSecurity: values['strict-security'],
};

(async () => {
  try {
    if (values['fail-on-new'] && !values.baseline) {
      console.error('\n❌ --fail-on-new nécessite --baseline <rapport.json>');
      process.exit(1);
    }
    const report = await runAudit(url, opts);
    if (values['fail-on-new'] && report.baseline && report.baseline.newCount > 0) {
      console.error(`\n❌ ${report.baseline.newCount} nouvelle(s) non-conformité(s) par rapport à la référence.`);
      process.exitCode = 1;
    }
  } catch (e) {
    console.error('\n❌ Erreur fatale :', e.message);
    process.exit(1);
  }
})();
