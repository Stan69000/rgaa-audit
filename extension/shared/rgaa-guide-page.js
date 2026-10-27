/**
 * Aides visuelles du guide manuel, exécutées dans la page auditée.
 *
 * Dépend de `globalThis.RgaaRules` (shared/rgaa-rules.js, injecté avant). Expose
 * `globalThis.RgaaGuidePage` : inventaire des éléments à juger, surimpressions
 * (alternatives, titres, zones, liens, ordre de tabulation, niveaux de gris) et mise en
 * évidence d'un élément. Les surimpressions vivent dans un shadow DOM isolé, ignoré par
 * les technologies d'assistance, et disparaissent avec clear().
 */

'use strict';

(function (root) {
  const VERSION = '1';
  if (root.RgaaGuidePage && root.RgaaGuidePage.VERSION === VERSION) return;

  const HOST_ID = 'rgaa-guide-overlay';
  const GRAYSCALE_ID = 'rgaa-guide-grayscale';
  const OFFICE_DOC_RE = /\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp|rtf|epub)(\?|#|$)/i;
  const MEDIA_EMBED_RE = /youtube|youtu\.be|vimeo|dailymotion|twitch|peertube|soundcloud|spotify/i;
  const MAX_ITEMS = 200;

  function dom() {
    if (!root.RgaaRules || !root.RgaaRules.dom) throw new Error('Moteur RGAA non chargé dans la page.');
    return root.RgaaRules.dom;
  }

  function item(el, label, detail) {
    const d = dom();
    return { key: d.cssPath(el), label: d.normalizedText(label).slice(0, 300), detail: detail ? d.normalizedText(detail).slice(0, 300) : '' };
  }

  function visible(el) {
    const d = dom();
    return d.isRendered(el) && !d.isVisuallyHidden(el);
  }

  // ── Inventaire ─────────────────────────────

  /**
   * Diapositive de carrousel masquée : une autre image est affichée par-dessus, au même
   * endroit. Un simple calque transparent (lien étiré sur une carte) ne compte pas.
   */
  /** Transparent ou masqué, en tenant compte des ancêtres (diapositive inactive en fondu). */
  function effectivelyInvisible(el) {
    let node = el;
    while (node && node.nodeType === 1) {
      const s = window.getComputedStyle(node);
      if (parseFloat(s.opacity) < 0.05 || s.visibility === 'hidden') return true;
      node = node.parentElement;
    }
    return false;
  }

  function coveredByAnotherImage(el) {
    if (effectivelyInvisible(el)) return true;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return false;
    // Une diapositive transparente reste « au-dessus » pour le navigateur : on l'écarte.
    const top = document.elementsFromPoint(x, y).find((n) => !effectivelyInvisible(n));
    if (!top || top === el || el.contains(top) || top.contains(el)) return false;
    const media = top.closest('img, picture, svg, video, canvas') || top.querySelector(':scope > img, :scope > picture');
    return Boolean(media) && media !== el && !media.contains(el);
  }

  function collectImages() {
    const d = dom();
    const informative = [];
    const decorative = [];
    document.querySelectorAll('img, svg, [role="img"], input[type="image" i]').forEach((el) => {
      if (el.localName === 'svg' && el.parentElement && el.parentElement.closest('svg')) return;
      if (!visible(el)) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return;
      if (coveredByAnotherImage(el)) return;
      const role = d.explicitRole(el);
      const hidden = d.isHiddenFromAT(el) || role === 'presentation' || role === 'none'
        || (el.localName === 'img' && el.getAttribute('alt') === '');
      if (hidden) {
        decorative.push(item(el, el.getAttribute('src') ? el.getAttribute('src').split(/[?#]/)[0].split('/').pop() : `<${el.localName}>`, 'ignorée par les lecteurs d’écran'));
        return;
      }
      if (el.localName === 'svg' && role !== 'img') return; // icône sans statut clair : traitée par l'audit automatique
      const name = d.accessibleName(el);
      if (name) informative.push(item(el, name, el.localName === 'img' ? 'alternative (alt)' : 'nom accessible'));
    });
    return { informative: informative.slice(0, MAX_ITEMS), decorative: decorative.slice(0, MAX_ITEMS) };
  }

  function collectLinks() {
    const d = dom();
    return [...document.querySelectorAll('a[href], [role="link"]')]
      .filter((a) => visible(a) && !d.isHiddenFromAT(a))
      .map((a) => item(a, d.accessibleName(a) || '(lien sans intitulé)', a.getAttribute('href') || ''))
      .slice(0, MAX_ITEMS);
  }

  function collectTextLinks() {
    const d = dom();
    return [...document.querySelectorAll('p a[href], li a[href], td a[href], dd a[href], blockquote a[href]')]
      .filter((a) => {
        if (!visible(a) || a.closest('nav, [role="navigation"], [role="menu"], [role="menubar"]')) return false;
        const container = a.closest('p, li, td, dd, blockquote');
        const surrounding = [...container.childNodes]
          .filter((n) => n.nodeType === 3 || (n.nodeType === 1 && !n.matches('a, button, ul, ol') && !n.querySelector('a, button')))
          .map((n) => n.textContent).join(' ');
        return d.normalizedText(surrounding).length >= 15;
      })
      .map((a) => item(a, d.accessibleName(a), 'lien au milieu du texte'))
      .slice(0, MAX_ITEMS);
  }

  function collectHeadings() {
    const d = dom();
    return [...document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')]
      .filter((h) => !d.isHiddenFromAT(h))
      .map((h) => {
        const level = d.explicitRole(h) === 'heading' ? parseInt(h.getAttribute('aria-level'), 10) || 2 : parseInt(h.localName.slice(1), 10);
        return { ...item(h, d.accessibleName(h) || '(titre vide)', `niveau ${level}`), level };
      })
      .slice(0, MAX_ITEMS);
  }

  const LANDMARKS = [
    { selector: 'header, [role="banner"]', label: 'En-tête', test: (el) => el.getAttribute('role') === 'banner' || !el.closest('article, aside, main, nav, section') },
    { selector: 'nav, [role="navigation"]', label: 'Navigation' },
    { selector: 'main, [role="main"]', label: 'Contenu principal' },
    { selector: 'aside, [role="complementary"]', label: 'Complémentaire' },
    { selector: 'footer, [role="contentinfo"]', label: 'Pied de page', test: (el) => el.getAttribute('role') === 'contentinfo' || !el.closest('article, aside, main, nav, section') },
    { selector: 'search, [role="search"]', label: 'Recherche' },
  ];

  function collectLandmarks() {
    const d = dom();
    const found = [];
    for (const lm of LANDMARKS) {
      document.querySelectorAll(lm.selector).forEach((el) => {
        if (!visible(el) || d.isHiddenFromAT(el) || (lm.test && !lm.test(el))) return;
        const name = d.normalizedText(el.getAttribute('aria-label'))
          || (el.getAttribute('aria-labelledby') ? d.accessibleName(el) : '');
        found.push(item(el, name ? `${lm.label} « ${name} »` : lm.label, `<${el.localName}>`));
      });
    }
    return found;
  }

  /** Ordre de tabulation : tabindex positifs d'abord, puis l'ordre du document. */
  function collectTabOrder() {
    const d = dom();
    const focusables = [...document.querySelectorAll('a[href], area[href], button, input:not([type="hidden"]), select, textarea, iframe, summary, [tabindex], [contenteditable=""], [contenteditable="true"], audio[controls], video[controls]')]
      .filter((el) => d.isKeyboardFocusable(el));
    const positive = focusables.filter((el) => parseInt(el.getAttribute('tabindex'), 10) > 0)
      .sort((a, b) => parseInt(a.getAttribute('tabindex'), 10) - parseInt(b.getAttribute('tabindex'), 10));
    const natural = focusables.filter((el) => !(parseInt(el.getAttribute('tabindex'), 10) > 0));
    return [...positive, ...natural].slice(0, MAX_ITEMS)
      .map((el, i) => ({ ...item(el, d.accessibleName(el) || d.visibleText(el) || `<${el.localName}>`, `<${el.localName}>`), order: i + 1 }));
  }

  function collectFrames() {
    const d = dom();
    return [...document.querySelectorAll('iframe, frame')]
      .filter((f) => visible(f) && !d.isHiddenFromAT(f) && d.normalizedText(f.getAttribute('title')))
      .map((f) => item(f, f.getAttribute('title'), f.getAttribute('src') || ''));
  }

  function collectFields() {
    const d = dom();
    return [...document.querySelectorAll('input:not([type="hidden" i]):not([type="submit" i]):not([type="button" i]):not([type="reset" i]):not([type="image" i]), select, textarea')]
      .filter((f) => visible(f) && !d.isHiddenFromAT(f) && d.accessibleName(f))
      .map((f) => item(f, d.accessibleName(f), f.localName === 'input' ? `champ ${f.type}` : f.localName === 'select' ? 'liste de choix' : 'zone de texte'))
      .slice(0, MAX_ITEMS);
  }

  function collectButtons() {
    const d = dom();
    return [...document.querySelectorAll('button, input[type="submit" i], input[type="button" i], input[type="reset" i], [role="button"]')]
      .filter((b) => visible(b) && !d.isHiddenFromAT(b) && d.accessibleName(b))
      .map((b) => {
        const shown = b.localName === 'input' ? b.value : d.visibleText(b);
        return item(b, d.accessibleName(b), shown && d.normalizedText(shown) !== d.accessibleName(b) ? `affiché : « ${shown} »` : 'bouton');
      })
      .slice(0, MAX_ITEMS);
  }

  function collectMedia() {
    const d = dom();
    const media = [...document.querySelectorAll('video, audio')]
      .filter((m) => m.localName === 'audio' || visible(m))
      .map((m) => item(m, m.getAttribute('title') || m.getAttribute('aria-label') || (m.localName === 'video' ? 'Vidéo' : 'Son'),
        m.querySelector('track[kind="captions"], track[kind="subtitles"]') ? 'piste de sous-titres présente' : 'aucune piste de sous-titres déclarée'));
    const embeds = [...document.querySelectorAll('iframe')]
      .filter((f) => MEDIA_EMBED_RE.test(f.src || f.getAttribute('data-src') || '') && visible(f))
      .map((f) => item(f, f.getAttribute('title') || 'Média intégré', 'lecteur externe (YouTube, Vimeo…)'));
    return [...media, ...embeds].slice(0, MAX_ITEMS);
  }

  function collectDocuments() {
    const d = dom();
    return [...document.querySelectorAll('a[href]')]
      .filter((a) => OFFICE_DOC_RE.test(a.getAttribute('href')) && visible(a))
      .map((a) => item(a, d.accessibleName(a), a.getAttribute('href').split(/[?#]/)[0].split('/').pop()))
      .slice(0, MAX_ITEMS);
  }

  function inventory() {
    const images = collectImages();
    return {
      url: location.href,
      title: document.title,
      lang: document.documentElement.getAttribute('lang') || '',
      collections: {
        imagesInformative: images.informative,
        imagesDecorative: images.decorative,
        frames: collectFrames(),
        links: collectLinks(),
        textLinks: collectTextLinks(),
        headings: collectHeadings(),
        landmarks: collectLandmarks(),
        tabOrder: collectTabOrder(),
        fields: collectFields(),
        buttons: collectButtons(),
        media: collectMedia(),
        documents: collectDocuments(),
      },
    };
  }

  // ── Surimpressions ─────────────────────────

  const OVERLAY_CSS = `
    :host { all: initial; }
    .layer { position: absolute; left: 0; top: 0; pointer-events: none; z-index: 2147483646; }
    .box { position: absolute; border: 3px solid #E6007E; box-shadow: 0 0 0 2px #FFFFFF, inset 0 0 0 1px #FFFFFF; border-radius: 3px; }
    .box.soft { border-color: #0B5F73; }
    .box.current { border-width: 4px; box-shadow: 0 0 0 3px #FFFFFF, 0 0 0 9999px rgba(0, 0, 0, 0.35); }
    .tag { position: absolute; width: max-content; max-width: 320px; padding: 3px 7px; background: #111111; color: #FFFFFF; border: 2px solid #FFD400;
           font: 600 13px/1.35 "Atkinson Hyperlegible", system-ui, sans-serif; border-radius: 4px; white-space: normal; overflow-wrap: anywhere; }
    .tag.muted { background: #FFFFFF; color: #111111; border-color: #111111; font-style: italic; }
    .num { position: absolute; min-width: 22px; height: 22px; padding: 0 4px; border-radius: 11px; background: #E6007E; color: #FFFFFF;
           font: 700 12px/22px system-ui, sans-serif; text-align: center; border: 2px solid #FFFFFF; }
    svg { position: absolute; left: 0; top: 0; overflow: visible; }
  `;

  let current = null;

  function ensureLayer() {
    let host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = HOST_ID;
      host.setAttribute('aria-hidden', 'true');
      host.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483646;pointer-events:none;';
      const shadow = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = OVERLAY_CSS;
      shadow.appendChild(style);
      const layer = document.createElement('div');
      layer.className = 'layer';
      shadow.appendChild(layer);
      document.documentElement.appendChild(host);
    }
    const layer = host.shadowRoot.querySelector('.layer');
    layer.replaceChildren();
    return layer;
  }

  function pageRect(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
  }

  function addBox(layer, el, { label = '', muted = false, soft = false, current: isCurrent = false } = {}) {
    const r = pageRect(el);
    if (r.w <= 0 && r.h <= 0) return null;
    const box = document.createElement('div');
    box.className = `box${soft ? ' soft' : ''}${isCurrent ? ' current' : ''}`;
    box.style.cssText = `left:${r.x - 3}px;top:${r.y - 3}px;width:${r.w + 6}px;height:${r.h + 6}px;`;
    layer.appendChild(box);
    if (label) {
      const tag = document.createElement('div');
      tag.className = `tag${muted ? ' muted' : ''}`;
      tag.textContent = label;
      // L'étiquette reste dans la largeur de la page, même pour un élément collé au bord droit.
      const maxLeft = Math.max(0, document.documentElement.scrollWidth - 340);
      tag.style.cssText = `left:${Math.max(0, Math.min(r.x - 3, maxLeft))}px;top:${r.y + r.h + 6}px;`;
      layer.appendChild(tag);
    }
    return r;
  }

  function query(key) {
    try {
      return document.querySelector(key);
    } catch {
      return null;
    }
  }

  const AIDS = {
    alternatives(layer) {
      const { informative, decorative } = collectImages();
      informative.forEach((i) => { const el = query(i.key); if (el) addBox(layer, el, { label: i.label }); });
      decorative.forEach((i) => { const el = query(i.key); if (el) addBox(layer, el, { label: 'Décorative (ignorée)', muted: true, soft: true }); });
      return informative.length + decorative.length;
    },
    headings(layer) {
      const list = collectHeadings();
      list.forEach((h) => { const el = query(h.key); if (el) addBox(layer, el, { label: `H${h.level} · ${h.label}`, soft: true }); });
      return list.length;
    },
    landmarks(layer) {
      const list = collectLandmarks();
      list.forEach((l) => { const el = query(l.key); if (el) addBox(layer, el, { label: l.label, soft: true }); });
      return list.length;
    },
    links(layer) {
      const list = collectLinks();
      list.forEach((l) => { const el = query(l.key); if (el) addBox(layer, el, { label: l.label }); });
      return list.length;
    },
    taborder(layer) {
      const list = collectTabOrder();
      const points = [];
      list.forEach((t) => {
        const el = query(t.key);
        if (!el) return;
        const r = pageRect(el);
        if (r.w <= 0 && r.h <= 0) return;
        const num = document.createElement('div');
        num.className = 'num';
        num.textContent = String(t.order);
        num.style.cssText = `left:${r.x - 10}px;top:${r.y - 10}px;`;
        layer.appendChild(num);
        points.push(`${r.x + 1},${r.y + 1}`);
      });
      if (points.length > 1) {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('width', '1');
        svg.setAttribute('height', '1');
        const line = document.createElementNS(ns, 'polyline');
        line.setAttribute('points', points.join(' '));
        line.setAttribute('fill', 'none');
        line.setAttribute('stroke', '#E6007E');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-dasharray', '6 4');
        svg.appendChild(line);
        layer.insertBefore(svg, layer.firstChild);
      }
      return list.length;
    },
    grayscale() {
      if (!document.getElementById(GRAYSCALE_ID)) {
        const style = document.createElement('style');
        style.id = GRAYSCALE_ID;
        style.textContent = 'html { filter: grayscale(1) !important; }';
        document.head.appendChild(style);
      }
      return 1;
    },
  };

  const REFRESH_MS = 800;
  let highlighted = null;
  let timer = null;

  function drawHighlight(layer) {
    if (!highlighted) return;
    const el = query(highlighted.key);
    if (!el) return;
    if (effectivelyInvisible(el) || coveredByAnotherImage(el) || !el.isConnected) {
      const r = pageRect(el);
      const tag = document.createElement('div');
      tag.className = 'tag';
      tag.textContent = 'Cet élément n’est plus affiché (carrousel ?) : mettez le défilement en pause.';
      tag.style.cssText = `left:${Math.max(0, r.x)}px;top:${Math.max(0, r.y)}px;`;
      layer.appendChild(tag);
      return;
    }
    addBox(layer, el, { label: highlighted.caption || '', current: true });
  }

  /**
   * Redessine les cadres d'après l'état actuel de la page : les carrousels et contenus
   * animés changent après l'analyse, des cadres figés seraient faux.
   */
  function render() {
    if (!current && !highlighted) return;
    const layer = ensureLayer();
    if (current && current.name !== 'grayscale') AIDS[current.name](layer);
    drawHighlight(layer);
  }

  function startLive() {
    if (timer) return;
    timer = setInterval(render, REFRESH_MS);
    window.addEventListener('resize', render);
  }

  function stopLive() {
    if (timer) clearInterval(timer);
    timer = null;
    window.removeEventListener('resize', render);
  }

  function showAid(name) {
    clear();
    const aid = AIDS[name];
    if (!aid) throw new Error(`Aide inconnue : ${name}`);
    const count = aid(ensureLayer());
    current = { type: 'aid', name };
    startLive();
    return count;
  }

  /** Met en évidence un élément (fait défiler jusqu'à lui) en gardant l'aide active. */
  function highlight(key, caption) {
    const el = query(key);
    if (!el) return false;
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    highlighted = { key, caption };
    render();
    startLive();
    return true;
  }

  function clear() {
    stopLive();
    const host = document.getElementById(HOST_ID);
    if (host) host.remove();
    const gray = document.getElementById(GRAYSCALE_ID);
    if (gray) gray.remove();
    current = null;
    highlighted = null;
    return true;
  }

  root.RgaaGuidePage = { VERSION, inventory, showAid, highlight, clear, AIDS: Object.keys(AIDS) };
})(typeof globalThis !== 'undefined' ? globalThis : this);
