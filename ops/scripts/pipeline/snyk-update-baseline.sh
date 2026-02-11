#!/usr/bin/env bash
#
# Generate a baseline text file from a Snyk Code SARIF and upload it to
# Azure Storage. The baseline is a plain text file with one fingerprint per
# line, annotated with comments showing the rule and location.
#
# Requires az login and storage account permissions.
#
# Usage: snyk-update-baseline.sh <resource_group> <storage_account_name> <sarif_file_path>
#
set -euo pipefail

RESOURCE_GROUP="${1:-}"
STORAGE_ACCOUNT_NAME="${2:-}"
SARIF_FILE="${3:-}"

if [[ -z "$RESOURCE_GROUP" || -z "$STORAGE_ACCOUNT_NAME" || -z "$SARIF_FILE" ]]; then
    echo "Usage: snyk-update-baseline.sh <resource_group> <storage_account_name> <sarif_file_path>" >&2
    exit 1
fi

if [[ ! -f "$SARIF_FILE" ]]; then
    echo "Error: SARIF file not found: $SARIF_FILE" >&2
    exit 1
fi

BASELINE_FILE=$(mktemp)
trap 'rm -f "$BASELINE_FILE"' EXIT

cat > "$BASELINE_FILE" <<'HEADER'
# Snyk Code (SAST) Baseline — accepted findings
#
# Each non-comment, non-blank line is a fingerprint["1"] value from Snyk SARIF.
# To add a finding, run a scan, locate the fingerprint, and add it below with
# a comment noting the rule and file location.
#
# To update this file, run:
#   ops/scripts/pipeline/snyk-update-baseline.sh <rg> <storage-account> <sarif>
#
HEADER

jq -r '
    .runs[0].results[] // empty |
    "# \(.ruleId) — \(.locations[0].physicalLocation.artifactLocation.uri // "unknown"):\(.locations[0].physicalLocation.region.startLine // "?")\n\(.fingerprints["1"] // "\(.ruleId)|\(.locations[0].physicalLocation.artifactLocation.uri // "unknown")")\n"
' "$SARIF_FILE" >> "$BASELINE_FILE"

echo "Generated baseline:"
cat "$BASELINE_FILE"
echo "---"

ACCOUNT_KEY=$(az storage account keys list \
    -n "$STORAGE_ACCOUNT_NAME" \
    -g "$RESOURCE_GROUP" \
    --query '[0].value' -o tsv)

az storage blob upload \
    --account-name "$STORAGE_ACCOUNT_NAME" \
    --account-key "$ACCOUNT_KEY" \
    -f "$BASELINE_FILE" \
    -c snyk-baseline \
    -n snyk-code-baseline.txt \
    --overwrite

echo "Baseline uploaded: snyk-code-baseline.txt"
