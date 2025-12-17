#!/usr/bin/env bash

# Title:        endpoint-test.sh
# Description:  Verify 200 response from frontend and backend
# Usage:        ./endpoint-test.sh --webappName webappName --apiFunctionName apiFunctionName --slot slotName --resourceGroup rgName
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors
set -euo pipefail # ensure job step fails in CI pipeline when error occurs

slot_name=''
expected_git_sha=''
isLocalRun=''
resource_group=''
main_default_action_changed=false

# shellcheck disable=SC2329  # Function is invoked via trap
function on_exit() {
    # Restore main site default actions to Deny if they were changed
    if [ "${main_default_action_changed}" = true ] && [ -n "${resource_group}" ]; then
        echo "Restoring main site default actions to Deny..."
        if [ -n "${webapp_name}" ]; then
            if [ -n "${slot_name}" ] && [ "${slot_name}" != "initial" ] && [ "${slot_name}" != "self" ]; then
                az webapp config access-restriction set -g "${resource_group}" -n "${webapp_name}" --slot "${slot_name}" --default-action Deny 2>/dev/null || echo "Warning: Failed to restore webapp default action"
            else
                az webapp config access-restriction set -g "${resource_group}" -n "${webapp_name}" --default-action Deny 2>/dev/null || echo "Warning: Failed to restore webapp default action"
            fi
        fi
        if [ -n "${api_name}" ]; then
            if [ -n "${slot_name}" ] && [ "${slot_name}" != "initial" ] && [ "${slot_name}" != "self" ]; then
                az functionapp config access-restriction set -g "${resource_group}" -n "${api_name}" --slot "${slot_name}" --default-action Deny 2>/dev/null || echo "Warning: Failed to restore API default action"
            else
                az functionapp config access-restriction set -g "${resource_group}" -n "${api_name}" --default-action Deny 2>/dev/null || echo "Warning: Failed to restore API default action"
            fi
        fi
    fi
}
trap on_exit EXIT

while [[ $# -gt 0 ]]; do
  case $1 in
  -h | --help)
    echo "./endpoint-test.sh --webappName webappName --apiFunctionName apiFunctionName --slot slotName --resourceGroup rgName"
    exit 0
    ;;

  --apiFunctionName)
    api_name="${2}"
    shift 2
    ;;

  --webappName)
    webapp_name="${2}"
    shift 2
    ;;

  --slotName)
    slot_name="${2}"
    shift 2
    ;;

  --resourceGroup)
    resource_group="${2}"
    shift 2
    ;;

  --gitSha)
    expected_git_sha="${2}"
    shift 2
    ;;

  --local)
    isLocalRun="true"
    api_name=""
    webapp_name=""
    shift
    ;;
  *)
    exit 2 # error on unknown flag/switch
    ;;
  esac
done

webStatusCode=""
apiStatusCode=""
targetApiURL="https://${api_name}.azurewebsites.us/api/healthcheck"
targetWebAppURL="https://${webapp_name}.azurewebsites.us"

if [[ -n ${slot_name} && ${slot_name} != "initial" && ${slot_name} != "self" ]]; then
  targetApiURL="https://${api_name}-${slot_name}.azurewebsites.us/api/healthcheck"
  targetWebAppURL="https://${webapp_name}-${slot_name}.azurewebsites.us"
else
  echo "No Slot Provided"
  targetApiURL="https://${api_name}.azurewebsites.us/api/healthcheck"
  targetWebAppURL="https://${webapp_name}.azurewebsites.us"
fi

actualGitSha=$expected_git_sha
if [[ ${slot_name} == "initial" ]]; then
  expected_git_sha="ProductionSlot"
fi

if [[ ${isLocalRun} == "true" ]]; then
  echo "Running against local"
  targetApiURL="http://localhost:7071/api/healthcheck"
  targetWebAppURL="http://localhost:3000"
fi

# Temporarily set main site default actions to Allow for healthcheck access
if [ "${isLocalRun}" != "true" ] && [ -n "${resource_group}" ]; then
  echo "=========================================="
  echo "Setting main site default actions to Allow for healthcheck"
  echo "=========================================="

  if [ -n "${webapp_name}" ]; then
    if [ -n "${slot_name}" ] && [ "${slot_name}" != "initial" ] && [ "${slot_name}" != "self" ]; then
      az webapp config access-restriction set -g "${resource_group}" -n "${webapp_name}" --slot "${slot_name}" --default-action Allow
    else
      az webapp config access-restriction set -g "${resource_group}" -n "${webapp_name}" --default-action Allow
    fi
  fi

  if [ -n "${api_name}" ]; then
    if [ -n "${slot_name}" ] && [ "${slot_name}" != "initial" ] && [ "${slot_name}" != "self" ]; then
      az functionapp config access-restriction set -g "${resource_group}" -n "${api_name}" --slot "${slot_name}" --default-action Allow
    else
      az functionapp config access-restriction set -g "${resource_group}" -n "${api_name}" --default-action Allow
    fi
  fi

  main_default_action_changed=true

  echo "Waiting for access restriction propagation..."
  sleep 10
fi

webCmd=(curl -q -o /dev/null -I -L -s -w "%{http_code}" --retry 5 --retry-delay 60 --retry-all-errors -f "${targetWebAppURL}")
apiCmd=(curl -q -o /dev/null -L -s -w "%{http_code}" --retry 5 --retry-delay 60 --retry-all-errors -f "${targetApiURL}")

echo "Checking Webapp endpoint: ${targetWebAppURL}"
webStatusCode=$("${webCmd[@]}" || true)
echo "webStatusCode: $webStatusCode"
echo "Checking API endpoint: ${targetApiURL}"
apiStatusCode=$("${apiCmd[@]}" || true)
echo "apiStatusCode: $apiStatusCode"

if [[ "${expected_git_sha}" != '' ]]; then
  echo "Expect sha ${expected_git_sha}"
  retry=0
  currentGitSha=""
  while [ "${expected_git_sha}" != "${currentGitSha}" ] && [ ${retry} -le 2 ]; do
    retry=$((retry+1))
    echo "Retry attempt: $retry"
    curl "${targetApiURL}" -s | tee api_response.json || true
    echo "api_response.json contents:"
    cat api_response.json
    currentGitSha=$(python3 -c "import sys, json;
try:
    data = json.load(open('api_response.json'))
    print(data['data']['info']['sha'] if 'data' in data and 'info' in data['data'] and 'sha' in data['data']['info'] else '')
except Exception as e:
    print('')" || true)
    echo "Current sha ${currentGitSha}"
    echo "Comparing expected_git_sha: $expected_git_sha with currentGitSha: $currentGitSha"
    if [[ "${expected_git_sha}" == "${currentGitSha}" ]]; then
      apiStatusCode=$("${apiCmd[@]}" || true)
    else
      apiStatusCode=0 # if version does not match set to a non 200 status code
      sleep 60
    fi

    # Check front end SHA meta tag
    shaCheck="OK"
    webStatusCheck=$("${webCmd[@]}" || true)
    echo "webStatusCheck: $webStatusCheck"
    if [[ $webStatusCheck == "200" && "$actualGitSha" != "" ]]; then
      shaFound=$(curl "$targetWebAppURL" -s | grep "$actualGitSha" || true)
      echo "shaFound: $shaFound"
      if [[ $shaFound == "" ]]; then
        echo "Expected SHA not found in webapp HTML."
        shaCheck="FAILED"
        curl "$targetWebAppURL" -s | grep -i meta || true
      fi
    fi
  done
fi

echo "Final check: webStatusCode=$webStatusCode apiStatusCode=$apiStatusCode shaCheck=$shaCheck"

if [[ $webStatusCode = "200" && $apiStatusCode = "200" && $shaCheck = "OK" ]]; then
  exit 0
else
  echo "Health check error. Response codes webStatusCode=$webStatusCode apiStatusCode=$apiStatusCode shaCheck=$shaCheck"
  exit 1
fi
