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
# 1   Required parameter not provided
# 10+ Validation check errors


############################################################
# Help                                                     #
############################################################
Help()
{
   # Display Help
   echo "This script prints branch names and their short hashes or checks a"
   echo "known short hash against existing branches. Default lists remote"
   echo "branches and their short hashes."
   echo
   echo "Syntax: ./ops/scripts/utility/check-env-hashes.sh [-l|h|r|e {hash}]"
   echo "options:"
   echo "a     Database account name. **Required**"
   echo "b     Branch hash id. **Required**"
   echo "g     App resource group name. **Required**"
   echo "h     Print this Help and exit."
   echo "i     Ignore validation flag. **Not set by default**"
   echo "n     Network resource group name. **Required**"
   echo "r     Database resource group name. **Required**"
   echo "      Example usage: -b 0a3de4 -r db-resource-group -a my-cosmos-account -n network-resource-group -g app-resource-group -i"
   echo
}

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

############################################################
# Error                                                     #
############################################################
function error() {
    local msg=$1
    local code=$2
    echo "ERROR: ${msg}" >>/dev/stderr
    exit "${code}"
}

ignore=false # if true, ignore validation

while getopts ":hb:r:a:n:g:i" option; do
  case $option in
    h) # display help
      Help
      exit;;
    b) # Branch hash id
      hash_id=${OPTARG}
      ;;
    r) # Database resource group name
      db_rg=${OPTARG}
      ;;
    a) # Database account name
      db_account=${OPTARG}
      ;;
    n) # Network resource group name
      net_rg=${OPTARG}
      ;;
    g) # App resource group name
      rg_name=${OPTARG}
      ;;
    i) # Ignore validation
      ignore=true
      ;;
    \?) # Invalid option
      echo "Run with the '-h' option to see valid usage."
      exit 1
      ;;
  esac
done

echo "Begin clean up of Azure resources for ${hash_id}"

if [[ -z "${hash_id}" || -z "${db_rg}" || -z "${db_account}" ]]; then
  error "Branch hash id, database resource group name, and database account name are all required." 1
fi

# Check that resource groups exists
app_rg="${rg_name}-${hash_id}"
network_rg="${net_rg}-${hash_id}"
e2e_db="cams-e2e-${hash_id}"
rgAppExists=$(az group exists -n "${app_rg}")
rgNetExists=$(az group exists -n "${network_rg}")
dbExists=$(az cosmosdb mongodb database exists -g "${db_rg}" -a "${db_account}" -n "${e2e_db}")
if [[ ${rgAppExists} != "true" || ${rgNetExists} != "true" || ${dbExists} != "true" ]]; then
    if [[ "${ignore}" != "true" ]]; then
        error "Expected resource group and/or database missing." 11
    fi
fi

# Disconnect VNET integration from App Service components prior to deleting resources
if [[ "${rgAppExists}" == "true" ]]; then
    echo "Start disconnecting VNET integration"
    webapp="ustp-cams-dev-${hash_id}-webapp"
    az webapp vnet-integration remove -g "${app_rg}" -n "${webapp}"
    apiFunctionApp="ustp-cams-dev-${hash_id}-node-api"
    az functionapp vnet-integration remove -g "${app_rg}" -n "${apiFunctionApp}"
    echo "Completed disconnecting VNET integration"
    migrationFunctionApp="ustp-cams-dev-${hash_id}-migration"
    az functionapp vnet-integration remove -g "${app_rg}" -n "${migrationFunctionApp}"
    echo "Completed disconnecting VNET integration"
fi

# Delete by resource group
if [[ "${rgAppExists}" == "true" ]]; then
    echo "Start deleting resource group ${app_rg}"
    az group delete -n "${app_rg}" --yes
fi

if [[ "${rgNetExists}" == "true" ]]; then
    echo "Start deleting resource group ${network_rg}"
    az group delete -n "${network_rg}" --yes
fi

if [[ "${dbExists}" == "true" ]]; then
  echo "Start deleting e2e test database ${e2e_db}"
  az cosmosdb mongodb database delete -g bankruptcy-oversight-support-systems -a cosmos-mongo-ustp-cams-dev -n "${e2e_db}" --yes
fi


echo "Completed resource clean up operations."
