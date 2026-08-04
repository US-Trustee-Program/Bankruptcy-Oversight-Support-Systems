#!/usr/bin/env bash

# Description: Helper script to derive the network Deployment Stack's name
# from a branch/main stack name. Single source of truth for this formula —
# azure-deploy-network.sh (which creates the stack) and
# az-delete-branch-resources.sh (which tears it down) both call this rather
# than each independently reconstructing "<stackName>-network". A mismatch
# there fails silently: stack_exists() returns empty, teardown reports
# "nothing to delete", and the branch's network stack leaks with no error.
# Usage: generate-network-stackname.sh <stackName:str>

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

stackName=$1

echo "${stackName}-network"
