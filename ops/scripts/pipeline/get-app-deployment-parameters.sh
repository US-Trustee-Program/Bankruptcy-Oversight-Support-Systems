#!/usr/bin/env bash

# Title:        check-git-diff.sh
# Description:  Helper script to check if bicepchanges have been made
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors
while [[ $# -gt 0 ]]; do
    case $1 in
    -h | --help)
        echo "USAGE: az-func-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n functionappName"
        shift
        ;;
    --appRg)
        app_rg="${2}"
        shift 2
        ;;

    --webAppname)
        app_name="${2}"
        shift 2
        ;;
    --kvManagedId)
        kv_managed_id="${2}"
        shift 2
        ;;
    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done
set -euo pipefail # ensure job step fails in CI pipeline when error occurs

snetId=$(az webapp vnet-integration list -g "${app_rg}" -n "${app_name}" --query "[0].vnetResourceId")
# the vnet integration provides the id of the subnet resource, it wouldtake many queries to get the name, so removing all but the name is simpler
webappSubnetName=$(echo "${snetId}" | sed 's|^.*subnets/||' | sed 's|"||')
echo "webappSubnetName=${webappSubnetName}" >> "$GITHUB_OUTPUT"
keyVaultManagedIdName=$(az identity show --ids "${kv_managed_id}" --query "[0].name" | sed 's|"||')
echo "keyVaultManagedIdName=${keyVaultManagedIdName}" >> "$GITHUB_OUTPUT"
