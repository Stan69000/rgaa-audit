# Politique de confidentialité – RGAA Audit

Date de mise à jour : 27 octobre 2026 (version 0.4.0 de l'extension)

## 1. Collecte des données

L'extension RGAA Audit ne collecte aucune donnée personnelle.

Aucune information permettant d'identifier un utilisateur (nom, email, adresse, etc.) n'est collectée, stockée ou transmise.

## 2. Traitement des données

Toutes les analyses réalisées par l'extension sont effectuées localement dans le navigateur de l'utilisateur.

Cela signifie que :

- aucune donnée n'est envoyée à un serveur externe ;
- aucune donnée n'est stockée à distance ;
- aucune donnée n'est partagée avec des tiers.

## 3. Utilisation des autorisations

L'extension utilise uniquement les autorisations suivantes :

- `activeTab` : permet d'accéder temporairement à la page active, après un clic de l'utilisateur sur l'icône de l'extension, afin d'effectuer un audit d'accessibilité ou une vérification guidée. L'accès prend fin quand l'onglet change de page ;
- `scripting` : permet d'exécuter, dans cette page uniquement, les scripts de l'extension qui analysent sa structure et affichent les aides visuelles de la vérification guidée (cadres, plan des titres, ordre de tabulation) ;
- `sidePanel` : permet d'afficher la vérification guidée dans le panneau latéral du navigateur, à côté de la page. Cette autorisation ne donne accès à aucun contenu.

Ces autorisations sont utilisées uniquement lorsque l'utilisateur lance un audit ou une vérification guidée. L'extension ne demande aucun accès permanent aux sites (pas de « host permissions ») et n'exécute aucun code distant.

## 3 bis. Fichiers exportés et importés

L'utilisateur peut exporter un rapport (JSON ou HTML) ou une session de vérification guidée (JSON), et réimporter une session. Ces fichiers sont créés sur son ordinateur, à sa demande ; ils ne sont envoyés nulle part. Ils contiennent les résultats de l'audit, les réponses et notes saisies, et des extraits du code de la page auditée (balises, textes alternatifs, intitulés). Ils ne contiennent pas les valeurs saisies dans les formulaires de la page.

L'extension n'utilise pas le stockage du navigateur : les réponses en cours sont conservées en mémoire tant que le panneau est ouvert.

## 4. Services tiers

L'extension n'utilise aucun service tiers, outil de tracking ou solution d'analyse.

## 5. Sécurité

Aucune donnée n'étant collectée ni transmise, les risques liés à la sécurité des données sont inexistants.

## 6. Évolution

Cette politique de confidentialité peut être mise à jour en cas d'évolution de l'extension.

## 7. Contact

Pour toute question :

- https://stan69000.github.io/rgaa-audit/
