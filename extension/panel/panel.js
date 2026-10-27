// panel.js — Logique du panneau RGAA Audit

'use strict';

const STATUS_LABELS = { NC: 'Non conforme', NT: 'À vérifier', C: 'Conforme', NA: 'Non applicable' };
const STATUS_ORDER = { NC: 0, NT: 1, C: 2, NA: 3 };
const CONFIDENCE_LABELS = { high: 'confiance élevée', medium: 'confiance moyenne', low: 'confiance faible' };

let currentReport = null;
let currentFilter = 'all';

const $ = (id) => document.getElementById(id);

function criteriaTitles() {
  return (typeof window !== 'undefined' && window.RgaaCriteria && window.RgaaCriteria.RGAA_CRITERIA) || {};
}

function compareCriterionIds(a, b) {
  const [ta, ca] = a.split('.').map(Number);
  const [tb, cb] = b.split('.').map(Number);
  return ta - tb || ca - cb;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of [].concat(children)) {
    if (child) node.appendChild(child);
  }
  return node;
}

function announce(message) {
  const status = $('status');
  if (status) status.textContent = message;
}

// ── Lancement ────────────────────────────────

function startAudit() {
  const btn = $('btnAudit');
  btn.disabled = true;
  btn.textContent = 'Analyse en cours…';
  $('guideCallout').hidden = true;
  announce('Analyse de la page en cours.');
  $('results').replaceChildren(createStatusMessage('Analyse en cours…'));

  chrome.runtime.sendMessage({ action: 'getAuditResults' }, (response) => {
    btn.disabled = false;
    btn.textContent = 'Relancer l’audit automatique';

    if (chrome.runtime.lastError || !response || !response.success) {
      renderError(response?.error || chrome.runtime.lastError?.message);
      return;
    }

    currentReport = response.report;
    renderScore(currentReport.score);
    $('urlDisplay').textContent = `Page analysée : ${currentReport.url}`;
    $('urlDisplay').hidden = false;
    $('engineInfo').textContent = `Moteur ${currentReport.engineVersion || '?'} — RGAA 4.1.2`;
    $('scoreBar').hidden = false;
    $('scoreDetails').hidden = false;
    document.body.classList.add('audited');
    $('filters').hidden = false;
    $('footer').hidden = false;
    renderResults(currentReport.results, currentFilter);
    const s = currentReport.score;
    if (s.aVerifier > 0 && !$('btnGuide').hidden) {
      $('calloutTitle').textContent = `${s.aVerifier} critère(s) restent à vérifier par une personne.`;
      $('guideCallout').hidden = false;
      // L'invitation, plus parlante après l'audit, remplace le bouton générique du guide.
      $('guidePath').hidden = true;
    }
    announce(`Audit terminé : ${s.nonConformes} critère(s) non conforme(s), ${s.aVerifier || 0} à vérifier, ${s.conformes} conforme(s).`);
  });
}

// ── Score ────────────────────────────────────

function renderScore(score) {
  const circumference = 2 * Math.PI * 22;
  const color = score.taux >= 75 ? '#3EE6AE' : score.taux >= 50 ? '#FFCB57' : '#FF7A7A';
  const circle = $('scoreCircle');
  circle.style.strokeDashoffset = String(circumference - (score.taux / 100) * circumference);
  circle.style.stroke = color;
  $('scoreValue').textContent = `${score.taux}%`;
  $('scoreValue').style.color = color;
  $('statNC').textContent = score.nonConformes;
  $('statNT').textContent = score.aVerifier || 0;
  $('statC').textContent = score.conformes;
  $('statNA').textContent = score.na;
  $('scoreExplain').textContent = `Score technique : ${score.taux} % des critères tranchés automatiquement sont conformes `
    + `(${score.conformes} conforme(s), ${score.nonConformes} non conforme(s)). `
    + `${score.aVerifier || 0} critère(s) restent à vérifier et n’entrent pas dans ce score.`;
}

// ── Résultats ────────────────────────────────

function groupByCriterion(results, filter) {
  const groups = new Map();
  for (const result of results) {
    if (filter !== 'all' && result.status !== filter) continue;
    if (!groups.has(result.id)) groups.set(result.id, []);
    groups.get(result.id).push(result);
  }
  return groups;
}

function renderResults(results, filter) {
  const container = $('results');
  const groups = groupByCriterion(results || [], filter);
  if (!groups.size) {
    container.replaceChildren(createStatusMessage('Aucun résultat pour ce filtre.'));
    return;
  }
  const statusByCriterion = (currentReport && currentReport.score && currentReport.score.criteria) || {};
  const ids = [...groups.keys()].sort((a, b) => {
    const sa = STATUS_ORDER[statusByCriterion[a]] ?? 4;
    const sb = STATUS_ORDER[statusByCriterion[b]] ?? 4;
    return sa - sb || compareCriterionIds(a, b);
  });
  const titles = criteriaTitles();
  container.replaceChildren(...ids.map((id) => renderCriterion(id, titles[id], statusByCriterion[id], groups.get(id))));
}

function renderCriterion(id, title, status, items) {
  const sorted = [...items].sort((a, b) => (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4));
  const effective = status || sorted[0].status;
  const summary = el('summary', {}, [
    renderBadge(effective),
    el('span', { class: 'criterion-id', text: id }),
    el('span', { class: 'criterion-title', text: title || 'Critère RGAA' }),
  ]);
  const details = el('details', { class: 'criterion', open: effective === 'NC' }, [
    summary,
    el('ul', { class: 'result-list' }, sorted.map(renderResultItem)),
  ]);
  return details;
}

function renderBadge(status) {
  return el('span', { class: `badge badge-${status}`, title: STATUS_LABELS[status] || status }, [
    el('span', { 'aria-hidden': 'true', text: status }),
    el('span', { class: 'visually-hidden', text: STATUS_LABELS[status] || status }),
  ]);
}

function renderResultItem(result) {
  const body = el('div', { class: 'result-body' }, [
    el('p', { class: 'result-message', text: result.message || '' }),
  ]);
  if (result.remediationHint && result.status !== 'C' && result.status !== 'NA') {
    body.appendChild(el('p', { class: 'result-hint', text: `Piste : ${result.remediationHint}` }));
  }
  const meta = [];
  if (result.confidence && CONFIDENCE_LABELS[result.confidence] && result.status !== 'NA') meta.push(CONFIDENCE_LABELS[result.confidence]);
  if (result.context) meta.push(`thème ${result.context}`);
  if (meta.length) body.appendChild(el('p', { class: 'result-meta', text: meta.join(' · ') }));

  const examples = Array.isArray(result.examples) && result.examples.length
    ? result.examples
    : (result.snippet ? [{ selector: result.selector || null, snippet: result.snippet }] : []);
  if (examples.length) {
    body.appendChild(el('ul', { class: 'examples', 'aria-label': 'Exemples dans la page' }, examples.map(renderExample)));
  }
  return el('li', { class: 'result-item' }, [renderBadge(result.status), body]);
}

function renderExample(example) {
  const item = el('li', { class: 'example' }, [
    el('code', { text: example.snippet || example.selector || '', title: example.snippet || '' }),
  ]);
  if (example.selector && typeof chrome !== 'undefined' && chrome.runtime) {
    const button = el('button', { type: 'button', class: 'btn-locate', text: 'Voir' });
    button.setAttribute('aria-label', `Voir l’élément dans la page : ${example.selector}`);
    button.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'highlightElement', selector: example.selector }, (response) => {
        announce(response && response.success ? 'Élément mis en évidence dans la page.' : 'Élément introuvable dans la page.');
      });
    });
    item.appendChild(button);
  }
  return item;
}

function createStatusMessage(message) {
  return el('p', { class: 'empty', text: message });
}

function renderError(message) {
  const text = `Erreur : ${message || 'impossible de communiquer avec la page.'}`;
  $('results').replaceChildren(el('p', { class: 'error', role: 'alert', text }));
}

// ── Filtres ──────────────────────────────────

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
  if (currentReport) {
    renderResults(currentReport.results, currentFilter);
    const count = groupByCriterion(currentReport.results, filter).size;
    announce(`${count} critère(s) affiché(s).`);
  }
}

// ── Exports ──────────────────────────────────

function download(content, type, fileName) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: fileName });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Vérification guidée (panneau latéral) ────

/**
 * sidePanel.open() doit être appelé directement dans le clic : la fenêtre est donc
 * repérée à l'ouverture du panneau, avant le clic.
 */
function setupGuideButton() {
  const buttons = [...document.querySelectorAll('[data-open-guide]')];
  if (!buttons.length) return;
  if (!chrome.sidePanel || typeof chrome.sidePanel.open !== 'function') {
    buttons.forEach((b) => { b.closest('.path, .guide-callout').hidden = true; b.hidden = true; });
    return;
  }
  let windowId = null;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    windowId = tabs && tabs[0] ? tabs[0].windowId : null;
  });
  buttons.forEach((btn) => btn.addEventListener('click', () => {
    if (windowId === null) return;
    chrome.sidePanel.open({ windowId }).then(() => window.close()).catch((err) => renderError(err && err.message));
  }));
}

function buildVulgarizedHtml(report) {
  const shared = window.RgaaSharedReport;
  if (!shared || typeof shared.generateVulgarizedReport !== 'function') {
    throw new Error('Template partagé indisponible.');
  }
  return shared.generateVulgarizedReport(report, { includeCliLink: true });
}

if (typeof document !== 'undefined' && document.getElementById('btnAudit')) {
  $('btnAudit').addEventListener('click', startAudit);
  setupGuideButton();
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
  });
  $('btnExport').addEventListener('click', () => {
    if (currentReport) download(JSON.stringify(currentReport, null, 2), 'application/json', `rgaa-audit-${Date.now()}.json`);
  });
  $('btnExportHtml').addEventListener('click', () => {
    if (currentReport) download(buildVulgarizedHtml(currentReport), 'text/html;charset=utf-8', `rapport-vulgarise-${Date.now()}.html`);
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderResultItem,
    renderCriterion,
    createStatusMessage,
    groupByCriterion,
    compareCriterionIds,
  };
}
