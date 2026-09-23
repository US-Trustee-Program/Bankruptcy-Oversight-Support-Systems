# Scripts

## pipeline

Shared scripts that execute in CI/CD pipeline on both the Flexion and USTP environment.

### slots

Shared scripts that are utilized for slot deployments in Flexion and USTP environments.

## utility

Adhoc helper scripts

### audit-deploy-identity-grants.sh

Read-only audit of a deploy identity's Azure role assignments, in
`federated-credentials/`. Lists every assignment via `az role assignment list --all`
and classifies it as expected, to-be-revoked, must-not-revoke-yet, or
unknown/unmanaged — reporting both missing-but-expected and present-but-unexpected.
The expected set is derived from `setup-deploy-federated-credential.sh` at runtime
rather than hand-copied, so it cannot drift as secrets are added.

Findings exit 0, because the script is run repeatedly through a multi-step manual
cutover where some findings are the correct state at each step. `STRICT=true` opts
into a non-zero exit on any drift, for post-cutover use. Nothing is ever modified.

Run it with the same `TARGET` and `AZ_*_RG` variables as
`setup-deploy-federated-credential.sh`. See
[Branch Deploy RBAC Cutover](/operations/branch-deploy-rbac-cutover.md).

### audit-orphaned-gha-secrets.sh

Reports repository-scope GitHub Actions secrets and variables that nothing references.
Read-only and permanently so — it never deletes and never emits a deletion command.
This is the durable counterpart to the one-time CAMS-760 gate below: that script checks
references against a frozen list, this one enumerates live scope and asks what has gone
stale. Orphans accumulate quietly — 31 built up here over years because nothing watched.

**Silent by default.** Known-and-accepted orphans live in
`ops/scripts/utility/gha-orphan-secrets.baseline`; the script speaks only when the set
changes, and exits 0 with no output otherwise. This is deliberate: a report that lists
the same standing orphans every run gets muted, and a muted check is worse than none
because it reads as coverage. `-u` accepts the current set into the baseline, `-a`
reports everything including baselined entries. A baseline entry for an object that no
longer exists is inert, so deletions need no cleanup.

**References are checked across active branches, not just the current ref.** A secret
added by an in-flight branch is absent from `main` by definition, so a `main`-only check
would report a colleague's new secret as an orphan — and acting on that deletes their
work. Branches with commits in the last `ACTIVE_DAYS` (default 90) are included. All
references are gathered in one pass per ref using a single alternation; the naive
per-name-per-branch form is roughly a thousand `git grep` invocations and takes minutes.

It refuses to report on a clone that is behind the remote. The active-branch check
reads local refs, so a clone that has not fetched cannot see recent branches, and a
secret in use on one would be reported as an orphan; rather than guess, it compares
against `git ls-remote` and exits 3 telling you to fetch.

Requires a token with repository admin — listing secrets needs it and `GITHUB_TOKEN` in
Actions does not have it, which is why this is run on demand rather than on a schedule.
Only names are read, never values. Exit codes: `0` no new orphans, `1` new orphans, `2`
usage, `3` inconclusive.

### az-cosmos-add-user.sh

To simplify Cosmosdb administration, this script assigns a role to a principal for a target Cosmos Db account.

### az-delete-branch-resources.sh

Clean up Azure resources provisioned for a development branch deployment by hash id.

### az-sql-import-data.sh

Shell script will prepare the data file and execute bcp to upload data to a SQL server database. The script will target a directory folder with collection of csv to load data from. The data filename should be the same as the corresponding db table name. Also, ensure that a file secret with the user password has been set.

The below are dependencies needed for running this script.

#### bcp

The bulk copy program utility (bcp) is used to import/export data from SQL Server tables. This project leverage bcp to import data into an existing table from a comma/pipe delimited file for test.

#### Installation

OS X installion requires homebrew

```
# brew untap microsoft/mssql-preview if you installed the preview version
brew tap microsoft/mssql-release https://github.com/Microsoft/homebrew-mssql-release
brew update
brew install mssql-tools18
```

See [here](https://learn.microsoft.com/en-us/sql/tools/bcp-utility) for additional documentation.

### fix-import-data.sql

Fix known anonymized data set issues. This may be required after loading SQL server database from a data file.

### update-dependencies.sh

Script to run when starting dependency updates for the entire repository (backend/functions, common, dev-tools, test/e2e, user-interface).
