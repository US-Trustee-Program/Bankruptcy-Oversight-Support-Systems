# Branch Deploy Identity RBAC Cutover

## Overview

This is a one-time procedure that narrows the **branch** deploy identity
(`cams-deploy-branch-oidc`) from subscription-scope `Contributor` down to
resource-group and resource scope.

Branch deploys once created dynamically-named per-branch resource groups. Azure
RBAC has no wildcard scoping over dynamic names, so the only grant that could
cover them was subscription-wide. CAMS-760 Slices 1-2 (PR #2773) removed that
constraint by co-locating branch deploys into stable, statically-named resource
groups, and PR #2803 narrowed the grant accordingly.

The grant half is automated. **The revoke half is this document**, because
`setup-deploy-federated-credential.sh` only ever grants — there is no
`az role assignment delete` anywhere in that script family.

> This procedure was attempted in August 2026 and rolled back. It failed
> because `azure-deploy-rg.sh` made an unconditional `az deployment sub create`
> call — a subscription-scope operation even when every resource group already
> existed — so removing the broad grant broke branch deploys on their first
> pipeline step. PR #2803 makes that call conditional. Do not run this
> procedure against a branch that predates it.

Tracked as `cams-v4ngd`. Narrowing the **main** identity is deliberately out of
scope — see [Out of scope](#out-of-scope).

## Prerequisites

- PR #2803 merged to `main`.
- `az` CLI logged in as an Entra ID admin able to create role definitions and
  role assignments, on subscription `Flexion DOJ USTP`.
- Nobody mid-way through a branch deploy. Check for in-flight
  `Continuous Deployment` runs first.

## Why the ordering matters

Azure RBAC is **additive** across scopes. While the subscription-scope grant
exists, the narrow grants are a complete no-op for permission checking — so the
narrow scope's sufficiency cannot be verified until the broad grant is gone.

That circularity is unavoidable: you cannot prove the narrow grant works before
revoking, and you cannot safely revoke before proving it. The resolution is to
revoke, canary immediately, and keep the rollback command ready. It is a single
command and has been exercised.

## Step 1 — Apply the narrow grants

Additive and idempotent; safe to run repeatedly.

```bash
TARGET=branch \
AZ_BRANCH_KV_RG=bankruptcy-oversight-support-systems \
AZ_BRANCH_APP_RG=rg-cams-app-dev \
AZ_BRANCH_NETWORK_RG=rg-cams-network-dev \
AZ_BRANCH_ANALYTICS_RG=rg-analytics \
AZ_BRANCH_AZURE_RG=bankruptcy-oversight-support-systems \
  ./ops/scripts/utility/federated-credentials/setup-deploy-federated-credential.sh
```

The four RG-scoped `Contributor` grants already exist, so in practice this
creates two things: the `CAMS Analytics Role Assignment Operator` role
definition, and its assignment on the `law-cams-branches` Log Analytics
**workspace resource**.

### Gate: verify before going further

```bash
TARGET=branch \
AZ_BRANCH_KV_RG=bankruptcy-oversight-support-systems \
AZ_BRANCH_APP_RG=rg-cams-app-dev \
AZ_BRANCH_NETWORK_RG=rg-cams-network-dev \
AZ_BRANCH_ANALYTICS_RG=rg-analytics \
AZ_BRANCH_AZURE_RG=bankruptcy-oversight-support-systems \
  ./ops/scripts/utility/federated-credentials/audit-deploy-identity-grants.sh
```

Read-only. `expected, MISSING` must be **0** before you proceed. If it is not,
stop — revoking with an incomplete grant set breaks every branch deploy with no
fallback.

## Step 2 — Revoke

**Three** grants. Revoking only the first two leaves the identity holding
subscription-scope `resourceGroups/write` and `deployments/*` — precisely the
capabilities this work exists to remove — and the next deploy still goes green,
which reads as success.

| Role | Scope |
| --- | --- |
| `Contributor` | subscription |
| `CAMS Deploy Subscription Role` | subscription |
| `User Access Administrator` | resource group `bankruptcy-oversight-support-systems` |

`CAMS Deploy Subscription Role` is a custom role defined only in live Azure and
referenced by no script in this repo; its own description marks it as residue of
an abandoned per-RG RBAC design. `User Access Administrator` is
resource-group scoped, not subscription scoped.

Immediately afterwards, canary: dispatch `Continuous Deployment` via
`workflow_dispatch` with `deployBranch=true` and confirm it reaches the end.
Then re-run the audit — `to-be-revoked, present` should be **0** and
`UNKNOWN / UNMANAGED` must remain **0**.

### Do NOT revoke

`Role Based Access Control Administrator` on `rg-analytics` is **load-bearing**.

`app-shared-setup.bicep`'s `sharedAnalyticsReaderRoleAssignment` module creates
a `Microsoft.Authorization/roleAssignments` on the shared workspace on **every**
branch deploy (`isDevTier` is true whenever `createAlerts` is false, which
`reusable-deploy.yml` sets for every non-`Main-Gov` deploy). `Contributor`'s
`notActions` exclude `Microsoft.Authorization/*/Write`, so none of the four
RG-scoped `Contributor` grants can substitute — including the one on that very
resource group.

Step 1's workspace-scoped grant is its narrow replacement. Remove the RBAC
Administrator grant only once a branch deploy has gone green with it in place.
It is unmanaged by any script, which makes it *look* like cleanup residue. It is
not.

## Rollback

```bash
az role assignment create \
  --assignee-object-id 9215f25f-549a-47d2-b7f9-b3002623c66b \
  --assignee-principal-type ServicePrincipal \
  --role Contributor \
  --scope /subscriptions/729f9083-9edf-4269-919f-3f05f7a0ab20
```

Restores the broad grant in seconds. This is what was done in August. Re-add the
other two revoked grants the same way if the failure implicates them.

## Cleanup

The `deploy-branch-narrow-test` GitHub environment and the
`cams-deploy-branch-narrow-test-oidc` app registration still exist, with four
RG-scoped grants. Only the repo-side scaffolding was removed in PR #2803, so
this is an orphaned identity with standing write access and nothing referencing
it. Delete both once the cutover is verified.

## Blast radius

Smaller than it looks.

- `cams-deploy-branch-oidc` is used by exactly **one** job repo-wide:
  `deploy-azure-infrastructure` in `reusable-deploy.yml`. Every other job in the
  deploy chain uses a different identity.
- An ordinary push does **not** deploy. `continuous-deployment.yml` gates the
  deploy job on `main` or an explicit `workflow_dispatch` with
  `deployBranch=true`.
- `main` deploys and branch teardown use separate identities and are unaffected.

## Troubleshooting

**A branch deploy fails with `AuthorizationFailed` on the first pipeline step.**
That branch predates PR #2803. Branches run their own checked-out copy of the
pipeline (`continuous-deployment.yml` uses local `./.github/workflows/...`
refs), so a branch picks up the conditional `az deployment sub create` only by
merging `main`. Fix: `git merge main` and re-dispatch. The failure happens
before any resource is touched, so nothing is left half-deployed.

**A branch deploy fails at `Deploy Azure App Shared Setup` on
`roleAssignments/write`.** The `rg-analytics` RBAC Administrator grant was
revoked before the workspace-scoped replacement was in place. Re-add it, then
complete Step 1.

**The granting script exits 11.** The `law-cams-branches` workspace does not
exist yet. It is created by `app-shared-setup.bicep` on the first branch deploy,
so on a fresh subscription the order is: deploy once (it fails at the analytics
role assignment), run Step 1, redeploy.

**The granting script exits 12.** A custom role definition was created but has
not propagated. Re-run — it is idempotent and will pick up the existing
definition.

**An `AuthorizationFailed` on a no-op resource-group deploy.**
`azure-deploy-rg.sh` decides whether to make the subscription-scope call from
`az group exists` on `AZURE_RG`, `AZ_NETWORK_RG` and `AZ_APP_RG`. If any of
those three is ever deleted or renamed, the call fires and hard-fails under the
narrow grant. That is by design, but it means this procedure's safety depends on
those resource groups continuing to exist.

## Out of scope

`cams-deploy-main-oidc` has the **same** load-bearing dependency:
`standaloneAnalyticsReaderRoleAssignment` is a different invocation of the same
bicep module, so main's `rg-analytics` RBAC Administrator grant is also
load-bearing, with no narrower replacement queued. Auditing `TARGET=main` also
surfaces five grants created by no script in this repo, residue of the same
abandoned design.

Do not narrow main during this cutover. Tracked as `cams-y8s2`.
