#!/bin/bash

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
enable_debug=false
while [[ $# > 0 ]]; do
    case $1 in
    -h | --help)
        echo "USAGE: az-func-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n functionappName --settings=\"key1=value1 key2=value2\""
        exit 0
        shift
        ;;

    -d | --debug)
        enable_debug=true
        shift
        ;;

    -g | --resourceGroup)
        app_rg="${2}"
        shift 2
        ;;

    -n | --name)
        app_name="${2}"
        shift 2
        ;;

    -s | --src)
        artifact_path="${2}"
        shift 2
        ;;

    --settings)
        app_settings="${2}"
        shift 2
        ;;

    --identities)
        identities="${2}"
        shift 2
        ;;

    --identitiesResourceGroup) # TODO : Should be refactor so that all identities do not have to belong to a single resource
        id_rg="${2}"
        shift 2
        ;;

    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

# set ruleName in case of exit or other scenarios
ruleName="agent-${app_name:0:26}" # rule name has a 32 character limit

function on_exit() {
    # always try to remove temporary access
    az functionapp config access-restriction remove -g $app_rg -n $app_name --rule-name $ruleName --scm-site true 1>/dev/null
}
trap on_exit EXIT

if [ ! -f "$artifact_path" ]; then
    echo "Error: missing build artifact ${artifact_path}"
    exit 10
fi

# allow build agent access to execute deployment
agentIp=$(curl -s https://api.ipify.org)
az functionapp config access-restriction add -g $app_rg -n $app_name --rule-name $ruleName --action Allow --ip-address $agentIp --priority 232 --scm-site true 1>/dev/null

# Construct and execute deployment command
cmd="az functionapp deployment source config-zip -g $app_rg -n $app_name --src $artifact_path"
if [[ $enable_debug == 'true' ]]; then
    cmd="${cmd} --debug"
fi
echo "Deployment started"
eval "$cmd"
echo "Deployment completed"

if [[ -n ${identities} ]]; then
    # configure User identities given a Managed Identity principal id and resource group
    for identity in ${identities}; do
        # get Azure resource id of managed identity by principalId
        azResourceId=$(az identity list -g $id_rg --query "[?principalId=='$identity'].id" -o tsv)

        if [[ -z "${azResourceId}" ]]; then
            echo "Resource id not found. Invalid principalId."
        else
            echo "Assigning identity ${azResourceId/*\//} to ${app_name}"
            # assign service with specified identity
            az functionapp identity assign -g $app_rg -n $app_name --identities $azResourceId
        fi

    done
fi

# configure Application Settings
if [[ -n ${app_settings} ]]; then
    echo "Set Application Settings for ${app_name}"
    # for item in ${app_settings}; do
    #     az functionapp config appsettings set -g $app_rg -n $app_name --settings "${item}" --query "[?name=='${item%=*}'].name | [0]" --output tsv
    # done
    # TODO ML : Need to test locally and verify contents of output. MAKE SURE NOT TO OUTPUT ANYTHING THAT COULD BE A SECRET

    echo "*****"
    echo ${app_settings}
    echo "*****"

    az functionapp config appsettings set -g $app_rg -n $app_name --settings "${app_settings}"
        # --query "[?name=='${item%=*}'].name | [0]" --output tsv
fi

# Gives some time for prior management operation to complete before going forward
sleep 45s
