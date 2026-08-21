#!/usr/bin/env bash

# Title:        azure-deploy-sql-hub-setup.sh
# Description:  Deploy the SQL Private Link hub (Goal 1 of cams-vwsp3's
#               hub-and-spoke rework) -- a dedicated hub VNet/subnet, ONE
#               Private Endpoint against sql-ustp-cams, and a hub-owned
#               Private DNS Zone (privatelink.database.usgovcloudapi.net) --
#               into bankruptcy-oversight-support-systems, the SQL server's
#               own resource group.
#
#               This is standalone, one-time/shared infra with its own
#               lifecycle, deliberately NOT folded into
#               azure-deploy-app-shared-setup.sh (which targets the
#               per-environment AZURE_RG, not the SQL server's RG) and NOT a
#               Deployment Stack (bankruptcy-oversight-support-systems is not
#               otherwise stack-managed).
#
#               Peering main/branch VNets to this hub and migrating them off
#               their existing per-consumer PEs/zones are LATER goals of
#               cams-vwsp3, not performed by this script.
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/pipeline/_az-deploy-retry.sh
source "$SCRIPT_DIR/_az-deploy-retry.sh"

deployment_file="$SCRIPT_DIR/../../cloud-deployment/lib/network/sql-hub.bicep"
resource_group=''
what_if=false
extra_parameters=''

while [[ $# -gt 0 ]]; do
    case $1 in
    --resource-group)
        resource_group="${2}"
        shift 2
        ;;
    # Runs `az deployment group what-if` instead of `az deployment group
    # create` -- the required mode while this hub is still under review and
    # not yet approved for an actual deploy (cams-vwsp3 Goal 1).
    --what-if)
        what_if=true
        shift 1
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

if [[ -z "${resource_group}" ]]; then
    echo "Error: --resource-group is required"
    exit 10
fi

if [[ "${what_if}" == "true" ]]; then
    echo "Running what-if for SQL Private Link hub against ${resource_group}"
    if [[ -n "${extra_parameters}" ]]; then
        # shellcheck disable=SC2086 # REASON: intentional word-splitting of --parameter
        az deployment group what-if --name "ustp-cams-sql-hub" -g "${resource_group}" --template-file "${deployment_file}" --parameter ${extra_parameters}
    else
        az deployment group what-if --name "ustp-cams-sql-hub" -g "${resource_group}" --template-file "${deployment_file}"
    fi
    exit 0
fi

echo "Deploying SQL Private Link hub to ${resource_group}"
if [[ -n "${extra_parameters}" ]]; then
    # shellcheck disable=SC2086 # REASON: intentional word-splitting of --parameter
    az_deploy_with_retry_func az deployment group create --name "ustp-cams-sql-hub" -g "${resource_group}" --template-file "${deployment_file}" --parameter ${extra_parameters}
else
    az_deploy_with_retry_func az deployment group create --name "ustp-cams-sql-hub" -g "${resource_group}" --template-file "${deployment_file}"
fi
