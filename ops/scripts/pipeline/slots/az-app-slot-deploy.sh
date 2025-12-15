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
    # Restore original access restrictions
    echo "Restoring original access restrictions..."

    # Restore SCM site restrictions
    if [ -n "$saved_restrictions" ] && [ "$saved_restrictions" != "[]" ]; then
        echo "$saved_restrictions" | jq -c '.[]' | while IFS= read -r restriction; do
            rule_name=$(echo "$restriction" | jq -r '.name')
            ip_address=$(echo "$restriction" | jq -r '.ipAddress // empty')
            priority=$(echo "$restriction" | jq -r '.priority')
            action=$(echo "$restriction" | jq -r '.action')

            if [ -n "$ip_address" ]; then
                echo "Restoring SCM rule: ${rule_name} (${ip_address})"
                az webapp config access-restriction add -g "${app_rg}" -n "${app_name}" --slot "${slot_name}" \
                    --rule-name "${rule_name}" --action "${action}" --ip-address "${ip_address}" \
                    --priority "${priority}" --scm-site true 2>/dev/null || true
            fi
        done
    fi

    # Restore main site restrictions
    if [ -n "$saved_main_restrictions" ] && [ "$saved_main_restrictions" != "[]" ]; then
        echo "$saved_main_restrictions" | jq -c '.[]' | while IFS= read -r restriction; do
            rule_name=$(echo "$restriction" | jq -r '.name')
            ip_address=$(echo "$restriction" | jq -r '.ipAddress // empty')
            priority=$(echo "$restriction" | jq -r '.priority')
            action=$(echo "$restriction" | jq -r '.action')

            if [ -n "$ip_address" ]; then
                echo "Restoring main site rule: ${rule_name} (${ip_address})"
                az webapp config access-restriction add -g "${app_rg}" -n "${app_name}" \
                    --rule-name "${rule_name}" --action "${action}" --ip-address "${ip_address}" \
                    --priority "${priority}" --scm-site false 2>/dev/null || true
            fi
        done
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

# Save current SCM access restrictions for restoration later
echo "Saving current SCM access restrictions..."
saved_restrictions=$(az webapp config access-restriction show -g "${app_rg}" -n "${app_name}" --slot "${slot_name}" --query "scmIpSecurityRestrictions" -o json)

# Remove all SCM access restrictions to allow deployment
echo "Removing all SCM access restrictions temporarily..."
restriction_names=$(echo "$saved_restrictions" | jq -r '.[].name // empty')
if [ -n "$restriction_names" ]; then
    while IFS= read -r rule_name; do
        echo "Removing rule: ${rule_name}"
        az webapp config access-restriction remove -g "${app_rg}" -n "${app_name}" --slot "${slot_name}" --rule-name "${rule_name}" --scm-site true 2>/dev/null || true
    done <<< "$restriction_names"
fi

# Also remove main site restrictions
saved_main_restrictions=$(az webapp config access-restriction show -g "${app_rg}" -n "${app_name}" --query "ipSecurityRestrictions" -o json)
main_restriction_names=$(echo "$saved_main_restrictions" | jq -r '.[].name // empty')
if [ -n "$main_restriction_names" ]; then
    while IFS= read -r rule_name; do
        echo "Removing main site rule: ${rule_name}"
        az webapp config access-restriction remove -g "${app_rg}" -n "${app_name}" --rule-name "${rule_name}" --scm-site false 2>/dev/null || true
    done <<< "$main_restriction_names"
fi

echo "All access restrictions removed. Deployment should now proceed."

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
