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

A single Key Vault per deployment environment (`Main-Gov`, `Develop`) holds all configuration and secrets for that environment. Each workflow's federated identity is granted Key Vault Secrets User access only to the specific secrets it requires, enforced via Azure RBAC. This provides per-workflow least privilege without any additional GitHub infrastructure.

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

Each GitHub environment maps to one Azure federated credential on a dedicated app registration. App registrations are scoped to the minimum Azure RBAC roles required for that workflow's work.

### Key Vault Migration

All Azure resource names, configuration values, and application secrets currently stored in GitHub environment secrets and variables are migrated to the Azure Key Vault for each environment. Each workflow's federated identity is granted Key Vault Secrets User access to only the secrets it needs.

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
- Each workflow's Azure access is bounded to the duration of the run and scoped to its minimum required permissions
- GitHub environments contain no secrets or variables; all environment-specific configuration lives in Azure Key Vault
- Adding a new workflow that requires Azure access requires: creating a GitHub environment (no values), creating an Azure app registration with a federated credential, and granting Key Vault Secrets User access to the specific secrets needed
- The `PGP_SIGNING_PASSPHRASE` encrypted-input pattern is no longer needed once Key Vault migration is complete
- Non-deployment workflows (security scan, DAST) that previously had no GitHub environment can now be given stable OIDC subjects without branch constraints
