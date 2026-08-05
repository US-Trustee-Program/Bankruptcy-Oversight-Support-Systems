#!/usr/bin/env bash
# Shared helper for deriving the network Deployment Stack's name from a
# branch/main stack name. Source this file from consuming scripts; do not
# execute it directly.
#
# Single source of truth for this formula — azure-deploy-network.sh (which
# creates the stack) and az-delete-branch-resources.sh (which tears it
# down) both source this rather than each independently reconstructing
# "<stackName>-network". A mismatch there fails silently: stack_exists()
# returns empty, teardown reports "nothing to delete", and the branch's
# network stack leaks with no error.
#
# Exports:
#   network_stack_name_for STACK_NAME -> prints the network stack name to stdout

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "ERROR: This script must be sourced, not executed directly." >&2
  exit 1
fi

network_stack_name_for() {
  local stackName=$1
  echo "${stackName}-network"
}
