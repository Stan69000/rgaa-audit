/**
 * Moteur de règles RGAA 4.1.2 — partagé par la CLI (Playwright) et l'extension Chrome.
 *
 * FICHIER GÉNÉRÉ par engine/build.js à partir de engine/src/ : ne pas modifier à la main.
 *
 * Le fichier s'exécute dans la page auditée : il n'a aucune dépendance et n'expose
 * que `globalThis.RgaaRules`. Il est injecté tel quel (executeScript côté extension,
 * page.evaluate côté CLI) et peut être chargé plusieurs fois sans effet de bord.
 *
 * Statuts produits :
 *   NC  non-conformité probable (signal fiable)
 *   NT  à vérifier : signal heuristique ou contrôle manuel requis
 *   C   conforme sur l'échantillon testé
 *   NA  non applicable (aucun élément concerné)
 */

'use strict';

(function (root) {
  const ENGINE_VERSION = '0.3.1';

  if (root.RgaaRules && root.RgaaRules.ENGINE_VERSION === ENGINE_VERSION) return;

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

  // ─────────────────────────────────────────────
  // Utilitaires DOM
  // ─────────────────────────────────────────────

  function normalizedText(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function comparableText(value) {
    return normalizedText(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  function shortSnippet(el, max = 200) {
    if (!el || typeof el.outerHTML !== 'string') return null;
    const html = el.outerHTML.replace(/\s+/g, ' ');
    return html.length > max ? `${html.slice(0, max)}…` : html;
  }

  function cssEscape(value) {
    if (typeof CSS !== 'undefined' && CSS && typeof CSS.escape === 'function') return CSS.escape(String(value));
    return String(value).replace(/([^\w-])/g, '\\$1');
  }

  function cssPath(el) {
    if (!el || el.nodeType !== 1) return null;
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 8) {
      const tag = node.localName;
      if (node.id && document.querySelectorAll(`#${cssEscape(node.id)}`).length === 1) {
        parts.unshift(`#${cssEscape(node.id)}`);
        break;
      }
      if (tag === 'html' || tag === 'body') {
        parts.unshift(tag);
        break;
      }
      let index = 1;
      let sibling = node.previousElementSibling;
      while (sibling) {
        if (sibling.localName === tag) index++;
        sibling = sibling.previousElementSibling;
      }
      parts.unshift(index > 1 ? `${tag}:nth-of-type(${index})` : tag);
      node = node.parentElement;
    }
    return parts.join(' > ');
  }

  const styleCache = new WeakMap();
  function style(el) {
    let s = styleCache.get(el);
    if (!s) {
      s = window.getComputedStyle(el);
      styleCache.set(el, s);
    }
    return s;
  }

  /** Élément non rendu (display:none, visibility:hidden, content-visibility, ancêtre masqué). */
  function isRendered(el) {
    if (!el || !el.isConnected) return false;
    if (typeof el.checkVisibility === 'function') {
      return el.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true });
    }
    const s = style(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return false;
    return el.getClientRects().length > 0;
  }

  /** Masqué visuellement mais lu par les lecteurs d'écran (classe sr-only / visually-hidden). */
  function isVisuallyHidden(el) {
    let node = el;
    while (node && node.nodeType === 1 && node !== document.body) {
      const s = style(node);
      const rect = node.getBoundingClientRect();
      if (rect.width <= 1 && rect.height <= 1 && s.overflow === 'hidden') return true;
      if (/rect\(\s*0(px)?[\s,]+0(px)?[\s,]+0(px)?[\s,]+0(px)?\s*\)/.test(s.clip) && s.position === 'absolute') return true;
      if (/inset\(\s*50%/.test(s.clipPath)) return true;
      if (parseFloat(s.opacity) === 0) return true;
      node = node.parentElement;
    }
    return false;
  }

  /** Ignoré par les technologies d'assistance (aria-hidden, inert, non rendu). */
  function isHiddenFromAT(el) {
    if (!isRendered(el)) return true;
    return Boolean(el.closest('[aria-hidden="true"], [inert]'));
  }

  const FOCUSABLE_SELECTOR = [
    'a[href]', 'area[href]', 'button', 'input:not([type="hidden"])', 'select', 'textarea',
    'iframe', 'summary', '[tabindex]', '[contenteditable=""]', '[contenteditable="true"]',
    'audio[controls]', 'video[controls]',
  ].join(',');

  function isKeyboardFocusable(el) {
    if (!el.matches(FOCUSABLE_SELECTOR)) return false;
    if (el.matches(':disabled')) return false;
    const tabindex = el.getAttribute('tabindex');
    if (tabindex !== null && parseInt(tabindex, 10) < 0) return false;
    return isRendered(el);
  }

  function idRefs(el, attr) {
    return normalizedText(el.getAttribute(attr)).split(' ').filter(Boolean);
  }

  function getById(id) {
    return document.getElementById(id);
  }

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

  // ─────────────────────────────────────────────
  // Couleurs et contraste
  // ─────────────────────────────────────────────

  const colorCache = new Map();
  let colorCanvasCtx = null;

  function parseColorWithCanvas(value) {
    if (!colorCanvasCtx) {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      colorCanvasCtx = canvas.getContext('2d', { willReadFrequently: true });
    }
    const ctx = colorCanvasCtx;
    if (!ctx) return null;
    ctx.fillStyle = '#010203';
    ctx.fillStyle = value;
    const accepted = ctx.fillStyle !== '#010203' || /^#010203$/i.test(value);
    if (!accepted) return null;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a: a / 255 };
  }

  /**
   * Convertit une couleur calculée en {r,g,b,a} (0-255, alpha 0-1).
   * Gère rgb()/rgba() (syntaxes virgule et espace), color(srgb …) dont les composantes
   * sont entre 0 et 1, et délègue les autres espaces (oklch, lab, color-mix…) au canvas.
   */
  function parseColor(value) {
    const raw = String(value || '').trim();
    if (colorCache.has(raw)) return colorCache.get(raw);
    let parsed = null;

    const num = (token, scale) => {
      if (token === 'none') return 0;
      if (token.endsWith('%')) return (parseFloat(token) / 100) * scale;
      return parseFloat(token);
    };

    let m = raw.match(/^rgba?\(\s*([^)]+)\)$/i);
    if (m) {
      const tokens = m[1].replace(/\//g, ' ').split(/[\s,]+/).filter(Boolean);
      if (tokens.length >= 3) {
        parsed = {
          r: num(tokens[0], 255),
          g: num(tokens[1], 255),
          b: num(tokens[2], 255),
          a: tokens[3] !== undefined ? num(tokens[3], 1) : 1,
        };
      }
    }

    if (!parsed) {
      m = raw.match(/^color\(\s*srgb\s+([^)]+)\)$/i);
      if (m) {
        const tokens = m[1].replace(/\//g, ' ').split(/\s+/).filter(Boolean);
        if (tokens.length >= 3) {
          parsed = {
            r: num(tokens[0], 1) * 255,
            g: num(tokens[1], 1) * 255,
            b: num(tokens[2], 1) * 255,
            a: tokens[3] !== undefined ? num(tokens[3], 1) : 1,
          };
        }
      }
    }

    if (!parsed && raw && raw !== 'transparent') parsed = parseColorWithCanvas(raw);
    if (!parsed && raw === 'transparent') parsed = { r: 0, g: 0, b: 0, a: 0 };

    if (parsed) {
      parsed = {
        r: Math.min(255, Math.max(0, parsed.r)),
        g: Math.min(255, Math.max(0, parsed.g)),
        b: Math.min(255, Math.max(0, parsed.b)),
        a: Math.min(1, Math.max(0, Number.isFinite(parsed.a) ? parsed.a : 1)),
      };
    }
    colorCache.set(raw, parsed);
    return parsed;
  }

  /** Superpose une couleur (éventuellement translucide) sur un fond opaque. */
  function blend(top, bottom) {
    const a = top.a;
    return {
      r: top.r * a + bottom.r * (1 - a),
      g: top.g * a + bottom.g * (1 - a),
      b: top.b * a + bottom.b * (1 - a),
      a: 1,
    };
  }

  function relativeLuminance(c) {
    const channel = (v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
  }

  function contrastRatio(a, b) {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  function toHex(c) {
    return `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  }

  function formatRatio(r) {
    return (Math.floor(r * 100) / 100).toFixed(2);
  }

  let canvasColor = null;
  /** Couleur du canevas du navigateur (blanc, ou sombre si color-scheme: dark). */
  function getCanvasColor() {
    if (canvasColor) return canvasColor;
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;width:0;height:0;background-color:Canvas;color-scheme:inherit';
    (document.body || document.documentElement).appendChild(probe);
    canvasColor = parseColor(window.getComputedStyle(probe).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    probe.remove();
    if (canvasColor.a < 1) canvasColor = blend(canvasColor, { r: 255, g: 255, b: 255, a: 1 });
    return canvasColor;
  }

  const MEDIA_TAGS = new Set(['img', 'video', 'canvas', 'picture', 'iframe', 'object', 'embed']);

  /**
   * Couches susceptibles de se trouver sous le texte, de la plus proche à la plus lointaine.
   * Quand le texte est dans la fenêtre, on interroge ce qui est réellement dessous
   * (elementsFromPoint) : c'est ce qui rend juste le cas d'une navigation fixe et
   * transparente posée sur une image ou une section sombre. Sinon on remonte les ancêtres.
   */
  function layersUnder(el, point) {
    const chain = [];
    if (point) {
      const stack = document.elementsFromPoint(point.x, point.y);
      const index = stack.findIndex((node) => node === el || node.contains(el));
      if (index !== -1) {
        let node = el;
        while (node && node !== stack[index]) {
          chain.push(node);
          node = node.parentElement;
        }
        for (let i = index; i < stack.length; i++) {
          if (!stack[i].contains(el) && el.contains(stack[i])) continue;
          chain.push(stack[i]);
        }
        return { chain, method: 'point' };
      }
    }
    let node = el;
    while (node && node.nodeType === 1) {
      chain.push(node);
      node = node.parentElement;
    }
    return { chain, method: 'ancestors' };
  }

  /** Superpose deux couleurs translucides (alpha non prémultiplié). */
  function over(top, bottom) {
    const a = top.a + bottom.a * (1 - top.a);
    if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 };
    const mix = (t, b) => (t * top.a + b * bottom.a * (1 - top.a)) / a;
    return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a };
  }

  const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

  /**
   * Couleurs réellement rendues sous le texte. Les couches sont composées de la plus proche
   * à la plus lointaine ; l'opacité d'un ancêtre s'applique à tout ce qu'il contient (groupe
   * d'opacité), comme le fait le navigateur : texte et fond d'une carte à opacity:.68 sont
   * estompés ensemble vers ce qui se trouve dessous.
   */
  function composeColors(el, point, textColor) {
    const { chain, method } = layersUnder(el, point);
    const ancestor = chain.map((node) => node === el || node.contains(el));
    const opacity = chain.map((node) => {
      const value = parseFloat(style(node).opacity);
      return Number.isFinite(value) ? value : 1;
    });
    const fadedAbove = new Array(chain.length + 1).fill(false);
    for (let i = chain.length - 1; i >= 0; i--) fadedAbove[i] = fadedAbove[i + 1] || (ancestor[i] && opacity[i] < 1);

    let bg = TRANSPARENT;
    let fg = textColor || TRANSPARENT;
    let faded = false;
    for (let i = 0; i < chain.length; i++) {
      const node = chain[i];
      const s = style(node);
      const media = !ancestor[i] && MEDIA_TAGS.has(node.localName);
      const image = s.backgroundImage && s.backgroundImage !== 'none';
      if (media || image) {
        if (bg.a >= 0.99 && !fadedAbove[i]) break;
        return {
          indeterminate: media ? 'texte posé sur une image, une vidéo ou un canevas' : 'arrière-plan en image ou en dégradé',
          method,
        };
      }
      const color = parseColor(s.backgroundColor) || TRANSPARENT;
      if (ancestor[i]) {
        bg = over(bg, color);
        fg = over(fg, color);
        if (opacity[i] < 1) {
          faded = true;
          bg = { ...bg, a: bg.a * opacity[i] };
          fg = { ...fg, a: fg.a * opacity[i] };
        }
      } else {
        const layer = { ...color, a: color.a * opacity[i] };
        bg = over(bg, layer);
        fg = over(fg, layer);
      }
      if (bg.a >= 0.999 && !fadedAbove[i + 1]) break;
    }
    const canvas = getCanvasColor();
    return { background: over(bg, canvas), foreground: over(fg, canvas), method, faded };
  }

  function effectiveBackground(el, point) {
    const composed = composeColors(el, point, null);
    if (composed.indeterminate) return composed;
    return { color: composed.background, method: composed.method };
  }

  function textRect(textNode) {
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const rect = [...range.getClientRects()].find((r) => r.width > 0 && r.height > 0) || null;
    range.detach();
    return rect;
  }

  function textPoint(textNode, rect = textRect(textNode)) {
    if (!rect) return null;
    const x = rect.left + Math.min(rect.width / 2, 8);
    const y = rect.top + rect.height / 2;
    if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return null;
    return { x, y };
  }

  /**
   * Texte hors de la zone visible d'un ancêtre qui rogne son contenu :
   * 'clipped' (overflow hidden/clip : invisible, à ignorer) ou 'scrolled' (zone défilante :
   * visible après défilement, à mesurer par les ancêtres). null sinon.
   */
  function clippingState(el, rect) {
    let node = el.parentElement;
    while (node && node !== document.documentElement) {
      const s = style(node);
      const overflow = `${s.overflowX} ${s.overflowY}`;
      if (/hidden|clip|auto|scroll/.test(overflow)) {
        const r = node.getBoundingClientRect();
        const outside = rect.right <= r.left || rect.left >= r.right || rect.bottom <= r.top || rect.top >= r.bottom;
        if (outside) return /auto|scroll/.test(overflow) ? 'scrolled' : 'clipped';
      }
      node = node.parentElement;
    }
    return null;
  }

  const SKIPPED_TEXT_PARENTS = new Set([
    'script', 'style', 'noscript', 'template', 'option', 'title', 'textarea', 'svg', 'math',
  ]);

  // ─────────────────────────────────────────────
  // Référentiels ARIA / HTML
  // ─────────────────────────────────────────────

  const ARIA_ROLES = new Set([
    'alert', 'alertdialog', 'application', 'article', 'banner', 'blockquote', 'button', 'caption',
    'cell', 'checkbox', 'code', 'columnheader', 'combobox', 'comment', 'complementary', 'contentinfo',
    'definition', 'deletion', 'dialog', 'directory', 'document', 'emphasis', 'feed', 'figure', 'form',
    'generic', 'grid', 'gridcell', 'group', 'heading', 'img', 'image', 'insertion', 'link', 'list', 'listbox',
    'listitem', 'log', 'main', 'mark', 'marquee', 'math', 'menu', 'menubar', 'menuitem',
    'menuitemcheckbox', 'menuitemradio', 'meter', 'navigation', 'none', 'note', 'option',
    'paragraph', 'presentation', 'progressbar', 'radio', 'radiogroup', 'region', 'row', 'rowgroup',
    'rowheader', 'scrollbar', 'search', 'searchbox', 'sectionfooter', 'sectionheader', 'separator',
    'slider', 'spinbutton', 'status', 'strong', 'subscript', 'suggestion', 'superscript', 'switch',
    'tab', 'table', 'tablist', 'tabpanel', 'term', 'textbox', 'time', 'timer', 'toolbar', 'tooltip',
    'tree', 'treegrid', 'treeitem',
    'graphics-document', 'graphics-object', 'graphics-symbol',
    'doc-abstract', 'doc-acknowledgments', 'doc-afterword', 'doc-appendix', 'doc-backlink',
    'doc-biblioentry', 'doc-bibliography', 'doc-biblioref', 'doc-chapter', 'doc-colophon',
    'doc-conclusion', 'doc-cover', 'doc-credit', 'doc-credits', 'doc-dedication', 'doc-endnote',
    'doc-endnotes', 'doc-epigraph', 'doc-epilogue', 'doc-errata', 'doc-example', 'doc-footnote',
    'doc-foreword', 'doc-glossary', 'doc-glossref', 'doc-index', 'doc-introduction', 'doc-noteref',
    'doc-notice', 'doc-pagebreak', 'doc-pagefooter', 'doc-pageheader', 'doc-pagelist', 'doc-part',
    'doc-preface', 'doc-prologue', 'doc-pullquote', 'doc-qna', 'doc-subtitle', 'doc-tip', 'doc-toc',
  ]);

  const ABSTRACT_ROLES = new Set([
    'command', 'composite', 'input', 'landmark', 'range', 'roletype', 'section', 'sectionhead',
    'select', 'structure', 'widget', 'window',
  ]);

  const ARIA_ATTRIBUTES = new Set([
    'aria-activedescendant', 'aria-atomic', 'aria-autocomplete', 'aria-braillelabel',
    'aria-brailleroledescription', 'aria-busy', 'aria-checked', 'aria-colcount', 'aria-colindex',
    'aria-colindextext', 'aria-colspan', 'aria-controls', 'aria-current', 'aria-describedby',
    'aria-description', 'aria-details', 'aria-disabled', 'aria-dropeffect', 'aria-errormessage',
    'aria-expanded', 'aria-flowto', 'aria-grabbed', 'aria-haspopup', 'aria-hidden', 'aria-invalid',
    'aria-keyshortcuts', 'aria-label', 'aria-labelledby', 'aria-level', 'aria-live', 'aria-modal',
    'aria-multiline', 'aria-multiselectable', 'aria-orientation', 'aria-owns', 'aria-placeholder',
    'aria-posinset', 'aria-pressed', 'aria-readonly', 'aria-relevant', 'aria-required',
    'aria-roledescription', 'aria-rowcount', 'aria-rowindex', 'aria-rowindextext', 'aria-rowspan',
    'aria-selected', 'aria-setsize', 'aria-sort', 'aria-valuemax', 'aria-valuemin', 'aria-valuenow',
    'aria-valuetext',
  ]);

  const ARIA_TOKEN_VALUES = {
    'aria-atomic': ['true', 'false'],
    'aria-busy': ['true', 'false'],
    'aria-disabled': ['true', 'false'],
    'aria-hidden': ['true', 'false', 'undefined'],
    'aria-modal': ['true', 'false'],
    'aria-multiline': ['true', 'false'],
    'aria-multiselectable': ['true', 'false'],
    'aria-readonly': ['true', 'false'],
    'aria-required': ['true', 'false'],
    'aria-expanded': ['true', 'false', 'undefined'],
    'aria-selected': ['true', 'false', 'undefined'],
    'aria-checked': ['true', 'false', 'mixed', 'undefined'],
    'aria-pressed': ['true', 'false', 'mixed', 'undefined'],
    'aria-current': ['page', 'step', 'location', 'date', 'time', 'true', 'false'],
    'aria-invalid': ['true', 'false', 'grammar', 'spelling'],
    'aria-live': ['off', 'polite', 'assertive'],
    'aria-haspopup': ['false', 'true', 'menu', 'listbox', 'tree', 'grid', 'dialog'],
    'aria-autocomplete': ['none', 'inline', 'list', 'both'],
    'aria-orientation': ['horizontal', 'vertical', 'undefined'],
    'aria-sort': ['ascending', 'descending', 'none', 'other'],
  };

  const ARIA_IDREF_ATTRIBUTES = [
    'aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-flowto',
    'aria-activedescendant', 'aria-errormessage', 'aria-details',
  ];

  /** Rôles devant être contenus dans un parent précis (contexte requis ARIA 1.2). */
  const REQUIRED_CONTEXT = {
    tab: ['tablist'],
    listitem: ['list', 'directory'],
    option: ['listbox', 'group'],
    menuitem: ['menu', 'menubar', 'group'],
    menuitemcheckbox: ['menu', 'menubar', 'group'],
    menuitemradio: ['menu', 'menubar', 'group'],
    treeitem: ['tree', 'group'],
    row: ['table', 'grid', 'treegrid', 'rowgroup'],
    cell: ['row'],
    gridcell: ['row'],
    columnheader: ['row'],
    rowheader: ['row'],
  };

  /** Rôles devant contenir au moins un élément d'un rôle précis. */
  const REQUIRED_OWNED = {
    tablist: ['tab'],
    list: ['listitem'],
    listbox: ['option', 'group'],
    menu: ['menuitem', 'menuitemcheckbox', 'menuitemradio', 'group'],
    menubar: ['menuitem', 'menuitemcheckbox', 'menuitemradio', 'group'],
    radiogroup: ['radio'],
    tree: ['treeitem', 'group'],
  };

  /** États obligatoires pour un rôle posé sur un élément non natif. */
  const REQUIRED_STATES = {
    checkbox: { attrs: ['aria-checked'], native: 'input[type="checkbox"]' },
    switch: { attrs: ['aria-checked'], native: null },
    radio: { attrs: ['aria-checked'], native: 'input[type="radio"]' },
    menuitemcheckbox: { attrs: ['aria-checked'], native: null },
    menuitemradio: { attrs: ['aria-checked'], native: null },
    slider: { attrs: ['aria-valuenow'], native: 'input[type="range"]' },
    combobox: { attrs: ['aria-expanded'], native: 'select' },
    scrollbar: { attrs: ['aria-controls', 'aria-valuenow'], native: null },
    heading: { attrs: ['aria-level'], native: 'h1,h2,h3,h4,h5,h6' },
  };

  const INTERACTIVE_ROLES = new Set([
    'button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'menuitem', 'menuitemcheckbox',
    'menuitemradio', 'option', 'slider', 'spinbutton', 'textbox', 'searchbox', 'combobox', 'treeitem',
  ]);

  const NATIVE_INTERACTIVE_SELECTOR = 'a[href], button, input, select, textarea, summary, details, audio[controls], video[controls], [contenteditable=""], [contenteditable="true"]';

  const ISO_639_1 = new Set(('aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy '
    + 'da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii '
    + 'ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr '
    + 'ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl '
    + 'sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu')
    .split(' '));

  function isValidLangCode(value) {
    const code = normalizedText(value);
    if (!/^[a-z]{2,3}(-[a-z0-9]{1,8})*$/i.test(code)) return false;
    const primary = code.split('-')[0].toLowerCase();
    return primary.length === 3 || ISO_639_1.has(primary);
  }

  const AUTOCOMPLETE_FIELDS = new Set([
    'name', 'honorific-prefix', 'given-name', 'additional-name', 'family-name', 'honorific-suffix',
    'nickname', 'username', 'new-password', 'current-password', 'one-time-code', 'organization-title',
    'organization', 'street-address', 'address-line1', 'address-line2', 'address-line3',
    'address-level4', 'address-level3', 'address-level2', 'address-level1', 'country', 'country-name',
    'postal-code', 'cc-name', 'cc-given-name', 'cc-additional-name', 'cc-family-name', 'cc-number',
    'cc-exp', 'cc-exp-month', 'cc-exp-year', 'cc-csc', 'cc-type', 'transaction-currency',
    'transaction-amount', 'language', 'bday', 'bday-day', 'bday-month', 'bday-year', 'sex', 'url',
    'photo', 'tel', 'tel-country-code', 'tel-national', 'tel-area-code', 'tel-local',
    'tel-local-prefix', 'tel-local-suffix', 'tel-extension', 'email', 'impp',
  ]);
  const AUTOCOMPLETE_CONTACT_FIELDS = new Set([
    'tel', 'tel-country-code', 'tel-national', 'tel-area-code', 'tel-local', 'tel-local-prefix',
    'tel-local-suffix', 'tel-extension', 'email', 'impp',
  ]);

  function isValidAutocomplete(value) {
    const tokens = normalizedText(value).toLowerCase().split(' ').filter(Boolean);
    if (!tokens.length) return false;
    if (tokens.length === 1 && (tokens[0] === 'on' || tokens[0] === 'off')) return true;
    let i = 0;
    if (tokens[i] && tokens[i].startsWith('section-')) i++;
    if (tokens[i] === 'shipping' || tokens[i] === 'billing') i++;
    if (['home', 'work', 'mobile', 'fax', 'pager'].includes(tokens[i])) {
      i++;
      if (!AUTOCOMPLETE_CONTACT_FIELDS.has(tokens[i])) return false;
    }
    if (!AUTOCOMPLETE_FIELDS.has(tokens[i])) return false;
    i++;
    if (tokens[i] === 'webauthn') i++;
    return i === tokens.length;
  }

  const PERSONAL_FIELD_HINTS = [
    { re: /e-?mail|courriel/, token: 'email' },
    { re: /phone|t[ée]l[ée]phone|\btel\b|mobile|portable/, token: 'tel' },
    { re: /pr[ée]nom|first.?name|given.?name/, token: 'given-name' },
    { re: /\bnom\b|last.?name|family.?name|surname/, token: 'family-name' },
    { re: /code.?postal|postal|zip/, token: 'postal-code' },
    { re: /adresse|address|street/, token: 'street-address' },
    { re: /ville|city|commune/, token: 'address-level2' },
  ];

  const GENERIC_LINK_LABELS = new Set([
    'cliquez ici', 'cliquer ici', 'ici', 'lire la suite', 'en savoir plus', 'savoir plus', 'plus',
    'suite', 'voir', 'voir plus', 'lien', 'click here', 'here', 'read more', 'more', 'learn more',
    'details', 'detail', 'decouvrir', 'acceder',
  ]);

  const OFFICE_DOC_RE = /\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp|rtf|epub)(\?|#|$)/i;

  // ─────────────────────────────────────────────
  // Thème 1 — Images
  // ─────────────────────────────────────────────

  function auditImages(out) {
    const imgs = [...document.querySelectorAll('img')].filter(isRendered);
    let informative = 0;
    let decorative = 0;

    imgs.forEach((img) => {
      if (isHiddenFromAT(img)) {
        decorative++;
        return;
      }
      const role = explicitRole(img);
      const hasAlt = img.hasAttribute('alt');
      const alt = normalizedText(img.getAttribute('alt'));
      const name = accessibleName(img);

      if (role === 'presentation' || role === 'none') {
        if (alt || normalizedText(img.getAttribute('title')) || normalizedText(img.getAttribute('aria-label'))) {
          out.error({
            id: '1.2', rule: 'img-decorative-with-text', element: img,
            message: 'Image déclarée décorative (role="presentation") mais pourvue d’une alternative.',
            rationale: 'Une image de décoration doit être totalement ignorée : alternative et rôle se contredisent.',
            remediationHint: 'Si l’image informe, retirer role="presentation" ; sinon vider alt et retirer title/aria-label.',
          });
        } else {
          decorative++;
        }
        return;
      }

      if (!hasAlt && !name) {
        out.error({
          id: '1.1', rule: 'img-alt-missing', element: img,
          message: 'Image sans attribut alt ni autre alternative textuelle.',
          rationale: 'Sans attribut alt, les lecteurs d’écran annoncent souvent le nom du fichier.',
          remediationHint: 'Ajouter alt="description" si l’image informe, ou alt="" si elle est décorative.',
        });
        return;
      }

      if (hasAlt && alt === '') {
        const otherText = normalizedText(img.getAttribute('title'))
          || normalizedText(img.getAttribute('aria-label'))
          || idRefs(img, 'aria-labelledby').length > 0;
        if (otherText) {
          out.error({
            id: '1.2', rule: 'img-decorative-with-text', element: img,
            message: 'Image à alt vide mais pourvue d’un title ou d’un aria-label.',
            rationale: 'Une image décorative doit être dépourvue de tout attribut fournissant une alternative (test 1.2.1).',
            remediationHint: 'Retirer title/aria-label si l’image est décorative, ou renseigner alt si elle informe.',
          });
          return;
        }
        const link = img.closest('a[href], button');
        if (link && !accessibleName(link)) return; // signalé par les règles liens/boutons (6.2 / 11.9)
        decorative++;
        return;
      }

      informative++;
      const src = img.getAttribute('src') || '';
      const fileName = (src.split(/[?#]/)[0].split('/').pop() || '').replace(/\.[a-z0-9]{2,5}$/i, '');
      const comparable = comparableText(name);
      if (['image', 'photo', 'picture', 'img', 'illustration', 'visuel', 'logo', 'icon', 'icone', 'graphique', 'banniere']
        .includes(comparable)) {
        out.warn({
          id: '1.3', rule: 'img-alt-generic', element: img,
          message: `Alternative textuelle générique : « ${name} ».`,
          group: 'img-alt-generic',
          rationale: 'Une alternative générique ne transmet pas l’information portée par l’image.',
          remediationHint: 'Décrire l’information ou la fonction de l’image dans son contexte.',
        });
      } else if (fileName && !/\s/.test(name) && /[-_.\d]/.test(name) && comparableText(fileName) === comparable) {
        out.warn({
          id: '1.3', rule: 'img-alt-filename', element: img,
          message: `Alternative identique au nom de fichier : « ${name} ».`,
          group: 'img-alt-filename',
          rationale: 'Un nom de fichier est rarement une alternative compréhensible.',
          remediationHint: 'Remplacer par une description de l’information portée par l’image.',
        });
      } else if (name.length > 150) {
        out.warn({
          id: '1.3', rule: 'img-alt-long', element: img,
          message: `Alternative très longue (${name.length} caractères).`,
          group: 'img-alt-long',
          rationale: 'Une alternative longue peut signaler une image complexe ou une image texte.',
          remediationHint: 'Raccourcir l’alternative et, si besoin, fournir une description détaillée (1.6).',
        });
      }
    });

    document.querySelectorAll('input[type="image" i]').forEach((input) => {
      if (isHiddenFromAT(input)) return;
      if (!accessibleName(input) || !normalizedText(input.getAttribute('alt'))) {
        out.error({
          id: '1.1', rule: 'input-image-alt', element: input,
          message: 'Bouton image (input type="image") sans attribut alt.',
          rationale: 'Le test 1.1.3 exige une alternative textuelle sur chaque bouton de type image.',
          remediationHint: 'Ajouter un alt décrivant l’action du bouton.',
        });
      }
    });

    document.querySelectorAll('area[href]').forEach((area) => {
      if (!normalizedText(area.getAttribute('alt')) && !normalizedText(area.getAttribute('aria-label'))) {
        out.error({
          id: '1.1', rule: 'area-alt', element: area,
          message: 'Zone cliquable (area) sans alternative textuelle.',
          remediationHint: 'Ajouter un alt décrivant la destination de la zone.',
        });
      }
    });

    document.querySelectorAll('[role="img"]').forEach((el) => {
      if (el.localName === 'svg' || isHiddenFromAT(el)) return;
      if (!accessibleName(el)) {
        out.error({
          id: '1.1', rule: 'role-img-name', element: el,
          message: 'Élément role="img" sans alternative textuelle.',
          remediationHint: 'Ajouter un aria-label ou aria-labelledby décrivant l’image.',
        });
      }
    });

    let svgUndetermined = 0;
    document.querySelectorAll('svg').forEach((svg) => {
      if (svg.parentElement && svg.parentElement.closest('svg')) return;
      if (!isRendered(svg) || isHiddenFromAT(svg)) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const role = explicitRole(svg);
      if (role === 'presentation' || role === 'none') return;
      const name = accessibleName(svg);
      if (role === 'img') {
        if (!name) {
          out.error({
            id: '1.1', rule: 'svg-name', element: svg,
            message: 'SVG role="img" sans alternative textuelle.',
            remediationHint: 'Ajouter aria-label, aria-labelledby ou un <title> en premier enfant.',
          });
        } else {
          informative++;
        }
        return;
      }
      const host = svg.closest('a[href], button, [role="button"], [role="link"]');
      if (host && normalizedText(visibleText(host))) {
        out.warn({
          id: '1.2', rule: 'svg-decorative-not-hidden', element: svg,
          message: 'Icône SVG accompagnée d’un texte mais non masquée (aria-hidden="true" absent).',
          group: 'svg-decorative-not-hidden',
          confidence: 'medium',
          rationale: 'Une icône redondante avec un texte voisin est décorative et doit être ignorée (test 1.2.4).',
          remediationHint: 'Ajouter aria-hidden="true" (et focusable="false") sur le <svg>.',
        });
        return;
      }
      if (name) {
        out.error({
          id: '1.1', rule: 'svg-role-img', element: svg,
          message: 'SVG porteur d’une alternative sans role="img".',
          group: 'svg-role-img',
          confidence: 'medium',
          rationale: 'Le test 1.1.5 exige role="img" pour que l’alternative d’un SVG soit restituée.',
          remediationHint: 'Ajouter role="img" sur le <svg>, ou aria-hidden="true" s’il est décoratif.',
        });
        return;
      }
      svgUndetermined++;
      out.warn({
        id: '1.2', rule: 'svg-unknown', element: svg,
        message: 'SVG ni masqué ni pourvu d’alternative.',
        group: 'svg-unknown',
        rationale: 'Sans indication, un SVG peut être annoncé de façon confuse par les lecteurs d’écran.',
        remediationHint: 'Décoratif : aria-hidden="true". Informatif : role="img" et une alternative.',
      });
    });

    document.querySelectorAll('canvas').forEach((canvas) => {
      if (!isRendered(canvas) || isHiddenFromAT(canvas)) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 24 || rect.height < 24) return;
      if (accessibleName(canvas) || normalizedText(canvas.textContent)) return;
      out.warn({
        id: '1.1', rule: 'canvas-alternative', element: canvas,
        message: 'Canevas sans alternative ni contenu de repli.',
        group: 'canvas-alternative',
        remediationHint: 'Informatif : role="img" et aria-label, ou contenu alternatif. Décoratif : aria-hidden="true".',
      });
    });

    if (informative) {
      out.manual({
        id: '1.3', rule: 'img-alt-relevance',
        message: `${informative} image(s) avec alternative : pertinence à vérifier.`,
        rationale: 'La pertinence d’une alternative dépend du contexte éditorial.',
        remediationHint: 'Relire chaque alternative au regard de l’information portée par l’image.',
      });
    }
    if (decorative) {
      out.manual({
        id: '1.2', rule: 'img-decorative-review',
        message: `${decorative} image(s) traitée(s) comme décoratives : vérifier qu’elles n’informent pas.`,
        remediationHint: 'Une image décorative ne doit porter aucune information utile à la compréhension.',
      });
      out.pass({
        id: '1.2', rule: 'img-decorative-ok',
        message: `${decorative} image(s) décorative(s) correctement ignorée(s).`,
        manualReviewRecommended: true,
        confidence: 'medium',
      });
    }
    if (!imgs.length && !svgUndetermined && !document.querySelector('svg, [role="img"], input[type="image" i], area, canvas')) {
      out.na({ id: '1.1', rule: 'img-none', message: 'Aucune image détectée.' });
    } else if (informative) {
      out.pass({
        id: '1.1', rule: 'img-alt-present',
        message: `${informative} image(s) porteuse(s) d’une alternative textuelle.`,
        confidence: 'medium',
        manualReviewRecommended: true,
      });
    }
  }

  // ─────────────────────────────────────────────
  // Thème 2 — Cadres
  // ─────────────────────────────────────────────

  function auditFrames(out) {
    const frames = [...document.querySelectorAll('iframe, frame')].filter((f) => isRendered(f) && !isHiddenFromAT(f));
    if (!frames.length) {
      out.na({ id: '2.1', rule: 'frame-none', message: 'Aucun cadre (iframe) visible.' });
      return;
    }
    let titled = 0;
    frames.forEach((frame) => {
      const title = normalizedText(frame.getAttribute('title'));
      if (!title) {
        out.error({
          id: '2.1', rule: 'frame-title', element: frame,
          message: 'Cadre (iframe) sans attribut title.',
          rationale: 'Le titre permet d’identifier le contenu du cadre avant d’y entrer.',
          remediationHint: 'Ajouter un title décrivant le contenu du cadre (ex. « Vidéo : … »).',
        });
      } else {
        titled++;
      }
    });
    if (titled) {
      out.pass({ id: '2.1', rule: 'frame-title-ok', message: `${titled} cadre(s) titré(s).` });
      out.manual({
        id: '2.2', rule: 'frame-title-relevance',
        message: `${titled} titre(s) de cadre : pertinence à vérifier.`,
        remediationHint: 'Le titre doit décrire le contenu ou la fonction du cadre.',
      });
    }
  }

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

  // ─────────────────────────────────────────────
  // Thème 4 — Multimédia
  // ─────────────────────────────────────────────

  function auditMedia(out) {
    const videos = [...document.querySelectorAll('video')].filter(isRendered);
    const audios = [...document.querySelectorAll('audio')];
    const embeds = [...document.querySelectorAll('iframe')].filter((f) => (
      /youtube|youtu\.be|vimeo|dailymotion|twitch|peertube|soundcloud|spotify|podcast/i.test(f.src || f.getAttribute('data-src') || '')
    ));

    if (!videos.length && !audios.length && !embeds.length) {
      out.na({ id: '4.1', rule: 'media-none', message: 'Aucun média temporel détecté.' });
      return;
    }

    [...videos, ...audios].forEach((media) => {
      const autoplay = media.autoplay || media.hasAttribute('autoplay');
      const muted = media.muted || media.hasAttribute('muted');
      const controls = media.hasAttribute('controls');
      const isVideo = media.localName === 'video';

      if (autoplay && !muted) {
        const entry = {
          id: '4.10', rule: 'media-autoplay-sound', element: media,
          message: `${isVideo ? 'Vidéo' : 'Son'} lancé(e) automatiquement avec le son.`,
          rationale: 'Un son déclenché automatiquement gêne la lecture par synthèse vocale.',
          remediationHint: 'Ne pas lancer de son automatiquement, ou fournir un moyen immédiat de l’arrêter.',
        };
        if (controls) out.warn({ ...entry, message: `${entry.message} Des contrôles natifs sont présents : vérifier qu’ils sont atteignables avant le son.` });
        else out.error(entry);
      }

      if (isVideo && autoplay && muted && (media.loop || media.hasAttribute('loop')) && !controls) {
        out.warn({
          id: '13.8', rule: 'media-background-loop', element: media,
          message: 'Vidéo en lecture automatique et en boucle sans contrôle visible.',
          group: 'media-background-loop',
          remediationHint: 'Fournir un bouton pause ou arrêter la vidéo après 5 secondes.',
        });
        return;
      }

      if (!controls && !autoplay) {
        out.warn({
          id: '4.11', rule: 'media-controls', element: media,
          message: 'Média sans contrôles natifs : vérifier les contrôles personnalisés au clavier.',
          group: 'media-controls',
          remediationHint: 'Utiliser l’attribut controls ou des boutons accessibles au clavier.',
        });
      }

      if (isVideo) {
        const captions = media.querySelector('track[kind="captions"], track[kind="subtitles"]');
        if (!captions) {
          out.warn({
            id: '4.3', rule: 'video-captions', element: media,
            message: 'Vidéo sans piste de sous-titres (track kind="captions").',
            group: 'video-captions',
            rationale: 'Une vidéo comportant de la parole doit être sous-titrée ; une vidéo muette n’en a pas besoin.',
            remediationHint: 'Ajouter <track kind="captions" srclang="fr"> ou des sous-titres incrustés.',
          });
        } else {
          out.pass({
            id: '4.3', rule: 'video-captions-ok', element: media,
            message: 'Vidéo avec piste de sous-titres.',
            group: 'video-captions-ok',
            manualReviewRecommended: true, confidence: 'medium',
          });
        }
      }
    });

    if (embeds.length) {
      out.manual({
        id: '4.3', rule: 'media-embed-captions',
        message: `${embeds.length} média(s) embarqué(s) (YouTube, Vimeo…) : sous-titres à vérifier.`,
        remediationHint: 'Vérifier la présence de sous-titres relus (pas seulement automatiques).',
      });
    }
    out.manual({
      id: '4.1', rule: 'media-transcript',
      message: 'Transcription textuelle ou audiodescription : vérification manuelle.',
    });
    out.manual({
      id: '4.5', rule: 'media-audiodescription',
      message: 'Audiodescription synchronisée : vérification manuelle.',
    });
  }

  // ─────────────────────────────────────────────
  // Thème 5 — Tableaux
  // ─────────────────────────────────────────────

  function auditTables(out) {
    const tables = [...document.querySelectorAll('table, [role="table"], [role="grid"], [role="treegrid"]')]
      .filter((t) => isRendered(t) && !isHiddenFromAT(t));
    if (!tables.length) {
      out.na({ id: '5.6', rule: 'table-none', message: 'Aucun tableau.' });
      return;
    }

    tables.forEach((table) => {
      const role = explicitRole(table);
      const isNative = table.localName === 'table';
      if (!isNative) return;
      const rows = [...table.rows];
      const cols = Math.max(0, ...rows.map((r) => [...r.cells].reduce((n, c) => n + (c.colSpan || 1), 0)));
      const ths = [...table.querySelectorAll('th')].filter((th) => th.closest('table') === table);
      const dataMarkers = table.querySelector(':scope > caption, :scope > thead, th, [scope], [headers]') || table.hasAttribute('summary');

      if (role === 'presentation' || role === 'none') {
        if (dataMarkers) {
          out.error({
            id: '5.8', rule: 'layout-table-data-markup', element: table,
            message: 'Tableau de mise en forme utilisant des éléments de tableau de données (th, caption, thead, scope…).',
            remediationHint: 'Retirer ces éléments, ou retirer role="presentation" s’il s’agit d’un tableau de données.',
          });
        } else {
          out.manual({
            id: '5.3', rule: 'layout-table-linearization', element: table,
            message: 'Tableau de mise en forme : vérifier que le contenu linéarisé reste compréhensible.',
            group: 'layout-table-linearization',
          });
        }
        return;
      }

      if (!ths.length && !table.querySelector('[role="columnheader"], [role="rowheader"]')) {
        if (rows.length >= 2 && cols >= 2) {
          out.warn({
            id: '5.6', rule: 'table-no-headers', element: table,
            message: 'Tableau sans en-tête déclaré.',
            group: 'table-no-headers',
            rationale: 'Tableau de données : les en-têtes doivent être des <th>. Tableau de mise en page : role="presentation".',
            remediationHint: 'Déclarer les en-têtes en <th scope="col|row">, ou ajouter role="presentation".',
          });
        }
        return;
      }

      ths.forEach((th) => {
        const scope = normalizedText(th.getAttribute('scope')).toLowerCase();
        const thRole = explicitRole(th);
        if (!scope && !th.id && thRole !== 'columnheader' && thRole !== 'rowheader') {
          out.error({
            id: '5.7', rule: 'th-association', element: th,
            message: 'En-tête <th> sans attribut scope, id ou role.',
            group: 'th-association',
            rationale: 'Le test 5.7.1 exige scope, id ou role sur chaque en-tête.',
            remediationHint: 'Ajouter scope="col" (en-tête de colonne) ou scope="row" (en-tête de ligne).',
          });
        } else if (scope && !['row', 'col', 'rowgroup', 'colgroup'].includes(scope)) {
          out.error({
            id: '5.7', rule: 'th-scope-invalid', element: th,
            message: `Valeur de scope invalide : « ${scope} ».`,
            remediationHint: 'Utiliser scope="col" ou scope="row".',
          });
        }
      });

      table.querySelectorAll('[headers]').forEach((cell) => {
        const missing = idRefs(cell, 'headers').filter((id) => !getById(id));
        if (missing.length) {
          out.error({
            id: '5.7', rule: 'headers-missing-ids', element: cell,
            message: `Attribut headers référençant des id absents : ${missing.join(', ')}.`,
            group: 'headers-missing-ids',
            remediationHint: 'Faire correspondre headers aux id des cellules d’en-tête.',
          });
        }
      });

      const headerRows = rows.filter((r) => [...r.cells].every((c) => c.localName === 'th')).length;
      const hasRowHeaders = rows.some((r) => r.cells[0] && r.cells[0].localName === 'th' && [...r.cells].some((c) => c.localName === 'td'));
      const complex = headerRows > 1 || (headerRows >= 1 && hasRowHeaders && table.querySelector('th[colspan], th[rowspan]'));
      if (complex) {
        const caption = table.querySelector(':scope > caption');
        const describedBy = idRefs(table, 'aria-describedby').some((id) => getById(id));
        if (!describedBy && !(caption && caption.querySelector('*'))) {
          out.warn({
            id: '5.1', rule: 'complex-table-summary', element: table,
            message: 'Tableau complexe sans résumé détecté.',
            remediationHint: 'Ajouter un résumé (aria-describedby ou dans la caption) qui explique la structure.',
          });
        }
      }

      const name = accessibleName(table);
      if (name) {
        out.manual({
          id: '5.5', rule: 'table-title-relevance', element: table,
          message: `Titre de tableau « ${name.slice(0, 60)} » : pertinence à vérifier.`,
          group: 'table-title-relevance',
        });
      }
      out.pass({
        id: '5.6', rule: 'table-headers-ok', element: table,
        message: 'Tableau de données avec en-têtes déclarés.',
        group: 'table-headers-ok',
        manualReviewRecommended: true,
        confidence: 'medium',
      });
    });
  }

  // ─────────────────────────────────────────────
  // Thème 6 — Liens
  // ─────────────────────────────────────────────

  function auditLinks(out) {
    const links = [...document.querySelectorAll('a[href], area[href], [role="link"]')]
      .filter((l) => l.localName !== 'area' && isRendered(l) && !isHiddenFromAT(l));

    if (!links.length) {
      out.na({ id: '6.2', rule: 'link-none', message: 'Aucun lien.' });
      return;
    }

    const genericByLabel = new Map();
    let named = 0;

    links.forEach((link) => {
      const name = accessibleName(link);
      if (!name) {
        out.error({
          id: '6.2', rule: 'link-name', element: link,
          message: link.querySelector('img, svg') ? 'Lien image ou icône sans intitulé.' : 'Lien sans intitulé.',
          group: link.querySelector('img, svg') ? 'link-name-image' : 'link-name',
          rationale: 'Un lien sans intitulé est annoncé « lien » sans indication de destination.',
          remediationHint: 'Ajouter un texte (éventuellement masqué), un alt sur l’image ou un aria-label.',
        });
        return;
      }
      named++;

      const visible = visibleLabelOf(link);
      const usesAria = link.hasAttribute('aria-label') || link.hasAttribute('aria-labelledby');
      if (usesAria && nameIncludesVisibleLabel(name, visible) === false) {
        (isShortVisibleLabel(visible) ? out.error : out.warn)({
          id: '6.1', rule: 'link-label-in-name', element: link,
          message: `Le nom accessible « ${name.slice(0, 60)} » ne contient pas l’intitulé visible « ${visible.slice(0, 40)} ».`,
          group: isShortVisibleLabel(visible) ? 'link-label-in-name' : 'link-label-in-name-long',
          rationale: 'Test 6.1.5 : la commande vocale utilise le texte visible ; il doit figurer dans le nom.',
          remediationHint: 'Faire commencer l’aria-label par le texte visible, ou supprimer l’aria-label.',
        });
      }

      const key = comparableText(name);
      if (GENERIC_LINK_LABELS.has(key)) {
        out.warn({
          id: '6.1', rule: 'link-generic', element: link,
          message: `Intitulé de lien peu explicite : « ${name} ».`,
          group: `link-generic-${key}`,
          rationale: 'Un intitulé générique n’est conforme que si le contexte du lien le rend explicite.',
          remediationHint: 'Compléter l’intitulé (texte masqué, aria-label reprenant le texte visible) ou s’appuyer sur le contexte.',
        });
        if (!genericByLabel.has(key)) genericByLabel.set(key, new Set());
        genericByLabel.get(key).add(link.getAttribute('href'));
      }
    });

    genericByLabel.forEach((hrefs, label) => {
      if (hrefs.size > 1) {
        out.warn({
          id: '6.1', rule: 'link-generic-ambiguous',
          message: `Même intitulé « ${label} » pour ${hrefs.size} destinations différentes.`,
          confidence: 'medium',
          remediationHint: 'Différencier les intitulés pour qu’ils restent compréhensibles hors contexte.',
        });
      }
    });

    if (named) {
      out.pass({
        id: '6.2', rule: 'link-name-ok',
        message: `${named} lien(s) pourvu(s) d’un intitulé.`,
        confidence: 'high',
      });
      out.manual({
        id: '6.1', rule: 'link-explicit-review',
        message: `${named} lien(s) : vérifier que chaque intitulé, avec son contexte, est explicite.`,
      });
    }
  }

  // ─────────────────────────────────────────────
  // Thème 7 — Scripts
  // ─────────────────────────────────────────────

  function closestRole(el, roles) {
    let node = el.parentElement;
    while (node) {
      const role = roleOf(node);
      if (role && roles.includes(role)) return node;
      if (node.localName === 'ul' || node.localName === 'ol' || node.localName === 'menu') {
        if (roles.includes('list')) return node;
      }
      if (node.localName === 'select' && roles.includes('listbox')) return node;
      if (node.localName === 'table' && roles.includes('table')) return node;
      if (node.localName === 'tr' && roles.includes('row')) return node;
      if (['thead', 'tbody', 'tfoot'].includes(node.localName) && roles.includes('rowgroup')) return node;
      node = node.parentElement;
    }
    return null;
  }

  function ownedByRole(container, roles) {
    const owned = idRefs(container, 'aria-owns').map(getById).filter(Boolean);
    const candidates = [...container.querySelectorAll('[role]'), ...owned];
    if (roles.includes('listitem') && container.querySelector('li')) return true;
    if (roles.includes('option') && container.querySelector('option')) return true;
    if (roles.includes('radio') && container.querySelector('input[type="radio"]')) return true;
    return candidates.some((c) => roles.includes(explicitRole(c)));
  }

  function auditAria(out) {
    let ariaElements = 0;

    document.querySelectorAll('[role]').forEach((el) => {
      if (!isRendered(el)) return;
      ariaElements++;
      const raw = normalizedText(el.getAttribute('role')).toLowerCase();
      if (!raw) return;
      const role = explicitRole(el);
      if (!role) {
        const abstract = raw.split(' ').find((t) => ABSTRACT_ROLES.has(t));
        out.error({
          id: '7.1', rule: 'aria-role-invalid', element: el,
          message: abstract
            ? `Rôle ARIA abstrait, interdit dans le code : role="${raw}".`
            : `Rôle ARIA inexistant : role="${raw}".`,
          group: `aria-role-invalid-${raw}`,
          rationale: 'Un rôle inconnu est ignoré : le composant perd la sémantique attendue.',
          remediationHint: 'Utiliser un rôle ARIA 1.2 valide, ou de préférence un élément HTML natif.',
        });
        return;
      }

      const context = REQUIRED_CONTEXT[role];
      if (context && !isHiddenFromAT(el) && !closestRole(el, context)) {
        const ownedBy = el.id && document.querySelector(`[aria-owns~="${cssEscape(el.id)}"]`);
        if (!ownedBy) {
          out.error({
            id: '7.1', rule: 'aria-required-context', element: el,
            message: `role="${role}" hors de son conteneur requis (${context.join(' ou ')}).`,
            group: `aria-required-context-${role}`,
            confidence: 'medium',
            rationale: 'Ce rôle n’a de sens qu’à l’intérieur de son conteneur ; isolé, il est mal restitué.',
            remediationHint: `Placer l’élément dans un conteneur role="${context[0]}", ou utiliser une autre sémantique.`,
          });
        }
      }

      const owned = REQUIRED_OWNED[role];
      if (owned && !isHiddenFromAT(el) && el.getAttribute('aria-busy') !== 'true' && !ownedByRole(el, owned)) {
        out.error({
          id: '7.1', rule: 'aria-required-owned', element: el,
          message: `role="${role}" ne contient aucun élément ${owned.map((r) => `role="${r}"`).join(' / ')}.`,
          group: `aria-required-owned-${role}`,
          confidence: 'medium',
          rationale: 'Un conteneur ARIA vide de ses éléments attendus est restitué de façon incohérente.',
          remediationHint: role === 'tablist'
            ? 'Compléter le motif onglets (tab + tabpanel), ou utiliser role="group" avec aria-current pour un simple filtre.'
            : 'Ajouter les éléments enfants attendus ou retirer le rôle.',
        });
      }

      const required = REQUIRED_STATES[role];
      if (required && !(required.native && el.matches(required.native))) {
        const missing = required.attrs.filter((a) => !el.hasAttribute(a));
        if (missing.length) {
          out.error({
            id: role === 'heading' ? '9.1' : '7.1', rule: 'aria-required-state', element: el,
            message: `role="${role}" sans ${missing.join(', ')}.`,
            group: `aria-required-state-${role}`,
            rationale: role === 'heading'
              ? 'Le test 9.1.1 exige aria-level avec role="heading".'
              : 'Sans cet état, le lecteur d’écran ne peut pas annoncer la valeur du composant.',
            remediationHint: `Ajouter ${missing.join(', ')} et le maintenir à jour par script.`,
          });
        }
      }

      if (INTERACTIVE_ROLES.has(role) && !el.matches(NATIVE_INTERACTIVE_SELECTOR) && !el.hasAttribute('tabindex')
        && !isHiddenFromAT(el) && el.getAttribute('aria-disabled') !== 'true') {
        const managedByParent = el.closest('[aria-activedescendant]') || ['option', 'treeitem', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'tab'].includes(role);
        const report = managedByParent ? out.warn : out.error;
        report({
          id: '7.3', rule: 'aria-widget-not-focusable', element: el,
          message: `Composant role="${role}" non atteignable au clavier (tabindex absent).`,
          group: `aria-widget-not-focusable-${role}`,
          confidence: managedByParent ? 'low' : 'high',
          rationale: 'Un composant interactif doit pouvoir recevoir le focus clavier.',
          remediationHint: managedByParent
            ? 'Vérifier la gestion du focus (tabindex mobile ou aria-activedescendant).'
            : `Utiliser l’élément natif ou ajouter tabindex="0" et la gestion des touches Entrée/Espace.`,
        });
      }
    });

    const all = document.querySelectorAll('*');
    for (const el of all) {
      if (!el.attributes || !el.attributes.length) continue;
      for (const attr of el.attributes) {
        const name = attr.name;
        if (!name.startsWith('aria-')) continue;
        ariaElements++;
        if (!ARIA_ATTRIBUTES.has(name)) {
          out.error({
            id: '7.1', rule: 'aria-attr-unknown', element: el,
            message: `Attribut ARIA inexistant : ${name}.`,
            group: `aria-attr-unknown-${name}`,
            rationale: 'Un attribut mal orthographié est ignoré (ex. aria-labeledby au lieu de aria-labelledby).',
            remediationHint: 'Corriger le nom de l’attribut.',
          });
          continue;
        }
        const allowed = ARIA_TOKEN_VALUES[name];
        const value = normalizedText(attr.value).toLowerCase();
        if (allowed && value && !allowed.includes(value)) {
          out.error({
            id: '7.1', rule: 'aria-attr-value', element: el,
            message: `Valeur invalide ${name}="${attr.value}" (attendu : ${allowed.join(', ')}).`,
            group: `aria-attr-value-${name}`,
          });
        }
        if (ARIA_IDREF_ATTRIBUTES.includes(name) && value) {
          const missing = idRefs(el, name).filter((id) => !getById(id));
          if (missing.length) {
            const lazyPanel = name === 'aria-controls' && el.getAttribute('aria-expanded') === 'false';
            const report = lazyPanel ? out.warn : out.error;
            report({
              id: name === 'aria-labelledby' && el.matches('input, select, textarea') ? '11.1' : '7.1',
              rule: 'aria-idref-missing', element: el,
              message: `${name} référence un id absent de la page : ${missing.join(', ')}.`,
              group: `aria-idref-missing-${name}`,
              confidence: lazyPanel ? 'low' : 'high',
              rationale: lazyPanel
                ? 'Le panneau contrôlé n’est peut-être rendu qu’à l’ouverture.'
                : 'La relation est rompue : le nom, la description ou le contrôle annoncé n’existe pas.',
              remediationHint: 'Faire correspondre la référence à l’id d’un élément présent dans le DOM.',
            });
          }
        }
      }
    }

    document.querySelectorAll('[onclick]').forEach((el) => {
      if (el.matches(NATIVE_INTERACTIVE_SELECTOR) || el.matches('label, body, html, option')) return;
      if (!isRendered(el) || isHiddenFromAT(el)) return;
      if (explicitRole(el) && INTERACTIVE_ROLES.has(explicitRole(el))) return;
      const focusable = el.hasAttribute('tabindex') && parseInt(el.getAttribute('tabindex'), 10) >= 0;
      if (!focusable) {
        out.error({
          id: '7.3', rule: 'onclick-not-focusable', element: el,
          message: `Élément <${el.localName}> cliquable (onclick) non atteignable au clavier.`,
          group: 'onclick-not-focusable',
          remediationHint: 'Utiliser un <button> ou un lien natif.',
        });
      } else {
        out.error({
          id: '7.1', rule: 'onclick-no-role', element: el,
          message: `Élément <${el.localName}> cliquable sans rôle (button, link…).`,
          group: 'onclick-no-role',
          remediationHint: 'Utiliser un <button>, ou ajouter role="button" et la gestion clavier.',
        });
      }
    });

    out.manual({
      id: '7.5', rule: 'status-messages',
      message: 'Messages de statut (confirmations, erreurs, chargements) : restitution à vérifier.',
      remediationHint: 'Utiliser role="status", role="alert" ou aria-live selon l’urgence du message.',
    });

    if (ariaElements === 0) {
      out.na({ id: '7.1', rule: 'aria-none', message: 'Aucun attribut ou rôle ARIA détecté.' });
    }
  }

  // ─────────────────────────────────────────────
  // Thème 8 — Éléments obligatoires
  // ─────────────────────────────────────────────

  function auditMandatory(out) {
    if (!document.doctype) {
      out.error({
        id: '8.1', rule: 'doctype', message: 'Type de document (DOCTYPE) absent.',
        remediationHint: 'Déclarer <!DOCTYPE html> en première ligne.',
      });
    } else {
      out.pass({ id: '8.1', rule: 'doctype-ok', message: `Type de document déclaré : ${document.doctype.name}.` });
    }

    const ids = new Map();
    document.querySelectorAll('[id]').forEach((el) => {
      const id = el.id;
      if (!id) return;
      if (!ids.has(id)) ids.set(id, []);
      ids.get(id).push(el);
    });
    const duplicates = [...ids.entries()].filter(([, els]) => els.length > 1);
    duplicates.forEach(([id, els]) => {
      const referenced = document.querySelector(
        `[for="${cssEscape(id)}"], [aria-labelledby~="${cssEscape(id)}"], [aria-describedby~="${cssEscape(id)}"], [aria-controls~="${cssEscape(id)}"], [headers~="${cssEscape(id)}"], a[href="#${cssEscape(id)}"]`,
      );
      out.error({
        id: '8.2', rule: 'duplicate-id', element: els[1],
        message: `id="${id}" utilisé ${els.length} fois${referenced ? ' (et référencé : relation ambiguë)' : ''}.`,
        group: `duplicate-id-${id}`,
        severity: referenced ? 'high' : 'medium',
        rationale: 'Les id doivent être uniques (test 8.2.1) ; un doublon référencé casse les associations.',
        remediationHint: 'Rendre chaque id unique dans la page.',
      });
    });
    if (!duplicates.length) {
      out.pass({ id: '8.2', rule: 'duplicate-id-ok', message: 'Aucun id en double.', manualReviewRecommended: true, confidence: 'medium',
        remediationHint: 'La validité complète du code (imbrication, attributs) se vérifie avec le validateur W3C.' });
    }

    const html = document.documentElement;
    const lang = normalizedText(html.getAttribute('lang') || html.getAttribute('xml:lang'));
    if (!lang) {
      out.error({
        id: '8.3', rule: 'html-lang', message: 'Langue par défaut absente (attribut lang sur <html>).',
        remediationHint: 'Ajouter lang="fr" sur la balise <html>.',
      });
    } else if (!isValidLangCode(lang)) {
      out.error({
        id: '8.4', rule: 'html-lang-valid', message: `Code de langue invalide sur <html> : « ${lang} ».`,
        remediationHint: 'Utiliser un code ISO 639 valide (fr, en, fr-FR…).',
      });
    } else {
      out.pass({ id: '8.3', rule: 'html-lang-ok', message: `Langue par défaut déclarée : « ${lang} ».` });
      out.manual({
        id: '8.4', rule: 'html-lang-relevance',
        message: `Langue « ${lang} » : vérifier qu’elle correspond à la langue principale du contenu.`,
      });
    }

    document.querySelectorAll('body [lang]').forEach((el) => {
      const value = normalizedText(el.getAttribute('lang'));
      if (value && !isValidLangCode(value)) {
        out.error({
          id: '8.8', rule: 'element-lang-valid', element: el,
          message: `Code de langue invalide : lang="${value}".`,
          group: `element-lang-valid-${value}`,
          remediationHint: 'Utiliser un code ISO 639 valide.',
        });
      }
    });

    const title = normalizedText(document.title);
    if (!title) {
      out.error({
        id: '8.5', rule: 'page-title', message: 'Page sans titre (<title> absent ou vide).',
        remediationHint: 'Ajouter un <title> unique décrivant la page et le site.',
      });
    } else {
      out.pass({ id: '8.5', rule: 'page-title-ok', message: `Titre de page : « ${title.slice(0, 90)} ».` });
      out.manual({
        id: '8.6', rule: 'page-title-relevance',
        message: `Titre « ${title.slice(0, 90)} » : vérifier qu’il identifie la page et son contenu.`,
      });
    }

    const emptyParagraphs = [...document.querySelectorAll('p')]
      .filter((p) => isRendered(p) && !normalizedText(p.textContent) && !p.querySelector('img, svg, video, iframe, input, button, canvas, picture, object'));
    if (emptyParagraphs.length >= 2) {
      emptyParagraphs.forEach((p) => out.warn({
        id: '8.9', rule: 'empty-paragraph', element: p,
        message: 'Paragraphe vide utilisé pour créer de l’espace.',
        group: 'empty-paragraph',
        confidence: 'medium',
        remediationHint: 'Gérer les espacements en CSS (margin, padding).',
      }));
    }
  }

  // ─────────────────────────────────────────────
  // Thème 9 — Structuration
  // ─────────────────────────────────────────────

  function auditStructure(out) {
    const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')]
      .filter((h) => !isHiddenFromAT(h))
      .map((h) => {
        const explicit = explicitRole(h);
        if (explicit && explicit !== 'heading') return null;
        const level = explicit === 'heading'
          ? parseInt(h.getAttribute('aria-level'), 10) || 2
          : parseInt(h.localName.slice(1), 10);
        return { el: h, level };
      })
      .filter(Boolean);

    if (!headings.length) {
      out.warn({
        id: '9.1', rule: 'headings-none',
        message: 'Aucun titre (h1-h6) dans la page.',
        confidence: 'medium',
        remediationHint: 'Structurer le contenu avec des titres hiérarchisés.',
      });
    } else {
      if (!headings.some((h) => h.level === 1)) {
        out.warn({
          id: '9.1', rule: 'heading-h1-missing',
          message: 'Aucun titre de niveau 1.',
          confidence: 'medium',
          remediationHint: 'Ajouter un h1 qui résume le contenu principal de la page.',
        });
      }
      let previous = 0;
      let jumps = 0;
      headings.forEach(({ el, level }) => {
        if (!accessibleName(el)) {
          out.error({
            id: '9.1', rule: 'heading-empty', element: el,
            message: `Titre h${level} vide.`,
            group: 'heading-empty',
            remediationHint: 'Supprimer le titre vide ou lui donner un contenu.',
          });
        }
        if (previous && level > previous + 1) {
          jumps++;
          out.warn({
            id: '9.1', rule: 'heading-jump', element: el,
            message: `Saut de niveau de titre h${previous} → h${level}.`,
            group: `heading-jump-${previous}-${level}`,
            confidence: 'medium',
            rationale: 'Un niveau sauté rend la hiérarchie moins lisible pour la navigation par titres.',
            remediationHint: 'Vérifier que la hiérarchie reflète l’organisation du contenu.',
          });
        }
        previous = level;
      });
      if (!jumps) {
        out.pass({
          id: '9.1', rule: 'heading-hierarchy-ok',
          message: `${headings.length} titre(s) sans saut de niveau.`,
          confidence: 'medium', manualReviewRecommended: true,
          remediationHint: 'Vérifier que tout passage qui a l’apparence d’un titre est balisé comme tel (9.1.3).',
        });
      }
    }

    const mains = [...document.querySelectorAll('main')].filter(isRendered);
    if (!mains.length) {
      const roleMain = document.querySelector('[role="main"]');
      const entry = {
        id: '9.2', rule: 'main-missing',
        message: roleMain ? 'Contenu principal balisé par role="main" au lieu de <main>.' : 'Aucune zone <main> visible.',
        rationale: 'Le test 9.2.1 demande une balise <main> visible unique pour le contenu principal.',
        remediationHint: 'Encadrer le contenu principal par une balise <main>.',
      };
      if (roleMain) out.warn(entry);
      else out.error(entry);
    } else if (mains.length > 1) {
      out.error({
        id: '9.2', rule: 'main-multiple', element: mains[1],
        message: `${mains.length} balises <main> visibles.`,
        remediationHint: 'Ne garder qu’une seule balise <main> visible.',
      });
    } else {
      out.pass({ id: '9.2', rule: 'main-ok', message: 'Zone <main> visible unique.' });
    }
    if (!document.querySelector('header, [role="banner"]')) {
      out.warn({ id: '9.2', rule: 'header-missing', message: 'Aucune zone d’en-tête <header>.', confidence: 'low',
        remediationHint: 'Si la page a un en-tête, le baliser avec <header>.' });
    }
    if (!document.querySelector('footer, [role="contentinfo"]')) {
      out.warn({ id: '9.2', rule: 'footer-missing', message: 'Aucune zone de pied de page <footer>.', confidence: 'low',
        remediationHint: 'Si la page a un pied de page, le baliser avec <footer>.' });
    }
    if (!document.querySelector('nav, [role="navigation"]') && document.querySelectorAll('a[href]').length >= 5) {
      out.warn({ id: '9.2', rule: 'nav-missing', message: 'Aucune zone de navigation <nav>.', confidence: 'low',
        remediationHint: 'Baliser les menus principaux et secondaires avec <nav>.' });
    }

    const LIST_CHILD_OK = new Set(['li', 'script', 'template']);
    document.querySelectorAll('ul, ol').forEach((list) => {
      if (explicitRole(list) && !['list'].includes(explicitRole(list))) return;
      const bad = [...list.children].find((c) => !LIST_CHILD_OK.has(c.localName) && explicitRole(c) !== 'listitem');
      if (bad) {
        out.error({
          id: '9.3', rule: 'list-children', element: list,
          message: `Liste <${list.localName}> contenant un enfant <${bad.localName}> au lieu de <li>.`,
          group: 'list-children',
          remediationHint: 'Seuls des <li> peuvent être enfants directs d’une liste.',
        });
      }
    });
    document.querySelectorAll('li').forEach((li) => {
      const parent = li.parentElement;
      if (!parent || ['ul', 'ol', 'menu'].includes(parent.localName)) return;
      if (explicitRole(li) || explicitRole(parent) === 'list') return;
      out.error({
        id: '9.3', rule: 'li-orphan', element: li,
        message: '<li> en dehors d’une liste <ul> ou <ol>.',
        group: 'li-orphan',
        remediationHint: 'Placer les <li> dans une balise <ul> ou <ol>.',
      });
    });
    document.querySelectorAll('dl').forEach((dl) => {
      const bad = [...dl.children].find((c) => !['dt', 'dd', 'div', 'script', 'template'].includes(c.localName));
      if (bad) {
        out.error({
          id: '9.3', rule: 'dl-children', element: dl,
          message: `Liste de définitions contenant un enfant <${bad.localName}>.`,
          group: 'dl-children',
          remediationHint: 'Une <dl> ne contient que des <dt>/<dd> (éventuellement regroupés dans des <div>).',
        });
      }
    });

    const bullet = /^\s*([-•*·▪▸►→✓✔]|\d+[.)])\s+/;
    let fakeRun = [];
    const flushFake = () => {
      if (fakeRun.length >= 2) {
        out.warn({
          id: '9.3', rule: 'fake-list', element: fakeRun[0],
          message: 'Paragraphes successifs simulant une liste.',
          group: 'fake-list',
          remediationHint: 'Utiliser <ul>/<ol> et <li>.',
        });
      }
      fakeRun = [];
    };
    document.querySelectorAll('p').forEach((p) => {
      if (!bullet.test(p.textContent || '')) {
        flushFake();
        return;
      }
      const previous = fakeRun[fakeRun.length - 1];
      if (previous && previous.nextElementSibling !== p) flushFake();
      fakeRun.push(p);
    });
    flushFake();
  }

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

  // ─────────────────────────────────────────────
  // Thème 11 — Formulaires
  // ─────────────────────────────────────────────

  const FIELD_SELECTOR = [
    'input:not([type="hidden" i]):not([type="submit" i]):not([type="button" i]):not([type="reset" i]):not([type="image" i])',
    'select', 'textarea',
    '[role="textbox"]', '[role="combobox"]', '[role="listbox"]', '[role="searchbox"]', '[role="spinbutton"]',
    '[role="slider"]', '[role="checkbox"]', '[role="radio"]', '[role="switch"]',
  ].join(',');

  function fieldLabelling(field) {
    const labelledBy = idRefs(field, 'aria-labelledby');
    const labelledByText = normalizedText(labelledBy.map(getById).filter(Boolean)
      .map((ref) => accessibleName(ref, new Set(), { traversing: true, includeHidden: true })).join(' '));
    const ariaLabel = normalizedText(field.getAttribute('aria-label'));
    const explicitLabels = field.id
      ? [...document.querySelectorAll(`label[for="${cssEscape(field.id)}"]`)]
      : [];
    const explicitText = normalizedText(explicitLabels.map((l) => nameFromContent(l, new Set([field]), true)).join(' '));
    const wrapping = field.closest('label');
    const wrappingText = wrapping && !explicitLabels.includes(wrapping) ? nameFromContent(wrapping, new Set([field]), true) : '';
    const title = normalizedText(field.getAttribute('title'));
    const placeholder = normalizedText(field.getAttribute('placeholder'));
    return { labelledBy, labelledByText, ariaLabel, explicitLabels, explicitText, wrapping, wrappingText, title, placeholder };
  }

  function auditForms(out) {
    const fields = [...document.querySelectorAll(FIELD_SELECTOR)]
      .filter((f) => isRendered(f) && !isHiddenFromAT(f));

    document.querySelectorAll('label[for]').forEach((label) => {
      const target = normalizedText(label.getAttribute('for'));
      if (!target) return;
      const el = getById(target);
      if (!el) {
        out.error({
          id: '11.1', rule: 'label-for-missing', element: label,
          message: `Étiquette for="${target}" ne correspondant à aucun champ.`,
          group: 'label-for-missing',
          rationale: 'Test 11.1.2 : la valeur de for doit être l’id du champ associé.',
          remediationHint: 'Donner au champ l’id référencé par l’étiquette.',
        });
      } else if (!el.matches('input, select, textarea, button, meter, output, progress')) {
        out.error({
          id: '11.1', rule: 'label-for-not-labelable', element: label,
          message: `Étiquette for="${target}" pointant vers un élément non étiquetable (<${el.localName}>).`,
          group: 'label-for-not-labelable',
          remediationHint: 'Pour un composant personnalisé, utiliser aria-labelledby.',
        });
      }
    });

    if (!fields.length) {
      out.na({ id: '11.1', rule: 'form-none', message: 'Aucun champ de formulaire.' });
    }

    let labelled = 0;
    fields.forEach((field) => {
      const l = fieldLabelling(field);
      const isNative = field.matches('input, select, textarea');
      const hasRgaaLabel = Boolean(l.labelledByText || l.ariaLabel || l.explicitText || l.title
        || (!isNative && accessibleName(field)));

      if (!hasRgaaLabel) {
        if (l.wrappingText) {
          out.warn({
            id: '11.1', rule: 'label-implicit', element: field,
            message: 'Étiquette implicite (champ placé dans <label>) sans attribut for/id.',
            group: 'label-implicit',
            confidence: 'medium',
            rationale: 'Le test 11.1.1 retient label avec for, aria-label, aria-labelledby ou title ; la forme implicite est mal prise en charge par certaines aides techniques.',
            remediationHint: 'Ajouter un id au champ et l’attribut for correspondant sur le <label>.',
          });
        } else {
          out.error({
            id: '11.1', rule: 'field-label', element: field,
            message: l.placeholder
              ? `Champ dont le seul libellé est le placeholder « ${l.placeholder.slice(0, 40)} ».`
              : `Champ <${field.localName}${field.getAttribute('type') ? ` type="${field.getAttribute('type')}"` : ''}> sans étiquette.`,
            group: l.placeholder ? 'field-label-placeholder' : 'field-label',
            rationale: 'Un placeholder disparaît à la saisie et n’est pas une étiquette au sens du RGAA.',
            remediationHint: 'Associer un <label for="id"> visible au champ.',
          });
        }
        return;
      }
      labelled++;

      const visibleLabel = l.explicitLabels.length ? visibleText(l.explicitLabels[0]) : (l.wrapping ? visibleText(l.wrapping) : '');
      const name = accessibleName(field);
      if (visibleLabel && (l.ariaLabel || l.labelledBy.length) && nameIncludesVisibleLabel(name, visibleLabel) === false) {
        (isShortVisibleLabel(visibleLabel) ? out.error : out.warn)({
          id: '11.2', rule: 'field-label-in-name', element: field,
          message: `Le nom accessible « ${name.slice(0, 50)} » ne contient pas l’étiquette visible « ${visibleLabel.slice(0, 40)} ».`,
          group: 'field-label-in-name',
          rationale: 'Test 11.2.5 : le nom accessible doit contenir au moins l’intitulé visible.',
          remediationHint: 'Supprimer l’aria-label superflu ou y reprendre le texte visible.',
        });
      }

      const required = field.hasAttribute('required') || field.getAttribute('aria-required') === 'true';
      if (required && isNative) {
        const labelText = `${visibleLabel} ${l.labelledByText} ${l.ariaLabel}`.toLowerCase();
        const form = field.closest('form');
        const allRequired = form && /tous les champs (sont )?(obligatoires|requis)|all fields are required/i.test(visibleText(form));
        if (!/\*|obligatoire|requis|required/.test(labelText) && !allRequired) {
          out.warn({
            id: '11.10', rule: 'required-indication', element: field,
            message: 'Champ obligatoire sans indication visible dans son étiquette.',
            group: 'required-indication',
            confidence: 'medium',
            rationale: 'Le caractère obligatoire doit être signalé visuellement avant la soumission.',
            remediationHint: 'Ajouter « (obligatoire) » ou un astérisque expliqué en début de formulaire.',
          });
        }
      }

      if (field.getAttribute('aria-invalid') === 'true') {
        const described = idRefs(field, 'aria-describedby').concat(idRefs(field, 'aria-errormessage')).some((id) => getById(id));
        if (!described) {
          out.warn({
            id: '11.10', rule: 'error-association', element: field,
            message: 'Champ en erreur (aria-invalid) sans message associé.',
            group: 'error-association',
            remediationHint: 'Associer le message d’erreur via aria-describedby.',
          });
        }
      }

      const autocomplete = field.getAttribute('autocomplete');
      if (autocomplete !== null && normalizedText(autocomplete) && !isValidAutocomplete(autocomplete)) {
        out.error({
          id: '11.13', rule: 'autocomplete-invalid', element: field,
          message: `Valeur autocomplete invalide : « ${autocomplete} ».`,
          group: `autocomplete-invalid-${autocomplete}`,
          remediationHint: 'Utiliser une valeur de la liste HTML (name, given-name, email, tel, postal-code…).',
        });
      } else if (isNative && field.localName !== 'select') {
        const identity = comparableText(`${field.name} ${field.id} ${field.type} ${name}`);
        const hint = PERSONAL_FIELD_HINTS.find((h) => h.re.test(identity));
        const type = (field.getAttribute('type') || '').toLowerCase();
        if (hint && !['search', 'checkbox', 'radio', 'password'].includes(type)
          && (autocomplete === null || /^(on|off)$/i.test(normalizedText(autocomplete)))) {
          out.warn({
            id: '11.13', rule: 'autocomplete-missing', element: field,
            message: `Champ de donnée personnelle probable sans autocomplete adapté (suggestion : ${hint.token}).`,
            group: `autocomplete-missing-${hint.token}`,
            confidence: 'low',
            rationale: 'Si le champ concerne l’utilisateur lui-même, autocomplete est exigé (11.13.1).',
            remediationHint: `Ajouter autocomplete="${hint.token}" si le champ porte sur l’utilisateur.`,
          });
        }
      }
    });

    if (labelled) {
      out.pass({ id: '11.1', rule: 'field-label-ok', message: `${labelled} champ(s) étiqueté(s).` });
      out.manual({ id: '11.2', rule: 'field-label-relevance', message: `${labelled} étiquette(s) : pertinence à vérifier.` });
    }

    const groups = new Map();
    document.querySelectorAll('input[type="radio" i], input[type="checkbox" i]').forEach((input) => {
      if (!isRendered(input) && !isRendered(input.closest('label') || input)) return;
      const name = normalizedText(input.getAttribute('name'));
      if (!name) return;
      const key = `${input.type}|${name}|${input.form ? [...document.forms].indexOf(input.form) : -1}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(input);
    });
    groups.forEach((inputs) => {
      if (inputs.length < 2) return;
      const container = inputs[0].closest('fieldset, [role="group"], [role="radiogroup"]');
      const allInside = container && inputs.every((i) => container.contains(i));
      if (!allInside) {
        out.error({
          id: '11.5', rule: 'choice-group', element: inputs[0],
          message: `Groupe de ${inputs.length} ${inputs[0].type === 'radio' ? 'boutons radio' : 'cases à cocher'} (name="${inputs[0].name}") non regroupé.`,
          group: 'choice-group',
          confidence: 'medium',
          remediationHint: 'Regrouper les options dans un <fieldset> avec une <legend>.',
        });
        return;
      }
      const legend = container.localName === 'fieldset'
        ? normalizedText(container.querySelector(':scope > legend')?.textContent)
        : accessibleName(container);
      if (!legend) {
        out.error({
          id: '11.6', rule: 'choice-group-legend', element: container,
          message: 'Regroupement de champs sans légende.',
          group: 'choice-group-legend',
          remediationHint: 'Ajouter une <legend> (ou aria-labelledby sur le role="group").',
        });
      }
    });

    let buttons = 0;
    [...document.querySelectorAll('button, input[type="submit" i], input[type="button" i], input[type="reset" i], [role="button"]')]
      .filter((b) => isRendered(b) && !isHiddenFromAT(b))
      .forEach((button) => {
        buttons++;
        const name = accessibleName(button);
        if (!name) {
          out.error({
            id: '11.9', rule: 'button-name', element: button,
            message: button.querySelector('svg, img, i, [class*="icon"]') ? 'Bouton icône sans intitulé.' : 'Bouton sans intitulé.',
            group: 'button-name',
            rationale: 'Un bouton sans intitulé est annoncé « bouton » sans indication de son action.',
            remediationHint: 'Ajouter un texte (éventuellement masqué) ou un aria-label décrivant l’action.',
          });
          return;
        }
        const visible = button.localName === 'input' ? normalizedText(button.value) : visibleLabelOf(button);
        if ((button.hasAttribute('aria-label') || button.hasAttribute('aria-labelledby'))
          && nameIncludesVisibleLabel(name, visible) === false) {
          (isShortVisibleLabel(visible) ? out.error : out.warn)({
            id: '11.9', rule: 'button-label-in-name', element: button,
            message: `Le nom accessible « ${name.slice(0, 50)} » ne contient pas l’intitulé visible « ${visible.slice(0, 40)} ».`,
            group: isShortVisibleLabel(visible) ? 'button-label-in-name' : 'button-label-in-name-long',
            rationale: 'Test 11.9.2 : le nom accessible doit contenir au moins l’intitulé visible.',
            remediationHint: 'Reprendre le texte visible au début de l’aria-label, ou supprimer l’aria-label.',
          });
        }
      });
    if (buttons) {
      out.manual({ id: '11.9', rule: 'button-name-relevance', message: `${buttons} bouton(s) : pertinence des intitulés à vérifier.` });
    }
  }

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
})(typeof globalThis !== 'undefined' ? globalThis : this);
