#!/usr/bin/env node
/**
 * RGAA Audit CLI — Point d'entrée
 * Usage: node bin/rgaa-audit.js <url> [options]
 */

'use strict';

const { parseArgs } = require('node:util');
const { runAudit } = require('../src/audit');

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    output:   { type: 'string',  short: 'o', default: 'json' },   // json | html | csv | vulgarized
    save:     { type: 'string',  short: 's', default: '' },        // chemin fichier
    'vulgarized-save': { type: 'string', default: '' },            // rapport vulgarisé html
    'ods-template': { type: 'string', default: '' },               // modèle ODS RGAA
    'ods-save': { type: 'string', default: '' },                   // sortie ODS pré-remplie
    'ods-replicate-all-sheets': { type: 'boolean', default: false },
    simulate: { type: 'boolean', short: 'S', default: true },      // simulation clavier
    depth:    { type: 'string',  short: 'd', default: '1' },       // nb pages à crawler
    headless: { type: 'boolean', short: 'H', default: true },      // headless ou visible
    help:     { type: 'boolean', short: 'h', default: false },
  },
  allowPositionals: true,
});

if (values.help || !positionals.length) {
  console.log(`
  ♿  RGAA Audit CLI — v0.1.0

  Usage:
    rgaa-audit <url> [options]

  Options:
    -o, --output   Format de sortie : json (défaut) | html | csv | vulgarized
    -s, --save     Chemin du fichier de sortie
        --vulgarized-save  Génère un rapport vulgarisé HTML (non-technique)
        --ods-template      Modèle ODS RGAA (pour export grille)
        --ods-save          Chemin du fichier ODS de sortie pré-rempli
        --ods-replicate-all-sheets  Réplique le 1er rapport sur P01..P20
    -S, --simulate Simuler les actions humaines (défaut: true)
    -d, --depth    Nombre de pages à auditer (défaut: 1)
    -H, --headless Mode headless (défaut: true)
    -h, --help     Afficher cette aide

  Exemples:
    node bin/rgaa-audit.js https://mon-site.fr
    node bin/rgaa-audit.js https://mon-site.fr -o html -s rapport.html
    node bin/rgaa-audit.js https://mon-site.fr -o json -s rapport.json --vulgarized-save rapport-vulgarise.html
    node bin/rgaa-audit.js https://mon-site.fr -d 8 --ods-template ./grille.ods --ods-save ./grille-remplie.ods --vulgarized-save ./rapport-vulgarise.html
  `);
  process.exit(0);
}

const url = positionals[0];
const opts = {
  output:   values.output,
  save:     values.save,
  vulgarizedSave: values['vulgarized-save'],
  odsTemplate: values['ods-template'],
  odsSave: values['ods-save'],
  odsReplicateAllSheets: values['ods-replicate-all-sheets'],
  simulate: values.simulate,
  depth:    parseInt(values.depth),
  headless: values.headless,
};

(async () => {
  try {
    await runAudit(url, opts);
  } catch (e) {
    console.error('\n❌ Erreur fatale :', e.message);
    process.exit(1);
  }
})();
