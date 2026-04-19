# Extension permissions policy

This Chrome extension follows a strict minimal-permissions policy.

- Allowed permissions are limited to:
  - `activeTab`
  - `scripting`
- Do not add new permissions in `manifest.json` unless there is a documented, reviewed security need.
- Any future permission change must be justified in a dedicated security review note before release.
