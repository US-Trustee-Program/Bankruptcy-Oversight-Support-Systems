#!/usr/bin/env bash
# Shared helper for checking whether a vnet already has a private-DNS-zone
# link, before a deployment tries to create one. Source this file from
# consuming scripts; do not execute it directly.
#
# Azure allows only ONE vnet-to-zone link regardless of the link resource's
# own name, so if some link into a zone already exists for a given vnet
# (e.g. a legacy link from before the current naming scheme, or a link this
# same script created on a prior run), creating a second, differently-named
# one fails with a Conflict. Azure's one-link-per-vnet-per-zone constraint is
# enforced per zone NAME (namespace), not per zone object — confirmed live
# 2026-08-11: a stray link sitting in an unrelated, same-named zone in a
# DIFFERENT resource group blocked main's vnet from linking into the correct
# one, even though the target zone's own resource group had no link. So this
# checks both the intended zone AND every other same-named zone in the same
# subscription before concluding it's safe for the caller's template to
# create a new link.
#
# azure-deploy-app-shared-setup.sh (KV zone) and azure-deploy.sh (webapp/api/
# dataflows zone, CAMS-760 hotfix) both need this exact check. Single source
# of truth here so the two scripts can't independently reconstruct the query
# and drift apart — see _network-stackname.sh for the identical rationale on
# a different formula.
#
# Exports:
#   vnet_link_already_exists_for ZONE_RG ZONE_NAME VNET_RG VNET_NAME STACK_NAME [SUBSCRIPTION_ID]
#     Sets vnet_link_check_result to the matched link's name, or empty string
#     if no CONFLICTING link exists anywhere (the target zone, or any other
#     same-named zone in the subscription) and it's safe for the caller's
#     template to (re-)create its own link. STACK_NAME is the caller's own
#     stackName, used to compute its own expected link name
#     (${ZONE_NAME}-vnet-link-${STACK_NAME}, matching vnet-links.bicep's
#     naming) — a match on that specific name is this same template's own
#     link from a prior run, not a conflict, and must NOT set the result.
#     Confirmed live 2026-08-12: getting this wrong isn't just a false-
#     positive nuisance. For a caller whose template is deployed as an Azure
#     Deployment Stack with --action-on-unmanage deleteResources
#     (main.bicep's branch path, via azure-deploy.sh), wrongly setting
#     vnetLinkAlreadyExists=true for the stack's OWN link (found by this
#     same check on the stack's own prior deploy) flips that link's Bicep
#     condition to false, dropping it out of the template — which the stack
#     then deletes as "unmanaged." The next deploy finds nothing and
#     recreates it; the one after deletes it again, oscillating on every
#     other redeploy of a branch and silently breaking DNS resolution until
#     a push happens to land on a "create" cycle.
#     SUBSCRIPTION_ID is optional; pass an empty string or omit it to use the
#     CLI's current default subscription — `az ... --subscription ""` is a
#     malformed call, so this deliberately omits the flag entirely rather
#     than pass an empty value. Only applied to the zone-side lookups: the
#     vnet itself is always scoped to the CLI's current/default subscription
#     in every caller's Bicep, never to privateDnsZoneSubscriptionId — USTP
#     prod overrides that param to a DIFFERENT subscription than the vnet's
#     own, so applying it to the vnet lookup too would fail loud with a
#     misleading error on exactly the deploy path this exists to support.
#
#     MUST be called as a plain statement, e.g.
#       vnet_link_already_exists_for "$rg" "$zone" "$vnetRg" "$vnetName" "$stackName"
#       existingLink="${vnet_link_check_result}"
#     NEVER via command substitution (`x=$(vnet_link_already_exists_for ...)`)
#     — this function communicates via the global vnet_link_check_result
#     variable rather than stdout specifically so it CAN be called this way;
#     a subshell's mutation of a global never reaches the caller, so
#     capturing it via `$(...)` would silently leave vnet_link_check_result
#     unset (or stale from a previous call) in the parent shell regardless of
#     exit-status handling — exactly the class of silent failure this check
#     exists to prevent. (A bare, non-`local` `var=$(cmd)` assignment's exit
#     status IS checked under `set -e` — it's specifically `local
#     var=$(cmd)` that masks it, since `local`'s own status is what `-e`
#     observes. That's not why this matters here, though: the subshell
#     boundary breaks the global-variable contract regardless.)
#
#     Exits the whole script (via `exit 1`) rather than returning on: a
#     genuine az CLI failure looking up the vnet or an existing link (auth
#     expiry, throttling, transient API error — indistinguishable from "not
#     found" if silently swallowed), or finding a stray link into a
#     different, same-named zone. Letting the deploy proceed in either case
#     would hit a confusing Conflict, or worse, silently leave DNS
#     resolution broken — both look nothing like this check, so the failure
#     is surfaced here instead.

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "ERROR: This script must be sourced, not executed directly." >&2
  exit 1
fi

# Runs "$@", capturing stdout and stderr separately into
# _vnet_link_check_stdout/_vnet_link_check_stderr rather than merging them
# (2>&1). A successful call's stdout must never be trusted if stderr is
# spliced into it — a CLI upgrade nag, extension auto-install message, or
# deprecation notice printed alongside a clean success would otherwise
# corrupt the value used in the comparisons below, silently reintroducing
# the Conflict this check exists to prevent, or producing a false "link
# exists" that skips real link creation and leaves DNS resolution broken.
# Returns the command's own exit code; safe to call as the condition of
# `if !` (which exempts the whole function body, not just its own return,
# from set -e). Not prefixed with a leading underscore-only local scope
# (it sets caller-visible globals, same as vnet_link_already_exists_for) —
# both are internal to this file's contract, callers only ever read
# vnet_link_check_result.
_vnet_link_check_call() {
  local stderrFile
  stderrFile=$(mktemp)
  _vnet_link_check_stdout=$("$@" 2>"${stderrFile}")
  local rc=$?
  _vnet_link_check_stderr=$(cat "${stderrFile}")
  rm -f "${stderrFile}"
  return "${rc}"
}

vnet_link_already_exists_for() {
  local zoneRg=$1
  local zoneName=$2
  local vnetRg=$3
  local vnetName=$4
  local stackName=$5
  local subscriptionId="${6:-}"
  local ownLinkName="${zoneName}-vnet-link-${stackName}"

  local subscriptionArg=""
  if [[ -n "${subscriptionId}" ]]; then
    subscriptionArg="--subscription ${subscriptionId}"
  fi

  # The vnet's own Bicep scope (resourceGroup(networkResourceGroupName), a
  # single-arg — implicit/current subscription) never uses
  # privateDnsZoneSubscriptionId, unlike the zone lookups below — so
  # subscriptionArg must NOT be applied here. USTP prod deliberately
  # overrides privateDnsZoneSubscriptionId to a DIFFERENT subscription than
  # the vnet's own; applying it to this lookup too would look for the vnet
  # in the wrong subscription and fail loud below with a misleading "failed
  # to look up vnet" error on exactly the deploy path that override exists
  # to support.
  #
  # The vnet is deployed by the network step immediately before any caller of
  # this check runs, so it must already exist here — a failure looking it up
  # (auth blip, throttling, transient API error) is a real problem, not "no
  # link exists yet." Fail loud instead of silently treating it as the
  # latter, which would let the deploy proceed to hit a Conflict for a
  # reason that looks nothing like this check.
  if ! _vnet_link_check_call az network vnet show -g "${vnetRg}" -n "${vnetName}" --query id -o tsv; then
    echo "ERROR: failed to look up vnet ${vnetName} in ${vnetRg}: ${_vnet_link_check_stderr}" >&2
    exit 1
  fi
  local vnetId="${_vnet_link_check_stdout}"
  if [[ -z "${vnetId}" ]]; then
    # shellcheck disable=SC2034 # REASON: read by callers in other sourcing scripts, not within this file
    vnet_link_check_result=""
    return
  fi

  # Unlike the vnet, the zone genuinely may not exist yet (e.g. the very
  # first deploy, before deployDns=true has ever created it) — that's a
  # legitimate "no link possible" case, not an error. Only a failure other
  # than the zone itself being missing should be treated as fatal.
  local existingLink
  # shellcheck disable=SC2086 # REASON: intentional word-splitting of optional --subscription flag
  if ! _vnet_link_check_call az network private-dns link vnet list -g "${zoneRg}" ${subscriptionArg} --zone-name "${zoneName}" --query "[?virtualNetwork.id=='${vnetId}'].name | [0]" -o tsv; then
    if grep -qi "ResourceNotFound" <<<"${_vnet_link_check_stderr}"; then
      existingLink=""
    else
      echo "ERROR: failed to check for an existing vnet link into ${zoneName} in ${zoneRg}: ${_vnet_link_check_stderr}" >&2
      exit 1
    fi
  else
    existingLink="${_vnet_link_check_stdout}"
  fi

  if [[ -n "${existingLink}" ]]; then
    if [[ "${existingLink}" == "${ownLinkName}" ]]; then
      # This IS the caller's own link, from a prior successful run of this
      # same template (matched by vnet ID, which doesn't distinguish "mine"
      # from "a stray" on its own) — not a conflict. Recreating a resource
      # under the SAME name is an idempotent PUT, so letting the template
      # re-include it is harmless for a plain deployment and, for a
      # Deployment Stack caller, is what keeps it "managed" instead of
      # oscillating out of the template and getting deleted (see the
      # oscillation note in vnet_link_check_result's docs above).
      # shellcheck disable=SC2034 # REASON: read by callers in other sourcing scripts, not within this file
      vnet_link_check_result=""
      return
    fi
    # shellcheck disable=SC2034 # REASON: read by callers in other sourcing scripts, not within this file
    vnet_link_check_result="${existingLink}"
    return
  fi

  # Azure's one-link-per-vnet-per-zone constraint is enforced per zone NAME,
  # not per zone object (confirmed live 2026-08-11) — a miss in zoneRg alone
  # isn't enough to conclude it's safe to create a new link. Search every
  # OTHER zone with this same name in the same subscription (a collision via
  # a zone in a DIFFERENT subscription isn't checked) for a link already
  # satisfying this vnet before returning "safe to create."
  local otherZoneRgs
  # shellcheck disable=SC2086 # REASON: intentional word-splitting of optional --subscription flag
  if ! _vnet_link_check_call az network private-dns zone list ${subscriptionArg} --query "[?name=='${zoneName}' && resourceGroup!='${zoneRg}'].resourceGroup" -o tsv; then
    echo "ERROR: failed to search for other zones named ${zoneName}: ${_vnet_link_check_stderr}" >&2
    exit 1
  fi
  otherZoneRgs="${_vnet_link_check_stdout}"

  local otherRg strayLink
  for otherRg in ${otherZoneRgs}; do
    # shellcheck disable=SC2086 # REASON: intentional word-splitting of optional --subscription flag
    if ! _vnet_link_check_call az network private-dns link vnet list -g "${otherRg}" ${subscriptionArg} --zone-name "${zoneName}" --query "[?virtualNetwork.id=='${vnetId}'].name | [0]" -o tsv; then
      echo "ERROR: failed to check zone ${zoneName} in ${otherRg} for a stray link: ${_vnet_link_check_stderr}" >&2
      exit 1
    fi
    strayLink="${_vnet_link_check_stdout}"
    if [[ -n "${strayLink}" ]]; then
      echo "ERROR: vnet ${vnetName} is already linked to a DIFFERENT ${zoneName} zone in ${otherRg} (via '${strayLink}'), not the intended one in ${zoneRg}. Azure will not allow linking to the correct zone until this stray link is removed — manual cleanup required." >&2
      exit 1
    fi
  done

  # shellcheck disable=SC2034 # REASON: read by callers in other sourcing scripts, not within this file
  vnet_link_check_result=""
}
