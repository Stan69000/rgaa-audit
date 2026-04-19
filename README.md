# RGAA Audit

Pré-audit d'accessibilité RGAA 4.1 open-source (extension Chrome + CLI Playwright).

> ⚠️ Projet associatif vibe codé — Cet outil est développé bénévolement par Le Singe Du Numérique dans une démarche d'ouverture de l'accessibilité au plus grand nombre. Il s'agit d'un pré-audit automatique, non certifié, basé sur le RGAA 4.1. Les résultats peuvent comporter des erreurs et ne remplacent pas un audit réalisé par un professionnel certifié, ni un accompagnement spécialisé. Utilisez-le comme point de départ, pas comme conclusion.

## Objectif

RGAA Audit aide à repérer rapidement des non-conformités fréquentes sur une ou plusieurs pages web.
Il ne délivre pas une conformité légale: il prépare le terrain avant un audit humain complet.

## Ce que fait l'outil

- Extension Chrome: audit en contexte dans le navigateur
- CLI Playwright: audit automatisé, multi-pages, compatible CI/CD
- Rapports: JSON, HTML, CSV et rapport vulgarisé HTML
- Pré-remplissage de grille ODS RGAA à partir de plusieurs rapports

## Couverture RGAA (vue d'ensemble)

- 106 critères RGAA 4.1 pris en compte dans le référentiel
- Couverture actuelle:
  - `26.4%` automatisés
  - `14.2%` partiellement automatisés
  - `38.7%` manuels uniquement
  - `20.8%` automatisables mais pas encore implémentés

Détail par critère et par thème: [docs/RGAA-mapping.md](docs/RGAA-mapping.md)

## Installation CLI

```bash
git clone https://github.com/Stan69000/rgaa-audit
cd rgaa-audit/cli
npm install
npx playwright install chromium
```

### 1) Audit d'une home page avec rapport

```bash
node bin/rgaa-audit.js https://mon-site.fr \
  -o json \
  -s ./rapport-home.json \
  --vulgarized-save ./rapport-home-vulgarise.html
```

### 2) Audit de plusieurs pages

```bash
node bin/rgaa-audit.js https://mon-site.fr \
  --depth 8 \
  -o json \
  -s ./rapport-multipages.json \
  --vulgarized-save ./rapport-multipages-vulgarise.html
```

## Pré-remplir la grille ODS RGAA

```bash
node bin/rgaa-fill-grid.js \
  --report ./p01.json \
  --report ./p02.json \
  --report ./p03.json \
  --template "./rgaa4.1.2.modele-de-grille-d-audit.ods" \
  --output "./rgaa-grille-prefill.ods"
```

## Comparer deux rapports (CLI vs extension)

```bash
node bin/rgaa-compare-reports.js ./cli-report.json ./extension-report.json --json
```

## Options CLI utiles (production / CI)

- `--output-dir`: dossier racine de sortie (rapports, artefacts)
- `--dom-only`: exécute uniquement les règles DOM (sans simulation)
- `--safe-crawl`: crawl défensif (validation/filtrage renforcés)
- `--strict-security`: alias de `--safe-crawl`
- `--ods-template` + `--ods-save`: export direct vers grille ODS
- `--ods-replicate-all-sheets`: duplique le premier rapport sur `P01..P20`

## Artefacts générés

- Rapports: JSON / HTML / CSV / HTML vulgarisé
- Captures d'étapes d'audit: `audit-screenshots/`
- Grille RGAA pré-remplie: `rgaa-grille-prefill.ods` (ou chemin de sortie custom)

## Extension Chrome

1. Ouvrir `chrome://extensions/`
2. Activer le mode développeur
3. Charger le dossier `extension/`

## Transparence

- Pas de certification automatique
- Risque de faux positifs et faux négatifs
- Une partie importante du RGAA reste manuelle et contextuelle
- Les résultats doivent être revus par une personne formée

## Legal & Security

- Disclaimer: [DISCLAIMER.md](DISCLAIMER.md)
- Security policy: [SECURITY.md](SECURITY.md)
- Privacy policy: [PRIVACY.md](PRIVACY.md)

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md).

## Changelog

Historique des évolutions: [CHANGELOG.md](CHANGELOG.md)
Checklist de synchro docs/release: [docs/RELEASE-DOCS-CHECKLIST.md](docs/RELEASE-DOCS-CHECKLIST.md)

## Site du projet

Documentation publique: [https://stan69000.github.io/rgaa-audit/](https://stan69000.github.io/rgaa-audit/)
Guide critères vulgarisé: [https://stan69000.github.io/rgaa-audit/criteres.html](https://stan69000.github.io/rgaa-audit/criteres.html)
Politique de confidentialité (site): [https://stan69000.github.io/rgaa-audit/privacy.html](https://stan69000.github.io/rgaa-audit/privacy.html)

## Securite automatisee (CI/CD)

- Mises a jour dependances via `Dependabot` (`.github/dependabot.yml`)
- Auto-merge uniquement pour MAJ `patch`/`minor` Dependabot (workflow `Dependabot auto-merge (safe updates)`)
- Scans obligatoires: `npm audit`, `Dependency review`, `CodeQL`, `gitleaks`
- Monitoring periodique du site public (workflow `Site security monitoring`)
- Durcissement page statique via meta-politiques (`Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`)

### Rollback rapide en cas de probleme

Si une release casse le site public, lancer le workflow `Rollback GitHub Pages` et redeployer un `tag` ou un `commit SHA` stable.

### WAF (one-shot)

Pour un WAF complet avec tres peu d'interaction, placer le domaine derriere Cloudflare (ou equivalent) une seule fois, puis activer:

- Managed WAF rules
- Bot protection
- Rate limiting

## Licence

MIT
