# ♿ RGAA Audit — Outil d'audit d'accessibilité open-source

> Audit automatisé et assisté RGAA 4.1, avec simulation d'actions humaines et rapport vulgarisé actionnable.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![RGAA 4.1](https://img.shields.io/badge/RGAA-4.1-blue.svg)](https://accessibilite.numerique.gouv.fr/)
[![Status: Alpha](https://img.shields.io/badge/Status-Alpha-orange.svg)]()

---

## 🎯 Vision

Un outil **libre, modulaire et composable** pour auditer la conformité RGAA 4.1 de tout site web :
- **Extension Chrome** : audit en contexte, overlay sur la page, sans installation lourde
- **CLI Playwright** : simulation d'actions humaines, audit multi-pages, CI/CD friendly
- **Rapport vulgarisé** : restitution non technique, priorisée et orientée actions
- **API REST** (roadmap) : intégration dans vos pipelines qualité

---

## 🏗️ Architecture

```
rgaa-audit/
├── extension/                    # Extension Chrome (Manifest V3)
│   ├── manifest.json
│   ├── background.js             # Service worker
│   ├── content.js                # Injection dans la page + audit DOM
│   ├── panel/
│   │   ├── panel.html            # UI overlay
│   │   ├── panel.css
│   │   └── panel.js
│   └── icons/
│
├── cli/                          # Outil en ligne de commande
│   ├── package.json
│   ├── bin/
│   │   ├── rgaa-audit.js         # Point d'entrée CLI
│   │   └── rgaa-fill-grid.js     # Pré-remplissage grille ODS RGAA
│   ├── src/
│   │   ├── audit.js              # Orchestrateur principal
│   │   ├── browser.js            # Pilote Playwright
│   │   ├── simulator.js          # Simulation actions humaines
│   │   ├── rules/                # Règles RGAA par thème
│   │   │   ├── 01-images.js
│   │   │   ├── 02-frames.js
│   │   │   ├── 03-colors.js
│   │   │   ├── 04-multimedia.js
│   │   │   ├── 05-tables.js
│   │   │   ├── 06-links.js
│   │   │   ├── 07-scripts.js
│   │   │   ├── 08-mandatory.js
│   │   │   ├── 09-structure.js
│   │   │   ├── 10-presentation.js
│   │   │   ├── 11-forms.js
│   │   │   ├── 12-navigation.js
│   │   │   └── 13-consultation.js
│   │   ├── reporters/
│   │   │   ├── index.js          # JSON / HTML / CSV / vulgarized
│   │   │   └── ods-grid.js       # Mapping audit -> grille ODS
│
├── shared/
│   ├── rgaa-criteria.js          # Définition complète des 106 critères
│   ├── scoring.js                # Calcul taux de conformité
│   └── constants.js
│
├── web/                          # Interface web (React)
│   ├── src/
│   │   ├── App.jsx               # Application principale
│   │   ├── components/
│   │   └── hooks/
│   └── package.json
│
└── docs/
    ├── CONTRIBUTING.md
    ├── RGAA-mapping.md           # Mapping critères → règles automatiques
    └── API.md
```

---

## 🚀 Installation (CLI)

```bash
git clone https://github.com/Stan69000/rgaa-audit
cd rgaa-audit/cli
npm install
npx playwright install chromium

# Audit simple
node bin/rgaa-audit.js https://mon-site.fr

# Audit avec rapport HTML
node bin/rgaa-audit.js https://mon-site.fr --output html --save ./rapport.html

# Audit + JSON + rapport vulgarisé (actionnable, non technique)
node bin/rgaa-audit.js https://mon-site.fr -o json -s ./rapport.json --vulgarized-save ./rapport-vulgarise.html

# Audit multi-pages (crawler)
node bin/rgaa-audit.js https://mon-site.fr --depth 3
```

Le rapport vulgarisé HTML inclut:
- Une lecture simple (niveau, priorités P1/P2/P3, effort)
- Les leviers actionnables avec indication de zones à corriger
- Deux actions de sortie directes: **Télécharger HTML** et **Exporter PDF**

---

## 📄 Pré-remplir la grille ODS RGAA (P01..Pn)

Après avoir audité plusieurs pages (`p01.json`, `p02.json`, etc.), vous pouvez pré-remplir la grille officielle:

```bash
node bin/rgaa-fill-grid.js \
  --report ./p01.json \
  --report ./p02.json \
  --report ./p03.json \
  --template "/chemin/rgaa4.1.2.modele-de-grille-d-audit.ods" \
  --output "./rgaa-grille-prefill.ods"
```

Note zsh: pour construire dynamiquement plusieurs `--report`, utilisez un tableau (`REPORT_ARGS=(...)`) puis `"\${REPORT_ARGS[@]}"`.

---

## 🔌 Extension Chrome

1. Ouvrir `chrome://extensions/`
2. Activer le mode développeur
3. Charger le dossier `extension/`
4. Naviguer sur n'importe quel site → icône RGAA dans la barre d'outils

Sécurité et confidentialité :
- Les résultats d'audit restent locaux par défaut (analyse DOM + export JSON).
- Aucun envoi externe n'est réalisé par l'outil pendant l'audit standard.

---

## 🤖 Simulation d'actions humaines (Playwright)

Le simulateur reproduit le comportement d'un auditeur humain :

```javascript
// cli/src/simulator.js
const actions = [
  { type: 'navigate', url },
  { type: 'keyboard', keys: ['Tab', 'Tab', 'Tab'] },   // Navigation clavier
  { type: 'screenshot', name: 'focus-state' },
  { type: 'zoom', level: 200 },                          // Test agrandissement
  { type: 'disable-css' },                               // Test sans styles
  { type: 'screen-reader-simulation' },                  // Ordre de lecture
  { type: 'form-interact' },                             // Test formulaires
  { type: 'keyboard', keys: ['Escape'] },
];
```

---

## 📊 Critères couverts (RGAA 4.1)

| Thème | Auto | Manuel | Total |
|-------|------|--------|-------|
| 1. Images | ✅ | ✅ | 13 |
| 2. Cadres | ✅ | ✅ | 2 |
| 3. Couleurs | ✅ | ✅ | 3 |
| 4. Multimédia | ❌ | ✅ | 6 |
| 5. Tableaux | ✅ | ✅ | 7 |
| 6. Liens | ✅ | ✅ | 2 |
| 7. Scripts | ❌ | ✅ | 5 |
| 8. Éléments obligatoires | ✅ | ✅ | 5 |
| 9. Structure | ✅ | ✅ | 8 |
| 10. Présentation | ❌ | ✅ | 12 |
| 11. Formulaires | ✅ | ✅ | 11 |
| 12. Navigation | ✅ | ✅ | 9 |
| 13. Consultation | ❌ | ✅ | 5 |
| **TOTAL** | **~40%** | **100%** | **106** |

---

## 🔑 Variables d'environnement

```bash
RGAA_AUDIT_PORT=3000            # Port de l'interface web (optionnel)
```

---

## 🤝 Contribuer

Voir [CONTRIBUTING.md](docs/CONTRIBUTING.md).

Les contributions prioritaires :
- [ ] Implémenter les règles automatiques manquantes (thèmes 4, 7, 10, 13)
- [ ] Améliorer le simulateur de navigation clavier
- [ ] Ajouter le support du rapport DEQAR
- [ ] Internationalisation (EN, ES, DE)

---

## 📄 Licence

MIT — Libre d'utilisation, de modification et de distribution.

---

*Projet initié en 2026 · Construit avec Playwright, React*
