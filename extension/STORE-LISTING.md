# Fiche Chrome Web Store — RGAA Audit 0.4.0

Textes prêts à coller dans le tableau de bord développeur. Ce fichier n'est pas inclus dans l'archive de l'extension.

## Onglet « Fiche Play Store » (Store listing)

**Nom** (repris du manifest) : RGAA Audit

**Résumé** (132 caractères au plus, repris du manifest) :
Pré-audit d’accessibilité RGAA 4.1.2 et vérification manuelle guidée — Le Singe Du Numérique

**Description** :

Vérifiez l’accessibilité d’une page web selon le RGAA, le référentiel français, en deux temps.

AUDIT AUTOMATIQUE (1 minute)
Un clic analyse la page affichée : contrastes réellement rendus à l’écran, textes des images, liens et boutons sans intitulé, structure des titres et des zones, formulaires, rôles ARIA, langue, titre de page… Chaque résultat indique le critère RGAA officiel, l’élément concerné (bouton « Voir » pour le retrouver dans la page) et une piste de correction. Les points incertains sont classés « à vérifier » plutôt que comptés comme des erreurs.

VÉRIFICATION GUIDÉE (15 à 20 minutes)
Trois critères sur quatre demandent un regard humain. Le panneau latéral vous pose les questions une par une, en langage clair, en vous montrant les éléments concernés dans la page :
• les textes des images affichés sous chaque image ;
• le plan des titres et les grandes zones de la page ;
• les intitulés des liens tels qu’un lecteur d’écran les annonce ;
• l’ordre de passage au clavier, numéroté ;
• la page en noir et blanc pour repérer l’information portée par la couleur seule.
Trois profils adaptent les questions : « Je découvre l’accessibilité », « J’ai l’habitude », « Je développe le site ».

RAPPORTS
Export en JSON, rapport HTML en langage clair à partager, sauvegarde et reprise de la vérification guidée par fichier.

RESPECT DE LA VIE PRIVÉE
Tout se passe dans votre navigateur : aucune donnée n’est collectée ni envoyée. L’extension n’agit que sur l’onglet où vous l’ouvrez, à votre demande.

Pré-audit : il aide à trouver et prioriser les corrections ; la conformité se confirme par un audit humain. Outil libre (licence MIT) développé par l’association Le Singe Du Numérique. Pour auditer plusieurs pages ou intégrer l’audit à une chaîne de déploiement, une version en ligne de commande est disponible : https://github.com/Stan69000/rgaa-audit

**Catégorie** : Outils pour les développeurs (ou « Accessibilité » si proposée)
**Langue** : français

**Captures d’écran** (1280 × 800, dans cet ordre) : `cli/store/` après `npm run store:screenshots`
1. `1-deux-parcours.png` — l’accueil de l’extension et ses deux parcours
2. `2-resultats.png` — les résultats de l’audit et l’invitation à la vérification guidée
3. `3-guide-images.png` — question sur les textes des images, cadres dans la page
4. `4-guide-titres.png` — plan des titres
5. `5-guide-clavier.png` — ordre de tabulation numéroté

**Site web** : https://stan69000.github.io/rgaa-audit/
**Assistance** : https://github.com/Stan69000/rgaa-audit/issues

## Onglet « Pratiques relatives à la confidentialité » (Privacy practices)

**Objectif unique** :
Aider à vérifier l’accessibilité d’une page web selon le référentiel RGAA, par un audit automatique et une vérification manuelle guidée.

**Justification des autorisations** :

- `activeTab` : L’audit et la vérification guidée analysent uniquement l’onglet sur lequel l’utilisateur a cliqué l’icône de l’extension, et seulement à sa demande.
- `scripting` : Injecte le moteur d’audit et les aides visuelles (encadrés, plan des titres, ordre de tabulation) dans l’onglet autorisé par l’utilisateur. Aucun script distant, aucune donnée envoyée.
- `sidePanel` : La vérification guidée s’affiche dans le panneau latéral pour rester visible à côté de la page pendant que l’utilisateur répond aux questions ; la fenêtre de l’extension se ferme dès qu’on clique dans la page. Le panneau n’accède à aucun contenu par lui-même.

**Code distant** : Non, je n’utilise pas de code distant.

**Utilisation des données** : ne cocher aucune catégorie (aucune donnée collectée), puis cocher les trois certifications :
- Je ne vends ni ne transfère les données des utilisateurs à des tiers en dehors des cas d’utilisation approuvés.
- Je n’utilise ni ne transfère les données des utilisateurs à des fins non liées à l’objectif unique de mon article.
- Je n’utilise ni ne transfère les données des utilisateurs pour déterminer leur solvabilité ou à des fins de prêt.

**Règles de confidentialité (URL)** : https://stan69000.github.io/rgaa-audit/privacy.html

## Onglet « Distribution »

Visibilité publique, toutes les régions. Aucun achat intégré.
