/**
 * src/rules/index.js — Règles RGAA 4.1 automatiques v0.2.0
 * Semaines 2 & 3 : faux positifs corrigés + nouveaux critères
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
  log('   Thème 10 — Présentation…');
  const presentation = await page.evaluate(auditPresentation);
  log('   Thème 11 — Formulaires…');
  const forms = await page.evaluate(auditForms);
  log('   Thème 12 — Navigation…');
  const navigation = await page.evaluate(auditNavigation);
  log('   Thème 4 — Multimédia…');
  const multimedia = await page.evaluate(auditMultimedia);
  log('   Thème 7 — Scripts…');
  const scripts = await page.evaluate(auditScripts);
  log('   Thème 13 — Consultation…');
  const consultation = await page.evaluate(auditConsultation);

  const all = [
    ...images, ...frames, ...colors, ...tables, ...links,
    ...mandatory, ...structure, ...presentation, ...forms,
    ...navigation, ...multimedia, ...scripts, ...consultation,
  ];

  const nc = all.filter(r => r.status === 'NC').length;
  const c  = all.filter(r => r.status === 'C').length;
  log(`   → ${all.length} résultats (${nc} NC, ${c} C)`);
  return all;
}

// ─── HELPERS (exécutés dans page.evaluate) ───

function isVisible(el, s) {
  if (!s) s = window.getComputedStyle(el);
  if (s.display === 'none' || s.visibility === 'hidden') return false;
  if (parseFloat(s.opacity) === 0) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function isTransparent(color) {
  if (!color || color === 'transparent') return true;
  const m = color.match(/rgba?\(\d+,\s*\d+,\s*\d+,?\s*([\d.]*)\)/);
  return m && m[1] !== '' && parseFloat(m[1]) === 0;
}

function effectiveBg(el) {
  let node = el;
  while (node && node !== document.body) {
    const bg = window.getComputedStyle(node).backgroundColor;
    if (!isTransparent(bg)) return bg;
    node = node.parentElement;
  }
  const bodyBg = window.getComputedStyle(document.body).backgroundColor;
  return isTransparent(bodyBg) ? 'rgb(255,255,255)' : bodyBg;
}

// ─── THÈME 1 — IMAGES ────────────────────────

function auditImages() {
  const R = [];
  const f = (id, st, el, msg) => R.push({ id, status: st, message: msg, snippet: el?.outerHTML?.slice(0,150), source:'dom' });

  document.querySelectorAll('img').forEach(img => {
    if (!img.hasAttribute('alt')) f('1.1','NC',img,'Image sans alt');
    else if (img.getAttribute('alt') === '') f('1.2','C',img,'Image décorative (alt vide)');
    else f('1.1','C',img,`alt: "${img.getAttribute('alt').slice(0,60)}"`);
  });

  document.querySelectorAll('svg').forEach(svg => {
    // ✅ FIX : SVG dans bouton/lien déjà étiqueté → pas de NC
    const parent = svg.closest('button, a, [role="button"]');
    if (parent) {
      const pl = (parent.getAttribute('aria-label') || parent.innerText || '').trim();
      if (pl) return;
    }
    const ariaHidden = svg.getAttribute('aria-hidden');
    const role = svg.getAttribute('role');
    if (ariaHidden === 'true' || role === 'presentation' || role === 'none') return;
    if (!svg.querySelector('title') && !svg.getAttribute('aria-label'))
      f('1.1','NC',svg,'SVG sans title/aria-label ni aria-hidden');
  });

  if (!R.length) f('1.1','NA',null,'Aucune image');
  return R;
}

// ─── THÈME 2 — CADRES ────────────────────────

function auditFrames() {
  const R = [];
  const f = (id, st, el, msg) => R.push({ id, status: st, message: msg, snippet: el?.outerHTML?.slice(0,100), source:'dom' });
  const frames = document.querySelectorAll('iframe');
  if (!frames.length) { f('2.1','NA',null,'Aucun iframe'); return R; }
  frames.forEach(fr => {
    const t = fr.getAttribute('title');
    t?.trim() ? f('2.1','C',fr,`title: "${t.slice(0,60)}"`) : f('2.1','NC',fr,'iframe sans title');
  });
  return R;
}

// ─── THÈME 3 — COULEURS (CORRIGÉ) ───────────

function auditColors() {
  const R = [];
  const f = (id, st, msg) => R.push({ id, status: st, message: msg, source:'dom' });

  const hex = rgb => {
    const m = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return m ? '#'+[m[1],m[2],m[3]].map(n=>parseInt(n).toString(16).padStart(2,'0')).join('') : null;
  };
  const lum = h => {
    const n = parseInt(h.slice(1),16);
    return [n>>16,(n>>8)&255,n&255].map(c=>{c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);})
      .reduce((a,c,i)=>a+c*[0.2126,0.7152,0.0722][i],0);
  };
  const cr = (a,b) => (Math.max(lum(a),lum(b))+0.05)/(Math.min(lum(a),lum(b))+0.05);

  let nc=0, ok=0;
  const els = [...document.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,a,button,label,td,span,th')].slice(0,60);

  els.forEach(el => {
    const s = window.getComputedStyle(el);
    // ✅ FIX 1 : ignorer éléments invisibles
    if (!isVisible(el, s)) return;
    // ✅ FIX 2 : ignorer si pas de texte direct
    const directText = [...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('');
    if (!directText) return;
    // ✅ FIX 3 : remonter pour trouver le vrai fond
    const fg = hex(s.color);
    if (!fg) return;
    const bgRaw = isTransparent(s.backgroundColor) ? effectiveBg(el) : s.backgroundColor;
    const bg = hex(bgRaw);
    if (!bg) return;
    const ratio = cr(fg, bg);
    const fs = parseFloat(s.fontSize);
    const fw = parseInt(s.fontWeight)||400;
    const large = fs >= 18.67 || (fs >= 14 && fw >= 700);
    const req = large ? 3 : 4.5;
    if (ratio < req) {
      nc++;
      R.push({ id:'3.2', status:'NC', source:'dom',
        message:`Contraste ${ratio.toFixed(2)}:1 (requis ${req}:1) — fg:${fg} bg:${bg}`,
        snippet: el.outerHTML.slice(0,100) });
    } else ok++;
  });

  if (nc===0 && ok>0) f('3.2','C',`Contrastes OK sur ${ok} éléments visibles`);
  else if (nc===0 && ok===0) f('3.2','NA','Aucun élément textuel visible à analyser');
  f('3.1','NA','Information par couleur : vérification manuelle');
  return R;
}

// ─── THÈME 5 — TABLEAUX ──────────────────────

function auditTables() {
  const R = [];
  const f = (id, st, el, msg) => R.push({ id, status: st, message: msg, snippet: el?.outerHTML?.slice(0,150), source:'dom' });
  const tables = document.querySelectorAll('table');
  if (!tables.length) { f('5.1','NA',null,'Aucun tableau'); return R; }
  tables.forEach(t => {
    const role = t.getAttribute('role');
    if (role === 'presentation' || role === 'none') { f('5.1','C',t,'Tableau de présentation'); return; }
    const ths = t.querySelectorAll('th');
    if (!ths.length) f('5.1','NC',t,'Tableau sans en-têtes th');
    else {
      f('5.1','C',t,`${ths.length} th`);
      ths.forEach(th => { if (!th.hasAttribute('scope') && !th.hasAttribute('id')) f('5.6','NC',th,'th sans scope'); });
    }
    const hasLabel = t.querySelector('caption') || t.getAttribute('aria-label') || t.getAttribute('summary');
    hasLabel ? f('5.4','C',t,'Tableau avec légende') : f('5.4','NC',t,'Tableau sans caption ni aria-label');
  });
  return R;
}

// ─── THÈME 6 — LIENS (CORRIGÉ) ───────────────

function auditLinks() {
  const R = [];
  const generics = new Set(['cliquez ici','ici','lire la suite','en savoir plus','click here','read more','more','suite','...','voir','voir plus','voir tout','plus','suivant','précédent']);
  document.querySelectorAll('a[href]').forEach(a => {
    const text = (a.innerText||'').trim();
    const aria = a.getAttribute('aria-label');
    const title = a.getAttribute('title');
    const imgAlt = a.querySelector('img')?.getAttribute('alt');
    const label = (aria||text||imgAlt||title||'').trim();
    const snippet = a.outerHTML.slice(0,150);

    if (!label) { R.push({ id:'6.1', status:'NC', message:'Lien vide', snippet, source:'dom' }); return; }
    // ✅ FIX : aria-label explicite → pas générique
    if (aria && aria.trim().length > 5) { R.push({ id:'6.1', status:'C', message:`aria-label: "${aria.slice(0,50)}"`, source:'dom' }); return; }
    if (generics.has(label.toLowerCase())) {
      const h = a.closest('article,section,li')?.querySelector('h1,h2,h3,h4,h5,h6');
      R.push({ id:'6.1', status:'NC', source:'dom',
        message: h ? `Générique "${label}" (contexte: "${h.innerText.slice(0,40)}")` : `Générique: "${label}"`,
        snippet });
    } else {
      R.push({ id:'6.1', status:'C', message:`Lien: "${label.slice(0,60)}"`, source:'dom' });
    }
  });
  if (!R.length) R.push({ id:'6.1', status:'NA', message:'Aucun lien', source:'dom' });
  return R;
}

// ─── THÈME 8 — ÉLÉMENTS OBLIGATOIRES (ENRICHI)

function auditMandatory() {
  const R = [];
  const f = (id, st, msg, sn) => R.push({ id, status: st, message: msg, snippet: sn, source:'dom' });

  const lang = document.documentElement.getAttribute('lang');
  if (!lang?.trim()) f('8.3','NC','lang absent sur <html>');
  else if (lang.length < 2) f('8.3','NC',`lang invalide: "${lang}"`);
  else f('8.3','C',`lang: "${lang}"`);

  const title = document.title?.trim();
  if (!title) f('8.5','NC','Page sans <title>');
  else if (title.length < 4) f('8.5','NC',`<title> trop court: "${title}"`);
  else f('8.5','C',`Titre: "${title.slice(0,80)}"`);

  document.doctype ? f('8.1','C',`DOCTYPE: ${document.doctype.name}`) : f('8.1','NC','DOCTYPE absent');

  const charset = document.querySelector('meta[charset]') || document.querySelector('meta[http-equiv="Content-Type"]');
  charset ? f('8.2','C','Charset déclaré') : f('8.2','NC','meta charset absent');

  // ✅ NOUVEAU 8.7 — Changements de langue inline
  const inlineLangs = [...document.querySelectorAll('[lang]')].filter(el => el !== document.documentElement);
  if (inlineLangs.length) {
    let bad = 0;
    inlineLangs.forEach(el => {
      const l = el.getAttribute('lang');
      if (!l || l.length < 2) { bad++; f('8.7','NC',`lang inline invalide: "${l}"`, el.outerHTML.slice(0,100)); }
    });
    if (!bad) f('8.7','C',`${inlineLangs.length} changement(s) de langue inline valide(s)`);
  } else f('8.7','NA','Aucun changement de langue inline');

  // ✅ NOUVEAU 8.9 — Balises de présentation b/i/u
  const pres = [...document.querySelectorAll('b,i,u')].filter(el => (el.innerText||'').trim() && !el.getAttribute('role'));
  if (pres.length) f('8.9','NC',`${pres.length} balise(s) b/i/u présentatif(s) — préférer strong/em/ins ou CSS`, pres[0].outerHTML.slice(0,100));
  else f('8.9','C','Pas de balises b/i/u présentatifs');

  return R;
}

// ─── THÈME 9 — STRUCTURE ─────────────────────

function auditStructure() {
  const R = [];
  const f = (id, st, el, msg) => R.push({ id, status: st, message: msg, snippet: el?.outerHTML?.slice(0,100), source:'dom' });

  const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  const h1s = document.querySelectorAll('h1');
  if (!hs.length) f('9.1','NC',null,'Aucun titre h1-h6');
  else if (!h1s.length) f('9.1','NC',null,'Pas de h1');
  else if (h1s.length > 1) f('9.1','NC',null,`${h1s.length} h1 détectés`);
  else f('9.1','C',h1s[0],`h1: "${h1s[0].innerText.slice(0,60)}"`);

  let prev=0, jumps=0;
  hs.forEach(h => {
    const lvl = parseInt(h.tagName[1]);
    if (prev && lvl > prev+1) { jumps++; f('9.1','NC',h,`Saut h${prev}→h${lvl}`); }
    prev = lvl;
  });
  if (hs.length && !jumps) f('9.1','C',null,`Hiérarchie de ${hs.length} titre(s) OK`);

  ['main','nav','header','footer'].forEach(name => {
    const el = document.querySelector(name) || document.querySelector(`[role="${name}"]`);
    el ? f('9.2','C',null,`<${name}> présent`) : f('9.2','NC',null,`<${name}> absent`);
  });

  const fake = [...document.querySelectorAll('p,div')].filter(p => /^[-•*·▪▸►→✓✗]\s/.test((p.innerText||'').trim()));
  if (fake.length) f('9.3','NC',fake[0],`${fake.length} liste(s) simulée(s) avec caractères spéciaux`);
  else f('9.3','C',null,'Aucune liste simulée');
  const lists = document.querySelectorAll('ul,ol,dl');
  if (lists.length) f('9.3','C',null,`${lists.length} liste(s) HTML`);

  return R;
}

// ─── THÈME 10 — PRÉSENTATION (ENRICHI) ───────

function auditPresentation() {
  const R = [];
  const f = (id, st, msg, sn) => R.push({ id, status: st, message: msg, snippet: sn, source:'dom' });

  // ✅ NOUVEAU 10.6 — Texte justifié
  const justified = [...document.querySelectorAll('*')].filter(el => window.getComputedStyle(el).textAlign === 'justify').slice(0,5);
  if (justified.length) f('10.6','NC',`${justified.length} élément(s) text-align:justify — problématique pour les dyslexiques`, justified[0].outerHTML.slice(0,100));
  else f('10.6','C','Aucun texte justifié');

  // 10.7 — CSS outline:none sur :focus
  let found = false;
  try {
    [...document.styleSheets].forEach(sheet => {
      try {
        [...(sheet.cssRules||[])].forEach(rule => {
          if (rule.selectorText?.includes(':focus')) {
            const s = rule.style;
            if (s.outline==='none'||s.outline==='0'||s.outlineWidth==='0px') {
              found = true;
              f('10.7','NC',`CSS :focus { outline:none } — focus potentiellement invisible (${sheet.href||'inline'})`);
            }
          }
        });
      } catch {}
    });
  } catch {}
  if (!found) f('10.7','C','Pas de suppression CSS du focus');

  return R;
}

// ─── THÈME 11 — FORMULAIRES (ENRICHI) ────────

function auditForms() {
  const R = [];
  const inputs = [...document.querySelectorAll(
    'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]),select,textarea'
  )];
  if (!inputs.length) { R.push({ id:'11.1', status:'NA', message:'Aucun champ', source:'dom' }); return R; }

  inputs.forEach(input => {
    const id = input.getAttribute('id');
    const type = input.getAttribute('type')||'text';
    const ariaLabel = input.getAttribute('aria-label');
    const ariaLabelledby = input.getAttribute('aria-labelledby');
    const title = input.getAttribute('title');
    const placeholder = input.getAttribute('placeholder');
    const labelEl = (id && document.querySelector(`label[for="${id}"]`)) || input.closest('label');
    const sn = input.outerHTML.slice(0,150);

    if (!labelEl && !ariaLabel && !ariaLabelledby && !title) {
      R.push({ id:'11.1', status:'NC', source:'dom',
        message: placeholder ? `Champ type="${type}" : placeholder seul insuffisant ("${placeholder}")` : `Champ type="${type}" sans étiquette`,
        snippet: sn });
    } else {
      const lbl = (labelEl?.innerText||ariaLabel||title||'').trim();
      R.push({ id:'11.1', status:'C', source:'dom', message:`Champ étiqueté: "${lbl.slice(0,50)}"` });
    }
    if (input.hasAttribute('required') && !input.hasAttribute('aria-required'))
      R.push({ id:'11.10', status:'NC', source:'dom', message:`required sans aria-required (id="${id||'?'}")`, snippet:sn });
  });

  // ✅ NOUVEAU 11.5 — fieldset/legend
  const groups = {};
  document.querySelectorAll('input[type=radio],input[type=checkbox]').forEach(inp => {
    const n = inp.getAttribute('name')||'_noname';
    (groups[n]=groups[n]||[]).push(inp);
  });
  Object.entries(groups).forEach(([name, inps]) => {
    if (inps.length < 2) return;
    const fs = inps[0].closest('fieldset');
    if (!fs) R.push({ id:'11.5', status:'NC', source:'dom', message:`Groupe "${name}" (${inps.length} éléments) sans <fieldset>` });
    else if (!fs.querySelector('legend')) R.push({ id:'11.5', status:'NC', source:'dom', message:`Groupe "${name}" : <fieldset> sans <legend>` });
    else R.push({ id:'11.5', status:'C', source:'dom', message:`Groupe "${name}" avec fieldset+legend OK` });
  });

  // ✅ NOUVEAU 11.13 — autocomplete
  const personalMap = { name:'name', firstname:'given-name', lastname:'family-name', email:'email', tel:'tel', phone:'tel', address:'street-address', zip:'postal-code' };
  document.querySelectorAll('input[type=text],input[type=email],input[type=tel]').forEach(inp => {
    const n = (inp.getAttribute('name')||inp.getAttribute('id')||'').toLowerCase();
    const ac = inp.getAttribute('autocomplete');
    const match = Object.keys(personalMap).find(k => n.includes(k));
    if (!match) return;
    if (!ac) R.push({ id:'11.13', status:'NC', source:'dom', message:`Champ "${n}" sans autocomplete (suggéré: "${personalMap[match]}")`, snippet:inp.outerHTML.slice(0,150) });
    else R.push({ id:'11.13', status:'C', source:'dom', message:`Champ "${n}" autocomplete="${ac}"` });
  });

  return R;
}

// ─── THÈME 12 — NAVIGATION ───────────────────

function auditNavigation() {
  const R = [];
  const skipLinks = [...document.querySelectorAll('a[href^="#"]')].filter(a => {
    const t = (a.innerText||a.getAttribute('aria-label')||'').toLowerCase();
    return ['contenu','navigation','skip','aller','accès','main','menu'].some(k=>t.includes(k));
  });
  R.push(skipLinks.length
    ? { id:'12.1', status:'C', message:`${skipLinks.length} lien(s) d'évitement`, source:'dom' }
    : { id:'12.1', status:'NC', message:"Aucun lien d'évitement", source:'dom' });

  const badTab = [...document.querySelectorAll('[tabindex]')].filter(el=>parseInt(el.getAttribute('tabindex'))>0);
  R.push(badTab.length
    ? { id:'12.8', status:'NC', message:`${badTab.length} tabindex > 0`, snippet:badTab[0].outerHTML.slice(0,100), source:'dom' }
    : { id:'12.8', status:'C', message:'Pas de tabindex > 0', source:'dom' });

  const navs = document.querySelectorAll('nav,[role="navigation"]');
  if (navs.length > 1) {
    [...navs].forEach(nav => {
      const label = nav.getAttribute('aria-label')||nav.getAttribute('aria-labelledby');
      R.push(label
        ? { id:'12.6', status:'C', message:`<nav> aria-label="${label}"`, source:'dom' }
        : { id:'12.6', status:'NC', message:'<nav> sans aria-label (plusieurs nav présentes)', snippet:nav.outerHTML.slice(0,100), source:'dom' });
    });
  } else R.push({ id:'12.6', status:'C', message:'Une seule zone nav', source:'dom' });

  return R;
}

// ─── THÈME 4 — MULTIMÉDIA ────────────────────

function auditMultimedia() {
  const R = [];
  const videos = document.querySelectorAll('video');
  const audios = document.querySelectorAll('audio');
  const iframes = [...document.querySelectorAll('iframe')].filter(f=>/youtube|vimeo|dailymotion/.test(f.src||''));
  if (!videos.length && !audios.length && !iframes.length) { R.push({ id:'4.1', status:'NA', message:'Aucun média temporel', source:'dom' }); return R; }
  [...videos].forEach(v => {
    const track = v.querySelector('track[kind="subtitles"],track[kind="captions"]');
    R.push({ id:'4.1', status:track?'C':'NC', source:'dom', message:track?'Vidéo avec sous-titres':'Vidéo sans <track>', snippet:v.outerHTML.slice(0,150) });
    if (v.hasAttribute('autoplay') && !v.hasAttribute('muted'))
      R.push({ id:'4.10', status:'NC', source:'dom', message:'Vidéo autoplay sans muted' });
  });
  if (iframes.length) R.push({ id:'4.1', status:'NA', source:'dom', message:`${iframes.length} média(s) embarqué(s) — vérification manuelle` });
  R.push({ id:'4.3', status:'NA', source:'dom', message:'Audio-description : manuel' });
  return R;
}

// ─── THÈME 7 — SCRIPTS ARIA ──────────────────

function auditScripts() {
  const R = [];
  const valid = new Set(['alert','alertdialog','application','article','banner','button','cell','checkbox','columnheader','combobox','complementary','contentinfo','definition','dialog','document','feed','figure','form','grid','gridcell','group','heading','img','link','list','listbox','listitem','log','main','marquee','math','menu','menubar','menuitem','menuitemcheckbox','menuitemradio','meter','navigation','none','note','option','presentation','progressbar','radio','radiogroup','region','row','rowgroup','rowheader','scrollbar','search','searchbox','separator','slider','spinbutton','status','switch','tab','table','tablist','tabpanel','term','textbox','timer','toolbar','tooltip','tree','treegrid','treeitem']);
  document.querySelectorAll('[role]').forEach(el => {
    const r = el.getAttribute('role');
    if (!valid.has(r)) R.push({ id:'7.1', status:'NC', source:'dom', message:`role="${r}" invalide`, snippet:el.outerHTML.slice(0,100) });
  });
  document.querySelectorAll('div[onclick],span[onclick]').forEach(el => {
    if (el.getAttribute('role')!=='button') R.push({ id:'7.3', status:'NC', source:'dom', message:'Élément cliquable sans role="button"', snippet:el.outerHTML.slice(0,100) });
    if (!el.hasAttribute('tabindex')) R.push({ id:'7.3', status:'NC', source:'dom', message:'Élément cliquable sans tabindex', snippet:el.outerHTML.slice(0,100) });
  });
  if (!R.length) R.push({ id:'7.1', status:'C', message:'Rôles ARIA valides', source:'dom' });
  return R;
}

// ─── THÈME 13 — CONSULTATION (ENRICHI) ───────

function auditConsultation() {
  const R = [];

  // ✅ NOUVEAU 13.2 — Liens nouvelle fenêtre sans avertissement
  const newWin = [...document.querySelectorAll('a[target="_blank"],a[target="_new"]')];
  if (!newWin.length) {
    R.push({ id:'13.2', status:'NA', source:'dom', message:'Aucun lien nouvelle fenêtre' });
  } else {
    let nc=0, ok=0;
    newWin.forEach(a => {
      const t = (a.getAttribute('aria-label')||a.innerText||a.getAttribute('title')||'');
      const warned = /(nouvelle|new|onglet|fenêtre|window|tab|ouvre)/i.test(t);
      warned ? ok++ : nc++;
      if (!warned && nc<=3) R.push({ id:'13.2', status:'NC', source:'dom',
        message:`Lien target="_blank" sans avertissement: "${(a.innerText||a.href).slice(0,50)}"`,
        snippet:a.outerHTML.slice(0,150) });
    });
    if (nc===0) R.push({ id:'13.2', status:'C', source:'dom', message:`${ok} lien(s) nouvelle fenêtre avec avertissement` });
    else if (nc>3) R.push({ id:'13.2', status:'NC', source:'dom', message:`${nc} liens target="_blank" sans avertissement au total` });
  }

  // ✅ NOUVEAU 13.3 — Documents sans format/poids
  const docRe = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|csv|zip)(\?|$)/i;
  const docs = [...document.querySelectorAll('a[href]')].filter(a => docRe.test(a.getAttribute('href')||''));
  if (!docs.length) {
    R.push({ id:'13.3', status:'NA', source:'dom', message:'Aucun document téléchargeable' });
  } else {
    let nc=0, ok=0;
    docs.forEach(a => {
      const label = (a.innerText||a.getAttribute('aria-label')||a.getAttribute('title')||'').toLowerCase();
      const ext = ((a.href||'').match(docRe)||[])[1]?.toUpperCase();
      const hasFormat = ext && label.includes(ext.toLowerCase());
      const hasSize = /\d+\s*(ko|kb|mo|mb)/i.test(label);
      if (!hasFormat && !hasSize) {
        nc++;
        if (nc<=3) R.push({ id:'13.3', status:'NC', source:'dom',
          message:`Document ${ext||'?'} sans format/poids indiqué: "${label.slice(0,40)||a.href.slice(-30)}"`,
          snippet:a.outerHTML.slice(0,150) });
      } else ok++;
    });
    if (nc===0) R.push({ id:'13.3', status:'C', source:'dom', message:`${ok} document(s) avec format/poids indiqué(s)` });
    else if (nc>3) R.push({ id:'13.3', status:'NC', source:'dom', message:`${nc} documents sans format/poids (total)` });
  }

  // 13.7 — Clignotement
  const flash = [...document.querySelectorAll('*')].filter(el=>{const s=window.getComputedStyle(el);return s.animationName!=='none'&&parseFloat(s.animationDuration)<0.35;}).length;
  R.push(flash>0
    ? { id:'13.7', status:'NC', source:'dom', message:`${flash} animation(s) potentiellement > 3 flash/sec` }
    : { id:'13.7', status:'C', source:'dom', message:'Aucune animation à fréquence problématique' });

  return R;
}

module.exports = { runDomRules };
