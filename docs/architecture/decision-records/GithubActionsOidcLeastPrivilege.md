# GitHub Actions OIDC Least Privilege

## Context

GitHub Actions workflows authenticate to Azure using a long-lived `AZURE_CREDENTIALS` secret (a service principal JSON blob with broad Contributor access). This pattern has several problems:

- Long-lived credentials are exfiltrable and cannot be automatically rotated
- A single credential is shared across workflows with different access needs, violating least privilege
- Environment-scoped GitHub secrets duplicate large numbers of Azure resource names and configuration values across `Main-Gov` and `Develop` environments, creating maintenance burden

GitHub supports OIDC Workload Identity Federation as an alternative: workflows exchange a short-lived GitHub-issued JWT for an Azure access token with no stored secrets. The access is bounded to the duration of the workflow run.

### Subject Claim Constraints

GitHub's OIDC token includes a `sub` (subject) claim that Azure uses to match a federated credential. The default subject format includes the git branch:

```
repo:ORG/REPO:ref:refs/heads/BRANCH-NAME
```

This makes it impossible to configure a single federated credential that works from any branch without granting access to all branches via `repo:ORG/REPO` — which is too broad for least privilege.

GitHub allows customizing which claims compose the subject via the REST API (`PUT /repos/{owner}/{repo}/actions/oidc/customization/sub`). After evaluating available claims:

- `workflow` — resolves to the **caller** workflow name (e.g., `Continuous Deployment`), not the reusable workflow, so it cannot distinguish `reusable-deploy.yml` from `reusable-infrastructure-deploy.yml`
- `job_workflow_ref` — contains the reusable workflow file path but always includes the branch suffix (`@refs/heads/BRANCH-NAME`), so it is still branch-specific
- `environment` — branch-independent and per-job; this is the only available claim that is both stable across branches and granular enough for per-workflow least privilege

### GitHub Environment as an OIDC Anchor

A GitHub environment (`environment:` on a job) affects the OIDC subject:

```
repo:ORG/REPO:environment:ENV-NAME
```

Environments are currently used to scope secrets and variables to `Main-Gov` and `Develop`. However, secrets and variables in GitHub environments are only necessary because there is no post-login mechanism to retrieve them. Once a workflow can authenticate via OIDC, configuration can be fetched from Azure Key Vault at runtime, eliminating the need to store anything in GitHub environments.

With secrets and variables moved to Key Vault, GitHub environments become lightweight OIDC anchors — just a name, no stored values.

### Key Vault RBAC for Per-Workflow Least Privilege

Each workflow's federated identity is granted Key Vault Secrets User access only to the specific secrets it requires, enforced via Azure RBAC. This provides per-workflow least privilege without any additional GitHub infrastructure.

### Key Vault Structure

Three approaches were considered for organizing Key Vaults:

1. **One vault per environment + one shared vault**: Each federated identity accesses two vaults — a shared vault for common values and an environment-specific vault. Adds complexity to every workflow (two vault lookups) and doesn't clearly bound blast radius.

2. **Single vault with prefixed secret names**: One vault containing `MAIN_SLOT_NAME`, `DEVELOP_SLOT_NAME`, etc. Workflows must contain branching logic to select the right secret. Couples environment concerns into workflow code and makes RBAC scoping harder.

3. **Two vaults, one per environment (main, branch)**: Each federated identity accesses exactly one vault — the one that matches its environment. All secrets use identical names across both vaults. No workflow branching logic needed.

Option 3 is chosen. The `deploy-main` identity accesses the main vault; `deploy-branch` accesses the develop vault. Values that differ between environments naturally have different values in each vault. Values that are the same are duplicated — a deliberate tradeoff accepted because vault changes are rare and deliberate, the CI/CD code remains simple, and a compromise of one vault cannot affect the other.

## Decision

We will migrate all GitHub Actions Azure authentication to OIDC Workload Identity Federation using the following architecture:

### OIDC Subject Template

The repository OIDC customization template is set to include `repo`, `workflow`, and `environment` claims:

```json
{ "include_claim_keys": ["repo", "workflow", "environment"] }
```

This produces subjects of the form:

```
repo:US-Trustee-Program/Bankruptcy-Oversight-Support-Systems:workflow:Continuous Deployment:environment:ENV-NAME
```

This setting is **repository-wide**, and that has a consequence beyond Azure. It shapes the subject of every OIDC token the repository issues, including tokens for consumers that have nothing to do with Azure federated credentials. GitHub Pages deployment via `actions/deploy-pages` is the current second consumer.

Because the template expects an `environment` claim, `id-token: write` should be granted only to jobs that actually exchange a token *and* declare an `environment:`. A job holding the permission without an environment does not produce the subject shape this template describes. This is not hypothetical: the Pages workflow's `build` job carried `id-token: write` without an environment and broke Pages deployment until the permission was removed (GH #2809).

### GitHub Environment Naming Convention

Each reusable workflow that requires Azure access is assigned a dedicated GitHub environment. Environment names follow the convention `<workflow-purpose>-<target>` where target is `main` for production and `branch` for non-production:

| Reusable Workflow | GitHub Environment |
|---|---|
| `reusable-deploy.yml` | `deploy-main`, `deploy-branch` |
| `reusable-infrastructure-deploy.yml` | `infrastructure-deploy-main`, `infrastructure-deploy-branch` |
| `sub-deploy-code.yml`, `sub-deploy-code-slot.yml` | `deploy-code-main`, `deploy-code-branch` |
| `reusable-build-info.yml` | `build-info-main`, `build-info-branch` |
| `reusable-build-frontend.yml` | `build-frontend-main`, `build-frontend-branch` |
| `reusable-e2e.yml` | `e2e-main`, `e2e-branch` |
| `reusable-dast.yml` | `dast-main`, `dast-branch` |
| `reusable-endpoint-test.yml` | `endpoint-test-main`, `endpoint-test-branch` |
| `sub-security-scan.yml`, `deploy-security-scan-storage.yml` | `security-scan` |
| `azure-remove-branch.yml` | `remove-branch` |

These GitHub environments hold **no variables and exactly one secret**: `AZ_CLIENT_ID`, the client ID of the app registration that environment's federated credential is attached to. It must live at environment scope precisely because it differs per environment — that is what makes the environment an OIDC anchor. Everything shared across environments (`AZ_TENANT_ID`, `AZ_SUBSCRIPTION_ID`, `AZURE_ENVIRONMENT`) stays at repository scope, and `security-scan` holds nothing at all, reading the repository-level `AZ_SECURITY_SCAN_CLIENT_ID` instead.

This is distinct from the legacy `Main-Gov` and `Develop` environments, which still carry the full set of resource names and connection strings pending completion of the Key Vault migration.

### Azure Federated Credentials

Each GitHub environment maps to one Azure federated credential on a dedicated app registration. Least privilege is expressed primarily through **role choice** rather than assignment scope: with the exceptions of `security-scan` and `deploy-branch`, every identity's primary role is assigned at subscription scope, and the bound on what it can do comes from how narrow that role is.

| Identity | Primary role | Scope |
|---|---|---|
| `build-frontend-*`, `build-info-*` | Reader | Subscription |
| `deploy-code-*`, `endpoint-test-*` | Website Contributor | Subscription |
| `dast-*` | Website Contributor, SQL Server Contributor | Subscription |
| `deploy-main`, `infrastructure-deploy-*`, `e2e-*`, `remove-branch` | Contributor | Subscription |
| `deploy-branch` | Contributor | Four resource groups: `rg-cams-app-dev`, `rg-cams-network-dev`, `rg-analytics`, `bankruptcy-oversight-support-systems` |
| `security-scan` | Storage Blob Data Contributor | Storage account |

Every identity additionally holds Key Vault Secrets User on each **individual secret** it reads, never at vault scope. Many secrets are deliberately shared across identities — `AZ-APP-RG` is granted to eight of the ten, `SLOT-NAME` to six — so this does not isolate workflows from one another. What it bounds is the tail: an identity can read only the secrets it was explicitly granted, not the rest of the vault.

Subscription-scope assignment is broader than ideal and remains a deliberate, temporary tradeoff for every identity above that still carries it.

When this decision was first recorded, resource-group-scoped grants were genuinely incompatible with branch deployments: branch resource groups were created per-commit-hash at deploy time, and Azure RBAC has no wildcard scoping, so there was no stable scope to pre-grant. Rather than diverge main (static resource groups, scopable) from branch (dynamic, not scopable), both environments used the same subscription-scope grant, and narrowing was deferred to a focused follow-up.

That constraint has since been removed. PR #2773 co-located branch deploys onto stable, statically-named resource groups — `rg-cams-app-dev` and `rg-cams-network-dev` — with per-branch isolation now expressed through per-branch-unique *resource* names rather than a per-branch resource group. PR #2803 is the deferred follow-up: it narrows `deploy-branch` to Contributor on four named resource groups, a strict subset of what main's own grant already covers. Two are the stable app and network groups. The other two — `rg-analytics` and `bankruptcy-oversight-support-systems` — were never per-branch and are shared with main, but every branch deploy writes into them (the branch-only Log Analytics Workspace deploy, and the shared app-config Key Vault and managed-identity setup that runs on every deploy). They are part of the narrowed grant because omitting them would break those steps the moment the broad grant is withdrawn. That inventory came from a static trace of every `az` call the `deploy-branch` identity makes across a branch deploy, not from inspection of the roles it happened to hold.

Alongside Contributor, `deploy-branch` holds two narrowly scoped custom roles in preference to broader built-ins: `CAMS KV Role Assignment Operator` on the Key Vault resource (see below), and `CAMS Deployment Stack Deny Setting Operator` on the app and network resource groups. The latter exists because both branch deploys are Azure Deployment Stacks created with `--deny-settings-mode denyDelete`, and `Microsoft.Resources/deploymentStacks/manageDenySetting/action` belongs to neither Contributor nor the built-in Deployment Stack Contributor role — only to Deployment Stack Owner, which is far broader. `remove-branch` holds the same custom role at the same two resource-group scopes, for the symmetric reason: deleting a stack created with `denyDelete` requires `manageDenySetting` just as creating it does.

`deploy-main` keeps subscription-scope Contributor deliberately. Main is the path that genuinely creates resource groups, so there is no narrower scope that covers its work today. Narrowing main is separate future work (cams-y8s2).

**Least privilege has not yet been reached for `deploy-branch`.** Azure RBAC is additive across scopes, so the resource-group grants above are, on their own, a no-op for permission checking: the identity still holds its original subscription-scope Contributor, and until that is revoked the narrower grants change nothing. Revocation is necessarily a manual, out-of-band procedure — grant, revoke, verify, roll back if needed — because the narrower scope's sufficiency cannot be verified while the broad grant is still in place. It is tracked separately (cams-v4ngd). Three further standing grants on `deploy-branch` are also outstanding:

- `User Access Administrator`, scoped to the `bankruptcy-oversight-support-systems` resource group (not the subscription). Superseded by `CAMS KV Role Assignment Operator`; to be revoked.
- `CAMS Deploy Subscription Role`, a custom role at subscription scope (`Microsoft.Resources/deployments/*`, `subscriptions/resourceGroups/read`, `subscriptions/resourceGroups/write`). It is residue of an earlier, abandoned per-resource-group RBAC design, is defined only in live Azure, and is referenced nowhere in this repository; to be revoked.
- `Role Based Access Control Administrator`, scoped to `rg-analytics`. Granted out of band and currently **load-bearing** — it must not be revoked until a narrower replacement grant is in place. Its provenance is untraced (cams-y8s2).

### Role Assignments Created by Bicep

Contributor does not include `Microsoft.Authorization/roleAssignments/write`. Any Bicep module that creates a role assignment therefore requires the identity deploying it to hold that permission **at the scope of the assignment being created**, granted separately from Contributor.

Today that is the custom role `CAMS KV Role Assignment Operator`, held by the deploy identities on the Key Vault *resource* — deliberately narrower than User Access Administrator, and narrower than the resource group, to limit privilege-escalation surface. A Bicep module that creates a role assignment at any **other** scope will fail at deploy time until the deploy identity is granted `roleAssignments/write` there as well. This failure surfaces only during deployment; nothing at commit time detects it.

That pattern is not held to everywhere yet: `deploy-branch` also carries `Role Based Access Control Administrator` on `rg-analytics`, granted out of band rather than through this pattern, and it is currently load-bearing. Replacing it with a role as narrow as the Key Vault one is outstanding work (see above).

Which side owns the grant depends on whose identity it is for:

- Grants **to the function apps' managed identity** are authored in Bicep and gated on `!isUstpDeployment`, because the USTP ADO service principal cannot create role assignments — the USTP EA team provisions those separately on request.
- Grants **to a CI/CD deploy identity** are authored in the federated-credential runbooks under `ops/scripts/utility/federated-credentials/`, never in Bicep.

### Key Vault Migration

All Azure resource names, configuration values, and application secrets currently stored in GitHub environment secrets and variables are migrated to the two Key Vaults (main and branch). Secret names are identical across both vaults. Each workflow's federated identity is granted Key Vault Secrets User access to only the secrets it needs within its vault.

This infrastructure is a Flexion CI/CD concern only — it has no bearing on USTP environments or the USTP deployment pipeline. The Key Vaults and associated app registrations must be provisioned and managed via Bicep templates that are separate from the main CAMS Bicep module, so they are never inadvertently deployed to USTP.

Secrets that must remain in GitHub Actions (no Azure dependency):

| Secret | Reason |
|---|---|
| `GITHUB_TOKEN` | Auto-provided by GitHub, cannot be stored externally |
| `BOT_PRIVATE_KEY` / `BOT_PASSPHRASE` | Required for git signing before Azure login |
| `SNYK_OAUTH_CLIENT_ID` / `SNYK_OAUTH_CLIENT_SECRET` | External service, not Azure |
| `SLACK_WEBHOOK_URL` / `SLACK_USER_MAPPING` | External service, not Azure |

### PGP Encrypted Inputs

The `PGP_SIGNING_PASSPHRASE` pattern (encrypting resource group names passed as workflow inputs to avoid log exposure) is eliminated. Resource names are fetched from Key Vault after login and are never passed as inputs.

## Status

Accepted

## Consequences

- Long-lived `AZURE_CREDENTIALS` secrets are eliminated from all workflows
- Each workflow's Azure access is bounded to the duration of the run and to the narrowest Azure role that covers its work; most roles are still assigned at subscription scope, so for those identities the bound is the role, not the scope. `security-scan` is bounded by scope as well, and `deploy-branch`'s Contributor grant is now written against four named resource groups rather than the subscription
- Narrowing an existing identity's scope is a two-part operation, and only the first part can be automated: the runbooks grant but never revoke, so a narrowed grant has no effect until the broader one is revoked manually. Until that revocation lands, the runbook's scope is a statement of intent, not of effective privilege
- GitHub environments contain no secrets or variables; all environment-specific configuration lives in Azure Key Vault
- Two Key Vaults are maintained (main and branch) with identical secret names; any change to a vault secret is a two-step operation — update main vault, then branch vault
- A compromise of one vault cannot affect the other environment
- Adding a new workflow that requires Azure access requires: creating a GitHub environment (no values), creating an Azure app registration with a federated credential, granting the narrowest Azure role that covers its work, and granting Key Vault Secrets User access to the specific secrets needed in each vault
- Adding a Bicep module that creates a role assignment additionally requires granting the deploying identity `roleAssignments/write` at that assignment's scope; omitting it fails at deploy time with no earlier signal
- The `PGP_SIGNING_PASSPHRASE` encrypted-input pattern is no longer needed once Key Vault migration is complete
- Non-deployment workflows (security scan, DAST) that previously had no GitHub environment can now be given stable OIDC subjects without branch constraints
- The subject customization applies repository-wide, so it reaches OIDC consumers unrelated to Azure. `id-token: write` becomes a permission to grant deliberately rather than defensively: a job that holds it without declaring an `environment:` does not produce a subject matching the template, and granting it to a job that never exchanges a token widens the blast radius of any action running in that job for no benefit
