# GitHub Actions Secret and Variable Deletion

## Overview

This is a one-time procedure that deletes the GitHub Actions secrets and
variables left stranded by CAMS-760 (PR #2446), which migrated every
Azure-authenticated workflow to OIDC and moved resource names into Key Vault.

PR #2446's own Notes section carried a 16-item deletion table. A full audit of
`main` found **31** unreferenced items — the table was incomplete, and two of
its entries (`AZURE_RG`, `AZ_ANALYTICS_RG`) were only made safe by a commit
inside that same PR.

Deleting a GitHub secret is **irreversible** — the value cannot be read back
through the API or the UI. That, not breakage, is the risk this runbook is
organised around.

Tracked as `cams-9n4tg`.

## Prerequisites

- `gh` CLI authenticated with admin rights on the repository.
- A working `git`, fetched and pruned (`git fetch origin --prune`). The audit's
  PR gate cannot check a ref that is not present locally.
- `az` CLI logged in to `Flexion DOJ USTP`, for the [Rollback](#rollback) path.
- Nobody mid-deploy. Check for in-flight `Continuous Deployment` runs first.

## Do NOT delete

Read this **before** running anything below.

**`AZ_APP_RG`, `AZ_NETWORK_RG` and `SLOT_NAME` also exist as environment-scoped
objects** on the `Develop` and `Main-Gov` environments. These are *separate
objects* from the repo-scoped ones, and both environments are active
`environment:` anchors. **Delete at repository scope only** — `gh secret delete`
defaults to repository scope and needs `-e` to touch an environment, so the
default is correct; do not add `-e`.

`SLOT_NAME` deserves particular care: it exists on `Develop` but **not** on
`Main-Gov`, so for anything running under `Main-Gov` the repository scope is the
only source. Nothing on `main` reads `vars.SLOT_NAME` today — it moved to
`kv_to_env SLOT_NAME "$KV" SLOT-NAME` — but the asymmetry means it is not
interchangeable with the other two.

**`BOT_PRIVATE_KEY` and `BOT_PASSPHRASE` are still in use** by
`update-dependencies.yml` for git commit signing. They are easy to confuse with
`PGP_SIGNING_PASSPHRASE` in Step 5, which is unrelated and obsolete.

## The safety case

Three independent facts, all re-checkable by the audit script:

1. **Nothing on `main` references any of the 31.** Verified by scanning
   `.github/` for `secrets.NAME` / `vars.NAME` — case-insensitively, tolerating
   whitespace around the dot, and following symlinked subdirectories, because
   GitHub expression property access is case-insensitive and all three of those
   are real ways to write a reference that a naive grep misses.
2. **That scan is sound.** There is no dynamic access (`toJSON(secrets)`,
   `secrets[...]`), no `.github/actions/` composite actions, and the Dependabot
   and Codespaces secret scopes are both empty — so workflow files are the
   entire consumer surface.
3. **Production cannot break.** `main`'s workflows reference none of them, and
   scheduled workflows always run from the default branch.

The residual exposure is stale branches — see [Blast radius](#blast-radius).

## Why the ordering matters

Tier A splits into 12 secrets whose values are recoverable from Key Vault and 6
that are not recoverable at all. Deleting them in one block puts the
unrecoverable six at risk before anything has been proven.

So the recoverable twelve go first, then a canary, and only then the six that
cannot be undone. By the time you reach an irreversible step, the reversible
ones have already demonstrated that nothing depended on them.

## Step 0 — Gate

```bash
git fetch origin --prune
./ops/scripts/utility/audit-unreferenced-gha-secrets.sh
```

Read-only. Re-derives the reference check from the working tree rather than
trusting the tables below, and reports a gate it could not run as `ERROR`
rather than `OK`.

| Exit | Meaning |
| --- | --- |
| `0` | No target is referenced. Warnings may still be present — read them. |
| `1` | A deletion target is still referenced. **Stop.** |
| `2` | Usage error, or not run from the repository root. |
| `3` | INCONCLUSIVE — a gate could not run. Fix the tooling and re-run. |
| `4` | `STRICT=true` and at least one warning was raised. |

Exit `0` is **not** an unconditional green light. Gate 4 (environment shadows)
and Gate 5 (open PRs) report as warnings, and they are part of the safety case —
the summary says so. `STRICT=true` turns any warning into exit 4 if you want a
hard gate in CI.

Add `-b` to also list every remote branch that still references a target. That
output is informational and does **not** gate deletion — see
[Blast radius](#blast-radius).

## Step 1 — Record the variable values

Variables are readable; secrets are not. Capture these before deleting:

```bash
REPO=US-Trustee-Program/Bankruptcy-Oversight-Support-Systems
for v in AZ_HOSTNAME_SUFFIX AZ_PRIVATE_DNS_ZONE NODE_VERSION SLOT_NAME STARTING_MONTH; do
  printf '%-22s = %s\n' "$v" "$(gh api "repos/${REPO}/actions/variables/${v}" -q .value)"
done
```

At the time of writing: `.us`, `privatelink.azurewebsites.us`, `24.20.0`,
`development`, `-70`. Re-read them rather than trusting that list — and note
`SLOT_NAME` also exists in both vaults as `SLOT-NAME`, a second recovery source.

## Step 2 — Delete the 12 recoverable Tier A secrets

Every one of these has its value preserved in Key Vault, so
[Rollback](#rollback) can restore it.

> `gh secret delete` has **no confirmation prompt and no `--yes` flag**. Pasting
> this block destroys 12 objects with zero interaction. There is no `set -e`, so
> a failure mid-loop scrolls past and the loop continues — read the output.

```bash
REPO=US-Trustee-Program/Bankruptcy-Oversight-Support-Systems

for s in ANALYTICS_WORKSPACE_ID AZ_APP_RG AZ_NETWORK_RG AZURE_RG AZ_ANALYTICS_RG \
         MSSQL_DATABASE_DXTR MSSQL_HOST MSSQL_TRUST_UNSIGNED_CERT MSSQL_USER \
         ADMIN_KEY SNYK_OAUTH_CLIENT_ID SNYK_OAUTH_CLIENT_SECRET; do
  if gh secret delete "$s" -R "$REPO"; then echo "  deleted $s"; else echo "  FAILED $s"; fi
done
```

## Step 3 — Canary

Dispatch `Continuous Deployment` with **`deployBranch=true` on a branch** — not
on `main`.

```bash
gh workflow run continuous-deployment.yml -R "$REPO" \
  --ref <your-test-branch> -f deployBranch=true -f fastDeploy=false
```

Confirm it reaches the end, then re-run Step 0's audit.

> **Do not canary by dispatching on `main`.** `continuous-deployment.yml` gates
> its deploy job on `github.ref == 'refs/heads/main' || inputs.deployBranch ==
> 'true'`, so a dispatch on `main` starts a **production deployment**. It is
> also tautological: the safety case is that `main` references none of these
> names, so a run on `main` is green whether or not the deletions broke
> anything. A branch deploy exercises the path that actually reads these values.

## Step 4 — Delete the 6 unrecoverable Tier A secrets

No Key Vault mirror, so there is no rollback. All six are zero-reference dead
weight, and recreating `AZURE_CREDENTIALS` would undo what CAMS-760 existed to
do. Only proceed once Step 3 is green.

```bash
for s in AZURE_CREDENTIALS AZ_PRIVATE_DNS_ZONE_ID AZ_PRIVATE_DNS_ZONE_RG \
         AZ_STOR_VERACODE_KEY AZ_STOR_VERACODE_NAME CAMS_REACT_SELECT_HASH; do
  if gh secret delete "$s" -R "$REPO"; then echo "  deleted $s"; else echo "  FAILED $s"; fi
done

for v in AZ_HOSTNAME_SUFFIX AZ_PRIVATE_DNS_ZONE; do
  if gh variable delete "$v" -R "$REPO"; then echo "  deleted $v"; else echo "  FAILED $v"; fi
done
```

> **`AZ_STOR_VERACODE_KEY` is a storage account access key.** Deleting the
> GitHub copy does not revoke it in Azure — the key stays valid. Rotate it on
> the storage account as well. It was superseded by
> `AZ_SECURITY_SCAN_STORAGE_NAME` (KV `AZ-SECURITY-SCAN-STORAGE-NAME`) plus OIDC
> when Veracode was removed, so this is "superseded, now rotate", not merely
> "unused".

## Step 5 — Delete Tier B

Eight secrets with **no Key Vault counterpart**. Nothing references them, so
there is no breakage risk, but the stored values are gone for good.

Each is either retired tooling or regenerable from its vendor console. Confirm
with security that the Veracode and SourceClear contracts have lapsed before
running this.

```bash
for s in LD_ACCESS_TOKEN PGP_SIGNING_PASSPHRASE \
         VERACODE_API_ID VERACODE_API_KEY VERACODE_APP_ID VERACODE_SAST_POLICY \
         SRCCLR_API_TOKEN SRCCLR_REGION; do
  if gh secret delete "$s" -R "$REPO"; then echo "  deleted $s"; else echo "  FAILED $s"; fi
done
```

| Secret | Why there is no mirror |
| --- | --- |
| `LD_ACCESS_TOKEN` | LaunchDarkly **management API** token. `FEATURE-FLAG-SDK-KEY` exists in both vaults but is the *SDK* key — not the same credential. Regenerable from the LD console. |
| `PGP_SIGNING_PASSPHRASE` | Served the encrypted-input scheme that CAMS-760 removed outright. Obsolete rather than migrated. |
| `VERACODE_*`, `SRCCLR_*` | Vendor credentials for tooling retired in favour of Snyk. |

## Step 6 — Delete Tier C

Three variables. Values recorded in Step 1, so this is reversible.

```bash
for v in NODE_VERSION SLOT_NAME STARTING_MONTH; do
  if gh variable delete "$v" -R "$REPO"; then echo "  deleted $v"; else echo "  FAILED $v"; fi
done
```

## Step 7 — Update the environment-setup docs

`docs/operations/deployment.md` still lists `AZURE_CREDENTIALS`,
`AZ_PRIVATE_DNS_ZONE`, `AZ_PRIVATE_DNS_ZONE_RG`, `AZ_PRIVATE_DNS_ZONE_ID`,
`SNYK_OAUTH_CLIENT_ID`, `SNYK_OAUTH_CLIENT_SECRET`, `STARTING_MONTH` and
`SLOT_NAME` in its required-secrets table. Left alone, anyone standing up a new
environment from that doc will provision secrets nothing reads. Remove the
deleted rows, and note for the Snyk pair that they now come from Key Vault.

## Rollback

**Twelve of the eighteen Tier A secrets are restorable from Key Vault.**

**Pick the vault deliberately.** The two vaults hold *different* values, and the
repo-scoped secrets are the fallback used by branch deploys — restoring
production values into them silently repoints branch CI at production resource
groups:

| KV secret | `kv-ustp-cams` (prod) | `kv-ustp-cams-dev` |
| --- | --- | --- |
| `AZ-APP-RG` | `rg-cams-app` | `rg-cams-app-dev` |
| `AZ-NETWORK-RG` | `rg-cams-network` | `rg-cams-network-dev` |
| `AZ-ANALYTICS-WORKSPACE-ID` | `.../law-ustp-cams` | `.../law-cams-branches` |

```bash
REPO=US-Trustee-Program/Bankruptcy-Oversight-Support-Systems
VAULT=kv-ustp-cams-dev     # <-- choose deliberately; see the table above

restore() {  # restore <GH_SECRET_NAME> <KV_SECRET_NAME>
  az keyvault secret show --vault-name "$VAULT" --name "$2" --query value -o tsv \
    | gh secret set "$1" -R "$REPO"
}

restore AZ_APP_RG                  AZ-APP-RG
restore AZ_NETWORK_RG              AZ-NETWORK-RG
restore AZURE_RG                   AZURE-RG
restore AZ_ANALYTICS_RG            AZ-ANALYTICS-RG
restore MSSQL_DATABASE_DXTR        MSSQL-DATABASE-DXTR
restore MSSQL_HOST                 MSSQL-HOST
restore MSSQL_TRUST_UNSIGNED_CERT  MSSQL-TRUST-UNSIGNED-CERT
restore MSSQL_USER                 MSSQL-USER
restore ADMIN_KEY                  ADMIN-KEY
restore SNYK_OAUTH_CLIENT_ID       SNYK-OAUTH-CLIENT-ID
restore SNYK_OAUTH_CLIENT_SECRET   SNYK-OAUTH-CLIENT-SECRET
```

`gh secret set` strips trailing newlines from stdin, so the `-o tsv` pipe does
not corrupt the value. (A *leading* newline and a trailing space are preserved —
the trim is specific to trailing newlines.)

`ANALYTICS_WORKSPACE_ID` is deliberately **not** in that list. The secret that
migrated into KV `AZ-ANALYTICS-WORKSPACE-ID` was `AZ_ANALYTICS_WORKSPACE_ID`,
which survives today as an *environment*-scoped secret. The repo-scoped
`ANALYTICS_WORKSPACE_ID` is an older, separate secret; treat it as
unrecoverable rather than assuming the values match. Note also that KV holds
`ANALYTICS-WORKSPACE-CUSTOMER-ID`, a bare GUID that is a plausible wrong choice.

The six Step 4 secrets and all eight Tier B secrets have **no** rollback path.
Regenerate from the vendor console if one turns out to be needed.

Variables restore with an explicit body — `gh variable set NAME -R "$REPO"` with
no `--body` and no stdin **blocks on an interactive prompt**:

```bash
gh variable set NODE_VERSION -R "$REPO" --body '24.20.0'
```

## Blast radius

Smaller than the raw branch count suggests.

- **27 remote branches** still reference these names in their own copies of
  `.github/`. Their CI works today and will fail after deletion. Recompute
  rather than trusting a frozen number:

  ```bash
  ./ops/scripts/utility/audit-unreferenced-gha-secrets.sh -b
  ```

- **`continuous-deployment.yml` fires on `push:` to any branch** other than
  `mob/**`, running *that branch's own* workflow files. A `workflow_dispatch`
  on one of those branches does the same — dispatch runs the workflow file from
  the **selected ref**, not from the default branch. Those are the two paths to
  breakage.
- **The failure is loud, not silent.** On a stale branch `vars.NODE_VERSION`
  resolves to empty and `actions/setup-node` fails at step 2, taking the unit
  test, typecheck, knip and accessibility jobs with it. No wrong-value deploy.
- **It is self-healing.** Every one of those branches is thousands of commits
  behind `main`, and the newest has not been touched in months. None can be
  resumed without a rebase — and the rebase that makes a branch usable is the
  same act that replaces its stale workflow files. Triggering the failure
  requires pushing to a long-dead branch *without* rebasing, at which point that
  branch's CD is broken on its own merits.
- **No open PR is affected.** The only one that references these names is
  #2297, marked `[DO-NOT-MERGE]`. Its own `.github` delta is a new file that
  references none of the 31.
- **Scheduled workflows are unaffected** — cron always runs from the default
  branch.

Deletion is therefore **not** gated on pruning or rebasing those branches. If
you prune them anyway, note that `azure-remove-branch.yml` has an `on: delete:`
trigger, so bulk deletion fires one teardown run per branch; work in small
batches.

## Troubleshooting

**The audit reports `ERROR git is NOT usable`.** On macOS, `/usr/bin/git`
refuses to run until the Xcode licence is accepted, and `gh` shells out to git
to expand its `:owner/:repo` placeholder. Fix with `sudo xcodebuild -license`.
The script passes an explicit `-R "$REPO"` and uses full `repos/${REPO}/...`
API paths so the remaining gates keep working when git is down.

**The audit reports a ref is not fetched.** Run `git fetch origin --prune`. The
gate refuses to treat an unresolvable ref as clean, because an unfetched branch
and a clean branch are otherwise indistinguishable.

**`gh secret delete` returns 404.** Already deleted, or the name is
environment-scoped rather than repo-scoped. Confirm with
`gh secret list -R "$REPO"`.

**A branch deploy fails with an empty resource group name or an empty
`node-version`.** That branch predates CAMS-760 and is reading a deleted
secret. Rebase it onto `main`.

**The audit passes but a workflow still fails on a missing secret.** Check for
an org-level secret of the same name — a repo-scope delete can expose a
different org-scope value. Org secrets are not listable without `admin:org`.

## Out of scope

- **Environment-scoped secrets** on `Develop` and `Main-Gov`. Both carry a dozen
  unreferenced objects (`AZ_COSMOS_*`, `AZ_KV_APP_CONFIG_*`,
  `MONGO_CONNECTION_STRING`, and others) that deserve their own audit.
- **Pruning the 27 dormant branches.** Independent cleanup; see
  [Blast radius](#blast-radius).
- **The remaining `secrets: inherit` call sites** in `e2e-test.yml` and
  `dast-scan.yml`, which over-share secrets to callee workflows despite PR
  #2446 claiming they were all removed. Tracked as `cams-x83dl`.
- **`vars.STALE_BRANCH_DAYS`**, referenced in `azure-remove-branch.yml` but
  defined at no scope, silently falling back to `5`. Tracked as `cams-fqfjv`.
