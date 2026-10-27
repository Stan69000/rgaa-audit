// ─────────────────────────────────────────────
// Thème 9 — Structuration
// ─────────────────────────────────────────────

function auditStructure(out) {
  const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')]
    .filter((h) => !isHiddenFromAT(h))
    .map((h) => {
      const explicit = explicitRole(h);
      if (explicit && explicit !== 'heading') return null;
      const level = explicit === 'heading'
        ? parseInt(h.getAttribute('aria-level'), 10) || 2
        : parseInt(h.localName.slice(1), 10);
      return { el: h, level };
    })
    .filter(Boolean);

  if (!headings.length) {
    out.warn({
      id: '9.1', rule: 'headings-none',
      message: 'Aucun titre (h1-h6) dans la page.',
      confidence: 'medium',
      remediationHint: 'Structurer le contenu avec des titres hiérarchisés.',
    });
  } else {
    if (!headings.some((h) => h.level === 1)) {
      out.warn({
        id: '9.1', rule: 'heading-h1-missing',
        message: 'Aucun titre de niveau 1.',
        confidence: 'medium',
        remediationHint: 'Ajouter un h1 qui résume le contenu principal de la page.',
      });
    }
    let previous = 0;
    let jumps = 0;
    headings.forEach(({ el, level }) => {
      if (!accessibleName(el)) {
        out.error({
          id: '9.1', rule: 'heading-empty', element: el,
          message: `Titre h${level} vide.`,
          group: 'heading-empty',
          remediationHint: 'Supprimer le titre vide ou lui donner un contenu.',
        });
      }
      if (previous && level > previous + 1) {
        jumps++;
        out.warn({
          id: '9.1', rule: 'heading-jump', element: el,
          message: `Saut de niveau de titre h${previous} → h${level}.`,
          group: `heading-jump-${previous}-${level}`,
          confidence: 'medium',
          rationale: 'Un niveau sauté rend la hiérarchie moins lisible pour la navigation par titres.',
          remediationHint: 'Vérifier que la hiérarchie reflète l’organisation du contenu.',
        });
      }
      previous = level;
    });
    if (!jumps) {
      out.pass({
        id: '9.1', rule: 'heading-hierarchy-ok',
        message: `${headings.length} titre(s) sans saut de niveau.`,
        confidence: 'medium', manualReviewRecommended: true,
        remediationHint: 'Vérifier que tout passage qui a l’apparence d’un titre est balisé comme tel (9.1.3).',
      });
    }
  }

  const mains = [...document.querySelectorAll('main')].filter(isRendered);
  if (!mains.length) {
    const roleMain = document.querySelector('[role="main"]');
    const entry = {
      id: '9.2', rule: 'main-missing',
      message: roleMain ? 'Contenu principal balisé par role="main" au lieu de <main>.' : 'Aucune zone <main> visible.',
      rationale: 'Le test 9.2.1 demande une balise <main> visible unique pour le contenu principal.',
      remediationHint: 'Encadrer le contenu principal par une balise <main>.',
    };
    if (roleMain) out.warn(entry);
    else out.error(entry);
  } else if (mains.length > 1) {
    out.error({
      id: '9.2', rule: 'main-multiple', element: mains[1],
      message: `${mains.length} balises <main> visibles.`,
      remediationHint: 'Ne garder qu’une seule balise <main> visible.',
    });
  } else {
    out.pass({ id: '9.2', rule: 'main-ok', message: 'Zone <main> visible unique.' });
  }
  if (!document.querySelector('header, [role="banner"]')) {
    out.warn({ id: '9.2', rule: 'header-missing', message: 'Aucune zone d’en-tête <header>.', confidence: 'low',
      remediationHint: 'Si la page a un en-tête, le baliser avec <header>.' });
  }
  if (!document.querySelector('footer, [role="contentinfo"]')) {
    out.warn({ id: '9.2', rule: 'footer-missing', message: 'Aucune zone de pied de page <footer>.', confidence: 'low',
      remediationHint: 'Si la page a un pied de page, le baliser avec <footer>.' });
  }
  if (!document.querySelector('nav, [role="navigation"]') && document.querySelectorAll('a[href]').length >= 5) {
    out.warn({ id: '9.2', rule: 'nav-missing', message: 'Aucune zone de navigation <nav>.', confidence: 'low',
      remediationHint: 'Baliser les menus principaux et secondaires avec <nav>.' });
  }

  const LIST_CHILD_OK = new Set(['li', 'script', 'template']);
  document.querySelectorAll('ul, ol').forEach((list) => {
    if (explicitRole(list) && !['list'].includes(explicitRole(list))) return;
    const bad = [...list.children].find((c) => !LIST_CHILD_OK.has(c.localName) && explicitRole(c) !== 'listitem');
    if (bad) {
      out.error({
        id: '9.3', rule: 'list-children', element: list,
        message: `Liste <${list.localName}> contenant un enfant <${bad.localName}> au lieu de <li>.`,
        group: 'list-children',
        remediationHint: 'Seuls des <li> peuvent être enfants directs d’une liste.',
      });
    }
  });
  document.querySelectorAll('li').forEach((li) => {
    const parent = li.parentElement;
    if (!parent || ['ul', 'ol', 'menu'].includes(parent.localName)) return;
    if (explicitRole(li) || explicitRole(parent) === 'list') return;
    out.error({
      id: '9.3', rule: 'li-orphan', element: li,
      message: '<li> en dehors d’une liste <ul> ou <ol>.',
      group: 'li-orphan',
      remediationHint: 'Placer les <li> dans une balise <ul> ou <ol>.',
    });
  });
  document.querySelectorAll('dl').forEach((dl) => {
    const bad = [...dl.children].find((c) => !['dt', 'dd', 'div', 'script', 'template'].includes(c.localName));
    if (bad) {
      out.error({
        id: '9.3', rule: 'dl-children', element: dl,
        message: `Liste de définitions contenant un enfant <${bad.localName}>.`,
        group: 'dl-children',
        remediationHint: 'Une <dl> ne contient que des <dt>/<dd> (éventuellement regroupés dans des <div>).',
      });
    }
  });

  const bullet = /^\s*([-•*·▪▸►→✓✔]|\d+[.)])\s+/;
  let fakeRun = [];
  const flushFake = () => {
    if (fakeRun.length >= 2) {
      out.warn({
        id: '9.3', rule: 'fake-list', element: fakeRun[0],
        message: 'Paragraphes successifs simulant une liste.',
        group: 'fake-list',
        remediationHint: 'Utiliser <ul>/<ol> et <li>.',
      });
    }
    fakeRun = [];
  };
  document.querySelectorAll('p').forEach((p) => {
    if (!bullet.test(p.textContent || '')) {
      flushFake();
      return;
    }
    const previous = fakeRun[fakeRun.length - 1];
    if (previous && previous.nextElementSibling !== p) flushFake();
    fakeRun.push(p);
  });
  flushFake();
}
