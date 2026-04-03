#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { fillRgaaGridFromReports } = require('../src/reporters/ods-grid');

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    report:   { type: 'string', short: 'r', multiple: true },
    template: { type: 'string', short: 't' },
    output:   { type: 'string', short: 'o' },
    'replicate-to-all-sheets': { type: 'boolean', default: false },
    help:     { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help || !values.report?.length || !values.template || !values.output) {
  console.log(`
Usage:
  rgaa-fill-grid --report <audit1.json> [--report <audit2.json> ...] --template <modele.ods> --output <sortie.ods> [--replicate-to-all-sheets]

Options:
  -r, --report    JSON produit par rgaa-audit (répéter l'option pour P01..Pn)
  -t, --template  Grille ODS RGAA (modèle officiel)
  -o, --output    ODS de sortie pré-rempli
      --replicate-to-all-sheets  Applique le premier rapport à P01..P20
  -h, --help      Aide
`);
  process.exit(0);
}

try {
  const templatePath = path.resolve(values.template);
  const outputPath = path.resolve(values.output);
  const reportPaths = values.report.map(p => path.resolve(p));
  const reports = [];

  for (const reportPath of reportPaths) {
    const parsed = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    if (Array.isArray(parsed)) {
      reports.push(...parsed);
      continue;
    }
    if (Array.isArray(parsed.pages)) {
      reports.push(...parsed.pages);
      continue;
    }
    if (Array.isArray(parsed.reports)) {
      reports.push(...parsed.reports);
      continue;
    }
    reports.push(parsed);
  }

  const result = fillRgaaGridFromReports({
    reports,
    templatePath,
    outputPath,
    replicateToAllSheets: values['replicate-to-all-sheets'],
  });

  console.log(`Grille générée: ${result.outputPath}`);
  console.log(`Onglets remplis: ${result.filledSheets}`);
  console.log(`Critères consolidés depuis le rapport: ${result.filledCriteria}`);
} catch (err) {
  console.error(`Erreur: ${err.message}`);
  process.exit(1);
}
