// ─────────────────────────────────────────────
// Thème 10 — Présentation
// ─────────────────────────────────────────────

const PRESENTATION_TAGS = ['basefont', 'big', 'blink', 'center', 'font', 'marquee', 'strike', 'tt'];
const PRESENTATION_ATTRS = ['align', 'alink', 'background', 'bgcolor', 'border', 'cellpadding', 'cellspacing',
  'char', 'charoff', 'clear', 'color', 'compact', 'frameborder', 'hspace', 'link', 'marginheight',
  'marginwidth', 'text', 'valign', 'vlink', 'vspace'];
const SIZE_ATTR_ALLOWED = new Set(['img', 'object', 'embed', 'canvas', 'svg', 'iframe', 'video', 'input', 'source']);
const HTML_NS = 'http://www.w3.org/1999/xhtml';

function auditPresentation(out, options) {
  document.querySelectorAll(PRESENTATION_TAGS.join(',')).forEach((el) => {
    out.error({
      id: '10.1', rule: 'presentation-tag', element: el,
      message: `Balise de présentation <${el.localName}>.`,
      group: `presentation-tag-${el.localName}`,
      remediationHint: 'Remplacer par une balise sémantique mise en forme en CSS.',
    });
  });
  document.querySelectorAll('body *').forEach((el) => {
    if (el.namespaceURI !== HTML_NS) return;
    for (const attr of PRESENTATION_ATTRS) {
      if (!el.hasAttribute(attr)) continue;
      if (attr === 'border' && el.localName === 'table' && el.getAttribute('border') === '1') continue;
      out.error({
        id: '10.1', rule: 'presentation-attr', element: el,
        message: `Attribut de présentation ${attr}="${el.getAttribute(attr)}" sur <${el.localName}>.`,
        group: `presentation-attr-${attr}`,
        remediationHint: 'Déplacer cette mise en forme dans la feuille de styles.',
      });
    }
    for (const attr of ['width', 'height']) {
      if (el.hasAttribute(attr) && !SIZE_ATTR_ALLOWED.has(el.localName)) {
        out.error({
          id: '10.1', rule: 'presentation-attr', element: el,
          message: `Attribut de présentation ${attr} sur <${el.localName}>.`,
          group: `presentation-attr-${attr}`,
          remediationHint: 'Définir les dimensions en CSS.',
        });
      }
    }
  });

  auditFocusStyles(out);
  auditLinksInText(out);

  let hiddenFocusable = 0;
  document.querySelectorAll('[aria-hidden="true"]').forEach((container) => {
    const candidates = [container, ...container.querySelectorAll(FOCUSABLE_SELECTOR)];
    candidates.filter(isKeyboardFocusable).forEach((el) => {
      hiddenFocusable++;
      out.error({
        id: '10.8', rule: 'aria-hidden-focusable', element: el,
        message: 'Élément atteignable au clavier à l’intérieur d’une zone aria-hidden="true".',
        group: 'aria-hidden-focusable',
        rationale: 'Le focus atterrit sur un élément que le lecteur d’écran ne peut pas annoncer.',
        remediationHint: 'Retirer aria-hidden, ou rendre l’élément non focusable (tabindex="-1", inert).',
      });
    });
  });
  if (!hiddenFocusable && document.querySelector('[aria-hidden="true"]')) {
    out.pass({ id: '10.8', rule: 'aria-hidden-focusable-ok', message: 'Aucun élément focusable dans une zone aria-hidden.', confidence: 'medium', manualReviewRecommended: true });
  }

  if (!options.skipManual) {
    out.manual({ id: '10.4', rule: 'text-zoom', message: 'Agrandissement du texte à 200 % : vérification manuelle (ou simulation CLI).' });
    out.manual({ id: '10.11', rule: 'reflow', message: 'Affichage à 320 px de large sans défilement horizontal : vérification manuelle (ou simulation CLI).' });
  }
}

/**
 * Cible de focus programmatique (zone de contenu atteinte par un lien d'évitement, titre
 * focalisé après navigation) : retirer son contour n'affecte pas la navigation clavier.
 */
function isProgrammaticFocusTarget(selector) {
  const compound = selector.split(/[\s>+~]+/).filter(Boolean).find((part) => /:focus/.test(part)) || '';
  const subject = compound.replace(/:focus(-visible|-within)?.*$/, '');
  return /^(main|body|html|section|article|h[1-6])\b/i.test(subject) || /\[tabindex=["']?-1/.test(subject);
}

function auditFocusStyles(out) {
  const suspects = [];
  let readable = 0;
  const visit = (rules, href) => {
    for (const rule of rules) {
      if (rule.cssRules && !rule.selectorText) {
        try { visit(rule.cssRules, href); } catch { /* règle illisible */ }
        continue;
      }
      if (!rule.selectorText || !/:focus/.test(rule.selectorText)) continue;
      const s = rule.style;
      const removesOutline = s.outlineStyle === 'none' || /^0(px)?$/.test(s.outlineWidth) || /^(none|0|0px)(\s|$)/.test(s.outline);
      if (!removesOutline) continue;
      const replacement = (s.boxShadow && s.boxShadow !== 'none') || s.borderColor || s.borderBottom || s.background
        || s.backgroundColor || s.textDecoration || s.textDecorationLine || s.color;
      const selectors = rule.selectorText.split(',').map((x) => x.trim()).filter((sel) => /:focus/.test(sel))
        .filter((sel) => !/:focus:not\(:focus-visible\)|:focus:not\(\.focus-visible\)/.test(sel))
        .filter((sel) => !isProgrammaticFocusTarget(sel));
      if (!replacement && selectors.length) suspects.push({ selector: selectors.join(', '), href });
    }
  };
  for (const sheet of document.styleSheets) {
    try {
      visit(sheet.cssRules, sheet.href || 'style interne');
      readable++;
    } catch { /* feuille cross-origin non lisible */ }
  }
  suspects.slice(0, 20).forEach((suspect) => out.warn({
    id: '10.7', rule: 'focus-outline-removed',
    message: `Règle CSS supprimant le contour de focus sans remplacement : ${suspect.selector.slice(0, 120)}.`,
    group: suspect.selector,
    snippet: suspect.href,
    confidence: 'medium',
    rationale: 'Un focus invisible empêche la navigation au clavier ; un autre style peut toutefois le compenser.',
    remediationHint: 'Conserver un indicateur visible (outline, box-shadow, soulignement) à la prise de focus.',
  }));
  if (readable && !suspects.length) {
    out.pass({ id: '10.7', rule: 'focus-outline-css-ok', message: 'Aucune suppression du contour de focus sans remplacement dans les CSS lisibles.', confidence: 'medium', manualReviewRecommended: true });
  }
}

function auditLinksInText(out) {
  let checked = 0;
  let failed = 0;
  document.querySelectorAll('p a[href], li a[href], td a[href], dd a[href], blockquote a[href]').forEach((link) => {
    if (checked >= 300) return;
    if (!isRendered(link) || isVisuallyHidden(link)) return;
    if (link.closest('nav, [role="navigation"], [role="menu"], [role="menubar"], [role="tablist"]')) return;
    const container = link.closest('p, li, td, dd, blockquote');
    const linkText = normalizedText(link.textContent);
    if (!linkText) return;
    // Seul le texte courant compte : un <li> de menu contenant d'autres liens n'est pas du texte.
    const surrounding = [...container.childNodes]
      .filter((n) => n.nodeType === 3 || (n.nodeType === 1 && !n.matches('a, button, ul, ol, nav, [role="menu"]') && !n.querySelector('a, button')))
      .map((n) => n.textContent)
      .join(' ');
    if (normalizedText(surrounding).length < 15) return;
    checked++;
    const ls = style(link);
    const cs = style(container);
    if (/underline/.test(ls.textDecorationLine) || /underline/.test(ls.textDecoration)) return;
    if (parseFloat(ls.borderBottomWidth) > 0 && ls.borderBottomStyle !== 'none') return;
    if (ls.boxShadow && ls.boxShadow !== 'none') return;
    if (ls.backgroundImage && ls.backgroundImage !== 'none') return;
    const bg = effectiveBackground(container, null);
    if (bg.indeterminate) return;
    const linkColor = parseColor(ls.color);
    const textColor = parseColor(cs.color);
    if (!linkColor || !textColor) return;
    const ratio = contrastRatio(blend(linkColor, bg.color), blend(textColor, bg.color));
    const weightDiffers = Math.abs((parseInt(ls.fontWeight, 10) || 400) - (parseInt(cs.fontWeight, 10) || 400)) >= 300;
    if (ratio < 3 && !weightDiffers) {
      failed++;
      out.error({
        id: '10.6', rule: 'link-in-text-distinguishable', element: link,
        message: `Lien dans le texte non souligné et peu distinct du texte voisin (${formatRatio(ratio)}:1, requis 3:1).`,
        group: 'link-in-text-distinguishable',
        confidence: 'medium',
        rationale: 'Sans soulignement, un lien doit se distinguer du texte par la couleur (3:1) et un autre indice au survol et au focus.',
        remediationHint: 'Souligner les liens dans le texte (solution la plus simple et la plus robuste).',
      });
    } else if (ratio >= 3 && !weightDiffers) {
      out.warn({
        id: '10.6', rule: 'link-in-text-color-only', element: link,
        message: 'Lien dans le texte distingué par la seule couleur : vérifier l’indice au survol et au focus.',
        group: 'link-in-text-color-only',
        confidence: 'low',
        remediationHint: 'Ajouter un soulignement au survol et à la prise de focus, ou souligner en permanence.',
      });
    }
  });
  if (checked && !failed) {
    out.pass({ id: '10.6', rule: 'link-in-text-ok', message: `${checked} lien(s) dans le texte visibles par rapport au texte environnant.`, confidence: 'medium' });
  }
}
