# Changelog

Toutes les modifications notables sont documentées ici.
Format : [Semantic Versioning](https://semver.org/)

---

## [0.2.0] — 2026-04-03

### ✅ Corrections de faux positifs
- **Contraste (3.2)** : les éléments `display:none`, `visibility:hidden`, `opacity:0` et de dimensions nulles sont désormais ignorés — corrige le faux positif `#000000/#000000` sur des éléments masqués
- **Contraste (3.2)** : remontée dans le DOM pour trouver le vrai fond quand `background-color` est transparent
- **SVG (1.1)** : les SVG dans des boutons ou liens déjà étiquetés (`aria-label`, `innerText`) ne génèrent plus de NC
- **Liens (6.1)** : un lien avec `aria-label` explicite n'est plus flaggué comme générique même si son texte est court
- **Tableaux (5.1)** : les tableaux avec `role="presentation"` ou `role="none"` sont correctement exclus

### ✨ Nouveaux critères automatisés
- **8.7** — Changements de langue inline : détecte les attributs `lang` invalides sur des éléments inline
- **8.9** — Balises de présentation : signale l'usage de `<b>`, `<i>`, `<u>` à des fins purement visuelles
- **10.6** — Texte justifié : détecte `text-align: justify` (problématique pour les dyslexiques)
- **11.5** — Groupement de champs : vérifie la présence de `<fieldset>` + `<legend>` sur les groupes de radio/checkbox
- **11.13** — Autocomplete : signale les champs personnels (email, nom, téléphone…) sans attribut `autocomplete`
- **13.2** — Liens nouvelle fenêtre : détecte les `target="_blank"` sans avertissement utilisateur
- **13.3** — Documents téléchargeables : signale les liens `.pdf`, `.docx`, etc. sans indication du format ou du poids
- **4.10** — Autoplay vidéo : détecte les vidéos `autoplay` sans `muted`

### 🚀 Support SPA
- Nouveau module `loadPage()` dans `browser.js` avec attente de stabilisation du DOM via `MutationObserver`
- Fallback automatique sur `domcontentloaded` si `networkidle` timeout (pages avec polling)
- Scroll automatique pour déclencher le lazy-loading avant l'audit
- Options `--wait-for` et `--extra-wait` dans le CLI

### 🧪 Tests
- 65 tests unitaires (41 → 65, +24)
- Couverture des 7 nouveaux critères
- Tests des corrections de faux positifs

---

## [0.1.0] — 2026-04-03

### 🎉 Version initiale
- Extension Chrome (Manifest V3) avec panel d'audit
- CLI Playwright avec simulation d'actions humaines
- 8 thèmes RGAA couverts automatiquement (~40% du référentiel)
- Rapport HTML/JSON/CSV
- Analyse IA opt-in via Claude API
- CI/CD GitHub Actions
- 41 tests unitaires
