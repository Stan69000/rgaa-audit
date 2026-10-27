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
