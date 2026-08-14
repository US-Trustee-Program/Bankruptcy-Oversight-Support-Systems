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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/pipeline/_vnet-link-check.sh
source "$SCRIPT_DIR/_vnet-link-check.sh"
# shellcheck source=ops/scripts/pipeline/_az-deploy-retry.sh
source "$SCRIPT_DIR/_az-deploy-retry.sh"

deployment_parameters=''
is_ustp_deployment=false
inputParams=()

requiredUSTPParams=("--enabledDataflows" "--mssqlRequestTimeout" "--migrateCaseAppointmentsFetchSize" "--isUstpDeployment" "--resource-group" "--file" "--stackName" "--slotName" "--gitSha" "--networkResourceGroupName" "--virtualNetworkName" "--idKeyvaultAppConfiguration" "--kvAppConfigName" "--cosmosDatabaseName" "--ustpIssueCollectorHash" "--createAlerts" "--deployAppInsights" "--apiFunctionPlanName" "--dataflowsFunctionPlanName" "--webappPlanType" "--loginProvider" "--loginProviderConfig" "--sqlServerName" "--sqlServerResourceGroupName" "--oktaUrl" "--location" "--webappSubnetName" "--apiFunctionSubnetName" "--privateEndpointSubnetName" "--dataflowsSubnetName" "--privateDnsZoneName" "--privateDnsZoneResourceGroup" "--privateDnsZoneSubscriptionId" "--analyticsResourceGroupName" "--kvAppConfigResourceGroupName" "--deployDns")

requiredFlexionParams=("--enabledDataflows" "--mssqlRequestTimeout" "--migrateCaseAppointmentsFetchSize" "--resource-group" "--file" "--stackName" "--slotName" "--gitSha" "--networkResourceGroupName" "--kvAppConfigName" "--kvAppConfigResourceGroupName" "--virtualNetworkName" "--analyticsResourceGroupName" "--idKeyvaultAppConfiguration" "--cosmosDatabaseName" "--ustpIssueCollectorHash" "--createAlerts" "--deployAppInsights" "--loginProvider" "--loginProviderConfig" "--sqlServerName" "--sqlServerResourceGroupName" "--sqlServerIdentityName" "--actionGroupName" "--oktaUrl" "--e2eDatabaseName" "--e2eSqlDatabaseName")

# shellcheck disable=SC2034 # REASON: to have a reference for all possible parameters
allParams=("--enabledDataflows" "--mssqlRequestTimeout" "--migrateCaseAppointmentsFetchSize" "--isUstpDeployment" "--resource-group" "--file" "--stackName" "--slotName" "--gitSha" "--networkResourceGroupName" "--virtualNetworkName" "--analyticsWorkspaceId" "--idKeyvaultAppConfiguration" "--kvAppConfigName" "--cosmosDatabaseName" "--deployVnet" "--ustpIssueCollectorHash" "--createAlerts" "--deployAppInsights" "--apiFunctionPlanName" "--dataflowsFunctionPlanName" "--webappPlanType" "--loginProvider" "--loginProviderConfig" "--sqlServerName" "--sqlServerResourceGroupName" "--sqlServerIdentityResourceGroupName" "--sqlServerIdentityName" "--sqlServerIdentitySubscriptionId" "--actionGroupName" "--oktaUrl" "--location" "--webappSubnetName" "--apiFunctionSubnetName" "--privateEndpointSubnetName" "--webappSubnetAddressPrefix" "--apiFunctionSubnetAddressPrefix" "--dataflowsSubnetName" "--dataflowsSubnetAddressPrefix" "--vnetAddressPrefix" "--linkVnetIds" "--privateDnsZoneName" "--privateDnsZoneResourceGroup" "--privateDnsZoneSubscriptionId" "--analyticsResourceGroupName" "--kvAppConfigResourceGroupName" "--deployDns" "--e2eDatabaseName" "--e2eSqlDatabaseName" "--customDomain")


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

function requireValue() {
    local flag="${1}"
    local value="${2-}"

    if [[ -z "${value}" || "${value}" == --* ]]; then
        echo "Parameter: ${flag} requires a value"
        exit 12
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

function az_stack_deploy_func() {
    local rg=$1
    local templateFile=$2
    local deploymentParameter=$3
    echo "Deploying Azure app resources as deployment stack ${stack_name}-app in ${rg}"
    # denyDelete blocks direct out-of-band deletes of this stack's own managed
    # resources (e.g. `az webapp delete` run by hand against the shared app RG)
    # without affecting the stack's own lifecycle operations (this script's own
    # `az stack group delete` is exempt) or in-place updates like the VNET
    # integration removal az-delete-branch-resources.sh performs before teardown.
    # az_deploy_with_retry_func (sourced from _az-deploy-retry.sh) tolerates the
    # transient AnotherOperationInProgress/DeploymentActive contention this
    # shared RG can hit from a concurrent branch/main deploy (cams-6us1n) —
    # without it, that purely transient collision fails this whole CI job.
    # shellcheck disable=SC2086 # REASON: Adds unwanted quotes after --parameters
    az_deploy_with_retry_func az stack group create \
        --name "${stack_name}-app" \
        --resource-group "${rg}" \
        --template-file "${templateFile}" \
        --parameters ${deploymentParameter} \
        --action-on-unmanage deleteResources \
        --deny-settings-mode denyDelete \
        --tag isBranchDeployment=true branchName="${branch_name}" branchHashId="${branch_hash_id}" \
        --yes \
        -o json --query properties.outputs | tee outputs.json
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
        stack_name="${2}"
        stack_name_param="stackName=${2}"
        deployment_parameters="${deployment_parameters} ${stack_name_param}"
        shift 2
        ;;
    --isBranchDeployment)
        inputParams+=("${1}")
        is_branch_deployment="${2}"
        shift 2
        ;;
    --branchName)
        inputParams+=("${1}")
        branch_name="${2}"
        shift 2
        ;;
    --branchHashId)
        inputParams+=("${1}")
        branch_hash_id="${2}"
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
        # Also captured bare (not just as a bicep parameter string) because the
        # webapp vnet-link existence check below (CAMS-760 hotfix) needs it to
        # call `az network vnet show` / `az network private-dns link vnet list`
        # directly, the same way azure-deploy-app-shared-setup.sh and
        # azure-deploy-network.sh already do for their own existence checks.
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
    # deployVnet is handled by azure-deploy-network.sh (network resources moved out
    # of main.bicep for CAMS-760). Accepted here for backward compatibility but not
    # forwarded — main.bicep no longer declares this parameter.
    --deployVnet)
        inputParams+=("${1}")
        shift 2
        ;;
    --virtualNetworkName)
        inputParams+=("${1}")
        # Also captured bare — see --networkResourceGroupName above for why.
        vnet_name="${2}"
        vnet_name_param="virtualNetworkName=${2}"
        deployment_parameters="${deployment_parameters} ${vnet_name_param}"
        shift 2
        ;;
    # deployDns is handled by azure-deploy-network.sh and
    # azure-deploy-app-shared-setup.sh (the KV private DNS zone moved out of
    # main.bicep into app-shared-setup.bicep for CAMS-760). Accepted here for
    # backward compatibility but not forwarded — main.bicep no longer declares
    # this parameter.
    --deployDns)
        inputParams+=("${1}")
        shift 2
        ;;
    --privateDnsZoneName)
        inputParams+=("${1}")
        # Also captured bare so the webapp vnet-link existence check below
        # (CAMS-760 hotfix) can query the same zone this deployment will
        # actually target, instead of assuming main.bicep's default.
        private_dns_zone_name="${2}"
        private_dns_zone_name_param="privateDnsZoneName=${2}"
        deployment_parameters="${deployment_parameters} ${private_dns_zone_name_param}"
        shift 2
        ;;
    --privateDnsZoneSubscriptionId)
        inputParams+=("${1}")
        # Also captured bare — see --networkResourceGroupName above for why.
        # Needed so the webapp vnet-link existence check below runs against
        # the SAME subscription main.bicep's ustpWebappDnsZoneLink module
        # targets (USTP prod uses a non-default subscription there); without
        # this, the check silently queries the CLI's default subscription,
        # finds nothing, and main.bicep tries to create a second, conflicting
        # link in the correct subscription.
        private_dns_zone_sub_id="${2}"
        private_dns_zone_sub_id_param="privateDnsZoneSubscriptionId=${2}"
        deployment_parameters="${deployment_parameters} ${private_dns_zone_sub_id_param}"
        shift 2
        ;;
    --privateDnsZoneResourceGroup)
        inputParams+=("${1}")
        # Also captured bare — see --privateDnsZoneName above for why.
        private_dns_zone_rg="${2}"
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
        requireValue "${1}" "${2-}"
        inputParams+=("${1}")
        sql_server_id_name_param="sqlServerIdentityName=${2}"
        deployment_parameters="${deployment_parameters} ${sql_server_id_name_param}"
        shift 2
        ;;
    --sqlServerIdentitySubscriptionId)
        requireValue "${1}" "${2-}"
        inputParams+=("${1}")
        sql_server_id_sub_id_param="sqlServerIdentitySubscriptionId=${2}"
        deployment_parameters="${deployment_parameters} ${sql_server_id_sub_id_param}"
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

# Azure allows only ONE vnet-to-zone link regardless of the link resource's
# own name, so if some link into the webapp/api/dataflows private DNS zone
# already exists for this vnet (e.g. a leftover link from a previous run of
# this script, or one created by hand before the current naming scheme),
# creating a second, differently-named one fails with a Conflict. This is the
# CAMS-760 hotfix check: the link itself moved from app-shared-setup.bicep
# into main.bicep's ustpWebappDnsZoneLink module (so it's stack-managed and
# self-cleans on branch teardown), which means THIS script — the one that
# actually deploys main.bicep — now has to perform the existence check that
# used to live in azure-deploy-app-shared-setup.sh, and forward the result via
# main.bicep's webappVnetLinkAlreadyExists parameter (see vnet-links.bicep).
# Mirrors the identical check azure-deploy-app-shared-setup.sh still performs
# for the KV zone's own (unmoved) link (both now call the shared
# vnet_link_already_exists_for helper — see _vnet-link-check.sh). Falls back
# to the same defaults main.bicep itself uses (privateDnsZoneName default
# 'privatelink.azurewebsites.us', privateDnsZoneResourceGroup default
# networkResourceGroupName) when --privateDnsZoneName/--privateDnsZoneResourceGroup
# weren't passed in, so the check still targets the zone this deployment will
# actually link against. Also passes --privateDnsZoneSubscriptionId through
# (empty/unset unless USTP prod overrides it) so the check runs against the
# same subscription main.bicep's ustpWebappDnsZoneLink module targets.
webappPrivateDnsZoneName="${private_dns_zone_name:-privatelink.azurewebsites.us}"
webappPrivateDnsZoneRg="${private_dns_zone_rg:-${network_rg:-}}"
webapp_vnet_link_already_exists=false
if [[ -n "${network_rg:-}" && -n "${vnet_name:-}" ]]; then
    vnet_link_already_exists_for "${webappPrivateDnsZoneRg}" "${webappPrivateDnsZoneName}" "${network_rg}" "${vnet_name}" "${stack_name}" "${private_dns_zone_sub_id:-}"
    existingWebappLink="${vnet_link_check_result}"
    if [[ -n "${existingWebappLink}" ]]; then
        echo "Vnet ${vnet_name} is already linked to ${webappPrivateDnsZoneName} via '${existingWebappLink}'; skipping creation of a second link."
        webapp_vnet_link_already_exists=true
    else
        echo "No existing link from vnet ${vnet_name} into ${webappPrivateDnsZoneName} in ${webappPrivateDnsZoneRg} (or any other same-named zone); the template will create one."
    fi
else
    # validateParameters only checks --networkResourceGroupName/--virtualNetworkName
    # were passed, not that their values are non-empty, so this guard can't
    # be assumed unreachable. Not fatal here — the template still applies its
    # own safe default (webappVnetLinkAlreadyExists=false, i.e. attempt
    # creation normally) — but silently skipping the check left zero
    # diagnostic trail, unlike the KV-zone call site's unconditional (fail-
    # loud) contract in azure-deploy-app-shared-setup.sh.
    echo "WARNING: skipping webapp DNS zone vnet-link existence check — networkResourceGroupName ('${network_rg:-}') or virtualNetworkName ('${vnet_name:-}') is empty." >&2
fi
deployment_parameters="${deployment_parameters} webappVnetLinkAlreadyExists=${webapp_vnet_link_already_exists}"

# The virtual network is deployed separately by azure-deploy-network.sh before this
# script runs (CAMS-760, Option E); vnet existence / deployVnet handling lives there.
#
# The cross-scope SHARED resources main.bicep used to deploy (the app-config Key
# Vault + its managed identity/role assignments, and the read-only SQL managed
# identity) are now deployed separately, always as a plain deployment, by
# azure-deploy-app-shared-setup.sh / app-shared-setup.bicep — BEFORE this script
# runs. That split is what makes it safe to stack the resources left in
# main.bicep: they no longer reach into shared resource groups. (An earlier
# version wrapped the whole app deploy, cross-scope resources included, in a
# stack; a branch teardown then deleted the shared kv-ustp-cams-dev — GH #2749.)
#
# For branches, deploy main.bicep as an Azure Deployment Stack so it can be torn
# down as a unit, same as the network tier. Main keeps the plain deployment.
if [[ "${is_branch_deployment:-false}" == "true" ]]; then
    az_stack_deploy_func "${app_rg}" "${deployment_file}" "${deployment_parameters}"
else
    az_deploy_func "${app_rg}" "${deployment_file}" "${deployment_parameters}"
fi
