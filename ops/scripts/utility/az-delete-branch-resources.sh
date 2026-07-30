#!/usr/bin/env bash

# Title:        az-delete-branch-resources.sh
# Description:  Clean up USTP CAMS Azure resources provisioned for a development branch deployment by hash id.
# Prerequisite:
#               - Azure CLI
# Usage:        ./az-delete-branch-resources.sh <hash_id> <ignore>
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

  if [[ -z "${app_rg:-}" || -z "${db_account:-}" || -z "${db_rg:-}" || -z "${kv_rg:-}" || -z "${net_rg:-}" || -z "${stack_name:-}" || -z "${hash_id:-}" ]]; then
  error "Not all required parameters provided. Run this script with the --help flag for details, or set the appropriate environment variables." 2
fi

# Check which resources exist (partial cleanup is normal if a previous run partially succeeded)
#
# Slice 2 (unmanage_action=deleteResources): app_rg/network_rg are ALREADY the
# correct shared base names passed in by the caller — do NOT suffix them with
# the branch hash, that would point at a per-branch RG that no longer exists.
# Legacy per-branch mode (deleteAll): suffix with the branch hash, as before.
if [[ "${unmanage_action}" == "deleteResources" ]]; then
    network_rg="${net_rg}"
else
    app_rg="${app_rg}-${hash_id}"
    network_rg="${net_rg}-${hash_id}"
fi
e2e_db="cams-e2e-${hash_id}"
stack_name="${stack_name}-${hash_id}"
appStack="${stack_name}-app"
networkStack="${stack_name}-network"

function stack_exists() {
    local name=$1
    local rg=$2
    az stack group show --name "${name}" --resource-group "${rg}" --query id -o tsv 2>/dev/null || echo ""
}

# Safety guard (CAMS-760, GH #2749). The hash-suffix check applies only to the
# legacy per-branch path, where this script deletes the resource group
# outright — it MUST be the per-branch, hash-suffixed RG, never a shared RG.
# The deleteResources path never deletes a resource group at all (only this
# branch's own stack within it), so a shared, un-suffixed RG name is the
# CORRECT and expected input there, not a violation.
#
# The shared-RG membership check below runs UNCONDITIONALLY in both modes
# (pre-flight sanity check): an app_rg/network_rg that accidentally resolves to
# the KV RG, DB RG, SQL RG, or analytics RG is a misconfiguration either way,
# and a deleteResources run would otherwise silently target the wrong RG's
# deployment stack with no RG-existence check to catch it (a shared RG always
# exists). The Key Vault's RG is checked explicitly via --kv-resource-group
# rather than relying on it happening to equal --db-resource-group (which is
# all that protected it before this fix — coincidental, not guaranteed;
# GH #2749).
for rg_var in app_rg network_rg; do
    rg_val="${!rg_var}"
    if [[ "${unmanage_action}" != "deleteResources" && "${rg_val}" != *"-${hash_id}" ]]; then
        error "Refusing to delete ${rg_var}='${rg_val}': not suffixed with branch hash '-${hash_id}'. This must be a per-branch resource group." 20
    fi
    # Compare both the full name and the base (name without the '-<hash>'
    # suffix, a no-op when the RG isn't hash-suffixed) against every known
    # shared RG, case-folded since Azure RG names are case-insensitive at the
    # ARM level (plain Bash `==` is not).
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

# What indicates "this branch has something to tear down" differs by mode: for a
# per-branch RG, RG existence IS the signal. For a shared RG (deleteResources)
# the RG always exists (main and other branches live there too) — the real
# signal is whether THIS branch's own stack exists.
if [[ "${unmanage_action}" == "deleteResources" ]]; then
    appExists=$([[ -n "$(stack_exists "${appStack}" "${app_rg}")" ]] && echo true || echo false)
    netExists=$([[ -n "$(stack_exists "${networkStack}" "${network_rg}")" ]] && echo true || echo false)
else
    appExists="${rgAppExists}"
    netExists="${rgNetExists}"
fi

if [[ "${appExists}" != "true" && "${netExists}" != "true" && "${dbExists}" != "true" ]]; then
    echo "No branch resources found for hash ${hash_id} — nothing to clean up."
    exit 0
fi

[[ "${appExists}" != "true" ]] && echo "WARNING: App resources for hash ${hash_id} not found — may have been deleted already."
[[ "${netExists}" != "true" ]] && echo "WARNING: Network resources for hash ${hash_id} not found — may have been deleted already."

echo "Begin clean up of Azure resources for ${hash_id}."

# Tear down the branch's app and network tiers (CAMS-760, Option E).
#
# APP tier: a self-contained per-branch deployment stack. The genuinely shared
# cross-scope resources (the app-config Key Vault + its role assignments, and the
# SQL managed identity) are deployed separately by app-shared-setup.bicep, always
# as a plain (non-stack) deployment, so the app stack itself only ever manages
# app-RG-scoped resources (webapp, functions, app insights, plans, comms/email).
# An earlier version wrapped those cross-scope resources into the branch's own
# app stack, and a teardown deleted the shared kv-ustp-cams-dev (GH #2749) — this
# split is what makes stacking the app tier safe. For per-branch teardown we
# delete the whole app RG directly rather than deleting the stack first, mirroring
# the network tier's per-branch behavior below. Only when a shared app RG must be
# preserved (Slice 2, unmanage_action=deleteResources) do we fall back to a scoped
# stack delete.
#
# NETWORK tier: a self-contained per-branch deployment stack (network.bicep only
# touches the per-branch network RG). For per-branch teardown we delete the whole
# network RG directly rather than deleting the stack first: the branch's Key Vault
# private endpoint (pep-kv-ustp-cams-dev) is created in the network RG by
# app-shared-setup.bicep's kvSetup module and is NOT stack-managed, so a stack
# delete fails with InUseSubnetCannotBeDeleted (the PE still occupies the
# private-endpoint subnet). `az group delete` removes the PE, subnets, vnet, and
# stack in one shot regardless of ordering. Only when a shared network RG must be
# preserved (Slice 2, unmanage_action=deleteResources) do we fall back to a scoped
# stack delete.
#
# Each target below is torn down in its own subshell: a failure aborts that
# target's own remaining steps (subshells keep `set -e` semantics) without
# aborting the whole script, so one target's failure can't mask attempted
# cleanup of the others. Failures are recorded and reported together at the
# end, reusing the same `failed`-flag pattern the final verification already had.
failed=false

if [[ "${appExists}" == "true" ]]; then
    if ! (
        set -euo pipefail
        echo "Start disconnecting VNET integration"
        webapp="${stack_name}-webapp"
        az webapp vnet-integration remove -g "${app_rg}" -n "${webapp}"
        apiFunctionApp="${stack_name}-node-api"
        az functionapp vnet-integration remove -g "${app_rg}" -n "${apiFunctionApp}"
        echo "Completed disconnecting VNET integration"
        dataflowsFunctionApp="${stack_name}-dataflows"
        az functionapp vnet-integration remove -g "${app_rg}" -n "${dataflowsFunctionApp}"
        echo "Completed disconnecting VNET integration for dataflows"

        if [[ "${unmanage_action}" != "deleteResources" ]]; then
            # Per-branch app RG: delete the whole RG.
            echo "Deleting app resource group ${app_rg} (per-branch; contains only branch-owned app resources)"
            az group delete -n "${app_rg}" --yes
        else
            # Shared app RG (Slice 2): preserve the RG, remove only this branch's stack.
            echo "Start deleting app deployment stack ${appStack} (action-on-unmanage=${unmanage_action})"
            az stack group delete --name "${appStack}" --resource-group "${app_rg}" --action-on-unmanage "${unmanage_action}" --yes

            # Application Insights auto-creates Smart Detection alert rules that are
            # never declared in bicep, so the stack never manages/deletes them. The
            # per-branch path sweeps these up for free via the whole-RG delete above;
            # the shared-RG path cannot do that, so clean them up by name instead.
            echo "Checking for stack-unmanaged Smart Detection alert rules for ${stack_name}"
            # No `2>/dev/null || true` here: that would swallow a genuine az CLI
            # failure (auth expiry, throttling) the same way as "no rules found,"
            # silently skipping cleanup instead of failing this subshell (and
            # tripping the `failed` flag) the way every other target in this
            # script does.
            smartDetectorRuleIdsRaw=$(az resource list -g "${app_rg}" --resource-type microsoft.alertsmanagement/smartDetectorAlertRules --query "[?starts_with(name, 'Failure Anomalies - appi-${stack_name}')].id" -o tsv)
            mapfile -t smartDetectorRuleIds <<< "${smartDetectorRuleIdsRaw}"
            if [[ ${#smartDetectorRuleIds[@]} -eq 1 && -z "${smartDetectorRuleIds[0]}" ]]; then
                smartDetectorRuleIds=()
            fi
            if [[ ${#smartDetectorRuleIds[@]} -gt 0 ]]; then
                for ruleId in "${smartDetectorRuleIds[@]}"; do
                    echo "Deleting stack-unmanaged Smart Detection alert rule: ${ruleId}"
                    az resource delete --ids "${ruleId}"
                done
            else
                echo "No stack-unmanaged Smart Detection alert rules found for ${stack_name}"
            fi
        fi
    ); then
        echo "ERROR: Failed to clean up app tier for ${hash_id}; continuing with other targets." >&2
        failed=true
    fi
fi

if [[ "${netExists}" == "true" ]]; then
    if ! (
        set -euo pipefail
        if [[ "${unmanage_action}" != "deleteResources" ]]; then
            # Per-branch network RG: delete the whole RG. This removes the network
            # stack, the vnet/subnets, and any stack-unmanaged resources (the KV
            # private endpoint) without hitting subnet-in-use ordering failures.
            echo "Deleting network resource group ${network_rg} (per-branch; removes vnet, subnets, and the KV private endpoint)"
            az group delete -n "${network_rg}" --yes
        elif [[ -n "$(stack_exists "${networkStack}" "${network_rg}")" ]]; then
            # Shared network RG (Slice 2): preserve the RG, remove only this branch's stack.
            echo "Start deleting network deployment stack ${networkStack} (action-on-unmanage=${unmanage_action})"
            az stack group delete --name "${networkStack}" --resource-group "${network_rg}" --action-on-unmanage "${unmanage_action}" --yes
        else
            echo "No network deployment stack ${networkStack} found; nothing to delete in shared network RG"
        fi
    ); then
        echo "ERROR: Failed to clean up network tier for ${hash_id}; continuing with other targets." >&2
        failed=true
    fi
fi

if [[ "${dbExists}" == "true" ]]; then
    if ! (
        set -euo pipefail
        echo "Start deleting e2e test database ${e2e_db}"
        az cosmosdb mongodb database delete -g "${db_rg}" -a "${db_account}" -n "${e2e_db}" --yes
    ); then
        echo "ERROR: Failed to delete e2e test database ${e2e_db}; continuing with other targets." >&2
        failed=true
    fi
else
    echo "E2E database does not exist for branch hash ${hash_id}"
fi

# Delete SQL E2E database if SQL server params provided
if [[ -n "${sql_server:-}" && -n "${sql_rg:-}" ]]; then
  e2e_sql_db="CAMS_E2E-${hash_id}"
  echo "Checking for E2E SQL database ${e2e_sql_db}"
  sqlDbExists=$(az sql db show -g "${sql_rg}" -s "${sql_server}" -n "${e2e_sql_db}" --query id -o tsv 2>/dev/null || echo "")
  if [[ -n "${sqlDbExists}" ]]; then
    if ! (
        set -euo pipefail
        echo "Deleting E2E SQL database ${e2e_sql_db}"
        az sql db delete -g "${sql_rg}" -s "${sql_server}" -n "${e2e_sql_db}" --yes
        echo "Completed deleting E2E SQL database ${e2e_sql_db}"
    ); then
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
if [[ -n "${analytics_rg}" ]]; then
  analytics_workspace="law-${stack_name}"
  echo "Checking for Log Analytics Workspace ${analytics_workspace} in resource group ${analytics_rg}"
  analyticsWorkspaceExists=$(az monitor log-analytics workspace show -g "${analytics_rg}" -n "${analytics_workspace}" --query "id" -o tsv 2>/dev/null || echo "")

  if [[ -n "${analyticsWorkspaceExists}" ]]; then
    if ! (
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
    ); then
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

# Verify nothing was left behind. Per-branch RGs (unmanage_action != deleteResources)
# are deleted outright and verified gone; for a preserved shared RG (deleteResources,
# Slice 2) verify each tier's stack is gone instead. Reuses the same `failed` flag
# the teardown loop above set, so a teardown failure isn't masked even if the
# resource happens to look gone here.
if [[ "${unmanage_action}" != "deleteResources" ]]; then
    if [[ $(az group exists -n "${app_rg}") == "true" ]]; then
        echo "ERROR: App resource group ${app_rg} still exists after deletion attempt." >&2
        failed=true
    fi
else
    if [[ -n "$(stack_exists "${appStack}" "${app_rg}")" ]]; then
        echo "ERROR: App deployment stack ${appStack} still exists after deletion attempt." >&2
        failed=true
    fi
fi
if [[ "${unmanage_action}" != "deleteResources" ]]; then
    if [[ $(az group exists -n "${network_rg}") == "true" ]]; then
        echo "ERROR: Network resource group ${network_rg} still exists after deletion attempt." >&2
        failed=true
    fi
else
    if [[ -n "$(stack_exists "${networkStack}" "${network_rg}")" ]]; then
        echo "ERROR: Network deployment stack ${networkStack} still exists after deletion attempt." >&2
        failed=true
    fi
fi
if [[ "${failed}" == "true" ]]; then
    error "One or more resources could not be deleted." 12
fi
