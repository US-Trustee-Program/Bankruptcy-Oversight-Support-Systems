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

Each reusable workflow that requires Azure access is assigned a dedicated GitHub environment. Environment names follow the convention `<workflow-purpose>-<target>` where target is `main` for production and `branch` for non-production. Which workflow uses which environment is listed in the [OIDC identity inventory](../../../ops/scripts/utility/federated-credentials/README.md).

These GitHub environments hold **no variables and exactly one secret**: `AZ_CLIENT_ID`, the client ID of the app registration that environment's federated credential is attached to. It must live at environment scope precisely because it differs per environment — that is what makes the environment an OIDC anchor. Everything shared across environments (`AZ_TENANT_ID`, `AZ_SUBSCRIPTION_ID`, `AZURE_ENVIRONMENT`) stays at repository scope. `security-scan` is the exception: its environment holds nothing, and its workflows read the repository-level `AZ_SECURITY_SCAN_CLIENT_ID` instead.

### Azure Federated Credentials

Each GitHub environment maps to one Azure federated credential on a dedicated app registration. Least privilege is expressed primarily through **role choice**: each identity gets the narrowest Azure role that covers its workflow's work, and where no built-in role is narrow enough, a custom role holding only the needed actions is preferred over a broader built-in. For example, deploying or deleting an Azure Deployment Stack created with `--deny-settings-mode denyDelete` requires `Microsoft.Resources/deploymentStacks/manageDenySetting/action`, which belongs to neither Contributor nor the built-in Deployment Stack Contributor role — only to Deployment Stack Owner, which is far broader — so a custom role grants that one action instead.

Assignment scope is narrowed where a stable scope exists. Azure RBAC has no wildcard scoping, so an identity whose targets are named at deploy time can only be pre-granted at a scope that already exists, which may be the subscription. Subscription-scope assignment is broader than ideal and remains a deliberate tradeoff for each identity that still carries it; for those identities the bound on what they can do comes from how narrow the role is. Scoping to a resource group is a real reduction, but Contributor there still carries delete rights over everything else in that group, so resource-group scope is not the floor.

Every identity additionally holds Key Vault Secrets User on each **individual secret** it reads, never at vault scope. Many secrets are deliberately shared across identities, so this does not isolate workflows from one another. What it bounds is the tail: an identity can read only the secrets it was explicitly granted, not the rest of the vault.

Grants are made by the federated-credential runbooks under `ops/scripts/utility/federated-credentials/`, which only grant and never revoke. Azure RBAC is additive across scopes, so narrowing an identity's scope has no effect until the broader grant is revoked, and revocation is necessarily a manual, out-of-band procedure — grant, revoke, verify, roll back if needed — because the narrower scope's sufficiency cannot be verified while the broad grant is still in place.

The current identities, their roles and scopes, grants made outside the runbooks, and open narrowing work are listed in the [OIDC identity inventory](../../../ops/scripts/utility/federated-credentials/README.md). The runbooks are the source of truth for actual grants.

### Role Assignments Created by Bicep

Contributor does not include `Microsoft.Authorization/roleAssignments/write`. Any Bicep module that creates a role assignment therefore requires the identity deploying it to hold that permission **at the scope of the assignment being created**, granted separately from Contributor.

That permission is granted through a custom role holding only the role-assignment actions, assigned on the exact *resource* the Bicep assignment targets — deliberately narrower than User Access Administrator, and narrower than the resource group, to limit privilege-escalation surface. A Bicep module that creates a role assignment at any **other** scope will fail at deploy time until the deploy identity is granted `roleAssignments/write` there as well. This failure surfaces only during deployment; nothing at commit time detects it. This is the intended pattern; any broader role-assignment grant an identity holds outside it is an exception until revoked, and is listed in the [OIDC identity inventory](../../../ops/scripts/utility/federated-credentials/README.md).

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
- Each workflow's Azure access is bounded to the duration of the run and to the narrowest Azure role that covers its work; where that role is assigned at subscription scope, the bound is the role, not the scope
- Narrowing an existing identity's scope is a two-part operation, and only the first part can be automated: the runbooks grant but never revoke, so a narrowed grant has no effect until the broader one is revoked manually. Until that revocation lands, the runbook's scope is a statement of intent, not of effective privilege
- GitHub environments contain no secrets or variables; all environment-specific configuration lives in Azure Key Vault
- Two Key Vaults are maintained (main and branch) with identical secret names; any change to a vault secret is a two-step operation — update main vault, then branch vault
- A compromise of one vault cannot affect the other environment
- Adding a new workflow that requires Azure access requires: creating a GitHub environment (no values), creating an Azure app registration with a federated credential, granting the narrowest Azure role that covers its work, and granting Key Vault Secrets User access to the specific secrets needed in each vault
- Adding a Bicep module that creates a role assignment additionally requires granting the deploying identity `roleAssignments/write` at that assignment's scope; omitting it fails at deploy time with no earlier signal
- The `PGP_SIGNING_PASSPHRASE` encrypted-input pattern is no longer needed once Key Vault migration is complete
- Non-deployment workflows (security scan, DAST) that previously had no GitHub environment can now be given stable OIDC subjects without branch constraints
- The subject customization applies repository-wide, so it reaches OIDC consumers unrelated to Azure. `id-token: write` becomes a permission to grant deliberately rather than defensively: a job that holds it without declaring an `environment:` does not produce a subject matching the template, and granting it to a job that never exchanges a token widens the blast radius of any action running in that job for no benefit
