/**
 * src/rules/index.js — Pré-audit RGAA 4.1 (automatique + heuristique)
 * Les fonctions audit* s'exécutent dans le contexte de la page via page.evaluate().
 */

'use strict';

const { log } = require('../logger');

async function runDomRules(page) {
  log('   Thème 1 — Images…');
  const images = await page.evaluate(auditImagesAdvanced);

  log('   Thème 2 — Cadres…');
  const frames = await page.evaluate(auditFrames);

  log('   Thème 3 — Couleurs…');
  const colors = await page.evaluate(auditColors);

  log('   Thème 5 — Tableaux…');
  const tables = await page.evaluate(auditTablesAdvanced);

  log('   Thème 6 — Liens…');
  const links = await page.evaluate(auditLinksAndButtons);

  log('   Thème 8 — Éléments obligatoires…');
  const mandatory = await page.evaluate(auditMandatory);

  log('   Thème 9 — Structure…');
  const structure = await page.evaluate(auditHeadingsAdvanced);

  log('   Thème 11 — Formulaires…');
  const forms = await page.evaluate(auditFormsAdvanced);

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

  const nc = all.filter((r) => r.status === 'NC').length;
  const c = all.filter((r) => r.status === 'C').length;
  log(`   → ${all.length} résultats (${nc} NC, ${c} C)`);

  return all;
}

function createResult(payload) {
  const {
    id,
    status,
    message,
    snippet = null,
    source = 'dom',
    severity,
    confidence,
    resultType,
    manualReviewRecommended = false,
    rationale,
    remediationHint,
  } = payload || {};

  return {
    id,
    status,
    message,
    snippet,
    source,
    severity,
    confidence,
    resultType,
    manualReviewRecommended: Boolean(manualReviewRecommended),
    rationale: rationale || '',
    remediationHint: remediationHint || '',
  };
}

function probableError(payload) {
  return createResult({
    status: 'NC',
    resultType: 'probable_error',
    severity: 'high',
    confidence: 'high',
    manualReviewRecommended: false,
    ...payload,
  });
}

function heuristicWarning(payload) {
  return createResult({
    status: 'NC',
    resultType: 'heuristic_warning',
    severity: 'medium',
    confidence: 'medium',
    manualReviewRecommended: true,
    ...payload,
  });
}

function goodSignal(payload) {
  return createResult({
    status: 'C',
    resultType: 'good_signal',
    severity: 'low',
    confidence: 'high',
    manualReviewRecommended: false,
    ...payload,
  });
}

function manualOnly(payload) {
  return createResult({
    status: 'NA',
    resultType: 'manual_only',
    severity: 'info',
    confidence: 'low',
    manualReviewRecommended: true,
    ...payload,
  });
}

function shortSnippet(el, max = 180) {
  if (!el || !el.outerHTML) return null;
  return el.outerHTML.slice(0, max);
}

function normalizedText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function getAccessibleLabel(el) {
  if (!el) return '';

  const ariaLabel = normalizedText(el.getAttribute('aria-label'));
  if (ariaLabel) return ariaLabel;

  const labelledBy = normalizedText(el.getAttribute('aria-labelledby'));
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => normalizedText(document.getElementById(id)?.textContent))
      .filter(Boolean)
      .join(' ');
    if (text) return text;
  }

  const text = normalizedText(el.textContent || el.innerText);
  if (text) return text;

  const title = normalizedText(el.getAttribute('title'));
  if (title) return title;

  const imgAlt = normalizedText(el.querySelector('img')?.getAttribute('alt'));
  if (imgAlt) return imgAlt;

  return '';
}

function isIconOnlyElement(el) {
  if (!el) return false;
  const visibleText = normalizedText(el.textContent || '');
  if (visibleText) return false;
  return Boolean(el.querySelector('svg, img, [class*="icon"], [data-icon], i'));
}

function looksInformativeImage(img) {
  if (!img) return false;
  if (img.getAttribute('role') === 'presentation') return false;
  if (img.getAttribute('aria-hidden') === 'true') return false;
  if (img.closest('button, a')) return true;

  const w = Number(img.getAttribute('width')) || img.naturalWidth || 0;
  const h = Number(img.getAttribute('height')) || img.naturalHeight || 0;
  if (w >= 24 && h >= 24) return true;

  const cls = `${img.className || ''}`.toLowerCase();
  if (/(hero|product|cover|illustration|banner|content|article)/.test(cls)) return true;

  return false;
}

function normalizeForCompare(value) {
  return normalizedText(String(value || '').toLowerCase()).replace(/[^a-z0-9]+/g, '');
}

function stripFileExt(fileName) {
  return String(fileName || '').replace(/\.[a-z0-9]{2,5}$/i, '');
}

function isGenericAlt(alt) {
  const generic = new Set([
    'image', 'photo', 'picture', 'img', 'illustration', 'visuel', 'logo', 'icon', 'icone', 'icône',
  ]);
  const normalized = normalizeForCompare(alt);
  return generic.has(normalized);
}

function auditImagesAdvanced() {
  const results = [];
  const imgs = [...document.querySelectorAll('img')];

  imgs.forEach((img) => {
    const altRaw = img.getAttribute('alt');
    const alt = normalizedText(altRaw);
    const src = img.getAttribute('src') || '';
    const fileName = stripFileExt(src.split('/').pop() || '');

    if (!img.hasAttribute('alt')) {
      results.push(probableError({
        id: '1.1',
        message: 'Image sans attribut alt.',
        snippet: shortSnippet(img),
        rationale: 'Sans alternative textuelle, l’information portée par l’image peut être inaccessible.',
        remediationHint: 'Ajouter un alt pertinent, ou alt="" si l’image est purement décorative.',
      }));
      return;
    }

    if (alt === '' && looksInformativeImage(img)) {
      // Heuristique: la pertinence réelle reste contextuelle et éditoriale.
      results.push(heuristicWarning({
        id: '1.1',
        message: 'alt vide sur une image probablement informative.',
        snippet: shortSnippet(img),
        rationale: 'L’image semble porteuse de contenu (taille/contexte), mais le texte alternatif est vide.',
        remediationHint: 'Vérifier le rôle réel de l’image et renseigner un alt descriptif si elle informe.',
      }));
      return;
    }

    if (alt && isGenericAlt(alt)) {
      results.push(heuristicWarning({
        id: '1.1',
        message: `Texte alternatif trop générique: "${alt}".`,
        snippet: shortSnippet(img),
        rationale: 'Un libellé générique peut ne pas transmettre l’information utile.',
        remediationHint: 'Utiliser une alternative qui exprime la fonction ou l’information utile de l’image.',
      }));
      return;
    }

    if (alt && fileName && normalizeForCompare(alt) === normalizeForCompare(fileName)) {
      results.push(heuristicWarning({
        id: '1.1',
        message: 'Texte alternatif proche du nom de fichier.',
        snippet: shortSnippet(img),
        rationale: 'Un alt identique au nom de fichier est rarement compréhensible pour les utilisateurs.',
        remediationHint: 'Remplacer par une formulation orientée usage/contenu.',
      }));
      return;
    }

    results.push(goodSignal({
      id: '1.1',
      message: `Image avec alternative textuelle: "${alt.slice(0, 80)}".`,
      snippet: null,
      rationale: 'Une alternative textuelle est présente.',
      remediationHint: 'Confirmer manuellement que le texte est pertinent dans le contexte métier.',
      manualReviewRecommended: alt !== '',
      confidence: alt ? 'medium' : 'high',
    }));
  });

  document.querySelectorAll('a img').forEach((img) => {
    const link = img.closest('a');
    if (!link) return;
    const linkLabel = getAccessibleLabel(link);
    if (!linkLabel) {
      results.push(probableError({
        id: '6.1',
        message: 'Image cliquable sans nom accessible compréhensible.',
        snippet: shortSnippet(link),
        rationale: 'Un lien sans nom accessible est difficile à comprendre avec les technologies d’assistance.',
        remediationHint: 'Ajouter un texte visible ou aria-label pertinent sur le lien.',
      }));
    }
  });

  if (!results.length) {
    results.push(manualOnly({
      id: '1.1',
      message: 'Aucune image trouvée sur la page.',
      rationale: 'Le thème image n’est pas applicable sur cet échantillon.',
      remediationHint: 'Aucune action.',
      manualReviewRecommended: false,
    }));
  }

  return results;
}

function auditFrames() {
  const results = [];
  const frames = document.querySelectorAll('iframe');

  if (!frames.length) {
    results.push(manualOnly({
      id: '2.1',
      message: 'Aucun iframe.',
      rationale: 'Aucun cadre détecté automatiquement.',
      remediationHint: 'Aucune action.',
      manualReviewRecommended: false,
    }));
    return results;
  }

  frames.forEach((f) => {
    const title = normalizedText(f.getAttribute('title'));
    if (!title) {
      results.push(probableError({
        id: '2.1',
        message: 'iframe sans title.',
        snippet: shortSnippet(f),
        rationale: 'Le titre permet d’identifier la finalité du cadre.',
        remediationHint: 'Renseigner un title explicite pour chaque iframe.',
      }));
      return;
    }

    results.push(goodSignal({
      id: '2.1',
      message: `iframe avec title: "${title.slice(0, 80)}".`,
      rationale: 'Un nom de cadre est présent.',
      remediationHint: 'Vérifier manuellement la pertinence du titre.',
      manualReviewRecommended: true,
      confidence: 'medium',
    }));
  });

  return results;
}

function auditColors() {
  const results = [];
  const flagContrast = (entry) => results.push(createResult(entry));

  const rgbToHex = (rgb) => {
    const m = String(rgb || '').match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return null;
    return '#' + [m[1], m[2], m[3]].map((n) => parseInt(n, 10).toString(16).padStart(2, '0')).join('');
  };

  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255].map((c) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }).reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i], 0);
  };

  const ratio = (f, b) => (Math.max(lum(f), lum(b)) + 0.05) / (Math.min(lum(f), lum(b)) + 0.05);

  const els = [...document.querySelectorAll('p, h1, h2, h3, li, a, button, label, td')].slice(0, 60);
  let nc = 0;
  let ok = 0;

  els.forEach((el) => {
    const s = window.getComputedStyle(el);
    const fg = rgbToHex(s.color);
    const bg = rgbToHex(s.backgroundColor);
    if (!fg || !bg) return;

    const r = ratio(fg, bg);
    const fs = parseFloat(s.fontSize);
    const fw = parseInt(s.fontWeight, 10);
    const large = fs >= 18.67 || (fs >= 14 && fw >= 700);
    const req = large ? 3 : 4.5;

    if (r < req) {
      nc++;
      flagContrast(probableError({
        id: '3.2',
        message: `Contraste insuffisant: ${r.toFixed(2)}:1 (requis ${req}:1).`,
        snippet: shortSnippet(el, 120),
        rationale: 'Un contraste insuffisant nuit à la lisibilité.',
        remediationHint: 'Augmenter le contraste texte/fond pour atteindre les seuils RGAA.',
      }));
    } else {
      ok++;
    }
  });

  if (nc === 0 && ok > 0) {
    results.push(goodSignal({
      id: '3.2',
      message: `Contrastes texte conformes sur ${ok} éléments testés.`,
      rationale: 'Aucun contraste insuffisant détecté dans l’échantillon automatique.',
      remediationHint: 'Compléter par un contrôle manuel des états et composants non testés.',
      manualReviewRecommended: true,
      confidence: 'medium',
    }));
  }

  results.push(manualOnly({
    id: '3.1',
    message: 'Information portée uniquement par la couleur: vérification manuelle.',
    rationale: 'Le sens métier associé aux couleurs ne peut pas être validé automatiquement.',
    remediationHint: 'Vérifier que chaque information colorielle a une alternative perceptible.',
  }));

  return results;
}

function auditTablesAdvanced() {
  const results = [];
  const tables = [...document.querySelectorAll('table')];

  if (!tables.length) {
    results.push(manualOnly({
      id: '5.1',
      message: 'Aucun tableau.',
      rationale: 'Le thème tableau n’est pas applicable sur cet échantillon.',
      remediationHint: 'Aucune action.',
      manualReviewRecommended: false,
    }));
    return results;
  }

  tables.forEach((table) => {
    const rows = table.querySelectorAll('tr').length;
    const cols = Math.max(...[...table.querySelectorAll('tr')].map((tr) => tr.children.length), 0);
    const ths = table.querySelectorAll('th');
    const hasCaption = Boolean(table.querySelector('caption') || normalizedText(table.getAttribute('aria-label')));
    const hasDataDensity = rows >= 2 && cols >= 2;
    const likelyLayout = !ths.length && rows <= 2 && cols <= 2;

    if (hasDataDensity && !ths.length) {
      results.push(probableError({
        id: '5.1',
        message: 'Tableau de données probable sans cellule d’en-tête <th>.',
        snippet: shortSnippet(table),
        rationale: 'Un tableau de données nécessite des en-têtes pour l’association cellule/entête.',
        remediationHint: 'Utiliser des <th> pour les en-têtes de lignes/colonnes.',
      }));
    }

    if (likelyLayout) {
      results.push(heuristicWarning({
        id: '5.3',
        message: 'Usage potentiellement présentationnel de <table>.',
        snippet: shortSnippet(table),
        confidence: 'low',
        rationale: 'La structure semble légère et peut indiquer une mise en page héritée.',
        remediationHint: 'Si le tableau sert à la mise en page, le remplacer par une structure CSS.',
      }));
    }

    if (hasDataDensity && !hasCaption) {
      results.push(heuristicWarning({
        id: '5.4',
        message: 'Tableau de données probable sans caption/nom explicite.',
        snippet: shortSnippet(table),
        rationale: 'Une légende facilite la compréhension du tableau.',
        remediationHint: 'Ajouter un <caption> (ou un nom accessible explicite) orienté contenu.',
      }));
    }

    if (ths.length) {
      const simpleGrid = rows <= 10 && cols <= 10;
      if (simpleGrid) {
        [...ths].forEach((th) => {
          if (!th.hasAttribute('scope') && !th.hasAttribute('id')) {
            results.push(probableError({
              id: '5.6',
              message: 'En-tête <th> sans scope ni id sur tableau simple.',
              snippet: shortSnippet(th),
              confidence: 'medium',
              rationale: 'Les associations peuvent être ambiguës pour les technologies d’assistance.',
              remediationHint: 'Ajouter `scope` (col/row) ou une association explicite id/headers.',
            }));
          }
        });
      } else {
        results.push(manualOnly({
          id: '5.7',
          message: 'Tableau potentiellement complexe: structure à vérifier manuellement.',
          snippet: shortSnippet(table),
          rationale: 'Les tableaux complexes dépassent le niveau de fiabilité d’un contrôle automatique.',
          remediationHint: 'Vérifier headers/id, regroupements et lecture logique avec AT.',
        }));
      }
    }

    if (ths.length && hasCaption) {
      results.push(goodSignal({
        id: '5.1',
        message: 'Tableau avec en-têtes détectés.',
        rationale: 'Des cellules d’en-tête sont présentes.',
        remediationHint: 'Contrôler manuellement la cohérence entêtes/données.',
        manualReviewRecommended: true,
        confidence: 'medium',
      }));
    }
  });

  return results;
}

function auditLinksAndButtons() {
  const results = [];
  const suspiciousLabels = new Set(['cliquez ici', 'en savoir plus', 'lire la suite', 'ici']);

  const links = [...document.querySelectorAll('a[href]')];
  const labelTargets = new Map();

  links.forEach((link) => {
    const label = getAccessibleLabel(link);
    const href = normalizedText(link.getAttribute('href'));

    if (!label) {
      results.push(probableError({
        id: '6.1',
        message: 'Lien sans nom accessible.',
        snippet: shortSnippet(link),
        rationale: 'Un lien non nommé ne permet pas d’anticiper la destination.',
        remediationHint: 'Ajouter un libellé visible ou aria-label pertinent.',
      }));
      return;
    }

    const lowered = label.toLowerCase();
    if (suspiciousLabels.has(lowered)) {
      results.push(heuristicWarning({
        id: '6.1',
        message: `Intitulé de lien ambigu: "${label}".`,
        snippet: shortSnippet(link),
        rationale: 'Les libellés génériques donnent peu de contexte hors lecture visuelle.',
        remediationHint: 'Préférer un intitulé décrivant la cible ou l’action.',
      }));
    }

    if (isIconOnlyElement(link)) {
      if (!label) {
        results.push(probableError({
          id: '6.1',
          message: 'Lien constitué uniquement d’une icône, sans nom accessible.',
          snippet: shortSnippet(link),
          rationale: 'Un lien icône non nommé est inutilisable avec certains lecteurs d’écran.',
          remediationHint: 'Ajouter un libellé textuel ou aria-label explicite.',
        }));
      } else {
        results.push(goodSignal({
          id: '6.1',
          message: `Lien icône avec nom accessible: "${label}".`,
          rationale: 'Le composant iconique reste compréhensible pour les technologies d’assistance.',
          remediationHint: 'Vérifier manuellement la pertinence éditoriale du libellé.',
          manualReviewRecommended: true,
          confidence: 'medium',
        }));
      }
    }

    if (!labelTargets.has(lowered)) labelTargets.set(lowered, new Set());
    if (href) labelTargets.get(lowered).add(href);
  });

  for (const [label, hrefs] of labelTargets.entries()) {
    if (hrefs.size > 1 && suspiciousLabels.has(label)) {
      results.push(heuristicWarning({
        id: '6.2',
        message: `Même intitulé ambigu "${label}" pour plusieurs destinations.`,
        confidence: 'low',
        rationale: 'Un même libellé générique peut créer une ambiguïté de navigation.',
        remediationHint: 'Différencier les libellés par destination ou contexte.',
      }));
    }
  }

  const buttons = [...document.querySelectorAll('button, input[type="button"], input[type="submit"], input[type="reset"]')];
  buttons.forEach((button) => {
    const label = getAccessibleLabel(button) || normalizedText(button.value);
    if (!label) {
      results.push(probableError({
        id: '11.9',
        message: 'Bouton sans nom accessible.',
        snippet: shortSnippet(button),
        rationale: 'Le rôle est présent mais l’action n’est pas compréhensible.',
        remediationHint: 'Renseigner un texte visible ou un aria-label explicite.',
      }));
      return;
    }

    if (isIconOnlyElement(button)) {
      results.push(heuristicWarning({
        id: '11.9',
        message: 'Bouton constitué d’une icône: vérifier la clarté du libellé accessible.',
        snippet: shortSnippet(button),
        rationale: 'Le nom accessible existe mais sa pertinence réelle dépend du contexte écran.',
        remediationHint: 'Confirmer que le nom décrit précisément l’action déclenchée.',
      }));
    }
  });

  [...document.querySelectorAll('div[onclick], span[onclick]')].forEach((el) => {
    const hasRole = normalizedText(el.getAttribute('role')) === 'button' || normalizedText(el.getAttribute('role')) === 'link';
    const tabindex = parseInt(el.getAttribute('tabindex') || '', 10);
    const hasKeyboard = Boolean(el.getAttribute('onkeydown') || el.getAttribute('onkeyup') || el.getAttribute('onkeypress'));

    if (!hasRole || Number.isNaN(tabindex) || tabindex < 0 || !hasKeyboard) {
      results.push(probableError({
        id: '7.3',
        message: 'Composant cliquable non natif sans sémantique/clavier suffisants.',
        snippet: shortSnippet(el),
        confidence: 'medium',
        rationale: 'Les faux boutons/liens peuvent être inaccessibles au clavier et aux AT.',
        remediationHint: 'Utiliser <button>/<a> natifs, ou ajouter rôle, focus clavier et gestion clavier complète.',
      }));
    }
  });

  if (!results.length) {
    results.push(manualOnly({
      id: '6.1',
      message: 'Aucun lien ou bouton pertinent détecté pour ce contrôle.',
      rationale: 'Échantillon sans composant de navigation/action ciblé.',
      remediationHint: 'Aucune action.',
      manualReviewRecommended: false,
    }));
  }

  return results;
}

function auditMandatory() {
  const results = [];
  const lang = normalizedText(document.documentElement.getAttribute('lang'));

  if (!lang) {
    results.push(probableError({
      id: '8.3',
      message: 'Attribut lang absent sur <html>.',
      rationale: 'La langue principale est indispensable pour les technologies d’assistance.',
      remediationHint: 'Ajouter un attribut lang valide (ex: fr, fr-FR).',
    }));
  } else {
    results.push(goodSignal({
      id: '8.3',
      message: `Langue déclarée: "${lang}".`,
      rationale: 'Langue principale détectée.',
      remediationHint: 'Vérifier manuellement la cohérence avec la langue réelle du contenu.',
      manualReviewRecommended: true,
      confidence: 'medium',
    }));
  }

  const title = normalizedText(document.title);
  if (!title) {
    results.push(probableError({
      id: '8.5',
      message: 'Page sans <title>.',
      rationale: 'Le titre de page est un repère majeur de navigation.',
      remediationHint: 'Ajouter un title unique, informatif et contextualisé.',
    }));
  } else {
    results.push(goodSignal({
      id: '8.5',
      message: `Titre de page présent: "${title.slice(0, 90)}".`,
      rationale: 'Un titre est disponible.',
      remediationHint: 'Valider manuellement la qualité éditoriale du titre.',
      manualReviewRecommended: true,
      confidence: 'medium',
    }));
  }

  if (!document.doctype) {
    results.push(probableError({
      id: '8.1',
      message: 'DOCTYPE absent.',
      rationale: 'L’absence de doctype peut perturber le rendu et l’accessibilité technique.',
      remediationHint: 'Déclarer un doctype HTML5.',
    }));
  } else {
    results.push(goodSignal({
      id: '8.1',
      message: `DOCTYPE présent: ${document.doctype.name}.`,
      rationale: 'Un doctype est déclaré.',
      remediationHint: 'Aucune action.',
      manualReviewRecommended: false,
    }));
  }

  const charset = document.querySelector('meta[charset]') || document.querySelector('meta[http-equiv="Content-Type"]');
  if (!charset) {
    results.push(probableError({
      id: '8.2',
      message: 'meta charset absent.',
      rationale: 'Sans encodage explicite, des erreurs de lecture peuvent apparaître.',
      remediationHint: 'Déclarer `<meta charset="utf-8">` en tête du document.',
    }));
  } else {
    results.push(goodSignal({
      id: '8.2',
      message: 'Encodage déclaré.',
      rationale: 'Un encodage est détecté.',
      remediationHint: 'Aucune action.',
      manualReviewRecommended: false,
    }));
  }

  return results;
}

function auditHeadingsAdvanced() {
  const results = [];
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  const h1s = [...document.querySelectorAll('h1')];

  if (!h1s.length) {
    results.push(probableError({
      id: '9.1',
      message: 'Absence de h1.',
      rationale: 'Le h1 fournit un repère principal de structure.',
      remediationHint: 'Ajouter un h1 unique qui résume le contenu principal.',
    }));
  } else if (h1s.length > 1) {
    results.push(heuristicWarning({
      id: '9.1',
      message: `Plusieurs h1 détectés (${h1s.length}).`,
      rationale: 'Plusieurs h1 peuvent être justifiés dans certains gabarits, mais demandent validation.',
      remediationHint: 'Vérifier la structure éditoriale et limiter à un h1 principal si possible.',
    }));
  } else {
    results.push(goodSignal({
      id: '9.1',
      message: `h1 détecté: "${normalizedText(h1s[0].textContent).slice(0, 80)}".`,
      rationale: 'Un titre principal est présent.',
      remediationHint: 'Vérifier manuellement sa pertinence éditoriale.',
      manualReviewRecommended: true,
      confidence: 'medium',
    }));
  }

  let prevLevel = 0;
  let jumps = 0;
  headings.forEach((h) => {
    const level = parseInt(h.tagName.slice(1), 10);
    if (prevLevel && level > prevLevel + 1) {
      jumps++;
      results.push(heuristicWarning({
        id: '9.1',
        message: `Saut de niveau de titre: h${prevLevel} → h${level}.`,
        snippet: shortSnippet(h),
        rationale: 'Un saut de niveau peut perturber la compréhension de la hiérarchie.',
        remediationHint: 'Réordonner les niveaux de titres pour une progression logique.',
      }));
    }
    prevLevel = level;
  });

  const paragraphs = [...document.querySelectorAll('div, p, span')].slice(0, 200);
  const fakeHeadings = paragraphs.filter((el) => {
    if (el.querySelector('h1,h2,h3,h4,h5,h6')) return false;
    const text = normalizedText(el.textContent);
    if (!text || text.length > 80) return false;
    const cls = `${el.className || ''}`.toLowerCase();
    return /(title|titre|heading|headline)/.test(cls);
  });

  if (fakeHeadings.length) {
    results.push(heuristicWarning({
      id: '9.1',
      message: 'Titres possiblement simulés visuellement sans balise de titre.',
      snippet: shortSnippet(fakeHeadings[0]),
      confidence: 'low',
      rationale: 'La détection est basée sur des indices CSS/classes et peut produire des faux positifs.',
      remediationHint: 'Vérifier manuellement et utiliser des balises h1-h6 quand le bloc est un titre.',
    }));
  }

  if (headings.length > 0 && headings.length <= 1 && document.body.innerText.length > 1500) {
    results.push(heuristicWarning({
      id: '9.1',
      message: 'Structure de titres possiblement trop pauvre pour la quantité de contenu.',
      confidence: 'low',
      rationale: 'Une page longue avec peu de titres peut être difficile à parcourir.',
      remediationHint: 'Ajouter des intertitres structurants pour faciliter la navigation.',
    }));
  }

  if (headings.length && !jumps) {
    results.push(goodSignal({
      id: '9.1',
      message: `Hiérarchie de ${headings.length} titre(s) sans saut détecté.`,
      rationale: 'Aucun saut de niveau n’a été détecté dans l’échantillon.',
      remediationHint: 'Valider manuellement la logique éditoriale globale.',
      manualReviewRecommended: true,
      confidence: 'medium',
    }));
  }

  return results;
}

function auditFormsAdvanced() {
  const results = [];
  const fields = [...document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]), select, textarea')];

  if (!fields.length) {
    results.push(manualOnly({
      id: '11.1',
      message: 'Aucun champ de formulaire.',
      rationale: 'Le thème formulaire n’est pas applicable sur cette page.',
      remediationHint: 'Aucune action.',
      manualReviewRecommended: false,
    }));
    return results;
  }

  fields.forEach((field) => {
    const id = field.getAttribute('id');
    const safeId = typeof CSS !== 'undefined' && CSS && typeof CSS.escape === 'function'
      ? CSS.escape(id || '')
      : String(id || '').replace(/"/g, '\\"');
    const label = (id && document.querySelector(`label[for="${safeId}"]`)) || field.closest('label');
    const ariaLabel = normalizedText(field.getAttribute('aria-label'));
    const ariaLabelledby = normalizedText(field.getAttribute('aria-labelledby'));
    const title = normalizedText(field.getAttribute('title'));
    const placeholder = normalizedText(field.getAttribute('placeholder'));
    const hasName = Boolean(label || ariaLabel || ariaLabelledby || title);

    if (!hasName && placeholder) {
      results.push(probableError({
        id: '11.1',
        message: 'Placeholder utilisé comme seul libellé de champ.',
        snippet: shortSnippet(field),
        rationale: 'Le placeholder ne remplace pas un label accessible et persistant.',
        remediationHint: 'Associer un label explicite au champ (balise label, aria-label, aria-labelledby).',
      }));
    } else if (!hasName) {
      results.push(probableError({
        id: '11.1',
        message: 'Champ sans libellé accessible.',
        snippet: shortSnippet(field),
        rationale: 'Un champ sans nom est difficile à comprendre et à compléter.',
        remediationHint: 'Associer un label explicite au champ.',
      }));
    }

    if (field.hasAttribute('required')) {
      const labelText = normalizedText(label?.textContent);
      const requiredSignal = /\*|obligatoire|required/.test(`${labelText} ${ariaLabel} ${title}`.toLowerCase())
        || field.getAttribute('aria-required') === 'true';

      if (!requiredSignal) {
        results.push(heuristicWarning({
          id: '11.10',
          message: 'Champ obligatoire sans indication accessible détectable.',
          snippet: shortSnippet(field),
          rationale: 'L’obligation existe techniquement, mais son annonce explicite n’est pas détectée.',
          remediationHint: 'Ajouter une indication explicite (“obligatoire”) et/ou aria-required.',
        }));
      }
    }

    const type = (field.getAttribute('type') || field.tagName || '').toLowerCase();
    const identity = `${id || ''} ${field.getAttribute('name') || ''} ${placeholder}`.toLowerCase();

    if (/email/.test(identity) && type === 'text') {
      results.push(heuristicWarning({
        id: '11.11',
        message: 'Champ email probable avec type="text".',
        snippet: shortSnippet(field),
        rationale: 'Un type spécialisé améliore la saisie et la validation côté utilisateur.',
        remediationHint: 'Utiliser type="email" quand le champ attend une adresse email.',
      }));
    }

    if (/(phone|tel|telephone|téléphone)/.test(identity) && type === 'text') {
      results.push(heuristicWarning({
        id: '11.11',
        message: 'Champ téléphone probable avec type="text".',
        snippet: shortSnippet(field),
        rationale: 'type="tel" améliore l’assistance de saisie (mobile/clavier virtuel).',
        remediationHint: 'Utiliser type="tel" si le champ attend un numéro de téléphone.',
      }));
    }

    if (/search|recherche/.test(identity) && type === 'text') {
      results.push(heuristicWarning({
        id: '11.11',
        message: 'Champ de recherche probable avec type="text".',
        snippet: shortSnippet(field),
        rationale: 'type="search" peut améliorer certains comportements d’assistance.',
        remediationHint: 'Utiliser type="search" pour les champs de recherche.',
      }));
    }

    if (/(name|nom|surname|firstname|email|mail|tel|phone)/.test(identity) && !field.getAttribute('autocomplete')) {
      results.push(heuristicWarning({
        id: '11.13',
        message: 'Autocomplete absent sur un champ utilisateur probable.',
        snippet: shortSnippet(field),
        confidence: 'low',
        rationale: 'L’autocomplete améliore la rapidité et la réduction d’erreurs de saisie.',
        remediationHint: 'Ajouter une valeur autocomplete adaptée (ex: name, email, tel).',
      }));
    }
  });

  [...document.querySelectorAll('form')].forEach((form) => {
    const groups = [...form.querySelectorAll('input[type="radio"], input[type="checkbox"]')];
    const byName = new Map();

    groups.forEach((input) => {
      const name = normalizedText(input.getAttribute('name')) || `__unnamed_${Math.random()}`;
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(input);
    });

    for (const [, items] of byName.entries()) {
      if (items.length < 2) continue;
      const inFieldset = items.every((item) => Boolean(item.closest('fieldset')));
      const hasLegend = items.some((item) => normalizedText(item.closest('fieldset')?.querySelector('legend')?.textContent));
      if (!inFieldset || !hasLegend) {
        results.push(probableError({
          id: '11.5',
          message: 'Groupe radio/checkbox sans fieldset/legend exploitable.',
          snippet: shortSnippet(items[0]),
          confidence: 'medium',
          rationale: 'Le regroupement logique est essentiel pour comprendre le contexte des choix.',
          remediationHint: 'Regrouper les options dans un fieldset avec legend explicite.',
        }));
      }
    }

    const invalidFields = [...form.querySelectorAll('[aria-invalid="true"], .error input, input.error, select.error, textarea.error')];
    invalidFields.forEach((field) => {
      const hasDescribedBy = normalizedText(field.getAttribute('aria-describedby'));
      if (!hasDescribedBy) {
        results.push(heuristicWarning({
          id: '11.10',
          message: 'Erreur de formulaire potentiellement non associée au champ.',
          snippet: shortSnippet(field),
          confidence: 'low',
          rationale: 'Sans association explicite, le message d’erreur peut ne pas être annoncé correctement.',
          remediationHint: 'Associer les erreurs via aria-describedby et messages proches du champ.',
        }));
      }
    });
  });

  return results;
}

function auditNavigation() {
  const results = [];
  const skipLinks = [...document.querySelectorAll('a[href^="#"]')].filter((a) => {
    const t = (a.innerText || a.getAttribute('aria-label') || '').toLowerCase();
    return ['contenu', 'navigation', 'skip', 'aller', 'accès'].some((k) => t.includes(k));
  });

  if (!skipLinks.length) {
    results.push(heuristicWarning({
      id: '12.1',
      message: 'Aucun lien d’évitement détecté.',
      rationale: 'L’absence de lien d’évitement peut ralentir la navigation clavier.',
      remediationHint: 'Ajouter un lien “Aller au contenu” visible au focus.',
      confidence: 'medium',
    }));
  } else {
    results.push(goodSignal({
      id: '12.1',
      message: `${skipLinks.length} lien(s) d’évitement détecté(s).`,
      rationale: 'Présence d’un mécanisme d’évitement.',
      remediationHint: 'Vérifier manuellement son fonctionnement au clavier.',
      manualReviewRecommended: true,
      confidence: 'medium',
    }));
  }

  const badTabindex = [...document.querySelectorAll('[tabindex]')].filter((el) => parseInt(el.getAttribute('tabindex'), 10) > 0);
  if (badTabindex.length) {
    results.push(probableError({
      id: '12.8',
      message: `${badTabindex.length} élément(s) avec tabindex > 0.`,
      snippet: shortSnippet(badTabindex[0]),
      rationale: 'tabindex positif peut casser l’ordre naturel de navigation.',
      remediationHint: 'Supprimer les tabindex > 0 et préserver l’ordre DOM logique.',
    }));
  } else {
    results.push(goodSignal({
      id: '12.8',
      message: 'Aucun tabindex > 0 détecté.',
      rationale: 'Aucun ordre forcé non recommandé détecté.',
      remediationHint: 'Aucune action.',
      manualReviewRecommended: false,
    }));
  }

  return results;
}

function auditMultimedia() {
  const results = [];
  const videos = document.querySelectorAll('video');
  const audios = document.querySelectorAll('audio');
  const iframes = [...document.querySelectorAll('iframe')].filter((f) =>
    /youtube|vimeo|dailymotion|twitch/.test(f.src || f.getAttribute('data-src') || ''),
  );

  if (!videos.length && !audios.length && !iframes.length) {
    results.push(manualOnly({
      id: '4.1',
      message: 'Aucun média temporel détecté.',
      rationale: 'Le thème multimédia n’est pas applicable sur cet échantillon.',
      remediationHint: 'Aucune action.',
      manualReviewRecommended: false,
    }));
    return results;
  }

  [...videos].forEach((v) => {
    const track = v.querySelector('track[kind="subtitles"], track[kind="captions"]');
    if (!track) {
      results.push(probableError({
        id: '4.1',
        message: 'Vidéo sans piste de sous-titres détectable.',
        snippet: shortSnippet(v),
        rationale: 'Les sous-titres sont nécessaires pour de nombreux utilisateurs.',
        remediationHint: 'Ajouter une piste track kind="subtitles" ou "captions".',
      }));
      return;
    }

    results.push(goodSignal({
      id: '4.1',
      message: 'Vidéo avec piste sous-titres détectée.',
      rationale: 'Une piste sous-titres est présente.',
      remediationHint: 'Vérifier la qualité des sous-titres manuellement.',
      manualReviewRecommended: true,
      confidence: 'medium',
    }));
  });

  if (iframes.length) {
    results.push(manualOnly({
      id: '4.1',
      message: `${iframes.length} média(s) embarqué(s): sous-titres à vérifier manuellement.`,
      rationale: 'La vérification fine dépend de la plateforme et du contenu média.',
      remediationHint: 'Contrôler manuellement sous-titres et transcription.',
    }));
  }

  results.push(manualOnly({
    id: '4.3',
    message: 'Audio-description: vérification manuelle.',
    rationale: 'La présence/qualité d’audio-description ne peut pas être attestée automatiquement ici.',
    remediationHint: 'Vérifier manuellement sur scénarios représentatifs.',
  }));

  return results;
}

function auditScripts() {
  const results = [];
  const valid = new Set(['button', 'link', 'menuitem', 'tab', 'tabpanel', 'dialog', 'alert', 'alertdialog', 'banner', 'complementary', 'contentinfo', 'form', 'main', 'navigation', 'region', 'search', 'article', 'checkbox', 'combobox', 'grid', 'gridcell', 'heading', 'img', 'list', 'listbox', 'listitem', 'menu', 'menubar', 'option', 'progressbar', 'radio', 'radiogroup', 'row', 'rowgroup', 'scrollbar', 'separator', 'slider', 'spinbutton', 'status', 'switch', 'table', 'textbox', 'timer', 'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem']);

  document.querySelectorAll('[role]').forEach((el) => {
    const role = el.getAttribute('role');
    if (!valid.has(role)) {
      results.push(probableError({
        id: '7.1',
        message: `Rôle ARIA invalide: role="${role}".`,
        snippet: shortSnippet(el),
        rationale: 'Un rôle invalide peut nuire à l’interprétation par les technologies d’assistance.',
        remediationHint: 'Utiliser un rôle ARIA valide, ou un élément natif.',
      }));
    }
  });

  if (!results.length) {
    results.push(goodSignal({
      id: '7.1',
      message: 'Aucun rôle ARIA invalide détecté dans l’échantillon.',
      rationale: 'Aucune anomalie de rôle évidente détectée automatiquement.',
      remediationHint: 'Compléter par un test manuel des composants dynamiques.',
      manualReviewRecommended: true,
      confidence: 'medium',
    }));
  }

  return results;
}

module.exports = {
  runDomRules,
  _internals: {
    createResult,
    probableError,
    heuristicWarning,
    goodSignal,
    manualOnly,
    auditImagesAdvanced,
    auditLinksAndButtons,
    auditHeadingsAdvanced,
    auditFormsAdvanced,
    auditTablesAdvanced,
  },
};
