// src/page-prep.js
// Préparation d'une page avant mesure : fermeture du bandeau de consentement et
// bascule vers un thème alternatif piloté par le site (bouton, attribut, classe…).
'use strict';

const { log, warn } = require('./logger');

const CONSENT_CONTAINER_HINT = /cookie|consent|gdpr|rgpd|tarteaucitron|axeptio|didomi|onetrust|cmp|privacy|vie-privee/i;
// Le refus est préféré à l'acceptation : il ne déclenche aucun traceur pendant l'audit.
const REFUSE_LABEL = /^(tout\s+)?refuser(\s+tout)?$|^continuer sans accepter$|^je refuse$|^reject( all)?$|^decline( all)?$|^deny$|^refuser les cookies$/i;
const CLOSE_LABEL = /^(fermer|close|ok|j’ai compris|j'ai compris|compris)$/i;

/**
 * Ferme le bandeau de consentement. Avec un sélecteur explicite, clique dessus ; sinon
 * cherche un bouton « Refuser » (à défaut « Fermer ») dans un conteneur qui ressemble à
 * un bandeau cookies. Retourne le libellé cliqué, ou null.
 */
async function dismissConsent(page, selector = '') {
  if (selector) {
    const target = page.locator(selector).first();
    if (await target.isVisible().catch(() => false)) {
      await target.click({ timeout: 3000 });
      await page.waitForTimeout(300);
      return selector;
    }
    return null;
  }

  const clicked = await page.evaluate(({ containerHint, refuse, close }) => {
    const containerRe = new RegExp(containerHint.source, containerHint.flags);
    const refuseRe = new RegExp(refuse.source, refuse.flags);
    const closeRe = new RegExp(close.source, close.flags);
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = window.getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const looksLikeBanner = (el) => {
      let node = el;
      for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
        const id = `${node.id} ${typeof node.className === 'string' ? node.className : ''} ${node.getAttribute('aria-label') || ''}`;
        if (containerRe.test(id)) return true;
        const s = window.getComputedStyle(node);
        if ((s.position === 'fixed' || s.position === 'sticky') && /cookie|donn[ée]es|consent|traceur|audience/i.test(node.textContent || '')) return true;
        if (node.getAttribute('role') === 'dialog' && /cookie|consent|traceur/i.test(node.textContent || '')) return true;
      }
      return false;
    };
    const buttons = [...document.querySelectorAll('button, [role="button"], a[href="#"], input[type="button"]')]
      .filter((b) => visible(b) && looksLikeBanner(b));
    const label = (b) => (b.innerText || b.value || b.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    const target = buttons.find((b) => refuseRe.test(label(b))) || buttons.find((b) => closeRe.test(label(b)));
    if (!target) return null;
    target.click();
    return label(target);
  }, { containerHint: toPlain(CONSENT_CONTAINER_HINT), refuse: toPlain(REFUSE_LABEL), close: toPlain(CLOSE_LABEL) });

  if (clicked) await page.waitForTimeout(300);
  return clicked;
}

function toPlain(re) {
  return { source: re.source, flags: re.flags };
}

/**
 * Crée la fonction de préparation appelée après chaque navigation ou rechargement.
 * options.dismiss : 'auto' (défaut), 'off', ou un sélecteur CSS du bouton à cliquer.
 */
function createPagePreparer(page, { dismiss = 'auto' } = {}) {
  let announced = false;
  return async function preparePage() {
    if (dismiss === 'off') return;
    try {
      const clicked = await dismissConsent(page, dismiss === 'auto' ? '' : dismiss);
      if (clicked && !announced) {
        log(`   Bandeau de consentement fermé (« ${clicked} »)`);
        announced = true;
      }
    } catch (err) {
      warn(`   Fermeture du bandeau de consentement impossible : ${String(err?.message || err).split('\n')[0]}`);
    }
  };
}

/**
 * Bascule vers le thème alternatif du site : clic sur un sélecteur (bouton de thème)
 * et/ou exécution d'un script (ex. document.documentElement.dataset.theme = 'light').
 */
async function applyAlternateTheme(page, { click = '', script = '' } = {}) {
  if (click) {
    await page.locator(click).first().click({ timeout: 5000 });
  }
  if (script) {
    await page.evaluate(script);
  }
  await page.waitForTimeout(400);
}

module.exports = { createPagePreparer, dismissConsent, applyAlternateTheme };
