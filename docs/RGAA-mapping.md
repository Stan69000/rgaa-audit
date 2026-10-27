# RGAA 4.1.2 — couverture de l’outil, critère par critère

> ⚠️ Projet associatif vibe codé — Cet outil est développé bénévolement par Le Singe Du Numérique dans une démarche d'ouverture de l'accessibilité au plus grand nombre. Il s'agit d'un pré-audit automatique, non certifié, basé sur le RGAA 4.1.2. Les résultats peuvent comporter des erreurs et ne remplacent pas un audit réalisé par un professionnel certifié, ni un accompagnement spécialisé. Utilisez-le comme point de départ, pas comme conclusion.

_Fichier généré par `npm run docs:coverage` (dossier `cli/`) à partir de `cli/scripts/coverage.js`. Ne pas modifier à la main : un test vérifie que ce tableau correspond au code._

Légende :
- ✅ **Automatisé** : l’outil détecte de façon fiable des non-conformités sur ce critère. Une partie du critère peut rester à vérifier à la main.
- ⚠️ **Partiel** : l’outil remonte des indices « à vérifier » ou ne contrôle qu’une petite partie du critère.
- ❌ **Manuel** : jugement humain nécessaire (sens, pertinence, usage réel).

Les règles s’exécutent dans un moteur unique (`extension/shared/rgaa-rules.js`) partagé par la CLI et l’extension. La colonne « Où » précise les contrôles qui demandent la simulation Playwright de la CLI (clavier, zoom, 320 px…).

## Synthèse

| Niveau | Critères | Part |
|---|---|---|
| ✅ Automatisé | 28 | 26.4 % |
| ⚠️ Partiel | 20 | 18.9 % |
| ❌ Manuel | 58 | 54.7 % |
| **Total** | **106** | |

## Thème 1 — Images

| Critère | Intitulé | Couverture | Où | Ce qui est contrôlé |
|---|---|---|---|---|
| 1.1 | Chaque image porteuse d’information a-t-elle une alternative textuelle ? | ✅ Automatisé | CLI + extension | img sans alt, SVG/role="img"/canvas sans alternative, input image, area |
| 1.2 | Chaque image de décoration est-elle correctement ignorée par les technologies d’assistance ? | ✅ Automatisé | CLI + extension | image décorative pourvue d’une alternative ; SVG ni masqué ni nommé (à vérifier) |
| 1.3 | Pour chaque image porteuse d’information ayant une alternative textuelle, cette alternative est-elle pertinente (hors cas particuliers) ? | ⚠️ Partiel | CLI + extension | alternative générique, nom de fichier, trop longue |
| 1.4 | Pour chaque image utilisée comme CAPTCHA ou comme image-test, ayant une alternative textuelle, cette alternative permet-elle d’identifier la nature et la fonction de l’image ? | ❌ Manuel | — | — |
| 1.5 | Pour chaque image utilisée comme CAPTCHA, une solution d’accès alternatif au contenu ou à la fonction du CAPTCHA est-elle présente ? | ❌ Manuel | — | — |
| 1.6 | Chaque image porteuse d’information a-t-elle, si nécessaire, une description détaillée ? | ❌ Manuel | — | — |
| 1.7 | Pour chaque image porteuse d’information ayant une description détaillée, cette description est-elle pertinente ? | ❌ Manuel | — | — |
| 1.8 | Chaque image texte porteuse d’information, en l’absence d’un mécanisme de remplacement, doit si possible être remplacée par du texte stylé. Cette règle est-elle respectée (hors cas particuliers) ? | ❌ Manuel | — | — |
| 1.9 | Chaque légende d’image est-elle, si nécessaire, correctement reliée à l’image correspondante ? | ❌ Manuel | — | — |

## Thème 2 — Cadres

| Critère | Intitulé | Couverture | Où | Ce qui est contrôlé |
|---|---|---|---|---|
| 2.1 | Chaque cadre a-t-il un titre de cadre ? | ✅ Automatisé | CLI + extension | iframe sans title |
| 2.2 | Pour chaque cadre ayant un titre de cadre, ce titre de cadre est-il pertinent ? | ❌ Manuel | — | — |

## Thème 3 — Couleurs

| Critère | Intitulé | Couverture | Où | Ce qui est contrôlé |
|---|---|---|---|---|
| 3.1 | Dans chaque page web, l’information ne doit pas être donnée uniquement par la couleur. Cette règle est-elle respectée ? | ❌ Manuel | — | — |
| 3.2 | Dans chaque page web, le contraste entre la couleur du texte et la couleur de son arrière-plan est-il suffisamment élevé (hors cas particuliers) ? | ✅ Automatisé | CLI + extension (+ simulation CLI) | texte réellement rendu : fond composé (transparences, opacité, éléments superposés), seuils 24 px / 18,5 px gras ; CLI : états survol et focus, thème sombre, thème alternatif du site |
| 3.3 | Dans chaque page web, les couleurs utilisées dans les composants d’interface ou les éléments graphiques porteurs d’informations sont-elles suffisamment contrastées (hors cas particuliers) ? | ✅ Automatisé | CLI + extension (+ simulation CLI) | icône seule d’un bouton ou d’un lien sous 3:1 ; bordures de champs (à vérifier) ; CLI : contraste de l’indicateur de focus (à vérifier) |

## Thème 4 — Multimédia

| Critère | Intitulé | Couverture | Où | Ce qui est contrôlé |
|---|---|---|---|---|
| 4.1 | Chaque média temporel pré-enregistré a-t-il, si nécessaire, une transcription textuelle ou une audiodescription (hors cas particuliers) ? | ❌ Manuel | — | — |
| 4.2 | Pour chaque média temporel pré-enregistré ayant une transcription textuelle ou une audiodescription synchronisée, celles-ci sont-elles pertinentes (hors cas particuliers) ? | ❌ Manuel | — | — |
| 4.3 | Chaque média temporel synchronisé pré-enregistré a-t-il, si nécessaire, des sous-titres synchronisés (hors cas particuliers) ? | ⚠️ Partiel | CLI + extension | vidéo sans piste de sous-titres |
| 4.4 | Pour chaque média temporel synchronisé pré-enregistré ayant des sous-titres synchronisés, ces sous-titres sont-ils pertinents ? | ❌ Manuel | — | — |
| 4.5 | Chaque média temporel pré-enregistré a-t-il, si nécessaire, une audiodescription synchronisée (hors cas particuliers) ? | ❌ Manuel | — | — |
| 4.6 | Pour chaque média temporel pré-enregistré ayant une audiodescription synchronisée, celle-ci est-elle pertinente ? | ❌ Manuel | — | — |
| 4.7 | Chaque média temporel est-il clairement identifiable (hors cas particuliers) ? | ❌ Manuel | — | — |
| 4.8 | Chaque média non temporel a-t-il, si nécessaire, une alternative (hors cas particuliers) ? | ❌ Manuel | — | — |
| 4.9 | Pour chaque média non temporel ayant une alternative, cette alternative est-elle pertinente ? | ❌ Manuel | — | — |
| 4.10 | Chaque son déclenché automatiquement est-il contrôlable par l’utilisateur ? | ✅ Automatisé | CLI + extension | média en lecture automatique avec le son |
| 4.11 | La consultation de chaque média temporel est-elle, si nécessaire, contrôlable par le clavier et tout dispositif de pointage ? | ⚠️ Partiel | CLI + extension | média sans contrôles natifs |
| 4.12 | La consultation de chaque média non temporel est-elle contrôlable par le clavier et tout dispositif de pointage ? | ❌ Manuel | — | — |
| 4.13 | Chaque média temporel et non temporel est-il compatible avec les technologies d’assistance (hors cas particuliers) ? | ❌ Manuel | — | — |

## Thème 5 — Tableaux

| Critère | Intitulé | Couverture | Où | Ce qui est contrôlé |
|---|---|---|---|---|
| 5.1 | Chaque tableau de données complexe a-t-il un résumé ? | ⚠️ Partiel | CLI + extension | tableau complexe sans résumé |
| 5.2 | Pour chaque tableau de données complexe ayant un résumé, celui-ci est-il pertinent ? | ❌ Manuel | — | — |
| 5.3 | Pour chaque tableau de mise en forme, le contenu linéarisé reste-t-il compréhensible ? | ❌ Manuel | — | — |
| 5.4 | Pour chaque tableau de données ayant un titre, le titre est-il correctement associé au tableau de données ? | ❌ Manuel | — | — |
| 5.5 | Pour chaque tableau de données ayant un titre, celui-ci est-il pertinent ? | ❌ Manuel | — | — |
| 5.6 | Pour chaque tableau de données, chaque en-tête de colonne et chaque en-tête de ligne sont-ils correctement déclarés ? | ⚠️ Partiel | CLI + extension | tableau sans en-tête déclaré |
| 5.7 | Pour chaque tableau de données, la technique appropriée permettant d’associer chaque cellule avec ses en-têtes est-elle utilisée (hors cas particuliers) ? | ✅ Automatisé | CLI + extension | th sans scope/id/role, scope invalide, headers cassé |
| 5.8 | Chaque tableau de mise en forme ne doit pas utiliser d’éléments propres aux tableaux de données. Cette règle est-elle respectée ? | ✅ Automatisé | CLI + extension | tableau de mise en forme avec th, caption, scope… |

## Thème 6 — Liens

| Critère | Intitulé | Couverture | Où | Ce qui est contrôlé |
|---|---|---|---|---|
| 6.1 | Chaque lien est-il explicite (hors cas particuliers) ? | ⚠️ Partiel | CLI + extension | nom accessible sans l’intitulé visible (6.1.5) ; intitulés génériques (à vérifier) |
| 6.2 | Dans chaque page web, chaque lien a-t-il un intitulé ? | ✅ Automatisé | CLI + extension | lien sans intitulé |

## Thème 7 — Scripts

| Critère | Intitulé | Couverture | Où | Ce qui est contrôlé |
|---|---|---|---|---|
| 7.1 | Chaque script est-il, si nécessaire, compatible avec les technologies d’assistance ? | ✅ Automatisé | CLI + extension | rôles invalides ou hors contexte, attributs et valeurs ARIA invalides, états requis, références cassées |
| 7.2 | Pour chaque script ayant une alternative, cette alternative est-elle pertinente ? | ❌ Manuel | — | — |
| 7.3 | Chaque script est-il contrôlable par le clavier et par tout dispositif de pointage (hors cas particuliers) ? | ✅ Automatisé | CLI + extension | composants interactifs non focusables, onclick sur élément non interactif |
| 7.4 | Pour chaque script qui initie un changement de contexte, l’utilisateur est-il averti ou en a-t-il le contrôle ? | ❌ Manuel | — | — |
| 7.5 | Dans chaque page web, les messages de statut sont-ils correctement restitués par les technologies d’assistance ? | ❌ Manuel | — | — |

## Thème 8 — Éléments obligatoires

| Critère | Intitulé | Couverture | Où | Ce qui est contrôlé |
|---|---|---|---|---|
| 8.1 | Chaque page web est-elle définie par un type de document ? | ✅ Automatisé | CLI + extension | doctype |
| 8.2 | Pour chaque page web, le code source généré est-il valide selon le type de document spécifié ? | ⚠️ Partiel | CLI + extension (+ simulation CLI) | id en double ; CLI --validate-html : validation complète du code généré (html-validate, en local) |
| 8.3 | Dans chaque page web, la langue par défaut est-elle présente ? | ✅ Automatisé | CLI + extension | lang absent sur html |
| 8.4 | Pour chaque page web ayant une langue par défaut, le code de langue est-il pertinent ? | ⚠️ Partiel | CLI + extension | code de langue invalide |
| 8.5 | Chaque page web a-t-elle un titre de page ? | ✅ Automatisé | CLI + extension | title absent ou vide |
| 8.6 | Pour chaque page web ayant un titre de page, ce titre est-il pertinent ? | ❌ Manuel | — | — |
| 8.7 | Dans chaque page web, chaque changement de langue est-il indiqué dans le code source (hors cas particuliers) ? | ❌ Manuel | — | — |
| 8.8 | Dans chaque page web, le code de langue de chaque changement de langue est-il valide et pertinent ? | ⚠️ Partiel | CLI + extension | code de langue invalide sur un élément |
| 8.9 | Dans chaque page web, les balises ne doivent pas être utilisées uniquement à des fins de présentation. Cette règle est-elle respectée ? | ⚠️ Partiel | CLI + extension | paragraphes vides servant d’espacement |
| 8.10 | Dans chaque page web, les changements du sens de lecture sont-ils signalés ? | ❌ Manuel | — | — |

## Thème 9 — Structuration de l’information

| Critère | Intitulé | Couverture | Où | Ce qui est contrôlé |
|---|---|---|---|---|
| 9.1 | Dans chaque page web, l’information est-elle structurée par l’utilisation appropriée de titres ? | ⚠️ Partiel | CLI + extension | titres vides, role="heading" sans aria-level ; hiérarchie (à vérifier) |
| 9.2 | Dans chaque page web, la structure du document est-elle cohérente (hors cas particuliers) ? | ✅ Automatisé | CLI + extension | main absent ou multiple ; header/nav/footer (à vérifier) |
| 9.3 | Dans chaque page web, chaque liste est-elle correctement structurée ? | ✅ Automatisé | CLI + extension | enfants de ul/ol/dl invalides, li orphelin ; listes simulées (à vérifier) |
| 9.4 | Dans chaque page web, chaque citation est-elle correctement indiquée ? | ❌ Manuel | — | — |

## Thème 10 — Présentation de l’information

| Critère | Intitulé | Couverture | Où | Ce qui est contrôlé |
|---|---|---|---|---|
| 10.1 | Dans le site web, des feuilles de styles sont-elles utilisées pour contrôler la présentation de l’information ? | ✅ Automatisé | CLI + extension | balises et attributs de présentation |
| 10.2 | Dans chaque page web, le contenu visible porteur d’information reste-t-il présent lorsque les feuilles de styles sont désactivées ? | ❌ Manuel | — | — |
| 10.3 | Dans chaque page web, l’information reste-t-elle compréhensible lorsque les feuilles de styles sont désactivées ? | ❌ Manuel | CLI (simulation) | capture sans CSS fournie pour la vérification |
| 10.4 | Dans chaque page web, le texte reste-t-il lisible lorsque la taille des caractères est augmentée jusqu’à 200 %, au moins (hors cas particuliers) ? | ⚠️ Partiel | CLI (simulation) | texte tronqué à 200 % |
| 10.5 | Dans chaque page web, les déclarations CSS de couleurs de fond d’élément et de police sont-elles correctement utilisées ? | ❌ Manuel | — | — |
| 10.6 | Dans chaque page web, chaque lien dont la nature n’est pas évidente est-il visible par rapport au texte environnant ? | ✅ Automatisé | CLI + extension | lien dans le texte non souligné et sous 3:1 avec le texte |
| 10.7 | Dans chaque page web, pour chaque élément recevant le focus, la prise de focus est-elle visible ? | ✅ Automatisé | CLI + extension (+ simulation CLI) | CLI : comparaison d’images focus/sans focus sur le parcours clavier ; CSS supprimant le contour (à vérifier) |
| 10.8 | Pour chaque page web, les contenus cachés ont-ils vocation à être ignorés par les technologies d’assistance ? | ✅ Automatisé | CLI + extension | élément focusable dans une zone aria-hidden |
| 10.9 | Dans chaque page web, l’information ne doit pas être donnée uniquement par la forme, taille ou position. Cette règle est-elle respectée ? | ❌ Manuel | — | — |
| 10.10 | Dans chaque page web, l’information ne doit pas être donnée par la forme, taille ou position uniquement. Cette règle est-elle implémentée de façon pertinente ? | ❌ Manuel | — | — |
| 10.11 | Pour chaque page web, les contenus peuvent-ils être présentés sans perte d’information ou de fonctionnalité et sans avoir recours soit à un défilement vertical pour une fenêtre ayant une hauteur de 256 px, soit à un défilement horizontal pour une fenêtre ayant une largeur de 320 px (hors cas particuliers) ? | ✅ Automatisé | CLI (simulation) | défilement horizontal à 320 px |
| 10.12 | Dans chaque page web, les propriétés d’espacement du texte peuvent-elles être redéfinies par l’utilisateur sans perte de contenu ou de fonctionnalité (hors cas particuliers) ? | ✅ Automatisé | CLI (simulation) | texte tronqué avec l’espacement du test 10.12 |
| 10.13 | Dans chaque page web, les contenus additionnels apparaissant à la prise de focus ou au survol d’un composant d’interface sont-ils contrôlables par l’utilisateur (hors cas particuliers) ? | ❌ Manuel | — | — |
| 10.14 | Dans chaque page web, les contenus additionnels apparaissant via les styles CSS uniquement peuvent-ils être rendus visibles au clavier et par tout dispositif de pointage ? | ❌ Manuel | — | — |

## Thème 11 — Formulaires

| Critère | Intitulé | Couverture | Où | Ce qui est contrôlé |
|---|---|---|---|---|
| 11.1 | Chaque champ de formulaire a-t-il une étiquette ? | ✅ Automatisé | CLI + extension | champ sans étiquette, placeholder seul, label for orphelin ; étiquette implicite (à vérifier) |
| 11.2 | Chaque étiquette associée à un champ de formulaire est-elle pertinente (hors cas particuliers) ? | ⚠️ Partiel | CLI + extension | nom accessible sans l’étiquette visible (11.2.5) |
| 11.3 | Dans chaque formulaire, chaque étiquette associée à un champ de formulaire ayant la même fonction et répétée plusieurs fois dans une même page ou dans un ensemble de pages est-elle cohérente ? | ❌ Manuel | — | — |
| 11.4 | Dans chaque formulaire, chaque étiquette de champ et son champ associé sont-ils accolés (hors cas particuliers) ? | ❌ Manuel | — | — |
| 11.5 | Dans chaque formulaire, les champs de même nature sont-ils regroupés, si nécessaire ? | ✅ Automatisé | CLI + extension | boutons radio / cases à cocher de même nom non regroupés |
| 11.6 | Dans chaque formulaire, chaque regroupement de champs de même nature a-t-il une légende ? | ✅ Automatisé | CLI + extension | regroupement sans légende |
| 11.7 | Dans chaque formulaire, chaque légende associée à un regroupement de champs de même nature est-elle pertinente ? | ❌ Manuel | — | — |
| 11.8 | Dans chaque formulaire, les items de même nature d’une liste de choix sont-ils regroupés de manière pertinente ? | ❌ Manuel | — | — |
| 11.9 | Dans chaque formulaire, l’intitulé de chaque bouton est-il pertinent (hors cas particuliers) ? | ⚠️ Partiel | CLI + extension | bouton sans intitulé, nom sans l’intitulé visible (11.9.2) |
| 11.10 | Dans chaque formulaire, le contrôle de saisie est-il utilisé de manière pertinente (hors cas particuliers) ? | ⚠️ Partiel | CLI + extension | obligation non signalée, erreur non associée |
| 11.11 | Dans chaque formulaire, le contrôle de saisie est-il accompagné, si nécessaire, de suggestions facilitant la correction des erreurs de saisie ? | ❌ Manuel | — | — |
| 11.12 | Pour chaque formulaire qui modifie ou supprime des données, ou qui transmet des réponses à un test ou à un examen, ou dont la validation a des conséquences financières ou juridiques, les données saisies peuvent-elles être modifiées, mises à jour ou récupérées par l’utilisateur ? | ❌ Manuel | — | — |
| 11.13 | La finalité d’un champ de saisie peut-elle être déduite pour faciliter le remplissage automatique des champs avec les données de l’utilisateur ? | ⚠️ Partiel | CLI + extension | valeur autocomplete invalide ; autocomplete manquant (à vérifier) |

## Thème 12 — Navigation

| Critère | Intitulé | Couverture | Où | Ce qui est contrôlé |
|---|---|---|---|---|
| 12.1 | Chaque ensemble de pages dispose-t-il de deux systèmes de navigation différents, au moins (hors cas particuliers) ? | ❌ Manuel | — | — |
| 12.2 | Dans chaque ensemble de pages, le menu et les barres de navigation sont-ils toujours à la même place (hors cas particuliers) ? | ❌ Manuel | — | — |
| 12.3 | La page « plan du site » est-elle pertinente ? | ❌ Manuel | — | — |
| 12.4 | Dans chaque ensemble de pages, la page « plan du site » est-elle accessible à partir d’une fonctionnalité identique ? | ❌ Manuel | — | — |
| 12.5 | Dans chaque ensemble de pages, le moteur de recherche est-il atteignable de manière identique ? | ❌ Manuel | — | — |
| 12.6 | Les zones de regroupement de contenus présentes dans plusieurs pages web (zones d’en-tête, de navigation principale, de contenu principal, de pied de page et de moteur de recherche) peuvent-elles être atteintes ou évitées ? | ❌ Manuel | — | — |
| 12.7 | Dans chaque page web, un lien d’évitement ou d’accès rapide à la zone de contenu principal est-il présent (hors cas particuliers) ? | ✅ Automatisé | CLI + extension (+ simulation CLI) | lien d’évitement absent, cible absente ; CLI : visible au focus et fonctionnel |
| 12.8 | Dans chaque page web, l’ordre de tabulation est-il cohérent ? | ⚠️ Partiel | CLI + extension | tabindex positif |
| 12.9 | Dans chaque page web, la navigation ne doit pas contenir de piège au clavier. Cette règle est-elle respectée ? | ✅ Automatisé | CLI (simulation) | focus bloqué sur un élément pendant le parcours clavier |
| 12.10 | Dans chaque page web, les raccourcis clavier n’utilisant qu’une seule touche (lettre minuscule ou majuscule, ponctuation, chiffre ou symbole) sont-ils contrôlables par l’utilisateur ? | ❌ Manuel | — | — |
| 12.11 | Dans chaque page web, les contenus additionnels apparaissant au survol, à la prise de focus ou à l’activation d’un composant d’interface sont-ils si nécessaire atteignables au clavier ? | ❌ Manuel | — | — |

## Thème 13 — Consultation

| Critère | Intitulé | Couverture | Où | Ce qui est contrôlé |
|---|---|---|---|---|
| 13.1 | Pour chaque page web, l’utilisateur a-t-il le contrôle de chaque limite de temps modifiant le contenu (hors cas particuliers) ? | ✅ Automatisé | CLI + extension | meta refresh et redirection différée |
| 13.2 | Dans chaque page web, l’ouverture d’une nouvelle fenêtre ne doit pas être déclenchée sans action de l’utilisateur. Cette règle est-elle respectée ? | ❌ Manuel | — | — |
| 13.3 | Dans chaque page web, chaque document bureautique en téléchargement possède-t-il, si nécessaire, une version accessible (hors cas particuliers) ? | ⚠️ Partiel | CLI + extension | documents bureautiques sans format annoncé |
| 13.4 | Pour chaque document bureautique ayant une version accessible, cette version offre-t-elle la même information ? | ❌ Manuel | — | — |
| 13.5 | Dans chaque page web, chaque contenu cryptique (art ASCII, émoticône, syntaxe cryptique) a-t-il une alternative ? | ❌ Manuel | — | — |
| 13.6 | Dans chaque page web, pour chaque contenu cryptique (art ASCII, émoticône, syntaxe cryptique) ayant une alternative, cette alternative est-elle pertinente ? | ❌ Manuel | — | — |
| 13.7 | Dans chaque page web, les changements brusques de luminosité ou les effets de flash sont-ils correctement utilisés ? | ⚠️ Partiel | CLI (simulation) | animations en boucle plus rapides que 3 cycles par seconde |
| 13.8 | Dans chaque page web, chaque contenu en mouvement ou clignotant est-il contrôlable par l’utilisateur ? | ⚠️ Partiel | CLI + extension | marquee/blink (non conforme) ; animations infinies, vidéo en boucle (à vérifier) |
| 13.9 | Dans chaque page web, le contenu proposé est-il consultable quelle que soit l’orientation de l’écran (portrait ou paysage) (hors cas particuliers) ? | ❌ Manuel | — | — |
| 13.10 | Dans chaque page web, les fonctionnalités utilisables ou disponibles au moyen d’un geste complexe peuvent-elles être également disponibles au moyen d’un geste simple (hors cas particuliers) ? | ❌ Manuel | — | — |
| 13.11 | Dans chaque page web, les actions déclenchées au moyen d’un dispositif de pointage sur un point unique de l’écran peuvent-elles faire l’objet d’une annulation (hors cas particuliers) ? | ❌ Manuel | — | — |
| 13.12 | Dans chaque page web, les fonctionnalités qui impliquent un mouvement de l’appareil ou vers l’appareil peuvent-elles être satisfaites de manière alternative (hors cas particuliers) ? | ❌ Manuel | — | — |

