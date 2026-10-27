// ─────────────────────────────────────────────
// Lancement
// ─────────────────────────────────────────────

const THEMES = [
  { key: 'images', label: 'Images', run: auditImages },
  { key: 'frames', label: 'Cadres', run: auditFrames },
  { key: 'colors', label: 'Couleurs', run: auditColors },
  { key: 'media', label: 'Multimédia', run: auditMedia },
  { key: 'tables', label: 'Tableaux', run: auditTables },
  { key: 'links', label: 'Liens', run: auditLinks },
  { key: 'aria', label: 'Scripts', run: auditAria },
  { key: 'mandatory', label: 'Éléments obligatoires', run: auditMandatory },
  { key: 'structure', label: 'Structuration', run: auditStructure },
  { key: 'presentation', label: 'Présentation', run: auditPresentation },
  { key: 'forms', label: 'Formulaires', run: auditForms },
  { key: 'navigation', label: 'Navigation', run: auditNavigation },
  { key: 'consultation', label: 'Consultation', run: auditConsultation },
];

/**
 * Lance l'audit DOM de la page courante.
 * options.themes        : sous-ensemble de clés de THEMES (défaut : tous)
 * options.colorScheme   : 'light' | 'dark', ajouté aux messages de contraste
 * options.contextLabel  : libellé de contexte libre (ex. « thème alternatif »)
 * options.contrastOnly  : ne mesure que le contraste du texte (passes de thème)
 * options.skipManual    : n'émet pas les rappels de vérification couverts par la simulation CLI
 */
/** Contexte de mesure affiché dans les messages : thème sombre, thème alternatif… */
function contextLabel(options) {
  if (options.contextLabel) return options.contextLabel;
  if (options.colorScheme === 'dark') return 'thème sombre';
  if (options.colorScheme === 'light') return 'thème clair';
  return null;
}

function runAudit(options = {}) {
  const startedAt = Date.now();
  const out = createCollector(contextLabel(options));
  const internalErrors = [];
  const selected = options.themes ? new Set(options.themes) : null;

  THEMES.forEach((theme) => {
    if (selected && !selected.has(theme.key)) return;
    try {
      theme.run(out, options);
    } catch (error) {
      internalErrors.push({ section: theme.key, message: error && error.message ? error.message : String(error) });
    }
  });

  const results = out.results();
  return {
    engineVersion: ENGINE_VERSION,
    url: location.href,
    title: document.title,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    results,
    score: computeScore(results),
    internalErrors,
  };
}
