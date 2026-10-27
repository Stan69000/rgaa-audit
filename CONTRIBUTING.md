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
├── engine/
│   ├── src/                       # ★ moteur de règles, un fichier par thème (à modifier ici)
│   └── build.js                   # assemble engine/src → extension/shared/rgaa-rules.js
│
├── extension/                     # Extension Chrome (Manifest V3)
│   ├── manifest.json              # permissions : activeTab + scripting uniquement
│   ├── background.js              # injecte le moteur dans l'onglet actif
│   ├── panel/                     # panneau (popup)
│   ├── shared/                    # code partagé avec la CLI
│   │   ├── rgaa-rules.js          # moteur assemblé (généré, ne pas modifier à la main)
│   │   ├── rgaa-criteria.js       # intitulés officiels RGAA 4.1.2 (généré)
│   │   └── vulgarized-report-template.js
│   └── tests/                     # tests du service worker
│
├── cli/
│   ├── bin/                       # rgaa-audit, rgaa-fill-grid
│   ├── src/
│   │   ├── audit.js               # orchestrateur (crawl, pages, score, rapports)
│   │   ├── rules/index.js         # exécute le moteur partagé dans Playwright
│   │   ├── simulator.js           # simulation clavier / survol / zoom / 320 px / espacement
│   │   ├── page-prep.js           # bandeau cookies, thème alternatif
│   │   ├── html-validation.js     # --validate-html (8.2)
│   │   ├── aggregate.js           # défauts de gabarit, --baseline
│   │   ├── captures.js            # captures annotées des non-conformités
│   │   ├── shared.js              # résolution de extension/shared (ou vendor/ dans le paquet npm)
│   │   └── reporters/             # JSON / CSV / HTML vulgarisé / grille ODS
│   ├── scripts/
│   │   ├── coverage.js            # ★ couverture déclarée, critère par critère
│   │   └── generate-docs.js       # régénère docs/RGAA-mapping.md et docs/criteres.html
│   └── tests/
│       ├── fixtures/engine/       # pages « pièges » par thème
│       └── *.test.js              # tests node:test exécutés dans Chromium
│
└── docs/                          # site GitHub Pages + mapping RGAA
```

---

## Développement local

### Prérequis

- Node.js >= 18
- npm >= 9
- Git

### Installation

```bash
git clone https://github.com/Stan69000/rgaa-audit.git
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

### 1. Identifier le critère

Lire le critère et ses tests sur [accessibilite.numerique.gouv.fr](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/), puis vérifier dans `docs/RGAA-mapping.md` ce qui est déjà couvert. Le numéro de critère doit correspondre au **test officiel** : par exemple un lien sans intitulé relève du 6.2, pas du 6.1.

### 2. Choisir le bon niveau de certitude

| Fonction | Statut | Quand l'utiliser |
|---|---|---|
| `out.error(...)` | `NC` | Le code prouve la non-conformité (attribut manquant, référence cassée, ratio mesuré). |
| `out.warn(...)` | `NT` | Indice qui dépend du contexte : peut être un faux positif. |
| `out.pass(...)` | `C` | Le contrôle automatique est passé. |
| `out.manual(...)` | `NT` | Rappel de vérification humaine, sans indice particulier. |
| `out.na(...)` | `NA` | Aucun élément concerné. |

En cas de doute, choisir `out.warn` : une fausse non-conformité coûte plus cher (perte de confiance) qu'un point à vérifier.

### 3. Écrire la règle dans `engine/src/`

Chaque thème a son fichier (`engine/src/26-theme-06-liens.js`…), les utilitaires communs sont dans `02-utilitaires-dom.js`, `03-nom-accessible.js` et `04-couleurs-et-contraste.js`. Les fragments partagent une même portée : pas d'`import`, les fonctions des autres fichiers sont directement disponibles. Après modification :

```bash
cd cli
npm run build:engine
```

Les règles sont regroupées par thème (`auditImages`, `auditLinks`…). Chaque constat passe par le collecteur `out`, qui regroupe les occurrences identiques :

```javascript
out.error({
  id: '6.2',                    // critère RGAA
  rule: 'link-name',            // identifiant stable de la règle
  element: link,                // élément fautif (sélecteur et extrait calculés automatiquement)
  message: 'Lien sans intitulé.',
  group: 'link-name',           // les constats de même groupe sont fusionnés avec un compteur
  rationale: 'Pourquoi c’est un problème pour les personnes.',
  remediationHint: 'Comment corriger.',
});
```

**Important :** le moteur s'exécute dans la page (et dans l'extension) : pas de `require`, uniquement du DOM natif. Utiliser les utilitaires existants : `isRendered`, `isHiddenFromAT`, `accessibleName`, `visibleText`, `composeColors`…

Aucun portage n'est nécessaire : la CLI et l'extension chargent le même fichier assemblé.

### 4. Ajouter un cas dans une fixture et un test

Ajouter dans `cli/tests/fixtures/engine/<thème>.html` un cas fautif **et** un cas conforme proche (le faux positif à éviter), puis l'assertion dans `cli/tests/engine.test.js` :

```javascript
assert.match(snippetsOf(report, { rule: 'link-name' }), /link-empty/);
assert.doesNotMatch(snippetsOf(report, { rule: 'link-name' }), /link-icon-sr/);
```

### Ajouter une fiche à la vérification guidée

Les questions manuelles sont dans `extension/shared/rgaa-guide-fiches.js`. Une fiche décrit une question en langage clair pour un critère : `mode` (`element`, `liste` ou `page`), la `collection` d'éléments à juger (fournie par `extension/shared/rgaa-guide-page.js`), l'aide visuelle éventuelle, le pourquoi, les étapes, des exemples et la correction. Écrire pour une personne qui n'a jamais lu le RGAA : phrases courtes, exemples concrets. Le test `cli/tests/guide-core.test.js` vérifie la structure de chaque fiche.

### 5. Mettre à jour la couverture

Déclarer le niveau du critère dans `cli/scripts/coverage.js`, puis :

```bash
npm run docs:coverage
```

Le test `coverage.test.js` échoue si la documentation ne correspond pas au code.

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
