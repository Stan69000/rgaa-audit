/**
 * src/simulator.js — Simulateur d'actions humaines
 *
 * Reproduit le comportement d'un auditeur RGAA humain :
 *  - Navigation clavier (Tab, Shift+Tab, Enter, Escape)
 *  - Vérification du focus visible
 *  - Test du zoom 200%
 *  - Navigation sans CSS
 *  - Test des modales et menus
 *  - Screenshots à chaque étape clé
 */

'use strict';

const path = require('node:path');
const fs   = require('node:fs');
const { log, success, warn } = require('./logger');

const SCREENSHOTS_DIR = './audit-screenshots';

async function simulateHumanActions(page) {
  const findings = [];
  const screenshots = [];

  // Créer le dossier screenshots
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const flag = (id, status, message, screenshot = null) => {
    findings.push({ id, status, message, screenshot, source: 'simulation' });
  };

  // ── 1. SCREENSHOT ÉTAT INITIAL ─────────────
  log('   📸 État initial…');
  const initShot = await screenshot(page, 'initial');
  screenshots.push(initShot);

  // ── 2. NAVIGATION AU CLAVIER (Tab x 15) ────
  log('   ⌨️  Navigation clavier (Tab x 15)…');
  await page.keyboard.press('Tab'); // Sortir du body

  const focusHistory = [];
  let invisibleFocusCount = 0;

  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(150);

    // Capturer l'élément focusé et son style
    const focusInfo = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('value') || '').trim().slice(0, 60),
        outline: style.outline,
        outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor,
        outlineStyle: style.outlineStyle,
        boxShadow: style.boxShadow,
        border: style.border,
        visible: rect.width > 0 && rect.height > 0,
        inViewport: rect.top >= 0 && rect.bottom <= window.innerHeight,
      };
    });

    if (!focusInfo) continue;
    focusHistory.push(focusInfo);

    // Vérifier si le focus est visible (outline ou box-shadow ou border)
    const hasVisibleFocus =
      (focusInfo.outlineWidth && focusInfo.outlineWidth !== '0px') ||
      (focusInfo.boxShadow && focusInfo.boxShadow !== 'none') ||
      focusInfo.outline !== 'none';

    if (!hasVisibleFocus) {
      invisibleFocusCount++;
      if (invisibleFocusCount <= 3) { // Limiter les doublons
        const shotPath = await screenshot(page, `focus-invisible-${i}`);
        screenshots.push(shotPath);
        flag('10.7', 'NC',
          `Focus invisible sur <${focusInfo.tag}> "${focusInfo.text}" (outline: ${focusInfo.outline})`,
          shotPath
        );
      }
    }
  }

  if (invisibleFocusCount === 0) {
    flag('10.7', 'C', `Focus visible sur les ${focusHistory.length} éléments testés`);
    success('   ✓ Focus visible sur tous les éléments testés');
  } else {
    warn(`   ✗ ${invisibleFocusCount} élément(s) avec focus invisible`);
  }

  // ── 3. TEST LIEN D'ÉVITEMENT ────────────────
  log('   🎯 Test lien d\'évitement…');
  await page.keyboard.press('Escape');
  await page.goto(page.url()); // Reload
  await page.waitForTimeout(500);
  await page.keyboard.press('Tab'); // Premier Tab = lien d'évitement ?

  const firstFocus = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    const text = (el.innerText || el.textContent || '').trim().toLowerCase();
    return { tag: el.tagName, text, href: el.getAttribute('href') };
  });

  const skipKeywords = ['contenu', 'navigation', 'skip', 'aller', 'accès', 'main', 'menu'];
  if (firstFocus && skipKeywords.some(k => firstFocus.text.includes(k))) {
    flag('12.1', 'C', `Premier Tab = lien d'évitement : "${firstFocus.text}"`);
    success(`   ✓ Lien d'évitement fonctionnel : "${firstFocus.text}"`);
  } else {
    flag('12.1', 'NC',
      `Premier Tab ne tombe pas sur un lien d'évitement (tombe sur : <${firstFocus?.tag || '?'}> "${firstFocus?.text?.slice(0, 40) || 'inconnu'}")`
    );
    warn('   ✗ Pas de lien d\'évitement au premier Tab');
  }

  // ── 4. TEST ZOOM 200% ───────────────────────
  log('   🔍 Test zoom 200%…');
  await page.setViewportSize({ width: 1280, height: 720 });

  // Simuler zoom 200% via CSS transform
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await page.waitForTimeout(500);

  // Vérifier overflow horizontal
  const hasHorizontalScroll = await page.evaluate(() => {
    return document.body.scrollWidth > window.innerWidth + 5;
  });

  const zoomShot = await screenshot(page, 'zoom-200');
  screenshots.push(zoomShot);

  if (hasHorizontalScroll) {
    flag('10.4', 'NC',
      'Zoom 200% : scroll horizontal détecté — contenu déborde (responsive/fluid layout requis)',
      zoomShot
    );
    warn('   ✗ Scroll horizontal au zoom 200%');
  } else {
    flag('10.4', 'C', 'Zoom 200% : pas de scroll horizontal détecté', zoomShot);
    success('   ✓ Pas de scroll horizontal au zoom 200%');
  }

  // Remettre le zoom normal
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });

  // ── 5. TEST SANS CSS ─────────────────────────
  log('   🎨 Test sans feuilles de style…');
  await page.evaluate(() => {
    [...document.styleSheets].forEach(sheet => {
      try { sheet.disabled = true; } catch {}
    });
  });
  await page.waitForTimeout(400);

  const noCssShot = await screenshot(page, 'no-css');
  screenshots.push(noCssShot);

  // Vérifier que le contenu reste lisible (texte toujours présent)
  const textVisible = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    return (main.innerText || '').trim().length > 50;
  });

  if (textVisible) {
    flag('10.1', 'C', 'Contenu textuel accessible sans CSS', noCssShot);
    success('   ✓ Contenu lisible sans CSS');
  } else {
    flag('10.1', 'NC', 'Contenu non lisible sans CSS — information transmise uniquement par présentation', noCssShot);
    warn('   ✗ Contenu inaccessible sans CSS');
  }

  // Réactiver le CSS
  await page.evaluate(() => {
    [...document.styleSheets].forEach(sheet => { try { sheet.disabled = false; } catch {} });
  });

  // ── 6. TEST NAVIGATION CLAVIER FORMULAIRES ──
  log('   📋 Test formulaires au clavier…');
  await page.waitForTimeout(300);

  const formFields = await page.$$('input:not([type=hidden]), select, textarea');
  let formIssues = 0;

  for (const field of formFields.slice(0, 5)) {
    try {
      await field.focus();
      await page.waitForTimeout(100);

      const focusStyle = await page.evaluate(el => {
        const s = window.getComputedStyle(el);
        return {
          outline: s.outline,
          outlineWidth: s.outlineWidth,
          boxShadow: s.boxShadow,
        };
      }, field);

      const hasFocus =
        (focusStyle.outlineWidth && focusStyle.outlineWidth !== '0px') ||
        (focusStyle.boxShadow && focusStyle.boxShadow !== 'none');

      if (!hasFocus) formIssues++;
    } catch {}
  }

  if (formFields.length > 0) {
    if (formIssues > 0) {
      flag('11.1', 'NC', `${formIssues}/${Math.min(formFields.length, 5)} champ(s) de formulaire sans indicateur de focus visible`);
    } else {
      flag('11.1', 'C', `Champs de formulaire testés au clavier : focus visible sur tous`);
      success('   ✓ Focus visible sur les champs de formulaire');
    }
  }

  // ── 7. TEST CLIGNOTEMENT / ANIMATION ────────
  log('   🎬 Détection animations problématiques…');
  const flashingEl = await page.evaluate(() => {
    const all = [...document.querySelectorAll('*')];
    const anim = all.filter(el => {
      const s = window.getComputedStyle(el);
      return s.animationName !== 'none' && (
        s.animationDuration &&
        parseFloat(s.animationDuration) < 0.35 // > ~3 flash/sec
      );
    });
    return anim.length;
  });

  if (flashingEl > 0) {
    flag('13.7', 'NC', `${flashingEl} élément(s) avec animation rapide détectée (risque clignotement > 3/sec)`);
    warn(`   ⚠️  ${flashingEl} animation(s) potentiellement problématique(s)`);
  } else {
    flag('13.7', 'C', 'Aucune animation à fréquence problématique détectée');
    success('   ✓ Pas d\'animation rapide détectée');
  }

  // ── 8. TEST REDIMENSIONNEMENT FENÊTRE ───────
  log('   📱 Test responsive (320px)…');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(500);

  const mobileOverflow = await page.evaluate(() =>
    document.body.scrollWidth > window.innerWidth + 10
  );

  const mobileShot = await screenshot(page, 'mobile-320');
  screenshots.push(mobileShot);

  if (mobileOverflow) {
    flag('10.4', 'NC', 'Viewport 320px : débordement horizontal détecté (mobile non supporté)', mobileShot);
    warn('   ✗ Débordement à 320px de large');
  } else {
    flag('10.4', 'C', 'Viewport 320px : pas de débordement horizontal', mobileShot);
    success('   ✓ Responsive OK à 320px');
  }

  // Remettre viewport normal
  await page.setViewportSize({ width: 1280, height: 720 });

  // ── RÉCAPITULATIF ────────────────────────────
  const nc = findings.filter(f => f.status === 'NC').length;
  const c  = findings.filter(f => f.status === 'C').length;

  return {
    findings,
    screenshots,
    summary: {
      tested: findings.length,
      nc, c,
      screenshotsDir: SCREENSHOTS_DIR,
      focusElementsTested: focusHistory.length,
    },
  };
}

async function screenshot(page, name) {
  const filename = `${name}-${Date.now()}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);
  try {
    await page.screenshot({ path: filepath, fullPage: false });
  } catch {}
  return filepath;
}

module.exports = { simulateHumanActions };
