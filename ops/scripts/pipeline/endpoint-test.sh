#!/usr/bin/env bash

# Title:        endpoint-test.sh
# Description:  Verify 200 response from frontend and backend
# Usage:        ./endpoint-test.sh --webappName webappName --apiFunctionName apiFunctionName --slot slotName
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors
set -euo pipefail # ensure job step fails in CI pipeline when error occurs

#TODO: Remove hostSuffix reference from this script is it pointless

slot_name=''
expected_git_sha=''
isLocalRun=''
while [[ $# -gt 0 ]]; do
  case $1 in
  -h | --help)
    echo "./endpoint-test.sh --webappName webappName --apiFunctionName apiFunctionName --slot slotName"
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

  --hostSuffix)
    host_suffix="${2}"
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
    host_suffix=""
    shift
    ;;
  *)
    exit 2 # error on unknown flag/switch
    ;;
  esac
done

echo "REMOVE HOST SUFFIX $host_suffix"

webStatusCode=""
apiStatusCode=""
targetApiURL="https://${api_name}.azurewebsites.us/api/healthcheck"
targetWebAppURL="https://${webapp_name}.azurewebsites.us"

if [[ ${slot_name} == "staging" ]]; then
  targetApiURL="${targetApiURL}?x-ms-routing-name=${slot_name}"
  targetWebAppURL="${targetWebAppURL}?x-ms-routing-name=${slot_name}"
else
  echo "No Slot Provided"
fi

if [[ ${slot_name} == "initial" ]]; then
  expected_git_sha="ProductionSlot"
fi

if [[ ${isLocalRun} == "true" ]]; then
  echo "Running against local"
  targetApiURL="http://localhost:7071/api/healthcheck"
  targetWebAppURL="http://localhost:3000"
fi

webCmd=(curl -q -o /dev/null -I -L -s -w "%{http_code}" --retry 5 --retry-delay 60 --retry-all-errors -f "${targetWebAppURL}")
apiCmd=(curl -q -o /dev/null -L -s -w "%{http_code}" --retry 5 --retry-delay 60 --retry-all-errors -f "${targetApiURL}")

echo "Checking Webapp endpoint: ${targetWebAppURL}"
webStatusCode=$("${webCmd[@]}")
echo "Checking API endpoint: ${targetApiURL}"
apiStatusCode=$("${apiCmd[@]}")

if [[ "${expected_git_sha}" != '' ]]; then
  echo "Expect sha ${expected_git_sha}"
  retry=0
  currentGitSha=""
  while [ "${expected_git_sha}" != "${currentGitSha}" ] && [ ${retry} -le 2 ]; do
    retry=$((retry+1))
    curl "${targetApiURL}" | tee api_response.json
    currentGitSha=$(python3 -c "import sys, json; print(json.load(open('api_response.json'))['data']['info']['sha'])")
    echo "Current sha ${currentGitSha}"
    if [[ "${expected_git_sha}" == "${currentGitSha}" ]]; then
      apiStatusCode=$("${apiCmd[@]}")
    else
      apiStatusCode=0 # if version does not match set to a non 200 status code
      sleep 60
    fi
  done

fi

if [[ $webStatusCode = "200" && $apiStatusCode = "200" ]]; then
  exit 0
else
  echo "Health check error. Response codes webStatusCode=$webStatusCode apiStatusCode=$apiStatusCode"
  exit 1
fi
