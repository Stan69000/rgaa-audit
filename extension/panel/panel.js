// panel.js — Logique du popup RGAA Audit

let currentReport = null;
let currentFilter = 'all';

const btnAudit = document.getElementById('btnAudit');
const resultsEl = document.getElementById('results');
const scoreBar = document.getElementById('scoreBar');
const filters = document.getElementById('filters');
const footer = document.getElementById('footer');
const urlDisplay = document.getElementById('urlDisplay');

// ── LANCEMENT AUDIT ──────────────────────────

btnAudit.addEventListener('click', () => {
  btnAudit.disabled = true;
  btnAudit.textContent = '⏳ Analyse en cours…';
  resultsEl.innerHTML = '<div style="text-align:center;padding:32px;color:#445;font-family:\'DM Mono\',monospace;font-size:12px;">Scan DOM en cours…</div>';

  chrome.runtime.sendMessage({ action: 'getAuditResults' }, response => {
    btnAudit.disabled = false;
    btnAudit.textContent = '↻ Relancer l\'audit';

    if (!response || !response.success) {
      resultsEl.innerHTML = `<div style="color:#FF4444;padding:16px;font-size:12px;">Erreur : ${response?.error || 'Impossible de communiquer avec la page.'}</div>`;
      return;
    }

    currentReport = response.report;
    renderScore(currentReport.score);
    renderResults(currentReport.results, currentFilter);
    urlDisplay.textContent = currentReport.url;
    scoreBar.style.display = 'flex';
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

// ── ANALYSE IA ───────────────────────────────

document.getElementById('btnAI').addEventListener('click', async () => {
  if (!currentReport) return;

  const apiKey = await getApiKey();
  if (!apiKey) {
    const key = prompt('Entrez votre clé API Anthropic (stockée localement uniquement) :');
    if (!key) return;
    chrome.storage.local.set({ anthropicKey: key });
  }

  const btnAI = document.getElementById('btnAI');
  btnAI.disabled = true;
  btnAI.textContent = '⏳…';

  const aiPanel = document.getElementById('aiPanel');
  const aiText = document.getElementById('aiText');
  aiPanel.classList.add('visible');
  aiText.textContent = 'Connexion à Claude…';

  const key = apiKey || (await getApiKey());
  const ncList = currentReport.results
    .filter(r => r.status === 'NC')
    .map(r => `${r.id}: ${r.message}`)
    .slice(0, 20)
    .join('\n');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `Expert RGAA 4.1. Site audité : ${currentReport.url}. Taux : ${currentReport.score.taux}%.
Non-conformités détectées :\n${ncList || 'Aucune'}\n
En 3-4 phrases : synthèse, 2-3 priorités absolues à corriger, impact utilisateur principal. Sois direct.`
        }]
      })
    });

    const data = await res.json();
    const text = data.content?.find(b => b.type === 'text')?.text;
    aiText.textContent = text || 'Réponse vide.';
  } catch (e) {
    aiText.textContent = `Erreur API : ${e.message}`;
  }

  btnAI.disabled = false;
  btnAI.textContent = '✨ Analyse IA';
});

function getApiKey() {
  return new Promise(resolve => {
    chrome.storage.local.get('anthropicKey', data => resolve(data.anthropicKey || null));
  });
}
