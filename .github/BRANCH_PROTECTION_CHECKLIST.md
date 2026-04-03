# Branch Protection Checklist

Configurer ces regles dans GitHub > Settings > Branches pour `main`.

## Regles recommandees

- Require a pull request before merging: **ON**
- Require approvals: **1 minimum**
- Dismiss stale pull request approvals when new commits are pushed: **ON**
- Require status checks to pass before merging: **ON**
- Require branches to be up to date before merging: **ON**
- Require conversation resolution before merging: **ON**
- Restrict who can push to matching branches: **ON** (maintainers only)
- Do not allow bypassing the above settings: **ON**

## Checks a rendre obligatoires

- `Lint`
- `Tests regles RGAA`
- `npm audit (cli)`

## Optionnel recommande

- Include administrators: **ON**
- Require signed commits: **ON**
