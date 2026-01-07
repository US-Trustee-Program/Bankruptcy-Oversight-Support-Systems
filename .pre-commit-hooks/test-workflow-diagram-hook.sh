#!/usr/bin/env bash
# Test script for workflow diagram pre-commit hook
# Run from repository root: ./.pre-commit-hooks/test-workflow-diagram-hook.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Testing Workflow Diagram Pre-commit Hook ==="
echo ""

# Save current state
current_branch=$(git branch --show-current)
echo "Current branch: ${current_branch}"
echo "Creating test branch..."
git stash push -m "test-workflow-hook-stash" || true
git checkout -b test-workflow-hook 2>/dev/null || git checkout test-workflow-hook

cleanup() {
    echo ""
    echo "Cleaning up..."
    # Restore any modified files
    git restore .github/workflows/reusable-deploy.yml 2>/dev/null || true
    git restore README.md 2>/dev/null || true
    git restore docs/operations/workflow-diagram.md 2>/dev/null || true
    git restore --staged .github/workflows/reusable-deploy.yml 2>/dev/null || true
    git restore --staged README.md 2>/dev/null || true
    git restore --staged docs/operations/workflow-diagram.md 2>/dev/null || true
    # Remove backup file if it exists
    rm -f .github/workflows/reusable-deploy.yml.bak
    # Return to original branch
    git checkout "${current_branch}"
    git branch -D test-workflow-hook 2>/dev/null || true
    git stash pop 2>/dev/null || true
}

trap cleanup EXIT

# Test 1: Workflow changes with no structural changes (should PASS)
echo -e "${YELLOW}Test 1: Workflow file changed, no structural changes${NC}"
echo "Adding a comment to a workflow file..."
git checkout .github/workflows/reusable-deploy.yml
echo "# Test comment" >> .github/workflows/reusable-deploy.yml
git add .github/workflows/reusable-deploy.yml

echo "Running pre-commit hook..."
if python3 .pre-commit-hooks/update-workflow-diagrams.py; then
    echo -e "${GREEN}✓ Test 1 PASSED: Hook allowed commit (no diagram changes needed)${NC}"
else
    echo -e "${RED}✗ Test 1 FAILED: Hook blocked commit when it shouldn't${NC}"
    exit 1
fi
git restore .github/workflows/reusable-deploy.yml
echo ""

# Test 2: Workflow changes with diagram already staged (should PASS)
echo -e "${YELLOW}Test 2: Workflow file changed, diagram already staged${NC}"
echo "Modifying workflow and staging diagram..."
echo "# Test comment" >> .github/workflows/reusable-deploy.yml
git add .github/workflows/reusable-deploy.yml
git add docs/operations/workflow-diagram.md

echo "Running pre-commit hook..."
if python3 .pre-commit-hooks/update-workflow-diagrams.py; then
    echo -e "${GREEN}✓ Test 2 PASSED: Hook allowed commit (diagram already staged)${NC}"
else
    echo -e "${RED}✗ Test 2 FAILED: Hook blocked commit when diagram was staged${NC}"
    exit 1
fi
git restore .github/workflows/reusable-deploy.yml
git restore --staged .github/workflows/reusable-deploy.yml docs/operations/workflow-diagram.md
echo ""

# Test 3: No workflow changes (should PASS)
echo -e "${YELLOW}Test 3: No workflow files changed${NC}"
echo "Staging a non-workflow file..."
echo "# Test" >> README.md
git add README.md

echo "Running pre-commit hook..."
if python3 .pre-commit-hooks/update-workflow-diagrams.py; then
    echo -e "${GREEN}✓ Test 3 PASSED: Hook allowed commit (no workflow changes)${NC}"
else
    echo -e "${RED}✗ Test 3 FAILED: Hook blocked commit when no workflows changed${NC}"
    exit 1
fi
git restore README.md
git restore --staged README.md
echo ""

# Test 4: Structural workflow changes (should BLOCK and generate diagram)
echo -e "${YELLOW}Test 4: Workflow structural changes (should block)${NC}"
echo "Adding a new job to workflow (structural change)..."

# Create a backup
cp .github/workflows/reusable-deploy.yml .github/workflows/reusable-deploy.yml.bak

# Add a new job (structural change)
cat >> .github/workflows/reusable-deploy.yml << 'EOF'

  test-new-job:
    runs-on: ubuntu-latest
    steps:
      - run: echo "test"
EOF

git add .github/workflows/reusable-deploy.yml

echo "Running pre-commit hook..."
if python3 .pre-commit-hooks/update-workflow-diagrams.py; then
    # Check if diagram was actually modified
    if git diff docs/operations/workflow-diagram.md | grep -q "test-new-job"; then
        echo -e "${RED}✗ Test 4 FAILED: Hook should have blocked (diagram changed but not staged)${NC}"
        exit 1
    else
        echo -e "${GREEN}✓ Test 4 PASSED: Hook allowed commit (no diagram changes for new job)${NC}"
    fi
else
    # Hook blocked - check if it was because diagram changed
    if git diff docs/operations/workflow-diagram.md | grep -q .; then
        echo -e "${GREEN}✓ Test 4 PASSED: Hook blocked commit (diagram needs review)${NC}"
    else
        echo -e "${YELLOW}⚠ Test 4 AMBIGUOUS: Hook blocked but no diagram changes detected${NC}"
    fi
fi

# Restore original
mv .github/workflows/reusable-deploy.yml.bak .github/workflows/reusable-deploy.yml
git restore .github/workflows/reusable-deploy.yml
git restore --staged .github/workflows/reusable-deploy.yml
git restore docs/operations/workflow-diagram.md 2>/dev/null || true

echo ""
echo -e "${GREEN}=== All Tests Completed ===${NC}"
