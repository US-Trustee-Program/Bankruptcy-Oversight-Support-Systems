#!/usr/bin/env bash

# Title:        az-delete-branch-resources.sh
# Description:  Clean up USTP CAMS Azure resources provisioned for a development branch deployment by hash id.
# Prerequisite:
#               - Azure CLI
# Usage:        ./az-delete-branch-resources.sh --app-resource-group=<rg> --db-account=<account>
#               --db-resource-group=<rg> --kv-resource-group=<rg> --network-resource-group=<rg>
#               --stack-name=<name> --short-hash=<hash> [options]
#               Run with --help for the full list of flags.
#
# Exitcodes
# ==========
# 0   No error
# 1   Unrecognized parameter provided
# 2   Required parameter not provided
# 10+ Validation check errors
#
# Recovery (CAMS-760, Slice 2, shared RGs)
# =========================================
# This script is safe to simply re-run: it checks existence before acting on
# each target (app stack, network stack, e2e DBs, LAW/storage) and each target
# tears down in its own subshell, so a prior partial failure only leaves the
# targets that failed still standing — a re-run picks those up without
# re-touching what already succeeded, and warns (does not fail) on targets
# already gone.
#
# If a re-run still fails on one target:
# - App or network stack delete fails with "still referenced" / subnet-in-use:
#   a stack-unmanaged resource (e.g. a Smart Detection alert rule, or in the
#   legacy per-branch path the KV private endpoint) is blocking it. Inspect
#   with `az resource list -g <rg>` and delete the offending resource by id,
#   then re-run this script.
# - `az stack group delete` itself errors with a deny-settings/policy message:
#   the stack was created with --deny-settings-mode denyDelete (CAMS-760
#   hardening); this should never block the stack's OWN delete operation, only
#   out-of-band `az resource delete` calls — if it does, this is worth an
#   Azure support case, not a workaround in this script.
# - The final verification step reports a stack/RG still present after a
#   teardown that reported success: check `az stack group show --name <stack>
#   --resource-group <rg>` and `az group exists -n <rg>` directly; Azure
#   deletion of some resource types (e.g. Private DNS Zone links) can lag the
#   API's synchronous response by a few minutes.
# - The KV private endpoint delete succeeds but the network stack delete
#   still fails: check whether the DNS zone vnet link (pep-<stack>'s sibling,
#   in network_rg) also got deleted — the two are existence-checked independently,
#   so a transient failure on either one leaves the other in place (PE gone
#   but link remains, or neither touched, never the reverse order). Neither
#   partial state is worse than before this delete existed, and a re-run
#   resumes cleanly either way, but it's worth knowing which one is still
#   there before assuming the whole PE/DNS-link step is broken.
# - To manually confirm a shared RG (app_rg/network_rg) is not left with an
#   orphaned per-branch stack after a hash's teardown, filter by tag. The
#   branchHashId tag is only ever set on the deployment stack object (via
#   `az stack group create --tag`), never on the individual resources it
#   manages, so query stacks, not resources:
#   `az stack group list -g <rg> --query "[?tags.branchHashId=='<hash>']"`.

############################################################
# Help                                                     #
############################################################
Help()
{
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  --help                        Display this help message."
  echo "  --app-resource-group=<rg>     Application resource group name. **REQUIRED**"
  echo "                                Can be set via APP_RESOURCE_GROUP_BASE environment variable."
  echo "  --db-account=<account>        Database account name. **REQUIRED**"
  echo "                                Can be set via DB_ACCOUNT environment variable."
  echo "  --db-resource-group=<rg>      Database resource group name. **REQUIRED**"
  echo "                                Can be set via DB_RESOURCE_GROUP environment variable."
  echo "  --kv-resource-group=<rg>      App-config Key Vault resource group name. **REQUIRED**"
  echo "                                Can be set via KV_RESOURCE_GROUP environment variable."
  echo "  --sql-server-name=<name>      SQL Server name for E2E database deletion."
  echo "                                Can be set via SQL_SERVER_NAME environment variable."
  echo "                                Optional - skips SQL database deletion if not provided."
  echo "  --sql-resource-group=<rg>     SQL Server resource group name."
  echo "                                Can be set via SQL_RESOURCE_GROUP environment variable."
  echo "                                Optional - skips SQL database deletion if not provided."
  echo "  --network-resource-group=<rg> Network resource group name. **REQUIRED**"
  echo "                                Can be set via NETWORK_RESOURCE_GROUP_BASE environment variable."
  echo "  --analytics-resource-group=<rg> Analytics resource group name."
  echo "                                Can be set via ANALYTICS_RESOURCE_GROUP environment variable."
  echo "                                Optional - skips analytics workspace deletion if not provided."
  echo "  --stack-name=<name>           Stack name for resource naming. **REQUIRED**"
  echo "                                Can be set via STACK_NAME environment variable."
  echo "  --short-hash=<hash>           Branch hash ID. **REQUIRED**"
  echo "  --unmanage-action=<action>    Action on resources managed by the deployment"
  echo "                                stack when deleting it: deleteAll (also deletes"
  echo "                                the resource group) or deleteResources (keeps"
  echo "                                the resource group). Defaults to deleteAll."
  echo "                                Can be set via UNMANAGE_ACTION environment variable."
  echo "                                NOTE (CAMS-760, Slice 2): azure-remove-branch.yml"
  echo "                                always passes deleteResources — deleteAll is kept"
  echo "                                only as a manual escape hatch (e.g. tearing down a"
  echo "                                stray per-branch RG from before Slice 2 shipped)."
  echo "                                It is intentionally unreferenced by CI, not dead code."
  echo "  --private-dns-zone-resource-group=<rg>"
  echo "                                Resource group containing the KV/webapp/SQL private DNS"
  echo "                                zones, if different from --network-resource-group."
  echo "                                Must match whatever override (if any) was passed to"
  echo "                                azure-deploy-app-shared-setup.sh's -p/--parameters"
  echo "                                privateDnsZoneResourceGroup, or these vnet-link"
  echo "                                deletes will look in the wrong place and leak the link."
  echo "                                Optional - defaults to --network-resource-group."
  echo "                                Can be set via PRIVATE_DNS_ZONE_RESOURCE_GROUP."
  echo "  --private-dns-zone-subscription-id=<id>"
  echo "                                Subscription containing the KV/webapp/SQL private DNS"
  echo "                                zones, if different from the current subscription"
  echo "                                (e.g. USTP prod). Must match whatever override was"
  echo "                                passed as privateDnsZoneSubscriptionId on the create"
  echo "                                side. Optional - defaults to the current subscription."
  echo "                                Can be set via PRIVATE_DNS_ZONE_SUBSCRIPTION_ID."
  echo ""
  exit 0
}

############################################################
# Error                                                    #
############################################################
function error() {
    local msg=$1
    local code=$2
    echo "ERROR: ${msg}" >>/dev/stderr
    exit "${code}"
}

############################################################
############################################################
# Main program                                             #
############################################################
############################################################
set -euo pipefail # ensure job step fails in CI pipeline when error occurs

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/pipeline/_network-stackname.sh
source "$SCRIPT_DIR/../pipeline/_network-stackname.sh"
# shellcheck source=ops/scripts/pipeline/_branch-network-pool.sh
source "$SCRIPT_DIR/../pipeline/_branch-network-pool.sh"

# Parse named parameters
while [[ $# -gt 0 ]]; do
  case "$1" in
    --help)
      Help
      ;;
    --app-resource-group=*)
      app_rg="${1#*=}"
      shift
      ;;
    --db-account=*)
      db_account="${1#*=}"
      shift
      ;;
    --db-resource-group=*)
      db_rg="${1#*=}"
      shift
      ;;
    --kv-resource-group=*)
      kv_rg="${1#*=}"
      shift
      ;;
    --sql-server-name=*)
      sql_server="${1#*=}"
      shift
      ;;
    --sql-resource-group=*)
      sql_rg="${1#*=}"
      shift
      ;;
    --network-resource-group=*)
      net_rg="${1#*=}"
      shift
      ;;
    --analytics-resource-group=*)
      analytics_rg="${1#*=}"
      shift
      ;;
    --stack-name=*)
      stack_name="${1#*=}"
      shift
      ;;
    --short-hash=*)
      hash_id="${1#*=}"
      shift
      ;;
    --unmanage-action=*)
      unmanage_action="${1#*=}"
      shift
      ;;
    --private-dns-zone-resource-group=*)
      private_dns_zone_rg="${1#*=}"
      shift
      ;;
    --private-dns-zone-subscription-id=*)
      private_dns_zone_subscription_id="${1#*=}"
      shift
      ;;
    *)
      echo "Invalid option: $1"
      echo "Run with '--help' to see valid usage."
      exit 1
      ;;
  esac
done

  # Use environment variables as fallbacks if parameters not provided
  app_rg=${app_rg:-${APP_RESOURCE_GROUP_BASE:-}}
  db_account=${db_account:-${DB_ACCOUNT:-}}
  db_rg=${db_rg:-${DB_RESOURCE_GROUP:-}}
  kv_rg=${kv_rg:-${KV_RESOURCE_GROUP:-}}
  sql_server=${sql_server:-${SQL_SERVER_NAME:-}}
  sql_rg=${sql_rg:-${SQL_RESOURCE_GROUP:-}}
  net_rg=${net_rg:-${NETWORK_RESOURCE_GROUP_BASE:-}}
  analytics_rg=${analytics_rg:-${ANALYTICS_RESOURCE_GROUP:-}}
  stack_name=${stack_name:-${STACK_NAME:-}}
  private_dns_zone_rg=${private_dns_zone_rg:-${PRIVATE_DNS_ZONE_RESOURCE_GROUP:-}}
  private_dns_zone_subscription_id=${private_dns_zone_subscription_id:-${PRIVATE_DNS_ZONE_SUBSCRIPTION_ID:-}}
  # cams-vwsp3 Goal 3 -- fixed hub identity, same constants
  # _branch-network-pool.sh's create-side callers (azure-deploy-network.sh)
  # reference directly. Not overridable via flag/env var -- there is
  # exactly one hub, and no real caller has ever needed to point this
  # script elsewhere (cams-vwsp3 Goal 3 review).
  hub_rg="${BRANCH_NETWORK_HUB_RESOURCE_GROUP_DEFAULT}"
  hub_vnet_name="${BRANCH_NETWORK_HUB_VNET_NAME_DEFAULT}"
  # Action applied to resources the deployment stack manages when it is deleted.
  # Slice 1 (per-branch RGs): deleteAll removes the resources AND the resource group
  # (matches the previous 'az group delete' behavior). Slice 2 (shared RGs) will pass
  # deleteResources so the shared resource group is preserved.
  unmanage_action=${unmanage_action:-${UNMANAGE_ACTION:-deleteAll}}
  case "${unmanage_action}" in
    deleteAll|deleteResources) ;;
    *) error "Invalid --unmanage-action '${unmanage_action}': must be 'deleteAll' or 'deleteResources'." 22 ;;
  esac

  if [[ -z "${app_rg:-}" || -z "${db_account:-}" || -z "${db_rg:-}" || -z "${kv_rg:-}" || -z "${net_rg:-}" || -z "${stack_name:-}" || -z "${hash_id:-}" ]]; then
  error "Not all required parameters provided. Run this script with the --help flag for details, or set the appropriate environment variables." 2
fi

# Check which resources exist (partial cleanup is normal if a previous run partially succeeded)
#
# Slice 2 (unmanage_action=deleteResources): app_rg/network_rg are ALREADY the
# correct shared base names passed in by the caller — do NOT suffix them with
# the branch hash, that would point at a per-branch RG that no longer exists.
# Legacy per-branch mode (deleteAll): suffix with the branch hash, as before.
if [[ "${unmanage_action}" == "deleteResources" ]]; then
    network_rg="${net_rg}"
else
    app_rg="${app_rg}-${hash_id}"
    network_rg="${net_rg}-${hash_id}"
fi
# Matches app-shared-setup.bicep's privateDnsZoneResourceGroup default (both
# zones' create-side check parses the same override out of --parameters —
# see azure-deploy-app-shared-setup.sh) — only true as long as neither zone's
# resource group/subscription is overridden away from network_rg/the current
# subscription. Callers that DO override it (e.g. a USTP-prod-style
# deployment into a different subscription) must pass the matching
# --private-dns-zone-resource-group=/--private-dns-zone-subscription-id=
# flags here too, or these deletes will silently look in the wrong place and
# leak the per-branch vnet link.
private_dns_zone_rg="${private_dns_zone_rg:-${network_rg}}"
e2e_db="cams-e2e-${hash_id}"
stack_name="${stack_name}-${hash_id}"
appStack="${stack_name}-app"
# See ops/scripts/pipeline/_network-stackname.sh (sourced above) for why
# this one is a shared function rather than reconstructed inline here like
# appStack above — network.bicep's stack is also created by
# azure-deploy-network.sh, a separate script, so the two can't silently
# drift apart on this name the way appStack (only ever used in this file)
# can't.
networkStack=$(network_stack_name_for "${stack_name}")

function stack_exists() {
    local name=$1
    local rg=$2
    # `list` (not `show`) so a genuinely absent stack is a normal empty result,
    # not a CLI error — mirrors az_vnet_exists_func's pattern in
    # azure-deploy-network.sh. The prior `show ... 2>/dev/null || echo ""`
    # mapped ANY failure (auth expiry, throttling, wrong subscription) to
    # "doesn't exist," so a transient error would both skip the stack delete
    # and report a false-clean verification — the exact class of bug already
    # fixed for the Smart Detection cleanup elsewhere in this script. This
    # only works if the caller captures the result as a plain statement
    # rather than inline inside a `[[ ]]` test — set -e ignores command
    # failures that occur as part of a test's condition.
    #
    # name's only current provenance is this script's own stack_name/hash_id
    # (not attacker-controllable), so this isn't exploitable today, but escape
    # embedded single quotes before interpolating into the JMESPath string
    # literal anyway, mirroring az_vnet_exists_func's hardening.
    local escapedName=${name//\'/\\\'}
    az stack group list --resource-group "${rg}" --query "[?name=='${escapedName}'].id" -o tsv
}

# Shared by the KV, webapp, and SQL private DNS zone vnet-link cleanup below
# -- same lookup-by-zone-and-stack-name / delete-if-found / log-if-not-found
# shape for all three zones. Explicit params (not closure-captured globals) to
# match stack_exists's style above. subscriptionId is optional (defaults to
# the CLI's current subscription) -- `az ... --subscription ""` is a
# malformed call, so it's omitted entirely rather than passed empty.
#
# The zone itself may not exist yet (e.g. a shared RG created before this
# zone was added to azure-deploy-app-shared-setup.sh, torn down before its
# own bootstrap run ever created it) -- that's a legitimate "nothing to
# delete" case, not an error, so ResourceNotFound is tolerated here the same
# way _vnet-link-check.sh's vnet_link_already_exists_for tolerates it on the
# create-side check. Any other failure (auth expiry, throttling, transient
# API error) still aborts loud via the enclosing `set -euo pipefail`
# subshell, rather than being silently swallowed.
function delete_vnet_link_if_exists() {
    local zoneName=$1
    local label=$2
    local rg=$3
    local stackName=$4
    local subscriptionId="${5:-}"
    local subscriptionArg=""
    if [[ -n "${subscriptionId}" ]]; then
        subscriptionArg="--subscription ${subscriptionId}"
    fi
    local id stderrFile stderrText
    stderrFile=$(mktemp)
    # shellcheck disable=SC2086 # REASON: intentional word-splitting of optional --subscription flag
    if ! id=$(az network private-dns link vnet list --resource-group "${rg}" ${subscriptionArg} --zone-name "${zoneName}" --query "[?name=='${zoneName}-vnet-link-${stackName}'].id" -o tsv 2>"${stderrFile}"); then
        stderrText=$(cat "${stderrFile}")
        rm -f "${stderrFile}"
        if grep -qi "ResourceNotFound" <<<"${stderrText}"; then
            echo "No ${label} private DNS zone ${zoneName} found in ${rg} (zone doesn't exist); nothing to delete"
            return
        fi
        echo "ERROR: failed to check for ${label} private DNS zone vnet link in ${zoneName}: ${stderrText}" >&2
        exit 1
    fi
    rm -f "${stderrFile}"
    if [[ -n "${id}" ]]; then
        echo "Deleting ${label} private DNS zone vnet link ${zoneName}-vnet-link-${stackName} in ${rg}"
        az resource delete --ids "${id}"
    else
        echo "No ${label} private DNS zone vnet link ${zoneName}-vnet-link-${stackName} found in ${rg}; nothing to delete"
    fi
}

# cams-vwsp3 Goal 3. Deletes this branch's HUB-SIDE VNet peering (a child
# resource of hubVnetName, in hubRg -- bankruptcy-oversight-support-systems,
# NOT network_rg) if it exists. This is now load-bearing correctness, not
# hygiene: azure-deploy-network.sh derives "which /20 pool slots are already
# claimed" LIVE from the hub's actual peering list (see
# _branch-network-pool.sh's branch_network_claimed_slot_indices) -- a leaked
# hub-side peering after this branch is torn down would permanently and
# incorrectly mark its slot as claimed forever, shrinking the usable pool.
#
# Unlike the branch-side peering (a child of the branch's OWN vnet, deleted
# for free when that vnet is deleted by the network stack's own
# --action-on-unmanage deleteResources delete below), the hub-side peering
# is a child of the HUB's vnet and is never stack-managed by anything this
# script deletes elsewhere -- it is only ever created directly (a plain,
# targeted `az deployment group create` against hubRg, see
# azure-deploy-network.sh), so nothing else here would ever remove it.
#
# `list` (not `show`), mirroring stack_exists()/az_vnet_exists_func()'s
# reasoning: a genuinely absent peering is a normal empty result, not a CLI
# error, so a transient failure (auth expiry, throttling) must not be
# silently read as "already gone."
function delete_hub_peering_if_exists() {
    local hubRg=$1
    local hubVnetName=$2
    local branchVnetName=$3
    local peeringName
    peeringName=$(branch_network_hub_peering_name_for "${branchVnetName}" "${hubVnetName}")
    local peeringId
    peeringId=$(az network vnet peering list --resource-group "${hubRg}" --vnet-name "${hubVnetName}" --query "[?name=='${peeringName}'].id" -o tsv)
    if [[ -n "${peeringId}" ]]; then
        echo "Deleting hub-side VNet peering ${peeringName} in ${hubRg}"
        az resource delete --ids "${peeringId}"
    else
        echo "No hub-side VNet peering ${peeringName} found in ${hubRg}; nothing to delete"
    fi
}

# Safety guard (CAMS-760, GH #2749). The hash-suffix check applies only to the
# legacy per-branch path, where this script deletes the resource group
# outright — it MUST be the per-branch, hash-suffixed RG, never a shared RG.
# The deleteResources path never deletes a resource group at all (only this
# branch's own stack within it), so a shared, un-suffixed RG name is the
# CORRECT and expected input there, not a violation.
#
# The shared-RG membership check below runs UNCONDITIONALLY in both modes
# (pre-flight sanity check): an app_rg/network_rg that accidentally resolves to
# the KV RG, DB RG, SQL RG, or analytics RG is a misconfiguration either way,
# and a deleteResources run would otherwise silently target the wrong RG's
# deployment stack with no RG-existence check to catch it (a shared RG always
# exists). The Key Vault's RG is checked explicitly via --kv-resource-group
# rather than relying on it happening to equal --db-resource-group (which is
# all that protected it before this fix — coincidental, not guaranteed;
# GH #2749).
for rg_var in app_rg network_rg; do
    rg_val="${!rg_var}"
    if [[ "${unmanage_action}" != "deleteResources" && "${rg_val}" != *"-${hash_id}" ]]; then
        error "Refusing to delete ${rg_var}='${rg_val}': not suffixed with branch hash '-${hash_id}'. This must be a per-branch resource group." 20
    fi
    # Compare both the full name and the base (name without the '-<hash>'
    # suffix, a no-op when the RG isn't hash-suffixed) against every known
    # shared RG, case-folded since Azure RG names are case-insensitive at the
    # ARM level (plain Bash `==` is not).
    rg_base="${rg_val%-"${hash_id}"}"
    rg_val_lc="${rg_val,,}"
    rg_base_lc="${rg_base,,}"
    for shared in "${kv_rg}" "${db_rg}" "${sql_rg:-}" "${analytics_rg:-}"; do
        [[ -z "${shared}" ]] && continue
        shared_lc="${shared,,}"
        if [[ "${rg_val_lc}" == "${shared_lc}" || "${rg_base_lc}" == "${shared_lc}" ]]; then
            error "Refusing to delete ${rg_var}='${rg_val}': it (or its base '${rg_base}') matches a SHARED resource group '${shared}'. Aborting to protect shared infrastructure (GH #2749)." 21
        fi
    done
done

rgAppExists=$(az group exists -n "${app_rg}")
rgNetExists=$(az group exists -n "${network_rg}")
dbExists=$(az cosmosdb mongodb database exists -g "${db_rg}" -a "${db_account}" -n "${e2e_db}")

# What indicates "this branch has something to tear down" differs by mode: for a
# per-branch RG, RG existence IS the signal. For a shared RG (deleteResources)
# the RG always exists (main and other branches live there too) — the real
# signal is whether THIS branch's own stack exists.
if [[ "${unmanage_action}" == "deleteResources" ]]; then
    # Captured as plain statements, not inline inside a `[[ ]]` test: a real
    # stack_exists CLI failure here must abort the script loudly (we're at
    # top level, before any teardown has started), not be silently read as
    # "stack doesn't exist" and skip tearing down a branch that actually has
    # resources.
    appStackId=$(stack_exists "${appStack}" "${app_rg}")
    netStackId=$(stack_exists "${networkStack}" "${network_rg}")
    appExists=$([[ -n "${appStackId}" ]] && echo true || echo false)
    netExists=$([[ -n "${netStackId}" ]] && echo true || echo false)
else
    appExists="${rgAppExists}"
    netExists="${rgNetExists}"
fi

# Computed here (not just right before their own teardown blocks further
# down) so the "nothing to clean up" early-exit below can consider them
# too. Without this, a prior run that deleted the RGs/stacks + Cosmos DB
# but failed before removing the E2E SQL DB or the Log Analytics workspace
# would report "nothing to clean up" here and leak them indefinitely — the
# LAW in particular carries recurring cost, and neither can be recovered
# by a later run if this early-exit fires first.
e2e_sql_db="CAMS_E2E-${hash_id}"
sqlDbExists=""
if [[ -n "${sql_server:-}" && -n "${sql_rg:-}" ]]; then
    # `list` (not `show`) so a genuinely absent database is a normal empty
    # result, not a CLI error — same reasoning as stack_exists() above: `show`
    # fails identically on "not found" and on a real error (auth expiry,
    # throttling), so `2>/dev/null || echo ""` would silently read a
    # transient failure as "doesn't exist" and let the early-exit below
    # fire, leaking this database.
    sqlDbExists=$(az sql db list -g "${sql_rg}" -s "${sql_server}" --query "[?name=='${e2e_sql_db}'].id" -o tsv)
fi

analytics_workspace="law-${stack_name}"
analyticsWorkspaceExists=""
if [[ -n "${analytics_rg:-}" ]]; then
    # Same `list`-not-`show` reasoning as sqlDbExists above.
    analyticsWorkspaceExists=$(az monitor log-analytics workspace list -g "${analytics_rg}" --query "[?name=='${analytics_workspace}'].id" -o tsv)
fi

if [[ "${appExists}" != "true" && "${netExists}" != "true" && "${dbExists}" != "true" && -z "${sqlDbExists}" && -z "${analyticsWorkspaceExists}" ]]; then
    echo "No branch resources found for hash ${hash_id} — nothing to clean up."
    exit 0
fi

[[ "${appExists}" != "true" ]] && echo "WARNING: App resources for hash ${hash_id} not found — may have been deleted already."
[[ "${netExists}" != "true" ]] && echo "WARNING: Network resources for hash ${hash_id} not found — may have been deleted already."

echo "Begin clean up of Azure resources for ${hash_id}."

# Tear down the branch's app and network tiers (CAMS-760, Option E).
#
# APP tier: a self-contained per-branch deployment stack. The genuinely shared
# cross-scope resources (the app-config Key Vault + its role assignments, and the
# SQL managed identity) are deployed separately by app-shared-setup.bicep, always
# as a plain (non-stack) deployment, so the app stack itself only ever manages
# app-RG-scoped resources (webapp, functions, app insights, plans, comms/email).
# An earlier version wrapped those cross-scope resources into the branch's own
# app stack, and a teardown deleted the shared kv-ustp-cams-dev (GH #2749) — this
# split is what makes stacking the app tier safe. For per-branch teardown we
# delete the whole app RG directly rather than deleting the stack first, mirroring
# the network tier's per-branch behavior below. Only when a shared app RG must be
# preserved (Slice 2, unmanage_action=deleteResources) do we fall back to a scoped
# stack delete.
#
# NETWORK tier: a self-contained per-branch deployment stack (network.bicep only
# touches the per-branch network RG). For per-branch teardown we delete the whole
# network RG directly rather than deleting the stack first: the branch's Key Vault
# private endpoint (pep-kv-ustp-cams-dev) is created in the network RG by
# app-shared-setup.bicep's kvSetup module and is NOT stack-managed, so a stack
# delete fails with InUseSubnetCannotBeDeleted (the PE still occupies the
# private-endpoint subnet). `az group delete` removes the PE, subnets, vnet, and
# stack in one shot regardless of ordering. Only when a shared network RG must be
# preserved (Slice 2, unmanage_action=deleteResources) do we fall back to a scoped
# stack delete.
#
# Each target below is torn down in its own subshell: a failure aborts that
# target's own remaining steps without aborting the whole script, so one
# target's failure can't mask attempted cleanup of the others. Failures are
# recorded and reported together at the end, reusing the same `failed`-flag
# pattern the final verification already had.
#
# One deliberate, narrow exception: the network tier is skipped (not
# attempted) when vnetIntegrationFailed is set below, because a failed VNET
# integration removal is a real precondition failure for the network
# delete (InUseSubnetCannotBeDeleted), not an unrelated target's failure —
# see that gate's own comment for why it's scoped to that specific signal
# rather than any app-tier failure.
#
# Each subshell is run as its own statement, its exit status captured via `$?`
# afterward, NOT as the direct condition of `if !`/`||` — Bash treats being the
# test of an `if` (even negated) as a context where `-e` is ignored, and that
# "ignored" status propagates INTO the subshell, silently disabling the
# `set -euo pipefail` declared inside it. `if ! ( set -e; risky; safe ); then`
# looks like it stops at `risky` on failure, but it actually runs `safe` too
# and often never sets `failed=true` at all. `set +e` around the bare subshell
# invocation, then checking the captured `$?` in a separate `if`, is the
# pattern that actually works — verified by mocked-CLI testing (CAMS-760).
failed=false
# Tracks specifically whether the VNET-integration-remove calls below
# succeeded — not just whether the app-tier subshell as a whole failed —
# because the network-tier gate further down needs to key on the actual
# precondition for InUseSubnetCannotBeDeleted (a subnet still occupied by
# VNET-integrated compute), not "something in the app tier failed." VNET
# integration is a property of the app resources themselves, released as
# soon as the remove call succeeds — independent of whether the app
# RG/stack delete that runs after it succeeds or fails (e.g. on an
# unrelated auth-expiry or throttling error). Gating the skip on any
# app-tier failure would needlessly defer network-tier cleanup even when
# the subnet is already free. Written to a temp file since the subshell
# below runs in a separate process and can't set this variable in the
# parent shell directly.
vnetIntegrationFailed=false

# Disconnect VNET integration from App Service components prior to deleting resources
if [[ "${appExists}" == "true" ]]; then
    vnetIntegrationStatusFile=$(mktemp)
    set +e
    (
        set -euo pipefail
        echo "Start disconnecting VNET integration"
        # `|| vnetIntegrationOk=false` on each (not a bare `|| true`): a
        # missing app (partial prior deploy) is the same "partial cleanup is
        # normal" case this script already tolerates elsewhere, so a failure
        # here must not abort this subshell (which would leave the app RG in
        # place and undeleted, making the network-tier delete below fail
        # with InUseSubnetCannotBeDeleted for a DIFFERENT reason than the one
        # this tracking is meant to catch) — but it IS tracked, so the
        # network-tier gate further down can react specifically to a failed
        # VNET integration removal rather than any app-tier failure.
        vnetIntegrationOk=true
        webapp="${stack_name}-webapp"
        az webapp vnet-integration remove -g "${app_rg}" -n "${webapp}" || vnetIntegrationOk=false
        apiFunctionApp="${stack_name}-node-api"
        az functionapp vnet-integration remove -g "${app_rg}" -n "${apiFunctionApp}" || vnetIntegrationOk=false
        echo "Completed disconnecting VNET integration"
        dataflowsFunctionApp="${stack_name}-dataflows"
        az functionapp vnet-integration remove -g "${app_rg}" -n "${dataflowsFunctionApp}" || vnetIntegrationOk=false
        echo "Completed disconnecting VNET integration for dataflows"
        echo "${vnetIntegrationOk}" > "${vnetIntegrationStatusFile}"

        if [[ "${unmanage_action}" != "deleteResources" ]]; then
            # Per-branch app RG: delete the whole RG.
            echo "Deleting app resource group ${app_rg} (per-branch; contains only branch-owned app resources)"
            az group delete -n "${app_rg}" --yes
        else
            # Application Insights auto-creates Smart Detection alert rules that are
            # never declared in bicep, so the stack never manages/deletes them. The
            # per-branch path sweeps these up for free via the whole-RG delete above;
            # the shared-RG path cannot do that, so clean them up by name instead.
            # Runs BEFORE the stack delete below (not after): if a stack-unmanaged
            # Smart Detection rule can block `az stack group delete` (as the runbook
            # comment near the top of this file implies for a similar case), doing
            # this cleanup after the stack delete would mean it never runs, because
            # the failure it's meant to route around aborts this subshell first.
            echo "Checking for stack-unmanaged Smart Detection alert rules for ${stack_name}"
            # No `2>/dev/null || true` here: that would swallow a genuine az CLI
            # failure (auth expiry, throttling) the same way as "no rules found,"
            # silently skipping cleanup instead of failing this subshell (and
            # tripping the `failed` flag) the way every other target in this
            # script does.
            smartDetectorRuleIdsRaw=$(az resource list -g "${app_rg}" --resource-type microsoft.alertsmanagement/smartDetectorAlertRules --query "[?starts_with(name, 'Failure Anomalies - appi-${stack_name}')].id" -o tsv)
            mapfile -t smartDetectorRuleIds <<< "${smartDetectorRuleIdsRaw}"
            if [[ ${#smartDetectorRuleIds[@]} -eq 1 && -z "${smartDetectorRuleIds[0]}" ]]; then
                smartDetectorRuleIds=()
            fi
            if [[ ${#smartDetectorRuleIds[@]} -gt 0 ]]; then
                for ruleId in "${smartDetectorRuleIds[@]}"; do
                    echo "Deleting stack-unmanaged Smart Detection alert rule: ${ruleId}"
                    az resource delete --ids "${ruleId}"
                done
            else
                echo "No stack-unmanaged Smart Detection alert rules found for ${stack_name}"
            fi

            # Shared app RG (Slice 2): preserve the RG, remove only this branch's stack.
            echo "Start deleting app deployment stack ${appStack} (action-on-unmanage=${unmanage_action})"
            az stack group delete --name "${appStack}" --resource-group "${app_rg}" --action-on-unmanage "${unmanage_action}" --yes
        fi
    )
    subshellRc=$?
    set -e
    # Default to "failed" (the safe assumption) if the file is missing or
    # empty — e.g. the subshell was killed before reaching the write.
    if [[ "$(cat "${vnetIntegrationStatusFile}" 2>/dev/null || echo false)" != "true" ]]; then
        vnetIntegrationFailed=true
    fi
    rm -f "${vnetIntegrationStatusFile}"
    if [[ ${subshellRc} -ne 0 ]]; then
        echo "ERROR: Failed to clean up app tier for ${hash_id}; continuing with other targets." >&2
        failed=true
    fi
fi

# Gated on vnetIntegrationFailed specifically (only relevant when the app
# tier existed to begin with — appExists=false skips the block above
# entirely, so there's nothing to gate on): a failed VNET-integration-remove
# call leaves this branch's function apps still occupying subnets in the
# network RG, so attempting the network-tier delete now would just fail
# with the exact InUseSubnetCannotBeDeleted this feature exists to avoid.
# Keying on this specific signal (rather than any app-tier failure) avoids
# needlessly deferring network-tier cleanup when VNET integration was
# successfully released but the app RG/stack delete that ran after it
# failed for an unrelated reason (auth expiry, throttling) — in that case
# the subnet is already free and the network delete would succeed.
if [[ "${netExists}" == "true" && "${vnetIntegrationFailed}" == "true" ]]; then
    echo "Skipping network tier cleanup for ${hash_id}: VNET integration removal failed above, so this branch's function apps are likely still occupying subnets in ${network_rg} — deleting the network tier now would just fail with InUseSubnetCannotBeDeleted. Will retry both tiers on the next run." >&2
elif [[ "${netExists}" == "true" ]]; then
    set +e
    (
        set -euo pipefail
        # cams-vwsp3 Goal 3 -- see delete_hub_peering_if_exists's own
        # comment above for why this hub-side peering cleanup is required
        # and can't be swept up by anything else in this script.
        # branchVnetName matches naming.bicep's virtualNetworkName(stackName)
        # formula ('vnet-${stackName}'); can't import that bicep func from
        # bash, so it's reconstructed here the same way pepName below
        # reconstructs its own bicep-side naming convention by hand.
        #
        # Called UNCONDITIONALLY for both unmanage_action values (not just
        # the shared-RG deleteResources path): the legacy deleteAll path
        # (`az group delete`, below) was previously assumed safe to skip
        # only because deleteAll is documented as targeting pre-Slice-2
        # branches that never had a hub peering -- a safety property that
        # lived only in --help text, not in this branching logic. Calling
        # this here for both paths makes that safety property structural
        # instead of relying on an out-of-band assumption about which
        # branches can ever reach deleteAll: it is a cheap no-op (by its own
        # design) whenever no hub-side peering exists, so it costs nothing
        # on the deleteAll path and closes the gap if that assumption is
        # ever wrong (e.g. a future manual deleteAll invocation against a
        # Slice-2 branch that DID get a hub peering).
        branchVnetName="vnet-${stack_name}"
        delete_hub_peering_if_exists "${hub_rg}" "${hub_vnet_name}" "${branchVnetName}"

        if [[ "${unmanage_action}" != "deleteResources" ]]; then
            # Per-branch network RG: delete the whole RG. This removes the network
            # stack, the vnet/subnets, and any stack-unmanaged resources (the KV
            # private endpoint) without hitting subnet-in-use ordering failures.
            echo "Deleting network resource group ${network_rg} (per-branch; removes vnet, subnets, and the KV private endpoint)"
            az group delete -n "${network_rg}" --yes
        else
            # Shared network RG (Slice 2): the network stack never manages the
            # KV private endpoint or the KV private DNS zone's vnet link —
            # app-shared-setup.bicep creates both as a plain (non-stack)
            # deployment, per-branch-named (pep-${stack_name} /
            # <zone>-vnet-link-${stack_name}), in the shared network RG (see
            # app-shared-setup.bicep's privateDnsZoneResourceGroup, which
            # defaults to networkResourceGroupName, not the KV's own RG).
            # Unlike the per-branch path above (whole-RG delete sweeps these
            # for free), the shared RG survives, so they must be deleted
            # explicitly here, BEFORE the stack delete: the PE still occupying
            # the private-endpoint subnet is exactly what makes `az stack
            # group delete` fail with InUseSubnetCannotBeDeleted.
            #
            # The webapp/api/dataflows zone's vnet link is DIFFERENT since
            # CAMS-760: its creation moved from app-shared-setup.bicep into
            # main.bicep's ustpWebappDnsZoneLink module, so it's now managed
            # by this branch's APP stack (appStack, deleted earlier above)
            # and self-cleans on that stack's teardown. The
            # delete_vnet_link_if_exists call for it below is therefore
            # normally a no-op by the time we get here — it stays only as
            # defense-in-depth for cases where the app stack delete failed
            # above, or ran with unmanage semantics that don't remove this
            # link, rather than as this link's primary cleanup path.
            #
            # Matches keyvaultPrivateDnsZoneName / webappPrivateDnsZoneName /
            # sqlPrivateDnsZoneName in ustp-cams-kv-app-config-setup.bicep /
            # app-shared-setup.bicep / main.bicep — those are the only other
            # places these literals appear. Can't share them across
            # bash/bicep without a codegen step, so keep all in lockstep by
            # hand: if one changes, its vnet-link lookup silently stops
            # matching and falls to the "nothing to delete" branch, leaking
            # the link.
            #
            # The SQL zone's vnet link is unconditional (CAMS-760 follow-up —
            # see main.bicep's ustpSqlDnsZoneLink module for why), so it is
            # subject to the exact same self-cleaning-normally /
            # defense-in-depth-here shape as the webapp link above.
            kvPrivateDnsZoneName='privatelink.vaultcore.usgovcloudapi.net'
            webappPrivateDnsZoneName='privatelink.azurewebsites.us'
            sqlPrivateDnsZoneName='privatelink.database.usgovcloudapi.net'
            pepName="pep-${stack_name}"
            pepId=$(az resource list -g "${network_rg}" --resource-type Microsoft.Network/privateEndpoints --query "[?name=='${pepName}'].id" -o tsv)
            if [[ -n "${pepId}" ]]; then
                echo "Deleting KV private endpoint ${pepName} in ${network_rg}"
                az resource delete --ids "${pepId}"
            else
                echo "No KV private endpoint ${pepName} found in ${network_rg}; nothing to delete"
            fi
            delete_vnet_link_if_exists "${kvPrivateDnsZoneName}" "KV" "${private_dns_zone_rg}" "${stack_name}" "${private_dns_zone_subscription_id}"
            delete_vnet_link_if_exists "${webappPrivateDnsZoneName}" "webapp" "${private_dns_zone_rg}" "${stack_name}" "${private_dns_zone_subscription_id}"
            delete_vnet_link_if_exists "${sqlPrivateDnsZoneName}" "SQL" "${private_dns_zone_rg}" "${stack_name}" "${private_dns_zone_subscription_id}"

            # Captured as its own statement (not inline inside the `[[ ]]`
            # test below) so a real stack_exists CLI failure aborts this
            # subshell via set -e, rather than being ignored because it
            # occurred as part of a test's condition.
            netStackId=$(stack_exists "${networkStack}" "${network_rg}")
            if [[ -n "${netStackId}" ]]; then
                # Shared network RG (Slice 2): preserve the RG, remove only this branch's stack.
                echo "Start deleting network deployment stack ${networkStack} (action-on-unmanage=${unmanage_action})"
                az stack group delete --name "${networkStack}" --resource-group "${network_rg}" --action-on-unmanage "${unmanage_action}" --yes
            else
                echo "No network deployment stack ${networkStack} found; nothing to delete in shared network RG"
            fi
        fi
    )
    subshellRc=$?
    set -e
    if [[ ${subshellRc} -ne 0 ]]; then
        echo "ERROR: Failed to clean up network tier for ${hash_id}; continuing with other targets." >&2
        failed=true
    fi
fi

if [[ "${dbExists}" == "true" ]]; then
    set +e
    (
        set -euo pipefail
        echo "Start deleting e2e test database ${e2e_db}"
        az cosmosdb mongodb database delete -g "${db_rg}" -a "${db_account}" -n "${e2e_db}" --yes
    )
    subshellRc=$?
    set -e
    if [[ ${subshellRc} -ne 0 ]]; then
        echo "ERROR: Failed to delete e2e test database ${e2e_db}; continuing with other targets." >&2
        failed=true
    fi
else
    echo "E2E database does not exist for branch hash ${hash_id}"
fi

# Delete SQL E2E database if SQL server params provided (existence already
# checked above, before the early-exit)
if [[ -n "${sql_server:-}" && -n "${sql_rg:-}" ]]; then
  if [[ -n "${sqlDbExists}" ]]; then
    set +e
    (
        set -euo pipefail
        echo "Deleting E2E SQL database ${e2e_sql_db}"
        az sql db delete -g "${sql_rg}" -s "${sql_server}" -n "${e2e_sql_db}" --yes
        echo "Completed deleting E2E SQL database ${e2e_sql_db}"
    )
    subshellRc=$?
    set -e
    if [[ ${subshellRc} -ne 0 ]]; then
        echo "ERROR: Failed to delete E2E SQL database ${e2e_sql_db}; continuing with other targets." >&2
        failed=true
    fi
  else
    echo "E2E SQL database ${e2e_sql_db} does not exist, skipping"
  fi
else
  echo "Skipping SQL database deletion (sql-server-name or sql-resource-group not provided)"
fi

# Delete Log Analytics Workspace and associated storage account if they exist
# (existence already checked above, before the early-exit)
if [[ -n "${analytics_rg:-}" ]]; then
  if [[ -n "${analyticsWorkspaceExists}" ]]; then
    set +e
    (
        set -euo pipefail
        # Find and delete the associated storage account first by querying linked storage accounts
        echo "Querying workspace ${analytics_workspace} for linked storage accounts"

        # Track deleted storage accounts to avoid duplicates (using space-delimited string)
        deleted_storage_accounts=""
        storage_account_count=0

        # Query the workspace's linked storage accounts
        # We check for common data sources: Alerts, CustomLogs, and Query
        for data_source_type in "Alerts" "CustomLogs" "Query"; do
          storage_account_ids=$(az monitor log-analytics workspace linked-storage show \
            -g "${analytics_rg}" \
            -n "${analytics_workspace}" \
            --type "${data_source_type}" \
            --query "storageAccountIds[]" -o tsv 2>/dev/null || echo "")

          if [[ -n "${storage_account_ids}" ]]; then
            for storage_account_id in ${storage_account_ids}; do
              # Extract storage account name from resource ID
              # Format: /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Storage/storageAccounts/{name}
              storage_account_name=$(echo "${storage_account_id}" | awk -F'/' '{print $NF}')
              echo "Found linked storage account: ${storage_account_name} (data source: ${data_source_type})"

              # Check if we've already deleted this storage account
              if [[ ! " ${deleted_storage_accounts} " == *" ${storage_account_name} "* ]]; then
                echo "Start deleting storage account ${storage_account_name}"
                az storage account delete -g "${analytics_rg}" -n "${storage_account_name}" --yes
                echo "Completed deleting storage account ${storage_account_name}"
                deleted_storage_accounts="${deleted_storage_accounts} ${storage_account_name}"
                storage_account_count=$((storage_account_count + 1))
              fi
            done
          fi
        done

        if [[ ${storage_account_count} -eq 0 ]]; then
          echo "No linked storage accounts found (may not have been created or already deleted)"
        fi

        # Now delete the workspace
        echo "Start deleting Log Analytics Workspace ${analytics_workspace}"
        az monitor log-analytics workspace delete -g "${analytics_rg}" -n "${analytics_workspace}" --yes --force
        echo "Completed deleting Log Analytics Workspace"
    )
    subshellRc=$?
    set -e
    if [[ ${subshellRc} -ne 0 ]]; then
        echo "ERROR: Failed to clean up Log Analytics Workspace ${analytics_workspace}; continuing with other targets." >&2
        failed=true
    fi
  else
    echo "Log Analytics Workspace does not exist for branch hash ${hash_id}"
  fi
else
  echo "Skipping Log Analytics Workspace deletion (analytics resource group not provided)"
fi

echo "Completed resource clean up operations."

# Verify nothing was left behind. Per-branch RGs (unmanage_action != deleteResources)
# are deleted outright and verified gone; for a preserved shared RG (deleteResources,
# Slice 2) verify each tier's stack is gone instead. Reuses the same `failed` flag
# the teardown loop above set, so a teardown failure isn't masked even if the
# resource happens to look gone here. Shared between the app and network tiers
# below (they only differ in the RG/stack names and whether a "skipped this
# run" state is possible) rather than duplicating this rc-capture-and-report
# pattern twice. Sets the global `failed` flag directly (not `local`).
function verify_stack_gone() {
    local label=$1
    local rg=$2
    local stackName=$3
    local skipped=$4

    if [[ "${unmanage_action}" != "deleteResources" ]]; then
        if [[ $(az group exists -n "${rg}") == "true" ]]; then
            # Distinguishes "we tried and it's still there" from "we skipped
            # it this run" (the vnetIntegrationFailed gate above) — this
            # script is read live during incidents, and the two call for
            # different next steps (investigate a stuck delete vs. just re-run).
            if [[ "${skipped}" == "true" ]]; then
                echo "ERROR: ${label} resource group ${rg} still exists — deletion was skipped this run (VNET integration removal failed above); will retry on the next run." >&2
            else
                echo "ERROR: ${label} resource group ${rg} still exists after deletion attempt." >&2
            fi
            failed=true
        fi
    else
        # Unlike the teardown loop above, a failed probe here must not abort
        # the script outright — remaining verification (and the consolidated
        # `failed` report below) still needs to run. So the CLI failure is
        # captured explicitly via `$?` rather than left to set -e, and
        # treated the same as "stack still exists": a verification that
        # can't be confirmed clean must not be reported as clean.
        set +e
        local stackId
        stackId=$(stack_exists "${stackName}" "${rg}")
        local stackCheckRc=$?
        set -e
        if [[ ${stackCheckRc} -ne 0 || -n "${stackId}" ]]; then
            if [[ "${skipped}" == "true" ]]; then
                echo "ERROR: ${label} deployment stack ${stackName} still exists — deletion was skipped this run (VNET integration removal failed above); will retry on the next run." >&2
            else
                echo "ERROR: ${label} deployment stack ${stackName} still exists after deletion attempt (or could not be verified)." >&2
            fi
            failed=true
        fi
    fi
}

# The app tier is never itself skipped (there's no app-tier equivalent of
# the network tier's vnetIntegrationFailed gate) — teardown above either
# ran and possibly failed, or the app tier never existed to begin with.
verify_stack_gone "App" "${app_rg}" "${appStack}" "false"
verify_stack_gone "Network" "${network_rg}" "${networkStack}" "${vnetIntegrationFailed}"

if [[ "${failed}" == "true" ]]; then
    error "One or more resources could not be deleted." 12
fi
