// src/captures.js
// Captures annotées des éléments non conformes, reprises dans le rapport HTML vulgarisé.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const OVERLAY_ID = '__rgaa_capture_overlay';
const MARGIN = 24;
const MAX_CLIP = { width: 900, height: 500 };

/**
 * Photographie les premiers éléments non conformes de la page courante, entourés d'un
 * cadre magenta. Ajoute `capture` (chemin du fichier) aux constats concernés.
 */
async function captureFindings(page, results, { dir, prefix = 'p', max = 6 } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const done = new Set();
  let taken = 0;
  for (const result of results) {
    if (taken >= max) break;
    if (result.status !== 'NC' || !result.selector || done.has(result.selector)) continue;
    done.add(result.selector);
    const box = await page.evaluate(({ selector, overlayId }) => {
      let el = null;
      try { el = document.querySelector(selector); } catch { return null; }
      if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return null;
      const overlay = document.createElement('div');
      overlay.id = overlayId;
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.cssText = `position:fixed;left:${r.left - 4}px;top:${r.top - 4}px;width:${r.width + 8}px;height:${r.height + 8}px;`
        + 'border:3px solid #FF00AA;box-shadow:0 0 0 2px #FFFFFF;border-radius:4px;z-index:2147483647;pointer-events:none;';
      document.documentElement.appendChild(overlay);
      return { x: r.left, y: r.top, width: r.width, height: r.height, vw: window.innerWidth, vh: window.innerHeight };
    }, { selector: result.selector, overlayId: OVERLAY_ID }).catch(() => null);
    if (!box) continue;

    const x = Math.max(0, Math.floor(box.x - MARGIN));
    const y = Math.max(0, Math.floor(box.y - MARGIN));
    const width = Math.min(MAX_CLIP.width, box.vw - x, Math.ceil(box.width + MARGIN * 2));
    const height = Math.min(MAX_CLIP.height, box.vh - y, Math.ceil(box.height + MARGIN * 2));
    const file = path.join(dir, `nc-${prefix}-${taken + 1}.jpg`);
    try {
      if (width > 0 && height > 0) {
        await page.screenshot({ path: file, clip: { x, y, width, height }, type: 'jpeg', quality: 70, animations: 'disabled' });
        result.capture = file;
        taken++;
      }
    } catch {
      // élément hors de la zone capturable : on continue sans capture
    } finally {
      await page.evaluate((overlayId) => document.getElementById(overlayId)?.remove(), OVERLAY_ID).catch(() => {});
    }
  }
  return taken;
}

/** Copie du rapport avec les captures en data URI, pour un rapport HTML autonome. */
function attachCaptureData(report) {
  const captures = {};
  for (const r of report.results || []) {
    if (!r.capture || captures[r.capture]) continue;
    try {
      captures[r.capture] = `data:image/jpeg;base64,${fs.readFileSync(r.capture).toString('base64')}`;
    } catch {
      // capture supprimée entre-temps
    }
  }
  return Object.keys(captures).length ? { ...report, captures } : report;
}

module.exports = { captureFindings, attachCaptureData };
