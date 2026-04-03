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

function formatAiInline(text) {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function isTableSeparatorLine(line) {
  return /^\s*\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(line);
}

function tableCells(line) {
  const raw = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return raw.split('|').map(cell => formatAiInline(cell.trim()));
}

function renderAiMarkdown(markdown) {
  const src = escHtml(markdown || '').replace(/\r\n/g, '\n');
  const lines = src.split('\n');
  const html = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) { html.push('</ul>'); inUl = false; }
    if (inOl) { html.push('</ol>'); inOl = false; }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      closeLists();
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && isTableSeparatorLine(lines[i + 1])) {
      closeLists();
      const headers = tableCells(line);
      i += 1; // skip separator row
      const rows = [];
      while (i + 1 < lines.length && lines[i + 1].includes('|')) {
        i += 1;
        rows.push(tableCells(lines[i]));
      }

      html.push('<table class="ai-table"><thead><tr>');
      headers.forEach(h => html.push(`<th>${h}</th>`));
      html.push('</tr></thead><tbody>');
      rows.forEach(row => {
        html.push('<tr>');
        row.forEach(cell => html.push(`<td>${cell}</td>`));
        html.push('</tr>');
      });
      html.push('</tbody></table>');
      continue;
    }

    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      closeLists();
      html.push(`<h3>${formatAiInline(h3[1])}</h3>`);
      continue;
    }

    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      closeLists();
      html.push(`<h2>${formatAiInline(h2[1])}</h2>`);
      continue;
    }

    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      closeLists();
      html.push(`<h1>${formatAiInline(h1[1])}</h1>`);
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      if (inUl) { html.push('</ul>'); inUl = false; }
      if (!inOl) { html.push('<ol>'); inOl = true; }
      html.push(`<li>${formatAiInline(ol[1])}</li>`);
      continue;
    }

    const ul = line.match(/^[*-]\s+(.+)$/);
    if (ul) {
      if (inOl) { html.push('</ol>'); inOl = false; }
      if (!inUl) { html.push('<ul>'); inUl = true; }
      html.push(`<li>${formatAiInline(ul[1])}</li>`);
      continue;
    }

    closeLists();
    html.push(`<p>${formatAiInline(line)}</p>`);
  }

  closeLists();
  return html.join('');
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
// L'appel API passe via le background pour éviter les limites CORS du popup.

document.getElementById('btnAI').addEventListener('click', async () => {
  if (!currentReport) return;

  const consent = await getFlag('aiNetworkConsent');
  if (!consent) {
    const ok = confirm('L’analyse IA envoie un extrait des résultats d’audit vers Anthropic. Continuer ?');
    if (!ok) return;
    await setFlag('aiNetworkConsent', true);
  }

  let apiKey = await getApiKey();
  if (!apiKey) {
    const key = prompt('Entrez votre clé API Anthropic :');
    if (!key || !key.startsWith('sk-ant-')) {
      return;
    }
    const remember = confirm('Mémoriser la clé sur cet appareil ?\nOK = persistant local, Annuler = session courante uniquement');
    await setApiKey(key, remember);
    apiKey = key;
  }

  const btnAI = document.getElementById('btnAI');
  btnAI.disabled = true;
  btnAI.textContent = '⏳…';

  const aiPanel = document.getElementById('aiPanel');
  const aiText = document.getElementById('aiText');
  aiPanel.classList.add('visible');
  aiText.textContent = 'Connexion à Claude…';

  const ncList = currentReport.results
    .filter(r => r.status === 'NC')
    .map(r => `${r.id}: ${r.message}`)
    .slice(0, 20)
    .join('\n');

  const promptText = `Tu es auditeur RGAA 4.1 senior. Réponds en français, factuel, sans marketing.
Site audité : ${currentReport.url}
Taux : ${currentReport.score.taux}% (NC:${currentReport.score.nonConformes}, C:${currentReport.score.conformes}, NA:${currentReport.score.na})
NC détectées :\n${ncList || 'Aucune'}\n
Format de réponse obligatoire :
1) Synthèse (2 phrases max)
2) Top 3 priorités (P1/P2/P3) avec : critère RGAA, correction concrète, impact utilisateur
3) Vérifications manuelles à faire (max 3)
4) Risque de faux positifs/faux négatifs (1 phrase)

Si aucune NC : ne pas féliciter. Donne 3 contrôles de robustesse à exécuter avant mise en prod.`;

  chrome.runtime.sendMessage(
    { action: 'callClaude', apiKey, prompt: promptText },
    response => {
      if (chrome.runtime.lastError) {
        aiText.textContent = `Erreur extension : ${chrome.runtime.lastError.message}`;
      } else if (response?.error) {
        aiText.textContent = `Erreur API : ${response.error}`;
      } else if (response?.text) {
        aiText.innerHTML = renderAiMarkdown(response.text);
      } else {
        aiText.textContent = 'Réponse inattendue du service IA.';
      }

      btnAI.disabled = false;
      btnAI.textContent = '✨ Analyse IA';
    }
  );
});

function getApiKey() {
  const sessionStore = chrome.storage.session;
  if (sessionStore && typeof sessionStore.get === 'function') {
    return new Promise(resolve => {
      sessionStore.get('anthropicKey', data => {
        if (data?.anthropicKey) {
          resolve(data.anthropicKey);
          return;
        }
        chrome.storage.local.get('anthropicKey', fallback => resolve(fallback.anthropicKey || null));
      });
    });
  }

  return new Promise(resolve => {
    chrome.storage.local.get('anthropicKey', data => resolve(data.anthropicKey || null));
  });
}

function setApiKey(key, persistLocally) {
  if (persistLocally) {
    return chrome.storage.local.set({ anthropicKey: key });
  }

  const sessionStore = chrome.storage.session;
  if (sessionStore && typeof sessionStore.set === 'function') {
    return sessionStore.set({ anthropicKey: key });
  }

  return Promise.resolve();
}

function getFlag(name) {
  return new Promise(resolve => {
    chrome.storage.local.get(name, data => resolve(Boolean(data[name])));
  });
}

function setFlag(name, value) {
  return chrome.storage.local.set({ [name]: Boolean(value) });
}
