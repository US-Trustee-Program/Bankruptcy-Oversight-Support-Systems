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

function az_deploy_func() {
    local rg=$1
    local templateFile=$2
    local deploymentParameter=$3
    echo "Deploying Azure resources via bicep template ${templateFile}"
    if [[ ${show_what_if} ]]; then
        # shellcheck disable=SC2086 # REASON: Adds unwanted quotes after --parameter
        az deployment group create -w -g ${rg} --template-file ${templateFile} --parameter ${deploymentParameter}
    fi
    # shellcheck disable=SC2086 # REASON: Adds unwanted quotes after --parameter
    az deployment group create -g ${rg} --template-file ${templateFile} --parameter $deploymentParameter -o json --query properties.outputs | tee outputs.json
}

show_what_if=false
create_alerts=false
action_group_name=''
deploy_app_insights=false
deployment_parameters=''
while [[ $# -gt 0 ]]; do
    case $1 in
    -h | --help)
        printf ""
        printf "USAGE: azure-deploy.sh -sw -g ustp-app-rg -f ../cloud-deployment/ustp-cams.bicep -p 'key01=value-01 key02=value-02 arrays=[\"test\resource\"] keyBool=true'"
        printf ""
        shift
        ;;

    -sw | --show-what-if)
        show_what_if=true
        shift
        ;;

    # default resource group name
    -g | --resource-group)
        app_rg="${2}"
        app_rg_param="appResourceGroup=${2}"
        shift 2
        ;;

    # path to main bicep
    -f | --file)
        deployment_file="${2}"
        shift 2
        ;;
    #Core app name -- stack name
    --stackName)
        stack_name="${2}"
        stack_name_param="stackName=${2}"
        shift 2
        ;;
    --networkResourceGroupName)
        network_resource_group="${2}"
        network_resource_group_param="networkResourceGroupName=${2}"
        shift 2
        ;;
    --vnetName)
        vnet_name="${2}"
        vnet_name_param="virtualNetworkName=${2}"
        shift 2
        ;;
    --analyticsWorkspaceId)
        analytics_workspace_id="${2}"
        analytics_workspace_id_param="analyticsWorkspaceId=${2}"
        shift 2
        ;;
    --idKeyvaultAppConfiguration)
        keyvault_app_config_id="${2}"
        keyvault_app_config_id_param="idKeyvaultAppConfiguration=${2}"
        shift 2
        ;;
    --cosmosIdentityName)
        cosmos_id_name="${2}"
        cosmos_id_name_param="cosmosIdentityName=${2}"
        shift 2
        ;;
    --deployVnet)
        deploy_vnet="${2}"
        shift 2
        ;;
    --camsReactSelectHash)
        cams_react_select_hash="${2}"
        cams_react_select_hash_param="camsReactSelectHash=${2}"
        shift 2
        ;;
    --ustpIssueCollectorHash)
        ustp_issue_collector_hash="${2}"
        ustp_issue_collector_hash_param="ustpIssueCollectorHash=${2}"
        shift 2
        ;;
    --createAlerts)
        create_alerts="${2}"
        create_alerts_param="createAlerts=${2}"
        shift 2
        ;;
    --actionGroupName)
        action_group_name="${2}"
        action_group_name_param="actionGroupName=${2}"
        shift 2
        ;;
    --deployAppInsights)
        deploy_app_insights="${2}"
        deploy_app_insights_param="deployAppInsights=${2}"
        shift 2
        ;;
    --webappPlanType)
        webapp_plan_type="${2}"
        webapp_plan_type_param="webappPlanType=${2}"
        shift 2
        ;;
    --functionPlanType)
        function_plan_type="${2}"
        function_plan_type_param="functionPlanType=${2}"
        shift 2
        ;;
    --deployFunctions)
        deploy_functions="${2}"
        deploy_functions_param="deployFunctions=${2}"
        shift 2
        ;;
    --deployWebapp)
        deploy_webapp="${2}"
        deploy_webapp_param="deployWebapp=${2}"
        shift 2
        ;;
    # collection of key=value delimited by space e.g. 'appName=ustp-dev-01 deployVnet=false deployNetwork=true linkVnetIds=[]'
    -p | --environmentParameters)
        deployment_parameters="${2}"
        shift 2
        ;;

    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done
if [[ -z "${deployment_file}" ]]; then
    echo "Error: Missing deployment file"
    exit 11
fi

if [ ! -f "${deployment_file}" ]; then
    echo "Error: File (${deployment_file}) does not exist."
    exit 12
fi

if [[ -z "${deployment_parameters}" ]]; then
    echo "Error: Missing deployment parameters"
    exit 13
fi
if [[ -z "${app_rg}" ]]; then
    echo "Error: Missing default resource group"
    exit 10
fi
if [[ -z "${stack_name}" ]]; then
    echo "Error: Missing stackName"
    exit 10
fi
if [[ -z "${network_resource_group}" ]]; then
    echo "Error: Missing Network resource group"
    exit 10
fi
if [[ -z "${vnet_name}" ]]; then
    echo "Error: Missing Vnet Name"
    exit 10
fi
if [[ -z "${analytics_workspace_id}" ]]; then
    echo "Error: Missing analytics workspace id"
    exit 10
fi
if [[ -z "${keyvault_app_config_id}" ]]; then
    echo "Error: Missing KV App config ID Name"
    exit 10
fi
if [[ -z "${cosmos_id_name}" ]]; then
    echo "Error: Missing Cosmos Managed id name"
    exit 10
fi
if [[ -z "${cams_react_select_hash}" ]]; then
    echo "Error: Missing camsReactSelectHash"
    exit 10
fi
if [[ -z "${ustp_issue_collector_hash}" ]]; then
    echo "Error: Missing ustpIssueCollectorHash"
    exit 10
fi
if [[ -z "${deploy_vnet}" ]]; then
    echo "Error: Missing deployVnet"
    exit 10
fi
if [[ -z "${webapp_plan_type}" ]]; then
    echo "Error: Missing webappPlanType"
    exit 10
fi
if [[ -z "${function_plan_type}" ]]; then
    echo "Error: Missing functionPlanType"
    exit 10
fi
if [[ -z "${deploy_functions}" ]]; then
    echo "Error: Missing deployFunctions"
    exit 10
fi
if [[ -z "${deploy_webapp}" ]]; then
    echo "Error: Missing deployWebapp"
    exit 10
fi
if [[ -z "${action_group_name}" && "${create_alerts}" == true ]]; then
    echo "Create Alerts: ${create_alerts} but no actionGroupName supplied"
    exit 10
fi


deployment_parameters="${deployment_parameters} ${stack_name_param} ${app_rg_param} ${analytics_workspace_id_param} ${vnet_name_param} ${network_resource_group_param} ${cosmos_id_name_param} ${keyvault_app_config_id_param} ${cams_react_select_hash_param} ${ustp_issue_collector_hash_param} ${webapp_plan_type_param} ${function_plan_type_param} ${deploy_functions_param} ${deploy_webapp_param}"
# Check and add conditional parameters
if [[ "${create_alerts}" == true ]]; then
  deployment_parameters="${deployment_parameters} ${create_alerts_param}"
fi
if [[ "${action_group_name}" != '' ]]; then
  deployment_parameters="${deployment_parameters} ${action_group_name_param}"
fi
if [[ "${deploy_app_insights}" == true ]]; then
  deployment_parameters="${deployment_parameters} ${deploy_app_insights_param}"
fi

# Check if existing vnet exists. Set createVnet to true. NOTE that this will be evaluated with deployVnet parameters.
if [[ "$(az_vnet_exists_func "${network_resource_group}" "${vnet_name}")" != true || "${deploy_vnet}" == true ]]; then
    deployment_parameters="${deployment_parameters} deployVnet=true"
fi

az_deploy_func "${app_rg}" "${deployment_file}" "${deployment_parameters}"
