#!/usr/bin/env bash

# Title:        azure-deploy.sh
# Description:  Helper script to deploy Azure resources for USTP CAMS
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

deployment_parameters=''
is_ustp_deployment=false
inputParams=()

requiredUSTPParams=("--isUstpDeployment" "--resource-group" "--file" "--stackName" "--networkResourceGroupName" "--virtualNetworkName" "--analyticsWorkspaceId" "--idKeyvaultAppConfiguration" "--kvAppConfigName" "--cosmosIdentityName" "--cosmosDatabaseName" "--cosmosAccountName" "--deployVnet" "--camsReactSelectHash" "--ustpIssueCollectorHash" "--createAlerts" "--deployAppInsights" "--functionPlanType" "--webappPlanType" "--deployFunctions" "--deployWebapp" "--loginProvider" "--loginProviderConfig" "--sqlServerName" "--sqlServerResourceGroupName" "--oktaUrl" "--location" "--webappSubnetName" "--functionSubnetName" "--privateEndpointSubnetName" "--webappSubnetAddressPrefix" "--privateEndpointSubnetAddressPrefix" "--functionSubnetAddressPrefix" "--privateDnsZoneName" "--privateDnsZoneResourceGroup" "--privateDnsZoneSubscriptionId" "--analyticsResourceGroupName" "--kvAppConfigResourceGroupName" "--deployDns")

requiredFlexionParams=("--resource-group" "--file" "--stackName" "--networkResourceGroupName" "--kvAppConfigName" "--kvAppConfigResourceGroupName" "--virtualNetworkName" "--analyticsWorkspaceId" "--idKeyvaultAppConfiguration" "--cosmosIdentityName" "--cosmosDatabaseName" "--cosmosAccountName" "--deployVnet" "--camsReactSelectHash" "--ustpIssueCollectorHash" "--createAlerts" "--deployAppInsights" "--functionPlanType" "--webappPlanType" "--deployFunctions" "--deployWebapp" "--loginProvider" "--loginProviderConfig" "--sqlServerName" "--sqlServerResourceGroupName" "--sqlServerIdentityName" "--actionGroupName" "--oktaUrl")

# shellcheck disable=SC2034 # REASON: to have a reference for all possible parameters
allParams=("--isUstpDeployment" "--resource-group" "--file" "--stackName" "--networkResourceGroupName" "--virtualNetworkName" "--analyticsWorkspaceId" "--idKeyvaultAppConfiguration" "--kvAppConfigName" "--cosmosIdentityName" "--cosmosDatabaseName" "--cosmosAccountName" "--deployVnet" "--camsReactSelectHash" "--ustpIssueCollectorHash" "--createAlerts" "--deployAppInsights" "--functionPlanType" "--webappPlanType" "--deployFunctions" "--deployWebapp" "--loginProvider" "--loginProviderConfig" "--sqlServerName" "--sqlServerResourceGroupName" "--sqlServerIdentityResourceGroupName" "--sqlServerIdentityName"  "--actionGroupName" "--oktaUrl" "--location" "--webappSubnetName" "--functionSubnetName" "--privateEndpointSubnetName" "--webappSubnetAddressPrefix" "--functionSubnetAddressPrefix" "--vnetAddressPrefix" "--linkVnetIds" "--privateDnsZoneName" "--privateDnsZoneResourceGroup" "--privateDnsZoneSubscriptionId" "--analyticsResourceGroupName" "--kvAppConfigResourceGroupName" "--deployDns" "--azHostSuffix" "--allowVeracodeScan")


function az_vnet_exists_func() {
    local rg=$1
    local vnetName=$2
    count=$(az network vnet list -g "${rg}" --query "length([?name=='${vnetName}'])" 2>/dev/null)
    if [[ ${count} -eq 0 ]]; then
        exists=false
    else
        exists=true
    fi
    echo ${exists}
}

function validateParameters() {
    requiredParams=("${requiredFlexionParams[@]}")
    if [[ $is_ustp_deployment == true ]]; then
        requiredParams=("${requiredUSTPParams[@]}")
    fi
    isValid=1
    echo "Validating Parameters..."
    # Validate that all required environment parameters are present
    for param in "${requiredParams[@]}"; do
        if [[ "${inputParams[*]}" =~ $param ]]; then
            echo "Parameter: ${param}"
        else
            echo "Parameter: ${param} not found in your input"
            isValid=0
        fi
    done

    if [[ $isValid != 1 ]]; then
        echo "Exiting due to invalid parameters"
        exit 11
    fi
}
function az_deploy_func() {
    local rg=$1
    local templateFile=$2
    local deploymentParameter=$3
    echo "Deploying Azure resources via bicep template ${templateFile}"
    # shellcheck disable=SC2086 # REASON: Adds unwanted quotes after --parameter
    az deployment group create -w -g ${rg} --template-file ${templateFile} --parameter ${deploymentParameter}
    # shellcheck disable=SC2086 # REASON: Adds unwanted quotes after --parameter
    az deployment group create -g ${rg} --template-file ${templateFile} --parameter $deploymentParameter -o json --query properties.outputs | tee outputs.json
}



while [[ $# -gt 0 ]]; do
    case $1 in
    # default resource group name
    --resource-group)
        inputParams+=("${1}")
        app_rg="${2}"
        app_rg_param="appResourceGroup=${2}"
        deployment_parameters="${deployment_parameters} ${app_rg_param}"
        shift 2
        ;;
    # path to main bicep
    --file)
        inputParams+=("${1}")
        deployment_file="${2}"
        shift 2
        ;;
    #Core app name -- stack name
    --stackName)
        inputParams+=("${1}")
        stack_name_param="stackName=${2}"
        deployment_parameters="${deployment_parameters} ${stack_name_param}"
        shift 2
        ;;
    --networkResourceGroupName)
        inputParams+=("${1}")
        network_rg="${2}"
        network_rg_param="networkResourceGroupName=${2}"
        deployment_parameters="${deployment_parameters} ${network_rg_param}"
        shift 2
        ;;
    --location)
        inputParams+=("${1}")
        location_param="location=${2}"
        deployment_parameters="${deployment_parameters} ${location_param}"
        shift 2
        ;;
    --deployVnet)
        inputParams+=("${1}")
        deploy_vnet="${2}"
        deploy_vnet_param="deployVnet=${2}"
        deployment_parameters="${deployment_parameters} ${deploy_vnet_param}"
        shift 2
        ;;
    --virtualNetworkName)
        inputParams+=("${1}")
        vnet_name="${2}"
        vnet_name_param="virtualNetworkName=${2}"
        deployment_parameters="${deployment_parameters} ${vnet_name_param}"
        shift 2
        ;;
    --deployDns)
        inputParams+=("${1}")
        deploy_dns_param="deployWebapp=${2}"
        deployment_parameters="${deployment_parameters} ${deploy_dns_param}"
        shift 2
        ;;
    --privateDnsZoneName)
        inputParams+=("${1}")
        private_dns_zone_name_param="privateDnsZoneName=${2}"
        deployment_parameters="${deployment_parameters} ${private_dns_zone_name_param}"
        shift 2
        ;;
    --privateDnsZoneSubscriptionId)
        inputParams+=("${1}")
        private_dns_zone_sub_id_param="privateDnsZoneSubscriptionId=${2}"
        deployment_parameters="${deployment_parameters} ${private_dns_zone_sub_id_param}"
        shift 2
        ;;
    --privateDnsZoneResourceGroup)
        inputParams+=("${1}")
        private_dns_zone_rg_param="privateDnsZoneResourceGroup=${2}"
        deployment_parameters="${deployment_parameters} ${private_dns_zone_rg_param}"
        shift 2
        ;;
    --deployFunctions)
        inputParams+=("${1}")
        deploy_functions_param="deployFunctions=${2}"
        deployment_parameters="${deployment_parameters} ${deploy_functions_param}"
        shift 2
        ;;
    --deployWebapp)
        inputParams+=("${1}")
        deploy_webapp_param="deployWebapp=${2}"
        deployment_parameters="${deployment_parameters} ${deploy_webapp_param}"
        shift 2
        ;;
    --webappSubnetName)
        inputParams+=("${1}")
        webapp_subnet_name_param="webappSubnetName=${2}"
        deployment_parameters="${deployment_parameters} ${webapp_subnet_name_param}"
        shift 2
        ;;
    --webappSubnetAddressPrefix)
        inputParams+=("${1}")
        webapp_subnet_address_prefix_param="webappSubnetAddressPrefix=${2}"
        deployment_parameters="${deployment_parameters} ${webapp_subnet_address_prefix_param}"
        shift 2
        ;;
    --functionSubnetName)
        inputParams+=("${1}")
        function_subnet_name_param="functionSubnetName=${2}"
        deployment_parameters="${deployment_parameters} ${function_subnet_name_param}"
        shift 2
        ;;
    --functionSubnetAddressPrefix)
        inputParams+=("${1}")
        function_subnet_address_prefix_param="functionSubnetAddressPrefix=${2}"
        deployment_parameters="${deployment_parameters} ${function_subnet_address_prefix_param}"
        shift 2
        ;;
    --privateEndpointSubnetName)
        inputParams+=("${1}")
        pe_subnet_name_param="privateEndpointSubnetName=${2}"
        deployment_parameters="${deployment_parameters} ${pe_subnet_name_param}"
        shift 2
        ;;
    --privateEndpointSubnetAddressPrefix)
        inputParams+=("${1}")
        pe_subnet_address_prefix_param="privateEndpointSubnetAddressPrefix=${2}"
        deployment_parameters="${deployment_parameters} ${pe_subnet_address_prefix_param}"
        shift 2
        ;;
    --analyticsWorkspaceId)
        inputParams+=("${1}")
        analytics_workspace_id_param="analyticsWorkspaceId=${2}"
        deployment_parameters="${deployment_parameters} ${analytics_workspace_id_param}"
        shift 2
        ;;
    --analyticsResourceGroupName)
        inputParams+=("${1}")
        analytics_rg_param="analyticsWorkspaceId=${2}"
        deployment_parameters="${deployment_parameters} ${analytics_rg_param}"
        shift 2
        ;;
    --idKeyvaultAppConfiguration)
        inputParams+=("${1}")
        keyvault_app_config_id_param="idKeyvaultAppConfiguration=${2}"
        deployment_parameters="${deployment_parameters} ${keyvault_app_config_id_param}"
        shift 2
        ;;
    --kvAppConfigName)
        inputParams+=("${1}")
        kv_app_config_name_param="kvAppConfigName=${2}"
        deployment_parameters="${deployment_parameters} ${kv_app_config_name_param}"
        shift 2
        ;;
    --kvAppConfigResourceGroupName)
        inputParams+=("${1}")
        kv_app_config_rg_name_param="kvAppConfigResourceGroupName=${2}"
        deployment_parameters="${deployment_parameters} ${kv_app_config_rg_name_param}"
        shift 2
        ;;
    --cosmosIdentityName)
        inputParams+=("${1}")
        cosmos_id_name_param="cosmosIdentityName=${2}"
        deployment_parameters="${deployment_parameters} ${cosmos_id_name_param}"
        shift 2
        ;;
    --cosmosDatabaseName)
        inputParams+=("${1}")
        cosmos_database_name_param="cosmosDatabaseName=${2}"
        deployment_parameters="${deployment_parameters} ${cosmos_database_name_param}"
        shift 2
        ;;
    --cosmosAccountName)
        inputParams+=("${1}")
        cosmos_account_name_param="cosmosAccountName=${2}"
        deployment_parameters="${deployment_parameters} ${cosmos_account_name_param}"
        shift 2
        ;;
    --sqlServerName)
        inputParams+=("${1}")
        sql_server_name_param="sqlServerName=${2}"
        deployment_parameters="${deployment_parameters} ${sql_server_name_param}"
        shift 2
        ;;
    --sqlServerResourceGroupName)
        inputParams+=("${1}")
        sql_server_rg_name_param="sqlServerResourceGroupName=${2}"
        deployment_parameters="${deployment_parameters} ${sql_server_rg_name_param}"
        shift 2
        ;;
    --sqlServerIdentityResourceGroupName)
        inputParams+=("${1}")
        sql_server_id_rg_name_param="sqlServerIdentityResourceGroupName=${2}"
        deployment_parameters="${deployment_parameters} ${sql_server_id_rg_name_param}"
        shift 2
        ;;
    --sqlServerIdentityName)
        inputParams+=("${1}")
        sql_server_id_name_param="sqlServerIdentityName=${2}"
        deployment_parameters="${deployment_parameters} ${sql_server_id_name_param}"
        shift 2
        ;;
    --camsReactSelectHash)
        inputParams+=("${1}")
        cams_react_select_hash_param="camsReactSelectHash=${2}"
        deployment_parameters="${deployment_parameters} ${cams_react_select_hash_param}"
        shift 2
        ;;
    --ustpIssueCollectorHash)
        inputParams+=("${1}")
        ustp_issue_collector_hash_param="ustpIssueCollectorHash=${2}"
        deployment_parameters="${deployment_parameters} ${ustp_issue_collector_hash_param}"
        shift 2
        ;;
    --createAlerts)
        inputParams+=("${1}")
        create_alerts_param="createAlerts=${2}"
        deployment_parameters="${deployment_parameters} ${create_alerts_param}"
        shift 2
        ;;
    --actionGroupName)
        inputParams+=("${1}")
        action_group_name_param="actionGroupName=${2}"
        deployment_parameters="${deployment_parameters} ${action_group_name_param}"
        shift 2
        ;;
    --deployAppInsights)
        inputParams+=("${1}")
        deploy_app_insights_param="deployAppInsights=${2}"
        deployment_parameters="${deployment_parameters} ${deploy_app_insights_param}"
        shift 2
        ;;
    --webappPlanType)
        inputParams+=("${1}")
        webapp_plan_type_param="webappPlanType=${2}"
        deployment_parameters="${deployment_parameters} ${webapp_plan_type_param}"
        shift 2
        ;;
    --functionPlanType)
        inputParams+=("${1}")
        function_plan_type_param="functionPlanType=${2}"
        deployment_parameters="${deployment_parameters} ${function_plan_type_param}"
        shift 2
        ;;
    --oktaUrl)
        inputParams+=("${1}")
        okta_url_param="oktaUrl=${2}"
        deployment_parameters="${deployment_parameters} ${okta_url_param}"
        shift 2
        ;;
    --loginProvider)
        inputParams+=("${1}")
        login_provider_param="loginProvider=${2}"
        deployment_parameters="${deployment_parameters} ${login_provider_param}"
        shift 2
        ;;
    --loginProviderConfig)
        inputParams+=("${1}")
        login_provider_config_param="loginProviderConfig=${2}"
        deployment_parameters="${deployment_parameters} ${login_provider_config_param}"
        shift 2
        ;;
    --azHostSuffix)
        inputParams+=("${1}")
        az_host_suffix_param="azHostSuffix=${2}"
        deployment_parameters="${deployment_parameters} ${az_host_suffix_param}"
        shift 2
        ;;
    --allowVeracodeScan)
        inputParams+=("${1}")
        allow_veracode_scan_param="allowVeracodeScan=${2}"
        deployment_parameters="${deployment_parameters} ${allow_veracode_scan_param}"
        shift 2
        ;;
    --isUstpDeployment)
        inputParams+=("${1}")
        is_ustp_deployment=true
        is_ustp_deployment_param="isUstpDeployment=true"
        deployment_parameters="${deployment_parameters} ${is_ustp_deployment_param}"
        shift
        ;;
    *)
        echo "Exit on param: ${1}"
        exit 2 # error on unknown flag/switch
        ;;
    esac
done


validateParameters

# Check and add conditional parameters
# Check if existing vnet exists. Set createVnet to true. NOTE that this will be evaluated with deployVnet parameters.
if [[ "$(az_vnet_exists_func "${network_rg}" "${vnet_name}")" != true || "${deploy_vnet}" == true ]]; then
    deployment_parameters="${deployment_parameters} deployVnet=true"
fi

az_deploy_func "${app_rg}" "${deployment_file}" "${deployment_parameters}"
