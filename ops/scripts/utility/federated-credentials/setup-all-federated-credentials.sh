#!/usr/bin/env bash
# Provision all OIDC federated credentials for GitHub Actions workflows.
#
# This script runs each individual setup-*-federated-credential.sh script in
# sequence. Each script creates one Azure app registration with one or more
# federated credentials and scoped RBAC — see each script for details.
#
# Usage:
#   TARGET=main ./setup-all-federated-credentials.sh    # provision main only
#   TARGET=branch ./setup-all-federated-credentials.sh  # provision branch only
#   ./setup-all-federated-credentials.sh                # provision both (default)
#
# Override the GitHub org/repo defaults if needed:
#   GITHUB_ORG=MyOrg GITHUB_REPO=MyRepo ./setup-all-federated-credentials.sh
#
# Prerequisites:
#   - az CLI logged in as an Entra ID admin
#   - AZ_SECURITY_SCAN_STORAGE_NAME and AZ_SECURITY_SCAN_RG set in environment
#     (required by setup-security-scan-federated-credential.sh only)
#
# This script is idempotent — re-running will update existing resources rather
# than creating duplicates.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

run_script() {
  local script="$1"
  echo ""
  echo "###################################################################"
  echo "  Running: $script"
  echo "###################################################################"
  TARGET="${TARGET:-all}" "$SCRIPT_DIR/$script"
}

# Every setup-*-federated-credential.sh script in this directory is run.
# Adding a new script here is sufficient to have it provisioned — nothing
# else needs to be updated.
for script_path in "$SCRIPT_DIR"/setup-*-federated-credential.sh; do
  run_script "$(basename "$script_path")"
done

echo ""
echo "###################################################################"
echo "  All federated credentials provisioned."
echo "  Next steps:"
echo "  1. Complete cams-4d3t: set repo OIDC subject claim template"
echo "  2. Complete cams-md3h: create GitHub environments"
echo "  3. Set AZ_CLIENT_ID in each GitHub environment with the"
echo "     client ID printed above for that environment's identity"
echo "  4. Set AZ_TENANT_ID and AZ_SUBSCRIPTION_ID as repo-level secrets"
echo "###################################################################"
