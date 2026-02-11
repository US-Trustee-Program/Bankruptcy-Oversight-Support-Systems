#!/usr/bin/env bash
#
# Compare a current Snyk Code SARIF against a baseline text file.
# The baseline is a plain text file with one fingerprint per line (comments
# and blank lines are ignored).
#
# Exits 0 if no new findings, 1 if new findings detected, 2 on script error.
#
# Usage: snyk-baseline-compare.sh <current-sarif> <baseline-txt>
#
set -euo pipefail

CURRENT="${1:-}"
BASELINE="${2:-}"

if [[ -z "$CURRENT" || -z "$BASELINE" ]]; then
    echo "Usage: snyk-baseline-compare.sh <current-sarif> <baseline-txt>" >&2
    exit 2
fi

if [[ ! -f "$CURRENT" ]]; then
    echo "Error: Current SARIF not found: $CURRENT" >&2
    exit 2
fi

if [[ ! -f "$BASELINE" ]]; then
    echo "Warning: Baseline file not found: $BASELINE" >&2
    echo "All findings will be treated as new." >&2
fi

# Extract sorted fingerprints from a SARIF file.
# Uses Snyk's "1" fingerprint (a code-flow hash that is stable across cosmetic
# changes and consistent between local and CI environments). Falls back to
# ruleId + file path if fingerprints are absent.
extract_sarif_fingerprints() {
    local sarif_file="$1"
    jq -r '
        [.runs[0].results[] // empty] |
        if length == 0 then empty
        else
            .[] |
            if .fingerprints["1"] then
                .fingerprints["1"]
            else
                "\(.ruleId)|\(.locations[0].physicalLocation.artifactLocation.uri // "unknown")"
            end
        end
    ' "$sarif_file" | sort
}

# Read sorted fingerprints from a baseline text file (strips comments and blanks).
read_baseline() {
    local baseline_file="$1"
    if [[ ! -f "$baseline_file" ]]; then
        echo ""
        return
    fi
    grep -v '^#' "$baseline_file" | grep -v '^[[:space:]]*$' | sort
}

current_ids=$(extract_sarif_fingerprints "$CURRENT")
baseline_ids=$(read_baseline "$BASELINE")

if [[ -z "$current_ids" ]]; then
    echo "No findings in current scan."
    exit 0
fi

new_findings=$(comm -23 <(echo "$current_ids") <(echo "$baseline_ids"))

if [[ -z "$new_findings" ]]; then
    echo "No new findings — all match baseline."
    exit 0
else
    count=$(echo "$new_findings" | wc -l | tr -d ' ')
    echo "Found $count new finding(s) not in baseline:"
    echo "$new_findings"
    exit 1
fi
