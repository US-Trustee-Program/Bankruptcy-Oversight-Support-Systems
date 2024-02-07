#!/usr/bin/env bash

# Title:        check-git-diff.sh
# Description:  Helper script to check if bicepchanges have been made
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

changes=$(git diff HEAD^ HEAD -- ./ops/cloud-deployment/)



if [[ $changes != "" ]]; then
    deployBicep=true
else
    deployBicep=false
fi

echo $deployBicep
