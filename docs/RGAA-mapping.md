# RGAA 4.1 — Mapping critères → couverture automatique

Légende :
- ✅ Automatisé — couvert dans `src/rules/index.js` et `extension/content.js`
- ⚠️ Partiel — détection possible mais pertinence non vérifiable automatiquement
- ❌ Manuel — impossible à automatiser, nécessite un jugement humain
- 🚧 À faire — automatisable, non encore implémenté

---

## Thème 1 — Images

| Critère | Intitulé | Auto | Statut |
|---------|----------|------|--------|
| 1.1 | Attribut alt présent | ✅ | Implémenté |
| 1.2 | Image décorative ignorée par AT | ✅ | Implémenté |
| 1.3 | Alternative pertinente (image porteuse d'info) | ❌ | Manuel |
| 1.4 | CAPTCHA : alternative non-visuelle | ⚠️ | Partiel (détection img CAPTCHA) |
| 1.5 | CAPTCHA : alternative accessible | ❌ | Manuel |
| 1.6 | Image complexe avec description détaillée | ⚠️ | Partiel (présence aria-describedby) |
| 1.7 | Description longue pertinente | ❌ | Manuel |
| 1.8 | Texte dans image (hors exception) | ⚠️ | Partiel (alt long = suspicion) |
| 1.9 | Image texte remplaçable par CSS | ❌ | Manuel |

## Thème 2 — Cadres

| Critère | Intitulé | Auto | Statut |
|---------|----------|------|--------|
| 2.1 | iframe avec titre | ✅ | Implémenté |
| 2.2 | Titre de cadre pertinent | ❌ | Manuel |

## Thème 3 — Couleurs

| Critère | Intitulé | Auto | Statut |
|---------|----------|------|--------|
| 3.1 | Information donnée par couleur uniquement | ❌ | Manuel |
| 3.2 | Contraste texte/fond suffisant | ✅ | Implémenté |
| 3.3 | Contraste composants UI (non-texte) | ⚠️ | Partiel (boutons/champs) |

## Thème 4 — Multimédia

| Critère | Intitulé | Auto | Statut |
|---------|----------|------|--------|
| 4.1 | Transcription / sous-titres | ⚠️ | Partiel (détection track) |
| 4.2 | Titre et synopsis | 🚧 | À faire |
| 4.3 | Audio-description | ❌ | Manuel |
| 4.4 | Audio-description synchronisée | ❌ | Manuel |
| 4.5 | Contenu alternatif audio-description | ❌ | Manuel |
| 4.6 | Sous-titres synchronisés | ⚠️ | Partiel |
| 4.7 | Transcription textuelle | ❌ | Manuel |
| 4.8 | Seulement audio : transcription | ❌ | Manuel |
| 4.9 | Seulement vidéo : transcription/audio-desc | ❌ | Manuel |
| 4.10 | Déclenchement auto interdit | ⚠️ | Partiel (autoplay détectable) |
| 4.11 | Contrôle volume indépendant | ❌ | Manuel |
| 4.12 | Arrêt/pause/reprise | ⚠️ | Partiel |
| 4.13 | Accès aux fonctionnalités sans son | ❌ | Manuel |

## Thème 5 — Tableaux

| Critère | Intitulé | Auto | Statut |
|---------|----------|------|--------|
| 5.1 | En-têtes de tableau présents | ✅ | Implémenté |
| 5.2 | Tableau de données : en-têtes th | ✅ | Implémenté |
| 5.3 | Tableau de présentation : sans th | ⚠️ | Partiel |
| 5.4 | Résumé (caption/summary/aria-label) | ✅ | Implémenté |
| 5.5 | Titre pertinent | ❌ | Manuel |
| 5.6 | En-têtes liées aux cellules (scope) | ✅ | Implémenté |
| 5.7 | Headers/id pour tableaux complexes | 🚧 | À faire |
| 5.8 | Résumé pertinent | ❌ | Manuel |

## Thème 6 — Liens

| Critère | Intitulé | Auto | Statut |
|---------|----------|------|--------|
| 6.1 | Intitulé de lien explicite | ✅ | Implémenté |
| 6.2 | Lien image : alternative | ✅ | Implémenté |

## Thème 7 — Scripts

| Critère | Intitulé | Auto | Statut |
|---------|----------|------|--------|
| 7.1 | Scripts : alternative accessible | ⚠️ | Partiel (rôles ARIA valides) |
| 7.2 | Compatibilité AT | ❌ | Manuel (test lecteur d'écran) |
| 7.3 | Contrôle clavier | ⚠️ | Partiel (onclick sur div/span) |
| 7.4 | Piège clavier | 🚧 | À faire (simulation Tab) |
| 7.5 | Messages contexte | ❌ | Manuel |

## Thème 8 — Éléments obligatoires

| Critère | Intitulé | Auto | Statut |
|---------|----------|------|--------|
| 8.1 | DOCTYPE valide | ✅ | Implémenté |
| 8.2 | Balises conformes aux spécifications | ✅ | Implémenté (charset) |
| 8.3 | Langue par défaut | ✅ | Implémenté |
| 8.4 | Langue pertinente | ❌ | Manuel |
| 8.5 | Titre de page pertinent | ✅ | Implémenté |
| 8.6 | Titre dans le contexte de navigation | ❌ | Manuel |
| 8.7 | Changements de langue dans le contenu | 🚧 | À faire (détection lang inline) |
| 8.8 | Changements de langue pour les mots | ❌ | Manuel |
| 8.9 | Balises pour la présentation | 🚧 | À faire (détection b/i/u) |
| 8.10 | Texte invisible accessible | 🚧 | À faire |

## Thème 9 — Structure

| Critère | Intitulé | Auto | Statut |
|---------|----------|------|--------|
| 9.1 | Hiérarchie des titres cohérente | ✅ | Implémenté |
| 9.2 | Structure du document (landmarks) | ✅ | Implémenté |
| 9.3 | Listes correctement balisées | ✅ | Implémenté |
| 9.4 | Citations correctement balisées | 🚧 | À faire (blockquote/q) |

## Thème 10 — Présentation

| Critère | Intitulé | Auto | Statut |
|---------|----------|------|--------|
| 10.1 | Info non donnée par présentation seule | ⚠️ | Partiel (test sans CSS) |
| 10.2 | Contenu visible désactivation CSS | ⚠️ | Partiel (simulation) |
| 10.3 | Couleur non seul moyen d'info | ❌ | Manuel |
| 10.4 | Agrandissement texte 200% | ✅ | Implémenté (simulation) |
| 10.5 | Graisse/italique/taille pour l'info | ❌ | Manuel |
| 10.6 | Texte justifié | 🚧 | À faire (text-align: justify) |
| 10.7 | Focus visible | ✅ | Implémenté (simulation + CSS) |
| 10.8 | Contenu masqué visible au focus | 🚧 | À faire |
| 10.9 | Info par forme/taille/position | ❌ | Manuel |
| 10.10 | Espacement texte personnalisable | 🚧 | À faire |
| 10.11 | Contenu au survol | 🚧 | À faire |
| 10.12 | Contenus additionnels au survol/focus | ❌ | Manuel |
| 10.13 | Texte cachés | ⚠️ | Partiel |
| 10.14 | Alternatives aux CAPTCHA | ❌ | Manuel |

## Thème 11 — Formulaires

| Critère | Intitulé | Auto | Statut |
|---------|----------|------|--------|
| 11.1 | Étiquette associée à chaque champ | ✅ | Implémenté |
| 11.2 | Étiquette pertinente | ❌ | Manuel |
| 11.3 | Étiquette correctement liée (for/id) | ✅ | Implémenté |
| 11.4 | Étiquette visible à proximité | ❌ | Manuel |
| 11.5 | Champs de même nature groupés | 🚧 | À faire (fieldset/legend) |
| 11.6 | Legend pertinente | ❌ | Manuel |
| 11.7 | Liste de choix groupées | 🚧 | À faire (optgroup) |
| 11.8 | Liste de choix pertinente | ❌ | Manuel |
| 11.9 | Intitulé de bouton pertinent | ✅ | Implémenté |
| 11.10 | Contrôle de saisie (erreurs) | ✅ | Implémenté (required/aria-required) |
| 11.11 | Aide à la saisie | 🚧 | À faire |
| 11.12 | Correction d'erreurs | ❌ | Manuel |
| 11.13 | Finalité du champ personnelle | 🚧 | À faire (autocomplete) |

## Thème 12 — Navigation

| Critère | Intitulé | Auto | Statut |
|---------|----------|------|--------|
| 12.1 | Liens d'évitement | ✅ | Implémenté |
| 12.2 | Lien d'évitement fonctionnel | ✅ | Implémenté (simulation Tab) |
| 12.3 | Plan du site | ❌ | Manuel |
| 12.4 | Moteur de recherche | ❌ | Manuel |
| 12.5 | Navigation cohérente | ❌ | Manuel |
| 12.6 | Zones repérables (nav aria-label) | ✅ | Implémenté |
| 12.7 | Lien vers zones de navigation | 🚧 | À faire |
| 12.8 | Ordre de tabulation cohérent | ✅ | Implémenté (tabindex > 0) |
| 12.9 | Piège au clavier | 🚧 | À faire |
| 12.10 | Raccourcis clavier à une touche | 🚧 | À faire |
| 12.11 | Accès aux contenus en mouvement | ❌ | Manuel |

## Thème 13 — Consultation

| Critère | Intitulé | Auto | Statut |
|---------|----------|------|--------|
| 13.1 | Délai de session | ❌ | Manuel |
| 13.2 | Ouverture nouvelle fenêtre | 🚧 | À faire (target=_blank) |
| 13.3 | Documents en téléchargement | 🚧 | À faire (liens .pdf/.doc) |
| 13.4 | Accès à des téléchargements | ❌ | Manuel |
| 13.5 | Accès aux textes en image | ❌ | Manuel |
| 13.6 | Format des documents accessibles | ❌ | Manuel |
| 13.7 | Clignotement (> 3 flash/sec) | ✅ | Implémenté (animation-duration) |
| 13.8 | Seuils de flash | 🚧 | À faire |
| 13.9 | Contenus animés contrôlables | ⚠️ | Partiel |
| 13.10 | Dispositifs de pointage alternatifs | ❌ | Manuel |
| 13.11 | Actions du dispositif de pointage | 🚧 | À faire |
| 13.12 | Annulation des actions | ❌ | Manuel |

---

## Résumé

| Statut | Nombre | % |
|--------|--------|---|
| ✅ Automatisé | ~28 | ~26% |
| ⚠️ Partiel | ~18 | ~17% |
| 🚧 À faire | ~22 | ~21% |
| ❌ Manuel uniquement | ~38 | ~36% |
| **TOTAL** | **106** | **100%** |

**Potentiel automatisable (✅ + 🚧) : ~47%** du référentiel RGAA 4.1.
