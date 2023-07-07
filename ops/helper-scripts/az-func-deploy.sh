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

    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

function on_exit() {
    # always try to remove temporary access
    az functionapp config access-restriction remove -g $app_rg -n $app_name --rule-name $ruleName --scm-site true 1> /dev/null
}
trap on_exit EXIT

if [ ! -f "$artifact_path" ]; then
    echo "Error: missing build artifact $artifact_path"
    exit 10
fi

# allow build agent access to execute deployment
agentIp=$(curl -s https://api.ipify.org)
ruleName="agent-${app_name:0:26}"
az functionapp config access-restriction add -g $app_rg -n $app_name --rule-name $ruleName --action Allow --ip-address $agentIp --priority 232 --scm-site true 1> /dev/null

# configure Application Settings
if [[ -n ${app_settings} ]]; then
    echo "Set Application Settings for $app_name"
    for item in ${app_settings}; do
        az functionapp config appsettings set -g $app_rg -n $app_name --settings "${item}" --query "[-1:].name" --output tsv
    done
fi

# Construct and execute deployment command
cmd="az functionapp deployment source config-zip -g $app_rg -n $app_name --src $artifact_path"
if [[ $enable_debug == 'true' ]]; then
    cmd="${cmd} --debug"
fi
eval "$cmd"
