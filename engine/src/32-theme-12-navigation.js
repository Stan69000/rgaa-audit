// ─────────────────────────────────────────────
// Thème 12 — Navigation
// ─────────────────────────────────────────────

const SKIP_LINK_RE = /aller au|acc[eè]s|contenu|skip|main content|passer|[ée]viter|navigation/;

function auditNavigation(out) {
  const focusables = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
    .filter((el) => isKeyboardFocusable(el));
  const firstLinks = focusables.slice(0, 8).filter((el) => el.matches('a[href^="#"]'));
  const skip = firstLinks.find((a) => SKIP_LINK_RE.test(comparableText(accessibleName(a))))
    || [...document.querySelectorAll('a[href^="#"]')].find((a) => SKIP_LINK_RE.test(comparableText(accessibleName(a)))
      && /contenu|content|main/.test(comparableText(accessibleName(a))));

  if (!skip) {
    out.warn({
      id: '12.7', rule: 'skip-link-missing',
      message: 'Aucun lien d’évitement ou d’accès rapide au contenu principal détecté.',
      confidence: 'medium',
      remediationHint: 'Ajouter en tout début de page un lien « Aller au contenu » visible au focus.',
    });
  } else {
    let target = skip.getAttribute('href').slice(1);
    try { target = decodeURIComponent(target); } catch { /* fragment non encodé */ }
    const exists = target && (getById(target) || document.querySelector(`[name="${cssEscape(target)}"]`));
    if (!exists) {
      out.error({
        id: '12.7', rule: 'skip-link-target', element: skip,
        message: `Lien d’évitement pointant vers une cible absente (#${target}).`,
        remediationHint: 'Donner à la zone de contenu principal l’id référencé par le lien.',
      });
    } else {
      out.pass({
        id: '12.7', rule: 'skip-link-ok', element: skip,
        message: `Lien d’évitement « ${accessibleName(skip).slice(0, 50)} » vers #${target}.`,
        manualReviewRecommended: true, confidence: 'medium',
        remediationHint: 'Vérifier qu’il est visible à la prise de focus et toujours au même endroit.',
      });
      if (!firstLinks.includes(skip)) {
        out.warn({
          id: '12.7', rule: 'skip-link-position', element: skip,
          message: 'Lien d’évitement présent mais pas parmi les premiers éléments atteints au clavier.',
          confidence: 'medium',
          remediationHint: 'Placer le lien d’évitement en premier élément focusable de la page.',
        });
      }
    }
  }

  const positive = [...document.querySelectorAll('[tabindex]')].filter((el) => parseInt(el.getAttribute('tabindex'), 10) > 0);
  if (positive.length) {
    positive.forEach((el) => out.error({
      id: '12.8', rule: 'tabindex-positive', element: el,
      message: `tabindex="${el.getAttribute('tabindex')}" positif.`,
      group: 'tabindex-positive',
      confidence: 'medium',
      rationale: 'Un tabindex positif impose un ordre de tabulation qui diverge presque toujours de l’ordre visuel.',
      remediationHint: 'Remplacer par tabindex="0" et ordonner le code source.',
    }));
  } else {
    out.pass({ id: '12.8', rule: 'tabindex-positive-ok', message: 'Aucun tabindex positif.', manualReviewRecommended: true, confidence: 'medium',
      remediationHint: 'Vérifier au clavier que l’ordre de tabulation suit l’ordre de lecture.' });
  }

  const accesskeys = [...document.querySelectorAll('[accesskey]')];
  if (accesskeys.length) {
    out.manual({ id: '12.10', rule: 'accesskey', element: accesskeys[0], message: `${accesskeys.length} raccourci(s) accesskey : vérifier qu’ils n’entrent pas en conflit.` });
  }
}
