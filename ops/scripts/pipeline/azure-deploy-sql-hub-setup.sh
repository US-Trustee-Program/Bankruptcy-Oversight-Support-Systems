#!/usr/bin/env bash

# Title:        azure-deploy-sql-hub-setup.sh
# Description:  Deploy the SQL Private Link hub CORE -- a dedicated hub
#               VNet/subnet and ONE Private Endpoint against sql-ustp-cams --
#               into bankruptcy-oversight-support-systems, the SQL server's
#               own resource group.
#
#               The hub creates NO DNS zone of its own. Its Private Endpoint
#               registers into the existing privatelink.database.usgovcloudapi.net
#               zones that consumers are already linked to, so adopting it needs
#               no consumer to unlink and relink its VNet -- Azure rejects
#               linking one VNet to two zones of the same name, which would make
#               that a hard resolution outage per consumer. See
#               lib/network/sql-hub.bicep.
#
#               This is standalone, one-time/shared infra with its own
#               lifecycle, deliberately NOT folded into
#               azure-deploy-app-shared-setup.sh (which targets the
#               per-environment AZURE_RG, not the SQL server's RG) and NOT a
#               Deployment Stack (bankruptcy-oversight-support-systems is not
#               otherwise stack-managed).
#
#               Run via the manual "Deploy SQL Private Link Hub" workflow
#               (.github/workflows/deploy-sql-hub.yml). Deliberately NOT part of
#               continuous deployment: every environment's SQL resolution
#               depends on this one endpoint, so redeploying it must be a
#               deliberate act, never a side effect of a branch deploy.
#
#               Spoke peerings are NOT created here. Each spoke owns its own,
#               as its own targeted deployment -- branches via
#               azure-deploy-network.sh, main via main.bicep's
#               createMainHubPeering. Migrating consumers off their existing
#               per-consumer Private Endpoints is a separate, staged operation;
#               see docs/operations/deployment.md.
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
    # create`. Preview first: this endpoint is shared by every environment.
    --what-if)
        what_if=true
        shift 1
        ;;
    # Space-delimited "key=value" bicep parameters passed straight through.
    #
    # These are word-split deliberately at the az call sites below, which also
    # exposes them to pathname expansion. A JSON array value -- the form an
    # array-typed bicep parameter needs, e.g.
    # consumerPrivateDnsZoneResourceGroups=["rg-cams-network"] -- contains
    # brackets, which bash reads as a glob character class. Globbing is
    # therefore disabled around those expansions (set -f). Nothing here relies
    # on globbing, and without it a stray matching filename in the working
    # directory would silently rewrite a deployment parameter.
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
        set -f # see --parameters above: split, but never glob
        # shellcheck disable=SC2086 # REASON: intentional word-splitting of --parameter
        az deployment group what-if --name "ustp-cams-sql-hub" -g "${resource_group}" --template-file "${deployment_file}" --parameter ${extra_parameters}
        set +f
    else
        az deployment group what-if --name "ustp-cams-sql-hub" -g "${resource_group}" --template-file "${deployment_file}"
    fi
    exit 0
fi

echo "Deploying SQL Private Link hub to ${resource_group}"
if [[ -n "${extra_parameters}" ]]; then
    set -f # see --parameters above: split, but never glob
    # shellcheck disable=SC2086 # REASON: intentional word-splitting of --parameter
    az_deploy_with_retry_func az deployment group create --name "ustp-cams-sql-hub" -g "${resource_group}" --template-file "${deployment_file}" --parameter ${extra_parameters}
    set +f
else
    az_deploy_with_retry_func az deployment group create --name "ustp-cams-sql-hub" -g "${resource_group}" --template-file "${deployment_file}"
fi
