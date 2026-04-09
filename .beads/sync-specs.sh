#!/usr/bin/env bash
# Sync spec files to beads issues
# Usage:
#   .beads/sync-specs.sh              # Sync all specs
#   .beads/sync-specs.sh CAMS-362     # Sync specific ticket

set -e

SPECS_DIR=".ustp-cams-fdp/ai/specs"
TICKET_FILTER="${1:-}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔄 Syncing spec files to beads..."

# Check if bd command exists
if ! command -v bd &> /dev/null; then
    echo "❌ bd command not found. Install beads first."
    exit 1
fi

# Check if specs directory exists
if [ ! -d "$SPECS_DIR" ]; then
    echo "⚠️  No specs directory found at $SPECS_DIR"
    exit 0
fi

sync_count=0

# Iterate through spec directories
for spec_dir in "$SPECS_DIR"/*/; do
    [ -d "$spec_dir" ] || continue

    dir_name=$(basename "$spec_dir")

    # Extract ticket number (e.g., CAMS-362 from CAMS-362-downstream-staff-assignment)
    ticket=$(echo "$dir_name" | grep -oE '^[A-Z]+-[0-9]+' || true)

    if [ -z "$ticket" ]; then
        echo "⚠️  Skipping $dir_name (no ticket number found)"
        continue
    fi

    # Filter by ticket if specified
    if [ -n "$TICKET_FILTER" ] && [ "$ticket" != "$TICKET_FILTER" ]; then
        continue
    fi

    # Find corresponding beads issue by label
    issue_id=$(bd search " " --label "$ticket" --json 2>/dev/null | jq -r '.[0].id // empty' || true)

    if [ -z "$issue_id" ]; then
        echo -e "${YELLOW}⚠️  No beads issue found for $ticket${NC}"
        continue
    fi

    echo -e "📋 Syncing $ticket → ${GREEN}$issue_id${NC}"

    # Update spec-id
    bd update "$issue_id" --spec-id="$spec_dir" --quiet || true

    # Update design file if exists
    design_file=$(find "$spec_dir" -maxdepth 1 -name "*.design.md" | head -1)
    if [ -n "$design_file" ] && [ -f "$design_file" ]; then
        echo "  └─ Linking design: $(basename "$design_file")"
        bd update "$issue_id" --design-file="$design_file" --quiet || true
    fi

    # Update acceptance if feature file exists
    feature_file=$(find "$spec_dir" -maxdepth 1 -name "*.feature" | head -1)
    if [ -n "$feature_file" ] && [ -f "$feature_file" ]; then
        echo "  └─ Found feature: $(basename "$feature_file")"
        # Note: We reference it via spec-id, not duplicate content
    fi

    ((sync_count++))
done

if [ $sync_count -eq 0 ]; then
    echo "ℹ️  No specs to sync"
else
    echo -e "${GREEN}✓ Synced $sync_count spec(s)${NC}"
fi
