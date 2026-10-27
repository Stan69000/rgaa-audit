# Extension permissions policy

This Chrome extension follows a strict minimal-permissions policy.

- Allowed permissions are limited to:
  - `activeTab`
  - `scripting`
  - `sidePanel` (since 0.4.0, security review below)
- Do not add new permissions in `manifest.json` unless there is a documented, reviewed security need.
- Any future permission change must be justified in a dedicated security review note before release.

## Usage of the permitted APIs (0.3.0)

- `scripting.executeScript({ files: ['shared/rgaa-rules.js'] })` injects the audit engine into the active tab, only after the user clicks "Lancer l'audit".
- `scripting.executeScript({ func })` then runs the audit and returns the report to the panel, and highlights an element when the user clicks "Voir".
- No persistent content script, no host permissions, no network request: the report never leaves the browser.

## Security review: `sidePanel` (0.4.0)

**Need.** The guided manual check asks the user to look at the audited page while answering questions. The action popup closes as soon as the user clicks in the page, so the guide cannot live there. The side panel stays open next to the page.

**What the permission grants.** Only the ability to declare and open an extension page in Chrome's side panel (`side_panel.default_path`, `chrome.sidePanel.open`). It gives no access to page content, browsing history, tabs' URLs or the network, and Chrome shows no install-time warning for it.

**What does not change.** Page access still relies on `activeTab`: the guide can only read the tab after the user clicked the extension icon, and loses access when the tab navigates (the user clicks the icon again). No host permissions, no `storage`, no `tabs`, no remote code. Answers stay in memory and are saved only when the user exports a file.

**Alternatives considered.** A guide in a separate extension tab needs no extra permission but forces the user to switch tabs for every question, which breaks the "look then answer" flow and is especially hard for keyboard and screen reader users.

## Chrome Web Store justifications (copy into the developer dashboard)

- **activeTab** : « L’audit et la vérification guidée analysent uniquement l’onglet sur lequel l’utilisateur a cliqué l’icône de l’extension, et seulement à sa demande. »
- **scripting** : « Injecte le moteur d’audit et les aides visuelles (encadrés, plan des titres, ordre de tabulation) dans l’onglet autorisé par l’utilisateur. Aucun script distant, aucune donnée envoyée. »
- **sidePanel** : « La vérification guidée s’affiche dans le panneau latéral pour rester visible à côté de la page pendant que l’utilisateur répond aux questions ; la fenêtre de l’extension se ferme dès qu’on clique dans la page. Le panneau n’accède à aucun contenu par lui-même. »
- **Usage unique (single purpose)** : « Aider à vérifier l’accessibilité d’une page web selon le référentiel RGAA, par un audit automatique et une vérification manuelle guidée. »
- **Données utilisateur** : « Aucune donnée n’est collectée ni transmise. Les résultats restent dans le navigateur ; l’utilisateur peut les exporter dans un fichier. »
