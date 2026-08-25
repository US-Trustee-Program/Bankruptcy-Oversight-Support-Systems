#!/usr/bin/env bash

# Title:        azure-deploy-sql-hub-setup.sh
# Description:  Deploy the SQL Private Link hub CORE -- a dedicated hub
#               VNet/subnet and ONE Private Endpoint against sql-ustp-cams --
#               into bankruptcy-oversight-support-systems, the SQL server's
#               own resource group.
#
#               Run via the manual "Deploy SQL Private Link Hub" workflow
#               (.github/workflows/deploy-sql-hub.yml). Migrating consumers off
#               their own Private Endpoints is a separate, staged operation --
#               see docs/operations/deployment.md.
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors

set -euo pipefail

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
    # Preview first: this endpoint is shared by every environment.
    --what-if)
        what_if=true
        shift 1
        ;;
    # Space-delimited "key=value" bicep parameters, word-split at the az calls
    # below. An array value like foo=["rg-cams-network"] contains brackets,
    # which bash reads as a glob character class -- so a matching filename in
    # the working directory would silently rewrite the parameter. Hence set -f.
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
