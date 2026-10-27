# Changelog

Toutes les évolutions notables du projet sont documentées ici.

## 0.3.0 — 2026-10-26

Refonte de la fiabilité des règles. Les résultats changent : moins de faux positifs, des défauts auparavant manqués, et des numéros de critères corrigés.

### Moteur unique

- Sources du moteur dans `engine/src/` (un fichier par thème), assemblées sans dépendance par `engine/build.js`.
- Nouveau moteur `extension/shared/rgaa-rules.js`, partagé par l'extension et la CLI (l'ancien `extension/content.js` et les règles dupliquées de `cli/src/rules/` sont supprimés). Les deux outils donnent désormais les mêmes résultats.
- Intitulés officiels des 106 critères RGAA 4.1.2 (`extension/shared/rgaa-criteria.js`, source DINUM, Licence Ouverte).
- Constats identiques regroupés avec compteur et jusqu'à 5 exemples (sélecteur CSS + extrait).

### Nouveau statut « à vérifier » (NT) et score

- Les signaux heuristiques passent de `NC` à `NT` (« à vérifier ») : ils n'entrent plus dans le score et sont reportés en `NT` dans la grille ODS, avec les indices en note.
- Score = critères `C / (C + NC)`. Statut d'un critère : NC > NT > C > NA.

### Corrections de faux positifs

- **Contraste (3.2)** : un fond transparent était lu comme du noir (`rgba(0,0,0,0)` → `#000000`), d'où des dizaines de faux positifs sur les navigations fixes transparentes. Le fond est maintenant composé à partir de ce qui est réellement sous le texte (éléments superposés, transparences, groupes d'opacité), et les notations `color(srgb …)`, `oklch`, etc. sont gérées. Texte sur image ou dégradé : « à vérifier ».
- **Seuils de contraste** : les seuils mélangeaient points et pixels (18,67 px au lieu de 24 px pour le gros texte) ; alignés sur le RGAA (24 px, ou 18,5 px en gras).
- **Rôles ARIA (7.1)** : la liste blanche ignorait `tablist`, `group`, `presentation`, `none`, `dialog`… Liste ARIA 1.2 complète (+ DPUB, graphiques) et prise en charge des rôles de repli.
- Extension : plusieurs `h1`, `required` sans `aria-required` et l'absence de `header`/`footer` étaient comptés comme non conformes ; ce sont au mieux des points à vérifier.

### Numéros de critères corrigés

- Lien sans intitulé : 6.2 (et non 6.1). Lien d'évitement : 12.7 (et non 12.1). Sous-titres : 4.3 (et non 4.1). Audiodescription : 4.5 (et non 4.3).
- En-têtes `th` sans `scope`/`id` : 5.7 (et non 5.6). Tableau sans `th` : 5.6 (et non 5.1).
- Affichage à 320 px : 10.11 (et non 10.4). Focus des champs : 10.7 (et non 11.1). Pertinence d'une alternative : 1.3 (et non 1.1).

### Nouveaux contrôles

- Images : image décorative pourvue d'une alternative (1.2), SVG porteur d'alternative sans `role="img"`, `role="img"`, `input type="image"`, `area`, canevas.
- ARIA : contexte et contenu requis (`tab` hors `tablist`, `tablist` vide…), états obligatoires, attributs inconnus ou mal orthographiés, valeurs invalides, références d'id cassées, élément focusable dans `aria-hidden` (10.8).
- Intitulé visible contenu dans le nom accessible (6.1.5, 11.2.5, 11.9.2).
- Formulaires : `label for` orphelin, étiquette implicite, regroupements radio/case à cocher (11.5, 11.6), valeurs `autocomplete` invalides (11.13).
- Structure : id en double (8.2), codes de langue invalides (8.4, 8.8), structure des listes (9.3), `main` absent ou multiple (9.2), titres vides.
- Présentation : balises et attributs de présentation (10.1), liens dans le texte non distingués (10.6).
- Tableaux : tableau de mise en forme avec éléments de données (5.8), `headers` cassé.
- Consultation : `meta refresh` (13.1), `marquee`/`blink` (13.8), documents bureautiques (13.3), son en lecture automatique (4.10).

### Simulation CLI

- Focus visible (10.7) mesuré par comparaison d'images focus / sans focus : détecte aussi un contour rogné par `overflow:hidden`. L'ancienne vérification ne signalait jamais rien (`outline !== 'none'` était toujours vrai).
- Focus masqué par un élément superposé (bandeau cookies…) signalé à part.
- Piège clavier (12.9), lien d'évitement visible au focus et fonctionnel (12.7), texte tronqué au zoom 200 % (10.4), défilement à 320 px avec éléments fautifs (10.11), espacement du texte (10.12).
- Passe de contraste en thème sombre si la page réagit à `prefers-color-scheme` (`--color-scheme`).
- `--no-simulate` remplace `-S false`, qui n'avait aucun effet (toujours accepté pour compatibilité).
- La page est rechargée entre les étapes et à la fin de la simulation.

### Mesures et usage en CI (CLI)

- Bandeau de consentement fermé avant les mesures (`--dismiss auto|off|<sélecteur>`, refus préféré) : il ne masque plus le focus ni le contenu mesuré.
- Contrastes mesurés dans le thème alternatif piloté par le site (`--theme-click`, `--theme-script`), puis thème rétabli.
- Contraste du texte au survol et au focus (3.2), contraste de l'indicateur de focus (3.3, à vérifier).
- Icônes seules d'un bouton ou d'un lien sous 3:1 (3.3), en CLI et dans l'extension.
- Validation du code source généré avec html-validate, en local (`--validate-html`, 8.2).
- Comparaison avec un audit précédent (`--baseline`, `--fail-on-new`) : non-conformités nouvelles et résolues par page.
- Défauts de gabarit : non-conformités communes à plusieurs pages regroupées (`templateIssues`).
- Audit hebdomadaire : seuil relevé de 50 à 70 (le score n'est plus diminué par les points « à vérifier ») et échec sur régression par rapport à la semaine précédente.
- Avant l'audit, la page est parcourue jusqu'en bas puis les animations finies sont attendues : les contenus chargés ou révélés au défilement sont audités, et aucun contraste n'est mesuré au milieu d'un fondu (faux positifs constatés sur rvaz.fr).
- Intitulé visible d'une carte ou vignette = son titre (`h1`-`h6`) : la catégorie ou la durée affichées à côté ne créent plus de faux écart avec le nom accessible (6.1.5, 11.9.2).
- Node.js 20 minimum (exigence de Playwright).

### Extension 0.3.0

- Injection directe du moteur (`chrome.scripting`), sans script de contenu persistant : relancer l'audit sur la même page ne provoque plus d'erreur. Permissions inchangées (`activeTab`, `scripting`).
- Panneau refait et accessible : contrastes corrigés, filtres en boutons à bascule, annonces des résultats, critères dépliables avec intitulé officiel, bouton « Voir » qui met l'élément en évidence dans la page. Le panneau passe son propre audit sans non-conformité.

### Rapports

- CSV : intitulé du critère, nombre d'occurrences, sélecteur, et cellules protégées contre l'injection de formules.
- Rapport vulgarisé : critères à vérifier, section « À vérifier par une personne », défauts de gabarit, liste complète des non-conformités par critère avec exemples et captures annotées, signaux positifs corrigés.
- Paquet npm : les modules partagés sont copiés dans `cli/vendor/` au `prepack`.

### Tests et documentation

- Tests exécutés dans un vrai Chromium sur des fixtures pièges (contraste, ARIA, formulaires, structure, simulation clavier) et sur le panneau de l'extension ; les tests de l'extension sont désormais lancés par `npm test`.
- `docs/RGAA-mapping.md` et le détail de `docs/criteres.html` sont générés depuis `cli/scripts/coverage.js` ; un test vérifie la cohérence avec le code. Nouvelle couverture : 28 critères automatisés, 20 partiels, 58 manuels.
- Extension testée chargée dans Chromium (injection, relance, mise en évidence).
- README : suppression des références à `rgaa-compare-reports.js` et `--dom-only`, qui n'existaient pas.
- Retrait de `cli/rapport.html`, un rapport généré qui était versionné.

## 2026-04-19

### Docs

- Synchronisation des statistiques de couverture RGAA sur la source `docs/RGAA-mapping.md`:
  - 26.4% automatisé
  - 14.2% partiel
  - 38.7% manuel
  - 20.8% à implémenter
- Mise à jour du `README.md`:
  - documentation des options CLI avancées (`--output-dir`, `--dom-only`, `--safe-crawl`, `--strict-security`)
  - ajout de l'usage `rgaa-compare-reports.js`
  - ajout d'une section "Artefacts générés"
- Mise à jour de la page publique `docs/index.html`:
  - version affichée alignée avec la CLI (`v0.1.0`)
  - chiffres clés alignés avec le mapping
  - ajout d'un bloc "Nouveautés récentes"
  - ajout d'exemples de parcours CLI (audit simple, multipages, ODS, comparaison)
- Mise à jour de `docs/criteres.html` avec le résumé chiffré de couverture.

### Process

- Ajout de la checklist de publication docs: `docs/RELEASE-DOCS-CHECKLIST.md`.
