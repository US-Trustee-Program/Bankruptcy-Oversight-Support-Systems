#!/usr/bin/env bash
# Runbook: Create or update federated credential for azure-remove-branch.yml
#
# Purpose: Provision the Azure app registration and OIDC federated credential
#          for the "remove-branch" GitHub environment. This identity is used by
#          the "Clean up Flexion Azure Resources" workflow to delete Azure resource
#          groups created for non-production branches.
#
# The subject claim includes repo, workflow, and environment per the repo OIDC
# customization template (include_claim_keys: ["repo", "workflow", "environment"]).
# The subject format is:
#   repo:ORG/REPO:workflow:CALLER-WORKFLOW-NAME:environment:remove-branch
#
# Prerequisites:
#   - az CLI logged in as an Entra ID admin (can create app registrations and role assignments)
#   - The Azure subscription already exists
#
# This script is idempotent — re-running it will update existing resources in place
# rather than creating duplicates.
#
# Override the GitHub org/repo defaults if needed:
#   GITHUB_ORG=MyOrg GITHUB_REPO=MyRepo ./setup-remove-branch-federated-credential.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/utility/_oidc-helpers.sh
source "$SCRIPT_DIR/_oidc-helpers.sh"

# ---------------------------------------------------------------------------
# Configuration — update these before running
# ---------------------------------------------------------------------------
GITHUB_WORKFLOW="Clean up Flexion Azure Resources"
GITHUB_ENVIRONMENT="remove-branch"
APP_NAME="cams-remove-branch-oidc"
CREDENTIAL_NAME="gha-remove-branch"
# ---------------------------------------------------------------------------

SUBJECT="repo:${GITHUB_ORG}/${GITHUB_REPO}:workflow:${GITHUB_WORKFLOW}:environment:${GITHUB_ENVIRONMENT}"

echo "==> Looking up subscription and tenant..."
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "    Subscription: $SUBSCRIPTION_ID"
echo "    Tenant:       $TENANT_ID"

echo "==> Looking up app registration: $APP_NAME"
APP_ID=$(lookup_or_create_app "$APP_NAME")

echo "==> Looking up service principal for app..."
_SP_ID=$(lookup_or_create_sp "$APP_ID")

echo "==> Updating federated identity credential..."
upsert_federated_credential "$APP_ID" "$CREDENTIAL_NAME" "$SUBJECT"

# ---------------------------------------------------------------------------
# TODO: Add role assignments
#
# This workflow deletes Azure resource groups created for non-production branches.
# It likely needs:
#   - Contributor on the subscription (or individual branch resource groups)
#     so it can delete resource groups
#
# Example (Contributor on the subscription):
#   az role assignment create \
#     --assignee-object-id "$SP_ID" \
#     --assignee-principal-type ServicePrincipal \
#     --role "Contributor" \
#     --scope "/subscriptions/${SUBSCRIPTION_ID}" \
#     --output none
#
# Tighten this to resource-group scope once the Key Vault migration defines
# naming conventions for branch resource groups.
# ---------------------------------------------------------------------------

echo ""
echo "==> WARNING: Role assignments have NOT been configured for this identity."
echo "    See TODO comments above. Complete role assignments before using this identity."

set_github_environment_secret "$GITHUB_ENVIRONMENT" "AZ_CLIENT_ID" "$APP_ID"

echo ""
echo "==> Done."
echo "    AZ_CLIENT_ID in environment '$GITHUB_ENVIRONMENT' = $APP_ID"
