// ─────────────────────────────────────────────
// Résultats
// ─────────────────────────────────────────────

const KIND_DEFAULTS = {
  probable_error: { status: 'NC', severity: 'high', confidence: 'high', manualReviewRecommended: false },
  heuristic_warning: { status: 'NT', severity: 'medium', confidence: 'medium', manualReviewRecommended: true },
  good_signal: { status: 'C', severity: 'low', confidence: 'high', manualReviewRecommended: false },
  manual_only: { status: 'NT', severity: 'info', confidence: 'low', manualReviewRecommended: true },
  not_applicable: { status: 'NA', severity: 'info', confidence: 'high', manualReviewRecommended: false },
};

const MAX_EXAMPLES = 5;

/**
 * Collecte les constats et regroupe ceux qui portent le même message pour la même règle :
 * un rapport lisible donne « 12 liens sans intitulé » plutôt que 12 lignes identiques.
 */
function createCollector(context) {
  const groups = new Map();
  const order = [];

  function add(kind, payload) {
    const defaults = KIND_DEFAULTS[kind];
    if (!defaults) throw new Error(`Type de résultat inconnu : ${kind}`);
    const {
      id, rule, message, element = null, group = message, snippet, details,
      rationale = '', remediationHint = '', ...overrides
    } = payload;

    const key = `${rule}|${id}|${kind}|${group}`;
    let entry = groups.get(key);
    if (!entry) {
      entry = {
        id,
        rule,
        status: defaults.status,
        resultType: kind,
        severity: defaults.severity,
        confidence: defaults.confidence,
        manualReviewRecommended: defaults.manualReviewRecommended,
        ...overrides,
        message,
        snippet: snippet !== undefined ? snippet : (element ? shortSnippet(element) : null),
        selector: element ? cssPath(element) : null,
        count: 0,
        examples: [],
        rationale,
        remediationHint,
        source: 'dom',
      };
      if (details) entry.details = details;
      if (context) entry.context = context;
      groups.set(key, entry);
      order.push(entry);
    }
    entry.count++;
    if (element && entry.examples.length < MAX_EXAMPLES) {
      entry.examples.push({ selector: cssPath(element), snippet: shortSnippet(element) });
    }
    return entry;
  }

  return {
    error: (p) => add('probable_error', p),
    warn: (p) => add('heuristic_warning', p),
    pass: (p) => add('good_signal', p),
    manual: (p) => add('manual_only', p),
    na: (p) => add('not_applicable', p),
    results: () => order.map((entry) => {
      if (entry.count > 1 && !/^\d+ /.test(entry.message)) {
        return { ...entry, message: `${entry.message} (${entry.count} occurrences)` };
      }
      return entry;
    }),
  };
}
