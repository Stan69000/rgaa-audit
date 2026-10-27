// guide.js — panneau latéral de la vérification manuelle guidée

'use strict';

const Core = window.RgaaGuideCore;
const { FICHES, MISSIONS } = window.RgaaGuideFiches;
const TITLES = (window.RgaaCriteria && window.RgaaCriteria.RGAA_CRITERIA) || {};
const PAGE_FILES = ['shared/rgaa-rules.js', 'shared/rgaa-guide-page.js'];
const OFFICIAL_URL = 'https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/';

/**
 * Profils : ils adaptent les questions proposées et le niveau de détail, pas les règles.
 *   decouverte  questions « pour tous », explications ouvertes
 *   habitue     toutes les questions, explications repliées
 *   technique   toutes les questions, sélecteurs et pistes de correction affichés
 */
const PROFILES = {
  decouverte: { label: 'Je découvre l’accessibilité', hint: 'Questions simples, chaque étape expliquée.', niveaux: ['tous'], explain: true, technical: false },
  habitue: { label: 'J’ai l’habitude', hint: 'Toutes les questions, explications repliées.', niveaux: ['tous', 'pratique'], explain: false, technical: false },
  technique: { label: 'Je développe le site', hint: 'Toutes les questions, avec sélecteurs CSS et pistes de correction.', niveaux: ['tous', 'pratique'], explain: false, technical: true },
};

const ANSWER_DEFAULTS = { oui: 'Oui', non: 'Non', na: 'Ne s’applique pas', nsp: 'Je ne sais pas' };
const NIVEAU_LABELS = { tous: 'Pour tous', pratique: 'Avec un peu de pratique' };

const state = {
  profile: null,
  session: null,
  page: null,
  plan: [],
  index: 0,
  itemIndex: 0,
  aidOn: false,
  notice: '',
};

const app = document.getElementById('app');
const statusEl = document.getElementById('status');

// ── Utilitaires d'interface ──────────────────

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'text') node.textContent = value;
    else if (key === 'onclick') node.addEventListener('click', value);
    else if (key === 'oninput') node.addEventListener('input', value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of [].concat(children)) if (child) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  return node;
}

function announce(message) {
  statusEl.textContent = '';
  setTimeout(() => { statusEl.textContent = message; }, 30);
}

/**
 * Remplace le contenu. Sur un nouvel écran, le focus va au titre ; sur une mise à jour du
 * même écran (réponse, signalement), il reste sur le contrôle équivalent.
 */
function show(nodes, { newScreen = true } = {}) {
  const previous = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk : null;
  app.replaceChildren(...nodes.filter(Boolean));
  if (!newScreen && previous) {
    const same = [...app.querySelectorAll('[data-fk]')].find((n) => n.dataset.fk === previous);
    if (same) {
      same.focus({ preventScroll: true });
      return;
    }
  }
  const heading = app.querySelector('h1, h2');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: false });
  }
}

function button(text, onclick, attrs = {}) {
  return el('button', { type: 'button', onclick, 'data-fk': attrs['data-fk'] || attrs['aria-label'] || text, ...attrs, text });
}

// ── Pont vers l'onglet audité ────────────────

class PageAccessError extends Error {}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new PageAccessError('Aucun onglet actif.');
  // Sans autorisation sur l'onglet (activeTab), l'adresse n'est pas transmise.
  if (!tab.url) throw new PageAccessError('Accès à la page non autorisé.');
  return tab;
}

async function inPage(func, args = []) {
  const tab = await activeTab();
  try {
    const [probe] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => Boolean(globalThis.RgaaRules && globalThis.RgaaRules.dom && globalThis.RgaaGuidePage),
    });
    if (!probe || !probe.result) await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: PAGE_FILES });
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func, args });
    return { tab, result: result ? result.result : undefined };
  } catch (err) {
    throw new PageAccessError(String(err && err.message || err));
  }
}

function accessHelp(err) {
  return el('div', { class: 'error', role: 'alert' }, [
    el('p', { text: 'Le guide n’a pas accès à cette page.' }),
    el('p', { text: 'Cliquez sur l’icône RGAA Audit dans la barre d’outils du navigateur pour l’autoriser, puis revenez ici. C’est nécessaire à chaque nouvelle page.' }),
    err && /protégée|chrome:|webstore|cannot be scripted/i.test(err.message) ? el('p', { class: 'muted', text: 'Les pages internes du navigateur et le Chrome Web Store ne peuvent pas être vérifiées.' }) : null,
  ]);
}

async function safe(action) {
  try {
    return await action();
  } catch (err) {
    if (err instanceof PageAccessError) {
      app.prepend(accessHelp(err));
      announce('Le guide n’a pas accès à cette page.');
      return undefined;
    }
    throw err;
  }
}

async function showAid(name) {
  if (!name) return clearAids();
  const res = await inPage((aid) => globalThis.RgaaGuidePage.showAid(aid), [name]);
  state.aidOn = true;
  return res;
}

async function clearAids() {
  state.aidOn = false;
  try {
    await inPage(() => globalThis.RgaaGuidePage.clear());
  } catch {
    // page quittée ou inaccessible : rien à nettoyer
  }
}

async function highlight(item, caption) {
  return inPage((key, text) => globalThis.RgaaGuidePage.highlight(key, text), [item.key, caption || '']);
}

// ── Session ──────────────────────────────────

function pageInfo() {
  return state.page ? { url: state.page.url, title: state.page.title } : null;
}

function entryFor(fiche) {
  if (!state.session || !state.page) return null;
  const page = state.session.pages[Core.pageKey(state.page.url)];
  return page ? page.criteres[fiche.id] || null : null;
}

function statusOf(step) {
  return Core.entryStatus(entryFor(step.fiche), step.items.length);
}

function badge(status) {
  const label = status ? Core.STATUS_LABELS[status] : 'À faire';
  return el('span', { class: `badge b-${status || 'none'}`, text: label });
}

function download(content, type, name) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = el('a', { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportSession() {
  if (!state.session) return;
  const name = `verification-${(state.session.site || 'site').replace(/^https?:\/\//, '').replace(/[^a-z0-9.-]+/gi, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
  download(JSON.stringify({ ...state.session, profil: state.profile }, null, 2), 'application/json', name);
  announce('Session exportée.');
}

function exportSynthesis() {
  if (!state.session) return;
  download(Core.synthesisHtml(state.session, { titles: TITLES, fiches: FICHES }), 'text/html;charset=utf-8', 'synthese-verification.html');
  announce('Synthèse exportée.');
}

function importSession() {
  const input = document.getElementById('importFile');
  input.value = '';
  input.click();
}

async function onImportFile() {
  const input = document.getElementById('importFile');
  {
    const file = input.files && input.files[0];
    if (!file) return;
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      renderMessage('Ce fichier n’est pas une session valide (JSON illisible).');
      return;
    }
    const check = Core.validateSession(data);
    if (!check.ok) {
      renderMessage(`Session refusée : ${check.errors.slice(0, 3).join(' ')}`);
      return;
    }
    state.session = state.session ? Core.mergeSessions(state.session, data) : data;
    if (!state.profile && PROFILES[data.profil]) state.profile = data.profil;
    const pages = Object.keys(data.pages).length;
    announce(`Session importée : ${pages} page(s).`);
    state.notice = `Session importée : ${pages} page(s). Les réponses les plus récentes ont été conservées.`;
    if (state.plan.length) renderPlan(); else renderHome();
  }
}

function renderMessage(text) {
  app.prepend(el('div', { class: 'error', role: 'alert', text }));
  announce(text);
}

// ── Écrans ───────────────────────────────────

function renderProfiles() {
  show([
    el('h1', { text: 'Vérification guidée' }),
    el('p', { text: 'Le guide vous pose, une par une, les questions qu’aucun outil automatique ne peut trancher, en vous montrant les éléments concernés dans la page.' }),
    el('h2', { text: 'Quel profil vous ressemble ?' }),
    el('div', { class: 'stack', role: 'group', 'aria-label': 'Choix du profil' }, Object.entries(PROFILES).map(([key, p]) => button('', () => {
      state.profile = key;
      announce(`Profil : ${p.label}.`);
      renderHome();
    }, { class: 'card', 'data-fk': `profil-${key}` }))),
    el('p', { class: 'muted', text: 'Vous pourrez changer de profil à tout moment. Il adapte les questions et le niveau de détail, pas l’exigence.' }),
  ]);
  // Libellés des boutons de profil construits après coup pour garder un intitulé riche et lisible.
  app.querySelectorAll('[role="group"] button').forEach((b, i) => {
    const p = Object.values(PROFILES)[i];
    b.append(el('span', { class: 'label-text', text: p.label }), el('span', { class: 'muted', text: p.hint }));
  });
}

function renderHome() {
  if (!state.profile) return renderProfiles();
  const profile = PROFILES[state.profile];
  const answered = state.session ? Object.values(state.session.pages).reduce((n, p) => n + Object.keys(p.criteres).length, 0) : 0;
  show([
    state.notice ? el('p', { class: 'notice', text: state.notice }) : null,
    el('h1', { text: 'Vérification guidée' }),
    el('p', { class: 'muted', text: `Profil : ${profile.label}.` }),
    el('p', { text: 'Ouvrez la page à vérifier dans l’onglet courant, puis lancez l’analyse. Rien ne quitte votre navigateur : vos réponses se sauvegardent en exportant un fichier.' }),
    el('div', { class: 'stack' }, [
      button('Analyser la page affichée', () => safe(startPage), { class: 'primary' }),
      button('Reprendre une session (importer un fichier)', importSession),
      answered ? button(`Voir la synthèse (${answered} critère(s) renseigné(s))`, renderSynthesis) : null,
      button('Changer de profil', () => { state.profile = null; renderProfiles(); }),
    ]),
  ]);
  state.notice = '';
}

async function startPage() {
  announce('Analyse de la page en cours.');
  const { result } = await inPage(() => ({ ...globalThis.RgaaGuidePage.inventory(), engine: globalThis.RgaaRules.ENGINE_VERSION }));
  state.page = result;
  if (!state.session) state.session = Core.createSession(result.url, result.engine);
  const profile = PROFILES[state.profile];
  state.plan = Core.buildPlan(result, FICHES, MISSIONS).filter((step) => profile.niveaux.includes(step.fiche.niveau));
  state.index = 0;
  state.itemIndex = 0;
  document.getElementById('pageInfo').textContent = `Page : ${result.title || result.url}`;
  renderPlan();
}

function renderPlan() {
  clearAids();
  const done = state.plan.filter((step) => statusOf(step)).length;
  const groups = MISSIONS.map((m) => ({ mission: m, steps: state.plan.map((s, i) => ({ ...s, i })).filter((s) => s.fiche.mission === m.key) }))
    .filter((g) => g.steps.length);
  const firstTodo = state.plan.findIndex((step) => !statusOf(step));
  show([
    state.notice ? el('p', { class: 'notice', text: state.notice }) : null,
    el('h2', { text: 'Plan de vérification' }),
    el('p', { class: 'muted', text: `${state.page.title || state.page.url}` }),
    el('p', { text: `${state.plan.length} question(s) pour cette page, environ ${Math.max(5, Math.round(state.plan.length * 1.5))} minutes. ${done} faite(s).` }),
    el('div', { class: 'row' }, [
      button(done ? 'Reprendre' : 'Commencer', () => openStep(firstTodo === -1 ? 0 : firstTodo), { class: 'primary' }),
      button('Synthèse', renderSynthesis),
    ]),
    ...groups.map((g) => el('section', { class: 'stack', 'aria-label': g.mission.label }, [
      el('h3', { text: g.mission.label }),
      el('ul', { class: 'plan' }, g.steps.map((s) => el('li', {}, [
        button('', () => openStep(s.i)),
      ]))),
    ])),
    el('nav', { class: 'bottom', 'aria-label': 'Session' }, [
      button('Exporter la session', exportSession),
      button('Analyser une autre page', () => safe(startPage)),
    ]),
  ]);
  state.notice = '';
  // Contenu des boutons du plan : question, critère et état.
  let k = 0;
  groups.forEach((g) => g.steps.forEach((s) => {
    const b = app.querySelectorAll('.plan button')[k++];
    b.append(el('span', {}, [el('span', { class: 'crit', text: `${s.fiche.id} · ` }), s.fiche.question]), badge(statusOf(s)));
  }));
}

async function openStep(index) {
  state.index = Math.max(0, Math.min(index, state.plan.length - 1));
  const step = state.plan[state.index];
  if (step.fiche.mode === 'element') {
    const entry = entryFor(step.fiche);
    const firstTodo = step.items.findIndex((it) => !(entry && entry.elements[it.key]));
    state.itemIndex = firstTodo === -1 ? 0 : firstTodo;
  }
  renderStep({ newScreen: true });
  await safe(async () => {
    if (step.fiche.aide) await showAid(step.fiche.aide);
    else await clearAids();
    const toggle = app.querySelector('[data-fk="aide"]');
    if (toggle) toggle.setAttribute('aria-pressed', String(state.aidOn));
    if (step.fiche.mode === 'element') await highlight(step.items[state.itemIndex], step.items[state.itemIndex].label);
  });
}

function stepHeader(step) {
  const mission = MISSIONS.find((m) => m.key === step.fiche.mission);
  return el('p', { class: 'eyebrow' }, [
    el('span', { text: `${mission ? mission.label : ''} · question ${state.index + 1} sur ${state.plan.length}` }),
    el('span', { text: `Critère ${step.fiche.id}` }),
  ]);
}

function explanation(fiche, profile) {
  const why = el('p', { text: fiche.pourquoi });
  const steps = el('ol', { class: 'steps' }, fiche.etapes.map((t) => el('li', { text: t })));
  const examples = el('details', {}, [
    el('summary', { text: 'Exemples' }),
    el('div', {}, [
      el('p', { text: `Bien : ${fiche.exemples.bon}` }),
      el('p', { text: `À éviter : ${fiche.exemples.mauvais.join(' · ')}` }),
    ]),
  ]);
  const official = el('details', {}, [
    el('summary', { text: `Critère officiel ${fiche.id}` }),
    el('div', {}, [
      el('p', { text: TITLES[fiche.id] || '' }),
      el('a', { href: `${OFFICIAL_URL}#${fiche.id}`, target: '_blank', rel: 'noopener noreferrer' }, ['Tests officiels du RGAA', el('span', { class: 'visually-hidden', text: ' (nouvelle fenêtre)' })]),
    ]),
  ]);
  if (profile.explain) return [why, el('h3', { text: 'Comment vérifier' }), steps, examples, official];
  return [el('details', {}, [el('summary', { text: 'Pourquoi et comment vérifier' }), el('div', {}, [why, steps])]), examples, official];
}

function answerButtons(fiche, current, onAnswer, { withNa = true } = {}) {
  const labels = { ...ANSWER_DEFAULTS, ...(fiche.reponses || {}) };
  const keys = ['oui', 'non'];
  if (withNa && fiche.reponses && fiche.reponses.na) keys.push('na');
  keys.push('nsp');
  return el('div', { class: 'answers', role: 'group', 'aria-label': 'Votre réponse' }, keys.map((k) => button(labels[k], () => onAnswer(k), {
    class: `a-${k}`, 'aria-pressed': String(current === k),
  })));
}

function noteField(fiche) {
  const entry = entryFor(fiche);
  let timer = null;
  const id = `note-${fiche.id.replace('.', '-')}`;
  return el('div', { class: 'stack' }, [
    el('label', { for: id, text: 'Note (facultatif)' }),
    el('textarea', {
      id,
      oninput: (e) => {
        clearTimeout(timer);
        const value = e.target.value;
        timer = setTimeout(() => Core.setNote(state.session, pageInfo(), fiche, value), 300);
      },
    }, entry && entry.note ? [entry.note] : []),
  ]);
}

function stepNav() {
  return el('nav', { class: 'bottom', 'aria-label': 'Questions' }, [
    button('Question précédente', () => openStep(state.index - 1), { disabled: state.index === 0 }),
    button('Plan', renderPlan),
    state.index < state.plan.length - 1
      ? button('Question suivante', () => openStep(state.index + 1), { class: 'primary' })
      : button('Voir la synthèse', renderSynthesis, { class: 'primary' }),
  ]);
}

function aidToggle(fiche) {
  if (!fiche.aide) return null;
  return button('Aide visuelle dans la page', async () => {
    if (state.aidOn) await safe(clearAids); else await safe(() => showAid(fiche.aide));
    renderStep();
    announce(state.aidOn ? 'Aide visuelle affichée dans la page.' : 'Aide visuelle masquée.');
  }, { 'aria-pressed': String(state.aidOn), 'data-fk': 'aide' });
}

function renderStep({ newScreen = false } = {}) {
  const step = state.plan[state.index];
  const { fiche } = step;
  const profile = PROFILES[state.profile];
  const body = [
    stepHeader(step),
    el('h2', { text: fiche.question }),
    el('p', { class: 'muted', text: NIVEAU_LABELS[fiche.niveau] }),
    ...explanation(fiche, profile),
    aidToggle(fiche),
  ];
  if (fiche.mode === 'element') body.push(...elementView(step, profile));
  else if (fiche.mode === 'liste') body.push(...listView(step, profile));
  else body.push(...pageView(step, profile));
  body.push(noteField(fiche));
  const status = statusOf(step);
  if (status === 'NC' && profile.technical && fiche.correction) body.push(el('p', { class: 'notice', text: `Piste de correction : ${fiche.correction}` }));
  body.push(stepNav());
  show(body, { newScreen });
}

function elementView(step, profile) {
  const { fiche, items } = step;
  const item = items[state.itemIndex];
  const entry = entryFor(fiche);
  const current = entry && entry.elements[item.key] ? entry.elements[item.key].reponse : null;
  return [
    el('div', { class: 'card' }, [
      el('p', { class: 'eyebrow' }, [el('span', { text: `Élément ${state.itemIndex + 1} sur ${items.length}` })]),
      el('p', { class: 'label-text', text: item.label }),
      item.detail ? el('p', { class: 'muted', text: item.detail }) : null,
      profile.technical ? el('code', { text: item.key }) : null,
      el('div', { class: 'row' }, [
        button('Voir dans la page', () => safe(() => highlight(item, item.label))),
        button('Élément précédent', () => moveItem(-1), { disabled: state.itemIndex === 0 }),
        button('Élément suivant', () => moveItem(1), { disabled: state.itemIndex >= items.length - 1 }),
      ]),
    ]),
    answerButtons(fiche, current, (reponse) => {
      Core.recordElement(state.session, pageInfo(), fiche, item, reponse, items.length);
      announce(`Réponse enregistrée pour l’élément ${state.itemIndex + 1}.`);
      if (state.itemIndex < items.length - 1) moveItem(1);
      else {
        renderStep();
        const s = statusOf(step);
        announce(s ? `Question terminée : ${Core.STATUS_LABELS[s]}.` : 'Réponse enregistrée.');
      }
    }),
  ];
}

async function moveItem(delta) {
  const step = state.plan[state.index];
  state.itemIndex = Math.max(0, Math.min(state.itemIndex + delta, step.items.length - 1));
  renderStep();
  const item = step.items[state.itemIndex];
  announce(`Élément ${state.itemIndex + 1} sur ${step.items.length} : ${item.label}`);
  await safe(() => highlight(item, item.label));
}

function listView(step, profile) {
  const { fiche, items } = step;
  const entry = entryFor(fiche);
  const flagged = new Set(entry ? entry.signales.map((s) => s.key) : []);
  const list = el('ul', { class: 'items', 'aria-label': `${items.length} élément(s)` }, items.map((item) => el('li', {}, [
    el('span', { class: 'txt' }, [item.label, item.detail || profile.technical ? el('span', { class: 'sub', text: profile.technical ? `${item.detail} · ${item.key}` : item.detail }) : null]),
    button('Voir', () => safe(() => highlight(item, item.label)), { 'aria-label': `Voir « ${item.label} » dans la page` }),
    button(fiche.signaler || 'Problème', () => {
      const now = Core.toggleFlag(state.session, pageInfo(), fiche, item);
      renderStep();
      announce(now ? `« ${item.label} » signalé.` : `Signalement retiré pour « ${item.label} ».`);
    }, { 'aria-pressed': String(flagged.has(item.key)), 'aria-label': `${fiche.signaler || 'Problème'} : ${item.label}` }),
  ])));
  const current = entry ? entry.reponse : null;
  return [
    list,
    flagged.size
      ? el('p', { class: 'notice', text: `${flagged.size} élément(s) signalé(s) : le critère sera marqué non conforme.` })
      : el('div', { class: 'answers', role: 'group', 'aria-label': 'Votre réponse' }, [
        button('Tout est clair', () => { Core.recordPage(state.session, pageInfo(), fiche, 'oui'); renderStep(); announce('Réponse enregistrée : conforme.'); }, { class: 'a-oui', 'aria-pressed': String(current === 'oui') }),
        button(ANSWER_DEFAULTS.nsp, () => { Core.recordPage(state.session, pageInfo(), fiche, 'nsp'); renderStep(); announce('Réponse enregistrée.'); }, { class: 'a-nsp', 'aria-pressed': String(current === 'nsp') }),
      ]),
  ];
}

function pageView(step) {
  const { fiche, items } = step;
  const entry = entryFor(fiche);
  const nodes = [];
  if (fiche.montrer === 'title') nodes.push(el('div', { class: 'card' }, [el('p', { class: 'muted', text: 'Titre de la page' }), el('p', { class: 'label-text', text: state.page.title || '(aucun titre)' })]));
  if (fiche.montrer === 'lang') nodes.push(el('div', { class: 'card' }, [el('p', { class: 'muted', text: 'Langue déclarée' }), el('p', { class: 'label-text', text: state.page.lang || '(aucune langue déclarée)' })]));
  if (fiche.collection === 'headings') {
    nodes.push(el('h3', { text: 'Plan des titres' }), el('ul', { class: 'outline' }, items.map((h) => el('li', { style: `padding-left:${(h.level - 1) * 12}px` }, [el('span', { class: 'lvl', text: `H${h.level}` }), h.label]))));
  }
  if (fiche.collection === 'landmarks') {
    nodes.push(el('h3', { text: 'Zones détectées' }), el('ul', { class: 'outline' }, items.length ? items.map((l) => el('li', { text: l.label })) : [el('li', { text: 'Aucune zone balisée.' })]));
  }
  if (fiche.collection === 'tabOrder') {
    nodes.push(el('h3', { text: `Ordre de tabulation (${items.length} éléments)` }), el('ol', { class: 'outline' }, items.slice(0, 60).map((t) => el('li', { text: `${t.order}. ${t.label}` }))));
  }
  nodes.push(answerButtons(fiche, entry ? entry.reponse : null, (reponse) => {
    Core.recordPage(state.session, pageInfo(), fiche, reponse);
    renderStep();
    announce('Réponse enregistrée.');
  }));
  return nodes;
}

function renderSynthesis() {
  clearAids();
  const pages = state.session ? Object.entries(state.session.pages) : [];
  const sections = pages.map(([path, page]) => {
    const rows = Object.entries(page.criteres).map(([id, entry]) => ({ id, entry, status: Core.entryStatus(entry) }))
      .filter((r) => r.status)
      .sort((a, b) => a.id.localeCompare(b.id, 'fr', { numeric: true }));
    return el('section', { class: 'stack', 'aria-label': page.titre || path }, [
      el('h3', { text: page.titre || path }),
      rows.length ? el('ul', { class: 'plan' }, rows.map((r) => {
        const fiche = FICHES.find((f) => f.id === r.id);
        const problems = Core.problems(r.entry);
        return el('li', { class: 'card' }, [
          el('div', { class: 'row' }, [el('span', { class: 'crit', text: r.id }), badge(r.status)]),
          el('p', { text: fiche ? fiche.question : TITLES[r.id] || '' }),
          problems.length ? el('ul', {}, problems.slice(0, 10).map((p) => el('li', { text: p }))) : null,
          r.entry.note ? el('p', { class: 'muted', text: r.entry.note }) : null,
        ]);
      })) : el('p', { class: 'muted', text: 'Aucune réponse terminée sur cette page.' }),
    ]);
  });
  show([
    el('h2', { text: 'Synthèse' }),
    el('p', { class: 'muted', text: 'Exportez la session pour reprendre plus tard ou la transmettre, et la synthèse pour la partager.' }),
    el('div', { class: 'row' }, [
      button('Exporter la session', exportSession, { class: 'primary', disabled: !state.session }),
      button('Exporter la synthèse', exportSynthesis, { disabled: !state.session }),
      button('Importer une session', importSession),
    ]),
    ...(sections.length ? sections : [el('p', { text: 'Aucune réponse pour l’instant.' })]),
    el('nav', { class: 'bottom', 'aria-label': 'Navigation' }, [
      state.plan.length ? button('Retour au plan', renderPlan) : button('Accueil', renderHome),
    ]),
  ]);
}

document.getElementById('importFile').addEventListener('change', onImportFile);
renderProfiles();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PROFILES, state };
}
