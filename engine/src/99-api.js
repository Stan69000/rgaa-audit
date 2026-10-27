const api = {
  ENGINE_VERSION,
  THEMES: THEMES.map(({ key, label }) => ({ key, label })),
  runAudit,
  measureContrast,
  computeScore,
  criterionStatus,
  _internals: {
    parseColor, contrastRatio, blend, accessibleName, visibleText, isValidLangCode,
    isValidAutocomplete, nameIncludesVisibleLabel, effectiveBackground, cssPath,
  },
};

root.RgaaRules = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
