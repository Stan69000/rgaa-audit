// ─────────────────────────────────────────────
// Score
// ─────────────────────────────────────────────

/**
 * Statut par critère : NC si au moins une non-conformité, sinon NT si un point reste à
 * vérifier, sinon C si au moins un signal conforme, sinon NA. Le taux ne compte que les
 * critères tranchés (C et NC) : un signal heuristique ne fait jamais baisser le score.
 */
function criterionStatus(statuses) {
  if (statuses.includes('NC')) return 'NC';
  if (statuses.includes('NT') || statuses.includes('AV')) return 'NT';
  if (statuses.includes('C')) return 'C';
  return 'NA';
}

function computeScore(results) {
  const byCriterion = new Map();
  (results || []).forEach((r) => {
    if (!r || !r.id) return;
    if (!byCriterion.has(r.id)) byCriterion.set(r.id, []);
    byCriterion.get(r.id).push(r.status);
  });
  let conformes = 0;
  let nonConformes = 0;
  let aVerifier = 0;
  let na = 0;
  const criteria = {};
  byCriterion.forEach((statuses, id) => {
    const status = criterionStatus(statuses);
    criteria[id] = status;
    if (status === 'NC') nonConformes++;
    else if (status === 'C') conformes++;
    else if (status === 'NT') aVerifier++;
    else na++;
  });
  const decided = conformes + nonConformes;
  return {
    taux: decided > 0 ? Math.round((conformes / decided) * 100) : 0,
    conformes,
    nonConformes,
    aVerifier,
    na,
    total: byCriterion.size,
    criteria,
  };
}
