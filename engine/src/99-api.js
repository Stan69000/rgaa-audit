const api = {
  ENGINE_VERSION,
  THEMES: THEMES.map(({ key, label }) => ({ key, label })),
  runAudit,
  measureContrast,
  computeScore,
  criterionStatus,
  // Utilitaires réutilisés par les aides visuelles du guide manuel (shared/rgaa-guide-page.js).
  dom: {
    accessibleName, visibleText, cssPath, isRendered, isHiddenFromAT, isVisuallyHidden,
    isKeyboardFocusable, explicitRole, roleOf, normalizedText,
  },
  _internals: {
    parseColor, contrastRatio, blend, accessibleName, visibleText, isValidLangCode,
    isValidAutocomplete, nameIncludesVisibleLabel, effectiveBackground, cssPath,
  },
};

root.RgaaRules = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
