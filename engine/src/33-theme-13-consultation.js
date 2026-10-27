// ─────────────────────────────────────────────
// Thème 13 — Consultation
// ─────────────────────────────────────────────

function auditConsultation(out) {
  document.querySelectorAll('meta[http-equiv="refresh" i]').forEach((meta) => {
    const content = normalizedText(meta.getAttribute('content'));
    const match = content.match(/^(\d+)\s*(?:[;,]\s*(?:url\s*=\s*)?(.+))?$/i);
    if (!match) return;
    const delay = parseInt(match[1], 10);
    const url = match[2];
    if (url && delay > 0) {
      out.error({
        id: '13.1', rule: 'meta-redirect-delay', element: meta,
        message: `Redirection automatique différée de ${delay} s (meta refresh).`,
        rationale: 'Test 13.1.2 : une redirection par <meta> doit être immédiate.',
        remediationHint: 'Faire une redirection serveur (301/302), ou une redirection immédiate (délai 0).',
      });
    } else if (!url && delay < 72000) {
      out.error({
        id: '13.1', rule: 'meta-refresh', element: meta,
        message: `Rafraîchissement automatique de la page toutes les ${delay} s.`,
        remediationHint: 'Supprimer le rafraîchissement automatique ou permettre à l’utilisateur de l’arrêter.',
      });
    }
  });

  const docs = [...document.querySelectorAll('a[href]')].filter((a) => OFFICE_DOC_RE.test(a.getAttribute('href')));
  if (docs.length) {
    out.manual({
      id: '13.3', rule: 'office-documents', element: docs[0],
      message: `${docs.length} document(s) bureautique(s) en téléchargement : vérifier qu’une version accessible existe.`,
    });
    const unannounced = docs.filter((a) => !/\b(pdf|docx?|xlsx?|pptx?|od[tsp]|rtf|epub)\b|\d\s?(ko|mo|go|kb|mb|octets)\b/i.test(accessibleName(a)));
    unannounced.forEach((a) => out.warn({
      id: '13.3', rule: 'office-document-format', element: a,
      message: 'Lien vers un document sans mention du format ni du poids.',
      group: 'office-document-format',
      confidence: 'low',
      remediationHint: 'Indiquer le format et le poids dans l’intitulé (ex. « Rapport (PDF, 2 Mo) »).',
    }));
  }

  document.querySelectorAll('marquee, blink').forEach((el) => out.error({
    id: '13.8', rule: 'marquee-blink', element: el,
    message: `Contenu en mouvement <${el.localName}> non contrôlable.`,
    remediationHint: 'Supprimer la balise ; fournir un contenu fixe ou un bouton pause.',
  }));

  let infinite = 0;
  for (const el of document.querySelectorAll('body *')) {
    const s = style(el);
    if (s.animationName && s.animationName !== 'none' && s.animationIterationCount === 'infinite' && isRendered(el)) {
      const rect = el.getBoundingClientRect();
      if (rect.width * rect.height > 400) infinite++;
    }
    if (infinite > 50) break;
  }
  if (infinite) {
    let reducedMotion = false;
    for (const sheet of document.styleSheets) {
      try {
        const visit = (rules) => {
          for (const rule of rules) {
            if (rule.media && /prefers-reduced-motion/.test(rule.media.mediaText)) reducedMotion = true;
            if (rule.cssRules) visit(rule.cssRules);
          }
        };
        visit(sheet.cssRules);
      } catch { /* feuille cross-origin */ }
    }
    out.warn({
      id: '13.8', rule: 'infinite-animation',
      message: `${infinite} animation(s) CSS en boucle infinie${reducedMotion ? ' (une règle prefers-reduced-motion existe)' : ', sans règle prefers-reduced-motion'}.`,
      confidence: reducedMotion ? 'low' : 'medium',
      remediationHint: 'Tout mouvement de plus de 5 secondes doit pouvoir être arrêté (bouton pause, prefers-reduced-motion).',
    });
  }
}
