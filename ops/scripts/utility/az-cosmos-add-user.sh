#!/usr/bin/env bash

# Title:        az-cosmos-add-user.sh
# Description:  To simplify Cosmosdb administration, this script assigns a role to a principal for a target Cosmos Db account
# Usage:        az-cosmos-add-user.sh --subscription <guid> --principal <guid> -g <resource group name> -n cosmos-ustp-cams -r <guid>

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

subscription_id=
principal_id=
cosmos_rg=
cosmos_account=
role_id=    # guid of the target CosmosDb role definition

while [[ $# -gt 0 ]]; do
    case $1 in
    -h | --help)
        echo 'USAGE: az-cosmos-add-user.sh --subscription <guid> --principal <guid> -g <resource group name> -n cosmos-ustp-cams -r <guid>'
        exit 0
        ;;

    --subscription)
        subscription_id="${2}"
        shift 2
        ;;

    --principal)
        principal_id="${2}"
        shift 2
        ;;

    -g | --resource-group)
        cosmos_rg="${2}"
        shift 2
        ;;

    -n | --name)
        cosmos_account="${2}"
        shift 2
        ;;

    -r | --role-id)
        role_id="${2}"
        shift 2
        ;;

    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

if [[ -z "${subscription_id}" ]]; then
    echo "Error: Missing subscription id"
    exit 10
fi
if [[ -z "${principal_id}" ]]; then
    echo "Error: Missing guid of principal id"
    exit 11
fi
if [[ -z "${cosmos_rg}" ]]; then
    echo "Error: Missing CosmosDb resource group name"
    exit 12
fi
if [[ -z "${cosmos_account}" ]]; then
    echo "Error: Missing CosmosDb account name"
    exit 13
fi
if [[ -z "${role_id}" ]]; then
    echo "Error: Missing guid of role to assign principal"
    echo " See list of available ids with the following command:"
    echo " az cosmosdb sql role definition list --account-name <cosmo db account name> --resource-group  <resource group>"
    exit 14
fi

# Azure resource id of CosmosDb Account
cosmos_account_id="/subscriptions/${subscription_id}/resourceGroups/${cosmos_rg}/providers/Microsoft.DocumentDB/databaseAccounts/${cosmos_account}"
# Azure resource id of the SQL role definition id
cosmos_role_id=${cosmos_account_id}/sqlRoleDefinitions/${role_id}

az cosmosdb sql role assignment create \
    --account-name "${cosmos_account}" \
    --resource-group "${cosmos_rg}" \
    --scope "${cosmos_account_id}" \
    --principal-id "${principal_id}" \
    --role-definition-id "${cosmos_role_id}"
