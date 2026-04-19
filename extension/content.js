/**
 * RGAA Audit — content.js
 * Extension Chrome MV3 — Injection & audit DOM réel
 * Couvre ~40 critères RGAA 4.1 automatisables
 */

'use strict';

// ─────────────────────────────────────────────
// MOTEUR D'AUDIT
// ─────────────────────────────────────────────

const results = [];

function flag(criterionId, status, element, message, snippet = null) {
  results.push({
    id: criterionId,
    status, // 'NC' | 'C' | 'NA'
    message,
    snippet: snippet || (element ? getSnippet(element) : null),
    xpath: element ? getXPath(element) : null,
  });
}

function getSnippet(el) {
  try {
    return el.outerHTML.slice(0, 200).replace(/\s+/g, ' ');
  } catch { return null; }
}

function getXPath(el) {
  if (!el || el.nodeType !== 1) return null;
  const parts = [];
  let node = el;
  while (node && node.nodeType === 1) {
    let idx = 1;
    let sib = node.previousSibling;
    while (sib) { if (sib.nodeType === 1 && sib.tagName === node.tagName) idx++; sib = sib.previousSibling; }
    parts.unshift(`${node.tagName.toLowerCase()}[${idx}]`);
    node = node.parentNode;
  }
  return '/' + parts.join('/');
}

function getContrastRatio(fgHex, bgHex) {
  const lum = hex => {
    const rgb = parseInt(hex.slice(1), 16);
    const r = (rgb >> 16) / 255, g = ((rgb >> 8) & 0xff) / 255, b = (rgb & 0xff) / 255;
    return [r, g, b].map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
      .reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i], 0);
  };
  const l1 = lum(fgHex), l2 = lum(bgHex);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function rgbToHex(rgb) {
  const m = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
}

function escapeCssIdentifier(value) {
  const input = String(value ?? '');
  if (typeof CSS !== 'undefined' && CSS && typeof CSS.escape === 'function') {
    return CSS.escape(input);
  }
  // Fallback défensif simple si CSS.escape est indisponible.
  return input.replace(/\u0000/g, '\uFFFD').replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

function buildLabelForSelectorById(id) {
  return `label[for="${escapeCssIdentifier(id)}"]`;
}

// ─────────────────────────────────────────────
// THÈME 1 — IMAGES
// ─────────────────────────────────────────────

function auditImages() {
  const imgs = document.querySelectorAll('img');
  if (!imgs.length) { flag('1.1', 'NA', null, 'Aucune image trouvée'); return; }

  imgs.forEach(img => {
    // 1.1 — Présence de l'attribut alt
    if (!img.hasAttribute('alt')) {
      flag('1.1', 'NC', img, 'Image sans attribut alt');
    } else {
      // 1.2 — Image décorative : alt="" ET (role=presentation OU aria-hidden)
      const alt = img.getAttribute('alt');
      if (alt === '') {
        // OK si vraiment décorative
        flag('1.2', 'C', img, 'Image décorative correctement masquée (alt vide)');
      } else {
        flag('1.1', 'C', img, `Image avec alt : "${alt.slice(0, 60)}"`);
      }
    }

    // 1.6 — Images complexes (svg, figure+figcaption)
    if (img.hasAttribute('longdesc') || img.getAttribute('aria-describedby')) {
      flag('1.6', 'C', img, 'Image complexe avec description longue');
    }
  });

  // SVG inline
  document.querySelectorAll('svg').forEach(svg => {
    const title = svg.querySelector('title');
    const ariaLabel = svg.getAttribute('aria-label');
    const ariaHidden = svg.getAttribute('aria-hidden');
    if (!ariaHidden && !title && !ariaLabel) {
      flag('1.1', 'NC', svg, 'SVG inline sans title ni aria-label ni aria-hidden');
    }
  });

  // Images CSS background (non détectables automatiquement → signaler)
  flag('1.1', 'NA', null, 'Images CSS background : non vérifiables automatiquement — audit manuel requis');
}

// ─────────────────────────────────────────────
// THÈME 2 — CADRES (IFRAMES)
// ─────────────────────────────────────────────

function auditFrames() {
  const frames = document.querySelectorAll('iframe');
  if (!frames.length) { flag('2.1', 'NA', null, 'Aucun iframe trouvé'); return; }

  frames.forEach(iframe => {
    const title = iframe.getAttribute('title');
    if (!title || !title.trim()) {
      flag('2.1', 'NC', iframe, 'iframe sans attribut title');
    } else {
      flag('2.1', 'C', iframe, `iframe avec title : "${title.slice(0, 60)}"`);
      // 2.2 — Pertinence du titre : non automatisable, on signale
      flag('2.2', 'NA', iframe, 'Pertinence du title iframe : vérification manuelle requise');
    }
  });
}

// ─────────────────────────────────────────────
// THÈME 3 — COULEURS
// ─────────────────────────────────────────────

function auditColors() {
  // Échantillon de textes visibles
  const textEls = [...document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, label, a, span, button')]
    .filter(el => el.innerText && el.innerText.trim().length > 0)
    .slice(0, 30); // limité pour la perf

  let ncCount = 0, cCount = 0;

  textEls.forEach(el => {
    const style = window.getComputedStyle(el);
    const fgRgb = style.color;
    const bgRgb = style.backgroundColor;
    const fgHex = rgbToHex(fgRgb);
    const bgHex = rgbToHex(bgRgb);
    if (!fgHex || !bgHex || bgHex === '#00000000') return;

    const ratio = getContrastRatio(fgHex, bgHex);
    const fontSize = parseFloat(style.fontSize);
    const fontWeight = style.fontWeight;
    const isLarge = fontSize >= 18.67 || (fontSize >= 14 && (fontWeight === 'bold' || parseInt(fontWeight) >= 700));
    const required = isLarge ? 3 : 4.5;

    if (ratio < required) {
      ncCount++;
      flag('3.2', 'NC', el,
        `Contraste insuffisant : ${ratio.toFixed(2)}:1 (requis ${required}:1) — fg:${fgHex} bg:${bgHex}`
      );
    } else {
      cCount++;
    }
  });

  if (ncCount === 0 && cCount > 0) {
    flag('3.2', 'C', null, `Contrastes texte vérifiés sur ${cCount} éléments — tous conformes`);
  }

  // 3.1 — Info par couleur seule : non automatisable
  flag('3.1', 'NA', null, 'Information par couleur uniquement : vérification manuelle requise');
  flag('3.3', 'NA', null, 'Contraste composants UI (boutons, champs) : vérification manuelle recommandée');
}

// ─────────────────────────────────────────────
// THÈME 5 — TABLEAUX
// ─────────────────────────────────────────────

function auditTables() {
  const tables = document.querySelectorAll('table');
  if (!tables.length) { flag('5.1', 'NA', null, 'Aucun tableau trouvé'); return; }

  tables.forEach(table => {
    const ths = table.querySelectorAll('th');
    const caption = table.querySelector('caption');
    const summary = table.getAttribute('summary');
    const ariaLabel = table.getAttribute('aria-label') || table.getAttribute('aria-labelledby');

    // 5.1 — En-têtes présents
    if (!ths.length) {
      flag('5.1', 'NC', table, 'Tableau sans cellules th (en-têtes)');
    } else {
      flag('5.1', 'C', table, `Tableau avec ${ths.length} en-tête(s) th`);
    }

    // 5.4 — Résumé pour tableaux complexes
    if (!caption && !summary && !ariaLabel) {
      flag('5.4', 'NC', table, 'Tableau sans caption ni summary ni aria-label');
    } else {
      flag('5.4', 'C', table, 'Tableau avec titre/résumé identifiable');
    }

    // 5.6 — scope sur les th
    ths.forEach(th => {
      if (!th.hasAttribute('scope') && !th.hasAttribute('id')) {
        flag('5.6', 'NC', th, 'En-tête th sans attribut scope ni id');
      }
    });
  });
}

// ─────────────────────────────────────────────
// THÈME 6 — LIENS
// ─────────────────────────────────────────────

function auditLinks() {
  const links = document.querySelectorAll('a');
  if (!links.length) { flag('6.1', 'NA', null, 'Aucun lien trouvé'); return; }

  const genericLabels = ['cliquez ici', 'ici', 'lire la suite', 'en savoir plus', 'click here', 'read more', 'more', 'suite', '...', 'voir'];

  links.forEach(link => {
    const text = (link.innerText || '').trim().toLowerCase();
    const ariaLabel = link.getAttribute('aria-label');
    const ariaLabelledby = link.getAttribute('aria-labelledby');
    const title = link.getAttribute('title');
    const imgAlt = link.querySelector('img')?.getAttribute('alt');

    const label = ariaLabel || ariaLabelledby || text || imgAlt || title || '';

    // 6.2 — Lien image
    if (link.querySelector('img') && !text) {
      if (!imgAlt && !ariaLabel) {
        flag('6.2', 'NC', link, 'Lien image sans alternative textuelle (alt manquant sur img dans lien)');
      } else {
        flag('6.2', 'C', link, 'Lien image avec alternative');
      }
      return;
    }

    // 6.1 — Intitulé vide
    if (!label) {
      flag('6.1', 'NC', link, 'Lien sans intitulé (vide)');
      return;
    }

    // 6.1 — Intitulé générique
    if (genericLabels.includes(label.toLowerCase())) {
      flag('6.1', 'NC', link, `Intitulé de lien générique : "${label}"`);
      return;
    }

    flag('6.1', 'C', link, `Lien : "${label.slice(0, 60)}"`);
  });
}

// ─────────────────────────────────────────────
// THÈME 8 — ÉLÉMENTS OBLIGATOIRES
// ─────────────────────────────────────────────

function auditMandatory() {
  // 8.3 — Langue de la page
  const lang = document.documentElement.getAttribute('lang');
  if (!lang || !lang.trim()) {
    flag('8.3', 'NC', document.documentElement, 'Attribut lang absent sur <html>');
  } else if (lang.length < 2) {
    flag('8.3', 'NC', document.documentElement, `Attribut lang invalide : "${lang}"`);
  } else {
    flag('8.3', 'C', null, `Langue déclarée : "${lang}"`);
  }

  // 8.5 — Titre de la page
  const title = document.title;
  if (!title || !title.trim()) {
    flag('8.5', 'NC', null, 'Page sans <title>');
  } else if (title.trim().length < 4) {
    flag('8.5', 'NC', null, `<title> trop court ou générique : "${title}"`);
  } else {
    flag('8.5', 'C', null, `Titre de page : "${title.slice(0, 80)}"`);
  }

  // 8.1 / 8.2 — Doctype et validité de base
  const doctype = document.doctype;
  if (!doctype) {
    flag('8.1', 'NC', null, 'DOCTYPE absent');
  } else {
    flag('8.1', 'C', null, `DOCTYPE présent : ${doctype.name}`);
  }

  // Charset
  const charsetMeta = document.querySelector('meta[charset]') || document.querySelector('meta[http-equiv="Content-Type"]');
  if (!charsetMeta) {
    flag('8.2', 'NC', null, 'Encodage de caractères non déclaré (meta charset absent)');
  } else {
    flag('8.2', 'C', null, 'Encodage de caractères déclaré');
  }
}

// ─────────────────────────────────────────────
// THÈME 9 — STRUCTURE DE L'INFORMATION
// ─────────────────────────────────────────────

function auditStructure() {
  // 9.1 — Hiérarchie des titres
  const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')];

  if (!headings.length) {
    flag('9.1', 'NC', null, 'Aucun titre (h1-h6) trouvé dans la page');
  } else {
    const h1s = document.querySelectorAll('h1');
    if (h1s.length === 0) {
      flag('9.1', 'NC', null, 'Pas de h1 dans la page');
    } else if (h1s.length > 1) {
      flag('9.1', 'NC', null, `Plusieurs h1 détectés (${h1s.length}) — un seul h1 attendu`);
    } else {
      flag('9.1', 'C', null, `h1 unique trouvé : "${h1s[0].innerText.slice(0, 60)}"`);
    }

    // Vérifier les sauts de niveau
    let prevLevel = 0;
    let hasJump = false;
    headings.forEach(h => {
      const level = parseInt(h.tagName[1]);
      if (prevLevel > 0 && level > prevLevel + 1) {
        flag('9.1', 'NC', h, `Saut de niveau de titre : h${prevLevel} → h${level}`);
        hasJump = true;
      }
      prevLevel = level;
    });
    if (!hasJump) {
      flag('9.1', 'C', null, `Hiérarchie de ${headings.length} titre(s) cohérente`);
    }
  }

  // 9.2 — Landmarks HTML5
  const main = document.querySelector('main');
  const nav = document.querySelector('nav');
  const header = document.querySelector('header');
  const footer = document.querySelector('footer');

  if (!main) flag('9.2', 'NC', null, 'Élément <main> absent');
  else flag('9.2', 'C', null, 'Élément <main> présent');

  if (!nav) flag('9.2', 'NC', null, 'Élément <nav> absent (navigation principale non balisée)');
  else flag('9.2', 'C', null, 'Élément <nav> présent');

  if (!header) flag('9.2', 'NC', null, 'Élément <header> absent');
  if (!footer) flag('9.2', 'NC', null, 'Élément <footer> absent');

  if (main && nav && header) flag('9.2', 'C', null, 'Structure landmarks HTML5 présente (main, nav, header)');

  // 9.3 — Listes
  // Détecter des listes simulées avec des tirets ou puces dans des paragraphes
  const paras = [...document.querySelectorAll('p')];
  const fakeListRegex = /^[-•*·▪▸►→]\s/;
  const fakeLists = paras.filter(p => fakeListRegex.test((p.innerText || '').trim()));
  if (fakeLists.length > 0) {
    flag('9.3', 'NC', fakeLists[0], `${fakeLists.length} paragraphe(s) simulant une liste avec caractères spéciaux — utiliser <ul>/<ol>`);
  } else {
    flag('9.3', 'C', null, 'Aucune liste simulée détectée dans les paragraphes');
  }

  // Vérifier que les listes réelles utilisent ul/ol/dl
  const uls = document.querySelectorAll('ul, ol, dl');
  flag('9.3', uls.length > 0 ? 'C' : 'NA', null, `${uls.length} liste(s) HTML structurée(s) trouvée(s)`);
}

// ─────────────────────────────────────────────
// THÈME 11 — FORMULAIRES
// ─────────────────────────────────────────────

function auditForms() {
  const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea');
  if (!inputs.length) { flag('11.1', 'NA', null, 'Aucun champ de formulaire trouvé'); return; }

  inputs.forEach(input => {
    try {
      const id = input.getAttribute('id');
      const ariaLabel = input.getAttribute('aria-label');
      const ariaLabelledby = input.getAttribute('aria-labelledby');
      const title = input.getAttribute('title');
      const placeholder = input.getAttribute('placeholder');

      // Label associé via for/id
      let associatedLabel = null;
      if (id) {
        associatedLabel = document.querySelector(buildLabelForSelectorById(id));
      }
      // Label parent
      const parentLabel = input.closest('label');

      const hasLabel = associatedLabel || parentLabel;
      const hasAriaLabel = ariaLabel || ariaLabelledby;

      // 11.1 — Étiquette présente
      if (!hasLabel && !hasAriaLabel && !title) {
        if (placeholder) {
          flag('11.1', 'NC', input,
            `Champ sans label (placeholder "${placeholder}" seul n'est pas suffisant)`
          );
        } else {
          flag('11.1', 'NC', input, `Champ sans aucune étiquette (id="${id || 'absent'}")`);
        }
      } else {
        const labelText = (associatedLabel?.innerText || parentLabel?.innerText || ariaLabel || title || '').trim();
        flag('11.1', 'C', input, `Champ étiqueté : "${labelText.slice(0, 60)}"`);
      }

      // Champs required sans aria-required
      if (input.hasAttribute('required') && !input.hasAttribute('aria-required')) {
        flag('11.10', 'NC', input, 'Champ required sans aria-required (accessibilité AT dégradée)');
      }
    } catch {
      // Erreur isolée sur un champ: on continue l'audit de la boucle.
    }
  });

  // Boutons de formulaire
  document.querySelectorAll('button, input[type="submit"], input[type="button"]').forEach(btn => {
    const label = btn.innerText?.trim() || btn.getAttribute('value') || btn.getAttribute('aria-label') || btn.getAttribute('title');
    if (!label) {
      flag('11.1', 'NC', btn, 'Bouton sans intitulé');
    }
  });
}

// ─────────────────────────────────────────────
// THÈME 12 — NAVIGATION
// ─────────────────────────────────────────────

function auditNavigation() {
  // 12.1 — Liens d'évitement
  const skipLinks = [...document.querySelectorAll('a[href^="#"]')].filter(a => {
    const text = (a.innerText || a.getAttribute('aria-label') || '').toLowerCase();
    return text.includes('contenu') || text.includes('navigation') || text.includes('skip') || text.includes('aller') || text.includes('accès');
  });

  if (!skipLinks.length) {
    flag('12.1', 'NC', null, 'Aucun lien d\'évitement détecté (ex: "Aller au contenu")');
  } else {
    flag('12.1', 'C', null, `${skipLinks.length} lien(s) d'évitement détecté(s)`);
  }

  // Zones de navigation multiples sans aria-label
  const navs = document.querySelectorAll('nav');
  if (navs.length > 1) {
    navs.forEach(nav => {
      if (!nav.getAttribute('aria-label') && !nav.getAttribute('aria-labelledby')) {
        flag('12.6', 'NC', nav, 'Plusieurs <nav> présents sans aria-label distinctif');
      }
    });
  }

  // 12.8 — Ordre de tabulation (vérification partielle : tabindex > 0)
  const posTabindex = document.querySelectorAll('[tabindex]');
  const problematic = [...posTabindex].filter(el => parseInt(el.getAttribute('tabindex')) > 0);
  if (problematic.length > 0) {
    flag('12.8', 'NC', problematic[0],
      `${problematic.length} élément(s) avec tabindex > 0 détecté(s) — ordre de tabulation potentiellement perturbé`
    );
  } else {
    flag('12.8', 'C', null, 'Aucun tabindex > 0 détecté');
  }
}

// ─────────────────────────────────────────────
// THÈME 10 — PRÉSENTATION (partiel auto)
// ─────────────────────────────────────────────

function auditPresentation() {
  // 10.7 — Focus visible (vérification CSS outline:none)
  const styleSheets = [...document.styleSheets];
  let outlineNoneFound = false;
  try {
    styleSheets.forEach(sheet => {
      try {
        const rules = [...sheet.cssRules || []];
        rules.forEach(rule => {
          if (rule.selectorText && rule.selectorText.includes(':focus')) {
            const style = rule.style;
            if (style.outline === 'none' || style.outline === '0' || style.outlineWidth === '0px') {
              outlineNoneFound = true;
              flag('10.7', 'NC', null, `CSS :focus { outline: none } détecté dans "${sheet.href || 'style inline'}" — focus potentiellement invisible`);
            }
          }
        });
      } catch { /* cross-origin stylesheet */ }
    });
  } catch {}

  if (!outlineNoneFound) {
    flag('10.7', 'C', null, 'Aucune suppression CSS de outline:focus détectée');
  }

  // Texte en image (détection basique via img avec texte dans alt)
  document.querySelectorAll('img').forEach(img => {
    const alt = img.getAttribute('alt') || '';
    if (alt.split(' ').length > 6) {
      flag('10.1', 'NC', img, `Image avec alt long (probable texte en image) : "${alt.slice(0, 80)}"`);
    }
  });
}

// ─────────────────────────────────────────────
// THÈME 4 — MULTIMÉDIA (détection uniquement)
// ─────────────────────────────────────────────

function auditMultimedia() {
  const videos = document.querySelectorAll('video');
  const audios = document.querySelectorAll('audio');
  const iframeMedia = [...document.querySelectorAll('iframe')].filter(f =>
    /youtube|vimeo|dailymotion|twitch/.test(f.src || f.getAttribute('data-src') || '')
  );

  const total = videos.length + audios.length + iframeMedia.length;
  if (!total) { flag('4.1', 'NA', null, 'Aucun média temporel détecté'); return; }

  videos.forEach(v => {
    const track = v.querySelector('track[kind="subtitles"], track[kind="captions"]');
    if (!track) flag('4.1', 'NC', v, 'Vidéo sans sous-titres (<track kind="subtitles/captions"> absent)');
    else flag('4.1', 'C', v, 'Vidéo avec piste de sous-titres');
  });

  if (iframeMedia.length) {
    flag('4.1', 'NA', null, `${iframeMedia.length} média(s) embarqué(s) (YouTube/Vimeo…) — sous-titres à vérifier manuellement`);
  }

  flag('4.3', 'NA', null, 'Audio-description vidéo : vérification manuelle requise');
}

// ─────────────────────────────────────────────
// THÈME 7 — SCRIPTS ARIA (partiel)
// ─────────────────────────────────────────────

function auditScripts() {
  // Composants ARIA sans rôle/état valide
  const ariaEls = document.querySelectorAll('[role]');
  const validRoles = ['button','link','menuitem','tab','tabpanel','dialog','alert','alertdialog','banner','complementary','contentinfo','form','main','navigation','region','search','article','checkbox','combobox','grid','gridcell','heading','img','list','listbox','listitem','menu','menubar','menuitemcheckbox','menuitemradio','option','progressbar','radio','radiogroup','row','rowgroup','rowheader','scrollbar','separator','slider','spinbutton','status','switch','table','textbox','timer','toolbar','tooltip','tree','treegrid','treeitem'];

  ariaEls.forEach(el => {
    const role = el.getAttribute('role');
    if (!validRoles.includes(role)) {
      flag('7.1', 'NC', el, `Rôle ARIA inconnu ou invalide : role="${role}"`);
    }
  });

  // Boutons non-natifs sans role=button
  document.querySelectorAll('div[onclick], span[onclick]').forEach(el => {
    if (!el.getAttribute('role') || el.getAttribute('role') !== 'button') {
      flag('7.3', 'NC', el, 'Élément cliquable non-natif sans role="button" (non accessible clavier)');
    }
    if (!el.hasAttribute('tabindex')) {
      flag('7.3', 'NC', el, 'Élément cliquable non-natif sans tabindex (non focusable au clavier)');
    }
  });
}

// ─────────────────────────────────────────────
// CALCUL DU TAUX DE CONFORMITÉ
// ─────────────────────────────────────────────

function computeScore(results) {
  const byCriterion = {};
  results.forEach(r => {
    if (!byCriterion[r.id]) byCriterion[r.id] = [];
    byCriterion[r.id].push(r.status);
  });

  let conformes = 0, nonConformes = 0, na = 0;
  Object.entries(byCriterion).forEach(([id, statuses]) => {
    if (statuses.includes('NC')) nonConformes++;
    else if (statuses.every(s => s === 'NA')) na++;
    else conformes++;
  });

  const applicable = conformes + nonConformes;
  return {
    taux: applicable > 0 ? Math.round((conformes / applicable) * 100) : 0,
    conformes, nonConformes, na,
    total: Object.keys(byCriterion).length
  };
}

// ─────────────────────────────────────────────
// LANCEMENT DE L'AUDIT COMPLET
// ─────────────────────────────────────────────

function runAudit() {
  results.length = 0; // reset
  const report = {
    results,
    score: null,
    url: location.href,
    timestamp: new Date().toISOString(),
    internalErrors: [],
  };

  safeRunAuditSection('images', auditImages, report);
  safeRunAuditSection('frames', auditFrames, report);
  safeRunAuditSection('colors', auditColors, report);
  safeRunAuditSection('tables', auditTables, report);
  safeRunAuditSection('links', auditLinks, report);
  safeRunAuditSection('mandatory', auditMandatory, report);
  safeRunAuditSection('structure', auditStructure, report);
  safeRunAuditSection('forms', auditForms, report);
  safeRunAuditSection('navigation', auditNavigation, report);
  safeRunAuditSection('presentation', auditPresentation, report);
  safeRunAuditSection('multimedia', auditMultimedia, report);
  safeRunAuditSection('scripts', auditScripts, report);

  report.score = computeScore(results);
  return report;
}

function safeRunAuditSection(name, fn, report) {
  try {
    fn();
  } catch (error) {
    report.internalErrors.push({
      section: name,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

// ─────────────────────────────────────────────
// INTERFACE AVEC LE BACKGROUND / PANEL
// ─────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.action !== 'runAudit') {
    sendResponse({ success: false, error: 'Action non autorisée.' });
    return false;
  }

  if (sender?.id && sender.id !== chrome.runtime.id) {
    sendResponse({ success: false, error: 'Émetteur non autorisé.' });
    return false;
  }

  if (message.action === 'runAudit') {
    try {
      const report = runAudit();
      sendResponse({ success: true, report });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  }
  return true; // keep channel open for async
});

// Auto-run si demandé via badge
console.log('[RGAA Audit] content.js chargé sur', location.href);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escapeCssIdentifier,
    buildLabelForSelectorById,
    safeRunAuditSection,
    auditForms,
    runAudit,
    _results: results,
  };
}
