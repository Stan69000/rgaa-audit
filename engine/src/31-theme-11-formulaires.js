// ─────────────────────────────────────────────
// Thème 11 — Formulaires
// ─────────────────────────────────────────────

const FIELD_SELECTOR = [
  'input:not([type="hidden" i]):not([type="submit" i]):not([type="button" i]):not([type="reset" i]):not([type="image" i])',
  'select', 'textarea',
  '[role="textbox"]', '[role="combobox"]', '[role="listbox"]', '[role="searchbox"]', '[role="spinbutton"]',
  '[role="slider"]', '[role="checkbox"]', '[role="radio"]', '[role="switch"]',
].join(',');

function fieldLabelling(field) {
  const labelledBy = idRefs(field, 'aria-labelledby');
  const labelledByText = normalizedText(labelledBy.map(getById).filter(Boolean)
    .map((ref) => accessibleName(ref, new Set(), { traversing: true, includeHidden: true })).join(' '));
  const ariaLabel = normalizedText(field.getAttribute('aria-label'));
  const explicitLabels = field.id
    ? [...document.querySelectorAll(`label[for="${cssEscape(field.id)}"]`)]
    : [];
  const explicitText = normalizedText(explicitLabels.map((l) => nameFromContent(l, new Set([field]), true)).join(' '));
  const wrapping = field.closest('label');
  const wrappingText = wrapping && !explicitLabels.includes(wrapping) ? nameFromContent(wrapping, new Set([field]), true) : '';
  const title = normalizedText(field.getAttribute('title'));
  const placeholder = normalizedText(field.getAttribute('placeholder'));
  return { labelledBy, labelledByText, ariaLabel, explicitLabels, explicitText, wrapping, wrappingText, title, placeholder };
}

function auditForms(out) {
  const fields = [...document.querySelectorAll(FIELD_SELECTOR)]
    .filter((f) => isRendered(f) && !isHiddenFromAT(f));

  document.querySelectorAll('label[for]').forEach((label) => {
    const target = normalizedText(label.getAttribute('for'));
    if (!target) return;
    const el = getById(target);
    if (!el) {
      out.error({
        id: '11.1', rule: 'label-for-missing', element: label,
        message: `Étiquette for="${target}" ne correspondant à aucun champ.`,
        group: 'label-for-missing',
        rationale: 'Test 11.1.2 : la valeur de for doit être l’id du champ associé.',
        remediationHint: 'Donner au champ l’id référencé par l’étiquette.',
      });
    } else if (!el.matches('input, select, textarea, button, meter, output, progress')) {
      out.error({
        id: '11.1', rule: 'label-for-not-labelable', element: label,
        message: `Étiquette for="${target}" pointant vers un élément non étiquetable (<${el.localName}>).`,
        group: 'label-for-not-labelable',
        remediationHint: 'Pour un composant personnalisé, utiliser aria-labelledby.',
      });
    }
  });

  if (!fields.length) {
    out.na({ id: '11.1', rule: 'form-none', message: 'Aucun champ de formulaire.' });
  }

  let labelled = 0;
  fields.forEach((field) => {
    const l = fieldLabelling(field);
    const isNative = field.matches('input, select, textarea');
    const hasRgaaLabel = Boolean(l.labelledByText || l.ariaLabel || l.explicitText || l.title
      || (!isNative && accessibleName(field)));

    if (!hasRgaaLabel) {
      if (l.wrappingText) {
        out.warn({
          id: '11.1', rule: 'label-implicit', element: field,
          message: 'Étiquette implicite (champ placé dans <label>) sans attribut for/id.',
          group: 'label-implicit',
          confidence: 'medium',
          rationale: 'Le test 11.1.1 retient label avec for, aria-label, aria-labelledby ou title ; la forme implicite est mal prise en charge par certaines aides techniques.',
          remediationHint: 'Ajouter un id au champ et l’attribut for correspondant sur le <label>.',
        });
      } else {
        out.error({
          id: '11.1', rule: 'field-label', element: field,
          message: l.placeholder
            ? `Champ dont le seul libellé est le placeholder « ${l.placeholder.slice(0, 40)} ».`
            : `Champ <${field.localName}${field.getAttribute('type') ? ` type="${field.getAttribute('type')}"` : ''}> sans étiquette.`,
          group: l.placeholder ? 'field-label-placeholder' : 'field-label',
          rationale: 'Un placeholder disparaît à la saisie et n’est pas une étiquette au sens du RGAA.',
          remediationHint: 'Associer un <label for="id"> visible au champ.',
        });
      }
      return;
    }
    labelled++;

    const visibleLabel = l.explicitLabels.length ? visibleText(l.explicitLabels[0]) : (l.wrapping ? visibleText(l.wrapping) : '');
    const name = accessibleName(field);
    if (visibleLabel && (l.ariaLabel || l.labelledBy.length) && nameIncludesVisibleLabel(name, visibleLabel) === false) {
      (isShortVisibleLabel(visibleLabel) ? out.error : out.warn)({
        id: '11.2', rule: 'field-label-in-name', element: field,
        message: `Le nom accessible « ${name.slice(0, 50)} » ne contient pas l’étiquette visible « ${visibleLabel.slice(0, 40)} ».`,
        group: 'field-label-in-name',
        rationale: 'Test 11.2.5 : le nom accessible doit contenir au moins l’intitulé visible.',
        remediationHint: 'Supprimer l’aria-label superflu ou y reprendre le texte visible.',
      });
    }

    const required = field.hasAttribute('required') || field.getAttribute('aria-required') === 'true';
    if (required && isNative) {
      const labelText = `${visibleLabel} ${l.labelledByText} ${l.ariaLabel}`.toLowerCase();
      const form = field.closest('form');
      const allRequired = form && /tous les champs (sont )?(obligatoires|requis)|all fields are required/i.test(visibleText(form));
      if (!/\*|obligatoire|requis|required/.test(labelText) && !allRequired) {
        out.warn({
          id: '11.10', rule: 'required-indication', element: field,
          message: 'Champ obligatoire sans indication visible dans son étiquette.',
          group: 'required-indication',
          confidence: 'medium',
          rationale: 'Le caractère obligatoire doit être signalé visuellement avant la soumission.',
          remediationHint: 'Ajouter « (obligatoire) » ou un astérisque expliqué en début de formulaire.',
        });
      }
    }

    if (field.getAttribute('aria-invalid') === 'true') {
      const described = idRefs(field, 'aria-describedby').concat(idRefs(field, 'aria-errormessage')).some((id) => getById(id));
      if (!described) {
        out.warn({
          id: '11.10', rule: 'error-association', element: field,
          message: 'Champ en erreur (aria-invalid) sans message associé.',
          group: 'error-association',
          remediationHint: 'Associer le message d’erreur via aria-describedby.',
        });
      }
    }

    const autocomplete = field.getAttribute('autocomplete');
    if (autocomplete !== null && normalizedText(autocomplete) && !isValidAutocomplete(autocomplete)) {
      out.error({
        id: '11.13', rule: 'autocomplete-invalid', element: field,
        message: `Valeur autocomplete invalide : « ${autocomplete} ».`,
        group: `autocomplete-invalid-${autocomplete}`,
        remediationHint: 'Utiliser une valeur de la liste HTML (name, given-name, email, tel, postal-code…).',
      });
    } else if (isNative && field.localName !== 'select') {
      const identity = comparableText(`${field.name} ${field.id} ${field.type} ${name}`);
      const hint = PERSONAL_FIELD_HINTS.find((h) => h.re.test(identity));
      const type = (field.getAttribute('type') || '').toLowerCase();
      if (hint && !['search', 'checkbox', 'radio', 'password'].includes(type)
        && (autocomplete === null || /^(on|off)$/i.test(normalizedText(autocomplete)))) {
        out.warn({
          id: '11.13', rule: 'autocomplete-missing', element: field,
          message: `Champ de donnée personnelle probable sans autocomplete adapté (suggestion : ${hint.token}).`,
          group: `autocomplete-missing-${hint.token}`,
          confidence: 'low',
          rationale: 'Si le champ concerne l’utilisateur lui-même, autocomplete est exigé (11.13.1).',
          remediationHint: `Ajouter autocomplete="${hint.token}" si le champ porte sur l’utilisateur.`,
        });
      }
    }
  });

  if (labelled) {
    out.pass({ id: '11.1', rule: 'field-label-ok', message: `${labelled} champ(s) étiqueté(s).` });
    out.manual({ id: '11.2', rule: 'field-label-relevance', message: `${labelled} étiquette(s) : pertinence à vérifier.` });
  }

  const groups = new Map();
  document.querySelectorAll('input[type="radio" i], input[type="checkbox" i]').forEach((input) => {
    if (!isRendered(input) && !isRendered(input.closest('label') || input)) return;
    const name = normalizedText(input.getAttribute('name'));
    if (!name) return;
    const key = `${input.type}|${name}|${input.form ? [...document.forms].indexOf(input.form) : -1}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(input);
  });
  groups.forEach((inputs) => {
    if (inputs.length < 2) return;
    const container = inputs[0].closest('fieldset, [role="group"], [role="radiogroup"]');
    const allInside = container && inputs.every((i) => container.contains(i));
    if (!allInside) {
      out.error({
        id: '11.5', rule: 'choice-group', element: inputs[0],
        message: `Groupe de ${inputs.length} ${inputs[0].type === 'radio' ? 'boutons radio' : 'cases à cocher'} (name="${inputs[0].name}") non regroupé.`,
        group: 'choice-group',
        confidence: 'medium',
        remediationHint: 'Regrouper les options dans un <fieldset> avec une <legend>.',
      });
      return;
    }
    const legend = container.localName === 'fieldset'
      ? normalizedText(container.querySelector(':scope > legend')?.textContent)
      : accessibleName(container);
    if (!legend) {
      out.error({
        id: '11.6', rule: 'choice-group-legend', element: container,
        message: 'Regroupement de champs sans légende.',
        group: 'choice-group-legend',
        remediationHint: 'Ajouter une <legend> (ou aria-labelledby sur le role="group").',
      });
    }
  });

  let buttons = 0;
  [...document.querySelectorAll('button, input[type="submit" i], input[type="button" i], input[type="reset" i], [role="button"]')]
    .filter((b) => isRendered(b) && !isHiddenFromAT(b))
    .forEach((button) => {
      buttons++;
      const name = accessibleName(button);
      if (!name) {
        out.error({
          id: '11.9', rule: 'button-name', element: button,
          message: button.querySelector('svg, img, i, [class*="icon"]') ? 'Bouton icône sans intitulé.' : 'Bouton sans intitulé.',
          group: 'button-name',
          rationale: 'Un bouton sans intitulé est annoncé « bouton » sans indication de son action.',
          remediationHint: 'Ajouter un texte (éventuellement masqué) ou un aria-label décrivant l’action.',
        });
        return;
      }
      const visible = button.localName === 'input' ? normalizedText(button.value) : visibleLabelOf(button);
      if ((button.hasAttribute('aria-label') || button.hasAttribute('aria-labelledby'))
        && nameIncludesVisibleLabel(name, visible) === false) {
        (isShortVisibleLabel(visible) ? out.error : out.warn)({
          id: '11.9', rule: 'button-label-in-name', element: button,
          message: `Le nom accessible « ${name.slice(0, 50)} » ne contient pas l’intitulé visible « ${visible.slice(0, 40)} ».`,
          group: isShortVisibleLabel(visible) ? 'button-label-in-name' : 'button-label-in-name-long',
          rationale: 'Test 11.9.2 : le nom accessible doit contenir au moins l’intitulé visible.',
          remediationHint: 'Reprendre le texte visible au début de l’aria-label, ou supprimer l’aria-label.',
        });
      }
    });
  if (buttons) {
    out.manual({ id: '11.9', rule: 'button-name-relevance', message: `${buttons} bouton(s) : pertinence des intitulés à vérifier.` });
  }
}
