/**
 * Logique du guide manuel, indépendante du navigateur : plan de vérification, réponses,
 * statut de chaque critère, session exportable et synthèse HTML.
 */

'use strict';

(function (root) {
  const FORMAT = 'rgaa-audit-session/1';
  const REPONSES = ['oui', 'non', 'na', 'nsp'];
  const STATUS_LABELS = { C: 'Conforme', NC: 'Non conforme', NA: 'Non applicable', NT: 'À confier à un professionnel' };

  function pageKey(url) {
    try {
      const u = new URL(url);
      return `${u.pathname}${u.search}` || '/';
    } catch {
      return String(url || '/');
    }
  }

  function siteOf(url) {
    try {
      return new URL(url).origin;
    } catch {
      return '';
    }
  }

  /** Fiches applicables à la page, dans l'ordre des missions, avec leurs éléments. */
  function buildPlan(inventory, fiches, missions) {
    const order = new Map(missions.map((m, i) => [m.key, i]));
    return fiches
      .map((fiche) => ({ fiche, items: fiche.collection ? (inventory.collections[fiche.collection] || []) : [] }))
      .filter(({ fiche, items }) => fiche.mode === 'page' || items.length > 0)
      .sort((a, b) => (order.get(a.fiche.mission) ?? 99) - (order.get(b.fiche.mission) ?? 99));
  }

  function createSession(url, engineVersion = '') {
    const now = new Date().toISOString();
    return { format: FORMAT, site: siteOf(url), moteur: engineVersion, creeLe: now, modifieLe: now, pages: {} };
  }

  function ensureEntry(session, page, fiche) {
    const key = pageKey(page.url);
    if (!session.pages[key]) session.pages[key] = { url: page.url, titre: page.title || '', criteres: {} };
    const criteres = session.pages[key].criteres;
    if (!criteres[fiche.id]) criteres[fiche.id] = { mode: fiche.mode, elements: {}, signales: [], reponse: null, note: '' };
    return criteres[fiche.id];
  }

  function touch(session, entry) {
    const now = new Date().toISOString();
    entry.le = now;
    session.modifieLe = now;
  }

  function recordElement(session, page, fiche, item, reponse, total) {
    if (!REPONSES.includes(reponse)) throw new Error(`Réponse inconnue : ${reponse}`);
    const entry = ensureEntry(session, page, fiche);
    entry.elements[item.key] = { reponse, label: item.label };
    if (Number.isFinite(total)) entry.total = total;
    touch(session, entry);
    return entry;
  }

  function toggleFlag(session, page, fiche, item) {
    const entry = ensureEntry(session, page, fiche);
    const index = entry.signales.findIndex((s) => s.key === item.key);
    if (index === -1) entry.signales.push({ key: item.key, label: item.label });
    else entry.signales.splice(index, 1);
    entry.reponse = null;
    touch(session, entry);
    return index === -1;
  }

  function recordPage(session, page, fiche, reponse) {
    if (!REPONSES.includes(reponse)) throw new Error(`Réponse inconnue : ${reponse}`);
    const entry = ensureEntry(session, page, fiche);
    entry.reponse = reponse;
    touch(session, entry);
    return entry;
  }

  function setNote(session, page, fiche, note) {
    const entry = ensureEntry(session, page, fiche);
    entry.note = String(note || '').slice(0, 2000);
    touch(session, entry);
  }

  /**
   * Statut d'un critère à partir des réponses : un seul « non » suffit pour NC ;
   * « je ne sais pas » renvoie vers un professionnel (NT) ; null tant que ce n'est pas fini.
   */
  function entryStatus(entry, itemCount) {
    if (!entry) return null;
    if (!Number.isFinite(itemCount)) itemCount = Number(entry.total) || 0;
    if (entry.mode === 'element') {
      const answers = Object.values(entry.elements).map((e) => e.reponse);
      if (answers.includes('non')) return 'NC';
      if (answers.length < itemCount) return null;
      if (answers.includes('nsp')) return 'NT';
      if (answers.length && answers.every((r) => r === 'na')) return 'NA';
      return answers.length ? 'C' : null;
    }
    if (entry.mode === 'liste') {
      if (entry.signales.length) return 'NC';
      return { oui: 'C', nsp: 'NT', na: 'NA' }[entry.reponse] || null;
    }
    return { oui: 'C', non: 'NC', na: 'NA', nsp: 'NT' }[entry.reponse] || null;
  }

  /** Éléments à corriger (réponses « non » ou signalés), pour la synthèse et la grille. */
  function problems(entry) {
    if (!entry) return [];
    if (entry.mode === 'liste') return entry.signales.map((s) => s.label);
    return Object.values(entry.elements).filter((e) => e.reponse === 'non').map((e) => e.label);
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  /** Vérifie un fichier de session importé avant de l'utiliser. */
  function validateSession(data) {
    const errors = [];
    if (!isPlainObject(data)) return { ok: false, errors: ['Le fichier ne contient pas une session.'] };
    if (data.format !== FORMAT) errors.push(`Format inattendu : ${data.format || 'absent'} (attendu ${FORMAT}).`);
    if (!isPlainObject(data.pages)) errors.push('Aucune page dans la session.');
    else {
      for (const [path, page] of Object.entries(data.pages)) {
        if (!isPlainObject(page) || !isPlainObject(page.criteres)) {
          errors.push(`Page ${path} : réponses illisibles.`);
          continue;
        }
        for (const [id, entry] of Object.entries(page.criteres)) {
          if (!/^\d{1,2}\.\d{1,2}$/.test(id)) errors.push(`Page ${path} : critère invalide « ${id} ».`);
          if (!isPlainObject(entry) || !['element', 'liste', 'page'].includes(entry.mode)) errors.push(`Page ${path}, critère ${id} : mode invalide.`);
          else {
            if (!isPlainObject(entry.elements) || !Array.isArray(entry.signales)) errors.push(`Page ${path}, critère ${id} : contenu invalide.`);
            if (entry.reponse !== null && entry.reponse !== undefined && !REPONSES.includes(entry.reponse)) errors.push(`Page ${path}, critère ${id} : réponse invalide.`);
          }
        }
      }
    }
    return { ok: errors.length === 0, errors };
  }

  /** Fusionne une session importée : pour chaque critère, la réponse la plus récente l'emporte. */
  function mergeSessions(base, incoming) {
    const merged = JSON.parse(JSON.stringify(base));
    if (!merged.site && incoming.site) merged.site = incoming.site;
    for (const [path, page] of Object.entries(incoming.pages || {})) {
      if (!merged.pages[path]) merged.pages[path] = { url: page.url, titre: page.titre || '', criteres: {} };
      for (const [id, entry] of Object.entries(page.criteres || {})) {
        const current = merged.pages[path].criteres[id];
        if (!current || String(entry.le || '') >= String(current.le || '')) {
          merged.pages[path].criteres[id] = JSON.parse(JSON.stringify(entry));
        }
      }
    }
    merged.modifieLe = new Date().toISOString();
    return merged;
  }

  function esc(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function compareIds(a, b) {
    const [ta, ca] = a.split('.').map(Number);
    const [tb, cb] = b.split('.').map(Number);
    return ta - tb || ca - cb;
  }

  /** Synthèse autonome et accessible de la vérification, à partager. */
  function synthesisHtml(session, { titles = {}, fiches = [] } = {}) {
    const ficheById = new Map(fiches.map((f) => [f.id, f]));
    const pages = Object.entries(session.pages || {}).map(([path, page]) => {
      const rows = Object.entries(page.criteres).sort(([a], [b]) => compareIds(a, b)).map(([id, entry]) => {
        const status = entryStatus(entry);
        if (!status) return '';
        const fiche = ficheById.get(id);
        const items = problems(entry);
        return `<tr>
          <th scope="row">${esc(id)}</th>
          <td>${esc(fiche ? fiche.question : titles[id] || '')}</td>
          <td><span class="s s-${esc(status)}">${esc(STATUS_LABELS[status])}</span></td>
          <td>${items.length ? `<ul>${items.slice(0, 20).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}${entry.note ? `<p>${esc(entry.note)}</p>` : ''}${status === 'NC' && fiche && fiche.correction ? `<p class="fix">Correction : ${esc(fiche.correction)}</p>` : ''}</td>
        </tr>`;
      }).join('');
      return `<section><h2>${esc(page.titre || path)}</h2><p class="url">${esc(page.url || path)}</p>
        <table><thead><tr><th scope="col">Critère</th><th scope="col">Question</th><th scope="col">Résultat</th><th scope="col">Détails</th></tr></thead><tbody>${rows}</tbody></table></section>`;
    }).join('');
    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vérification manuelle – ${esc(session.site || 'site')}</title>
<style>
  body { font-family: "Atkinson Hyperlegible", system-ui, sans-serif; color: #172033; background: #ffffff; line-height: 1.55; margin: 0; padding: 32px 16px; }
  main { max-width: 60rem; margin: 0 auto; }
  h1 { font-size: 28px; margin: 0 0 6px; }
  .meta, .url { color: #4a5568; font-size: 14px; margin: 0 0 18px; overflow-wrap: anywhere; }
  table { border-collapse: collapse; width: 100%; font-size: 15px; margin-bottom: 32px; }
  th, td { text-align: left; vertical-align: top; padding: 8px; border-bottom: 1px solid #d9dee7; }
  thead th { font-size: 13px; color: #4a5568; }
  .s { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 13px; }
  .s-C { background: #e4f3e9; color: #1d6b3a; } .s-NC { background: #fbe9e9; color: #a12d2d; }
  .s-NA { background: #eef1f5; color: #4a5568; } .s-NT { background: #fdf3dc; color: #7a4f00; }
  .fix { color: #4a5568; font-size: 14px; }
  ul { margin: 0; padding-left: 18px; }
</style>
</head>
<body>
<main>
<h1>Vérification manuelle guidée</h1>
<p class="meta">${esc(session.site || '')} · mise à jour le ${esc(new Date(session.modifieLe || Date.now()).toLocaleString('fr-FR'))} · RGAA 4.1.2 · RGAA Audit</p>
${pages || '<p>Aucune réponse enregistrée.</p>'}
<p class="meta">Les réponses « À confier à un professionnel » demandent une vérification avec un lecteur d’écran ou un audit approfondi.</p>
</main>
</body>
</html>`;
  }

  const api = {
    FORMAT, REPONSES, STATUS_LABELS,
    pageKey, buildPlan, createSession, recordElement, toggleFlag, recordPage, setNote,
    entryStatus, problems, validateSession, mergeSessions, synthesisHtml,
  };
  root.RgaaGuideCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
