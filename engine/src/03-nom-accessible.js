// ─────────────────────────────────────────────
// Nom accessible (calcul simplifié d'après accname 1.2)
// ─────────────────────────────────────────────

const NAME_FROM_CONTENT_ROLES = new Set([
  'button', 'cell', 'checkbox', 'columnheader', 'gridcell', 'heading', 'link', 'menuitem',
  'menuitemcheckbox', 'menuitemradio', 'option', 'radio', 'row', 'rowheader', 'switch', 'tab',
  'tooltip', 'treeitem', 'caption', 'term', 'code', 'emphasis', 'strong', 'deletion', 'insertion',
]);

const NATIVE_ROLE_BY_TAG = {
  a: (el) => (el.hasAttribute('href') ? 'link' : 'generic'),
  button: () => 'button',
  h1: () => 'heading', h2: () => 'heading', h3: () => 'heading',
  h4: () => 'heading', h5: () => 'heading', h6: () => 'heading',
  td: () => 'cell', th: () => 'columnheader', summary: () => 'button', option: () => 'option',
  legend: () => 'legend', label: () => 'label', caption: () => 'caption', li: () => 'listitem',
};

function explicitRole(el) {
  const tokens = normalizedText(el.getAttribute('role')).toLowerCase().split(' ').filter(Boolean);
  return tokens.find((t) => ARIA_ROLES.has(t)) || null;
}

function roleOf(el) {
  const explicit = explicitRole(el);
  if (explicit) return explicit;
  const native = NATIVE_ROLE_BY_TAG[el.localName];
  return native ? native(el) : null;
}

function textOfLabelElements(labels, visited) {
  return normalizedText([...labels].map((label) => nameFromContent(label, visited, true)).join(' '));
}

function nameFromContent(el, visited, includeHidden) {
  const parts = [];
  for (const child of el.childNodes) {
    if (child.nodeType === 3) {
      parts.push(child.textContent);
    } else if (child.nodeType === 1) {
      if (!includeHidden && isHiddenFromAT(child)) continue;
      if (includeHidden && !isRendered(child) && child.closest('[aria-hidden="true"]')) continue;
      if (['script', 'style', 'template', 'noscript'].includes(child.localName)) continue;
      parts.push(accessibleName(child, visited, { traversing: true, includeHidden }));
    }
  }
  return normalizedText(parts.join(' '));
}

/**
 * Nom accessible d'un élément. Couvre aria-labelledby, aria-label, les mécanismes natifs
 * (label, alt, title de svg, caption, legend, value) et le nom calculé depuis le contenu.
 */
function accessibleName(el, visited = new Set(), options = {}) {
  if (!el || visited.has(el)) return '';
  visited.add(el);
  const { traversing = false, includeHidden = false } = options;

  if (!traversing) {
    const labelledBy = idRefs(el, 'aria-labelledby').map(getById).filter(Boolean);
    if (labelledBy.length) {
      const text = normalizedText(labelledBy.map((ref) => (
        ref === el ? normalizedText(el.getAttribute('aria-label')) || nameFromContent(ref, visited, true)
          : accessibleName(ref, visited, { traversing: true, includeHidden: true })
      )).join(' '));
      if (text) return text;
    }
  }

  const ariaLabel = normalizedText(el.getAttribute('aria-label'));
  if (ariaLabel) return ariaLabel;

  const tag = el.localName;
  const role = roleOf(el);
  if (role === 'presentation' || role === 'none') {
    if (traversing) return nameFromContent(el, visited, includeHidden);
  }

  if (tag === 'img' || tag === 'area') {
    const alt = el.getAttribute('alt');
    if (alt !== null) return normalizedText(alt);
  }
  if (tag === 'input') {
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    if (type === 'image') {
      const alt = normalizedText(el.getAttribute('alt'));
      if (alt) return alt;
    }
    if (['button', 'submit', 'reset'].includes(type)) {
      const value = normalizedText(el.getAttribute('value'));
      if (value) return value;
      if (type === 'submit') return 'Envoyer';
      if (type === 'reset') return 'Réinitialiser';
    }
    if (traversing && !['button', 'submit', 'reset', 'image'].includes(type)) {
      return normalizedText(el.value);
    }
  }
  if (['input', 'select', 'textarea', 'meter', 'progress', 'output'].includes(tag) && el.labels && el.labels.length) {
    const text = textOfLabelElements(el.labels, visited);
    if (text) return text;
  }
  if (tag === 'svg') {
    const title = el.querySelector(':scope > title');
    if (title && normalizedText(title.textContent)) return normalizedText(title.textContent);
  }
  if (tag === 'table') {
    const caption = el.querySelector(':scope > caption');
    if (caption && normalizedText(caption.textContent)) return normalizedText(caption.textContent);
  }
  if (tag === 'fieldset') {
    const legend = el.querySelector(':scope > legend');
    if (legend && normalizedText(legend.textContent)) return normalizedText(legend.textContent);
  }
  if (tag === 'figure') {
    const figcaption = el.querySelector(':scope > figcaption');
    if (figcaption && normalizedText(figcaption.textContent)) return normalizedText(figcaption.textContent);
  }

  if (traversing || NAME_FROM_CONTENT_ROLES.has(role)) {
    const text = nameFromContent(el, visited, includeHidden);
    if (text) return text;
  }

  return normalizedText(el.getAttribute('title'));
}

/** Texte réellement visible à l'écran (exclut sr-only, aria-hidden visible reste inclus). */
function visibleText(el) {
  if (!el) return '';
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const parts = [];
  let node = walker.nextNode();
  while (node) {
    const parent = node.parentElement;
    if (parent && normalizedText(node.textContent) && isRendered(parent) && !isVisuallyHidden(parent)) {
      parts.push(node.textContent);
    }
    node = walker.nextNode();
  }
  return normalizedText(parts.join(' '));
}

/**
 * Le nom accessible contient-il l'intitulé visible (RGAA 6.1.5, 11.2.5, 11.9.2) ?
 * Retourne null quand la comparaison n'a pas de sens (pas d'intitulé visible exploitable).
 */
function nameIncludesVisibleLabel(name, visible) {
  const v = comparableText(visible);
  if (!v || v.length < 2 || !/\p{L}{2}/u.test(v)) return null;
  return comparableText(name).includes(v);
}

/**
 * Sur un composant qui affiche beaucoup de texte (carte, vignette), l'« intitulé visible »
 * n'est plus évident : l'écart devient un point à vérifier plutôt qu'une non-conformité.
 */
/**
 * Intitulé visible d'une commande. Dans un composant qui contient un titre (vignette,
 * carte), c'est ce titre qui sert d'intitulé : catégorie, date ou durée affichées à côté
 * ne font pas partie du libellé.
 */
function visibleLabelOf(control) {
  const heading = control.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]');
  const headingText = heading ? visibleText(heading) : '';
  return headingText || visibleText(control);
}

function isShortVisibleLabel(visible) {
  const text = normalizedText(visible);
  return text.length <= 60 && text.split(' ').length <= 8;
}
