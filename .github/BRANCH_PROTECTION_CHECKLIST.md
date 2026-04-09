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
- `Dependency review (PR)`
- `CodeQL (JavaScript)`
- `Secret scan (gitleaks)`
- `PR smoke audit (local fixture)`

## Auto-merge Dependabot (safe only)

- Activer `Allow auto-merge` dans le repository
- Garder les checks obligatoires ci-dessus pour que l'auto-merge ne passe que si tout est vert
- Le workflow `Dependabot auto-merge (safe updates)` n'active l'auto-merge que pour les mises a jour `patch` et `minor`

## Rollback de prod (GitHub Pages)

- Workflow disponible: `Rollback GitHub Pages`
- En cas de regression, redeployer un `tag` ou un `commit SHA` stable via `workflow_dispatch`

## WAF (one-shot hors repo)

- Mettre le domaine derriere un WAF manage (Cloudflare/AWS WAF)
- Activer managed rules + rate limiting + bot protection

## Optionnel recommande

- Include administrators: **ON**
- Require signed commits: **ON**
