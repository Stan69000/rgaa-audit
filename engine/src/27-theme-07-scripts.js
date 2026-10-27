// ─────────────────────────────────────────────
// Thème 7 — Scripts
// ─────────────────────────────────────────────

function closestRole(el, roles) {
  let node = el.parentElement;
  while (node) {
    const role = roleOf(node);
    if (role && roles.includes(role)) return node;
    if (node.localName === 'ul' || node.localName === 'ol' || node.localName === 'menu') {
      if (roles.includes('list')) return node;
    }
    if (node.localName === 'select' && roles.includes('listbox')) return node;
    if (node.localName === 'table' && roles.includes('table')) return node;
    if (node.localName === 'tr' && roles.includes('row')) return node;
    if (['thead', 'tbody', 'tfoot'].includes(node.localName) && roles.includes('rowgroup')) return node;
    node = node.parentElement;
  }
  return null;
}

function ownedByRole(container, roles) {
  const owned = idRefs(container, 'aria-owns').map(getById).filter(Boolean);
  const candidates = [...container.querySelectorAll('[role]'), ...owned];
  if (roles.includes('listitem') && container.querySelector('li')) return true;
  if (roles.includes('option') && container.querySelector('option')) return true;
  if (roles.includes('radio') && container.querySelector('input[type="radio"]')) return true;
  return candidates.some((c) => roles.includes(explicitRole(c)));
}

function auditAria(out) {
  let ariaElements = 0;

  document.querySelectorAll('[role]').forEach((el) => {
    if (!isRendered(el)) return;
    ariaElements++;
    const raw = normalizedText(el.getAttribute('role')).toLowerCase();
    if (!raw) return;
    const role = explicitRole(el);
    if (!role) {
      const abstract = raw.split(' ').find((t) => ABSTRACT_ROLES.has(t));
      out.error({
        id: '7.1', rule: 'aria-role-invalid', element: el,
        message: abstract
          ? `Rôle ARIA abstrait, interdit dans le code : role="${raw}".`
          : `Rôle ARIA inexistant : role="${raw}".`,
        group: `aria-role-invalid-${raw}`,
        rationale: 'Un rôle inconnu est ignoré : le composant perd la sémantique attendue.',
        remediationHint: 'Utiliser un rôle ARIA 1.2 valide, ou de préférence un élément HTML natif.',
      });
      return;
    }

    const context = REQUIRED_CONTEXT[role];
    if (context && !isHiddenFromAT(el) && !closestRole(el, context)) {
      const ownedBy = el.id && document.querySelector(`[aria-owns~="${cssEscape(el.id)}"]`);
      if (!ownedBy) {
        out.error({
          id: '7.1', rule: 'aria-required-context', element: el,
          message: `role="${role}" hors de son conteneur requis (${context.join(' ou ')}).`,
          group: `aria-required-context-${role}`,
          confidence: 'medium',
          rationale: 'Ce rôle n’a de sens qu’à l’intérieur de son conteneur ; isolé, il est mal restitué.',
          remediationHint: `Placer l’élément dans un conteneur role="${context[0]}", ou utiliser une autre sémantique.`,
        });
      }
    }

    const owned = REQUIRED_OWNED[role];
    if (owned && !isHiddenFromAT(el) && el.getAttribute('aria-busy') !== 'true' && !ownedByRole(el, owned)) {
      out.error({
        id: '7.1', rule: 'aria-required-owned', element: el,
        message: `role="${role}" ne contient aucun élément ${owned.map((r) => `role="${r}"`).join(' / ')}.`,
        group: `aria-required-owned-${role}`,
        confidence: 'medium',
        rationale: 'Un conteneur ARIA vide de ses éléments attendus est restitué de façon incohérente.',
        remediationHint: role === 'tablist'
          ? 'Compléter le motif onglets (tab + tabpanel), ou utiliser role="group" avec aria-current pour un simple filtre.'
          : 'Ajouter les éléments enfants attendus ou retirer le rôle.',
      });
    }

    const required = REQUIRED_STATES[role];
    if (required && !(required.native && el.matches(required.native))) {
      const missing = required.attrs.filter((a) => !el.hasAttribute(a));
      if (missing.length) {
        out.error({
          id: role === 'heading' ? '9.1' : '7.1', rule: 'aria-required-state', element: el,
          message: `role="${role}" sans ${missing.join(', ')}.`,
          group: `aria-required-state-${role}`,
          rationale: role === 'heading'
            ? 'Le test 9.1.1 exige aria-level avec role="heading".'
            : 'Sans cet état, le lecteur d’écran ne peut pas annoncer la valeur du composant.',
          remediationHint: `Ajouter ${missing.join(', ')} et le maintenir à jour par script.`,
        });
      }
    }

    if (INTERACTIVE_ROLES.has(role) && !el.matches(NATIVE_INTERACTIVE_SELECTOR) && !el.hasAttribute('tabindex')
      && !isHiddenFromAT(el) && el.getAttribute('aria-disabled') !== 'true') {
      const managedByParent = el.closest('[aria-activedescendant]') || ['option', 'treeitem', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'tab'].includes(role);
      const report = managedByParent ? out.warn : out.error;
      report({
        id: '7.3', rule: 'aria-widget-not-focusable', element: el,
        message: `Composant role="${role}" non atteignable au clavier (tabindex absent).`,
        group: `aria-widget-not-focusable-${role}`,
        confidence: managedByParent ? 'low' : 'high',
        rationale: 'Un composant interactif doit pouvoir recevoir le focus clavier.',
        remediationHint: managedByParent
          ? 'Vérifier la gestion du focus (tabindex mobile ou aria-activedescendant).'
          : `Utiliser l’élément natif ou ajouter tabindex="0" et la gestion des touches Entrée/Espace.`,
      });
    }
  });

  const all = document.querySelectorAll('*');
  for (const el of all) {
    if (!el.attributes || !el.attributes.length) continue;
    for (const attr of el.attributes) {
      const name = attr.name;
      if (!name.startsWith('aria-')) continue;
      ariaElements++;
      if (!ARIA_ATTRIBUTES.has(name)) {
        out.error({
          id: '7.1', rule: 'aria-attr-unknown', element: el,
          message: `Attribut ARIA inexistant : ${name}.`,
          group: `aria-attr-unknown-${name}`,
          rationale: 'Un attribut mal orthographié est ignoré (ex. aria-labeledby au lieu de aria-labelledby).',
          remediationHint: 'Corriger le nom de l’attribut.',
        });
        continue;
      }
      const allowed = ARIA_TOKEN_VALUES[name];
      const value = normalizedText(attr.value).toLowerCase();
      if (allowed && value && !allowed.includes(value)) {
        out.error({
          id: '7.1', rule: 'aria-attr-value', element: el,
          message: `Valeur invalide ${name}="${attr.value}" (attendu : ${allowed.join(', ')}).`,
          group: `aria-attr-value-${name}`,
        });
      }
      if (ARIA_IDREF_ATTRIBUTES.includes(name) && value) {
        const missing = idRefs(el, name).filter((id) => !getById(id));
        if (missing.length) {
          const lazyPanel = name === 'aria-controls' && el.getAttribute('aria-expanded') === 'false';
          const report = lazyPanel ? out.warn : out.error;
          report({
            id: name === 'aria-labelledby' && el.matches('input, select, textarea') ? '11.1' : '7.1',
            rule: 'aria-idref-missing', element: el,
            message: `${name} référence un id absent de la page : ${missing.join(', ')}.`,
            group: `aria-idref-missing-${name}`,
            confidence: lazyPanel ? 'low' : 'high',
            rationale: lazyPanel
              ? 'Le panneau contrôlé n’est peut-être rendu qu’à l’ouverture.'
              : 'La relation est rompue : le nom, la description ou le contrôle annoncé n’existe pas.',
            remediationHint: 'Faire correspondre la référence à l’id d’un élément présent dans le DOM.',
          });
        }
      }
    }
  }

  document.querySelectorAll('[onclick]').forEach((el) => {
    if (el.matches(NATIVE_INTERACTIVE_SELECTOR) || el.matches('label, body, html, option')) return;
    if (!isRendered(el) || isHiddenFromAT(el)) return;
    if (explicitRole(el) && INTERACTIVE_ROLES.has(explicitRole(el))) return;
    const focusable = el.hasAttribute('tabindex') && parseInt(el.getAttribute('tabindex'), 10) >= 0;
    if (!focusable) {
      out.error({
        id: '7.3', rule: 'onclick-not-focusable', element: el,
        message: `Élément <${el.localName}> cliquable (onclick) non atteignable au clavier.`,
        group: 'onclick-not-focusable',
        remediationHint: 'Utiliser un <button> ou un lien natif.',
      });
    } else {
      out.error({
        id: '7.1', rule: 'onclick-no-role', element: el,
        message: `Élément <${el.localName}> cliquable sans rôle (button, link…).`,
        group: 'onclick-no-role',
        remediationHint: 'Utiliser un <button>, ou ajouter role="button" et la gestion clavier.',
      });
    }
  });

  out.manual({
    id: '7.5', rule: 'status-messages',
    message: 'Messages de statut (confirmations, erreurs, chargements) : restitution à vérifier.',
    remediationHint: 'Utiliser role="status", role="alert" ou aria-live selon l’urgence du message.',
  });

  if (ariaElements === 0) {
    out.na({ id: '7.1', rule: 'aria-none', message: 'Aucun attribut ou rôle ARIA détecté.' });
  }
}
