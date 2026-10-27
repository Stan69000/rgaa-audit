// ─────────────────────────────────────────────
// Thème 8 — Éléments obligatoires
// ─────────────────────────────────────────────

function auditMandatory(out) {
  if (!document.doctype) {
    out.error({
      id: '8.1', rule: 'doctype', message: 'Type de document (DOCTYPE) absent.',
      remediationHint: 'Déclarer <!DOCTYPE html> en première ligne.',
    });
  } else {
    out.pass({ id: '8.1', rule: 'doctype-ok', message: `Type de document déclaré : ${document.doctype.name}.` });
  }

  const ids = new Map();
  document.querySelectorAll('[id]').forEach((el) => {
    const id = el.id;
    if (!id) return;
    if (!ids.has(id)) ids.set(id, []);
    ids.get(id).push(el);
  });
  const duplicates = [...ids.entries()].filter(([, els]) => els.length > 1);
  duplicates.forEach(([id, els]) => {
    const referenced = document.querySelector(
      `[for="${cssEscape(id)}"], [aria-labelledby~="${cssEscape(id)}"], [aria-describedby~="${cssEscape(id)}"], [aria-controls~="${cssEscape(id)}"], [headers~="${cssEscape(id)}"], a[href="#${cssEscape(id)}"]`,
    );
    out.error({
      id: '8.2', rule: 'duplicate-id', element: els[1],
      message: `id="${id}" utilisé ${els.length} fois${referenced ? ' (et référencé : relation ambiguë)' : ''}.`,
      group: `duplicate-id-${id}`,
      severity: referenced ? 'high' : 'medium',
      rationale: 'Les id doivent être uniques (test 8.2.1) ; un doublon référencé casse les associations.',
      remediationHint: 'Rendre chaque id unique dans la page.',
    });
  });
  if (!duplicates.length) {
    out.pass({ id: '8.2', rule: 'duplicate-id-ok', message: 'Aucun id en double.', manualReviewRecommended: true, confidence: 'medium',
      remediationHint: 'La validité complète du code (imbrication, attributs) se vérifie avec le validateur W3C.' });
  }

  const html = document.documentElement;
  const lang = normalizedText(html.getAttribute('lang') || html.getAttribute('xml:lang'));
  if (!lang) {
    out.error({
      id: '8.3', rule: 'html-lang', message: 'Langue par défaut absente (attribut lang sur <html>).',
      remediationHint: 'Ajouter lang="fr" sur la balise <html>.',
    });
  } else if (!isValidLangCode(lang)) {
    out.error({
      id: '8.4', rule: 'html-lang-valid', message: `Code de langue invalide sur <html> : « ${lang} ».`,
      remediationHint: 'Utiliser un code ISO 639 valide (fr, en, fr-FR…).',
    });
  } else {
    out.pass({ id: '8.3', rule: 'html-lang-ok', message: `Langue par défaut déclarée : « ${lang} ».` });
    out.manual({
      id: '8.4', rule: 'html-lang-relevance',
      message: `Langue « ${lang} » : vérifier qu’elle correspond à la langue principale du contenu.`,
    });
  }

  document.querySelectorAll('body [lang]').forEach((el) => {
    const value = normalizedText(el.getAttribute('lang'));
    if (value && !isValidLangCode(value)) {
      out.error({
        id: '8.8', rule: 'element-lang-valid', element: el,
        message: `Code de langue invalide : lang="${value}".`,
        group: `element-lang-valid-${value}`,
        remediationHint: 'Utiliser un code ISO 639 valide.',
      });
    }
  });

  const title = normalizedText(document.title);
  if (!title) {
    out.error({
      id: '8.5', rule: 'page-title', message: 'Page sans titre (<title> absent ou vide).',
      remediationHint: 'Ajouter un <title> unique décrivant la page et le site.',
    });
  } else {
    out.pass({ id: '8.5', rule: 'page-title-ok', message: `Titre de page : « ${title.slice(0, 90)} ».` });
    out.manual({
      id: '8.6', rule: 'page-title-relevance',
      message: `Titre « ${title.slice(0, 90)} » : vérifier qu’il identifie la page et son contenu.`,
    });
  }

  const emptyParagraphs = [...document.querySelectorAll('p')]
    .filter((p) => isRendered(p) && !normalizedText(p.textContent) && !p.querySelector('img, svg, video, iframe, input, button, canvas, picture, object'));
  if (emptyParagraphs.length >= 2) {
    emptyParagraphs.forEach((p) => out.warn({
      id: '8.9', rule: 'empty-paragraph', element: p,
      message: 'Paragraphe vide utilisé pour créer de l’espace.',
      group: 'empty-paragraph',
      confidence: 'medium',
      remediationHint: 'Gérer les espacements en CSS (margin, padding).',
    }));
  }
}
