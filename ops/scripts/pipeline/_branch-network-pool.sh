#!/usr/bin/env bash
# Title:        _branch-network-pool.sh
# Description:  Shared helper for Goal 3 of the SQL Private Link hub-and-spoke
#               rework (cams-vwsp3): the reserved address pool used for
#               dynamic per-branch VNet allocation, and the pure address-math
#               needed to carve/find/name slots within it. Source this file
#               from consuming scripts; do not execute it directly.
#
# Why a pool, not a ledger: every branch VNet today deploys with the SAME
# unvaried default (10.10.0.0/16, see network.bicep's vnetAddressPrefix),
# which is fine while branches never peer with each other or the hub, but
# becomes a hard blocker once branches need to peer to the shared SQL
# Private Link hub (vnet-ustp-cams-sql-hub) -- Azure rejects a new peering
# whenever the remote VNet's address space overlaps ANY VNet already peered
# to the same local VNet (transitive across all of that VNet's existing
# peerings; confirmed live). Rather than persisting a slot ledger (a KV
# secret, a Cosmos doc, etc. -- another moving part to keep consistent with
# reality), this design derives "what's claimed" LIVE from the hub's own
# peering list (see branch_network_claimed_slot_indices below) each time a
# branch needs to allocate, and leans on Azure's own overlap rejection as the
# authoritative collision detector for the couldn't-avoid-it race between two
# branches claiming concurrently (see azure-deploy-network.sh's retry loop).
#
# Pool sizing: 10.128.0.0/12 (10.128.0.0 - 10.143.255.255) -- deliberately
# far from both main's static 10.10.0.0/16 (network.bicep's default) and the
# hub's own 10.20.0.0/24 (sql-hub.bicep's hubVnetAddressPrefix), so a
# dynamically-picked branch slot can never collide with either of those just
# by construction; the live collision check above only ever has to worry
# about OTHER branches' slots. Divided into /20 slots (4096 addresses each --
# generous relative to the ~64 addresses a branch's four /28 subnets actually
# need today, matching the user's explicit preference for headroom over
# tightness): a /12 -> /20 split is 20-12=8 variable bits, i.e. 256 possible
# concurrent branch allocations. That is far more headroom than realistic
# concurrent-branch counts will ever need, without being wastefully huge.
#
# Exports:
#   BRANCH_NETWORK_HUB_VNET_NAME_DEFAULT / BRANCH_NETWORK_HUB_RESOURCE_GROUP_DEFAULT
#     -> the fixed hub identity, matching sql-hub.bicep's
#        hubVirtualNetworkName default and main.bicep's
#        hubVirtualNetworkResourceGroupName default.
#   branch_network_slot_cidr IDX
#     -> echoes the /20 CIDR for pool slot IDX (0-255).
#   branch_network_subnet_prefixes SLOT_CIDR
#     -> sets globals branch_slot_webapp_subnet_prefix /
#        branch_slot_api_subnet_prefix / branch_slot_private_endpoint_subnet_prefix /
#        branch_slot_dataflows_subnet_prefix.
#   branch_network_slot_index_for_cidr CIDR
#     -> echoes the pool slot index for a /20 CIDR that falls within the
#        pool, or nothing if it doesn't.
#   branch_network_claimed_slot_indices HUB_RG HUB_VNET
#     -> echoes claimed slot indices (one per line), derived from the hub's
#        LIVE peerings.
#   branch_network_find_free_slot HUB_RG HUB_VNET [EXCLUDED_INDICES]
#     -> echoes the first unclaimed, non-excluded slot index; returns 1 with
#        nothing on stdout if the pool is exhausted.
#   branch_network_hub_peering_name_for BRANCH_VNET_NAME [HUB_VNET_NAME]
#   branch_network_branch_peering_name_for BRANCH_VNET_NAME [HUB_VNET_NAME]
#     -> the deterministic peering names for each side -- single source of
#        truth shared between azure-deploy-network.sh (creates them) and
#        az-delete-branch-resources.sh (deletes the hub-side one on
#        teardown), same reasoning as _network-stackname.sh's
#        network_stack_name_for.
#   branch_network_is_overlap_error TEXT
#     -> true (exit 0) if TEXT looks like Azure's VNet-peering address-space
#        overlap rejection.

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "ERROR: This script must be sourced, not executed directly." >&2
  exit 1
fi

readonly BRANCH_NETWORK_POOL_SECOND_OCTET_BASE=128
readonly BRANCH_NETWORK_POOL_SECOND_OCTET_SPAN=16
readonly BRANCH_NETWORK_POOL_SLOT_PREFIX_LEN=20
readonly BRANCH_NETWORK_POOL_SLOT_COUNT=256

# shellcheck disable=SC2034 # REASON: read by callers in other sourcing scripts, not within this file
readonly BRANCH_NETWORK_HUB_VNET_NAME_DEFAULT='vnet-ustp-cams-sql-hub'
# shellcheck disable=SC2034 # REASON: read by callers in other sourcing scripts, not within this file
readonly BRANCH_NETWORK_HUB_RESOURCE_GROUP_DEFAULT='bankruptcy-oversight-support-systems'

branch_network_slot_cidr() {
  local idx=$1
  if [[ ${idx} -lt 0 || ${idx} -ge ${BRANCH_NETWORK_POOL_SLOT_COUNT} ]]; then
    echo "ERROR: slot index ${idx} out of range [0, $((BRANCH_NETWORK_POOL_SLOT_COUNT - 1))]" >&2
    return 1
  fi
  local secondOctet=$(( BRANCH_NETWORK_POOL_SECOND_OCTET_BASE + idx / BRANCH_NETWORK_POOL_SECOND_OCTET_SPAN ))
  local thirdOctet=$(( (idx % BRANCH_NETWORK_POOL_SECOND_OCTET_SPAN) * BRANCH_NETWORK_POOL_SECOND_OCTET_SPAN ))
  echo "10.${secondOctet}.${thirdOctet}.0/${BRANCH_NETWORK_POOL_SLOT_PREFIX_LEN}"
}

# Mirrors the +10/+11/+12/+13 THIRD-octet offsets network.bicep's static
# defaults use inside 10.10.0.0/16 today (10.10.10.0/28, 10.10.11.0/28,
# 10.10.12.0/28, 10.10.13.0/28), applied relative to the given /20 slot's own
# third octet. So slot 10.128.16.0/20 yields 10.128.26.0/28 .. 10.128.29.0/28.
#
# Always valid, and never crosses out of the slot: branch_network_slot_cidr
# guarantees the slot's third octet is a multiple of 16 and its fourth octet is
# 0, a /20 spans 16 third-octet values, and the largest offset used is +13.
# Keeping the fourth octet at 0 also keeps every /28 network-aligned, which ARM
# requires -- it rejects a prefix with host bits set (e.g. 10.128.0.10/28).
branch_network_subnet_prefixes() {
  local slotCidr=$1
  local base=${slotCidr%/*}
  local o1 o2 o3 o4
  IFS='.' read -r o1 o2 o3 o4 <<<"${base}"
  # shellcheck disable=SC2034 # REASON: read by callers in other sourcing scripts, not within this file
  branch_slot_webapp_subnet_prefix="${o1}.${o2}.$((o3 + 10)).0/28"
  # shellcheck disable=SC2034 # REASON: read by callers in other sourcing scripts, not within this file
  branch_slot_api_subnet_prefix="${o1}.${o2}.$((o3 + 11)).0/28"
  # shellcheck disable=SC2034 # REASON: read by callers in other sourcing scripts, not within this file
  branch_slot_private_endpoint_subnet_prefix="${o1}.${o2}.$((o3 + 12)).0/28"
  # shellcheck disable=SC2034 # REASON: read by callers in other sourcing scripts, not within this file
  branch_slot_dataflows_subnet_prefix="${o1}.${o2}.$((o3 + 13)).0/28"
}

branch_network_slot_index_for_cidr() {
  local cidr=$1
  local base=${cidr%%/*}
  local prefixLen=${cidr##*/}
  [[ "${prefixLen}" != "${BRANCH_NETWORK_POOL_SLOT_PREFIX_LEN}" ]] && return 0
  local o1 o2 o3 o4
  IFS='.' read -r o1 o2 o3 o4 <<<"${base}"
  [[ "${o1}" != "10" ]] && return 0
  [[ ${o2} -lt ${BRANCH_NETWORK_POOL_SECOND_OCTET_BASE} || ${o2} -ge $((BRANCH_NETWORK_POOL_SECOND_OCTET_BASE + BRANCH_NETWORK_POOL_SECOND_OCTET_SPAN)) ]] && return 0
  [[ $(( o3 % BRANCH_NETWORK_POOL_SECOND_OCTET_SPAN )) -ne 0 ]] && return 0
  [[ "${o4}" != "0" ]] && return 0
  echo $(( (o2 - BRANCH_NETWORK_POOL_SECOND_OCTET_BASE) * BRANCH_NETWORK_POOL_SECOND_OCTET_SPAN + o3 / BRANCH_NETWORK_POOL_SECOND_OCTET_SPAN ))
}

# Derived from `remoteAddressSpace.addressPrefixes[0]` on each of the hub's
# live peerings -- the address space Azure itself recorded for that peering's
# remote VNet, not a separate `az network vnet show` per peering. This is the
# live, no-ledger "what's in use" signal the whole design relies on.
#
# Communicates the result via the global branch_network_claimed_indices rather
# than stdout, and MUST be called as a plain statement. That is deliberate, for
# the same reason _vnet-link-check.sh's helpers do it: an earlier version
# returned the indices on stdout and was consumed as
# `claimed=" $(branch_network_claimed_slot_indices ... | tr '\n' ' ') "`. Being
# inside a pipeline inside a command substitution exempts it from errexit AND
# discards its exit status, so a failed `az` call -- expired token, throttling,
# hub VNet not yet created -- produced an EMPTY prefix list that read as "no
# slots claimed." Every branch deploying during that window would then be handed
# slot 0. `return 1` and `exit 1` are both swallowed the same way there, so
# failing loud is only possible off the stdout path.
#
# A single peering whose remote address space can't be parsed is still skipped
# silently: that under-reports one slot, and Azure's own peering overlap
# rejection catches it a retry later. The distinction that matters is between
# "one unreadable entry" (benign, recoverable) and "the whole query failed"
# (must not be read as an empty pool).
branch_network_claimed_slot_indices() {
  local hubRg=$1
  local hubVnet=$2
  # shellcheck disable=SC2034 # REASON: read by callers in other sourcing scripts, not within this file
  branch_network_claimed_indices=""
  local prefixes errFile rc
  errFile=$(mktemp)
  # stderr captured separately, never merged with 2>&1 -- a CLI upgrade nag or
  # deprecation notice spliced into stdout would be parsed as an address prefix.
  prefixes=$(az network vnet peering list --resource-group "${hubRg}" --vnet-name "${hubVnet}" --query "[].remoteAddressSpace.addressPrefixes[0]" -o tsv 2>"${errFile}")
  rc=$?
  if [[ ${rc} -ne 0 ]]; then
    echo "ERROR: failed to list peerings on hub vnet ${hubVnet} in ${hubRg} (exit ${rc}): $(cat "${errFile}")" >&2
    echo "ERROR: cannot determine which address-pool slots are claimed; refusing to treat this as an empty pool." >&2
    rm -f "${errFile}"
    return 1
  fi
  rm -f "${errFile}"
  local prefix idx claimed=""
  while IFS= read -r prefix; do
    [[ -z "${prefix}" ]] && continue
    idx=$(branch_network_slot_index_for_cidr "${prefix}")
    [[ -n "${idx}" ]] && claimed+="${idx} "
  done <<<"${prefixes}"
  # shellcheck disable=SC2034 # REASON: read by callers in other sourcing scripts, not within this file
  branch_network_claimed_indices="${claimed}"
}

# Sets branch_network_free_slot to the lowest unclaimed, non-excluded slot
# index. Same plain-statement contract as branch_network_claimed_slot_indices
# above -- do NOT call via `x=$(branch_network_find_free_slot ...)`, or a failure
# to read the claimed set becomes indistinguishable from "pool exhausted."
branch_network_find_free_slot() {
  local hubRg=$1
  local hubVnet=$2
  local excluded=" ${3:-} "
  # shellcheck disable=SC2034 # REASON: read by callers in other sourcing scripts, not within this file
  branch_network_free_slot=""
  branch_network_claimed_slot_indices "${hubRg}" "${hubVnet}" || return 1
  local claimed=" ${branch_network_claimed_indices} "
  local idx
  for (( idx=0; idx<BRANCH_NETWORK_POOL_SLOT_COUNT; idx++ )); do
    [[ "${claimed}" == *" ${idx} "* ]] && continue
    [[ "${excluded}" == *" ${idx} "* ]] && continue
    # shellcheck disable=SC2034 # REASON: read by callers in other sourcing scripts, not within this file
    branch_network_free_slot="${idx}"
    return 0
  done
  echo "ERROR: branch network address pool exhausted -- all ${BRANCH_NETWORK_POOL_SLOT_COUNT} slots are claimed or were tried and lost a race this run." >&2
  return 1
}

branch_network_hub_peering_name_for() {
  local branchVnetName=$1
  local hubVnetName=${2:-${BRANCH_NETWORK_HUB_VNET_NAME_DEFAULT}}
  echo "peer-${hubVnetName}-to-${branchVnetName}"
}

branch_network_branch_peering_name_for() {
  local branchVnetName=$1
  local hubVnetName=${2:-${BRANCH_NETWORK_HUB_VNET_NAME_DEFAULT}}
  echo "peer-${branchVnetName}-to-${hubVnetName}"
}

# Matched on message text, not a stable error code -- Azure does not
# document a stable code for this rejection (confirmed live), only message
# text containing "overlaps with the address space of the already peered
# virtual network". Matched loosely (case-insensitive "overlap" AND "peer"
# both present) so small message wording drift across API versions doesn't
# silently stop being recognized as a retry-worthy condition.
branch_network_is_overlap_error() {
  local text=$1
  grep -qi "overlap" <<<"${text}" && grep -qi "peer" <<<"${text}"
}
