#!/usr/bin/env bash

# Title:        azure-deploy-network.sh
# Description:  Deploy the USTP CAMS network resources (vnet, subnets) into the
#               network resource group. For branch deployments the network
#               resources are deployed as an Azure Deployment Stack so they
#               can be torn down as a unit without deleting the resource group
#               (CAMS-760, Option E). For main the resources are deployed with a
#               plain resource-group deployment (behavior preserved). The webapp
#               private DNS zone is deployed separately, always as a plain
#               deployment, by azure-deploy-app-shared-setup.sh / app-shared-setup.bicep
#               — never here, since this template IS a Deployment Stack for branches.
#
#               Goal 3 of cams-vwsp3 (SQL Private Link hub-and-spoke rework)
#               addition: for a genuinely NEW branch (no vnet yet), this
#               script also claims a /20 slot out of the reserved dynamic
#               branch pool (see _branch-network-pool.sh), wires it into the
#               branch's own vnetAddressPrefix/subnet prefixes instead of the
#               previously-unvaried 10.10.0.0/16 default, and creates BOTH
#               sides of the peering to the shared SQL Private Link hub
#               (vnet-ustp-cams-sql-hub) via vnet-peering.bicep -- reusing
#               that module exactly as sql-hub.bicep's hubToSpokePeering /
#               main.bicep's mainHubPeering already do for main, but as its
#               own small, targeted deployment per branch rather than
#               growing sql-hub.bicep's main-only spokeVirtualNetworks array.
#               A branch that already has a vnet (a redeploy of an existing
#               branch) reuses whatever slot it already claimed instead of
#               re-running slot selection -- see the is_branch_deployment
#               block below for why.
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/pipeline/_network-stackname.sh
source "$SCRIPT_DIR/_network-stackname.sh"
# shellcheck source=ops/scripts/pipeline/_az-deploy-retry.sh
source "$SCRIPT_DIR/_az-deploy-retry.sh"
# shellcheck source=ops/scripts/pipeline/_branch-network-pool.sh
source "$SCRIPT_DIR/_branch-network-pool.sh"

# vnet-peering.bicep is a standalone, reusable module (not part of
# network.bicep's own template/stack) -- see its header for why the hub side
# and the branch side must be two independent, separately-scoped
# deployments. Path computed the same way azure-deploy-sql-hub-setup.sh
# computes its own template path relative to this directory.
peering_deployment_file="$SCRIPT_DIR/../../cloud-deployment/lib/network/vnet-peering.bicep"

deployment_file=''
network_rg=''
stack_name=''
vnet_name=''
deploy_vnet=false
location=''
is_branch_deployment=false
branch_name=''
branch_hash_id=''
max_slot_attempts=''

function az_vnet_exists_func() {
    local rg=$1
    local vnetName=$2
    local count
    # vnetName's only current provenance is a Key Vault secret (not
    # attacker-controllable), so this isn't exploitable today, but escape
    # embedded single quotes before interpolating into the JMESPath string
    # literal anyway — cheap to harden now, before that provenance could ever
    # change, rather than have a quote silently mis-evaluate this filter later.
    local escapedVnetName=${vnetName//\'/\\\'}
    # Let a real Azure CLI failure (auth expiry, throttling, wrong subscription)
    # propagate and fail the script loudly, rather than silently reading as
    # "vnet missing" — a flaky call here would otherwise nondeterministically
    # affect the deployVnet decision below. This only works if the caller
    # captures the result as a plain statement rather than inline inside a
    # `[[ ]]` test (see call site below) — set -e ignores command failures
    # that occur as part of a test's condition.
    count=$(az network vnet list -g "${rg}" --query "length([?name=='${escapedVnetName}'])")
    if [[ -z ${count} || ${count} -eq 0 ]]; then
        echo false
    else
        echo true
    fi
}

# Builds the deployment-parameters string for a candidate /20 slot: the base
# common parameters plus vnetAddressPrefix (overriding network.bicep's
# unvaried 10.10.0.0/16 default) and the four subnet prefixes carved from
# that slot (overriding network.bicep's unvaried 10.10.x.0/28 defaults).
# vnetAddressPrefix is bicep's only array-typed param here; the JSON literal
# below contains no spaces, so it survives the caller's intentional
# word-splitting of the full parameters string undisturbed.
function slot_deployment_parameters_func() {
    local base=$1
    local slotCidr=$2
    branch_network_subnet_prefixes "${slotCidr}"
    echo "${base} vnetAddressPrefix=[\"${slotCidr}\"] webappSubnetAddressPrefix=${branch_slot_webapp_subnet_prefix} apiFunctionSubnetAddressPrefix=${branch_slot_api_subnet_prefix} privateEndpointSubnetAddressPrefix=${branch_slot_private_endpoint_subnet_prefix} dataflowsSubnetAddressPrefix=${branch_slot_dataflows_subnet_prefix}"
}

# Deploys (or idempotently re-deploys) the branch's network Deployment
# Stack with the given deployment-parameters string. Broken out of the main
# body so the slot-claim retry loop below can call it once per candidate
# slot without duplicating the az stack group create invocation.
function deploy_network_stack_func() {
    local networkStackName=$1
    local rg=$2
    local file=$3
    local params=$4
    # denyDelete blocks direct out-of-band deletes of this stack's own managed
    # resources (e.g. `az network vnet delete` run by hand against the shared
    # network RG) without affecting the stack's own lifecycle operations (this
    # script's own `az stack group delete` is exempt).
    # az_deploy_with_retry_func (sourced above) tolerates the transient
    # AnotherOperationInProgress/DeploymentActive contention this shared RG can
    # hit from a concurrent branch/main deploy (cams-6us1n) — without it, that
    # purely transient collision fails this whole CI job.
    # shellcheck disable=SC2086 # REASON: intentional word-splitting of --parameters
    az_deploy_with_retry_func az stack group create \
        --name "${networkStackName}" \
        --resource-group "${rg}" \
        --template-file "${file}" \
        --parameters ${params} \
        --action-on-unmanage deleteResources \
        --deny-settings-mode denyDelete \
        --tag isBranchDeployment=true branchName="${branch_name}" branchHashId="${branch_hash_id}" \
        --yes
}

# Attempts ONE side of a vnet-peering.bicep deployment and classifies the
# result: 0 = created/updated successfully, 2 = failed specifically because
# the remote VNet's address space overlaps a VNet already peered to the
# local side (retry-worthy — see _branch-network-pool.sh's
# branch_network_is_overlap_error), 1 = any other failure (not retry-worthy
# as an overlap, though the claim loop below now also retries this case with
# a fresh candidate slot rather than aborting -- see its own comments).
#
# The hub RG (bankruptcy-oversight-support-systems) is a shared RG just like
# the branch network RG -- every concurrent branch's peering claim writes to
# it -- so this call is wrapped in az_deploy_with_retry_func (cams-vwsp3 Goal
# 3 review) exactly like deploy_network_stack_func's stack create and the
# branch-side peering calls below already are: a transient
# AnotherOperationInProgress/DeploymentActive lock conflict is retried
# in-place (silently, before ever reaching the overlap classification below)
# rather than being misclassified as a fatal "other failure" (cams-6us1n).
# az_deploy_with_retry_func streams/tees its own attempts internally; the
# outer `tee` here re-captures that same stream into this function's own
# file purely so the final (post-retry) output can still be pattern-matched
# for the overlap-vs-other classification once az_deploy_with_retry_func
# itself gives up or succeeds.
function attempt_peering_func() {
    local rg=$1
    local localVnetName=$2
    local remoteVnetId=$3
    local peeringName=$4
    local outputFile
    outputFile=$(mktemp)
    trap 'rm -f "${outputFile}"' RETURN
    set +e
    az_deploy_with_retry_func az deployment group create \
        -g "${rg}" \
        --template-file "${peering_deployment_file}" \
        --parameters localVirtualNetworkName="${localVnetName}" remoteVirtualNetworkId="${remoteVnetId}" peeringName="${peeringName}" \
        2>&1 | tee "${outputFile}"
    local rc=${PIPESTATUS[0]}
    set -e
    if [[ ${rc} -eq 0 ]]; then
        return 0
    fi
    if branch_network_is_overlap_error "$(cat "${outputFile}")"; then
        return 2
    fi
    return 1
}

while [[ $# -gt 0 ]]; do
    case $1 in
    -f | --file)
        deployment_file="${2}"
        shift 2
        ;;
    --networkResourceGroupName)
        network_rg="${2}"
        shift 2
        ;;
    --stackName)
        stack_name="${2}"
        shift 2
        ;;
    --virtualNetworkName)
        vnet_name="${2}"
        shift 2
        ;;
    --deployVnet)
        deploy_vnet="${2}"
        shift 2
        ;;
    -l | --location)
        location="${2}"
        shift 2
        ;;
    --isBranchDeployment)
        is_branch_deployment="${2}"
        shift 2
        ;;
    --branchName)
        branch_name="${2}"
        shift 2
        ;;
    --branchHashId)
        branch_hash_id="${2}"
        shift 2
        ;;
    --maxSlotAttempts)
        max_slot_attempts="${2}"
        shift 2
        ;;
    *)
        echo "Exit on param: ${1}"
        exit 2
        ;;
    esac
done

requiredParams=("deployment_file:--file" "network_rg:--networkResourceGroupName" "stack_name:--stackName" "vnet_name:--virtualNetworkName" "location:--location")
missingParams=()
for entry in "${requiredParams[@]}"; do
    varName="${entry%%:*}"
    flagName="${entry#*:}"
    if [[ -z "${!varName}" ]]; then
        missingParams+=("${flagName}")
    fi
done
if [[ ${#missingParams[@]} -gt 0 ]]; then
    echo "Error: missing required parameter(s): ${missingParams[*]}"
    exit 10
fi

# Fixed hub identity, same defaults as sql-hub.bicep's hubVirtualNetworkName /
# main.bicep's hubVirtualNetworkResourceGroupName. Not overridable via flag --
# there is exactly one hub, its identity is already centralized in
# _branch-network-pool.sh's constants, and no real caller has ever needed to
# point this script elsewhere (cams-vwsp3 Goal 3 review).
hub_rg="${BRANCH_NETWORK_HUB_RESOURCE_GROUP_DEFAULT}"
hub_vnet_name="${BRANCH_NETWORK_HUB_VNET_NAME_DEFAULT}"
max_slot_attempts="${max_slot_attempts:-5}"

deployment_parameters="stackName=${stack_name} networkResourceGroupName=${network_rg} virtualNetworkName=${vnet_name} location=${location}"

# Deploy the vnet when explicitly requested, when it does not yet exist, or
# unconditionally for branches: branches deploy this as a Deployment Stack
# with --action-on-unmanage deleteResources. A resource that was
# stack-managed on a prior deploy but is absent from the CURRENT template's
# resources is treated as unmanaged and gets deleted. check-for-network.sh
# reports deployVnet=false once the vnet already exists — true for every
# deploy after a branch's first — so omitting the vnet module here on push #2+
# would delete the branch's own vnet out from under it (or fail with
# InUseSubnetCannotBeDeleted once app resources are attached — the exact class
# of failure this feature exists to prevent). The underlying vnet.bicep PUT is
# idempotent, so always including it for branches costs nothing. Main is
# unaffected — it's never stacked, so its existing existence-check behavior is
# preserved unchanged.
# Existence is only checked in the else branch (skipped whenever
# is_branch_deployment or deploy_vnet already decides the outcome — [[ ]]
# does short-circuit on those operands) and captured as its own statement
# rather than inline inside the `[[ ]]` test: a command substitution used
# directly as a test's condition has its exit status ignored by set -e, so a
# real `az network vnet list` CLI failure would otherwise silently read as
# "vnet missing" instead of aborting the script.
if [[ "${is_branch_deployment}" == "true" || "${deploy_vnet}" == true ]]; then
    deployment_parameters="${deployment_parameters} deployVnet=true"
else
    vnet_exists=$(az_vnet_exists_func "${network_rg}" "${vnet_name}")
    if [[ "${vnet_exists}" != true ]]; then
        deployment_parameters="${deployment_parameters} deployVnet=true"
    fi
fi

if [[ "${is_branch_deployment}" == "true" ]]; then
    # See _network-stackname.sh (sourced above) for why this is a shared
    # function rather than reconstructed inline here.
    network_stack_name=$(network_stack_name_for "${stack_name}")
    echo "Deploying network resources as deployment stack ${network_stack_name} in ${network_rg}"

    # branch_vnet_exists distinguishes a genuinely NEW branch (no vnet yet:
    # run the slot-claim-with-retry loop below) from a redeploy of an
    # EXISTING branch (a slot was already claimed by a prior push: reuse it
    # exactly, never silently re-allocate a different one under a live
    # branch — see this file's header). Captured as its own statement, not
    # inline inside a test, for the same set -e reason as az_vnet_exists_func
    # above.
    branch_vnet_exists=$(az_vnet_exists_func "${network_rg}" "${vnet_name}")

    hub_peering_name=$(branch_network_hub_peering_name_for "${vnet_name}" "${hub_vnet_name}")
    branch_peering_name=$(branch_network_branch_peering_name_for "${vnet_name}" "${hub_vnet_name}")

    # need_claim_loop / excluded_indices decide whether we can take the
    # no-op happy path below or must (re-)enter the claim-retry loop, and if
    # so, which slot(s) to skip. A slot is only ever "claimed" once the
    # hub-side peering has ACTUALLY SUCCEEDED (matches
    # _branch-network-pool.sh's branch_network_claimed_slot_indices, which
    # derives claims from the hub's live peering list, not from VNet
    # existence) -- so a branch VNet that merely exists, with no successful
    # hub-side peering, is the stranded state an exhausted or aborted prior
    # attempt can leave behind (cams-vwsp3 Goal 3 review), and must
    # re-enter the SAME claim-retry loop a genuinely new branch uses, not
    # take a single unretried shot that fails identically forever.
    need_claim_loop=true
    excluded_indices=""

    if [[ "${branch_vnet_exists}" == "true" ]]; then
        slot_cidr=$(az network vnet show -g "${network_rg}" -n "${vnet_name}" --query "addressSpace.addressPrefixes[0]" -o tsv)
        current_slot_idx=$(branch_network_slot_index_for_cidr "${slot_cidr}")
        echo "Branch VNet ${vnet_name} already exists with address space ${slot_cidr}."

        # `list` (not `show`), mirroring az_vnet_exists_func's/stack_exists's
        # reasoning elsewhere in this file family: a genuinely absent
        # peering must read as a normal empty result, not a CLI error, so a
        # transient failure (auth expiry, throttling) can't silently be
        # misread as "already peered" or swallowed as "not peered" -- either
        # would be wrong here. hub_peering_name's only provenance is this
        # script's own vnet_name/hub_vnet_name (not attacker-controllable),
        # but escape embedded single quotes before interpolating into the
        # JMESPath string literal anyway, matching az_vnet_exists_func's
        # hardening.
        escapedHubPeeringName=${hub_peering_name//\'/\\\'}
        hub_peering_state=$(az network vnet peering list --resource-group "${hub_rg}" --vnet-name "${hub_vnet_name}" --query "[?name=='${escapedHubPeeringName}'].provisioningState | [0]" -o tsv)

        if [[ "${hub_peering_state}" == "Succeeded" ]]; then
            echo "Hub-side peering ${hub_peering_name} already succeeded; reusing already-claimed pool slot ${slot_cidr} (no-op)."
            deploy_network_stack_func "${network_stack_name}" "${network_rg}" "${deployment_file}" "$(slot_deployment_parameters_func "${deployment_parameters}" "${slot_cidr}")"

            hub_vnet_id=$(az network vnet show -g "${hub_rg}" -n "${hub_vnet_name}" --query id -o tsv)
            echo "Ensuring branch-side peering ${branch_peering_name} in ${network_rg}"
            az_deploy_with_retry_func az deployment group create \
                -g "${network_rg}" \
                --template-file "${peering_deployment_file}" \
                --parameters localVirtualNetworkName="${vnet_name}" remoteVirtualNetworkId="${hub_vnet_id}" peeringName="${branch_peering_name}"
            need_claim_loop=false
        else
            echo "WARNING: Branch VNet ${vnet_name} exists at ${slot_cidr} but has no successful hub-side peering (provisioning state: '${hub_peering_state:-<none>}') -- this is the stranded state left by an exhausted or aborted prior claim attempt. Re-entering the claim-retry loop with a fresh candidate slot rather than retrying this one." >&2
            excluded_indices="${current_slot_idx}"
        fi
    fi

    if [[ "${need_claim_loop}" == "true" ]]; then
        attempt=1
        claimed=false
        while [[ ${attempt} -le ${max_slot_attempts} ]]; do
            candidate_idx=$(branch_network_find_free_slot "${hub_rg}" "${hub_vnet_name}" "${excluded_indices}")
            candidate_cidr=$(branch_network_slot_cidr "${candidate_idx}")
            echo "Attempt ${attempt}/${max_slot_attempts}: claiming pool slot ${candidate_idx} (${candidate_cidr}) for branch VNet ${vnet_name}"

            # An in-place address-space change via Incremental-mode redeploy
            # is safe here even when this branch's VNet already exists at a
            # different (stranded) address: no dependent resources (app
            # VNET integration, private endpoints) exist in these subnets
            # this early in a branch's lifecycle, so retargeting the same
            # stack to a new candidate slot is just another idempotent PUT,
            # not a destructive operation (confirmed for cams-vwsp3 Goal 3).
            deploy_network_stack_func "${network_stack_name}" "${network_rg}" "${deployment_file}" "$(slot_deployment_parameters_func "${deployment_parameters}" "${candidate_cidr}")"

            branch_vnet_id=$(az network vnet show -g "${network_rg}" -n "${vnet_name}" --query id -o tsv)
            hub_vnet_id=$(az network vnet show -g "${hub_rg}" -n "${hub_vnet_name}" --query id -o tsv)

            echo "Attempting hub-side peering ${hub_peering_name} in ${hub_rg} for candidate slot ${candidate_idx}"
            set +e
            attempt_peering_func "${hub_rg}" "${hub_vnet_name}" "${branch_vnet_id}" "${hub_peering_name}"
            hubPeeringRc=$?
            set -e

            if [[ ${hubPeeringRc} -eq 0 ]]; then
                echo "Hub-side peering succeeded for slot ${candidate_idx}; creating branch-side peering ${branch_peering_name} in ${network_rg}"
                az_deploy_with_retry_func az deployment group create \
                    -g "${network_rg}" \
                    --template-file "${peering_deployment_file}" \
                    --parameters localVirtualNetworkName="${vnet_name}" remoteVirtualNetworkId="${hub_vnet_id}" peeringName="${branch_peering_name}"
                claimed=true
                break
            else
                # Bug 2 fix (cams-vwsp3 Goal 3 review): ANY hub-peering
                # failure here -- overlap (rc=2) OR a genuine other failure
                # (rc=1) -- is retried with a fresh candidate rather than
                # aborting. Aborting here would leave this branch's VNet
                # deployed at ${candidate_cidr} with no successful hub
                # peering: an address space that silently occupies a slot
                # invisible to other branches' claim checks (only a
                # SUCCESSFUL hub peering marks a slot claimed -- see
                # _branch-network-pool.sh's
                # branch_network_claimed_slot_indices), since nothing else
                # would ever notice or free it. A full rollback (deleting
                # the candidate's VNet deployment) was considered and
                # rejected as unneeded complexity: the reuse path above
                # already recognizes "VNet exists, no successful hub
                # peering" as the correct signal to re-enter this very loop,
                # so retrying now -- or leaving that same recognized state
                # behind on exhaustion below -- is sufficient for the system
                # to converge on a later run without ever leaving a slot
                # permanently claimed-but-invisible.
                if [[ ${hubPeeringRc} -eq 2 ]]; then
                    echo "WARNING: candidate slot ${candidate_idx} (${candidate_cidr}) lost a concurrent claim race (hub-side peering rejected for address-space overlap); retrying with the next free slot." >&2
                else
                    echo "WARNING: hub-side peering deployment failed for slot ${candidate_idx} (${candidate_cidr}) for a reason other than an address-space overlap; retrying with the next free slot rather than aborting with an invisible claimed slot." >&2
                fi
                excluded_indices="${excluded_indices} ${candidate_idx}"
                attempt=$((attempt + 1))
            fi
        done

        if [[ "${claimed}" != "true" ]]; then
            echo "ERROR: exhausted ${max_slot_attempts} attempt(s) trying to claim a free branch network pool slot for ${vnet_name} -- every candidate either lost a concurrent race or failed to peer. The branch's VNet is left deployed (unpeered) at the last attempted candidate slot; simply re-running this deploy will detect that stranded state and re-enter this same claim-retry loop with a fresh candidate slot. If every attempt failed for the SAME non-overlap reason, fix that underlying cause before re-running." >&2
            exit 12
        fi
    fi
else
    echo "Deploying network resources to ${network_rg} (resource-group deployment)"
    # Preview then apply — matches the established pattern elsewhere in this
    # repo (azure-deploy.sh's az_deploy_func, azure-deploy-rg.sh's
    # az_deploy_func). `-w`/`--what-if` only previews changes and never
    # applies them, so both calls are required: dropping the second (non -w)
    # call would silently stop deploying main's network resources.
    # shellcheck disable=SC2086 # REASON: intentional word-splitting of --parameters
    az deployment group create -w -g "${network_rg}" --template-file "${deployment_file}" --parameter ${deployment_parameters}
    # shellcheck disable=SC2086 # REASON: intentional word-splitting of --parameters
    az deployment group create -g "${network_rg}" --template-file "${deployment_file}" --parameter ${deployment_parameters}
fi
