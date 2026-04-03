// src/ai/claude-analysis.js
'use strict';

const { warn } = require('../logger');

async function analyzeWithClaude(apiKey, url, score, results) {
  const ncItems = results
    .filter(r => r.status === 'NC')
    .map(r => `- [${r.id}] ${r.message}`)
    .slice(0, 25)
    .join('\n');

  const prompt = `Tu es un expert RGAA 4.1 et accessibilité numérique.

Site audité : ${url}
Taux de conformité : ${score.taux}% (${score.conformes} conformes, ${score.nonConformes} non conformes)

Non-conformités détectées :
${ncItems || 'Aucune'}

Donne :
1. Une synthèse en 2 phrases
2. Les 3 priorités absolues à corriger (avec l'impact utilisateur pour chacune)
3. Une estimation du niveau d'effort global (faible/moyen/élevé)

Sois direct et pratique. Format : texte simple, pas de markdown.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    if (data.error) { warn('   Claude API :', data.error.message); return null; }
    return data.content?.find(b => b.type === 'text')?.text || null;
  } catch (e) {
    warn('   Claude API indisponible :', e.message);
    return null;
  }
}

module.exports = { analyzeWithClaude };
