# GitHub Actions OIDC Identities

Inventory of the Azure identities GitHub Actions workflows sign in as, what each one holds, and the
grant work still open. The decision behind this layout is recorded in
[GitHub Actions OIDC Least Privilege](../../../../docs/architecture/decision-records/GithubActionsOidcLeastPrivilege.md).

The runbooks in this directory are the source of truth for what each identity is granted. Update
this page in the same PR that adds a runbook or changes a grant.

## Provisioning

Run `setup-all-federated-credentials.sh` to provision every identity, or one
`setup-*-federated-credential.sh` runbook to provision one. Each runbook lists its required
environment variables in its header. The runbooks only grant: none of them revokes a role, so
narrowing an identity requires a manual revoke (see [Revocations](#revocations)).

`audit-deploy-identity-grants.sh` compares the deploy identities' live role assignments with what
the runbooks expect, and lists grants that should be revoked or must be kept.

## Workflows and GitHub environments

| Workflow                                                    | GitHub environment                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| `reusable-deploy.yml`                                       | `deploy-main`, `deploy-branch`                               |
| `reusable-infrastructure-deploy.yml`                        | `infrastructure-deploy-main`, `infrastructure-deploy-branch` |
| `deploy-sql-hub.yml`                                        | `infrastructure-deploy-main`                                 |
| `sub-deploy-code.yml`, `sub-deploy-code-slot.yml`           | `deploy-code-main`, `deploy-code-branch`                     |
| `reusable-build-info.yml`                                   | `build-info-main`, `build-info-branch`                       |
| `reusable-build-frontend.yml`                               | `build-frontend-main`, `build-frontend-branch`               |
| `reusable-e2e.yml`                                          | `e2e-main`, `e2e-branch`                                     |
| `reusable-dast.yml`                                         | `dast-main`, `dast-branch`                                   |
| `reusable-endpoint-test.yml`                                | `endpoint-test-main`, `endpoint-test-branch`                 |
| `sub-security-scan.yml`, `deploy-security-scan-storage.yml` | `security-scan`                                              |
| `azure-remove-branch.yml`                                   | `remove-branch`                                              |

Reusable workflows pick `*-main` when called for `Main-Gov` and `*-branch` otherwise.

`deploy-sql-hub.yml` uses the `cams-infrastructure-deploy-main-oidc` app registration through its
own federated credential. That credential is created by hand, not by a runbook; see
[SQL Private Link Hub](../../../../docs/operations/deployment.md#identity-and-permissions).

Each runbook stores the identity's client ID as the `AZ_CLIENT_ID` secret in its GitHub environment,
except `security-scan`: its runbook sets the repository secret `AZ_SECURITY_SCAN_CLIENT_ID`, which
both security-scan workflows read. `deploy-security-scan-storage.yml` also reads the repository
secrets `AZ_SECURITY_SCAN_RG` and `AZ_SECURITY_SCAN_STORAGE_NAME`.

## Identities and roles

| GitHub environment        | App registration                                | Runbook                                               | Primary role                                | Scope                                                                                                            |
| ------------------------- | ----------------------------------------------- | ----------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `build-frontend-*`        | `cams-build-frontend-{main,branch}-oidc`        | `setup-build-frontend-federated-credential.sh`        | Reader                                      | Subscription                                                                                                     |
| `build-info-*`            | `cams-build-info-{main,branch}-oidc`            | `setup-build-info-federated-credential.sh`            | Reader                                      | Subscription                                                                                                     |
| `deploy-code-*`           | `cams-deploy-code-{main,branch}-oidc`           | `setup-deploy-code-federated-credential.sh`           | Website Contributor                         | Subscription                                                                                                     |
| `endpoint-test-*`         | `cams-endpoint-test-{main,branch}-oidc`         | `setup-endpoint-test-federated-credential.sh`         | Website Contributor                         | Subscription                                                                                                     |
| `dast-*`                  | `cams-dast-{main,branch}-oidc`                  | `setup-dast-federated-credential.sh`                  | Website Contributor, SQL Server Contributor | Subscription                                                                                                     |
| `deploy-main`             | `cams-deploy-main-oidc`                         | `setup-deploy-federated-credential.sh`                | Contributor                                 | Subscription                                                                                                     |
| `deploy-branch`           | `cams-deploy-branch-oidc`                       | `setup-deploy-federated-credential.sh`                | Contributor                                 | Resource groups `rg-cams-app-dev`, `rg-cams-network-dev`, `rg-analytics`, `bankruptcy-oversight-support-systems` |
| `infrastructure-deploy-*` | `cams-infrastructure-deploy-{main,branch}-oidc` | `setup-infrastructure-deploy-federated-credential.sh` | Contributor                                 | Subscription                                                                                                     |
| `e2e-*`                   | `cams-e2e-{main,branch}-oidc`                   | `setup-e2e-federated-credential.sh`                   | Contributor                                 | Subscription                                                                                                     |
| `remove-branch`           | `cams-remove-branch-oidc`                       | `setup-remove-branch-federated-credential.sh`         | Contributor                                 | Subscription                                                                                                     |
| `security-scan`           | `cams-security-scan-oidc`                       | `setup-security-scan-federated-credential.sh`         | Storage Blob Data Contributor               | Security-scan storage account                                                                                    |

`security-scan` and `deploy-branch` are bounded by scope as well as by role. Every other identity's
primary role is assigned at subscription scope, so its bound is the role.

`remove-branch` keeps subscription scope because it finds and deletes branch resource groups by tag,
and their names are not known in advance.

### Key Vault access

Each identity holds Key Vault Secrets User on each secret listed in its runbook's `KV_SECRETS`
array, never on a whole vault. `*-main` identities and `security-scan` read `kv-ustp-cams`;
`*-branch` identities and `remove-branch` read `kv-ustp-cams-dev`. Many secrets (`AZ-APP-RG`,
`SLOT-NAME`) are granted to several identities.

### Additional custom roles

All three roles are created by `setup-deploy-federated-credential.sh` or
`setup-remove-branch-federated-credential.sh` if they do not exist.

| Role                                          | Held by                          | Scope                                           | Why                                                                                                                                                                     |
| --------------------------------------------- | -------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CAMS KV Role Assignment Operator`            | `deploy-main`, `deploy-branch`   | The identity's Key Vault resource               | The Key Vault Bicep module creates role assignments on secrets, and Contributor lacks `roleAssignments/write`.                                                          |
| `CAMS Analytics Role Assignment Operator`     | `deploy-branch`                  | `law-cams-branches` workspace in `rg-analytics` | `app-shared-setup.bicep` grants the app-config managed identity Log Analytics Reader on that workspace on every branch deploy.                                          |
| `CAMS Deployment Stack Deny Setting Operator` | `deploy-branch`, `remove-branch` | `rg-cams-app-dev`, `rg-cams-network-dev`        | Branch app and network deploys are Deployment Stacks with `denyDelete`; creating or deleting one needs `manageDenySetting`, which only Deployment Stack Owner includes. |

## Grants not made by a runbook

Checked against live Azure on 2026-10-28. Every other identity's role assignments matched its
runbook.

- `deploy-main` holds **Role Based Access Control Administrator** on `rg-analytics`, granted out of
  band. It is not load-bearing for main deploys: no template creates a role assignment in
  `rg-analytics` on the main path. `audit-deploy-identity-grants.sh` still lists it as
  must-not-revoke, because its provenance is untraced and staging and USTP analytics reader grants
  are applied by hand, which may rely on it. Revoke it deliberately under `cams-y8s2`.
- `deploy-main` also holds grants left from an abandoned per-resource-group design, which
  `cams-y8s2` plans to revoke once main's approach is settled:
  - `CAMS Deploy Subscription Role` at subscription scope, the same custom role already revoked from
    `deploy-branch` (see [Revocations](#revocations))
  - Contributor on `rg-cams-app`, `rg-cams-network`, `rg-analytics` and
    `bankruptcy-oversight-support-systems`, which its subscription-scope Contributor already covers
- `deploy-branch` holds **Role Based Access Control Administrator** on `rg-analytics`. It was
  granted out of band and no runbook creates it. `audit-deploy-identity-grants.sh` lists it as
  must-not-revoke: remove it only after a branch deploy succeeds with the narrower
  `CAMS Analytics Role Assignment Operator` grant alone. Its provenance and replacement are tracked
  in `cams-y8s2`.
- The `deploy-sql-hub.yml` federated credential on `cams-infrastructure-deploy-main-oidc` (see
  [Workflows and GitHub environments](#workflows-and-github-environments)).

## Revocations

`deploy-branch` previously held Contributor at subscription scope, because branch resource groups
were named per commit and Azure RBAC cannot scope to names that do not exist yet. PR #2773 moved
branch deploys onto stable resource groups, and PR #2803 added the four resource-group grants. On
2026-09-04 the cutover in
[Branch Deploy RBAC Cutover](../../../../docs/operations/branch-deploy-rbac-cutover.md) revoked
these grants from `deploy-branch` and was validated by a full branch deploy (`cams-v4ngd`):

- Contributor at subscription scope
- `CAMS Deploy Subscription Role` at subscription scope, a custom role defined only in live Azure
- User Access Administrator on `bankruptcy-oversight-support-systems`

## Open work

- `deploy-main` keeps subscription-scope Contributor because main deploys create resource groups.
  Narrowing it is tracked in `cams-y8s2`.
- `deploy-branch`'s Contributor on `rg-analytics` and `bankruptcy-oversight-support-systems` covers
  resource groups shared with main, including main's Key Vault and Log Analytics workspace. Every
  branch deploy writes into both groups, so the grants are needed today, but resource-group scope is
  not the end state (`cams-y8s2`).
- `deploy-main`'s grants not made by a runbook need a decision and, where unneeded, a revoke (see
  [Grants not made by a runbook](#grants-not-made-by-a-runbook); `cams-y8s2`).
- The `deploy-branch-narrow-test` GitHub environment and the `cams-deploy-branch-narrow-test-oidc`
  app registration, left from testing the cutover, still existed on 2026-10-28 and can be deleted
  (`cams-v4ngd`).
