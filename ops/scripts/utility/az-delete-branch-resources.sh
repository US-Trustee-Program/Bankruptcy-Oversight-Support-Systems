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

  if [[ -z "${app_rg:-}" || -z "${db_account:-}" || -z "${db_rg:-}" || -z "${net_rg:-}" || -z "${hash_id:-}" ]]; then
  error "Not all required parameters provided. Run this script with the --help flag for details, or set the appropriate environment variables." 2
fi

# Check that resource groups exists
app_rg="${app_rg}-${hash_id}"
network_rg="${net_rg}-${hash_id}"
e2e_db="cams-e2e-${hash_id}"
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
if [[ "${rgAppExists}" == "true" ]]; then
    echo "Start disconnecting VNET integration"
    webapp="ustp-cams-dev-${hash_id}-webapp"
    az webapp vnet-integration remove -g "${app_rg}" -n "${webapp}"
    apiFunctionApp="ustp-cams-dev-${hash_id}-node-api"
    az functionapp vnet-integration remove -g "${app_rg}" -n "${apiFunctionApp}"
    echo "Completed disconnecting VNET integration"
    dataflowsFunctionApp="ustp-cams-dev-${hash_id}-dataflows"
    az functionapp vnet-integration remove -g "${app_rg}" -n "${dataflowsFunctionApp}"
    echo "Completed disconnecting VNET integration"
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
  az cosmosdb mongodb database delete -g bankruptcy-oversight-support-systems -a cosmos-mongo-ustp-cams-dev -n "${e2e_db}" --yes
elif [[ "${dbExists}" != "true" ]]; then
  echo "E2E database does not exist for branch has ${hash_id}"
fi

echo "Completed resource clean up operations."
