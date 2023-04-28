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

pushd build
if (($? != 0)); then
    echo "Error: unable to change working directory"
    exit 12
fi

jp_query='{"name":name, "url":properties.hostNameSslStates[0].name, "publicNetworkAccess":properties.publicNetworkAccess}'

if [[ $disable_public_access ]]; then
    # ensures that public access is temporary enabled for successful deployment
    az resource update -g $app_rg -n $app_name --resource-type "Microsoft.Web/sites" --set properties.publicNetworkAccess=Enabled --query "${jp_query}"
fi

az webapp up --html -n $app_name
popd

if [[ $disable_public_access ]]; then
    az resource update -g $app_rg -n $app_name --resource-type "Microsoft.Web/sites" --set properties.publicNetworkAccess=Disabled --query "${jp_query}"
fi
