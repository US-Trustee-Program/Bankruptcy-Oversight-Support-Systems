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
    # Remove temporary IP access rules if they were added
    if [ -n "${runner_ip}" ]; then
        echo "Removing temporary IP access rules..."
        az functionapp config access-restriction remove -g "${app_rg}" -n "${app_name}" --slot "${slot_name}" --rule-name "deploy-runner-temp-1" --scm-site true 2>/dev/null || true
        az functionapp config access-restriction remove -g "${app_rg}" -n "${app_name}" --slot "${slot_name}" --rule-name "deploy-runner-temp-2" --scm-site true 2>/dev/null || true
    fi

}
trap on_exit EXIT

if [ ! -f "$artifact_path" ]; then
    echo "Error: missing build artifact ${artifact_path}"
    exit 10
fi

# Add temporary IP access rules for SCM site (allow all IPs using two CIDR ranges)
echo "=========================================="
echo "Adding IP access rules to allow all addresses"
echo "Rule names: deploy-runner-temp-1, deploy-runner-temp-2"
echo "=========================================="

# Azure requires two CIDR ranges to cover all IPs: 0.0.0.0/1 and 128.0.0.0/1
az functionapp config access-restriction add \
    -g "${app_rg}" \
    -n "${app_name}" \
    --slot "${slot_name}" \
    --rule-name "deploy-runner-temp-1" \
    --action Allow \
    --ip-address "0.0.0.0/1" \
    --priority 100 \
    --scm-site true

az functionapp config access-restriction add \
    -g "${app_rg}" \
    -n "${app_name}" \
    --slot "${slot_name}" \
    --rule-name "deploy-runner-temp-2" \
    --action Allow \
    --ip-address "128.0.0.0/1" \
    --priority 101 \
    --scm-site true

runner_ip="all"

echo ""
echo "Verifying IP rules were added..."
az functionapp config access-restriction show \
    -g "${app_rg}" \
    -n "${app_name}" \
    --slot "${slot_name}" \
    --query "scmIpSecurityRestrictions[?name=='deploy-runner-temp-1' || name=='deploy-runner-temp-2']" \
    -o table

echo ""
echo "All current SCM access rules:"
az functionapp config access-restriction show \
    -g "${app_rg}" \
    -n "${app_name}" \
    --slot "${slot_name}" \
    --query "scmIpSecurityRestrictions[].{Name:name, IP:ipAddress, Action:action, Priority:priority}" \
    -o table

echo ""
echo "Waiting for access restriction propagation..."
sleep 10

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
