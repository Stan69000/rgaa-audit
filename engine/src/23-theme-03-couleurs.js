// ─────────────────────────────────────────────
// Thème 3 — Couleurs
// ─────────────────────────────────────────────

function auditContrast(out, options) {
  const limit = options.maxTextNodes || 4000;
  const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  const failures = new Map();
  const undetermined = new Map();
  let passed = 0;
  let tested = 0;
  let truncated = false;
  let lowConfidence = 0;

  let node = walker.nextNode();
  while (node) {
    const parent = node.parentElement;
    if (parent && !seen.has(parent) && normalizedText(node.textContent)) {
      seen.add(parent);
      if (tested >= limit) {
        truncated = true;
        break;
      }
      const verdict = checkTextContrast(node, parent);
      if (verdict) {
        tested++;
        if (verdict.indeterminate) {
          const entry = undetermined.get(verdict.indeterminate) || { count: 0, element: parent };
          entry.count++;
          undetermined.set(verdict.indeterminate, entry);
        } else if (verdict.ratio < verdict.required) {
          const key = `${toHex(verdict.fg)}|${toHex(verdict.bg)}|${verdict.required}`;
          const entry = failures.get(key) || { ...verdict, elements: [] };
          entry.elements.push(parent);
          failures.set(key, entry);
        } else {
          passed++;
        }
        if (verdict.lowConfidence) lowConfidence++;
      }
    }
    node = walker.nextNode();
  }

  const label = contextLabel(options) ? ` [${contextLabel(options)}]` : '';

  [...failures.values()]
    .sort((a, b) => b.elements.length - a.elements.length)
    .forEach((f) => {
      const message = `Contraste insuffisant ${formatRatio(f.ratio)}:1 (requis ${f.required}:1) — texte ${toHex(f.fg)} sur fond ${toHex(f.bg)}${label}.`;
      f.elements.forEach((el) => {
        out.error({
          id: '3.2', rule: 'text-contrast', element: el, message, group: message,
          confidence: f.lowConfidence ? 'medium' : 'high',
          details: { ratio: Number(f.ratio.toFixed(2)), required: f.required, foreground: toHex(f.fg), background: toHex(f.bg), method: f.method },
          rationale: 'Un contraste insuffisant rend le texte difficile à lire, notamment en basse vision.',
          remediationHint: f.required === 3
            ? 'Gros texte : viser au moins 3:1 entre le texte et son arrière-plan.'
            : 'Texte courant : viser au moins 4,5:1 entre le texte et son arrière-plan.',
        });
      });
    });

  undetermined.forEach((entry, reason) => {
    for (let i = 0; i < entry.count; i++) {
      out.warn({
        id: '3.2', rule: 'text-contrast-undetermined', element: i === 0 ? entry.element : null,
        message: `Contraste non mesurable automatiquement : ${reason}${label}.`,
        group: reason,
        confidence: 'low',
        remediationHint: 'Mesurer le contraste à la pipette sur la zone la plus défavorable de l’arrière-plan.',
      });
    }
  });

  if (passed) {
    out.pass({
      id: '3.2', rule: 'text-contrast-ok',
      message: `${passed} bloc(s) de texte au contraste suffisant${label}.`,
      confidence: lowConfidence ? 'medium' : 'high',
      manualReviewRecommended: true,
      remediationHint: 'Les états survol, focus et erreur ne sont pas mesurés : les contrôler à la main.',
    });
  }
  if (truncated) {
    out.manual({
      id: '3.2', rule: 'text-contrast-truncated',
      message: `Analyse de contraste limitée aux ${limit} premiers blocs de texte.`,
    });
  }
}

function checkTextContrast(textNode, el) {
  if (SKIPPED_TEXT_PARENTS.has(el.localName) || el.closest('svg, math')) return null;
  if (!isRendered(el) || isVisuallyHidden(el)) return null;
  if (el.closest(':disabled, [aria-disabled="true"]')) return null;
  const s = style(el);
  const fontSize = parseFloat(s.fontSize);
  if (!fontSize) return null;
  const textColor = parseColor(s.color);
  if (!textColor || textColor.a === 0) return null;
  const rect = textRect(textNode);
  if (!rect) return null;
  const clipping = clippingState(el, rect);
  if (clipping === 'clipped') return null;
  const point = clipping === 'scrolled' ? null : textPoint(textNode, rect);
  const composed = composeColors(el, point, textColor);
  if (composed.indeterminate) return { indeterminate: composed.indeterminate };

  const ratio = contrastRatio(composed.foreground, composed.background);
  const weight = parseInt(s.fontWeight, 10) || (s.fontWeight === 'bold' ? 700 : 400);
  const large = fontSize >= 24 || (fontSize >= 18.5 && weight >= 700);
  const hasShadow = s.textShadow && s.textShadow !== 'none';
  return {
    ratio,
    required: large ? 3 : 4.5,
    fg: composed.foreground,
    bg: composed.background,
    method: composed.method,
    lowConfidence: hasShadow || (composed.method === 'ancestors' && hasPositionedAncestor(el)),
  };
}

/**
 * Contraste du premier texte visible d'un élément, dans son état courant (survol, focus…).
 * Utilisé par la simulation de la CLI pour mesurer les états interactifs.
 */
function measureContrast(el) {
  if (!el) return null;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (normalizedText(node.textContent) && node.parentElement) {
      const verdict = checkTextContrast(node, node.parentElement);
      if (verdict) {
        if (verdict.indeterminate) return { indeterminate: verdict.indeterminate };
        return {
          ratio: Number(verdict.ratio.toFixed(2)),
          required: verdict.required,
          foreground: toHex(verdict.fg),
          background: toHex(verdict.bg),
          pass: verdict.ratio >= verdict.required,
        };
      }
    }
    node = walker.nextNode();
  }
  return null;
}

function hasPositionedAncestor(el) {
  let node = el;
  while (node && node.nodeType === 1) {
    const position = style(node).position;
    if (position === 'fixed' || position === 'sticky' || position === 'absolute') return true;
    node = node.parentElement;
  }
  return false;
}

function auditUiContrast(out) {
  const fields = [...document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]), select, textarea')]
    .filter((f) => isRendered(f) && !f.disabled && !isVisuallyHidden(f));
  let failures = 0;
  fields.forEach((field) => {
    const s = style(field);
    const parentBg = effectiveBackground(field.parentElement || document.body, null);
    if (parentBg.indeterminate) return;
    const fieldBg = parseColor(s.backgroundColor);
    const fieldFill = fieldBg ? blend(fieldBg, parentBg.color) : parentBg.color;
    if (contrastRatio(fieldFill, parentBg.color) >= 3) return;
    const sides = ['Top', 'Right', 'Bottom', 'Left']
      .filter((side) => parseFloat(s[`border${side}Width`]) >= 1 && s[`border${side}Style`] !== 'none')
      .map((side) => parseColor(s[`border${side}Color`]))
      .filter(Boolean)
      .map((c) => contrastRatio(blend(c, parentBg.color), parentBg.color));
    const outline = parseFloat(s.outlineWidth) >= 1 && s.outlineStyle !== 'none'
      ? contrastRatio(blend(parseColor(s.outlineColor) || { r: 0, g: 0, b: 0, a: 0 }, parentBg.color), parentBg.color)
      : 0;
    const best = Math.max(0, outline, ...sides);
    if (best < 3) {
      failures++;
      out.warn({
        id: '3.3', rule: 'field-boundary-contrast', element: field,
        message: `Bordure de champ peu contrastée (${formatRatio(best)}:1, requis 3:1).`,
        group: 'field-boundary-contrast',
        confidence: 'medium',
        details: { ratio: Number(best.toFixed(2)) },
        rationale: 'Les limites d’un champ doivent se distinguer de l’arrière-plan pour être repérées.',
        remediationHint: 'Renforcer la bordure ou le fond du champ (3:1 minimum avec ce qui l’entoure).',
      });
    }
  });
  if (fields.length && !failures) {
    out.pass({
      id: '3.3', rule: 'field-boundary-contrast-ok',
      message: `${fields.length} champ(s) aux limites suffisamment contrastées.`,
      confidence: 'medium', manualReviewRecommended: true,
      remediationHint: 'Icônes, graphiques et états de focus restent à contrôler manuellement.',
    });
  }
}

const SVG_SHAPES = 'path, circle, rect, ellipse, polygon, polyline, line, use, text';

/** Couleurs unies utilisées par les tracés d'une icône SVG (remplissages et contours). */
function svgIconColors(svg) {
  const colors = [];
  for (const shape of svg.querySelectorAll(SVG_SHAPES)) {
    const s = style(shape);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    const paints = [s.fill];
    if (parseFloat(s.strokeWidth) > 0) paints.push(s.stroke);
    for (const paint of paints) {
      if (!paint || paint === 'none' || /url\(/.test(paint)) continue;
      const color = parseColor(paint);
      if (color && color.a > 0) colors.push(color);
    }
    if (colors.length >= 6) break;
  }
  return colors;
}

/**
 * 3.3 : une icône qui est le seul contenu visible d'un bouton ou d'un lien porte
 * l'information ; elle doit atteindre 3:1 avec son arrière-plan.
 */
function auditIconContrast(out) {
  let checked = 0;
  let failed = 0;
  document.querySelectorAll('a[href] svg, button svg, [role="button"] svg, [role="link"] svg').forEach((svg) => {
    if (svg.parentElement && svg.parentElement.closest('svg')) return;
    const control = svg.closest('a[href], button, [role="button"], [role="link"]');
    if (!control || !isRendered(svg) || isVisuallyHidden(svg) || control.matches(':disabled, [aria-disabled="true"]')) return;
    if (visibleText(control)) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return;
    const colors = svgIconColors(svg);
    if (!colors.length) return;
    const point = rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : null;
    // Prudence : on retient la couleur la plus contrastée de l'icône (un tracé sans surface
    // garde un remplissage noir par défaut qu'on ne sait pas distinguer d'un vrai remplissage).
    let composed = null;
    let ratio = 0;
    for (const color of colors) {
      const candidate = composeColors(svg, point, color);
      if (candidate.indeterminate) return;
      const r = contrastRatio(candidate.foreground, candidate.background);
      if (r > ratio) {
        ratio = r;
        composed = candidate;
      }
    }
    checked++;
    if (ratio < 3) {
      failed++;
      out.error({
        id: '3.3', rule: 'icon-contrast', element: control,
        message: `Icône seule d’un ${control.matches('a') ? 'lien' : 'bouton'} peu contrastée (${formatRatio(ratio)}:1, requis 3:1) — ${toHex(composed.foreground)} sur ${toHex(composed.background)}.`,
        group: `icon-contrast-${toHex(composed.foreground)}-${toHex(composed.background)}`,
        confidence: 'medium',
        details: { ratio: Number(ratio.toFixed(2)), required: 3, foreground: toHex(composed.foreground), background: toHex(composed.background) },
        rationale: 'Sans texte, l’icône est le seul moyen d’identifier la commande : elle doit se distinguer du fond.',
        remediationHint: 'Foncer (ou éclaircir) l’icône pour atteindre 3:1 avec son arrière-plan.',
      });
    }
  });
  if (checked && !failed) {
    out.pass({ id: '3.3', rule: 'icon-contrast-ok', message: `${checked} icône(s) de commande suffisamment contrastée(s).`, confidence: 'medium' });
  }
}

function auditColors(out, options) {
  auditContrast(out, options);
  if (options.contrastOnly) return;
  auditUiContrast(out);
  auditIconContrast(out);
  out.manual({
    id: '3.1', rule: 'color-only-info',
    message: 'Information donnée uniquement par la couleur : vérification manuelle.',
    remediationHint: 'Doubler chaque information colorée par un texte, une forme ou un motif.',
  });
}
