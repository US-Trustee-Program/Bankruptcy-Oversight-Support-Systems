#!/bin/bash

# Title:        az-app-deploy.sh
# Description:  Helper script to deploy webapp build artifact to existing Azure site
# Usage:        ./az-app-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n webappName --disable-public-access
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors

while [[ $# > 0 ]]; do
    case $1 in
    -h | --help)
        echo "USAGE: az-func-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n functionappName --disable-public-access"
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

    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

if [ ! -f "$artifact_path" ]; then
    echo "Error: missing build artifact $artifact_path"
    exit 10
fi
tar -xf $artifact_path
if (($? != 0)); then
    echo "Error: extracting build artifact $artifact_path"
    exit 11
fi

function on_exit() {
    # always try to remove temporary access
    az webapp config access-restriction remove -g $app_rg -n $app_name --rule-name $ruleName --scm-site true 1>/dev/null
}
trap on_exit EXIT

# allow build agent access to execute deployment
agentIp=$(curl -s https://api.ipify.org)
ruleName="agent-${app_name:0:26}"
az webapp config access-restriction add -g $app_rg -n $app_name --rule-name $ruleName --action Allow --ip-address $agentIp --priority 232 --scm-site true 1>/dev/null

pushd build
if (($? != 0)); then
    echo "Error: unable to change working directory"
    exit 12
fi

az webapp up --html -n $app_name
popd
