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

requiredUSTPParams=("--enabledDataflows" "--mssqlRequestTimeout" "--migrateCaseAppointmentsFetchSize" "--isUstpDeployment" "--resource-group" "--file" "--stackName" "--slotName" "--gitSha" "--networkResourceGroupName" "--virtualNetworkName" "--idKeyvaultAppConfiguration" "--kvAppConfigName" "--cosmosDatabaseName" "--ustpIssueCollectorHash" "--createAlerts" "--deployAppInsights" "--apiFunctionPlanName" "--dataflowsFunctionPlanName" "--webappPlanType" "--loginProvider" "--loginProviderConfig" "--sqlServerName" "--sqlServerResourceGroupName" "--oktaUrl" "--location" "--webappSubnetName" "--apiFunctionSubnetName" "--privateEndpointSubnetName" "--dataflowsSubnetName" "--privateDnsZoneName" "--privateDnsZoneResourceGroup" "--privateDnsZoneSubscriptionId" "--analyticsResourceGroupName" "--kvAppConfigResourceGroupName" "--deployDns")

requiredFlexionParams=("--enabledDataflows" "--mssqlRequestTimeout" "--migrateCaseAppointmentsFetchSize" "--resource-group" "--file" "--stackName" "--slotName" "--gitSha" "--networkResourceGroupName" "--kvAppConfigName" "--kvAppConfigResourceGroupName" "--virtualNetworkName" "--analyticsResourceGroupName" "--idKeyvaultAppConfiguration" "--cosmosDatabaseName" "--ustpIssueCollectorHash" "--createAlerts" "--deployAppInsights" "--loginProvider" "--loginProviderConfig" "--sqlServerName" "--sqlServerResourceGroupName" "--sqlServerIdentityName" "--actionGroupName" "--oktaUrl" "--e2eDatabaseName" "--e2eSqlDatabaseName")

# shellcheck disable=SC2034 # REASON: to have a reference for all possible parameters
allParams=("--enabledDataflows" "--mssqlRequestTimeout" "--migrateCaseAppointmentsFetchSize" "--isUstpDeployment" "--resource-group" "--file" "--stackName" "--slotName" "--gitSha" "--networkResourceGroupName" "--virtualNetworkName" "--analyticsWorkspaceId" "--idKeyvaultAppConfiguration" "--kvAppConfigName" "--cosmosDatabaseName" "--deployVnet" "--ustpIssueCollectorHash" "--createAlerts" "--deployAppInsights" "--apiFunctionPlanName" "--dataflowsFunctionPlanName" "--webappPlanType" "--loginProvider" "--loginProviderConfig" "--sqlServerName" "--sqlServerResourceGroupName" "--sqlServerIdentityResourceGroupName" "--sqlServerIdentityName"  "--actionGroupName" "--oktaUrl" "--location" "--webappSubnetName" "--apiFunctionSubnetName" "--privateEndpointSubnetName" "--webappSubnetAddressPrefix" "--apiFunctionSubnetAddressPrefix" "--dataflowsSubnetName" "--dataflowsSubnetAddressPrefix" "--vnetAddressPrefix" "--linkVnetIds" "--privateDnsZoneName" "--privateDnsZoneResourceGroup" "--privateDnsZoneSubscriptionId" "--analyticsResourceGroupName" "--kvAppConfigResourceGroupName" "--deployDns" "--e2eDatabaseName" "--e2eSqlDatabaseName" "--customDomain")


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
    # Branch-deployment flags accepted for backward compatibility but no longer used
    # by the app deploy (app resources are deployed as a plain resource-group
    # deployment, not a stack — see the note at the deploy call below).
    --isBranchDeployment | --branchName | --branchHashId)
        inputParams+=("${1}")
        shift 2
        ;;
    --slotName)
        inputParams+=("${1}")
        slot_name_param="slotName=${2}"
        deployment_parameters="${deployment_parameters} ${slot_name_param}"
        shift 2
        ;;
    --gitSha)
        inputParams+=("${1}")
        git_sha_param="gitSha=${2}"
        deployment_parameters="${deployment_parameters} ${git_sha_param}"
        shift 2
        ;;
    --networkResourceGroupName)
        inputParams+=("${1}")
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
    # deployVnet is handled by azure-deploy-network.sh (network resources moved out
    # of main.bicep for CAMS-760). Accepted here for backward compatibility but not
    # forwarded — main.bicep no longer declares this parameter.
    --deployVnet)
        inputParams+=("${1}")
        shift 2
        ;;
    --virtualNetworkName)
        inputParams+=("${1}")
        vnet_name_param="virtualNetworkName=${2}"
        deployment_parameters="${deployment_parameters} ${vnet_name_param}"
        shift 2
        ;;
    --deployDns)
        inputParams+=("${1}")
        deploy_dns_param="deployDns=${2}"
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
    --webappSubnetName)
        inputParams+=("${1}")
        webapp_subnet_name_param="webappSubnetName=${2}"
        deployment_parameters="${deployment_parameters} ${webapp_subnet_name_param}"
        shift 2
        ;;
    # Subnet address prefixes are consumed by azure-deploy-network.sh (network
    # resources moved out of main.bicep for CAMS-760). Accepted here for backward
    # compatibility but not forwarded — main.bicep no longer declares them.
    --webappSubnetAddressPrefix)
        inputParams+=("${1}")
        shift 2
        ;;
    --apiFunctionSubnetName)
        inputParams+=("${1}")
        api_function_subnet_name_param="apiFunctionSubnetName=${2}"
        deployment_parameters="${deployment_parameters} ${api_function_subnet_name_param}"
        shift 2
        ;;
    --apiFunctionSubnetAddressPrefix)
        inputParams+=("${1}")
        shift 2
        ;;
    --dataflowsSubnetName)
        inputParams+=("${1}")
        dataflows_subnet_name_param="dataflowsSubnetName=${2}"
        deployment_parameters="${deployment_parameters} ${dataflows_subnet_name_param}"
        shift 2
        ;;
    --dataflowsSubnetAddressPrefix)
        inputParams+=("${1}")
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
        analytics_rg_param="analyticsResourceGroupName=${2}"
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
    --cosmosDatabaseName)
        inputParams+=("${1}")
        cosmos_database_name_param="cosmosDatabaseName=${2}"
        deployment_parameters="${deployment_parameters} ${cosmos_database_name_param}"
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
    --mssqlRequestTimeout)
        inputParams+=("${1}")
        mssql_request_timeout="mssqlRequestTimeout=${2}"
        deployment_parameters="${deployment_parameters} ${mssql_request_timeout}"
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

    --apiFunctionPlanName)
        inputParams+=("${1}")
        api_function_plan_name_param="apiFunctionPlanName=${2}"
        deployment_parameters="${deployment_parameters} ${api_function_plan_name_param}"
        shift 2
        ;;

    --dataflowsFunctionPlanName)
        inputParams+=("${1}")
        dataflows_function_plan_name_param="dataflowsFunctionPlanName=${2}"
        deployment_parameters="${deployment_parameters} ${dataflows_function_plan_name_param}"
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
    --enabledDataflows)
        inputParams+=("${1}")
        enabled_dataflows_param="enabledDataflows=${2}"
        deployment_parameters="${deployment_parameters} ${enabled_dataflows_param}"
        shift 2
        ;;
    --migrateCaseAppointmentsFetchSize)
        inputParams+=("${1}")
        migrate_case_appointments_fetch_size_param="migrateCaseAppointmentsFetchSize=${2}"
        deployment_parameters="${deployment_parameters} ${migrate_case_appointments_fetch_size_param}"
        shift 2
        ;;
    --isUstpDeployment)
        inputParams+=("${1}")
        is_ustp_deployment=true
        is_ustp_deployment_param="isUstpDeployment=true"
        deployment_parameters="${deployment_parameters} ${is_ustp_deployment_param}"
        shift
        ;;
    --maxObjectDepth)
        inputParams+=("${1}")
        maxObjectDepth="maxObjectDepth=${2}"
        deployment_parameters="${deployment_parameters} ${maxObjectDepth}"
        shift 2
        ;;
    --maxObjectKeyCount)
        inputParams+=("${1}")
        maxObjectKeyCount="maxObjectKeyCount=${2}"
        deployment_parameters="${deployment_parameters} ${maxObjectKeyCount}"
        shift 2
        ;;

    --e2eDatabaseName)
        inputParams+=("${1}")
        e2eDatabaseName="e2eDatabaseName=${2}"
        deployment_parameters="${deployment_parameters} ${e2eDatabaseName}"
        shift 2
        ;;

    --e2eSqlDatabaseName)
        inputParams+=("${1}")
        e2eSqlDatabaseName="e2eSqlDatabaseName=${2}"
        deployment_parameters="${deployment_parameters} ${e2eSqlDatabaseName}"
        shift 2
        ;;

    --customDomain)
        inputParams+=("${1}")
        custom_domain_param="customDomain=${2}"
        deployment_parameters="${deployment_parameters} ${custom_domain_param}"
        shift 2
        ;;

    *)
        echo "Exit on param: ${1}"
        exit 2 # error on unknown flag/switch
        ;;
    esac
done


validateParameters

# The virtual network is deployed separately by azure-deploy-network.sh before this
# script runs (CAMS-760, Option E); vnet existence / deployVnet handling lives there.
#
# The app deploy is intentionally NOT an Azure Deployment Stack. main.bicep deploys
# resources cross-scope into SHARED resource groups (the app-config Key Vault and its
# role assignments + SQL vnet rules in AZURE_RG; the action group in the analytics RG).
# A deployment stack manages every resource its template creates in ANY resource group,
# so 'az stack group delete' on teardown would delete those shared resources — this is
# what deleted the shared kv-ustp-cams-dev (GH #2749). App resources live in the
# per-branch app RG and are torn down by deleting that RG; only the self-contained
# per-branch network tier is managed as a stack (see azure-deploy-network.sh).
az_deploy_func "${app_rg}" "${deployment_file}" "${deployment_parameters}"
