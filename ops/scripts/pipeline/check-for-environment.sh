#!/usr/bin/env bash

# Title:        check-for-environment.sh --resource-group <app_rg> --webappName <webappName> --apiName <apiName>
# Description:  Helper script to check for an existing environemt


while [[ $# -gt 0 ]]; do
    case $1 in
    # default resource group name
    --resource-group)
        app_rg="${2}"
        shift 2
        ;;
    --webappName)
        webapp_name="${2}"
        shift 2
        ;;
    --apiName)
        api_name="${2}"
        shift 2
        ;;
    *)
        echo "Invalid param: ${1}"
        exit 2
        ;;
    esac
done

initialDeployment='false'

webappCount=$(az webapp list -g "${app_rg}" --query "length([?name=='${webapp_name}'])" || true)
apiCount=$(az functionapp list -g "${app_rg}" --query "length([?name=='${api_name}'])" || true)

if [ "$webappCount" == '1' ] && [ "$apiCount" == '1' ]; then
    initialDeployment='false'
else
    initialDeployment='true'
fi
echo $initialDeployment
