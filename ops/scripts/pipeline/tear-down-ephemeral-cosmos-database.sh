#!/usr/bin/env bash

# Title:        tear-down-ephemeral-cosmos-database.sh
# Description:  Deletes a throwaway Cosmos DB Mongo API database previously
#               created by stand-up-ephemeral-cosmos-database.sh. Intended to
#               run unconditionally (if: always()) in CI so a failed test run
#               never leaks the ephemeral database.
#
#               Refuses to delete anything whose name doesn't look disposable
#               -- mirrors test/e2e/scripts/seed-database.ts's DB_NAME guard,
#               inverted and stricter, so a variable mix-up can never delete
#               the persistent e2e database.
#
# Prerequisite: Azure CLI, already authenticated, with Contributor on the
#               target Cosmos account.
#
# Usage:        ./tear-down-ephemeral-cosmos-database.sh \
#                 --resourceGroup <rg> --accountName <account> --databaseName <name>
#
# Exitcodes
# ==========
# 0   No error (including: database didn't exist -- nothing to do)
# 2   Unknown flag or required parameter missing
# 3   Database name doesn't match the disposable-test pattern -- refusing to delete
set -euo pipefail

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

# The single most important safety net here: never delete anything that
# doesn't look disposable, regardless of what the caller passes in.
if [[ "${databaseName}" != *"-idxtest-"* ]]; then
    log "Refusing to delete '${databaseName}' -- ephemeral database names must contain '-idxtest-'"
    exit 3
fi

log "Checking whether '${databaseName}' exists on ${accountName}..."
exists=$(retry az cosmosdb mongodb database exists -g "${resourceGroup}" -a "${accountName}" -n "${databaseName}")
if [[ "${exists}" != "true" ]]; then
    log "Database '${databaseName}' does not exist -- nothing to tear down."
    exit 0
fi

log "Deleting ephemeral database '${databaseName}'..."
retry az cosmosdb mongodb database delete -g "${resourceGroup}" -a "${accountName}" -n "${databaseName}" --yes >/dev/null
log "Deleted '${databaseName}'."
