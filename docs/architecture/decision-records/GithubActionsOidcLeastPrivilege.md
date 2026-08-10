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

### GitHub Environment Naming Convention

Each reusable workflow that requires Azure access is assigned a dedicated GitHub environment. Environment names follow the convention `<workflow-purpose>-<target>` where target is `main` for production and `branch` for non-production:

| Reusable Workflow | GitHub Environment |
|---|---|
| `reusable-deploy.yml` | `deploy-main`, `deploy-branch` |
| `reusable-infrastructure-deploy.yml` | `infrastructure-deploy-main`, `infrastructure-deploy-branch` |
| `reusable-deploy-code.yml` | `deploy-code-main`, `deploy-code-branch` |
| `reusable-build-info.yml` | `build-info-main`, `build-info-branch` |
| `reusable-build-frontend.yml` | `build-frontend-main`, `build-frontend-branch` |
| `reusable-e2e.yml` | `e2e-main`, `e2e-branch` |
| `reusable-dast.yml` | `dast-main`, `dast-branch` |
| `reusable-endpoint-test.yml` | `endpoint-test-main`, `endpoint-test-branch` |
| `sub-security-scan.yml` | `security-scan` |
| `azure-remove-branch.yml` | `remove-branch` |

These GitHub environments hold **no secrets or variables**. Their sole purpose is to produce a stable, branch-independent OIDC subject.

### Azure Federated Credentials

Each GitHub environment maps to one Azure federated credential on a dedicated app registration. Least privilege is expressed primarily through **role choice** rather than assignment scope: with the single exception of `security-scan`, every identity's primary role is assigned at subscription scope, and the bound on what it can do comes from how narrow that role is.

| Identity | Primary role | Scope |
|---|---|---|
| `build-frontend-*`, `build-info-*` | Reader | Subscription |
| `deploy-code-*`, `endpoint-test-*` | Website Contributor | Subscription |
| `dast-*` | Website Contributor, SQL Server Contributor | Subscription |
| `deploy-*`, `infrastructure-deploy-*`, `e2e-*`, `remove-branch` | Contributor | Subscription |
| `security-scan` | Storage Blob Data Contributor | Storage account |

Every identity additionally holds Key Vault Secrets User on each **individual secret** it reads, never at vault scope. Many secrets are deliberately shared across identities — `AZ-APP-RG` is granted to eight of the ten, `SLOT-NAME` to six — so this does not isolate workflows from one another. What it bounds is the tail: an identity can read only the secrets it was explicitly granted, not the rest of the vault.

Subscription-scope assignment is broader than ideal and is a deliberate, temporary tradeoff. Resource-group-scoped grants are incompatible with branch deployments, whose resource groups are created per-commit-hash at deploy time and so cannot be pre-scoped — Azure RBAC has no wildcard scoping. Rather than diverge main (static resource groups, scopable) from branch (dynamic, not scopable), both environments use the same subscription-scope grant. Narrowing this requires first deciding the branch approach, and is deferred to a focused follow-up.

### Role Assignments Created by Bicep

Contributor does not include `Microsoft.Authorization/roleAssignments/write`. Any Bicep module that creates a role assignment therefore requires the identity deploying it to hold that permission **at the scope of the assignment being created**, granted separately from Contributor.

Today that is the custom role `CAMS KV Role Assignment Operator`, held by the deploy identities on the Key Vault *resource* — deliberately narrower than User Access Administrator, and narrower than the resource group, to limit privilege-escalation surface. A Bicep module that creates a role assignment at any **other** scope will fail at deploy time until the deploy identity is granted `roleAssignments/write` there as well. This failure surfaces only during deployment; nothing at commit time detects it.

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
- Each workflow's Azure access is bounded to the duration of the run and to the narrowest Azure role that covers its work; most roles are assigned at subscription scope, so the bound is the role, not the scope
- GitHub environments contain no secrets or variables; all environment-specific configuration lives in Azure Key Vault
- Two Key Vaults are maintained (main and branch) with identical secret names; any change to a vault secret is a two-step operation — update main vault, then branch vault
- A compromise of one vault cannot affect the other environment
- Adding a new workflow that requires Azure access requires: creating a GitHub environment (no values), creating an Azure app registration with a federated credential, granting the narrowest Azure role that covers its work, and granting Key Vault Secrets User access to the specific secrets needed in each vault
- Adding a Bicep module that creates a role assignment additionally requires granting the deploying identity `roleAssignments/write` at that assignment's scope; omitting it fails at deploy time with no earlier signal
- The `PGP_SIGNING_PASSPHRASE` encrypted-input pattern is no longer needed once Key Vault migration is complete
- Non-deployment workflows (security scan, DAST) that previously had no GitHub environment can now be given stable OIDC subjects without branch constraints
