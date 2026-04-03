// panel.js — Logique du popup RGAA Audit

let currentReport = null;
let currentFilter = 'all';

const btnAudit = document.getElementById('btnAudit');
const resultsEl = document.getElementById('results');
const scoreBar = document.getElementById('scoreBar');
const filters = document.getElementById('filters');
const footer = document.getElementById('footer');
const urlDisplay = document.getElementById('urlDisplay');
const scoreExplain = document.getElementById('scoreExplain');

// ── LANCEMENT AUDIT ──────────────────────────

btnAudit.addEventListener('click', () => {
  btnAudit.disabled = true;
  btnAudit.textContent = '⏳ Analyse en cours…';
  resultsEl.innerHTML = '<div style="text-align:center;padding:32px;color:#445;font-family:\'DM Mono\',monospace;font-size:12px;">Scan en cours…</div>';

  chrome.runtime.sendMessage({ action: 'getAuditResults' }, response => {
    btnAudit.disabled = false;
    btnAudit.textContent = '↻ Relancer l\'audit';

    if (!response || !response.success) {
      renderError(response?.error);
      return;
    }

    currentReport = response.report;
    renderScore(currentReport.score);
    renderResults(currentReport.results, currentFilter);
    urlDisplay.textContent = currentReport.url;
    scoreBar.style.display = 'flex';
    scoreExplain.style.display = 'block';
    filters.style.display = 'flex';
    footer.style.display = 'flex';
  });
});

// ── SCORE ────────────────────────────────────

function renderScore(score) {
  const circ = 2 * Math.PI * 22; // r=22
  const offset = circ - (score.taux / 100) * circ;
  const color = score.taux >= 75 ? '#00C896' : score.taux >= 50 ? '#FFB800' : '#FF4444';

  document.getElementById('scoreCircle').style.strokeDashoffset = offset;
  document.getElementById('scoreCircle').style.stroke = color;
  document.getElementById('scoreValue').textContent = score.taux + '%';
  document.getElementById('scoreValue').style.color = color;

  document.getElementById('statNC').textContent = score.nonConformes;
  document.getElementById('statC').textContent = score.conformes;
  document.getElementById('statNA').textContent = score.na;
  document.getElementById('statTotal').textContent = score.total;
  scoreExplain.textContent = `Conformité: ${score.taux}% · Critères non conformes: ${score.nonConformes} · Critères conformes: ${score.conformes} · Critères non applicables: ${score.na}`;
}

// ── RÉSULTATS ────────────────────────────────

function renderResults(results, filter) {
  const filtered = filter === 'all' ? results : results.filter(r => r.status === filter);

  if (!filtered.length) {
    resultsEl.innerHTML = `<div style="text-align:center;padding:24px;color:#445;font-size:12px;">Aucun résultat pour ce filtre.</div>`;
    return;
  }

  // Dédoublonner par critère + message
  const seen = new Set();
  const deduped = filtered.filter(r => {
    const key = `${r.id}-${r.status}-${r.message.slice(0, 40)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  resultsEl.innerHTML = deduped.map(r => `
    <div class="result-item" title="${r.xpath || ''}">
      <span class="result-id">${r.id}</span>
      <span class="result-badge badge-${r.status}">${r.status}</span>
      <div class="result-text">
        ${escHtml(r.message)}
        ${r.snippet ? `<div class="result-snippet">${escHtml(r.snippet)}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderError(message) {
  resultsEl.innerHTML = '';
  const container = document.createElement('div');
  container.style.color = '#FF4444';
  container.style.padding = '16px';
  container.style.fontSize = '12px';
  container.textContent = `Erreur : ${message || 'Impossible de communiquer avec la page.'}`;
  resultsEl.appendChild(container);
}

// ── FILTRES ──────────────────────────────────

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    if (currentReport) renderResults(currentReport.results, currentFilter);
  });
});

// ── EXPORT JSON ──────────────────────────────

document.getElementById('btnExport').addEventListener('click', () => {
  if (!currentReport) return;
  const blob = new Blob([JSON.stringify(currentReport, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rgaa-audit-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btnExportHtml').addEventListener('click', () => {
  if (!currentReport) return;
  const html = buildVulgarizedHtml(currentReport);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rapport-vulgarise-${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

function buildVulgarizedHtml(report) {
  const shared = window.RgaaSharedReport;
  if (!shared || typeof shared.generateVulgarizedReport !== "function") {
    throw new Error("Template partagé indisponible.");
  }
  return shared.generateVulgarizedReport(report, { includeCliLink: true });
}
