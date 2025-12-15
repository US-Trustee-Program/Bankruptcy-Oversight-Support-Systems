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

function on_exit() {
    # always try to remove temporary access
    az webapp config access-restriction remove -g "${app_rg}" -n "${app_name}" --slot "${slot_name}" --rule-name "${rule_name}" --scm-site true 1>/dev/null
    az webapp config access-restriction remove -g "${app_rg}" -n "${app_name}" --rule-name "${rule_name}" --scm-site true 1>/dev/null
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

# allow build agent access to execute deployment
agent_ip=$(curl -s --retry 3 --retry-delay 30 --retry-all-errors https://api.ipify.org)
agent_ip=$(echo "${agent_ip}" | sed -E 's/\.[0-9]+(\/[0-9]+)?$/.0\/24/')
echo "App name: ${app_name}."
echo "Slot name: ${slot_name}."
rule_name="agent-slot-${app_name:0:21}"
echo "Adding rule: ${rule_name} to webapp. IP: ${agent_ip}."

az webapp config access-restriction add -g "${app_rg}" -n "${app_name}" --slot "${slot_name}" --rule-name "${rule_name}" --action Allow --ip-address "${agent_ip}" --priority 232 --scm-site true 1>/dev/null
az webapp config access-restriction add -g "${app_rg}" -n "${app_name}" --rule-name "${rule_name}" --action Allow --ip-address "${agent_ip}" --priority 232 --scm-site true 1>/dev/null

# Verify access restrictions were added
az webapp config access-restriction show -g "${app_rg}" -n "${app_name}" --slot "${slot_name}"

# Deploy with retry logic and exponential backoff
max_attempts=4
attempt=1
backoff=2

while [ $attempt -le $max_attempts ]; do
    echo "Deployment attempt ${attempt}/${max_attempts}..."

    if az webapp deploy --resource-group "${app_rg}" --src-path "${artifact_path}" --name "${app_name}" --slot "${slot_name}" --type zip --async true --track-status false --clean true; then
        echo "Deployment succeeded on attempt ${attempt}"
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
