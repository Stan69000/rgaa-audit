# Release Docs Checklist

Checklist à suivre pour chaque release afin de garder repo + site synchronisés.

## Source de vérité

- [ ] Mettre à jour `cli/scripts/coverage.js` puis lancer `npm run docs:coverage` (dossier `cli/`) : régénère `docs/RGAA-mapping.md` et le détail de `docs/criteres.html`.
- [ ] Reporter les chiffres de la synthèse dans `README.md` et `docs/index.html`.

## Version et commandes

- [ ] Vérifier la version CLI dans `cli/package.json`.
- [ ] Aligner la version affichée sur la page `docs/index.html`.
- [ ] Vérifier les exemples de commandes CLI (`README.md` + `docs/index.html`).
- [ ] Vérifier que les commandes documentées existent toujours (`rgaa-audit`, `rgaa-fill-grid`).

## Artefacts et parcours utilisateur

- [ ] Vérifier que les artefacts générés sont documentés (JSON/HTML/CSV/vulgarisé/ODS/screenshots).
- [ ] Vérifier que le parcours public reste clair: home page, multipages, ODS, rapport vulgarisé.
- [ ] Vérifier la cohérence du message "pré-audit non certifiant" sur toutes les pages.

## Publication

- [ ] Ajouter une entrée datée dans `CHANGELOG.md`.
- [ ] Si `extension/` a changé : incrémenter `version` dans `extension/manifest.json`, lancer `npm run package:extension` (ou récupérer l'artefact CI) et téléverser le zip sur le Chrome Web Store.
- [ ] Relire les pages `docs/index.html` et `docs/criteres.html` en local.
- [ ] Déployer GitHub Pages après merge.
