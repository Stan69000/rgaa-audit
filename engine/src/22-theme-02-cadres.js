// ─────────────────────────────────────────────
// Thème 2 — Cadres
// ─────────────────────────────────────────────

function auditFrames(out) {
  const frames = [...document.querySelectorAll('iframe, frame')].filter((f) => isRendered(f) && !isHiddenFromAT(f));
  if (!frames.length) {
    out.na({ id: '2.1', rule: 'frame-none', message: 'Aucun cadre (iframe) visible.' });
    return;
  }
  let titled = 0;
  frames.forEach((frame) => {
    const title = normalizedText(frame.getAttribute('title'));
    if (!title) {
      out.error({
        id: '2.1', rule: 'frame-title', element: frame,
        message: 'Cadre (iframe) sans attribut title.',
        rationale: 'Le titre permet d’identifier le contenu du cadre avant d’y entrer.',
        remediationHint: 'Ajouter un title décrivant le contenu du cadre (ex. « Vidéo : … »).',
      });
    } else {
      titled++;
    }
  });
  if (titled) {
    out.pass({ id: '2.1', rule: 'frame-title-ok', message: `${titled} cadre(s) titré(s).` });
    out.manual({
      id: '2.2', rule: 'frame-title-relevance',
      message: `${titled} titre(s) de cadre : pertinence à vérifier.`,
      remediationHint: 'Le titre doit décrire le contenu ou la fonction du cadre.',
    });
  }
}
