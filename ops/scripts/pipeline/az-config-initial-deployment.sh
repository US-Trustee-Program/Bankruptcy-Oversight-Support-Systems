#!/usr/bin/env bash

# Title:        az-func-deploy.sh
# Description:  Helper script to deploy function build artifact to existing Azure site
# Usage:        ./az-func-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n functionappName
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors

set -euo pipefail # ensure job step fails in CI pipeline when error occurs
sql_id_name=''

while [[ $# -gt 0 ]]; do
    case $1 in
    -h | --help)
        echo "USAGE: az-config-initial-deployment.sh -h --resource-group resourceGroupName --apiName apiName --webappName webappName --apiSettings=\"key1=value1 key2=value2\" --cosmosIdName cosmosManagedIdentityName --kvIdName keyVaultManagedIddentityName --sqlIdName sqlManagedIdName --identitiesResourceGroup identitiesResourceGroup"
        exit 0
        ;;

    --resourceGroup)
        app_rg="${2}"
        shift 2
        ;;

# TODO : Should be refactor so that all identities do not have to belong to a single resource
    --identitiesResourceGroup)
        id_rg="${2}"
        shift 2
        ;;

    --apiName)
        api_name="${2}"
        shift 2
        ;;

    --webappName)
        webapp_name="${2}"
        shift 2
        ;;

    --apiSettings)
        api_settings="${2}"
        shift 2
        ;;

    --kvIdName)
        kv_id_name="${2}"
        shift 2
        ;;

    --sqlIdName)
        sql_id_name="${2}"
        shift 2
        ;;

    --cosmosIdName)
        cosmos_id_name="${2}"
        shift 2
        ;;
    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

# set ruleName in case of exit or other scenarios
ruleName="agent-cams-gha-runner" # rule name has a 32 character limit

function on_exit() {
    # always try to remove temporary access
    az functionapp config access-restriction remove -g "${app_rg}" -n "${api_name}" --rule-name "${ruleName}" --scm-site true 1>/dev/null
    az webapp config access-restriction remove -g "${app_rg}" -n "${webapp_name}" --rule-name "${ruleName}" --scm-site true 1>/dev/null
}
trap on_exit EXIT

# allow build agent access to execute deployment
agentIp=$(curl -s --retry 3 --retry-delay 30 --retry-all-errors https://api.ipify.org)
az functionapp config access-restriction add -g "${app_rg}" -n "${api_name}" --rule-name "${ruleName}" --action Allow --ip-address "${agentIp}" --priority 232 --scm-site true 1>/dev/null
az webapp config access-restriction add -g "${app_rg}" -n "${webapp_name}" --rule-name "${ruleName}" --action Allow --ip-address "${agentIp}" --priority 232 --scm-site true 1>/dev/null


echo "Assigning Node API managed Identities..."
# Identities occasionally come through with improper id for usage here, this constructs that
kv_ref_id=$(az identity list -g "$id_rg" --query "[?name == '$kv_id_name'].id" -o tsv)
cosmos_ref_id=$(az identity list -g "$id_rg" --query "[?name == '$cosmos_id_name'].id" -o tsv)
identities="$kv_ref_id $cosmos_ref_id"
# In USTP we do not use managed ID for SQL, we might not have this
if [[ ${sql_id_name} != null && ${sql_id_name} != '' ]]; then
    sql_ref_id=$(az identity list -g "$id_rg" --query "[?name == '$sql_id_name'].id" -o tsv)
    identities="$identities $sql_ref_id"
fi
# shellcheck disable=SC2086 # REASON: Adds unwanted quotes after --identities
az functionapp identity assign -g "$app_rg" -n "$api_name" --identities $identities

echo "Setting KeyVaultReferenceIdentity..."
az functionapp update --resource-group "$app_rg"  --name "$api_name" --set keyVaultReferenceIdentity="$kv_ref_id"

# configure Node Api Application Settings
echo "Set Application Settings for ${api_name}"
# shellcheck disable=SC2086 # REASON: Adds unwanted quotes after --settings
az functionapp config appsettings set -g "${app_rg}" -n "${api_name}" --settings ${api_settings} --query "[].name" --output tsv

echo "Configuring Webapp container runtime..."
# Configure Webapp Alternative workaround to set Azure app service container runtime
az webapp config set -g "${app_rg}" -n "${webapp_name}" --linux-fx-version "PHP|8.2" 1>/dev/null
