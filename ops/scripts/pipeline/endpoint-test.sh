#!/usr/bin/env bash

# Title:        endpoint-test.sh
# Description:  Verify 200 response from frontend and backend
# Usage:        ./endpoint-test.sh --webappName webappName --apiName apiName --slot slotName --hostSuffix hostSuffix
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
while [[ $# -gt 0 ]]; do
  case $1 in
  -h | --help)
    echo "./endpoint-test.sh --webappName webappName --apiName apiName --slot slotName --hostSuffix hostSuffix"
    exit 0
    ;;

  --apiName)
    api_name="${2}"
    shift 2
    ;;

  --webappName)
    webapp_name="${2}"
    shift 2
    ;;

  --hostSuffix)
    host_suffix="${2}"
    shift 2
    ;;

  --slotName)
    slot_name="${2}"
    shift 2
    ;;

  --gitSha)
    expected_git_sha="${2}"
    shift 2
    ;;
  *)
    exit 2 # error on unknown flag/switch
    ;;
  esac
done

webStatusCode=""
apiStatusCode=""
targetApiURL="https://${api_name}.azurewebsites${host_suffix}/api/healthcheck"
targetWebAppURL="https://${webapp_name}.azurewebsites${host_suffix}"

# shellcheck disable=SC1083 # REASON: Wants to quote http_code
webCmd="curl -q -o /dev/null -I -L -s -w "%{http_code}" --retry 5 --retry-delay 60 --retry-all-errors -f ${targetWebAppURL}"
# shellcheck disable=SC1083 # REASON: Wants to quote http_code
apiCmd="curl -q -o /dev/null -L -s -w "%{http_code}" --retry 5 --retry-delay 60 --retry-all-errors -f ${targetApiURL}"

if [[ ${slot_name} == "self" ]]; then
  echo "No Slot Provided"
  echo "Checking Webapp endpoint..."
  webStatusCode=$($webCmd)
  echo "Checking API endpoint..."
  apiStatusCode=$($apiCmd)
else
  webCmd="${webCmd}?x-ms-routing-name=${slot_name}"
  apiCmd="${apiCmd}?x-ms-routing-name=${slot_name}"
  echo "Checking Webapp endpoint..."
  webStatusCode=$($webCmd)
  echo "Checking API endpoint..."
  apiStatusCode=$($apiCmd)
  targetApiURL+="?x-ms-routing-name=${slot_name}"

  if [[ -n "${expected_git_sha}" ]]; then
    echo "Expect sha ${expected_git_sha}"
    retry=0
    currentGitSha=""
    while [ "${expected_git_sha}" != "${currentGitSha}" ] && [ ${retry} -le 2 ]; do
      retry=$((retry+1))
      # shellcheck disable=SC2086 # REASON: Wants to quote targetApiURL
      curl ${targetApiURL} | tee api_response.json
      # shellcheck disable=SC2002
      currentGitSha=$(cat api_response.json | python3 -c "import sys, json; print(json.load(sys.stdin)['info']['sha'])")
      echo "Current sha ${currentGitSha}"
      if [[ "${expected_git_sha}" == "${currentGitSha}" ]]; then
        apiStatusCode=$($apiCmd)
      else
        apiStatusCode=500 # if version does not match set to a non 200 status code
        sleep 60
      fi
    done


  fi
fi

if [[ $webStatusCode = "200" && $apiStatusCode = "200" ]]; then
  exit 0
else
  echo "Health check error. Response codes webStatusCode=$webStatusCode apiStatusCode=$apiStatusCode"
  exit 1
fi
