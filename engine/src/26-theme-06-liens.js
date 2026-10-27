// ─────────────────────────────────────────────
// Thème 6 — Liens
// ─────────────────────────────────────────────

function auditLinks(out) {
  const links = [...document.querySelectorAll('a[href], area[href], [role="link"]')]
    .filter((l) => l.localName !== 'area' && isRendered(l) && !isHiddenFromAT(l));

  if (!links.length) {
    out.na({ id: '6.2', rule: 'link-none', message: 'Aucun lien.' });
    return;
  }

  const genericByLabel = new Map();
  let named = 0;

  links.forEach((link) => {
    const name = accessibleName(link);
    if (!name) {
      out.error({
        id: '6.2', rule: 'link-name', element: link,
        message: link.querySelector('img, svg') ? 'Lien image ou icône sans intitulé.' : 'Lien sans intitulé.',
        group: link.querySelector('img, svg') ? 'link-name-image' : 'link-name',
        rationale: 'Un lien sans intitulé est annoncé « lien » sans indication de destination.',
        remediationHint: 'Ajouter un texte (éventuellement masqué), un alt sur l’image ou un aria-label.',
      });
      return;
    }
    named++;

    const visible = visibleLabelOf(link);
    const usesAria = link.hasAttribute('aria-label') || link.hasAttribute('aria-labelledby');
    if (usesAria && nameIncludesVisibleLabel(name, visible) === false) {
      (isShortVisibleLabel(visible) ? out.error : out.warn)({
        id: '6.1', rule: 'link-label-in-name', element: link,
        message: `Le nom accessible « ${name.slice(0, 60)} » ne contient pas l’intitulé visible « ${visible.slice(0, 40)} ».`,
        group: isShortVisibleLabel(visible) ? 'link-label-in-name' : 'link-label-in-name-long',
        rationale: 'Test 6.1.5 : la commande vocale utilise le texte visible ; il doit figurer dans le nom.',
        remediationHint: 'Faire commencer l’aria-label par le texte visible, ou supprimer l’aria-label.',
      });
    }

    const key = comparableText(name);
    if (GENERIC_LINK_LABELS.has(key)) {
      out.warn({
        id: '6.1', rule: 'link-generic', element: link,
        message: `Intitulé de lien peu explicite : « ${name} ».`,
        group: `link-generic-${key}`,
        rationale: 'Un intitulé générique n’est conforme que si le contexte du lien le rend explicite.',
        remediationHint: 'Compléter l’intitulé (texte masqué, aria-label reprenant le texte visible) ou s’appuyer sur le contexte.',
      });
      if (!genericByLabel.has(key)) genericByLabel.set(key, new Set());
      genericByLabel.get(key).add(link.getAttribute('href'));
    }
  });

  genericByLabel.forEach((hrefs, label) => {
    if (hrefs.size > 1) {
      out.warn({
        id: '6.1', rule: 'link-generic-ambiguous',
        message: `Même intitulé « ${label} » pour ${hrefs.size} destinations différentes.`,
        confidence: 'medium',
        remediationHint: 'Différencier les intitulés pour qu’ils restent compréhensibles hors contexte.',
      });
    }
  });

  if (named) {
    out.pass({
      id: '6.2', rule: 'link-name-ok',
      message: `${named} lien(s) pourvu(s) d’un intitulé.`,
      confidence: 'high',
    });
    out.manual({
      id: '6.1', rule: 'link-explicit-review',
      message: `${named} lien(s) : vérifier que chaque intitulé, avec son contexte, est explicite.`,
    });
  }
}
