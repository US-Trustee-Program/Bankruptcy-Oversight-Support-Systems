#!/usr/bin/env bash

# Title:        stand-up-ephemeral-cosmos-database.sh
# Description:  Provisions a throwaway Cosmos DB Mongo API database (full
#               production schema — all collections, shard keys, indexes,
#               via ops/cloud-deployment/ustp-cams-cosmos-e2e.bicep) inside
#               an EXISTING shared Cosmos account, for a CI job to run a
#               real-Cosmos regression test against, then delete with
#               tear-down-ephemeral-cosmos-database.sh.
#
#               Deliberately reuses the full production Bicep module rather
#               than hand-rolling collection/index creation, so the test this
#               feeds is byte-for-byte the same declarative schema that ships
#               to production/e2e -- zero drift risk between what's tested
#               and what's deployed.
#
#               Refuses to run if a database with the given name already
#               exists, so this can never silently reuse/overwrite another
#               run's (or a human's) database.
#
# Prerequisite: Azure CLI, already authenticated (az login / azure/login step)
#               with Contributor on the target Cosmos account.
#
# Usage:        ./stand-up-ephemeral-cosmos-database.sh \
#                 --resourceGroup <rg> --accountName <account> --databaseName <name>
#
# Output:       Prints ONLY the Mongo connection string to stdout on success.
#               All progress/diagnostic output goes to stderr, so callers can
#               safely capture with: conn=$(./stand-up-ephemeral-cosmos-database.sh ...)
#
# Exitcodes
# ==========
# 0   No error
# 2   Unknown flag or required parameter missing
# 3   A database with the given name already exists -- refusing to overwrite
set -euo pipefail

# Cosmos request-rate-too-large error code (RU/control-plane throttling).
COSMOS_THROTTLED_ERROR_CODE=16500
MAX_ATTEMPTS=5
RETRY_BASE_DELAY_SECONDS=2

log() {
    echo "$@" >&2
}

retry() {
    local attempt=1
    local stdout_out
    local stderr_out
    local rc
    local stderr_file
    stderr_file=$(mktemp)
    while true; do
        set +e
        stdout_out=$("$@" 2>"${stderr_file}")
        rc=$?
        set -e
        stderr_out=$(cat "${stderr_file}")
        if [[ ${rc} -eq 0 ]]; then
            [[ -n "${stderr_out}" ]] && log "${stderr_out}"
            rm -f "${stderr_file}"
            echo "${stdout_out}"
            return 0
        fi
        if [[ "${stderr_out}" != *"${COSMOS_THROTTLED_ERROR_CODE}"* ]] || [[ ${attempt} -ge ${MAX_ATTEMPTS} ]]; then
            log "${stderr_out}"
            log "${stdout_out}"
            rm -f "${stderr_file}"
            return "${rc}"
        fi
        log "Throttled (attempt ${attempt}/${MAX_ATTEMPTS}), retrying..."
        sleep $((RETRY_BASE_DELAY_SECONDS * attempt))
        attempt=$((attempt + 1))
    done
}

resourceGroup=
accountName=
databaseName=

while [[ $# -gt 0 ]]; do
    case $1 in
    --resourceGroup)
        resourceGroup="${2}"
        shift 2
        ;;
    --accountName)
        accountName="${2}"
        shift 2
        ;;
    --databaseName)
        databaseName="${2}"
        shift 2
        ;;
    *)
        log "Unknown flag: $1"
        exit 2
        ;;
    esac
done

if [[ -z "${resourceGroup}" || -z "${accountName}" || -z "${databaseName}" ]]; then
    log "Usage: $0 --resourceGroup <rg> --accountName <account> --databaseName <name>"
    exit 2
fi

# Safety net mirroring test/e2e/scripts/seed-database.ts's DB_NAME guard: this
# script must only ever create disposable-looking test databases, never
# anything that could collide with the persistent e2e/main databases.
if [[ "${databaseName}" != *"-idxtest-"* ]]; then
    log "Refusing to stand up '${databaseName}' -- ephemeral database names must contain '-idxtest-'"
    exit 2
fi

log "Checking that '${databaseName}' does not already exist on ${accountName}..."
exists=$(retry az cosmosdb mongodb database exists -g "${resourceGroup}" -a "${accountName}" -n "${databaseName}")
if [[ "${exists}" == "true" ]]; then
    log "ERROR: database '${databaseName}' already exists on ${accountName} -- refusing to overwrite."
    exit 3
fi

log "Deploying full Cosmos schema into ephemeral database '${databaseName}'..."
retry az deployment group create \
    -g "${resourceGroup}" \
    -f ./ops/cloud-deployment/ustp-cams-cosmos-e2e.bicep \
    -p resourceGroupName="${resourceGroup}" accountName="${accountName}" databaseName="${databaseName}" \
    >/dev/null

log "Fetching Mongo connection string for ${accountName}..."
connectionString=$(retry az cosmosdb keys list \
    -g "${resourceGroup}" \
    -n "${accountName}" \
    --type connection-strings \
    --query "connectionStrings[?description=='Primary MongoDB Connection String'].connectionString" \
    -o tsv)

log "Ephemeral database '${databaseName}' is ready."
echo "${connectionString}"
