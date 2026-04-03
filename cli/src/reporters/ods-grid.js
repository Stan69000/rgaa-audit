'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function assertSafeArchiveEntries(zipPath) {
  const listing = execFileSync('unzip', ['-Z1', zipPath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const entries = String(listing).split(/\r?\n/).map(line => line.trim()).filter(Boolean);

  for (const entry of entries) {
    const normalized = entry.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(Boolean);

    const isAbsolute = normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized);
    const hasParentTraversal = segments.includes('..');

    if (isAbsolute || hasParentTraversal) {
      throw new Error(`Archive ODS invalide: chemin dangereux détecté (${entry})`);
    }
  }
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function aggregateCriterionStatuses(results = []) {
  const byCriterion = new Map();

  for (const item of results) {
    if (!item || !item.id) continue;
    if (!byCriterion.has(item.id)) byCriterion.set(item.id, []);
    byCriterion.get(item.id).push(item);
  }

  const summary = new Map();
  for (const [criterionId, items] of byCriterion.entries()) {
    const statuses = items.map(i => i.status);
    let status = 'NT';
    if (statuses.includes('NC')) status = 'NC';
    else if (statuses.every(s => s === 'NA')) status = 'NA';
    else if (statuses.includes('C')) status = 'C';

    const notes = items
      .filter(i => i.status === 'NC')
      .map(i => i.message)
      .filter(Boolean)
      .slice(0, 2)
      .join(' | ');

    summary.set(criterionId, { status, notes });
  }

  return summary;
}

function replaceTextP(rowXml, textIndex, value) {
  let seen = 0;
  return rowXml.replace(/<text:p>[\s\S]*?<\/text:p>/g, match => {
    seen += 1;
    if (seen !== textIndex) return match;
    return `<text:p>${xmlEscape(value)}</text:p>`;
  });
}

function updateCriteriaRows(sheetXml, criterionMap) {
  return sheetXml.replace(/<table:table-row\b[\s\S]*?<\/table:table-row>/g, row => {
    const criterionMatch = row.match(/table:style-name="ce65"[^>]*office:string-value="([0-9]+\.[0-9]+)"/);
    if (!criterionMatch) return row;

    const criterionId = criterionMatch[1];
    const mapped = criterionMap.get(criterionId);
    if (!mapped) return row;

    let updated = row;

    updated = updated.replace(
      /(table:content-validation-name="val1"[^>]*>\s*<text:p>)([^<]*)(<\/text:p>)/,
      (_, start, _old, end) => `${start}${mapped.status}${end}`,
    );

    updated = updated.replace(
      /(table:content-validation-name="val1"[^>]*)(office:string-value="[^"]*")?/,
      (full, prefix) => {
        const cleaned = full.replace(/\s*office:string-value="[^"]*"/, '');
        return `${cleaned} office:string-value="${xmlEscape(mapped.status)}"`;
      },
    );

    if (mapped.status === 'NC' && mapped.notes) {
      const note = xmlEscape(mapped.notes);
      // Place quick remediation hints in "Modifications à apporter" when the template still has
      // two repeated empty cells for columns 6-7.
      updated = updated.replace(
        /<table:table-cell table:style-name="ce156" table:number-columns-repeated="2"\/>/,
        `<table:table-cell table:style-name="ce156" office:value-type="string" office:string-value="${note}" calcext:value-type="string"><text:p>${note}</text:p></table:table-cell><table:table-cell table:style-name="ce156"/>`,
      );
    }

    return updated;
  });
}

function updatePageHeaderRow(sheetXml, title, url) {
  return sheetXml.replace(
    /(<table:table-row\b[\s\S]*?<table:table-cell[^>]*table:formula="of:=CONCATENATE\(\[Échantillon\.B\d+\];&quot; : &quot;;\[Échantillon\.C\d+\]\)"[\s\S]*?<\/table:table-row>)/,
    row => replaceTextP(row, 1, `${title} : ${url}`),
  );
}

function updateEchantillonSheet(sheetXml, pageEntries, siteLabel) {
  return sheetXml.replace(/<table:table-row\b[\s\S]*?<\/table:table-row>/g, row => {
    if (/<text:p>Site[^<]*:<\/text:p>/.test(row)) {
      return replaceTextP(row, 2, siteLabel);
    }

    const pageMatch = row.match(/<text:p>(P\d{2})<\/text:p>/);
    if (!pageMatch) return row;
    const pageCode = pageMatch[1];
    const entry = pageEntries.find(p => p.pageCode === pageCode);
    if (!entry) return row;
    let r = replaceTextP(row, 2, entry.title || pageCode);
    r = replaceTextP(r, 3, entry.url || '');
    return r;
  });
}

function fillRgaaGridFromReports({
  reports,
  templatePath,
  outputPath,
  replicateToAllSheets = false,
}) {
  if (!Array.isArray(reports) || reports.length === 0) {
    throw new Error('Aucun rapport fourni.');
  }
  if (!templatePath || !outputPath) {
    throw new Error('Paramètres manquants: templatePath et outputPath sont requis.');
  }
  const resolvedTemplatePath = path.resolve(templatePath);
  const resolvedOutputPath = path.resolve(outputPath);

  const normalized = reports.map((report, idx) => {
    if (!report || !Array.isArray(report.results)) {
      throw new Error(`Rapport invalide à l'index ${idx}: tableau "results" manquant.`);
    }
    return {
      pageCode: `P${String(idx + 1).padStart(2, '0')}`,
      title: report.title || `Page ${idx + 1}`,
      url: report.url || '',
      criterionMap: aggregateCriterionStatuses(report.results),
    };
  });

  const pageEntries = Array.from({ length: 20 }, (_, i) => ({
    pageCode: `P${String(i + 1).padStart(2, '0')}`,
    title: 'Non audité',
    url: '',
    criterionMap: null,
  }));

  if (replicateToAllSheets && normalized[0]) {
    for (const entry of pageEntries) {
      entry.title = normalized[0].title;
      entry.url = normalized[0].url;
      entry.criterionMap = normalized[0].criterionMap;
    }
  } else {
    normalized.forEach((entry, idx) => {
      if (!pageEntries[idx]) return;
      pageEntries[idx].title = entry.title;
      pageEntries[idx].url = entry.url;
      pageEntries[idx].criterionMap = entry.criterionMap;
    });
  }

  const siteLabel = normalized[0].url || normalized[0].title || 'Site audité';
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rgaa-grid-'));

  try {
    assertSafeArchiveEntries(resolvedTemplatePath);
    execFileSync('unzip', ['-q', resolvedTemplatePath, '-d', tempDir], { stdio: 'pipe' });

    const contentXmlPath = path.join(tempDir, 'content.xml');
    const xml = fs.readFileSync(contentXmlPath, 'utf8');

    let updatedXml = xml;

    const echantillonRegex = /<table:table table:name="Échantillon"[\s\S]*?<\/table:table>/;
    const echantillonMatch = updatedXml.match(echantillonRegex);
    if (echantillonMatch) {
      const updatedEchantillon = updateEchantillonSheet(echantillonMatch[0], pageEntries, siteLabel);
      updatedXml = updatedXml.replace(echantillonRegex, updatedEchantillon);
    }

    for (const entry of pageEntries) {
      const sheetRegex = new RegExp(`<table:table table:name="${entry.pageCode}"[\\s\\S]*?<\\/table:table>`);
      const sheetMatch = updatedXml.match(sheetRegex);
      if (!sheetMatch) continue;
      let sheet = sheetMatch[0];
      sheet = updatePageHeaderRow(sheet, entry.title, entry.url);
      if (entry.criterionMap) {
        sheet = updateCriteriaRows(sheet, entry.criterionMap);
      }
      updatedXml = updatedXml.replace(sheetRegex, sheet);
    }

    fs.writeFileSync(contentXmlPath, updatedXml, 'utf8');

    if (fs.existsSync(resolvedOutputPath)) fs.unlinkSync(resolvedOutputPath);

    execFileSync('zip', ['-X', '-0', resolvedOutputPath, 'mimetype'], { cwd: tempDir, stdio: 'pipe' });
    execFileSync('zip', ['-X', '-r', resolvedOutputPath, '.', '-x', 'mimetype'], { cwd: tempDir, stdio: 'pipe' });

    return {
      outputPath: resolvedOutputPath,
      filledSheets: pageEntries.filter(p => p.criterionMap).length,
      filledCriteria: pageEntries.reduce((acc, p) => acc + (p.criterionMap ? p.criterionMap.size : 0), 0),
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = {
  fillRgaaGridFromReports,
  // Exposed for tests
  _aggregateCriterionStatuses: aggregateCriterionStatuses,
  _updateCriteriaRows: updateCriteriaRows,
};
