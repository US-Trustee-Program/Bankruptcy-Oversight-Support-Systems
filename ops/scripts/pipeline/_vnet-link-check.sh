#!/usr/bin/env bash
# Shared helper for checking whether a vnet already has a private-DNS-zone
# link, before a deployment tries to create one. Source this file from
# consuming scripts; do not execute it directly.
#
# Azure allows only ONE vnet-to-zone link regardless of the link resource's
# own name, so if some link into a zone already exists for a given vnet
# (e.g. a legacy link from before the current naming scheme, or a link this
# same script created on a prior run), creating a second, differently-named
# one fails with a Conflict. azure-deploy-app-shared-setup.sh (KV zone) and
# azure-deploy.sh (webapp/api/dataflows zone, CAMS-760 hotfix) both need this
# exact "look up the vnet, then look up an existing link into the zone
# matching that vnet" check. Single source of truth here so the two scripts
# can't independently reconstruct the query and drift apart — see
# _network-stackname.sh for the identical rationale on a different formula.
#
# Exports:
#   vnet_link_already_exists_for ZONE_RG ZONE_NAME VNET_RG VNET_NAME [SUBSCRIPTION_ID]
#     -> prints the matched link's name to stdout, or an empty string if no
#        link exists (or the vnet itself doesn't exist yet). SUBSCRIPTION_ID
#        is optional; pass an empty string or omit it to use the CLI's
#        current default subscription — `az ... --subscription ""` is a
#        malformed call, so this deliberately omits the flag entirely rather
#        than pass an empty value.

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "ERROR: This script must be sourced, not executed directly." >&2
  exit 1
fi

vnet_link_already_exists_for() {
  local zoneRg=$1
  local zoneName=$2
  local vnetRg=$3
  local vnetName=$4
  local subscriptionId="${5:-}"

  local subscriptionArg=""
  if [[ -n "${subscriptionId}" ]]; then
    subscriptionArg="--subscription ${subscriptionId}"
  fi

  local vnetId
  # shellcheck disable=SC2086 # REASON: intentional word-splitting of optional --subscription flag
  vnetId=$(az network vnet show -g "${vnetRg}" -n "${vnetName}" ${subscriptionArg} --query id -o tsv 2>/dev/null || echo "")
  if [[ -z "${vnetId}" ]]; then
    echo ""
    return
  fi

  # shellcheck disable=SC2086 # REASON: intentional word-splitting of optional --subscription flag
  az network private-dns link vnet list -g "${zoneRg}" --zone-name "${zoneName}" ${subscriptionArg} --query "[?virtualNetwork.id=='${vnetId}'].name | [0]" -o tsv 2>/dev/null || echo ""
}
