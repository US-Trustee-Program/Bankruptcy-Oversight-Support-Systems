#!/bin/bash

# Fixture Harvest Workflow
# Re-syncs committed fixture files from live data sources.
#
# Usage: ./harvest-fixtures.sh [OPTIONS]
#   --reseed    Re-seed MongoDB from DXTR SQL before harvesting (requires DXTR credentials).
#               Default: dump existing e2e MongoDB as-is (faster, no DXTR re-seed needed).
#
# Prerequisites:
#   - .env must exist in test/e2e/ with MONGO_CONNECTION_STRING, COSMOS_DATABASE_NAME,
#     MSSQL_HOST, MSSQL_USER, MSSQL_PASS pointing at the source databases.
#   - COSMOS_DATABASE_NAME must contain 'e2e' (safety check in harvest-mongo.ts).
#
# Output (committed to repo):
#   fixtures/mongo-fixture.json
#   fixtures/sqlserver-fixture.json
#
# Intermediate files (gitignored):
#   fixtures/mongo-harvested.json
#   fixtures/sqlserver-harvested.json

set -e

RESEED=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --reseed)
      RESEED=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--reseed]"
      exit 1
      ;;
  esac
done

export DOTENV_CONFIG_SILENT=true
export DOTENV_QUIET=true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ ! -f ".env" ]; then
  echo -e "${RED}Error: .env file not found in test/e2e/${NC}"
  exit 1
fi

echo "Fixture Harvest Workflow"
echo "========================"
echo ""

# ── Step 1: Harvest MongoDB ───────────────────────────────────────────────────

if [ "$RESEED" = true ]; then
  echo -e "${BLUE}Step 1: Re-seeding MongoDB from DXTR, then harvesting...${NC}"
  # build:common is required before tsx can resolve the backend imports
  (cd ../../ && npm run build:common --silent)
  npx tsx --tsconfig ./tsconfig.seed.json ./scripts/harvest-mongo.ts 2>&1 | grep -v "^\[dotenv"
else
  echo -e "${BLUE}Step 1: Harvesting existing e2e MongoDB (dump-only)...${NC}"
  (cd ../../ && npm run build:common --silent)
  npx tsx --tsconfig ./tsconfig.seed.json ./scripts/harvest-mongo.ts -- --dump-only 2>&1 | grep -v "^\[dotenv"
fi
echo -e "${GREEN}✓ MongoDB harvest complete${NC}"
echo ""

# ── Step 2: Harvest SQL Server ────────────────────────────────────────────────

echo -e "${BLUE}Step 2: Harvesting SQL Server from DXTR...${NC}"
npx tsx ./scripts/harvest-sqlserver.ts 2>&1 | grep -v "^\[dotenv"
echo -e "${GREEN}✓ SQL Server harvest complete${NC}"
echo ""

# ── Step 3: Synthesize committed fixtures ─────────────────────────────────────

echo -e "${BLUE}Step 3: Synthesizing committed fixtures...${NC}"
npx tsx ./scripts/synthesize-fixtures.ts
echo -e "${GREEN}✓ Fixtures synthesized${NC}"
echo ""

# ── Summary ───────────────────────────────────────────────────────────────────

echo "========================"
echo -e "${GREEN}Harvest complete.${NC}"
echo ""
echo "Committed fixtures updated:"
echo "  fixtures/mongo-fixture.json"
echo "  fixtures/sqlserver-fixture.json"
echo ""
echo "Next: commit the fixture files, then run 'npm run e2e' to verify."
echo ""
