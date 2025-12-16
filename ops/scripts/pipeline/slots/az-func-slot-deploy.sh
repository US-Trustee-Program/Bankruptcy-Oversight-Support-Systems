#!/usr/bin/env bash

# Title:        az-func-slot-deploy.sh
# Description:  Helper script to deploy function build artifact to existing Azure slot
# Usage:        ./az-func-slot-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n functionappName --networkRg networkRgName --vnet vnet --subnet subnetName --slotName slotName
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors

set -euo pipefail # ensure job step fails in CI pipeline when error occurs
enable_debug=false
while [[ $# -gt 0 ]]; do
    case $1 in
    -h | --help)
        echo "USAGE: az-func-slot-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n functionappName --slotName slotName"
        exit 0
        ;;

    -d | --debug)
        enable_debug=true
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

    --commitSha)
        commitSha="${2}"
        shift 2
        ;;

    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

function on_exit() {
    # Remove temporary IP access rule if it was added
    if [ -n "${runner_ip}" ]; then
        echo "Removing temporary IP access rule for ${runner_ip}..."
        az functionapp config access-restriction remove -g "${app_rg}" -n "${app_name}" --slot "${slot_name}" --rule-name "deploy-runner-temp" --scm-site true 2>/dev/null || true
    fi

}
trap on_exit EXIT

if [ ! -f "$artifact_path" ]; then
    echo "Error: missing build artifact ${artifact_path}"
    exit 10
fi

# Get runner's public IP with cache-busting to avoid stale responses
echo "Getting runner's public IP address..."
runner_ip=$(curl -s --retry 3 --retry-delay 30 --retry-connrefused "https://api.ipify.org?t=$(date +%s)")
echo "Runner IP: ${runner_ip}"

# Add temporary IP access rule for SCM site
echo "Adding temporary IP access rule for runner..."
az functionapp config access-restriction add \
    -g "${app_rg}" \
    -n "${app_name}" \
    --slot "${slot_name}" \
    --rule-name "deploy-runner-temp" \
    --action Allow \
    --ip-address "${runner_ip}/32" \
    --priority 100 \
    --scm-site true

echo "IP access rule added. Waiting for propagation..."
sleep 5

# Configure info sha
az functionapp config appsettings set -g "${app_rg}" -n "${app_name}" --slot "${slot_name}" --settings "INFO_SHA=${commitSha}"

# Deploy with retry logic and exponential backoff
max_attempts=6
attempt=1
backoff=2

# Wait for access restrictions to propagate before first attempt
echo "Waiting ${backoff} seconds for access restrictions to propagate..."
sleep $backoff

while [ $attempt -le $max_attempts ]; do
    echo "Deployment attempt ${attempt}/${max_attempts}..."

    # Construct deployment command
    cmd="az functionapp deployment source config-zip -g ${app_rg} -n ${app_name} --slot ${slot_name} --src ${artifact_path}"
    if [[ ${enable_debug} == 'true' ]]; then
        cmd="${cmd} --debug"
    fi

    if eval "${cmd}"; then
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
