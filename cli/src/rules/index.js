/**
 * src/rules/index.js — Règles RGAA automatiques via Playwright
 * Injecte et exécute les règles dans le contexte de la page
 */

'use strict';

const { log } = require('../logger');

async function runDomRules(page) {
  log('   Thème 1 — Images…');
  const images = await page.evaluate(auditImages);

  log('   Thème 2 — Cadres…');
  const frames = await page.evaluate(auditFrames);

  log('   Thème 3 — Couleurs…');
  const colors = await page.evaluate(auditColors);

  log('   Thème 5 — Tableaux…');
  const tables = await page.evaluate(auditTables);

  log('   Thème 6 — Liens…');
  const links = await page.evaluate(auditLinks);

  log('   Thème 8 — Éléments obligatoires…');
  const mandatory = await page.evaluate(auditMandatory);

  log('   Thème 9 — Structure…');
  const structure = await page.evaluate(auditStructure);

  log('   Thème 11 — Formulaires…');
  const forms = await page.evaluate(auditForms);

  log('   Thème 12 — Navigation…');
  const navigation = await page.evaluate(auditNavigation);

  log('   Thème 4 — Multimédia…');
  const multimedia = await page.evaluate(auditMultimedia);

  log('   Thème 7 — Scripts ARIA…');
  const scripts = await page.evaluate(auditScripts);

  const all = [
    ...images, ...frames, ...colors, ...tables, ...links,
    ...mandatory, ...structure, ...forms, ...navigation,
    ...multimedia, ...scripts,
  ];

  const nc = all.filter(r => r.status === 'NC').length;
  const c  = all.filter(r => r.status === 'C').length;
  log(`   → ${all.length} résultats (${nc} NC, ${c} C)`);

  return all;
}

// ─────────────────────────────────────────────
// Les fonctions suivantes s'exécutent dans le
// contexte de la PAGE (page.evaluate), pas Node.
// ─────────────────────────────────────────────

function auditImages() {
  const results = [];
  const flag = (id, status, el, msg) => results.push({
    id, status, message: msg,
    snippet: el ? el.outerHTML.slice(0, 150) : null,
    source: 'dom',
  });

  document.querySelectorAll('img').forEach(img => {
    if (!img.hasAttribute('alt')) {
      flag('1.1', 'NC', img, 'Image sans attribut alt');
    } else {
      const alt = img.getAttribute('alt');
      if (alt === '') flag('1.2', 'C', img, 'Image décorative (alt vide)');
      else flag('1.1', 'C', img, `alt: "${alt.slice(0, 60)}"`);
    }
  });

  document.querySelectorAll('svg').forEach(svg => {
    const title = svg.querySelector('title');
    const ariaLabel = svg.getAttribute('aria-label');
    const ariaHidden = svg.getAttribute('aria-hidden');
    if (!ariaHidden && !title && !ariaLabel) {
      flag('1.1', 'NC', svg, 'SVG sans title/aria-label/aria-hidden');
    }
  });

  if (!results.length) flag('1.1', 'NA', null, 'Aucune image trouvée');
  return results;
}

function auditFrames() {
  const results = [];
  const flag = (id, status, el, msg) => results.push({ id, status, message: msg, snippet: el?.outerHTML?.slice(0, 150), source: 'dom' });

  const frames = document.querySelectorAll('iframe');
  if (!frames.length) { flag('2.1', 'NA', null, 'Aucun iframe'); return results; }

  frames.forEach(f => {
    const title = f.getAttribute('title');
    if (!title?.trim()) flag('2.1', 'NC', f, 'iframe sans title');
    else flag('2.1', 'C', f, `iframe title: "${title.slice(0, 60)}"`);
  });
  return results;
}

function auditColors() {
  const results = [];
  const flag = (id, status, msg) => results.push({ id, status, message: msg, source: 'dom' });

  const rgbToHex = rgb => {
    const m = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return null;
    return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
  };

  const lum = hex => {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255].map(c => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
  };

  const ratio = (f, b) => (Math.max(lum(f), lum(b)) + 0.05) / (Math.min(lum(f), lum(b)) + 0.05);

  const els = [...document.querySelectorAll('p, h1, h2, h3, li, a, button, label, td')].slice(0, 40);
  let nc = 0, ok = 0;

  els.forEach(el => {
    const s = window.getComputedStyle(el);
    const fg = rgbToHex(s.color);
    const bg = rgbToHex(s.backgroundColor);
    if (!fg || !bg) return;

    const r = ratio(fg, bg);
    const fs = parseFloat(s.fontSize);
    const fw = s.fontWeight;
    const large = fs >= 18.67 || (fs >= 14 && parseInt(fw) >= 700);
    const req = large ? 3 : 4.5;

    if (r < req) {
      nc++;
      results.push({ id: '3.2', status: 'NC', source: 'dom',
        message: `Contraste ${r.toFixed(2)}:1 (requis ${req}:1) — ${fg}/${bg}`,
        snippet: el.outerHTML.slice(0, 100),
      });
    } else ok++;
  });

  if (nc === 0 && ok > 0) flag('3.2', 'C', `Contrastes OK sur ${ok} éléments testés`);
  flag('3.1', 'NA', 'Information par couleur : vérification manuelle');
  return results;
}

function auditTables() {
  const results = [];
  const flag = (id, status, el, msg) => results.push({ id, status, message: msg, snippet: el?.outerHTML?.slice(0, 150), source: 'dom' });

  const tables = document.querySelectorAll('table');
  if (!tables.length) { flag('5.1', 'NA', null, 'Aucun tableau'); return results; }

  tables.forEach(t => {
    const ths = t.querySelectorAll('th');
    if (!ths.length) flag('5.1', 'NC', t, 'Tableau sans th');
    else {
      flag('5.1', 'C', t, `${ths.length} en-tête(s) th présent(s)`);
      ths.forEach(th => {
        if (!th.hasAttribute('scope') && !th.hasAttribute('id'))
          flag('5.6', 'NC', th, 'th sans scope ni id');
      });
    }
    const caption = t.querySelector('caption');
    if (!caption && !t.getAttribute('aria-label') && !t.getAttribute('summary'))
      flag('5.4', 'NC', t, 'Tableau sans caption ni aria-label');
    else flag('5.4', 'C', t, 'Tableau avec légende identifiable');
  });
  return results;
}

function auditLinks() {
  const results = [];
  const generics = ['cliquez ici', 'ici', 'lire la suite', 'en savoir plus', 'click here', 'read more', 'more', 'suite', '...'];

  document.querySelectorAll('a').forEach(a => {
    const text = (a.innerText || '').trim();
    const aria = a.getAttribute('aria-label') || a.getAttribute('aria-labelledby');
    const title = a.getAttribute('title');
    const imgAlt = a.querySelector('img')?.getAttribute('alt');
    const label = (aria || text || imgAlt || title || '').trim();

    const snippet = a.outerHTML.slice(0, 150);

    if (!label) {
      results.push({ id: '6.1', status: 'NC', message: 'Lien vide', snippet, source: 'dom' });
    } else if (generics.includes(label.toLowerCase())) {
      results.push({ id: '6.1', status: 'NC', message: `Lien générique : "${label}"`, snippet, source: 'dom' });
    } else {
      results.push({ id: '6.1', status: 'C', message: `Lien : "${label.slice(0, 50)}"`, snippet: null, source: 'dom' });
    }
  });

  if (!results.length) results.push({ id: '6.1', status: 'NA', message: 'Aucun lien', source: 'dom' });
  return results;
}

function auditMandatory() {
  const results = [];
  const flag = (id, status, msg) => results.push({ id, status, message: msg, source: 'dom' });

  // 8.3 Langue
  const lang = document.documentElement.getAttribute('lang');
  if (!lang?.trim()) flag('8.3', 'NC', 'Attribut lang absent sur <html>');
  else if (lang.length < 2) flag('8.3', 'NC', `lang invalide: "${lang}"`);
  else flag('8.3', 'C', `Langue: "${lang}"`);

  // 8.5 Title
  const title = document.title?.trim();
  if (!title) flag('8.5', 'NC', 'Page sans <title>');
  else if (title.length < 4) flag('8.5', 'NC', `<title> trop court: "${title}"`);
  else flag('8.5', 'C', `Titre: "${title.slice(0, 80)}"`);

  // 8.1 Doctype
  if (!document.doctype) flag('8.1', 'NC', 'DOCTYPE absent');
  else flag('8.1', 'C', `DOCTYPE: ${document.doctype.name}`);

  // 8.2 Charset
  const charset = document.querySelector('meta[charset]') || document.querySelector('meta[http-equiv="Content-Type"]');
  if (!charset) flag('8.2', 'NC', 'meta charset absent');
  else flag('8.2', 'C', 'Charset déclaré');

  return results;
}

function auditStructure() {
  const results = [];
  const flag = (id, status, el, msg) => results.push({ id, status, message: msg, snippet: el?.outerHTML?.slice(0, 100), source: 'dom' });

  // 9.1 Titres
  const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  const h1s = document.querySelectorAll('h1');

  if (!hs.length) flag('9.1', 'NC', null, 'Aucun titre (h1-h6)');
  else if (!h1s.length) flag('9.1', 'NC', null, 'Pas de h1');
  else if (h1s.length > 1) flag('9.1', 'NC', null, `${h1s.length} h1 détectés`);
  else flag('9.1', 'C', h1s[0], `h1 unique: "${h1s[0].innerText.slice(0, 60)}"`);

  let prev = 0, jumps = 0;
  hs.forEach(h => {
    const lvl = parseInt(h.tagName[1]);
    if (prev && lvl > prev + 1) { jumps++; flag('9.1', 'NC', h, `Saut h${prev}→h${lvl}`); }
    prev = lvl;
  });
  if (hs.length && !jumps) flag('9.1', 'C', null, `Hiérarchie de ${hs.length} titre(s) cohérente`);

  // 9.2 Landmarks
  const lm = { main: 'main', nav: 'nav', header: 'header', footer: 'footer' };
  Object.entries(lm).forEach(([name, sel]) => {
    const el = document.querySelector(sel);
    if (!el) flag('9.2', 'NC', null, `<${name}> absent`);
    else flag('9.2', 'C', null, `<${name}> présent`);
  });

  // 9.3 Fausses listes
  const fakeList = [...document.querySelectorAll('p')].filter(p => /^[-•*·▪▸►→]\s/.test((p.innerText || '').trim()));
  if (fakeList.length) flag('9.3', 'NC', fakeList[0], `${fakeList.length} paragraphe(s) simulant une liste`);
  else flag('9.3', 'C', null, 'Aucune liste simulée détectée');

  return results;
}

function auditForms() {
  const results = [];
  const inputs = [...document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]), select, textarea')];
  if (!inputs.length) { results.push({ id: '11.1', status: 'NA', message: 'Aucun champ de formulaire', source: 'dom' }); return results; }

  inputs.forEach(input => {
    const id = input.getAttribute('id');
    const ariaLabel = input.getAttribute('aria-label');
    const ariaLabelledby = input.getAttribute('aria-labelledby');
    const title = input.getAttribute('title');
    const placeholder = input.getAttribute('placeholder');
    const labelEl = (id && document.querySelector(`label[for="${id}"]`)) || input.closest('label');

    const snippet = input.outerHTML.slice(0, 150);

    if (!labelEl && !ariaLabel && !ariaLabelledby && !title) {
      results.push({ id: '11.1', status: 'NC', source: 'dom',
        message: placeholder
          ? `Champ sans label (placeholder seul insuffisant: "${placeholder}")`
          : `Champ sans aucune étiquette (id="${id || 'absent'}")`,
        snippet,
      });
    } else {
      const lbl = (labelEl?.innerText || ariaLabel || title || '').trim();
      results.push({ id: '11.1', status: 'C', source: 'dom', message: `Champ étiqueté: "${lbl.slice(0, 50)}"` });
    }

    if (input.hasAttribute('required') && !input.hasAttribute('aria-required')) {
      results.push({ id: '11.10', status: 'NC', source: 'dom',
        message: 'Champ required sans aria-required', snippet });
    }
  });

  return results;
}

function auditNavigation() {
  const results = [];

  // 12.1 Liens d'évitement
  const skipLinks = [...document.querySelectorAll('a[href^="#"]')].filter(a => {
    const t = (a.innerText || a.getAttribute('aria-label') || '').toLowerCase();
    return ['contenu', 'navigation', 'skip', 'aller', 'accès'].some(k => t.includes(k));
  });

  if (!skipLinks.length) results.push({ id: '12.1', status: 'NC', message: 'Aucun lien d\'évitement (ex: "Aller au contenu")', source: 'dom' });
  else results.push({ id: '12.1', status: 'C', message: `${skipLinks.length} lien(s) d'évitement`, source: 'dom' });

  // 12.8 tabindex > 0
  const badTabindex = [...document.querySelectorAll('[tabindex]')].filter(el => parseInt(el.getAttribute('tabindex')) > 0);
  if (badTabindex.length) {
    results.push({ id: '12.8', status: 'NC', source: 'dom',
      message: `${badTabindex.length} élément(s) avec tabindex > 0 (ordre de tabulation perturbé)`,
      snippet: badTabindex[0].outerHTML.slice(0, 100),
    });
  } else {
    results.push({ id: '12.8', status: 'C', message: 'Aucun tabindex > 0 détecté', source: 'dom' });
  }

  // Multiples nav sans aria-label
  const navs = document.querySelectorAll('nav');
  if (navs.length > 1) {
    [...navs].forEach(nav => {
      if (!nav.getAttribute('aria-label') && !nav.getAttribute('aria-labelledby'))
        results.push({ id: '12.6', status: 'NC', source: 'dom', message: '<nav> sans aria-label distinctif', snippet: nav.outerHTML.slice(0, 100) });
    });
  }

  return results;
}

function auditMultimedia() {
  const results = [];
  const videos = document.querySelectorAll('video');
  const audios = document.querySelectorAll('audio');
  const iframes = [...document.querySelectorAll('iframe')].filter(f =>
    /youtube|vimeo|dailymotion|twitch/.test(f.src || f.getAttribute('data-src') || '')
  );

  if (!videos.length && !audios.length && !iframes.length) {
    results.push({ id: '4.1', status: 'NA', message: 'Aucun média temporel détecté', source: 'dom' });
    return results;
  }

  [...videos].forEach(v => {
    const track = v.querySelector('track[kind="subtitles"], track[kind="captions"]');
    results.push({ id: '4.1', status: track ? 'C' : 'NC', source: 'dom',
      message: track ? 'Vidéo avec piste sous-titres' : 'Vidéo sans sous-titres (<track> manquant)',
      snippet: v.outerHTML.slice(0, 150),
    });
  });

  if (iframes.length) results.push({ id: '4.1', status: 'NA', message: `${iframes.length} médias embarqués (YouTube/Vimeo) — sous-titres à vérifier manuellement`, source: 'dom' });
  results.push({ id: '4.3', status: 'NA', message: 'Audio-description : vérification manuelle', source: 'dom' });

  return results;
}

function auditScripts() {
  const results = [];
  const valid = new Set(['button','link','menuitem','tab','tabpanel','dialog','alert','alertdialog','banner','complementary','contentinfo','form','main','navigation','region','search','article','checkbox','combobox','grid','gridcell','heading','img','list','listbox','listitem','menu','menubar','option','progressbar','radio','radiogroup','row','rowgroup','scrollbar','separator','slider','spinbutton','status','switch','table','textbox','timer','toolbar','tooltip','tree','treegrid','treeitem']);

  document.querySelectorAll('[role]').forEach(el => {
    const role = el.getAttribute('role');
    if (!valid.has(role)) {
      results.push({ id: '7.1', status: 'NC', source: 'dom',
        message: `Rôle ARIA invalide: role="${role}"`,
        snippet: el.outerHTML.slice(0, 100),
      });
    }
  });

  document.querySelectorAll('div[onclick], span[onclick]').forEach(el => {
    if (el.getAttribute('role') !== 'button')
      results.push({ id: '7.3', status: 'NC', source: 'dom', message: 'Élément cliquable non-natif sans role="button"', snippet: el.outerHTML.slice(0, 100) });
    if (!el.hasAttribute('tabindex'))
      results.push({ id: '7.3', status: 'NC', source: 'dom', message: 'Élément cliquable non-natif sans tabindex', snippet: el.outerHTML.slice(0, 100) });
  });

  if (!results.length) results.push({ id: '7.1', status: 'C', message: 'Rôles ARIA valides', source: 'dom' });
  return results;
}

module.exports = { runDomRules };
