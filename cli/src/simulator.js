/**
 * src/simulator.js — Simulation d'actions humaines (CLI uniquement)
 *
 * Reproduit des gestes d'auditeur que l'analyse statique du DOM ne peut pas faire :
 *  - parcours au clavier : focus visible (10.7), piège clavier (12.9), contraste du texte
 *    au focus et au survol (3.2), contraste de l'indicateur de focus (3.3)
 *  - lien d'évitement : visible au focus et fonctionnel (12.7)
 *  - zoom 200 % (10.4), affichage à 320 px (10.11), espacement du texte (10.12)
 *  - page sans feuilles de styles (10.3), animations rapides (13.7)
 * La page est rechargée à la fin pour ne pas fausser les mesures suivantes.
 */

'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { log, success, warn } = require('./logger');
const { readSharedSource } = require('./shared');
const { waitForAnimations } = require('./rules');

const DEFAULT_SCREENSHOTS_DIR = './audit-screenshots';
const MAX_TABS = 40;
const FOCUS_SETTLE_MS = 120;
const DESKTOP_VIEWPORT = { width: 1280, height: 720 };
const MAX_HOVERED = 25;

/** Évalue une expression dans la page après y avoir chargé le moteur partagé. */
function withEngine(page, expression) {
  return page.evaluate(`(() => {\n${readSharedSource('rgaa-rules.js')}\n;return ${expression};\n})()`);
}

function createFindings() {
  const findings = [];
  const add = (id, status, resultType, message, extra = {}) => {
    findings.push({
      id,
      status,
      resultType,
      message,
      source: 'simulation',
      severity: status === 'NC' ? 'high' : status === 'C' ? 'low' : 'medium',
      confidence: extra.confidence || (status === 'NT' ? 'medium' : 'high'),
      manualReviewRecommended: status !== 'NC',
      snippet: null,
      count: 1,
      examples: [],
      rationale: '',
      remediationHint: '',
      ...extra,
    });
  };
  return {
    findings,
    error: (id, message, extra) => add(id, 'NC', 'probable_error', message, extra),
    warn: (id, message, extra) => add(id, 'NT', 'heuristic_warning', message, extra),
    pass: (id, message, extra) => add(id, 'C', 'good_signal', message, extra),
    manual: (id, message, extra) => add(id, 'NT', 'manual_only', message, extra),
  };
}

async function simulateHumanActions(page, options = {}) {
  const screenshotsDir = options.screenshotsDir || DEFAULT_SCREENSHOTS_DIR;
  const reload = options.reload || (() => page.reload({ waitUntil: 'load' }));
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const out = createFindings();
  const screenshots = [];
  const shoot = async (name, opts) => {
    const file = await screenshot(page, screenshotsDir, name, opts);
    if (file) screenshots.push(file);
    return file;
  };

  await page.setViewportSize(DESKTOP_VIEWPORT);
  log('   📸 État initial…');
  await shoot('initial');

  const focusStats = await runStep('parcours clavier', () => testKeyboardPath(page, out, shoot));
  await runStep('lien d’évitement', async () => {
    await reload();
    await testSkipLink(page, out);
  });
  await runStep('zoom 200 %', async () => {
    await reload();
    await testTextZoom(page, out, shoot);
  });
  await runStep('affichage 320 px', async () => {
    await testReflow(page, out, shoot);
  });
  await runStep('espacement du texte', async () => {
    await reload();
    await testTextSpacing(page, out);
  });
  await runStep('sans feuilles de styles', async () => {
    await testWithoutCss(page, out, shoot);
  });
  await runStep('animations', async () => {
    await reload();
    await testAnimations(page, out);
  });

  await page.setViewportSize(DESKTOP_VIEWPORT);
  await runStep('rechargement final', () => reload());

  const nc = out.findings.filter((f) => f.status === 'NC').length;
  const c = out.findings.filter((f) => f.status === 'C').length;
  return {
    findings: out.findings,
    screenshots,
    summary: {
      tested: out.findings.length,
      nc,
      c,
      screenshotsDir,
      focusElementsTested: focusStats ? focusStats.tested : 0,
    },
  };

  async function runStep(label, fn) {
    try {
      return await fn();
    } catch (err) {
      warn(`   Simulation « ${label} » interrompue : ${String(err?.message || err).split('\n')[0]}`);
      return null;
    }
  }
}

// ── Parcours clavier ─────────────────────────

/**
 * Le focus est jugé visible si la zone autour de l'élément change à l'écran entre l'état
 * focalisé et l'état non focalisé. La comparaison d'images couvre tous les styles
 * possibles (outline, box-shadow, fond, soulignement…) et aussi le cas d'un focus posé
 * sur un élément masqué ou hors écran.
 */
async function testKeyboardPath(page, out, shoot) {
  log(`   ⌨️  Parcours clavier (jusqu’à ${MAX_TABS} tabulations)…`);
  await page.evaluate(() => {
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    window.scrollTo(0, 0);
  });

  const seen = [];
  const invisible = [];
  const covered = [];
  const weakIndicator = [];
  const focusContrast = [];
  let stuck = 0;
  let previousKey = null;

  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(FOCUS_SETTLE_MS);

    const info = await page.evaluate((index) => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      if (el.localName === 'iframe') return { key: 'iframe', tag: 'iframe', skip: true };
      const rect = el.getBoundingClientRect();
      if (!el.hasAttribute('data-rgaa-focus')) el.setAttribute('data-rgaa-focus', String(index));
      const label = (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('title') || '')
        .replace(/\s+/g, ' ').trim().slice(0, 60);
      return {
        key: el.getAttribute('data-rgaa-focus'),
        tag: el.localName,
        label,
        rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        outerHTML: el.outerHTML.replace(/\s+/g, ' ').replace(/ data-rgaa-focus="\d+"/, '').slice(0, 180),
      };
    }, i);

    if (!info) {
      if (seen.length) break; // fin du document : le focus repart dans l'interface du navigateur
      continue;
    }
    if (info.skip) continue;

    if (info.key === previousKey) {
      stuck++;
      if (stuck >= 2) {
        out.error('12.9', `Piège clavier : le focus reste bloqué sur <${info.tag}> « ${info.label} ».`, {
          snippet: info.outerHTML,
          rationale: 'L’utilisateur clavier ne peut plus quitter le composant avec Tab.',
          remediationHint: 'Ne pas intercepter Tab, ou proposer une sortie documentée (Échap).',
        });
        break;
      }
      continue;
    }
    stuck = 0;
    previousKey = info.key;
    if (seen.some((s) => s.key === info.key)) break; // retour au début : boucle normale de la page
    seen.push(info);

    await waitForAnimations(page, 800);
    const contrast = await withEngine(page, 'globalThis.RgaaRules.measureContrast(document.activeElement)').catch(() => null);
    if (contrast && contrast.pass === false) focusContrast.push({ ...info, contrast });

    const { state, coveredBy, indicator } = await isFocusVisible(page);
    if (state === 'invisible') invisible.push(info);
    if (state === 'covered') covered.push({ ...info, coveredBy });
    if (state === 'visible' && indicator && indicator.weak) weakIndicator.push({ ...info, indicator });
  }

  if (!seen.length) {
    out.warn('10.7', 'Aucun élément n’a reçu le focus au clavier.', {
      remediationHint: 'Vérifier que les liens et contrôles sont atteignables avec Tab.',
    });
    return { tested: 0 };
  }

  if (invisible.length) {
    for (const info of invisible.slice(0, 3)) {
      await page.evaluate((key) => {
        const el = document.querySelector(`[data-rgaa-focus="${key}"]`);
        if (!el) return;
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
      }, info.key).catch(() => {});
      await shoot(`focus-invisible-${invisible.indexOf(info)}`);
    }
    out.error('10.7', `Focus non visible sur ${invisible.length} des ${seen.length} éléments parcourus au clavier.`, {
      count: invisible.length,
      confidence: 'medium',
      snippet: invisible[0].outerHTML,
      examples: invisible.slice(0, 5).map((i) => ({ selector: `<${i.tag}> « ${i.label} »`, snippet: i.outerHTML })),
      rationale: 'Aucune différence visuelle n’apparaît autour de ces éléments quand ils reçoivent le focus.',
      remediationHint: 'Définir un style :focus-visible contrasté (outline de 2 px minimum, par exemple).',
    });
    warn(`   ✗ Focus invisible sur ${invisible.length}/${seen.length} élément(s)`);
  } else {
    out.pass('10.7', `Focus visible sur les ${seen.length - covered.length} éléments parcourus et mesurables au clavier.`, {
      confidence: 'medium',
      remediationHint: 'Vérifier aussi le contraste de l’indicateur de focus.',
    });
    success(`   ✓ Focus visible sur ${seen.length - covered.length} élément(s)`);
  }

  if (covered.length) {
    out.warn('10.7', `Focus masqué par un élément superposé sur ${covered.length} élément(s) (ex. ${covered[0].coveredBy}).`, {
      count: covered.length,
      snippet: covered[0].outerHTML,
      examples: covered.slice(0, 5).map((i) => ({ selector: `<${i.tag}> « ${i.label} » sous ${i.coveredBy}`, snippet: i.outerHTML })),
      rationale: 'Un bandeau ou une barre fixe recouvre l’élément focalisé : l’utilisateur clavier ne voit pas où il se trouve.',
      remediationHint: 'Éviter qu’un contenu fixe recouvre le focus (scroll-padding, bandeau non bloquant ou fermé au clavier).',
    });
  }

  if (weakIndicator.length) {
    const best = Math.max(...weakIndicator.map((w) => w.indicator.max));
    out.warn('3.3', `Indicateur de focus peu contrasté sur ${weakIndicator.length} élément(s) (meilleur écart mesuré ${best.toFixed(2)}:1, attendu 3:1).`, {
      count: weakIndicator.length,
      snippet: weakIndicator[0].outerHTML,
      examples: weakIndicator.slice(0, 5).map((i) => ({ selector: `<${i.tag}> « ${i.label} » (${i.indicator.max.toFixed(2)}:1)`, snippet: i.outerHTML })),
      rationale: 'Le changement visuel à la prise de focus existe mais se distingue mal de l’état normal.',
      remediationHint: 'Utiliser un contour ou un soulignement contrasté (3:1 avec l’état non focalisé et avec le fond).',
    });
  }

  reportStateContrast(out, focusContrast, 'au focus');
  const hovered = await testHoverContrast(page, seen);
  reportStateContrast(out, hovered, 'au survol');

  out.manual('12.8', `Ordre de tabulation sur ${seen.length} éléments : vérifier qu’il suit l’ordre de lecture.`, {
    details: { sequence: seen.map((s) => s.label || s.tag).slice(0, MAX_TABS) },
  });
  return { tested: seen.length };
}

function reportStateContrast(out, failures, stateLabel) {
  if (!failures.length) return;
  const worst = failures.reduce((a, b) => (a.contrast.ratio <= b.contrast.ratio ? a : b));
  out.error('3.2', `Contraste insuffisant ${stateLabel} sur ${failures.length} élément(s) (jusqu’à ${worst.contrast.ratio}:1, texte ${worst.contrast.foreground} sur ${worst.contrast.background}).`, {
    count: failures.length,
    snippet: worst.outerHTML,
    details: { ratio: worst.contrast.ratio, required: worst.contrast.required, foreground: worst.contrast.foreground, background: worst.contrast.background },
    examples: failures.slice(0, 5).map((f) => ({ selector: `<${f.tag}> « ${f.label} » (${f.contrast.ratio}:1, requis ${f.contrast.required}:1)`, snippet: f.outerHTML })),
    rationale: `Les couleurs appliquées ${stateLabel} rendent le texte difficile à lire.`,
    remediationHint: `Vérifier les styles :hover/:focus : le texte doit rester à 4,5:1 (3:1 pour le gros texte) ${stateLabel}.`,
  });
}

/** Survole les éléments interactifs parcourus au clavier et mesure le contraste de leur texte. */
async function testHoverContrast(page, seen) {
  const failures = [];
  await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
  for (const info of seen.slice(0, MAX_HOVERED)) {
    const selector = `[data-rgaa-focus="${info.key}"]`;
    try {
      await page.hover(selector, { timeout: 1500 });
      await page.waitForTimeout(FOCUS_SETTLE_MS);
      await waitForAnimations(page, 800);
      const contrast = await withEngine(page, `globalThis.RgaaRules.measureContrast(document.querySelector('${selector}'))`);
      if (contrast && contrast.pass === false) failures.push({ ...info, contrast });
    } catch {
      // élément masqué, recouvert ou retiré du DOM : on passe au suivant
    }
  }
  await page.mouse.move(0, 0);
  return failures;
}

/**
 * Retourne 'visible', 'invisible', 'covered' (élément focalisé caché sous un autre, par
 * exemple un bandeau cookies) ou null si la mesure est impossible.
 */
async function isFocusVisible(page) {
  const margin = 8;
  const box = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    // Défilement instantané : avec scroll-behavior: smooth, l'élément n'est pas encore à l'écran.
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    const cx = Math.min(window.innerWidth - 1, Math.max(0, r.left + r.width / 2));
    const cy = Math.min(window.innerHeight - 1, Math.max(0, r.top + r.height / 2));
    const top = document.elementFromPoint(cx, cy);
    const covered = top && top !== el && !el.contains(top) && !top.contains(el);
    return {
      rect: { x: r.left, y: r.top, width: r.width, height: r.height },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      coveredBy: covered ? `<${top.localName}${top.id ? `#${top.id}` : ''}${top.classList.length ? `.${[...top.classList].slice(0, 2).join('.')}` : ''}>` : null,
    };
  });
  if (!box) return { state: null };
  const { rect, viewport } = box;
  if (rect.width === 0 && rect.height === 0) return { state: 'invisible' };
  if (box.coveredBy) return { state: 'covered', coveredBy: box.coveredBy };
  const x = Math.max(0, Math.floor(rect.x - margin));
  const y = Math.max(0, Math.floor(rect.y - margin));
  const right = Math.min(viewport.width, Math.ceil(rect.x + rect.width + margin));
  const bottom = Math.min(viewport.height, Math.ceil(rect.y + rect.height + margin));
  if (right - x < 1 || bottom - y < 1) return { state: 'invisible' };
  const clip = { x, y, width: right - x, height: bottom - y };

  try {
    const focused = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
    const restore = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return false;
      window.__rgaaLastFocus = el;
      el.blur();
      return true;
    });
    if (!restore) return { state: null };
    await page.waitForTimeout(FOCUS_SETTLE_MS);
    const blurred = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
    await page.evaluate(() => {
      const el = window.__rgaaLastFocus;
      delete window.__rgaaLastFocus;
      if (el && el.isConnected) el.focus({ preventScroll: true });
    });
    if (focused.equals(blurred)) return { state: 'invisible' };
    return { state: 'visible', indicator: await measureIndicator(page, focused, blurred, rect) };
  } catch {
    return { state: null };
  }
}

/**
 * Contraste de l'indicateur de focus : pour chaque pixel modifié par la prise de focus,
 * rapport de contraste entre sa couleur focalisée et sa couleur d'origine. L'indicateur est
 * jugé faible si moins de pixels qu'une ligne de la largeur de l'élément atteignent 3:1
 * (un soulignement suffit, un léger changement de fond non).
 */
async function measureIndicator(page, focused, blurred, rect) {
  return page.evaluate(async ({ a, b, width }) => {
    const decode = async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, img.width, img.height).data;
    };
    const lum = (r, g, bl) => [r, g, bl].map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }).reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0);
    const [pa, pb] = await Promise.all([decode(a), decode(b)]);
    let changed = 0;
    let strong = 0;
    let max = 1;
    for (let i = 0; i < pa.length; i += 4) {
      if (Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]) < 24) continue;
      changed++;
      const la = lum(pa[i], pa[i + 1], pa[i + 2]);
      const lb = lum(pb[i], pb[i + 1], pb[i + 2]);
      const ratio = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
      if (ratio >= 3) strong++;
      if (ratio > max) max = ratio;
    }
    return { changed, strong, max, weak: strong < Math.max(20, Math.min(width, 200)) };
  }, { a: focused.toString('base64'), b: blurred.toString('base64'), width: Math.round(rect.width) });
}

// ── Lien d'évitement ─────────────────────────

async function testSkipLink(page, out) {
  log('   🎯 Lien d’évitement…');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(FOCUS_SETTLE_MS);

  const first = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const text = (el.innerText || el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
    const href = el.getAttribute('href') || '';
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const onScreen = rect.width > 2 && rect.height > 2 && rect.bottom > 0 && rect.right > 0
      && rect.top < window.innerHeight && rect.left < window.innerWidth
      && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0.1
      && !/rect\(\s*0/.test(style.clip);
    return { tag: el.localName, text, href, onScreen, outerHTML: el.outerHTML.replace(/\s+/g, ' ').slice(0, 180) };
  });

  const isSkip = first && first.tag === 'a' && first.href.startsWith('#')
    && /aller|acc[eè]s|contenu|skip|passer|[ée]viter|main/i.test(first.text);
  if (!isSkip) {
    out.manual('12.7', `Le premier élément atteint au clavier n’est pas un lien d’évitement (${first ? `<${first.tag}> « ${first.text.slice(0, 40)} »` : 'aucun'}).`, {
      remediationHint: 'Placer un lien « Aller au contenu » en tout premier élément focusable.',
    });
    return;
  }

  if (!first.onScreen) {
    out.error('12.7', `Le lien d’évitement « ${first.text} » reste invisible quand il reçoit le focus.`, {
      snippet: first.outerHTML,
      rationale: 'Test 12.7.2 : le lien doit être visible, ou au moins visible à la prise de focus.',
      remediationHint: 'Rendre le lien visible au :focus (retirer le masquage sr-only à la prise de focus).',
    });
  }

  const target = decodeURIComponentSafe(first.href.slice(1));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const result = await page.evaluate((id) => {
    const targetEl = document.getElementById(id) || document.querySelector(`[name="${CSS.escape(id)}"]`);
    if (!targetEl) return { exists: false };
    const active = document.activeElement;
    const rect = targetEl.getBoundingClientRect();
    return {
      exists: true,
      focusMoved: Boolean(active && (active === targetEl || targetEl.contains(active))),
      inView: rect.top < window.innerHeight && rect.bottom > 0,
    };
  }, target);

  if (!result.exists) {
    out.error('12.7', `Lien d’évitement non fonctionnel : la cible #${target} n’existe pas.`, { snippet: first.outerHTML });
  } else if (!result.inView && !result.focusMoved) {
    out.error('12.7', `Lien d’évitement non fonctionnel : l’activation n’amène pas sur #${target}.`, { snippet: first.outerHTML });
  } else {
    out.pass('12.7', `Lien d’évitement « ${first.text} » en premier, ${first.onScreen ? 'visible au focus' : 'mais invisible au focus'}, fonctionnel.`, {
      confidence: 'high',
    });
    success('   ✓ Lien d’évitement visible et fonctionnel');
  }
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// ── Zoom, reflow, espacement ─────────────────

/** Repère les blocs dont le texte est tronqué par leur conteneur (overflow masqué). */
async function findClippedText(page) {
  return page.evaluate(() => {
    const clipped = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!el.firstChild || !el.innerText || !el.innerText.trim()) continue;
      const s = window.getComputedStyle(el);
      const hidesX = /hidden|clip/.test(s.overflowX);
      const hidesY = /hidden|clip/.test(s.overflowY);
      if (!hidesX && !hidesY) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 2 || rect.height <= 2) continue; // texte masqué volontairement (sr-only)
      const overflowY = hidesY && el.scrollHeight > el.clientHeight + 2;
      const overflowX = hidesX && el.scrollWidth > el.clientWidth + 2 && s.whiteSpace !== 'normal';
      if (overflowY || overflowX) {
        let path = el.localName;
        if (el.id) path += `#${el.id}`;
        else if (el.classList.length) path += `.${[...el.classList].slice(0, 2).join('.')}`;
        clipped.push({ selector: path, snippet: el.outerHTML.replace(/\s+/g, ' ').slice(0, 160) });
      }
    }
    return clipped;
  });
}

async function testTextZoom(page, out, shoot) {
  log('   🔍 Zoom 200 % (fenêtre équivalente 640 × 360)…');
  const before = new Set((await findClippedText(page)).map((c) => c.snippet));
  await page.setViewportSize({ width: DESKTOP_VIEWPORT.width / 2, height: DESKTOP_VIEWPORT.height / 2 });
  await page.waitForTimeout(400);
  const after = (await findClippedText(page)).filter((c) => !before.has(c.snippet));
  const shot = await shoot('zoom-200');
  if (after.length) {
    out.warn('10.4', `Zoom 200 % : ${after.length} bloc(s) de texte tronqué(s).`, {
      count: after.length,
      examples: after.slice(0, 5),
      snippet: after[0].snippet,
      screenshot: shot,
      remediationHint: 'Éviter les hauteurs fixes et overflow:hidden sur les blocs de texte.',
    });
    warn(`   ✗ ${after.length} bloc(s) tronqué(s) au zoom 200 %`);
  } else {
    out.pass('10.4', 'Zoom 200 % : aucun texte tronqué détecté.', {
      confidence: 'medium', screenshot: shot,
      remediationHint: 'Vérifier visuellement les chevauchements de texte sur la capture.',
    });
  }
}

async function testReflow(page, out, shoot) {
  log('   📱 Affichage à 320 px de large…');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const width = window.innerWidth;
    if (Math.max(doc.scrollWidth, document.body.scrollWidth) <= width + 1) return null;
    const exempt = (el) => el.closest('table, pre, code, [role="grid"], [role="application"], .map, iframe, canvas, video');
    const offenders = [];
    for (const el of document.querySelectorAll('body *')) {
      const rect = el.getBoundingClientRect();
      if (rect.right <= width + 1 || rect.width === 0) continue;
      const s = window.getComputedStyle(el);
      if (s.position === 'fixed' || s.visibility === 'hidden') continue;
      const parentRect = el.parentElement ? el.parentElement.getBoundingClientRect() : null;
      if (parentRect && parentRect.right > width + 1) continue; // ne garder que les débordements « racines »
      let scroller = el.parentElement;
      let clipped = false;
      while (scroller && scroller !== document.body) {
        const ps = window.getComputedStyle(scroller);
        if (/auto|scroll|hidden|clip/.test(ps.overflowX)) { clipped = true; break; }
        scroller = scroller.parentElement;
      }
      if (clipped) continue;
      offenders.push({
        selector: el.localName + (el.id ? `#${el.id}` : el.classList.length ? `.${[...el.classList].slice(0, 2).join('.')}` : ''),
        snippet: el.outerHTML.replace(/\s+/g, ' ').slice(0, 160),
        width: Math.round(rect.width),
        exempt: Boolean(exempt(el)),
      });
      if (offenders.length >= 20) break;
    }
    return { scrollWidth: Math.max(doc.scrollWidth, document.body.scrollWidth), offenders };
  });
  const shot = await shoot('reflow-320');

  if (!overflow) {
    out.pass('10.11', 'À 320 px de large : pas de défilement horizontal.', { screenshot: shot });
    success('   ✓ Pas de défilement horizontal à 320 px');
    return;
  }
  const real = overflow.offenders.filter((o) => !o.exempt);
  const entry = {
    count: Math.max(1, real.length),
    examples: (real.length ? real : overflow.offenders).slice(0, 5),
    snippet: (real[0] || overflow.offenders[0] || {}).snippet || null,
    screenshot: shot,
    details: { scrollWidth: overflow.scrollWidth },
    remediationHint: 'Rendre la mise en page fluide (max-width:100 %, flex-wrap, media queries).',
  };
  if (real.length || !overflow.offenders.length) {
    out.error('10.11', `À 320 px de large : défilement horizontal (contenu de ${overflow.scrollWidth} px).`, entry);
    warn(`   ✗ Défilement horizontal à 320 px (${overflow.scrollWidth} px)`);
  } else {
    out.warn('10.11', 'À 320 px : seul un contenu à deux dimensions (tableau, code, carte) déborde — exception possible.', entry);
  }
}

async function testTextSpacing(page, out) {
  log('   ↔️  Espacement du texte (10.12)…');
  const before = new Set((await findClippedText(page)).map((c) => c.snippet));
  await page.addStyleTag({
    content: `*, *::before, *::after { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
p { margin-bottom: 2em !important; }`,
  });
  await page.waitForTimeout(300);
  const after = (await findClippedText(page)).filter((c) => !before.has(c.snippet));
  if (after.length) {
    out.error('10.12', `Espacement du texte augmenté : ${after.length} bloc(s) de texte tronqué(s).`, {
      count: after.length,
      confidence: 'medium',
      examples: after.slice(0, 5),
      snippet: after[0].snippet,
      rationale: 'Avec les espacements du test 10.12, ces blocs masquent une partie de leur texte.',
      remediationHint: 'Supprimer les hauteurs fixes ; laisser les conteneurs s’adapter au texte.',
    });
    warn(`   ✗ ${after.length} bloc(s) tronqué(s) avec l’espacement augmenté`);
  } else {
    out.pass('10.12', 'Espacement du texte augmenté : aucun texte tronqué détecté.', { confidence: 'medium' });
  }
}

async function testWithoutCss(page, out, shoot) {
  log('   🎨 Page sans feuilles de styles…');
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      try { sheet.disabled = true; } catch { /* feuille non modifiable */ }
    }
    document.querySelectorAll('[style]').forEach((el) => el.setAttribute('data-rgaa-style', el.getAttribute('style')));
    document.querySelectorAll('[style]').forEach((el) => el.removeAttribute('style'));
  });
  await page.waitForTimeout(300);
  const shot = await shoot('sans-css', { fullPage: true });
  out.manual('10.3', 'Page sans feuilles de styles : vérifier sur la capture que l’information reste compréhensible et ordonnée.', {
    screenshot: shot,
  });
}

async function testAnimations(page, out) {
  log('   🎬 Animations rapides…');
  const fast = await page.evaluate(() => {
    let count = 0;
    for (const el of document.querySelectorAll('body *')) {
      const s = window.getComputedStyle(el);
      if (s.animationName === 'none') continue;
      const durations = s.animationDuration.split(',').map((d) => parseFloat(d) * (d.trim().endsWith('ms') ? 0.001 : 1));
      const infinite = /infinite/.test(s.animationIterationCount);
      if (infinite && durations.some((d) => d > 0 && d < 0.34)) count++;
    }
    return count;
  });
  if (fast) {
    out.warn('13.7', `${fast} animation(s) en boucle plus rapide(s) que 3 cycles par seconde : risque de flash.`, {
      remediationHint: 'Vérifier qu’aucun flash n’excède 3 par seconde ; ralentir ou supprimer l’animation.',
    });
  }
}

async function screenshot(page, dir, name, opts = {}) {
  const filepath = path.join(dir, `${name}-${Date.now()}.png`);
  try {
    await page.screenshot({ path: filepath, fullPage: false, ...opts });
    return filepath;
  } catch {
    return null;
  }
}

module.exports = { simulateHumanActions, _internals: { findClippedText, isFocusVisible } };
