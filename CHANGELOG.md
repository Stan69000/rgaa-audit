# Changelog

Toutes les évolutions notables du projet sont documentées ici.

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
