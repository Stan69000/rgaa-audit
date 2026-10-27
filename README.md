# RGAA Audit

Pré-audit d'accessibilité RGAA 4.1.2 open-source (extension Chrome + CLI Playwright).

> Pré-audit automatique selon le RGAA 4.1.2, développé par l'association Le Singe Du Numérique : un point de départ pour prioriser les corrections. La conformité se confirme ensuite par un audit humain (voir [DISCLAIMER.md](DISCLAIMER.md)).

## Objectif

RGAA Audit aide à repérer rapidement des non-conformités fréquentes sur une ou plusieurs pages web.
Il ne délivre pas une conformité légale: il prépare le terrain avant un audit humain complet.

## Ce que fait l'outil

- **Un seul moteur de règles** (`extension/shared/rgaa-rules.js`) partagé par l'extension et la CLI : les deux outils appliquent exactement les mêmes contrôles.
- **Extension Chrome** : audit de la page affichée, résultats classés par critère avec l'intitulé officiel, bouton « Voir » pour repérer l'élément dans la page.
- **CLI Playwright** : audit multi-pages compatible CI/CD, plus une **simulation d'usage** : parcours clavier (focus visible, contraste de l'indicateur, piège clavier), contraste au survol et au focus, lien d'évitement, zoom 200 %, affichage à 320 px, espacement du texte, page sans CSS, thème sombre et thème alternatif du site.
- **Rapports** : JSON, CSV, HTML vulgarisé avec toutes les non-conformités et des captures annotées, pré-remplissage de la grille ODS officielle, comparaison avec un audit précédent.

## Lire les résultats

Chaque constat porte un statut :

| Statut | Signification |
|---|---|
| `NC` | Non-conformité probable, détectée de façon fiable. |
| `NT` | **À vérifier** : indice heuristique ou contrôle manuel requis. Peut être un faux positif. |
| `C` | Conforme sur l'échantillon testé. |
| `NA` | Non applicable (aucun élément concerné). |

Le **score** ne compte que les critères tranchés automatiquement : `C / (C + NC)`. Les critères « à vérifier » n'y entrent pas : un indice heuristique ne fait jamais baisser le score. Ce n'est pas un taux de conformité RGAA.

Les constats identiques sont regroupés (« 12 liens sans intitulé ») avec jusqu'à 5 exemples (sélecteur CSS et extrait HTML).

## Couverture RGAA

Sur les 106 critères du RGAA 4.1.2 : **28 automatisés**, **20 partiels** (indices à vérifier), **58 manuels**.
Détail critère par critère, avec ce qui est réellement contrôlé : [docs/RGAA-mapping.md](docs/RGAA-mapping.md).
Ce tableau est généré depuis `cli/scripts/coverage.js`, et un test vérifie qu'il correspond au code.

Points notables du moteur :

- **Contraste (3.2)** : couleur réellement rendue sous le texte (éléments superposés, transparences, groupes d'opacité, notations `color(srgb …)`, `oklch`…), seuils RGAA 24 px / 18,5 px gras. Texte sur image ou dégradé : « à vérifier », jamais une fausse non-conformité.
- **ARIA (7.1)** : liste complète des rôles ARIA 1.2 (+ DPUB, graphiques), contexte et contenu requis (`tab` dans `tablist`…), états obligatoires, attributs inconnus ou mal orthographiés, références d'id cassées.
- **Focus visible (10.7, CLI)** : comparaison d'images avec et sans focus pour chaque élément du parcours clavier. Repère aussi un contour rogné par un conteneur `overflow:hidden`, ce qu'une lecture des styles CSS ne voit pas.
- **Nom accessible** : calcul inspiré d'accname 1.2 ; contrôle « intitulé visible contenu dans le nom » (6.1.5, 11.2.5, 11.9.2).

## Installation CLI

```bash
git clone https://github.com/Stan69000/rgaa-audit
cd rgaa-audit/cli
npm install
npx playwright install chromium
```

### 1) Audit d'une page avec rapport

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

### 3) Suivre les régressions en CI

```bash
node bin/rgaa-audit.js https://mon-site.fr -d 8 -o json -s ./rapport.json \
  --baseline ./rapport-precedent.json --fail-on-new
```

Le rapport liste les non-conformités nouvelles et résolues par page (`baseline` dans le JSON). Avec `--fail-on-new`, le code de sortie vaut 1 s'il en apparaît de nouvelles : la CI échoue sur une régression, pas sur la dette existante.

### 4) Site avec bandeau cookies et thème clair/sombre maison

```bash
node bin/rgaa-audit.js https://mon-site.fr \
  --dismiss auto \
  --theme-click "button.theme-toggle"
```

Le bandeau de consentement est fermé en cliquant « Refuser » (détection automatique, ou `--dismiss "<sélecteur>"`). `--theme-click` (ou `--theme-script`) mesure aussi les contrastes dans le thème alternatif du site, puis le rétablit.

## Pré-remplir la grille ODS RGAA

```bash
node bin/rgaa-fill-grid.js \
  --report ./p01.json \
  --report ./p02.json \
  --report ./p03.json \
  --template "./rgaa4.1.2.modele-de-grille-d-audit.ods" \
  --output "./rgaa-grille-prefill.ods"
```

Les critères « à vérifier » sont reportés en `NT`, avec les indices détectés dans la colonne des modifications à apporter.

## Options CLI utiles (production / CI)

- `--output-dir` : dossier racine de sortie (rapports, captures)
- `--no-simulate` : audit DOM seul, sans simulation (plus rapide)
- `--color-scheme auto|light|both` : `auto` (défaut) mesure aussi les contrastes en thème sombre si la page réagit à `prefers-color-scheme` ; `both` force la double mesure
- `--dismiss auto|off|<sélecteur>` : fermeture du bandeau cookies avant les mesures (défaut `auto`, refus préféré)
- `--theme-click <sélecteur>` / `--theme-script <js>` : mesure des contrastes dans le thème alternatif piloté par le site
- `--validate-html` : validation du code source généré (8.2) avec html-validate, en local (Node.js 22.22+)
- `--baseline <rapport.json>` + `--fail-on-new` : comparaison avec un audit précédent, échec sur les nouvelles non-conformités
- `--no-captures` : pas de captures annotées des non-conformités
- `--safe-crawl` : crawl défensif (validation/filtrage renforcés)
- `--strict-security` : alias de `--safe-crawl`
- `--ods-template` + `--ods-save` : export direct vers grille ODS
- `--ods-replicate-all-sheets` : duplique le premier rapport sur `P01..P20`

## Artefacts générés

- Rapports : JSON / HTML vulgarisé / CSV (cellules protégées contre l'injection de formules)
- Captures de la simulation : `audit-screenshots/` (focus invisible, zoom 200 %, 320 px, sans CSS)
- Captures annotées des non-conformités : `audit-screenshots/non-conformites/`, reprises dans le rapport HTML
- Rapport multi-pages : `templateIssues` regroupe les non-conformités communes à plusieurs pages (défauts de gabarit)
- Grille RGAA pré-remplie : `rgaa-grille-prefill.ods` (ou chemin de sortie choisi)

## Tests

```bash
cd cli
npm test
```

Le moteur se modifie dans `engine/src/` (un fichier par thème), puis s'assemble avec `npm run build:engine` ; un test vérifie que `extension/shared/rgaa-rules.js` est à jour.

Les règles sont testées dans un vrai Chromium sur des fixtures « pièges » (`cli/tests/fixtures/engine/`) : navigation fixe transparente, voiles translucides, groupes d'opacité, rôles ARIA valides mais méconnus, focus rogné, piège clavier… Chaque faux positif corrigé doit y gagner un cas. L'extension est aussi testée chargée dans Chromium (`extension-e2e.test.js`).

## Extension Chrome

L'extension est publiée sur le [Chrome Web Store](https://chromewebstore.google.com/detail/rgaa-audit/aiaiblaemmjcfeeobpjagdajbgbcabai).
Permissions limitées à `activeTab` et `scripting` : l'audit s'exécute dans la page courante, rien n'est envoyé.

Pour publier une nouvelle version : incrémenter `version` dans `extension/manifest.json`, puis

```bash
cd cli
npm run package:extension
```

et téléverser l'archive `rgaa-audit-extension-<version>.zip` dans le tableau de bord développeur Chrome Web Store.

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
