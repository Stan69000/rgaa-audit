# Extension permissions policy

This Chrome extension follows a strict minimal-permissions policy.

- Allowed permissions are limited to:
  - `activeTab`
  - `scripting`
- Do not add new permissions in `manifest.json` unless there is a documented, reviewed security need.
- Any future permission change must be justified in a dedicated security review note before release.

## Usage of the permitted APIs (0.3.0)

- `scripting.executeScript({ files: ['shared/rgaa-rules.js'] })` injects the audit engine into the active tab, only after the user clicks "Lancer l'audit".
- `scripting.executeScript({ func })` then runs the audit and returns the report to the panel, and highlights an element when the user clicks "Voir".
- No persistent content script, no host permissions, no network request: the report never leaves the browser.
