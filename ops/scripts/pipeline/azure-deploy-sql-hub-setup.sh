#!/usr/bin/env bash

# Title:        azure-deploy-sql-hub-setup.sh
# Description:  Deploy the SQL Private Link hub CORE -- a dedicated hub
#               VNet/subnet and ONE Private Endpoint against sql-ustp-cams --
#               into bankruptcy-oversight-support-systems, the SQL server's
#               own resource group.
#
#               Run via the manual "Deploy SQL Private Link Hub" workflow
#               (.github/workflows/deploy-sql-hub.yml). Migrating consumers off
#               their own Private Endpoints is a separate, staged operation --
#               see docs/operations/deployment.md.
#
# KNOWN what-if NOISE. Two deltas are reported on every run and are both
# false positives; neither indicates a real change:
#   - `- properties.virtualNetworkPeerings` on the hub VNet. Spoke peerings
#     are declared by each spoke, never here, so they are absent from this
#     template and what-if reports them as removals. Incremental mode does not
#     touch undeclared children. Disproven empirically on throwaway resources.
#   - `- properties.isIPv6EnabledPrivateEndpoint` on the endpoint. A
#     service-populated property this template does not declare; same shape.
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10  --resource-group not supplied
# 11  A named consumer zone resource group has no SQL private DNS zone
# 12  --consumer-zone-resource-groups not supplied

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/pipeline/_az-deploy-retry.sh
source "$SCRIPT_DIR/_az-deploy-retry.sh"
# shellcheck source=ops/scripts/pipeline/_vnet-link-check.sh
source "$SCRIPT_DIR/_vnet-link-check.sh"

deployment_file="$SCRIPT_DIR/../../cloud-deployment/lib/network/sql-hub.bicep"
resource_group=''
what_if=false
extra_parameters=''
consumer_zone_rgs=''

# Must match sql-hub.bicep's hubStackName-derived endpoint name. The Bicep
# computes it as 'pep-${hubStackName}'; duplicated here only to look up the
# legacy zone group below, which is a migration-era check that disappears once
# that group is gone.
readonly HUB_ENDPOINT_NAME='pep-ustp-cams-sql-hub'
readonly SQL_PRIVATE_DNS_ZONE_NAME='privatelink.database.usgovcloudapi.net'

while [[ $# -gt 0 ]]; do
    case $1 in
    --resource-group)
        resource_group="${2}"
        shift 2
        ;;
    # Preview first: this endpoint is shared by every environment.
    --what-if)
        what_if=true
        shift 1
        ;;
    # Space-delimited "key=value" bicep parameters, word-split at the az calls
    # below. An array value like foo=["rg-cams-network"] contains brackets,
    # which bash reads as a glob character class -- so a matching filename in
    # the working directory would silently rewrite the parameter. Hence set -f.
    -p | --parameters)
        extra_parameters="${2}"
        shift 2
        ;;
    # REQUIRED. Space-separated resource group names, e.g.
    #   --consumer-zone-resource-groups "rg-cams-network rg-cams-network-dev"
    # Each must already hold a zone named $SQL_PRIVATE_DNS_ZONE_NAME; the
    # precheck below fails loud if one doesn't. Taken as a plain list rather
    # than as a pre-formatted bicep array so the JSON bracket quoting -- and
    # the glob hazard documented on --parameters above -- lives in exactly one
    # place instead of being reconstructed by every caller.
    --consumer-zone-resource-groups)
        consumer_zone_rgs="${2}"
        shift 2
        ;;
    *)
        echo "Exit on param: ${1}"
        exit 2
        ;;
    esac
done

if [[ -z "${resource_group}" ]]; then
    echo "Error: --resource-group is required"
    exit 10
fi

# REQUIRED, not optional-with-a-fallback. sql-hub.bicep carries its own
# default consumer-zone list, so omitting this flag would still deploy -- but
# against a list this script never saw and therefore could not precheck,
# reintroducing exactly the half-applied failure the precheck below exists to
# prevent. Making the caller state the zones keeps the checked list and the
# deployed list the same list by construction.
if [[ -z "${consumer_zone_rgs}" ]]; then
    echo "Error: --consumer-zone-resource-groups is required" >&2
    echo "       e.g. --consumer-zone-resource-groups \"rg-cams-network rg-cams-network-dev\"" >&2
    echo "       Passing it explicitly is what lets this script verify every zone" >&2
    echo "       exists before it touches the shared endpoint." >&2
    exit 12
fi

# Every consumer zone must already exist. An A record is a CHILD of its zone,
# so a missing one fails the deployment with ParentResourceNotFound -- after
# it has already updated the shared endpoint. Checking first turns a
# half-applied deploy into a clean refusal. Mirrors the identical precheck
# azure-deploy.sh runs before its vnet links, and reuses the same helper so
# the two cannot drift.
missing_zone_rgs=''
for zone_rg in ${consumer_zone_rgs}; do
    zone_exists_for "${zone_rg}" "${SQL_PRIVATE_DNS_ZONE_NAME}"
    if [[ "${zone_check_result}" != "true" ]]; then
        missing_zone_rgs="${missing_zone_rgs} ${zone_rg}"
    fi
done
if [[ -n "${missing_zone_rgs}" ]]; then
    echo "Error: no ${SQL_PRIVATE_DNS_ZONE_NAME} zone in:${missing_zone_rgs}" >&2
    echo "       Each --consumer-zone-resource-groups entry must already hold that zone." >&2
    echo "       The hub never creates it -- the zone belongs to the consumer." >&2
    exit 11
fi

# Build the bicep array here so the bracket quoting exists in one place.
# The double quotes are LITERAL on purpose: `az ... --parameter key=value`
# parses value as JSON, so the array elements must arrive still quoted.
# Safe to word-split downstream because a resource group name cannot
# contain whitespace, so the assembled `[...]` is always a single word.
consumer_zone_json=''
for zone_rg in ${consumer_zone_rgs}; do
    # shellcheck disable=SC2089 # REASON: literal quotes are required -- az parses this value as JSON
    consumer_zone_json="${consumer_zone_json:+${consumer_zone_json},}\"${zone_rg}\""
done
# shellcheck disable=SC2089 # REASON: see above
extra_parameters="${extra_parameters} consumerPrivateDnsZoneResourceGroups=[${consumer_zone_json}]"

# Migration-era check. The endpoint used to register through a
# privateDnsZoneGroup named 'default'; sql-hub.bicep no longer declares one,
# and ARM incremental mode will not delete an undeclared child, so it survives
# until removed by hand. Deploying with it present is SAFE (it does not
# re-assert over the explicit A records), but deleting it afterwards ALSO
# deletes the record it owns -- including one this template has since
# rewritten -- so a second deploy is required to restore that record. Warn
# loudly rather than refuse: the deploy itself is the step that fixes the
# zone currently missing its record.
if surviving_zone_group=$(az network private-endpoint dns-zone-group list \
    -g "${resource_group}" --endpoint-name "${HUB_ENDPOINT_NAME}" \
    --query "[].name" -o tsv 2>/dev/null) && [[ -n "${surviving_zone_group}" ]]; then
    cat >&2 <<EOF

============================ ACTION REQUIRED =============================
A legacy privateDnsZoneGroup still exists on ${HUB_ENDPOINT_NAME}:
  ${surviving_zone_group}

This deploy is safe to run with it present, but it is NOT the end state.
After this deploy succeeds, complete the migration IN THIS ORDER:

  1. az network private-endpoint dns-zone-group delete \\
       -g ${resource_group} --endpoint-name ${HUB_ENDPOINT_NAME} -n <name>
  2. Re-run this deploy.   <-- MANDATORY, not optional

Step 1 deletes the A record that zone group owns, even though this deploy
rewrote it. Step 2 puts it back. Skipping step 2 leaves that consumer zone
resolving through the PUBLIC path instead of the private endpoint, silently
-- which is the exact bug this change exists to fix.
==========================================================================

EOF
fi

if [[ "${what_if}" == "true" ]]; then
    echo "Running what-if for SQL Private Link hub against ${resource_group}"
    if [[ -n "${extra_parameters}" ]]; then
        set -f # see --parameters above: split, but never glob
        # shellcheck disable=SC2086,SC2090 # REASON: intentional word-splitting of --parameter; the literal quotes inside it are meant for az's JSON parser, not the shell
        az deployment group what-if --name "ustp-cams-sql-hub" -g "${resource_group}" --template-file "${deployment_file}" --parameter ${extra_parameters}
        set +f
    else
        az deployment group what-if --name "ustp-cams-sql-hub" -g "${resource_group}" --template-file "${deployment_file}"
    fi
    exit 0
fi

echo "Deploying SQL Private Link hub to ${resource_group}"
if [[ -n "${extra_parameters}" ]]; then
    set -f # see --parameters above: split, but never glob
    # shellcheck disable=SC2086,SC2090 # REASON: intentional word-splitting of --parameter; the literal quotes inside it are meant for az's JSON parser, not the shell
    az_deploy_with_retry_func az deployment group create --name "ustp-cams-sql-hub" -g "${resource_group}" --template-file "${deployment_file}" --parameter ${extra_parameters}
    set +f
else
    az_deploy_with_retry_func az deployment group create --name "ustp-cams-sql-hub" -g "${resource_group}" --template-file "${deployment_file}"
fi
