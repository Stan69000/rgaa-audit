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

function textPoint(textNode) {
  const range = document.createRange();
  range.selectNodeContents(textNode);
  const rect = [...range.getClientRects()].find((r) => r.width > 0 && r.height > 0);
  range.detach();
  if (!rect) return null;
  const x = rect.left + Math.min(rect.width / 2, 8);
  const y = rect.top + rect.height / 2;
  if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return null;
  return { x, y };
}

const SKIPPED_TEXT_PARENTS = new Set([
  'script', 'style', 'noscript', 'template', 'option', 'title', 'textarea', 'svg', 'math',
]);
