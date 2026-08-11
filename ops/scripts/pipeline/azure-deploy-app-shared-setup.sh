#!/usr/bin/env bash

# Title:        azure-deploy-app-shared-setup.sh
# Description:  Deploy the USTP CAMS app-tier shared setup resources (the
#               app-config Key Vault + its managed identity/role assignments,
#               and the read-only SQL managed identity) into the shared
#               AZURE_RG. Always a plain resource-group deployment for both
#               main and branches (CAMS-760, Option E) — these resources are
#               genuinely shared and must never be managed by a branch's
#               Deployment Stack.
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

deployment_file=''
resource_group=''
stack_name=''
network_rg=''
vnet_name=''
kv_app_config_rg=''
kv_app_config_name=''
id_keyvault_app_config=''
sql_server_name=''
sql_server_rg=''
sql_server_identity_name=''
sql_server_identity_rg=''
is_ustp_deployment=false
deploy_dns=true
location=''
extra_parameters=''

while [[ $# -gt 0 ]]; do
    case $1 in
    -f | --file)
        deployment_file="${2}"
        shift 2
        ;;
    --resource-group)
        resource_group="${2}"
        shift 2
        ;;
    --stackName)
        stack_name="${2}"
        shift 2
        ;;
    --networkResourceGroupName)
        network_rg="${2}"
        shift 2
        ;;
    --virtualNetworkName)
        vnet_name="${2}"
        shift 2
        ;;
    --kvAppConfigResourceGroupName)
        kv_app_config_rg="${2}"
        shift 2
        ;;
    --kvAppConfigName)
        kv_app_config_name="${2}"
        shift 2
        ;;
    --idKeyvaultAppConfiguration)
        id_keyvault_app_config="${2}"
        shift 2
        ;;
    --sqlServerName)
        sql_server_name="${2}"
        shift 2
        ;;
    --sqlServerResourceGroupName)
        sql_server_rg="${2}"
        shift 2
        ;;
    --sqlServerIdentityName)
        sql_server_identity_name="${2}"
        shift 2
        ;;
    --sqlServerIdentityResourceGroupName)
        sql_server_identity_rg="${2}"
        shift 2
        ;;
    --isUstpDeployment)
        is_ustp_deployment="${2}"
        shift 2
        ;;
    --deployDns)
        deploy_dns="${2}"
        shift 2
        ;;
    -l | --location)
        location="${2}"
        shift 2
        ;;
    # Space-delimited "key=value" bicep parameters passed straight through
    -p | --parameters)
        extra_parameters="${2}"
        shift 2
        ;;
    *)
        echo "Exit on param: ${1}"
        exit 2
        ;;
    esac
done

if [[ -z "${deployment_file}" || -z "${resource_group}" || -z "${stack_name}" || -z "${network_rg}" || -z "${vnet_name}" || -z "${kv_app_config_rg}" || -z "${location}" ]]; then
    echo "Error: --file, --resource-group, --stackName, --networkResourceGroupName, --virtualNetworkName, --kvAppConfigResourceGroupName and --location are required"
    exit 10
fi

# Azure allows only ONE vnet-to-zone link regardless of the link resource's
# own name, so if some link into the KV's private DNS zone already exists for
# this vnet (e.g. a legacy private endpoint from before the current naming
# scheme), creating a second, differently-named one fails with a Conflict.
# Check for any existing link before deploying and tell the template to skip
# creating its own when one is already there (see vnet-links.bicep).
# Hardcoded zone name matches keyvaultPrivateDnsZoneName in
# ustp-cams-kv-app-config-setup.bicep and kvPrivateDnsZoneName in
# az-delete-branch-resources.sh — can't share the literal across bash/bicep,
# keep all three in lockstep by hand. Assumes the zone lives in
# networkResourceGroupName, matching app-shared-setup.bicep's
# privateDnsZoneResourceGroup default — only true as long as nothing passes
# an explicit override via --parameters.
kvPrivateDnsZoneName='privatelink.vaultcore.usgovcloudapi.net'
vnetId=$(az network vnet show -g "${network_rg}" -n "${vnet_name}" --query id -o tsv 2>/dev/null || echo "")
vnet_link_already_exists=false
if [[ -n "${vnetId}" ]]; then
    existingLink=$(az network private-dns link vnet list -g "${network_rg}" --zone-name "${kvPrivateDnsZoneName}" --query "[?virtualNetwork.id=='${vnetId}'].name | [0]" -o tsv 2>/dev/null || echo "")
    if [[ -n "${existingLink}" ]]; then
        echo "Vnet ${vnet_name} is already linked to ${kvPrivateDnsZoneName} via '${existingLink}'; skipping creation of a second link."
        vnet_link_already_exists=true
    fi
fi

deployment_parameters="stackName=${stack_name} location=${location} networkResourceGroupName=${network_rg} virtualNetworkName=${vnet_name} kvAppConfigResourceGroupName=${kv_app_config_rg} isUstpDeployment=${is_ustp_deployment} deployDns=${deploy_dns} vnetLinkAlreadyExists=${vnet_link_already_exists}"
[[ -n "${kv_app_config_name}" ]] && deployment_parameters="${deployment_parameters} kvAppConfigName=${kv_app_config_name}"
[[ -n "${id_keyvault_app_config}" ]] && deployment_parameters="${deployment_parameters} idKeyvaultAppConfiguration=${id_keyvault_app_config}"
[[ -n "${sql_server_name}" ]] && deployment_parameters="${deployment_parameters} sqlServerName=${sql_server_name}"
[[ -n "${sql_server_rg}" ]] && deployment_parameters="${deployment_parameters} sqlServerResourceGroupName=${sql_server_rg}"
[[ -n "${sql_server_identity_name}" ]] && deployment_parameters="${deployment_parameters} sqlServerIdentityName=${sql_server_identity_name}"
[[ -n "${sql_server_identity_rg}" ]] && deployment_parameters="${deployment_parameters} sqlServerIdentityResourceGroupName=${sql_server_identity_rg}"
if [[ -n "${extra_parameters}" ]]; then
    deployment_parameters="${deployment_parameters} ${extra_parameters}"
fi

# Every branch (plus main) deploys this template to the SAME shared resource
# group. A deployment NAME collision there can hit a transient conflict —
# retry with backoff rather than failing the whole pipeline run on what is
# usually just a timing collision. Two known conflict shapes: a 409
# AnotherOperationInProgress on the resource group itself, and (since --name
# below pins one deployment record per stack name) a (DeploymentActive)
# error when the SAME branch redeploys while its own prior deployment to
# that name is still active — that one prints no literal "409" anywhere in
# the CLI output, so it needs its own pattern. Only retries when the
# captured output actually looks like one of these two; a genuine
# template/validation error fails immediately instead of silently burning
# ~45s of pointless retries first. Output is captured (not streamed live)
# so it can be inspected before deciding whether to retry, then echoed in
# full either way so it's still visible in CI logs.
function az_deploy_with_retry_func() {
    local maxAttempts=3
    local attempt=1
    local delaySeconds=15
    local output
    local rc
    while true; do
        set +e
        output=$("$@" 2>&1)
        rc=$?
        set -e
        echo "${output}"
        if [[ ${rc} -eq 0 ]]; then
            return 0
        fi
        if [[ ${attempt} -ge ${maxAttempts} ]] || ! grep -qi "AnotherOperationInProgress\|409\|DeploymentActive" <<< "${output}"; then
            echo "ERROR: deployment failed after ${attempt} attempt(s)." >&2
            return 1
        fi
        echo "WARNING: deployment attempt ${attempt} failed with what looks like a concurrent operation in progress; retrying in ${delaySeconds}s." >&2
        sleep "${delaySeconds}"
        attempt=$((attempt + 1))
        delaySeconds=$((delaySeconds * 2))
    done
}

echo "Deploying app shared-setup resources to ${resource_group} (plain resource-group deployment; always non-stack — see app-shared-setup.bicep)"
# --name pins the deployment RECORD name so every branch/main deploying this
# same template to the same shared RG doesn't race on the CLI's default
# (the template's base filename) — reduces exactly the 409 contention the
# retry wrapper above exists to paper over, rather than just retrying through it.
# shellcheck disable=SC2086 # REASON: intentional word-splitting of --parameter
az_deploy_with_retry_func az deployment group create -w --name "${stack_name}-shared-setup" -g "${resource_group}" --template-file "${deployment_file}" --parameter ${deployment_parameters}
# shellcheck disable=SC2086 # REASON: intentional word-splitting of --parameter
az_deploy_with_retry_func az deployment group create --name "${stack_name}-shared-setup" -g "${resource_group}" --template-file "${deployment_file}" --parameter ${deployment_parameters}
