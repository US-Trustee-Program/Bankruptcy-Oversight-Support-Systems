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

  if [[ -z "${app_rg:-}" || -z "${db_account:-}" || -z "${db_rg:-}" || -z "${net_rg:-}" || -z "${stack_name:-}" || -z "${hash_id:-}" ]]; then
  error "Not all required parameters provided. Run this script with the --help flag for details, or set the appropriate environment variables." 2
fi

# Check which resources exist (partial cleanup is normal if a previous run partially succeeded)
app_rg="${app_rg}-${hash_id}"
network_rg="${net_rg}-${hash_id}"
e2e_db="cams-e2e-${hash_id}"
stack_name="${stack_name}-${hash_id}"

# Safety guard (CAMS-760, GH #2749): this script deletes the app and network resource
# groups outright. Those MUST be the per-branch, hash-suffixed RGs — never a shared RG.
# A misconfiguration that made app_rg/network_rg resolve to a shared RG (e.g. the KV/DB
# RG AZURE_RG, the SQL RG, or the analytics RG) would delete shared infrastructure, as
# happened when the shared dev Key Vault was deleted. Abort before touching anything if
# a delete target is not hash-suffixed, or if it (or its base name) is a known shared RG.
for rg_var in app_rg network_rg; do
    rg_val="${!rg_var}"
    if [[ "${rg_val}" != *"-${hash_id}" ]]; then
        error "Refusing to delete ${rg_var}='${rg_val}': not suffixed with branch hash '-${hash_id}'. This must be a per-branch resource group." 20
    fi
    # Compare both the full name and the base (name without the '-<hash>' suffix)
    # against every known shared RG, so neither form can slip through.
    rg_base="${rg_val%-"${hash_id}"}"
    for shared in "${db_rg}" "${sql_rg:-}" "${analytics_rg:-}"; do
        if [[ -n "${shared}" && ( "${rg_val}" == "${shared}" || "${rg_base}" == "${shared}" ) ]]; then
            error "Refusing to delete ${rg_var}='${rg_val}': it (or its base '${rg_base}') matches a SHARED resource group '${shared}'. Aborting to protect shared infrastructure (GH #2749)." 21
        fi
    done
done

rgAppExists=$(az group exists -n "${app_rg}")
rgNetExists=$(az group exists -n "${network_rg}")
dbExists=$(az cosmosdb mongodb database exists -g "${db_rg}" -a "${db_account}" -n "${e2e_db}")

if [[ ${rgAppExists} != "true" && ${rgNetExists} != "true" && ${dbExists} != "true" ]]; then
    echo "No branch resources found for hash ${hash_id} — nothing to clean up."
    exit 0
fi

[[ ${rgAppExists} != "true" ]] && echo "WARNING: App resource group ${app_rg} not found — may have been deleted already."
[[ ${rgNetExists} != "true" ]] && echo "WARNING: Network resource group ${network_rg} not found — may have been deleted already."

echo "Begin clean up of Azure resources for ${hash_id}."

# Disconnect VNET integration from App Service components prior to deleting resources
if [[ "${rgAppExists}" == "true" ]]; then
    echo "Start disconnecting VNET integration"
    webapp="${stack_name}-webapp"
    az webapp vnet-integration remove -g "${app_rg}" -n "${webapp}"
    apiFunctionApp="${stack_name}-node-api"
    az functionapp vnet-integration remove -g "${app_rg}" -n "${apiFunctionApp}"
    echo "Completed disconnecting VNET integration"
    dataflowsFunctionApp="${stack_name}-dataflows"
    az functionapp vnet-integration remove -g "${app_rg}" -n "${dataflowsFunctionApp}"
    echo "Completed disconnecting VNET integration for dataflows"
fi

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
# touches the per-branch network RG). `az stack group delete` accepts deleteAll,
# deleteResources, or detachAll — NONE delete the resource group itself and none
# touch stack-unmanaged resources — so after the stack delete we also `az group
# delete` the per-branch network RG to remove the empty RG and any stragglers.
# In Slice 2 (shared network RG) unmanage_action will be deleteResources and the RG
# preserved.
networkStack="${stack_name}-network"

function stack_exists() {
    local name=$1
    local rg=$2
    az stack group show --name "${name}" --resource-group "${rg}" --query id -o tsv 2>/dev/null || echo ""
}

if [[ "${rgAppExists}" == "true" ]]; then
    echo "Deleting app resource group ${app_rg} (per-branch; contains only branch-owned app resources)"
    az group delete -n "${app_rg}" --yes
fi

if [[ "${rgNetExists}" == "true" ]]; then
    if [[ -n "$(stack_exists "${networkStack}" "${network_rg}")" ]]; then
        echo "Start deleting network deployment stack ${networkStack} (action-on-unmanage=${unmanage_action})"
        az stack group delete --name "${networkStack}" --resource-group "${network_rg}" --action-on-unmanage "${unmanage_action}" --yes
    else
        echo "No network deployment stack ${networkStack} found (pre-stack branch); will delete resource group directly"
    fi
    # Remove the per-branch network RG (and any stack-unmanaged stragglers) unless a
    # shared network RG must be preserved (unmanage_action=deleteResources, Slice 2).
    if [[ "${unmanage_action}" != "deleteResources" ]]; then
        echo "Deleting network resource group ${network_rg} (removes empty RG and any unmanaged resources)"
        az group delete -n "${network_rg}" --yes
    fi
fi

if [[ "${dbExists}" == "true" ]]; then
  echo "Start deleting e2e test database ${e2e_db}"
  az cosmosdb mongodb database delete -g "${db_rg}" -a "${db_account}" -n "${e2e_db}" --yes
elif [[ "${dbExists}" != "true" ]]; then
  echo "E2E database does not exist for branch has ${hash_id}"
fi

# Delete SQL E2E database if SQL server params provided
if [[ -n "${sql_server:-}" && -n "${sql_rg:-}" ]]; then
  e2e_sql_db="CAMS_E2E-${hash_id}"
  echo "Checking for E2E SQL database ${e2e_sql_db}"
  sqlDbExists=$(az sql db show -g "${sql_rg}" -s "${sql_server}" -n "${e2e_sql_db}" --query id -o tsv 2>/dev/null || echo "")
  if [[ -n "${sqlDbExists}" ]]; then
    echo "Deleting E2E SQL database ${e2e_sql_db}"
    az sql db delete -g "${sql_rg}" -s "${sql_server}" -n "${e2e_sql_db}" --yes
    echo "Completed deleting E2E SQL database ${e2e_sql_db}"
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
  else
    echo "Log Analytics Workspace does not exist for branch hash ${hash_id}"
  fi
else
  echo "Skipping Log Analytics Workspace deletion (analytics resource group not provided)"
fi

echo "Completed resource clean up operations."

# Verify nothing was left behind. The per-branch app RG is always deleted outright.
# The network tier's RG is deleted for per-branch RGs (unmanage_action != deleteResources);
# for a preserved shared network RG (deleteResources, Slice 2) verify the stack is gone.
failed=false
if [[ $(az group exists -n "${app_rg}") == "true" ]]; then
    echo "ERROR: App resource group ${app_rg} still exists after deletion attempt." >&2
    failed=true
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
