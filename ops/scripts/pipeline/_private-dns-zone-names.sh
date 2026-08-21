#!/usr/bin/env bash
# Shared constants for the private DNS zone names used by the app-tier
# deployment scripts. Source this file from consuming scripts; do not
# execute it directly.
#
# Single source of truth for these literals — azure-deploy.sh,
# azure-deploy-app-shared-setup.sh, and az-delete-branch-resources.sh all
# source this rather than each independently hardcoding the zone names. A
# mismatch there fails silently: vnet-link checks/deletes stop matching the
# actual zone and either leak a link (delete path) or misreport
# webappVnetLinkAlreadyExists/sqlVnetLinkAlreadyExists (deploy path).
#
# These are Azure Government cloud zone names, fixed by Azure (not
# environment-specific), which is why they're plain constants rather than
# script parameters. The Bicep-side copies (main.bicep,
# app-shared-setup.bicep, ustp-cams-kv-app-config-setup.bicep,
# backend-api-deploy.bicep, dataflows-resource-deploy.bicep) can't share
# these literals with bash and must still be kept in lockstep by hand.
#
# Exports:
#   kvPrivateDnsZoneName      -> privatelink.vaultcore.usgovcloudapi.net
#   webappPrivateDnsZoneName  -> privatelink.azurewebsites.us
#   sqlPrivateDnsZoneName     -> privatelink.database.usgovcloudapi.net

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "ERROR: This script must be sourced, not executed directly." >&2
  exit 1
fi

# shellcheck disable=SC2034 # REASON: consumed by scripts that source this file, not used here
kvPrivateDnsZoneName='privatelink.vaultcore.usgovcloudapi.net'
# shellcheck disable=SC2034 # REASON: consumed by scripts that source this file, not used here
webappPrivateDnsZoneName='privatelink.azurewebsites.us'
# shellcheck disable=SC2034 # REASON: consumed by scripts that source this file, not used here
sqlPrivateDnsZoneName='privatelink.database.usgovcloudapi.net'
