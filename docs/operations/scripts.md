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

### audit-unreferenced-gha-secrets.sh

Read-only audit of the GitHub Actions secrets and variables slated for deletion by
the CAMS-760 cleanup. Re-derives the "is anything still referencing this?" check by
grepping `.github/` rather than trusting the runbook's tables, then corroborates it
against the checks that make a static grep sound — no dynamic `secrets[...]` access,
no composite actions, empty Dependabot/Codespaces scopes — plus environment-scoped
name collisions and open PRs.

A gate that cannot run reports `ERROR` and exits 3 (inconclusive), never `OK` — the
dangerous failure for a pre-deletion gate is not a crash but a green light over a
scan that never really looked. Exit 1 means a target is still referenced; exit 4 is
`STRICT=true` with warnings.

Three false-pass classes are closed deliberately, and a preflight self-test proves
the pattern against fixtures before any real input is trusted. References are matched
**case-insensitively** with optional whitespace around the dot, because GitHub
expression property access is case-insensitive and `${{ secrets.azure_rg }}` is a
working reference to `AZURE_RG`. The file walk uses `find -L`, because BSD `grep -R`
does not follow a symlinked subdirectory and returns "no match" having searched
nothing. Files are enumerated once so an unreadable file is reported on its own
rather than poisoning every per-name scan, and `gh` calls pass an explicit `-R` with
full `repos/OWNER/REPO/...` paths since the `:owner/:repo` placeholder shells out to
git.

`-b` additionally lists every remote branch still referencing a target, with age and
commits-behind. Nothing is ever modified. See
[GHA Secret and Variable Deletion](/operations/gha-secret-deletion.md).

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
