#!/bin/bash

# Title:        az-func-deploy.sh
# Description:  Helper script to deploy function build artifact to existing Azure site
# Usage:        ./az-func-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n functionappName --disable-public-access
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors

set -e

while [[ $# > 0 ]]; do
    case $1 in
    -h | --help)
        echo "USAGE: az-func-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n functionappName --settings=\"key1=value1 key2=value2\" --disable-public-access"
        exit 0
        shift
        ;;

    -d | --debug)
        enable_debug=true
        shift
        ;;

    --disable-public-access)
        disable_public_access=true
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
    if [[ $disable_public_access ]]; then
        az resource update -g $app_rg -n $app_name --resource-type "Microsoft.Web/sites" --set properties.publicNetworkAccess=Disabled --query "${jp_query}"
    fi
}
trap on_exit EXIT

if [ ! -f "$artifact_path" ]; then
    echo "Error: missing build artifact $artifact_path"
    exit 10
fi

jp_query='{"name":name, "url":properties.hostNameSslStates[0].name, "publicNetworkAccess":properties.publicNetworkAccess}'

if [[ $disable_public_access ]]; then
    # ensures that public access is temporary enabled
    az resource update -g $app_rg -n $app_name --resource-type "Microsoft.Web/sites" --set properties.publicNetworkAccess=Enabled --query "${jp_query}"
fi

cmd="az functionapp deployment source config-zip -g $app_rg -n $app_name --src $artifact_path"

if [[ $enable_debug ]]; then
    cmd="${cmd} --debug"
fi

eval "$cmd"

if [[ -n "${app_settings}" ]]; then
    az functionapp config appsettings set -g $app_rg -n $app_name \
        --settings "${app_settings}"
fi
