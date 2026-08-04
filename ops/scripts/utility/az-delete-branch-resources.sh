#!/usr/bin/env bash

# Title:        az-delete-branch-resources.sh
# Description:  Clean up USTP CAMS Azure resources provisioned for a development branch deployment by hash id.
# Prerequisite:
#               - Azure CLI
# Usage:        ./az-delete-branch-resources.sh --app-resource-group=<rg> --db-account=<account>
#               --db-resource-group=<rg> --kv-resource-group=<rg> --network-resource-group=<rg>
#               --stack-name=<name> --short-hash=<hash> [options]
#               Run with --help for the full list of flags.
#
# Exitcodes
# ==========
# 0   No error
# 1   Unrecognized parameter provided
# 2   Required parameter not provided
# 10+ Validation check errors

############################################################
# Help                                                     #
############################################################
Help()
{
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  --help                        Display this help message."
  echo "  --app-resource-group=<rg>     Application resource group name. **REQUIRED**"
  echo "                                Can be set via APP_RESOURCE_GROUP_BASE environment variable."
  echo "  --db-account=<account>        Database account name. **REQUIRED**"
  echo "                                Can be set via DB_ACCOUNT environment variable."
  echo "  --db-resource-group=<rg>      Database resource group name. **REQUIRED**"
  echo "                                Can be set via DB_RESOURCE_GROUP environment variable."
  echo "  --kv-resource-group=<rg>      App-config Key Vault resource group name. **REQUIRED**"
  echo "                                Can be set via KV_RESOURCE_GROUP environment variable."
  echo "  --sql-server-name=<name>      SQL Server name for E2E database deletion."
  echo "                                Can be set via SQL_SERVER_NAME environment variable."
  echo "                                Optional - skips SQL database deletion if not provided."
  echo "  --sql-resource-group=<rg>     SQL Server resource group name."
  echo "                                Can be set via SQL_RESOURCE_GROUP environment variable."
  echo "                                Optional - skips SQL database deletion if not provided."
  echo "  --network-resource-group=<rg> Network resource group name. **REQUIRED**"
  echo "                                Can be set via NETWORK_RESOURCE_GROUP_BASE environment variable."
  echo "  --analytics-resource-group=<rg> Analytics resource group name."
  echo "                                Can be set via ANALYTICS_RESOURCE_GROUP environment variable."
  echo "                                Optional - skips analytics workspace deletion if not provided."
  echo "  --stack-name=<name>           Stack name for resource naming. **REQUIRED**"
  echo "                                Can be set via STACK_NAME environment variable."
  echo "  --short-hash=<hash>           Branch hash ID. **REQUIRED**"
  echo "  --unmanage-action=<action>    Action on resources managed by the deployment"
  echo "                                stack when deleting it: deleteAll (also deletes"
  echo "                                the resource group) or deleteResources (keeps"
  echo "                                the resource group). Defaults to deleteAll."
  echo "                                Can be set via UNMANAGE_ACTION environment variable."
  echo ""
  exit 0
}

############################################################
# Error                                                    #
############################################################
function error() {
    local msg=$1
    local code=$2
    echo "ERROR: ${msg}" >>/dev/stderr
    exit "${code}"
}

############################################################
############################################################
# Main program                                             #
############################################################
############################################################
set -euo pipefail # ensure job step fails in CI pipeline when error occurs

# Parse named parameters
while [[ $# -gt 0 ]]; do
  case "$1" in
    --help)
      Help
      ;;
    --app-resource-group=*)
      app_rg="${1#*=}"
      shift
      ;;
    --db-account=*)
      db_account="${1#*=}"
      shift
      ;;
    --db-resource-group=*)
      db_rg="${1#*=}"
      shift
      ;;
    --kv-resource-group=*)
      kv_rg="${1#*=}"
      shift
      ;;
    --sql-server-name=*)
      sql_server="${1#*=}"
      shift
      ;;
    --sql-resource-group=*)
      sql_rg="${1#*=}"
      shift
      ;;
    --network-resource-group=*)
      net_rg="${1#*=}"
      shift
      ;;
    --analytics-resource-group=*)
      analytics_rg="${1#*=}"
      shift
      ;;
    --stack-name=*)
      stack_name="${1#*=}"
      shift
      ;;
    --short-hash=*)
      hash_id="${1#*=}"
      shift
      ;;
    --unmanage-action=*)
      unmanage_action="${1#*=}"
      shift
      ;;
    *)
      echo "Invalid option: $1"
      echo "Run with '--help' to see valid usage."
      exit 1
      ;;
  esac
done

  # Use environment variables as fallbacks if parameters not provided
  app_rg=${app_rg:-${APP_RESOURCE_GROUP_BASE:-}}
  db_account=${db_account:-${DB_ACCOUNT:-}}
  db_rg=${db_rg:-${DB_RESOURCE_GROUP:-}}
  kv_rg=${kv_rg:-${KV_RESOURCE_GROUP:-}}
  sql_server=${sql_server:-${SQL_SERVER_NAME:-}}
  sql_rg=${sql_rg:-${SQL_RESOURCE_GROUP:-}}
  net_rg=${net_rg:-${NETWORK_RESOURCE_GROUP_BASE:-}}
  analytics_rg=${analytics_rg:-${ANALYTICS_RESOURCE_GROUP:-}}
  stack_name=${stack_name:-${STACK_NAME:-}}
  # Action applied to resources the deployment stack manages when it is deleted.
  # Slice 1 (per-branch RGs): deleteAll removes the resources AND the resource group
  # (matches the previous 'az group delete' behavior). Slice 2 (shared RGs) will pass
  # deleteResources so the shared resource group is preserved.
  unmanage_action=${unmanage_action:-${UNMANAGE_ACTION:-deleteAll}}
  case "${unmanage_action}" in
    deleteAll|deleteResources) ;;
    *) error "Invalid --unmanage-action '${unmanage_action}': must be 'deleteAll' or 'deleteResources'." 22 ;;
  esac
  # unmanage_action is an Azure CLI literal; keep it as that literal only at the
  # `--action-on-unmanage` call site below. Everywhere else in this script, the
  # actual business decision — whether the RG must be preserved because it's
  # shared (Slice 2) — is this boolean, so the two concepts can't drift apart.
  if [[ "${unmanage_action}" == "deleteResources" ]]; then
    preserve_network_rg=true
  else
    preserve_network_rg=false
  fi

  if [[ -z "${app_rg:-}" || -z "${db_account:-}" || -z "${db_rg:-}" || -z "${kv_rg:-}" || -z "${net_rg:-}" || -z "${stack_name:-}" || -z "${hash_id:-}" ]]; then
  error "Not all required parameters provided. Run this script with the --help flag for details, or set the appropriate environment variables." 2
fi

# Check which resources exist (partial cleanup is normal if a previous run partially succeeded)
app_rg="${app_rg}-${hash_id}"
network_rg="${net_rg}-${hash_id}"
e2e_db="cams-e2e-${hash_id}"
stack_name="${stack_name}-${hash_id}"

# Safety guard (CAMS-760, GH #2749): this script deletes the app and network resource
# groups outright. Those MUST be the per-branch, hash-suffixed RGs — never a shared RG.
# A misconfiguration that made app_rg/network_rg resolve to a shared RG (e.g. the KV
# RG, the DB RG, the SQL RG, or the analytics RG) would delete shared infrastructure,
# as happened when the shared dev Key Vault was deleted. Abort before touching
# anything if a delete target is not hash-suffixed, or if it (or its base name) is a
# known shared RG. The Key Vault's RG is checked explicitly via --kv-resource-group
# rather than relying on it happening to equal --db-resource-group (which is all that
# protected it before this fix — coincidental, not guaranteed).
for rg_var in app_rg network_rg; do
    rg_val="${!rg_var}"
    # This can never actually trigger today: app_rg/network_rg are constructed by
    # appending "-${hash_id}" immediately above, so rg_val always ends with it by
    # construction. Kept as a defense-in-depth assertion against a future refactor
    # that changes how these are built — not the primary control (that's the
    # shared-RG comparison below).
    if [[ "${rg_val}" != *"-${hash_id}" ]]; then
        error "Refusing to delete ${rg_var}='${rg_val}': not suffixed with branch hash '-${hash_id}'. This must be a per-branch resource group." 20
    fi
    # Compare both the full name and the base (name without the '-<hash>' suffix)
    # against every known shared RG, case-folded since Azure RG names are
    # case-insensitive at the ARM level (plain Bash `==` is not).
    rg_base="${rg_val%-"${hash_id}"}"
    rg_val_lc="${rg_val,,}"
    rg_base_lc="${rg_base,,}"
    for shared in "${kv_rg}" "${db_rg}" "${sql_rg:-}" "${analytics_rg:-}"; do
        [[ -z "${shared}" ]] && continue
        shared_lc="${shared,,}"
        if [[ "${rg_val_lc}" == "${shared_lc}" || "${rg_base_lc}" == "${shared_lc}" ]]; then
            error "Refusing to delete ${rg_var}='${rg_val}': it (or its base '${rg_base}') matches a SHARED resource group '${shared}'. Aborting to protect shared infrastructure (GH #2749)." 21
        fi
    done
done

rgAppExists=$(az group exists -n "${app_rg}")
rgNetExists=$(az group exists -n "${network_rg}")
dbExists=$(az cosmosdb mongodb database exists -g "${db_rg}" -a "${db_account}" -n "${e2e_db}")

# Computed here (not just right before their own teardown blocks further
# down) so the "nothing to clean up" early-exit below can consider them
# too. Without this, a prior run that deleted the RGs + Cosmos DB but
# failed before removing the E2E SQL DB or the Log Analytics workspace
# would report "nothing to clean up" here and leak them indefinitely — the
# LAW in particular carries recurring cost, and neither can be recovered
# by a later run if this early-exit fires first.
e2e_sql_db="CAMS_E2E-${hash_id}"
sqlDbExists=""
if [[ -n "${sql_server:-}" && -n "${sql_rg:-}" ]]; then
    sqlDbExists=$(az sql db show -g "${sql_rg}" -s "${sql_server}" -n "${e2e_sql_db}" --query id -o tsv 2>/dev/null || echo "")
fi

analytics_workspace="law-${stack_name}"
analyticsWorkspaceExists=""
if [[ -n "${analytics_rg:-}" ]]; then
    analyticsWorkspaceExists=$(az monitor log-analytics workspace show -g "${analytics_rg}" -n "${analytics_workspace}" --query "id" -o tsv 2>/dev/null || echo "")
fi

if [[ ${rgAppExists} != "true" && ${rgNetExists} != "true" && ${dbExists} != "true" && -z "${sqlDbExists}" && -z "${analyticsWorkspaceExists}" ]]; then
    echo "No branch resources found for hash ${hash_id} — nothing to clean up."
    exit 0
fi

[[ ${rgAppExists} != "true" ]] && echo "WARNING: App resource group ${app_rg} not found — may have been deleted already."
[[ ${rgNetExists} != "true" ]] && echo "WARNING: Network resource group ${network_rg} not found — may have been deleted already."

echo "Begin clean up of Azure resources for ${hash_id}."

# Tear down the branch's app and network tiers (CAMS-760, Option E).
#
# APP tier: NOT a deployment stack. main.bicep deploys resources cross-scope into
# SHARED resource groups (the app-config Key Vault + its role assignments and SQL
# vnet rules in AZURE_RG; the action group in the analytics RG). A deployment stack
# manages every resource its template creates in ANY resource group, so deleting an
# app stack would delete those shared resources — this is what deleted the shared
# kv-ustp-cams-dev (GH #2749). The app resources live in the per-branch app RG, so
# we tear them down by deleting that resource group directly. Deleting the per-branch
# app RG cannot touch shared resources, which live in other (shared) RGs.
#
# NETWORK tier: a self-contained per-branch deployment stack (network.bicep only
# touches the per-branch network RG). For per-branch teardown we delete the whole
# network RG directly rather than deleting the stack first: the branch's Key Vault
# private endpoint (pep-kv-ustp-cams-dev) is created in the network RG by the app-side
# kvSetup module and is NOT stack-managed, so a stack delete fails with
# InUseSubnetCannotBeDeleted (the PE still occupies the private-endpoint subnet).
# `az group delete` removes the PE, subnets, vnet, and stack in one shot regardless of
# ordering. Only when a shared network RG must be preserved (Slice 2,
# preserve_network_rg=true) do we fall back to a scoped stack delete.
#
# This preserve_network_rg=true branch (and stack_exists() below) is
# intentional Slice 2 scaffolding, not accreted dead code: no caller in this
# PR passes --unmanage-action, so it's unreachable on the active path today —
# it starts getting exercised once Slice 2's teardown workflow wires up
# `--unmanage-action=deleteResources` for real.
# Derived via generate-network-stackname.sh (single source of truth, in
# ops/scripts/pipeline/, sibling to azure-deploy-network.sh which creates
# this stack) rather than reconstructed inline here — a mismatch between the
# two would fail silently: stack_exists() below returns empty, teardown
# reports "nothing to delete", and the stack leaks with no error.
networkStack=$("$(dirname "${BASH_SOURCE[0]}")/../pipeline/generate-network-stackname.sh" "${stack_name}")

function stack_exists() {
    local name=$1
    local rg=$2
    # `list` (not `show`) so a genuinely absent stack is a normal empty result,
    # not a CLI error — mirrors az_vnet_exists_func's pattern in
    # azure-deploy-network.sh. The prior `show ... 2>/dev/null || echo ""`
    # mapped ANY failure (auth expiry, throttling, wrong subscription) to
    # "doesn't exist," so a transient error would both skip the stack delete
    # and report a false-clean verification — the exact class of bug already
    # fixed for the Smart Detection cleanup elsewhere in this script. This
    # only works if the caller captures the result as a plain statement
    # rather than inline inside a `[[ ]]` test — set -e ignores command
    # failures that occur as part of a test's condition.
    #
    # name's only current provenance is this script's own stack_name/hash_id
    # (not attacker-controllable), so this isn't exploitable today, but escape
    # embedded single quotes before interpolating into the JMESPath string
    # literal anyway, mirroring az_vnet_exists_func's hardening.
    local escapedName=${name//\'/\\\'}
    az stack group list --resource-group "${rg}" --query "[?name=='${escapedName}'].id" -o tsv
}

# Each target below is torn down in its own subshell: a failure aborts that
# target's own remaining steps without aborting the whole script, so one
# target's failure can't mask attempted cleanup of the others. Failures are
# recorded and reported together at the end, reusing the same `failed`-flag
# pattern the final verification already had.
#
# Each subshell is run as its own statement, its exit status captured via `$?`
# afterward, NOT as the direct condition of `if !`/`||` — Bash treats being the
# test of an `if` (even negated) as a context where `-e` is ignored, and that
# "ignored" status propagates INTO the subshell, silently disabling the
# `set -euo pipefail` declared inside it. `if ! ( set -e; risky; safe ); then`
# looks like it stops at `risky` on failure, but it actually runs `safe` too
# and often never sets `failed=true` at all. `set +e` around the bare subshell
# invocation, then checking the captured `$?` in a separate `if`, is the
# pattern that actually works — verified by mocked-CLI testing (CAMS-760).
failed=false
appTierFailed=false

# Disconnect VNET integration from App Service components prior to deleting resources
if [[ "${rgAppExists}" == "true" ]]; then
    set +e
    (
        set -euo pipefail
        echo "Start disconnecting VNET integration"
        # `|| true` on each: a missing app (partial prior deploy) is the same
        # "partial cleanup is normal" case this script already tolerates
        # elsewhere. Without it, a failed remove now correctly aborts this
        # subshell (since the set -e fix above), leaving the app RG in place
        # and undeleted — which can then make the network-tier delete below
        # fail with InUseSubnetCannotBeDeleted. Deleting the app RG/stack
        # releases the VNET integration anyway, so these removes are pure
        # best-effort cleanup, not a precondition for what follows.
        webapp="${stack_name}-webapp"
        az webapp vnet-integration remove -g "${app_rg}" -n "${webapp}" || true
        apiFunctionApp="${stack_name}-node-api"
        az functionapp vnet-integration remove -g "${app_rg}" -n "${apiFunctionApp}" || true
        echo "Completed disconnecting VNET integration"
        dataflowsFunctionApp="${stack_name}-dataflows"
        az functionapp vnet-integration remove -g "${app_rg}" -n "${dataflowsFunctionApp}" || true
        echo "Completed disconnecting VNET integration for dataflows"
        echo "Deleting app resource group ${app_rg} (per-branch; contains only branch-owned app resources)"
        az group delete -n "${app_rg}" --yes
    )
    subshellRc=$?
    set -e
    if [[ ${subshellRc} -ne 0 ]]; then
        echo "ERROR: Failed to clean up app tier for ${hash_id}; continuing with other targets." >&2
        failed=true
        appTierFailed=true
    fi
fi

# Gated on the app tier NOT having just failed (only relevant when the app RG
# existed to begin with — rgAppExists=false skips the block above entirely,
# so there's nothing to gate on): a failed app-RG/stack delete leaves this
# branch's function apps still VNET-integrated into subnets in the network
# RG, so attempting the network-tier delete now would just fail with the
# exact InUseSubnetCannotBeDeleted this feature exists to avoid, on top of
# the app-tier failure already reported. Skipping lets the next run retry
# both tiers cleanly instead of producing a second, noisy, expected failure.
if [[ "${rgNetExists}" == "true" && "${appTierFailed}" == "true" ]]; then
    echo "Skipping network tier cleanup for ${hash_id}: the app tier delete failed above, so its function apps are likely still VNET-integrated into subnets in ${network_rg} — deleting the network tier now would just fail with InUseSubnetCannotBeDeleted. Will retry both tiers on the next run." >&2
elif [[ "${rgNetExists}" == "true" ]]; then
    set +e
    (
        set -euo pipefail
        if [[ "${preserve_network_rg}" != "true" ]]; then
            # Per-branch network RG: delete the whole RG. This removes the network
            # stack, the vnet/subnets, and any stack-unmanaged resources (the KV
            # private endpoint) without hitting subnet-in-use ordering failures.
            echo "Deleting network resource group ${network_rg} (per-branch; removes vnet, subnets, and the KV private endpoint)"
            az group delete -n "${network_rg}" --yes
        else
            # Captured as its own statement (not inline inside the `[[ ]]`
            # test below) so a real stack_exists CLI failure aborts this
            # subshell via set -e, rather than being ignored because it
            # occurred as part of a test's condition.
            netStackId=$(stack_exists "${networkStack}" "${network_rg}")
            if [[ -n "${netStackId}" ]]; then
                # Shared network RG (Slice 2): preserve the RG, remove only this branch's stack.
                echo "Start deleting network deployment stack ${networkStack} (action-on-unmanage=${unmanage_action})"
                az stack group delete --name "${networkStack}" --resource-group "${network_rg}" --action-on-unmanage "${unmanage_action}" --yes
            else
                echo "No network deployment stack ${networkStack} found; nothing to delete in shared network RG"
            fi
        fi
    )
    subshellRc=$?
    set -e
    if [[ ${subshellRc} -ne 0 ]]; then
        echo "ERROR: Failed to clean up network tier for ${hash_id}; continuing with other targets." >&2
        failed=true
    fi
fi

if [[ "${dbExists}" == "true" ]]; then
    set +e
    (
        set -euo pipefail
        echo "Start deleting e2e test database ${e2e_db}"
        az cosmosdb mongodb database delete -g "${db_rg}" -a "${db_account}" -n "${e2e_db}" --yes
    )
    subshellRc=$?
    set -e
    if [[ ${subshellRc} -ne 0 ]]; then
        echo "ERROR: Failed to delete e2e test database ${e2e_db}; continuing with other targets." >&2
        failed=true
    fi
else
    echo "E2E database does not exist for branch hash ${hash_id}"
fi

# Delete SQL E2E database if SQL server params provided (existence already
# checked above, before the early-exit)
if [[ -n "${sql_server:-}" && -n "${sql_rg:-}" ]]; then
  if [[ -n "${sqlDbExists}" ]]; then
    set +e
    (
        set -euo pipefail
        echo "Deleting E2E SQL database ${e2e_sql_db}"
        az sql db delete -g "${sql_rg}" -s "${sql_server}" -n "${e2e_sql_db}" --yes
        echo "Completed deleting E2E SQL database ${e2e_sql_db}"
    )
    subshellRc=$?
    set -e
    if [[ ${subshellRc} -ne 0 ]]; then
        echo "ERROR: Failed to delete E2E SQL database ${e2e_sql_db}; continuing with other targets." >&2
        failed=true
    fi
  else
    echo "E2E SQL database ${e2e_sql_db} does not exist, skipping"
  fi
else
  echo "Skipping SQL database deletion (sql-server-name or sql-resource-group not provided)"
fi

# Delete Log Analytics Workspace and associated storage account if they exist
# (existence already checked above, before the early-exit)
if [[ -n "${analytics_rg:-}" ]]; then
  if [[ -n "${analyticsWorkspaceExists}" ]]; then
    set +e
    (
        set -euo pipefail
        # Find and delete the associated storage account first by querying linked storage accounts
        echo "Querying workspace ${analytics_workspace} for linked storage accounts"

        # Track deleted storage accounts to avoid duplicates (using space-delimited string)
        deleted_storage_accounts=""
        storage_account_count=0

        # Query the workspace's linked storage accounts
        # We check for common data sources: Alerts, CustomLogs, and Query
        for data_source_type in "Alerts" "CustomLogs" "Query"; do
          storage_account_ids=$(az monitor log-analytics workspace linked-storage show \
            -g "${analytics_rg}" \
            -n "${analytics_workspace}" \
            --type "${data_source_type}" \
            --query "storageAccountIds[]" -o tsv 2>/dev/null || echo "")

          if [[ -n "${storage_account_ids}" ]]; then
            for storage_account_id in ${storage_account_ids}; do
              # Extract storage account name from resource ID
              # Format: /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Storage/storageAccounts/{name}
              storage_account_name=$(echo "${storage_account_id}" | awk -F'/' '{print $NF}')
              echo "Found linked storage account: ${storage_account_name} (data source: ${data_source_type})"

              # Check if we've already deleted this storage account
              if [[ ! " ${deleted_storage_accounts} " == *" ${storage_account_name} "* ]]; then
                echo "Start deleting storage account ${storage_account_name}"
                az storage account delete -g "${analytics_rg}" -n "${storage_account_name}" --yes
                echo "Completed deleting storage account ${storage_account_name}"
                deleted_storage_accounts="${deleted_storage_accounts} ${storage_account_name}"
                storage_account_count=$((storage_account_count + 1))
              fi
            done
          fi
        done

        if [[ ${storage_account_count} -eq 0 ]]; then
          echo "No linked storage accounts found (may not have been created or already deleted)"
        fi

        # Now delete the workspace
        echo "Start deleting Log Analytics Workspace ${analytics_workspace}"
        az monitor log-analytics workspace delete -g "${analytics_rg}" -n "${analytics_workspace}" --yes --force
        echo "Completed deleting Log Analytics Workspace"
    )
    subshellRc=$?
    set -e
    if [[ ${subshellRc} -ne 0 ]]; then
        echo "ERROR: Failed to clean up Log Analytics Workspace ${analytics_workspace}; continuing with other targets." >&2
        failed=true
    fi
  else
    echo "Log Analytics Workspace does not exist for branch hash ${hash_id}"
  fi
else
  echo "Skipping Log Analytics Workspace deletion (analytics resource group not provided)"
fi

echo "Completed resource clean up operations."

# Verify nothing was left behind. The per-branch app RG is always deleted outright.
# The network tier's RG is deleted for per-branch RGs (preserve_network_rg=false);
# for a preserved shared network RG (Slice 2) verify the stack is gone instead.
# Reuses the same `failed` flag the teardown loop above set, so a teardown failure
# isn't masked even if the resource happens to look gone here.
if [[ $(az group exists -n "${app_rg}") == "true" ]]; then
    echo "ERROR: App resource group ${app_rg} still exists after deletion attempt." >&2
    failed=true
fi
if [[ "${preserve_network_rg}" != "true" ]]; then
    if [[ $(az group exists -n "${network_rg}") == "true" ]]; then
        echo "ERROR: Network resource group ${network_rg} still exists after deletion attempt." >&2
        failed=true
    fi
else
    # Unlike the teardown loop above, a failed probe here must not abort the
    # script outright — remaining verification (and the consolidated `failed`
    # report below) still needs to run. So the CLI failure is captured
    # explicitly via `$?` rather than left to set -e, and treated the same as
    # "stack still exists": a verification that can't be confirmed clean must
    # not be reported as clean.
    set +e
    netStackId=$(stack_exists "${networkStack}" "${network_rg}")
    stackCheckRc=$?
    set -e
    if [[ ${stackCheckRc} -ne 0 || -n "${netStackId}" ]]; then
        echo "ERROR: Network deployment stack ${networkStack} still exists after deletion attempt (or could not be verified)." >&2
        failed=true
    fi
fi
if [[ "${failed}" == "true" ]]; then
    error "One or more resources could not be deleted." 12
fi
