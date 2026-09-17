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

> **Scope.** Steps 1–7 are specific to these 31 names. If you arrived here
> because `audit-orphaned-gha-secrets.sh` surfaced something new, go to
> [Deleting a newly surfaced orphan](#deleting-a-newly-surfaced-orphan) — the
> method carries over, the name lists do not.

## Prerequisites

- `gh` CLI authenticated with admin rights on the repository.
- A working `git`, fetched and pruned (`git fetch origin --prune`). Both audit
  scripts refuse to report on refs that are not present locally.
- `az` CLI logged in to `Flexion DOJ USTP`, for the [Rollback](#rollback) path.
- Nobody mid-deploy. Check for in-flight `Continuous Deployment` runs first.
- No outstanding prerequisites. The Veracode/SourceClear ownership question that
  gated Step 5 was confirmed on 2026-09-15 (`cams-q7lo1`, closed).

## Do NOT delete

Read this **before** running anything below.

**`AZ_APP_RG` and `AZ_NETWORK_RG` also exist as environment-scoped objects** on
the `Develop` **and** `Main-Gov` environments, and **`SLOT_NAME`** on `Develop`
only. These are *separate objects* from the repo-scoped ones, and both
environments are active `environment:` anchors. **Delete at repository scope only** — `gh secret delete`
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

### The list is frozen — do not regenerate it from `main` alone

The 31 names are the output of **one audit of one commit**. They are baked into
the audit script deliberately: it is the gate for this specific cleanup, not a
general "find unused secrets" tool.

The method that produced the list — diff the live secret inventory against
references on `main` — is **not safe to re-run on its own**. A secret added by
an in-flight branch is absent from `main` by definition, so that method reports
a colleague's brand-new secret as unused and the next operator deletes their
work. The failure is invisible at the moment of deletion and surfaces later as a
broken branch nobody connects to this runbook.

Gate 6 of the audit exists for exactly this. It scans every branch with commits
in the last 90 days — **with or without an open pull request**, since a branch
being actively worked on usually has no PR yet — and a reference from one of
those is a hard failure, not a warning. Anyone extending the list must clear
Gate 6 before deleting anything.

It reads local remote-tracking refs, so it first verifies against
`git ls-remote` that this clone is current and refuses to report if it is not —
an unfetched branch would otherwise be invisible to precisely the check meant to
catch it. Run `git fetch origin --prune` before Step 0.

Gate 7 reports the opposite drift: it enumerates live repository scope and flags
targets that no longer exist, plus live objects that are unreferenced but absent
from the frozen list. That enumeration is **reporting only** and deliberately
does not feed the deletion list, for the reason above — an unreferenced orphan
and a colleague's in-flight secret are indistinguishable from `main`.

### Shelf life

The gate script is scaffolding; this runbook is the durable artifact. Because
its list is frozen rather than derived, it will keep auditing already-deleted
names and cannot surface anything added later. Delete it once `cams-9n4tg` is
verified complete — tracked as `cams-xug4r`.

What survives is `ops/scripts/utility/audit-orphaned-gha-secrets.sh`, which
enumerates live repository scope instead of checking a frozen list, and so keeps
working after this cleanup is done:

```bash
./ops/scripts/utility/audit-orphaned-gha-secrets.sh
```

Silent when nothing has changed. It reports orphans as *evidence*, never as a
deletion list — when it finds something, the answer is to come back to this
runbook, not to delete what it printed. Its baseline is currently seeded with
the 31 names below, so it will stay quiet until something genuinely new goes
unreferenced.

## Why the ordering matters

Tier A splits into 11 secrets whose values are recoverable from Key Vault and 7
that are not recoverable at all. Deleting them in one block puts the
unrecoverable seven at risk before anything has been proven.

So the recoverable eleven go first, then a canary, and only then the seven that
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
and a *dormant*-branch finding in Gate 5 report as warnings, and they are part
of the safety case — the summary says so. `STRICT=true` turns any warning into
exit 4 if you want a hard gate in CI.

A reference from an **active** branch — commits within `ACTIVE_DAYS`, default
90 — is a hard failure in both Gate 5 and Gate 6, because that is someone's work
in progress rather than residue. Set `ACTIVE_DAYS` higher if your team's
branches run longer.

Add `-b` to also list every remote branch that still references a target. That
output is informational and does **not** gate deletion — see
[Blast radius](#blast-radius).

> **If that script no longer exists**, this cleanup is finished and it was
> deleted on purpose (`cams-xug4r`) — its list was frozen to these 31 names. You
> are working from [Deleting a newly surfaced
> orphan](#deleting-a-newly-surfaced-orphan) instead; use
> `audit-orphaned-gha-secrets.sh`, which is the durable one, and treat Steps 1–7
> below as a worked example rather than a script to follow.

## Step 1 — Record the variable values

Variables are readable; secrets are not. Capture these before deleting:

These recorded values are the only rollback path for all five variables — the
three Tier C ones and the two Tier A ones deleted in Step 4 — so a failed lookup
must stop the procedure rather than print an empty string and continue:

```bash
REPO=US-Trustee-Program/Bankruptcy-Oversight-Support-Systems
for v in AZ_HOSTNAME_SUFFIX AZ_PRIVATE_DNS_ZONE NODE_VERSION SLOT_NAME STARTING_MONTH; do
  if ! value=$(gh api "repos/${REPO}/actions/variables/${v}" -q .value); then
    echo "ABORT: could not read ${v}; do not delete anything until this is recorded." >&2
    break
  fi
  printf '%-22s = %s\n' "$v" "$value"
done
```

At the time of writing: `.us`, `privatelink.azurewebsites.us`, `24.20.0`,
`development`, `-70`. Re-read them rather than trusting that list — and note
`SLOT_NAME` also exists in both vaults as `SLOT-NAME`, a second recovery source.

## Step 2 — Delete the 11 recoverable Tier A secrets

Every one of these has its value preserved in Key Vault, so
[Rollback](#rollback) can restore it.

> `gh secret delete` has **no confirmation prompt and no `--yes` flag**. Pasting
> this block destroys 11 objects with zero interaction. There is no `set -e`, so
> a failure mid-loop scrolls past and the loop continues — read the output.

```bash
REPO=US-Trustee-Program/Bankruptcy-Oversight-Support-Systems

TIER_A_RECOVERABLE=(AZ_APP_RG AZ_NETWORK_RG AZURE_RG
  AZ_ANALYTICS_RG MSSQL_DATABASE_DXTR MSSQL_HOST MSSQL_TRUST_UNSIGNED_CERT
  MSSQL_USER ADMIN_KEY SNYK_OAUTH_CLIENT_ID SNYK_OAUTH_CLIENT_SECRET)

for s in "${TIER_A_RECOVERABLE[@]}"; do
  if gh secret delete "$s" -R "$REPO"; then echo "  deleted $s"; else echo "  FAILED $s"; fi
done
```

### Gate: confirm Step 2 completed in full

The canary in Step 3 is meant to prove the *complete* Tier A change before Step
4 removes anything unrecoverable. It cannot do that over a partially-applied
set, so verify before moving on — a failure mid-loop is easy to scroll past:

```bash
remaining=$(gh secret list -R "$REPO" --json name -q '.[].name')
for s in "${TIER_A_RECOVERABLE[@]}"; do
  if grep -qx "$s" <<< "$remaining"; then echo "  STILL PRESENT: $s"; fi
done
```

Any output means Step 2 did not complete. Resolve it and re-run before the
canary — do not proceed to Step 4.

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

## Step 4 — Delete the 7 unrecoverable Tier A secrets

No Key Vault mirror for any of these seven secrets, so there is no rollback.
They are zero-reference dead weight, and recreating `AZURE_CREDENTIALS` would
undo what CAMS-760 existed to do. Only proceed once Step 3 is green.

`ANALYTICS_WORKSPACE_ID` is here rather than in Step 2 because the secret that
migrated into KV `AZ-ANALYTICS-WORKSPACE-ID` was `AZ_ANALYTICS_WORKSPACE_ID` —
a different, environment-scoped secret. See [Rollback](#rollback).

```bash
for s in ANALYTICS_WORKSPACE_ID AZURE_CREDENTIALS \
         AZ_PRIVATE_DNS_ZONE_ID AZ_PRIVATE_DNS_ZONE_RG \
         AZ_STOR_VERACODE_KEY AZ_STOR_VERACODE_NAME CAMS_REACT_SELECT_HASH; do
  if gh secret delete "$s" -R "$REPO"; then echo "  deleted $s"; else echo "  FAILED $s"; fi
done
```

The two Tier A **variables** go here too. Unlike the secrets above they *are*
recoverable — from the values you recorded in Step 1 — so they are listed
separately rather than under the "no rollback" warning:

```bash
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

Eight secrets with **no Key Vault counterpart**. Nothing references them, so the
risk here is not breakage — it is that deletion destroys the value permanently.
That is the entire reason this is a separate gated step rather than part of
Step 2.

### Prerequisite — resolved

Six of the eight — `VERACODE_API_ID`, `VERACODE_API_KEY`, `VERACODE_APP_ID`,
`VERACODE_SAST_POLICY`, `SRCCLR_API_TOKEN`, `SRCCLR_REGION` — have no code path
anywhere in the repository. Greps for `veracode`, `srcclr`, `sourceclear` and
`pipeline-scan` across `.github/` and `ops/` return nothing.

Zero references was not sufficient on its own: it is consistent with *dead
tooling* and equally consistent with *a human running a manual submission from a
runbook that does not live in this repo*, and the repository cannot tell those
apart. That needed a person rather than another audit.

**Confirmed 2026-09-15: Veracode is not in use.** All six may be deleted
(`cams-q7lo1`, closed). The confirmation is taken as covering `SRCCLR_*` as well
— SourceClear is a Veracode product and both credential sets were retired
together in the move to Snyk. If `SRCCLR_*` turns out to be a separate
arrangement, stop and reopen that bead.

```bash
for s in LD_ACCESS_TOKEN PGP_SIGNING_PASSPHRASE \
         VERACODE_API_ID VERACODE_API_KEY VERACODE_APP_ID VERACODE_SAST_POLICY \
         SRCCLR_API_TOKEN SRCCLR_REGION; do
  if gh secret delete "$s" -R "$REPO"; then echo "  deleted $s"; else echo "  FAILED $s"; fi
done
```

### Then — rotate the Veracode storage key

> **This is the one action in this runbook that is not a deletion, and the
> easiest to skip.** `AZ_STOR_VERACODE_KEY` is a storage account **access key**.
> Step 4 deleted the GitHub copy, which does **not** revoke it — the credential
> remains live in Azure. Worse, once that secret is gone so is the record of
> which key it held, so this gets harder the longer it is left.

Rotate the key on the storage account that `AZ_STOR_VERACODE_NAME` referred to.
Now that Veracode is confirmed unused, nothing should break.

| Secret | Why there is no mirror |
| --- | --- |
| `LD_ACCESS_TOKEN` | LaunchDarkly **management API** token. `FEATURE-FLAG-SDK-KEY` exists in both vaults but is the *SDK* key — not the same credential. Regenerable from the LD console. |
| `PGP_SIGNING_PASSPHRASE` | Served the encrypted-input scheme that CAMS-760 removed outright. Obsolete rather than migrated. |
| `VERACODE_*`, `SRCCLR_*` | Vendor credentials for tooling retired in favour of Snyk. Confirmed unused 2026-09-15 (`cams-q7lo1`). |

> Two name collisions worth re-reading before you paste anything.
> `PGP_SIGNING_PASSPHRASE` is **not** `BOT_PRIVATE_KEY` / `BOT_PASSPHRASE` —
> those are still in use by `update-dependencies.yml` and appear in no tier.
> And `AZ_STOR_VERACODE_KEY` / `AZ_STOR_VERACODE_NAME` are Veracode-named but
> belong to **Tier A Step 4**, not here; they were superseded by
> `AZ-SECURITY-SCAN-STORAGE-NAME` plus OIDC.

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

## Deleting a newly surfaced orphan

Steps 1–7 are **results, not a procedure**: every list in them is the 31 names
this cleanup was scoped to. When
`ops/scripts/utility/audit-orphaned-gha-secrets.sh` later reports something new,
none of those steps will mention it. What transfers is the method below.

### 1. Decide whether it is actually unused

Unreferenced is evidence, not a verdict. Before anything else, rule out the
three ways a live secret looks dead:

- **A manual or offline process.** No amount of scanning finds this — it is why
  the Veracode credentials in Step 5 needed a person to answer. If the secret
  belongs to a vendor or an ops process, ask the owner.
- **A dormant-but-present workflow.** A textual reference counts as "keep" here
  deliberately; the auditor will not tell you whether a workflow that mentions it
  is still live. That is a human call.
- **An in-flight branch.** The auditor already checks branches with commits in
  the last 90 days, so this is mostly handled — but widen `ACTIVE_DAYS` if your
  team runs long-lived branches.

### 2. Work out its tier — this is the expensive part

The tier is decided by **what happens to the value if you are wrong**, not by
what the secret is for. Check in this order:

| Check | Command | If it hits |
| --- | --- | --- |
| Value lives in Key Vault? | `for v in kv-ustp-cams kv-ustp-cams-dev; do az keyvault secret list --vault-name "$v" --query "[].name" -o tsv \| grep -i NAME; done` | **Recoverable.** Note the exact KV name **and which vault** — they hold different values, and one may hold it while the other does not. |
| Now a hardcoded literal? | `find -L .github -type f -exec grep -in "NAME=" {} +` | **Recoverable** in the sense that the value is visible in the repo. |
| Vendor credential? | — | **Unrecoverable**, but regenerable from the vendor console. |
| None of the above? | — | **Unrecoverable, full stop.** Treat with the most care; there is no way back. |

Both vaults are checked above because they hold *different* values and a secret
may exist in only one — see the divergence table under [Rollback](#rollback).
Recording the wrong vault's value is worse than recording none.

`find -L` rather than `grep -r`: BSD grep does not follow a symlinked
subdirectory and reports "no match" having searched nothing. Both audit scripts
were rewritten for this; the hand method should not reintroduce it.

### 3. Apply the same ordering

Recoverable first, then a branch-deploy canary, then anything unrecoverable.
The point of the ordering is that by the time you reach a step you cannot undo,
the reversible ones have already shown that nothing depended on them. See
[Why the ordering matters](#why-the-ordering-matters).

### 4. Re-read the traps

These are properties of the repository, not of the 31 names, so they apply
unchanged to anything new:

- **Scope collisions** — check whether the name also exists at *environment*
  scope on `Develop` or `Main-Gov` before deleting at repository scope. See
  [Do NOT delete](#do-not-delete).
- **Storage keys and similar are not revoked by deletion.** Removing the GitHub
  copy of a credential does not invalidate it upstream. If the secret is an
  access key, rotate it at the source as well.
- **Stale branches** will break on the next push if they reference it, and that
  is [self-healing](#blast-radius) rather than a reason to keep the secret.

### 5. Baseline whatever you decide not to delete

If the answer is "leave it", record that so it stops resurfacing:

```bash
./ops/scripts/utility/audit-orphaned-gha-secrets.sh -u
```

Presence in the baseline means *known*, not *safe to delete*.

## Rollback

**Eleven of the eighteen Tier A secrets are restorable from Key Vault.**

**Pick the vault deliberately.** The two vaults hold *different* values, and the
repo-scoped secrets are the fallback used by branch deploys — restoring
production values into them silently repoints branch CI at production resource
groups:

| KV secret | `kv-ustp-cams` (prod) | `kv-ustp-cams-dev` |
| --- | --- | --- |
| `AZ-APP-RG` | `rg-cams-app` | `rg-cams-app-dev` |
| `AZ-NETWORK-RG` | `rg-cams-network` | `rg-cams-network-dev` |
| `AZ-ANALYTICS-WORKSPACE-ID` | `.../law-ustp-cams` | `.../law-cams-branches` |
| `SNYK-OAUTH-CLIENT-ID` / `-SECRET` | present | **absent** |

The last row is absence, not divergence: those two exist only in the production
vault, so the loop below pins them rather than following `$VAULT`.

```bash
REPO=US-Trustee-Program/Bankruptcy-Oversight-Support-Systems
VAULT=kv-ustp-cams-dev     # <-- choose deliberately; see the table above

restore() {  # restore <GH_SECRET_NAME> <KV_SECRET_NAME> [VAULT_OVERRIDE]
  local vault="${3:-$VAULT}" value
  if ! value=$(az keyvault secret show --vault-name "$vault" --name "$2" \
       --query value -o tsv 2>/dev/null); then
    echo "  FAILED $1: could not read $2 from $vault" >&2
    return 1
  fi
  if [[ -z "$value" ]]; then
    echo "  FAILED $1: $2 is empty in $vault -- refusing to store an empty secret" >&2
    return 1
  fi
  printf '%s' "$value" | gh secret set "$1" -R "$REPO" && echo "  restored $1"
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

# These two exist ONLY in kv-ustp-cams -- there is no dev copy to choose, so the
# vault is pinned rather than following $VAULT.
restore SNYK_OAUTH_CLIENT_ID       SNYK-OAUTH-CLIENT-ID     kv-ustp-cams
restore SNYK_OAUTH_CLIENT_SECRET   SNYK-OAUTH-CLIENT-SECRET kv-ustp-cams
```

The value is captured and checked before `gh secret set` is called rather than
piped straight through. `az keyvault secret show` exits 3 with empty output when
a secret is missing, and `gh secret set` accepts empty stdin without complaint —
piped together without `pipefail`, the pipeline reports `gh`'s status and
silently stores an **empty** secret while looking successful. That is a bad way
to discover a problem in the middle of an incident.

`gh secret set` strips trailing newlines from stdin, so the `-o tsv` output does
not corrupt the value. (A *leading* newline and a trailing space are preserved —
the trim is specific to trailing newlines.)

`ANALYTICS_WORKSPACE_ID` is deliberately **not** in that list. The secret that
migrated into KV `AZ-ANALYTICS-WORKSPACE-ID` was `AZ_ANALYTICS_WORKSPACE_ID`,
which survives today as an *environment*-scoped secret. The repo-scoped
`ANALYTICS_WORKSPACE_ID` is an older, separate secret; treat it as
unrecoverable rather than assuming the values match. Note also that KV holds
`ANALYTICS-WORKSPACE-CUSTOMER-ID`, a bare GUID that is a plausible wrong choice.

The seven Step 4 secrets and all eight Tier B secrets have **no** rollback path.
(The two Step 4 *variables* are recoverable from the Step 1 record.)
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

  That flag belongs to the cleanup gate, which is deleted with it (`cams-xug4r`).
  The branch-listing capability goes too; nothing replaces it, because it exists
  to size the blast radius of *this* cleanup.

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
