#!/usr/bin/env bash

# Title:        azure-deploy-network.sh
# Description:  Deploy the USTP CAMS network resources (vnet, subnets) into the
#               network resource group. For branch deployments the network
#               resources are deployed as an Azure Deployment Stack so they
#               can be torn down as a unit without deleting the resource group.
#               For main the resources are deployed with a
#               plain resource-group deployment (behavior preserved). The webapp
#               private DNS zone is deployed separately, always as a plain
#               deployment, by azure-deploy-app-shared-setup.sh / app-shared-setup.bicep
#               — never here, since this template IS a Deployment Stack for branches.
#
#               For a genuinely NEW branch (no vnet yet), this script also
#               claims a /20 slot from the branch pool (see
#               _branch-network-pool.sh), wires it into the branch's own
#               vnetAddressPrefix/subnet prefixes, and creates BOTH sides of
#               the peering to the shared SQL Private Link hub via
#               vnet-peering.bicep. A branch that already has a vnet reuses
#               whatever slot it already claimed.
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

# vnet-peering.bicep is standalone, not part of network.bicep's stack -- see its
# header for why the hub side and branch side must be separately scoped.
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
# Opt-in only. A branch VNet outside the address pool is a legacy branch still
# on network.bicep's old static 10.10.0.0/16; re-addressing it in place breaks
# any subnet already hosting VNet integration or a private endpoint, which is
# true of every branch that exists today. Default false means those branches
# keep deploying unchanged and simply do not get hub peering.
allow_legacy_vnet_readdress=false

function az_vnet_exists_func() {
    local rg=$1
    local vnetName=$2
    local count
    # Escape single quotes before interpolating into the JMESPath literal.
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

# Builds the deployment-parameters string for a candidate /20 slot. The JSON
# literal contains no spaces, so it survives the caller's word-splitting.
function slot_deployment_parameters_func() {
    local base=$1
    local slotCidr=$2
    branch_network_subnet_prefixes "${slotCidr}"
    echo "${base} vnetAddressPrefix=[\"${slotCidr}\"] webappSubnetAddressPrefix=${branch_slot_webapp_subnet_prefix} apiFunctionSubnetAddressPrefix=${branch_slot_api_subnet_prefix} privateEndpointSubnetAddressPrefix=${branch_slot_private_endpoint_subnet_prefix} dataflowsSubnetAddressPrefix=${branch_slot_dataflows_subnet_prefix}"
}

# Deploys (or idempotently re-deploys) the branch's network Deployment Stack.
function deploy_network_stack_func() {
    local networkStackName=$1
    local rg=$2
    local file=$3
    local params=$4
    # denyDelete blocks direct out-of-band deletes of this stack's own managed
    # resources (e.g. `az network vnet delete` run by hand against the shared
    # network RG) without affecting the stack's own lifecycle operations (this
    # script's own `az stack group delete` is exempt).
    # az_deploy_with_retry_func tolerates the transient
    # AnotherOperationInProgress/DeploymentActive contention this shared RG hits
    # from concurrent deploys; without it that collision fails the whole job.
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
# result: 0 = success, 2 = the remote VNet's address space overlaps a VNet
# already peered to the local side (retry-worthy -- see
# branch_network_is_overlap_error), 1 = any other failure.
#
# Wrapped in az_deploy_with_retry_func so a transient lock conflict on the
# shared hub RG is retried rather than misclassified as an overlap. The outer
# tee re-captures that stream so the post-retry output can still be matched.
function attempt_peering_func() {
    local rg=$1
    local localVnetName=$2
    local remoteVnetId=$3
    local peeringName=$4
    local outputFile
    outputFile=$(mktemp)
    # No `trap ... RETURN` here, for the reason documented in
    # _az-deploy-retry.sh: bash RETURN traps are global, so one set here fires
    # again on the NEXT function return anywhere in the script, by which point
    # outputFile is out of scope and `set -u` aborts. This function is called
    # inside the claim retry loop, so the next iteration's
    # branch_network_find_free_slot return would trip it -- killing the retry
    # that exists to recover from a lost slot race.
    set +e
    # --name is REQUIRED, not cosmetic. Without it ARM derives the deployment
    # name from the template filename ("vnet-peering"), so every branch peering
    # into the shared hub RG concurrently collides on ONE deployment name. That
    # surfaces as AnotherOperationInProgress, gets swallowed as transient
    # contention by the retry wrapper, and burns the slot-attempt budget. Naming
    # per peering keeps concurrent branches from interfering -- the environment
    # isolation invariant on cams-vwsp3.
    az_deploy_with_retry_func az deployment group create \
        -g "${rg}" \
        --name "${peeringName}" \
        --template-file "${peering_deployment_file}" \
        --parameters localVirtualNetworkName="${localVnetName}" remoteVirtualNetworkId="${remoteVnetId}" peeringName="${peeringName}" \
        2>&1 | tee "${outputFile}"
    local rc=${PIPESTATUS[0]}
    set -e
    local out
    out=$(cat "${outputFile}")
    rm -f "${outputFile}"
    if [[ ${rc} -eq 0 ]]; then
        return 0
    fi
    if branch_network_is_overlap_error "${out}"; then
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
    --allowLegacyVnetReaddress)
        allow_legacy_vnet_readdress="${2}"
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

# Fixed hub identity, centralized in _branch-network-pool.sh's constants.
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
    fi

    # A legacy branch: VNet exists but sits OUTSIDE the pool, still on the old
    # static 10.10.0.0/16. Do NOT re-address it -- its subnets host live App
    # Service VNet integration and private endpoints, and Azure rejects
    # address-space changes on in-use subnets. It is still offered hub peering
    # at its existing address; "do not re-address" and "do not peer" are
    # separable. Re-addressing is opt-in via --allowLegacyVnetReaddress, to be
    # done only when nothing is deployed into those subnets.
    if [[ "${branch_vnet_exists}" == "true" && -z "${current_slot_idx}" && "${allow_legacy_vnet_readdress}" != "true" ]]; then
        echo "Branch VNet ${vnet_name} is at ${slot_cidr}, outside the ${BRANCH_NETWORK_POOL_SLOT_COUNT}-slot pool (10.${BRANCH_NETWORK_POOL_SECOND_OCTET_BASE}.0.0/12) -- a legacy branch predating dynamic allocation."
        echo "Leaving its address space untouched and skipping hub peering. Re-addressing a live VNet would break subnets that already host VNet integration and private endpoints."
        echo "To migrate it deliberately (only safe when nothing is deployed into those subnets), re-run with --allowLegacyVnetReaddress true."
        # shellcheck disable=SC2086 # REASON: intentional word-splitting of --parameters
        deploy_network_stack_func "${network_stack_name}" "${network_rg}" "${deployment_file}" "${deployment_parameters}"
        need_claim_loop=false

        # Offer hub peering anyway, at the existing address space. A legacy
        # 10.10.0.0/16 does not overlap the hub's own 10.20.0.0/24, so the
        # peering itself is valid -- the address pool exists to keep BRANCHES
        # from overlapping EACH OTHER, and only matters once a second branch
        # wants in. Since every legacy branch shares 10.10.0.0/16, exactly one
        # can hold a hub peering at a time; the rest get Azure's overlap
        # rejection, which is handled below rather than treated as fatal.
        #
        # This matters concretely: a cross-region branch (AZ-FUNCTIONS-LOCATION
        # set) CANNOT use the SQL VNet-rule path at all, because Azure requires
        # the rule's subnet to be in the server's region. The hub is its only
        # route to SQL. Refusing to peer it purely because its address predates
        # the pool would strand exactly the branch that most needs the hub.
        #
        # Failure here is never fatal. A legacy branch without hub peering is
        # simply in the state it was already in, so this can only add
        # connectivity, never remove it.
        set +e
        hub_vnet_id=$(az network vnet show -g "${hub_rg}" -n "${hub_vnet_name}" --query id -o tsv 2>/dev/null)
        hubLookupRc=$?
        set -e
        if [[ ${hubLookupRc} -ne 0 || -z "${hub_vnet_id}" ]]; then
            echo "WARNING: hub VNet ${hub_vnet_name} not found in ${hub_rg}; leaving legacy branch ${vnet_name} unpeered. It keeps its existing SQL path." >&2
        else
            branch_vnet_id=$(az network vnet show -g "${network_rg}" -n "${vnet_name}" --query id -o tsv)
            echo "Offering hub peering to legacy branch ${vnet_name} at its existing ${slot_cidr}"
            set +e
            attempt_peering_func "${hub_rg}" "${hub_vnet_name}" "${branch_vnet_id}" "${hub_peering_name}"
            legacyPeeringRc=$?
            set -e
            if [[ ${legacyPeeringRc} -eq 0 ]]; then
                az_deploy_with_retry_func az deployment group create \
                    -g "${network_rg}" \
                    --name "${branch_peering_name}" \
                    --template-file "${peering_deployment_file}" \
                    --parameters localVirtualNetworkName="${vnet_name}" remoteVirtualNetworkId="${hub_vnet_id}" peeringName="${branch_peering_name}"
                echo "Legacy branch ${vnet_name} is now peered to the hub at ${slot_cidr}."
            elif [[ ${legacyPeeringRc} -eq 2 ]]; then
                echo "WARNING: cannot peer legacy branch ${vnet_name} at ${slot_cidr} -- another VNet with an overlapping range is already peered to the hub. Only one branch can hold a hub peering at the shared legacy address. This branch keeps its existing SQL path; re-address it into the pool to join the hub." >&2
            else
                echo "WARNING: hub peering failed for legacy branch ${vnet_name}; it keeps its existing SQL path." >&2
            fi
        fi
    elif [[ "${branch_vnet_exists}" == "true" ]]; then
        if [[ -z "${current_slot_idx}" ]]; then
            echo "WARNING: --allowLegacyVnetReaddress was set; branch VNet ${vnet_name} at ${slot_cidr} WILL be re-addressed into the pool. This fails if anything is deployed into its subnets." >&2
        fi

        # `list`, not `show`: an absent peering must read as an empty result,
        # not a CLI error, so a transient failure can't be misread as either
        # "already peered" or "not peered".
        escapedHubPeeringName=${hub_peering_name//\'/\\\'}
        hub_peering_state=$(az network vnet peering list --resource-group "${hub_rg}" --vnet-name "${hub_vnet_name}" --query "[?name=='${escapedHubPeeringName}'].provisioningState | [0]" -o tsv)

        if [[ "${hub_peering_state}" == "Succeeded" ]]; then
            echo "Hub-side peering ${hub_peering_name} already succeeded; reusing already-claimed pool slot ${slot_cidr} (no-op)."
            deploy_network_stack_func "${network_stack_name}" "${network_rg}" "${deployment_file}" "$(slot_deployment_parameters_func "${deployment_parameters}" "${slot_cidr}")"

            hub_vnet_id=$(az network vnet show -g "${hub_rg}" -n "${hub_vnet_name}" --query id -o tsv)
            echo "Ensuring branch-side peering ${branch_peering_name} in ${network_rg}"
            az_deploy_with_retry_func az deployment group create \
                -g "${network_rg}" \
                --name "${branch_peering_name}" \
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
            # Plain statement, NOT `candidate_idx=$(...)` -- see
            # branch_network_find_free_slot's contract in _branch-network-pool.sh.
            # Called in a command substitution, a failure to read the hub's
            # peering list would be silently indistinguishable from "slot 0 is
            # free", and every branch deploying during an az outage would claim
            # the same range.
            branch_network_find_free_slot "${hub_rg}" "${hub_vnet_name}" "${excluded_indices}"
            candidate_idx="${branch_network_free_slot}"
            candidate_cidr=$(branch_network_slot_cidr "${candidate_idx}")
            echo "Attempt ${attempt}/${max_slot_attempts}: claiming pool slot ${candidate_idx} (${candidate_cidr}) for branch VNet ${vnet_name}"

            # Safe to retarget this stack to a new slot: reaching this loop
            # means the VNet is either new or stranded WITHIN the pool, so
            # nothing is deployed into its subnets yet. A legacy VNet outside
            # the pool never gets here -- it is excluded above, precisely
            # because that population DOES have live dependents.
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
                    --name "${branch_peering_name}" \
                    --template-file "${peering_deployment_file}" \
                    --parameters localVirtualNetworkName="${vnet_name}" remoteVirtualNetworkId="${hub_vnet_id}" peeringName="${branch_peering_name}"
                claimed=true
                break
            else
                # ANY hub-peering failure -- overlap (rc=2) or otherwise
                # (rc=1) -- retries with a fresh candidate rather than
                # aborting. Aborting would leave the VNet deployed at
                # ${candidate_cidr} with no successful peering, occupying a
                # slot that no other branch's claim check can see: only a
                # SUCCESSFUL hub peering marks a slot claimed. The reuse path
                # above treats "VNet exists, no successful hub peering" as the
                # signal to re-enter this loop,
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
    # Preview then apply. `-w` only previews, so BOTH calls are required --
    # dropping the second silently stops deploying main's network resources.
    # shellcheck disable=SC2086 # REASON: intentional word-splitting of --parameters
    az deployment group create -w -g "${network_rg}" --template-file "${deployment_file}" --parameter ${deployment_parameters}
    # shellcheck disable=SC2086 # REASON: intentional word-splitting of --parameters
    az deployment group create -g "${network_rg}" --template-file "${deployment_file}" --parameter ${deployment_parameters}
fi
