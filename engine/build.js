#!/usr/bin/env node
// Assemble engine/src/*.js (par ordre de nom) en extension/shared/rgaa-rules.js.
// Les fragments partagent la portée d'une même IIFE : ce ne sont pas des modules, mais
// des sections du moteur rangées par thème. Sans dépendance ni transpilation : le fichier
// produit est exactement celui injecté dans les pages (extension et CLI).
//   node engine/build.js          écrit le fichier
//   node engine/build.js --check  échoue si le fichier versionné n'est pas à jour
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, 'src');
const OUT = path.join(__dirname, '..', 'extension', 'shared', 'rgaa-rules.js');

const HEADER = `/**
 * Moteur de règles RGAA 4.1.2 — partagé par la CLI (Playwright) et l'extension Chrome.
 *
 * FICHIER GÉNÉRÉ par engine/build.js à partir de engine/src/ : ne pas modifier à la main.
 *
 * Le fichier s'exécute dans la page auditée : il n'a aucune dépendance et n'expose
 * que \`globalThis.RgaaRules\`. Il est injecté tel quel (executeScript côté extension,
 * page.evaluate côté CLI) et peut être chargé plusieurs fois sans effet de bord.
 *
 * Statuts produits :
 *   NC  non-conformité probable (signal fiable)
 *   NT  à vérifier : signal heuristique ou contrôle manuel requis
 *   C   conforme sur l'échantillon testé
 *   NA  non applicable (aucun élément concerné)
 */

'use strict';

(function (root) {`;

const FOOTER = '})(typeof globalThis !== \'undefined\' ? globalThis : this);\n';

function indent(source) {
  return source.split('\n').map((line) => (line ? `  ${line}` : line)).join('\n');
}

function build() {
  const parts = fs.readdirSync(SRC)
    .filter((f) => f.endsWith('.js'))
    .sort()
    .map((f) => indent(fs.readFileSync(path.join(SRC, f), 'utf8').replace(/\n+$/, '')));
  return `${HEADER}\n${parts.join('\n\n')}\n${FOOTER}`;
}

if (require.main === module) {
  const output = build();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (current !== output) {
      console.error('extension/shared/rgaa-rules.js n’est pas à jour : lancer « node engine/build.js ».');
      process.exit(1);
    }
    console.log('extension/shared/rgaa-rules.js est à jour.');
  } else {
    fs.writeFileSync(OUT, output);
    console.log(`extension/shared/rgaa-rules.js assemblé (${fs.readdirSync(SRC).length} fragments).`);
  }
}

module.exports = { build, OUT };
