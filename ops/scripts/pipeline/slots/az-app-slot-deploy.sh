#!/usr/bin/env bash

# Title:        az-app-slot-deploy.sh
# Description:  Helper script to deploy webapp build artifact to existing Azure slot
# Usage:        ./az-app-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n webappName --networkRg networkRgName --vnet vnetName --subnet subnetName --slotName slotName
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 3   Failed commit sha check
# 10+ Validation check errors
set -euo pipefail # ensure job step fails in CI pipeline when error occurs

while [[ $# -gt 0 ]]; do
    case $1 in
    -h | --help)
        echo "USAGE: az-app-slot-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n functionappName --slotName slotName --sha commitSha"
        shift
        ;;
    -g | --resourceGroup)
        app_rg="${2}"
        shift 2
        ;;
    -n | --name)
        app_name="${2}"
        shift 2
        ;;
    -s | --src)
        artifact_path="${2}"
        shift 2
        ;;
    --slotName)
        slot_name="${2}"
        shift 2
        ;;
    --gitSha)
        gitSha="${2}"
        shift 2
        ;;
    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

if [ ! -f "${artifact_path}" ]; then
    echo "Error: missing build artifact ${artifact_path}"
    exit 10
fi

scm_default_action_changed=false

function on_exit() {
    # Restore SCM default action to Deny if it was changed
    if [ "${scm_default_action_changed}" = true ]; then
        echo "Restoring SCM default action to Deny..."
        az webapp config access-restriction set \
            -g "${app_rg}" \
            -n "${app_name}" \
            --slot "${slot_name}" \
            --scm-default-action Deny 2>/dev/null || echo "Warning: Failed to restore SCM default action"
    fi
}
trap on_exit EXIT

# verify gitSha
mkdir sha-verify
unzip -q "${artifact_path}" -d sha-verify
shaFound=$(grep "${gitSha}" sha-verify/index.html)
if [[ ${shaFound} == "" ]]; then
  exit 3
else
  echo "Found ${gitSha} in index.html."
fi

# Temporary workaround: Set SCM default action to Allow for deployment
# TODO: Replace with more granular access control mechanism
echo "Setting SCM default action to Allow for deployment"
az webapp config access-restriction set \
    -g "${app_rg}" \
    -n "${app_name}" \
    --slot "${slot_name}" \
    --scm-default-action Allow

scm_default_action_changed=true

echo "Waiting for access restriction propagation..."
sleep 10

# Deploy with retry logic and exponential backoff
max_attempts=4
attempt=1
backoff=2

while [ $attempt -le $max_attempts ]; do
    echo "Deployment attempt ${attempt}/${max_attempts}..."

    if az webapp deploy --resource-group "${app_rg}" --src-path "${artifact_path}" --name "${app_name}" --slot "${slot_name}" --type zip --async false --track-status true --clean true; then
        echo "Deployment succeeded on attempt ${attempt}"
        echo "Restarting webapp slot to clear cache..."
        az webapp restart --resource-group "${app_rg}" --name "${app_name}" --slot "${slot_name}"
        echo "Waiting for restart to complete..."
        sleep 15
        break
    else
        exit_code=$?
        if [ $attempt -lt $max_attempts ]; then
            echo "Deployment failed with exit code ${exit_code}. Waiting ${backoff} seconds before retry..."
            sleep $backoff
            backoff=$((backoff * 2))
            attempt=$((attempt + 1))
        else
            echo "Deployment failed after ${max_attempts} attempts"
            exit $exit_code
        fi
    fi
done

# shellcheck disable=SC2086
az webapp traffic-routing set --distribution ${slot_name}=0 --name "${app_name}" --resource-group "${app_rg}"
