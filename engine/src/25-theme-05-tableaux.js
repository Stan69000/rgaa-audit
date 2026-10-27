// ─────────────────────────────────────────────
// Thème 5 — Tableaux
// ─────────────────────────────────────────────

function auditTables(out) {
  const tables = [...document.querySelectorAll('table, [role="table"], [role="grid"], [role="treegrid"]')]
    .filter((t) => isRendered(t) && !isHiddenFromAT(t));
  if (!tables.length) {
    out.na({ id: '5.6', rule: 'table-none', message: 'Aucun tableau.' });
    return;
  }

  tables.forEach((table) => {
    const role = explicitRole(table);
    const isNative = table.localName === 'table';
    if (!isNative) return;
    const rows = [...table.rows];
    const cols = Math.max(0, ...rows.map((r) => [...r.cells].reduce((n, c) => n + (c.colSpan || 1), 0)));
    const ths = [...table.querySelectorAll('th')].filter((th) => th.closest('table') === table);
    const dataMarkers = table.querySelector(':scope > caption, :scope > thead, th, [scope], [headers]') || table.hasAttribute('summary');

    if (role === 'presentation' || role === 'none') {
      if (dataMarkers) {
        out.error({
          id: '5.8', rule: 'layout-table-data-markup', element: table,
          message: 'Tableau de mise en forme utilisant des éléments de tableau de données (th, caption, thead, scope…).',
          remediationHint: 'Retirer ces éléments, ou retirer role="presentation" s’il s’agit d’un tableau de données.',
        });
      } else {
        out.manual({
          id: '5.3', rule: 'layout-table-linearization', element: table,
          message: 'Tableau de mise en forme : vérifier que le contenu linéarisé reste compréhensible.',
          group: 'layout-table-linearization',
        });
      }
      return;
    }

    if (!ths.length && !table.querySelector('[role="columnheader"], [role="rowheader"]')) {
      if (rows.length >= 2 && cols >= 2) {
        out.warn({
          id: '5.6', rule: 'table-no-headers', element: table,
          message: 'Tableau sans en-tête déclaré.',
          group: 'table-no-headers',
          rationale: 'Tableau de données : les en-têtes doivent être des <th>. Tableau de mise en page : role="presentation".',
          remediationHint: 'Déclarer les en-têtes en <th scope="col|row">, ou ajouter role="presentation".',
        });
      }
      return;
    }

    ths.forEach((th) => {
      const scope = normalizedText(th.getAttribute('scope')).toLowerCase();
      const thRole = explicitRole(th);
      if (!scope && !th.id && thRole !== 'columnheader' && thRole !== 'rowheader') {
        out.error({
          id: '5.7', rule: 'th-association', element: th,
          message: 'En-tête <th> sans attribut scope, id ou role.',
          group: 'th-association',
          rationale: 'Le test 5.7.1 exige scope, id ou role sur chaque en-tête.',
          remediationHint: 'Ajouter scope="col" (en-tête de colonne) ou scope="row" (en-tête de ligne).',
        });
      } else if (scope && !['row', 'col', 'rowgroup', 'colgroup'].includes(scope)) {
        out.error({
          id: '5.7', rule: 'th-scope-invalid', element: th,
          message: `Valeur de scope invalide : « ${scope} ».`,
          remediationHint: 'Utiliser scope="col" ou scope="row".',
        });
      }
    });

    table.querySelectorAll('[headers]').forEach((cell) => {
      const missing = idRefs(cell, 'headers').filter((id) => !getById(id));
      if (missing.length) {
        out.error({
          id: '5.7', rule: 'headers-missing-ids', element: cell,
          message: `Attribut headers référençant des id absents : ${missing.join(', ')}.`,
          group: 'headers-missing-ids',
          remediationHint: 'Faire correspondre headers aux id des cellules d’en-tête.',
        });
      }
    });

    const headerRows = rows.filter((r) => [...r.cells].every((c) => c.localName === 'th')).length;
    const hasRowHeaders = rows.some((r) => r.cells[0] && r.cells[0].localName === 'th' && [...r.cells].some((c) => c.localName === 'td'));
    const complex = headerRows > 1 || (headerRows >= 1 && hasRowHeaders && table.querySelector('th[colspan], th[rowspan]'));
    if (complex) {
      const caption = table.querySelector(':scope > caption');
      const describedBy = idRefs(table, 'aria-describedby').some((id) => getById(id));
      if (!describedBy && !(caption && caption.querySelector('*'))) {
        out.warn({
          id: '5.1', rule: 'complex-table-summary', element: table,
          message: 'Tableau complexe sans résumé détecté.',
          remediationHint: 'Ajouter un résumé (aria-describedby ou dans la caption) qui explique la structure.',
        });
      }
    }

    const name = accessibleName(table);
    if (name) {
      out.manual({
        id: '5.5', rule: 'table-title-relevance', element: table,
        message: `Titre de tableau « ${name.slice(0, 60)} » : pertinence à vérifier.`,
        group: 'table-title-relevance',
      });
    }
    out.pass({
      id: '5.6', rule: 'table-headers-ok', element: table,
      message: 'Tableau de données avec en-têtes déclarés.',
      group: 'table-headers-ok',
      manualReviewRecommended: true,
      confidence: 'medium',
    });
  });
}
