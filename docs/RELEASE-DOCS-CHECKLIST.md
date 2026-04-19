# Release Docs Checklist

Checklist à suivre pour chaque release afin de garder repo + site synchronisés.

## Source de vérité

- [ ] Vérifier les chiffres dans `docs/RGAA-mapping.md` (résumé final).
- [ ] Reporter exactement ces chiffres dans `README.md`.
- [ ] Reporter exactement ces chiffres dans `docs/index.html`.
- [ ] Mettre à jour `docs/criteres.html` si le résumé de couverture évolue.

## Version et commandes

- [ ] Vérifier la version CLI dans `cli/package.json`.
- [ ] Aligner la version affichée sur la page `docs/index.html`.
- [ ] Vérifier les exemples de commandes CLI (`README.md` + `docs/index.html`).
- [ ] Vérifier que les commandes documentées existent toujours (`rgaa-audit`, `rgaa-fill-grid`, `rgaa-compare`).

## Artefacts et parcours utilisateur

- [ ] Vérifier que les artefacts générés sont documentés (JSON/HTML/CSV/vulgarisé/ODS/screenshots).
- [ ] Vérifier que le parcours public reste clair: home page, multipages, ODS, comparaison.
- [ ] Vérifier la cohérence du message "pré-audit non certifiant" sur toutes les pages.

## Publication

- [ ] Ajouter une entrée datée dans `CHANGELOG.md`.
- [ ] Relire les pages `docs/index.html` et `docs/criteres.html` en local.
- [ ] Déployer GitHub Pages après merge.
