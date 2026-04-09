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
  - `~26%` automatisés
  - `~17%` partiellement automatisés
  - `~36%` manuels uniquement
  - `~21%` automatisables mais pas encore implémentés

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

## Site du projet

Documentation publique: [https://stan69000.github.io/rgaa-audit/](https://stan69000.github.io/rgaa-audit/)
Guide critères vulgarisé: [https://stan69000.github.io/rgaa-audit/criteres.html](https://stan69000.github.io/rgaa-audit/criteres.html)

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
