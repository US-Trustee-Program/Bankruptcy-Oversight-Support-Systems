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

# NOTE: adding a parameter here obligates the USTP ADO pipeline template to pass it, which is a
# multi-step change on government-furnished equipment. Parameters with a safe main.bicep default
# that USTP does not vary (e.g. --functionsPlanType) belong in allParams only, not here.
requiredUSTPParams=("--enabledDataflows" "--mssqlRequestTimeout" "--migrateCaseAppointmentsFetchSize" "--isUstpDeployment" "--resource-group" "--file" "--stackName" "--slotName" "--gitSha" "--networkResourceGroupName" "--virtualNetworkName" "--idKeyvaultAppConfiguration" "--kvAppConfigName" "--cosmosDatabaseName" "--ustpIssueCollectorHash" "--createAlerts" "--deployAppInsights" "--apiFunctionPlanName" "--dataflowsFunctionPlanName" "--webappPlanType" "--loginProvider" "--loginProviderConfig" "--sqlServerName" "--sqlServerResourceGroupName" "--oktaUrl" "--location" "--webappSubnetName" "--apiFunctionSubnetName" "--privateEndpointSubnetName" "--dataflowsSubnetName" "--privateDnsZoneName" "--privateDnsZoneResourceGroup" "--privateDnsZoneSubscriptionId" "--analyticsResourceGroupName" "--analyticsSubscriptionId" "--kvAppConfigResourceGroupName" "--deployDns")

requiredFlexionParams=("--enabledDataflows" "--mssqlRequestTimeout" "--migrateCaseAppointmentsFetchSize" "--resource-group" "--file" "--stackName" "--slotName" "--gitSha" "--networkResourceGroupName" "--kvAppConfigName" "--kvAppConfigResourceGroupName" "--virtualNetworkName" "--analyticsResourceGroupName" "--idKeyvaultAppConfiguration" "--cosmosDatabaseName" "--ustpIssueCollectorHash" "--createAlerts" "--createMainHubPeering" "--deployAppInsights" "--loginProvider" "--loginProviderConfig" "--sqlServerName" "--sqlServerResourceGroupName" "--sqlServerIdentityName" "--actionGroupName" "--oktaUrl" "--e2eDatabaseName" "--e2eSqlDatabaseName")

# shellcheck disable=SC2034 # REASON: to have a reference for all possible parameters
allParams=("--enabledDataflows" "--mssqlRequestTimeout" "--migrateCaseAppointmentsFetchSize" "--isUstpDeployment" "--resource-group" "--file" "--stackName" "--slotName" "--gitSha" "--networkResourceGroupName" "--virtualNetworkName" "--analyticsWorkspaceId" "--idKeyvaultAppConfiguration" "--kvAppConfigName" "--cosmosDatabaseName" "--deployVnet" "--ustpIssueCollectorHash" "--createAlerts" "--createMainHubPeering" "--deployAppInsights" "--apiFunctionPlanName" "--dataflowsFunctionPlanName" "--webappPlanType" "--functionsPlanType" "--loginProvider" "--loginProviderConfig" "--sqlServerName" "--sqlServerResourceGroupName" "--sqlServerIdentityResourceGroupName" "--sqlServerIdentityName" "--sqlServerIdentitySubscriptionId" "--actionGroupName" "--adminNotificationEmail" "--defaultNotificationRecipient" "--oktaUrl" "--location" "--webappSubnetName" "--apiFunctionSubnetName" "--privateEndpointSubnetName" "--webappSubnetAddressPrefix" "--apiFunctionSubnetAddressPrefix" "--dataflowsSubnetName" "--dataflowsSubnetAddressPrefix" "--vnetAddressPrefix" "--linkVnetIds" "--privateDnsZoneName" "--privateDnsZoneResourceGroup" "--privateDnsZoneSubscriptionId" "--analyticsResourceGroupName" "--analyticsSubscriptionId" "--kvAppConfigResourceGroupName" "--deployDns" "--e2eDatabaseName" "--e2eSqlDatabaseName" "--customDomain" "--useSqlPrivateLink")


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

# Wraps vnet_link_already_exists_for (see _vnet-link-check.sh) with the
# warn-and-default-false fallback shared by every private-DNS-zone
# vnet-link check below (webapp, SQL, ...), so the call sites can't
# independently drift out of sync -- see _vnet-link-check.sh's own header
# for why that's a real risk here, not hypothetical: the KV/webapp/SQL
# zone-name literals already have to be kept in lockstep by hand across
# multiple files.
#
# Sets check_vnet_link_result to "true"/"false" for the caller to fold into
# deployment_parameters (deliberately a different global than
# vnet_link_check_result, which this still calls through to, so a caller
# reading the result after this returns can't confuse the two contracts).
function check_vnet_link_or_warn() {
    local zoneRg=$1
    local zoneName=$2
    local label=$3
    check_vnet_link_result=false
    if [[ -n "${network_rg:-}" && -n "${vnet_name:-}" ]]; then
        vnet_link_already_exists_for "${zoneRg}" "${zoneName}" "${network_rg}" "${vnet_name}" "${stack_name}" "${private_dns_zone_sub_id:-}"
        local existingLink="${vnet_link_check_result}"
        if [[ -n "${existingLink}" ]]; then
            echo "Vnet ${vnet_name} is already linked to ${zoneName} via '${existingLink}'; skipping creation of a second link."
            check_vnet_link_result=true
        else
            echo "No existing link from vnet ${vnet_name} into ${zoneName} in ${zoneRg} (or any other same-named zone); the template will create one."
        fi
    else
        # validateParameters only checks --networkResourceGroupName/--virtualNetworkName
        # were passed, not that their values are non-empty, so this guard can't
        # be assumed unreachable. Not fatal here -- the template still applies its
        # own safe default (*VnetLinkAlreadyExists=false, i.e. attempt creation
        # normally) -- but silently skipping the check left zero diagnostic
        # trail, unlike the KV-zone call site's unconditional (fail-loud)
        # contract in azure-deploy-app-shared-setup.sh.
        echo "WARNING: skipping ${label} DNS zone vnet-link existence check — networkResourceGroupName ('${network_rg:-}') or virtualNetworkName ('${vnet_name:-}') is empty." >&2
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
    --analyticsSubscriptionId)
        inputParams+=("${1}")
        analytics_subscription_id_param="analyticsSubscriptionId=${2}"
        deployment_parameters="${deployment_parameters} ${analytics_subscription_id_param}"
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
    --createMainHubPeering)
        inputParams+=("${1}")
        create_main_hub_peering_param="createMainHubPeering=${2}"
        deployment_parameters="${deployment_parameters} ${create_main_hub_peering_param}"
        shift 2
        ;;
    --actionGroupName)
        inputParams+=("${1}")
        action_group_name_param="actionGroupName=${2}"
        deployment_parameters="${deployment_parameters} ${action_group_name_param}"
        shift 2
        ;;
    --adminNotificationEmail)
        inputParams+=("${1}")
        admin_notification_email_param="adminNotificationEmail=${2}"
        deployment_parameters="${deployment_parameters} ${admin_notification_email_param}"
        shift 2
        ;;
    --defaultNotificationRecipient)
        inputParams+=("${1}")
        default_notification_recipient_param="defaultNotificationRecipient=${2}"
        deployment_parameters="${deployment_parameters} ${default_notification_recipient_param}"
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

    --functionsPlanType)
        inputParams+=("${1}")
        functions_plan_type_param="functionsPlanType=${2}"
        deployment_parameters="${deployment_parameters} ${functions_plan_type_param}"
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

    --useSqlPrivateLink)
        inputParams+=("${1}")
        use_sql_private_link_param="useSqlPrivateLink=${2}"
        deployment_parameters="${deployment_parameters} ${use_sql_private_link_param}"
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
check_vnet_link_or_warn "${webappPrivateDnsZoneRg}" "${webappPrivateDnsZoneName}" "webapp"
deployment_parameters="${deployment_parameters} webappVnetLinkAlreadyExists=${check_vnet_link_result}"

# Same Conflict-avoidance check as above, for the SQL Private Link zone
# (privatelink.database.usgovcloudapi.net). Unlike the webapp link,
# main.bicep's ustpSqlDnsZoneLink module is UNCONDITIONAL -- not gated on
# useSqlPrivateLink -- because the SQL server auto-redirects its public FQDN
# to the privatelink subdomain server-wide the instant any branch's PE is
# approved, which would strand main and every other non-PE consumer if only
# the PE-using branch were linked to the zone (see main.bicep's comment on
# that module for the full rationale). This check MUST therefore also run
# unconditionally for every deploy, including main's -- do NOT gate it on
# useSqlPrivateLink, or main's redeploy will hit a Conflict trying to
# recreate a link this check should have detected already exists.
# main.bicep's ustpSqlDnsZoneLink module links this vnet into the SAME
# privateDnsZoneResourceGroup/privateDnsZoneSubscriptionId scope as the
# webapp zone link (just a different zone name), so this reuses
# webappPrivateDnsZoneRg/private_dns_zone_sub_id rather than introducing a
# separate --sqlPrivateDnsZoneResourceGroup param that doesn't exist.
sqlPrivateDnsZoneName='privatelink.database.usgovcloudapi.net'
check_vnet_link_or_warn "${webappPrivateDnsZoneRg}" "${sqlPrivateDnsZoneName}" "SQL"
deployment_parameters="${deployment_parameters} sqlVnetLinkAlreadyExists=${check_vnet_link_result}"

# A vnet link is a CHILD of the zone, so linking into a zone that doesn't
# exist fails the whole deployment with ParentResourceNotFound -- it is not
# tolerated the way a missing link is. On Flexion the zone is bootstrapped by
# app-shared-setup.bicep before this script runs, so it is always present. The
# USTP ADO pipeline never runs app-shared-setup.bicep and passes
# --deployDns false, so nothing has ever created this zone there, and USTP
# staging's main.bicep deploy fails outright (confirmed live 2026-08-21).
#
# Gate the link on the zone actually existing rather than on which pipeline is
# deploying: this is the real precondition, it self-heals the moment USTP does
# bootstrap the zone, and it protects Flexion from the identical failure in a
# freshly-provisioned shared network RG. zone_exists_for tolerates
# ResourceNotFound but still fails loud on a genuine az error, so a throttle or
# auth blip can't be silently misread as "no zone" (see _vnet-link-check.sh).
#
# Computed here rather than accepted as a CLI flag, exactly like
# sqlVnetLinkAlreadyExists above -- so this needs no entry in allParams and,
# critically, no change to the USTP ADO pipeline template.
zone_exists_for "${webappPrivateDnsZoneRg}" "${sqlPrivateDnsZoneName}" "${private_dns_zone_sub_id:-}"
if [[ "${zone_check_result}" != "true" ]]; then
    echo "SQL private DNS zone ${sqlPrivateDnsZoneName} not found in ${webappPrivateDnsZoneRg}; skipping its vnet link (nothing in this environment uses the SQL Private Endpoint path)."
fi
deployment_parameters="${deployment_parameters} sqlDnsZoneExists=${zone_check_result}"

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
