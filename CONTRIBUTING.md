# 🤝 Contribuer à RGAA Audit

Merci de l'intérêt pour le projet ! Ce guide explique comment contribuer efficacement, que ce soit pour corriger un bug, ajouter une règle RGAA, améliorer la documentation ou proposer une nouvelle feature.

---

## Table des matières

- [Code de conduite](#code-de-conduite)
- [Comment contribuer](#comment-contribuer)
- [Structure du projet](#structure-du-projet)
- [Développement local](#développement-local)
- [Ajouter une règle RGAA](#ajouter-une-règle-rgaa)
- [Conventions de code](#conventions-de-code)
- [Soumettre une Pull Request](#soumettre-une-pull-request)
- [Signaler un bug](#signaler-un-bug)
- [Roadmap & priorités](#roadmap--priorités)

---

## Code de conduite

Ce projet est régi par le [Contributor Covenant](https://www.contributor-covenant.org/). En participant, vous vous engagez à maintenir un environnement respectueux et inclusif.

---

## Comment contribuer

### Types de contributions bienvenues

| Type | Exemples |
|------|----------|
| 🐛 **Bug fix** | Règle qui retourne un faux positif, crash sur certains sites |
| ✨ **Nouvelle règle** | Critère RGAA non encore couvert |
| 📊 **Reporter** | Nouveau format de sortie (SARIF, PDF, DEQAR…) |
| 📝 **Documentation** | Amélioration du README, guide d'utilisation, exemples |
| 🌍 **i18n** | Traduction des messages en anglais, espagnol… |
| ⚡ **Performance** | Réduction du temps d'audit |
| 🧪 **Tests** | Ajout de cas de test pour les règles existantes |

### Ce qu'on n'accepte pas (pour l'instant)

- Dépendances lourdes non justifiées
- Breaking changes sans discussion préalable en issue
- Code sans commentaires sur les parties complexes

---

## Structure du projet

```
rgaa-audit/
│
├── bin/
│   └── rgaa-audit.js          # Point d'entrée CLI
│
├── src/
│   ├── audit.js               # Orchestrateur
│   ├── browser.js             # Playwright wrapper
│   ├── simulator.js           # Simulation actions humaines
│   ├── logger.js              # Couleurs terminal
│   ├── rules/
│   │   └── index.js           # Toutes les règles DOM auto
│   ├── ai/
│   │   └── claude-analysis.js # Intégration Claude API
│   └── reporters/
│       └── index.js           # JSON / HTML / CSV
│
├── extension/                 # Extension Chrome
│   ├── manifest.json
│   ├── content.js             # Règles DOM (côté browser)
│   ├── background.js
│   └── panel/
│       ├── panel.html
│       └── panel.js
│
├── tests/
│   ├── fixtures/              # Pages HTML de test
│   └── rules/                 # Tests unitaires par règle
│
└── docs/
    ├── RGAA-mapping.md        # Critères → automatisable ou non
    └── API.md                 # Intégration programmatique
```

---

## Développement local

### Prérequis

- Node.js >= 18
- npm >= 9
- Git

### Installation

```bash
git clone https://github.com/ton-user/rgaa-audit.git
cd rgaa-audit/cli
npm install
npx playwright install chromium
```

### Lancer un audit de test

```bash
node bin/rgaa-audit.js https://example.com -o html -s test-output.html
```

### Lancer les tests

```bash
npm test
```

### Tester l'extension Chrome

1. Ouvrir `chrome://extensions/`
2. Activer **Mode développeur**
3. **Charger l'extension non empaquetée** → pointer `extension/`
4. Naviguer sur n'importe quel site et cliquer sur l'icône ♿

---

## Ajouter une règle RGAA

C'est la contribution la plus utile. Voici le processus exact.

### 1. Identifier le critère

Consulter [accessibilite.numerique.gouv.fr](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/) et vérifier dans `docs/RGAA-mapping.md` si le critère est déjà couvert.

### 2. Déterminer si c'est automatisable

| Automatisable | Exemples |
|---------------|----------|
| ✅ Oui | Attribut manquant, structure DOM vérifiable, calcul CSS |
| ⚠️ Partiel | Détecter la présence mais pas la pertinence |
| ❌ Non | Pertinence du contenu, qualité de l'alternative textuelle |

### 3. Écrire la règle dans `src/rules/index.js`

Chaque fonction d'audit suit ce pattern :

```javascript
function auditMonTheme() {
  const results = [];

  // Helper local
  const flag = (id, status, el, msg) => results.push({
    id,          // ex: '1.1'
    status,      // 'NC' | 'C' | 'NA'
    message: msg,
    snippet: el?.outerHTML?.slice(0, 150) || null,
    source: 'dom',
  });

  // Cas : aucun élément concerné → NA
  const els = document.querySelectorAll('mon-selecteur');
  if (!els.length) {
    flag('X.Y', 'NA', null, 'Aucun élément concerné');
    return results;
  }

  // Cas : vérification
  els.forEach(el => {
    if (!el.hasAttribute('mon-attribut')) {
      flag('X.Y', 'NC', el, 'Description du problème');
    } else {
      flag('X.Y', 'C', el, 'Description OK');
    }
  });

  return results;
}
```

**Important :** La fonction s'exécute dans le contexte `page.evaluate()` — pas d'imports, pas de require, uniquement du DOM natif.

### 4. L'ajouter à `runDomRules()`

```javascript
async function runDomRules(page) {
  // ... existant ...
  log('   Thème X — Mon thème…');
  const monTheme = await page.evaluate(auditMonTheme);
  // ...
  const all = [...existants, ...monTheme];
}
```

### 5. Porter la règle dans `extension/content.js`

Le `content.js` de l'extension contient les mêmes règles mais pour le contexte navigateur (sans Playwright). Ajouter la même logique dans la fonction correspondante.

### 6. Mettre à jour `docs/RGAA-mapping.md`

Marquer le critère comme couvert dans le tableau de mapping.

### 7. Ajouter un test

```javascript
// tests/rules/criterion-X-Y.test.js
const { test } = require('node:test');
const assert = require('node:assert');

// Page HTML minimale pour tester
const fixtureNC = `<html><body><img src="test.png"></body></html>`;
const fixtureC  = `<html><body><img src="test.png" alt="Description"></body></html>`;

// ... tester que fixtureNC → NC et fixtureC → C
```

---

## Conventions de code

### Style

- `'use strict'` en tête de chaque fichier
- `const` par défaut, `let` si mutation nécessaire, jamais `var`
- Fonctions nommées (pas de lambdas anonymes pour les fonctions principales)
- Commentaires en français (le projet cible la communauté francophone)

### Commits

Format : `type(scope): description courte`

| Type | Usage |
|------|-------|
| `feat` | Nouvelle fonctionnalité ou règle |
| `fix` | Correction de bug |
| `docs` | Documentation uniquement |
| `refactor` | Réécriture sans changement de comportement |
| `test` | Ajout ou correction de tests |
| `chore` | Maintenance (deps, CI…) |

Exemples :
```
feat(rules): ajouter critère 13.1 délai de session
fix(simulator): corriger détection focus sur Firefox
docs: mettre à jour le tableau RGAA-mapping
```

### Branches

```
main          → stable, protégée
dev           → branche d'intégration
feat/X-Y-nom  → nouvelle règle (ex: feat/9-3-listes)
fix/nom       → correction (ex: fix/contraste-faux-positif)
```

---

## Soumettre une Pull Request

1. **Forker** le repo et créer votre branche depuis `dev`
2. **Coder** la contribution en suivant les conventions
3. **Tester** : `npm test` doit passer
4. **Commit** avec le bon format
5. **Ouvrir une PR** vers `dev` avec :
   - Description de ce qui change
   - Critère(s) RGAA concerné(s)
   - Screenshot ou exemple de sortie si pertinent
   - `Fixes #XX` si ça ferme une issue

Les PRs sont reviewées sous 72h. Les mainteneurs peuvent demander des modifications avant merge.

---

## Signaler un bug

Ouvrir une [issue GitHub](https://github.com/ton-user/rgaa-audit/issues/new) avec :

```markdown
**Critère concerné** : X.Y
**URL testée** : https://...
**Comportement observé** : [NC alors que le critère est conforme / vice-versa]
**Comportement attendu** : ...
**Extrait HTML** :
```html
<votre code ici>
```
**Version** : 0.1.0
**OS / Node** : macOS 14 / Node 20
```

---

## Roadmap & priorités

Les contributions les plus attendues pour la v0.2 :

### Règles manquantes (priorité haute)
- [ ] **4.2** — Titre et/ou synopsis pour les médias temporels
- [ ] **7.2** — Scripts : compatibilité AT (nécessite test avec lecteur d'écran simulé)
- [ ] **10.2** — Contenu visible lors de la désactivation CSS
- [ ] **10.6** — Absence de texte justifié
- [ ] **13.1** — Délai de session avec avertissement
- [ ] **13.3** — Téléchargement de documents avec format accessible

### Infrastructure
- [ ] Crawler multi-pages (`--depth N`) avec déduplication
- [ ] Rapport SARIF (intégration GitHub Code Scanning)
- [ ] Export DEQAR (format officiel DINUM)
- [ ] Tests automatisés sur pages fixtures

### Extension Chrome
- [ ] Panel overlay directement dans la page (pas popup)
- [ ] Highlight visuel des éléments NC
- [ ] Mode "guided audit" pour les critères manuels

---

## Licence

En contribuant, vous acceptez que votre code soit distribué sous licence **MIT**.

---

*Questions ? Ouvrir une [Discussion GitHub](https://github.com/ton-user/rgaa-audit/discussions) ou contacter les mainteneurs.*
