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
  echo "  --network-resource-group=<rg> Network resource group name. **REQUIRED**"
  echo "                                Can be set via NETWORK_RESOURCE_GROUP_BASE environment variable."
  echo "  --analytics-resource-group=<rg> Analytics resource group name."
  echo "                                Can be set via ANALYTICS_RESOURCE_GROUP environment variable."
  echo "                                Optional - skips analytics workspace deletion if not provided."
  echo "  --stack-name=<name>           Stack name for resource naming."
  echo "                                Can be set via STACK_NAME environment variable."
  echo "                                If not provided, attempts to derive from app resource group."
  echo "  --short-hash=<hash>           Branch hash ID. **REQUIRED**"
  echo "  --ignore-validation           Ignore validation checks."
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
ignore=false # if true, ignore validation

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
    --ignore-validation)
      ignore=true
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
  net_rg=${net_rg:-${NETWORK_RESOURCE_GROUP_BASE:-}}
  analytics_rg=${analytics_rg:-${ANALYTICS_RESOURCE_GROUP:-}}
  stack_name=${stack_name:-${STACK_NAME:-}}

  if [[ -z "${app_rg:-}" || -z "${db_account:-}" || -z "${db_rg:-}" || -z "${net_rg:-}" || -z "${hash_id:-}" ]]; then
  error "Not all required parameters provided. Run this script with the --help flag for details, or set the appropriate environment variables." 2
fi

# Check that resource groups exists
app_rg="${app_rg}-${hash_id}"
network_rg="${net_rg}-${hash_id}"
e2e_db="cams-e2e-${hash_id}"

# Derive stack name if not provided
# Stack name is used for resource naming (e.g., webapp, function apps, log analytics workspace)
if [[ -z "${stack_name}" ]]; then
  # Try to derive from app resource group name pattern
  # Expected pattern: "something-${hash_id}", we want to extract base and construct stack name
  # This is a fallback for backward compatibility
  echo "Warning: --stack-name not provided. Resource names that depend on stack name may not be found."
  echo "         Consider providing --stack-name parameter for full cleanup."
  stack_name=""
else
  stack_name="${stack_name}-${hash_id}"
fi
rgAppExists=$(az group exists -n "${app_rg}")
rgNetExists=$(az group exists -n "${network_rg}")
dbExists=$(az cosmosdb mongodb database exists -g "${db_rg}" -a "${db_account}" -n "${e2e_db}")
if [[ ${rgAppExists} != "true" || ${rgNetExists} != "true" ]]; then
    if [[ "${ignore}" != "true" ]]; then
        error "Expected resource group and/or database missing." 11
    fi
fi

echo "Begin clean up of Azure resources for ${hash_id}."

# Disconnect VNET integration from App Service components prior to deleting resources
if [[ "${rgAppExists}" == "true" && -n "${stack_name}" ]]; then
    echo "Start disconnecting VNET integration"
    webapp="${stack_name}-webapp"
    az webapp vnet-integration remove -g "${app_rg}" -n "${webapp}"
    apiFunctionApp="${stack_name}-node-api"
    az functionapp vnet-integration remove -g "${app_rg}" -n "${apiFunctionApp}"
    echo "Completed disconnecting VNET integration"
    dataflowsFunctionApp="${stack_name}-dataflows"
    az functionapp vnet-integration remove -g "${app_rg}" -n "${dataflowsFunctionApp}"
    echo "Completed disconnecting VNET integration"
elif [[ "${rgAppExists}" == "true" && -z "${stack_name}" ]]; then
    echo "Skipping VNET integration disconnect (stack name not provided)"
fi

# Delete by resource group
if [[ "${rgAppExists}" == "true" ]]; then
    echo "Start deleting app resource group ${app_rg}"
    az group delete -n "${app_rg}" --yes
fi

if [[ "${rgNetExists}" == "true" ]]; then
    echo "Start deleting network resource group ${network_rg}"
    az group delete -n "${network_rg}" --yes
fi

if [[ "${dbExists}" == "true" ]]; then
  echo "Start deleting e2e test database ${e2e_db}"
  az cosmosdb mongodb database delete -g "${db_rg}" -a "${db_account}" -n "${e2e_db}" --yes
elif [[ "${dbExists}" != "true" ]]; then
  echo "E2E database does not exist for branch has ${hash_id}"
fi

# Delete Log Analytics Workspace and associated storage account if they exist
if [[ -n "${stack_name}" && -n "${analytics_rg}" ]]; then
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
elif [[ -z "${stack_name}" ]]; then
  echo "Skipping Log Analytics Workspace deletion (stack name not provided)"
elif [[ -z "${analytics_rg}" ]]; then
  echo "Skipping Log Analytics Workspace deletion (analytics resource group not provided)"
fi

echo "Completed resource clean up operations."
