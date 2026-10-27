// ─────────────────────────────────────────────
// Thème 1 — Images
// ─────────────────────────────────────────────

function auditImages(out) {
  const imgs = [...document.querySelectorAll('img')].filter(isRendered);
  let informative = 0;
  let decorative = 0;

  imgs.forEach((img) => {
    if (isHiddenFromAT(img)) {
      decorative++;
      return;
    }
    const role = explicitRole(img);
    const hasAlt = img.hasAttribute('alt');
    const alt = normalizedText(img.getAttribute('alt'));
    const name = accessibleName(img);

    if (role === 'presentation' || role === 'none') {
      if (alt || normalizedText(img.getAttribute('title')) || normalizedText(img.getAttribute('aria-label'))) {
        out.error({
          id: '1.2', rule: 'img-decorative-with-text', element: img,
          message: 'Image déclarée décorative (role="presentation") mais pourvue d’une alternative.',
          rationale: 'Une image de décoration doit être totalement ignorée : alternative et rôle se contredisent.',
          remediationHint: 'Si l’image informe, retirer role="presentation" ; sinon vider alt et retirer title/aria-label.',
        });
      } else {
        decorative++;
      }
      return;
    }

    if (!hasAlt && !name) {
      out.error({
        id: '1.1', rule: 'img-alt-missing', element: img,
        message: 'Image sans attribut alt ni autre alternative textuelle.',
        rationale: 'Sans attribut alt, les lecteurs d’écran annoncent souvent le nom du fichier.',
        remediationHint: 'Ajouter alt="description" si l’image informe, ou alt="" si elle est décorative.',
      });
      return;
    }

    if (hasAlt && alt === '') {
      const otherText = normalizedText(img.getAttribute('title'))
        || normalizedText(img.getAttribute('aria-label'))
        || idRefs(img, 'aria-labelledby').length > 0;
      if (otherText) {
        out.error({
          id: '1.2', rule: 'img-decorative-with-text', element: img,
          message: 'Image à alt vide mais pourvue d’un title ou d’un aria-label.',
          rationale: 'Une image décorative doit être dépourvue de tout attribut fournissant une alternative (test 1.2.1).',
          remediationHint: 'Retirer title/aria-label si l’image est décorative, ou renseigner alt si elle informe.',
        });
        return;
      }
      const link = img.closest('a[href], button');
      if (link && !accessibleName(link)) return; // signalé par les règles liens/boutons (6.2 / 11.9)
      decorative++;
      return;
    }

    informative++;
    const src = img.getAttribute('src') || '';
    const fileName = (src.split(/[?#]/)[0].split('/').pop() || '').replace(/\.[a-z0-9]{2,5}$/i, '');
    const comparable = comparableText(name);
    if (['image', 'photo', 'picture', 'img', 'illustration', 'visuel', 'logo', 'icon', 'icone', 'graphique', 'banniere']
      .includes(comparable)) {
      out.warn({
        id: '1.3', rule: 'img-alt-generic', element: img,
        message: `Alternative textuelle générique : « ${name} ».`,
        group: 'img-alt-generic',
        rationale: 'Une alternative générique ne transmet pas l’information portée par l’image.',
        remediationHint: 'Décrire l’information ou la fonction de l’image dans son contexte.',
      });
    } else if (fileName && !/\s/.test(name) && /[-_.\d]/.test(name) && comparableText(fileName) === comparable) {
      out.warn({
        id: '1.3', rule: 'img-alt-filename', element: img,
        message: `Alternative identique au nom de fichier : « ${name} ».`,
        group: 'img-alt-filename',
        rationale: 'Un nom de fichier est rarement une alternative compréhensible.',
        remediationHint: 'Remplacer par une description de l’information portée par l’image.',
      });
    } else if (name.length > 150) {
      out.warn({
        id: '1.3', rule: 'img-alt-long', element: img,
        message: `Alternative très longue (${name.length} caractères).`,
        group: 'img-alt-long',
        rationale: 'Une alternative longue peut signaler une image complexe ou une image texte.',
        remediationHint: 'Raccourcir l’alternative et, si besoin, fournir une description détaillée (1.6).',
      });
    }
  });

  document.querySelectorAll('input[type="image" i]').forEach((input) => {
    if (isHiddenFromAT(input)) return;
    if (!accessibleName(input) || !normalizedText(input.getAttribute('alt'))) {
      out.error({
        id: '1.1', rule: 'input-image-alt', element: input,
        message: 'Bouton image (input type="image") sans attribut alt.',
        rationale: 'Le test 1.1.3 exige une alternative textuelle sur chaque bouton de type image.',
        remediationHint: 'Ajouter un alt décrivant l’action du bouton.',
      });
    }
  });

  document.querySelectorAll('area[href]').forEach((area) => {
    if (!normalizedText(area.getAttribute('alt')) && !normalizedText(area.getAttribute('aria-label'))) {
      out.error({
        id: '1.1', rule: 'area-alt', element: area,
        message: 'Zone cliquable (area) sans alternative textuelle.',
        remediationHint: 'Ajouter un alt décrivant la destination de la zone.',
      });
    }
  });

  document.querySelectorAll('[role="img"]').forEach((el) => {
    if (el.localName === 'svg' || isHiddenFromAT(el)) return;
    if (!accessibleName(el)) {
      out.error({
        id: '1.1', rule: 'role-img-name', element: el,
        message: 'Élément role="img" sans alternative textuelle.',
        remediationHint: 'Ajouter un aria-label ou aria-labelledby décrivant l’image.',
      });
    }
  });

  let svgUndetermined = 0;
  document.querySelectorAll('svg').forEach((svg) => {
    if (svg.parentElement && svg.parentElement.closest('svg')) return;
    if (!isRendered(svg) || isHiddenFromAT(svg)) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const role = explicitRole(svg);
    if (role === 'presentation' || role === 'none') return;
    const name = accessibleName(svg);
    if (role === 'img') {
      if (!name) {
        out.error({
          id: '1.1', rule: 'svg-name', element: svg,
          message: 'SVG role="img" sans alternative textuelle.',
          remediationHint: 'Ajouter aria-label, aria-labelledby ou un <title> en premier enfant.',
        });
      } else {
        informative++;
      }
      return;
    }
    const host = svg.closest('a[href], button, [role="button"], [role="link"]');
    if (host && normalizedText(visibleText(host))) {
      out.warn({
        id: '1.2', rule: 'svg-decorative-not-hidden', element: svg,
        message: 'Icône SVG accompagnée d’un texte mais non masquée (aria-hidden="true" absent).',
        group: 'svg-decorative-not-hidden',
        confidence: 'medium',
        rationale: 'Une icône redondante avec un texte voisin est décorative et doit être ignorée (test 1.2.4).',
        remediationHint: 'Ajouter aria-hidden="true" (et focusable="false") sur le <svg>.',
      });
      return;
    }
    if (name) {
      out.error({
        id: '1.1', rule: 'svg-role-img', element: svg,
        message: 'SVG porteur d’une alternative sans role="img".',
        group: 'svg-role-img',
        confidence: 'medium',
        rationale: 'Le test 1.1.5 exige role="img" pour que l’alternative d’un SVG soit restituée.',
        remediationHint: 'Ajouter role="img" sur le <svg>, ou aria-hidden="true" s’il est décoratif.',
      });
      return;
    }
    svgUndetermined++;
    out.warn({
      id: '1.2', rule: 'svg-unknown', element: svg,
      message: 'SVG ni masqué ni pourvu d’alternative.',
      group: 'svg-unknown',
      rationale: 'Sans indication, un SVG peut être annoncé de façon confuse par les lecteurs d’écran.',
      remediationHint: 'Décoratif : aria-hidden="true". Informatif : role="img" et une alternative.',
    });
  });

  document.querySelectorAll('canvas').forEach((canvas) => {
    if (!isRendered(canvas) || isHiddenFromAT(canvas)) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 24 || rect.height < 24) return;
    if (accessibleName(canvas) || normalizedText(canvas.textContent)) return;
    out.warn({
      id: '1.1', rule: 'canvas-alternative', element: canvas,
      message: 'Canevas sans alternative ni contenu de repli.',
      group: 'canvas-alternative',
      remediationHint: 'Informatif : role="img" et aria-label, ou contenu alternatif. Décoratif : aria-hidden="true".',
    });
  });

  if (informative) {
    out.manual({
      id: '1.3', rule: 'img-alt-relevance',
      message: `${informative} image(s) avec alternative : pertinence à vérifier.`,
      rationale: 'La pertinence d’une alternative dépend du contexte éditorial.',
      remediationHint: 'Relire chaque alternative au regard de l’information portée par l’image.',
    });
  }
  if (decorative) {
    out.manual({
      id: '1.2', rule: 'img-decorative-review',
      message: `${decorative} image(s) traitée(s) comme décoratives : vérifier qu’elles n’informent pas.`,
      remediationHint: 'Une image décorative ne doit porter aucune information utile à la compréhension.',
    });
    out.pass({
      id: '1.2', rule: 'img-decorative-ok',
      message: `${decorative} image(s) décorative(s) correctement ignorée(s).`,
      manualReviewRecommended: true,
      confidence: 'medium',
    });
  }
  if (!imgs.length && !svgUndetermined && !document.querySelector('svg, [role="img"], input[type="image" i], area, canvas')) {
    out.na({ id: '1.1', rule: 'img-none', message: 'Aucune image détectée.' });
  } else if (informative) {
    out.pass({
      id: '1.1', rule: 'img-alt-present',
      message: `${informative} image(s) porteuse(s) d’une alternative textuelle.`,
      confidence: 'medium',
      manualReviewRecommended: true,
    });
  }
}
