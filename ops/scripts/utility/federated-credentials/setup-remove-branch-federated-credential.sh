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
# shellcheck source=ops/scripts/utility/federated-credentials/_oidc-helpers.sh
source "$SCRIPT_DIR/_oidc-helpers.sh"

# ---------------------------------------------------------------------------
# Configuration — update these before running
# ---------------------------------------------------------------------------
GITHUB_WORKFLOW="Clean up Flexion Azure Resources"
GITHUB_ENVIRONMENT="remove-branch"
APP_NAME="cams-remove-branch-oidc"
CREDENTIAL_NAME="gha-remove-branch"
# Resource group that contains the dev/branch Key Vault (kv-ustp-cams-dev)
BRANCH_KV_NAME="kv-ustp-cams-dev"
BRANCH_KV_RG="${AZ_BRANCH_KV_RG:-}"
# Secrets this workflow reads from Key Vault (azure-remove-branch.yml)
KV_SECRETS=(
  "AZ-COSMOS-MONGO-ACCOUNT-NAME"
  "AZ-APP-RG"
  "AZ-NETWORK-RG"
  "AZ-ANALYTICS-RG"
  "AZURE-RG"
)
KV_SECRETS_USER_ROLE="4633458b-17de-408a-b874-0445c86b69e6" # Key Vault Secrets User (built-in role GUID)
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
SP_ID=$(lookup_or_create_sp "$APP_ID")

echo "==> Updating federated identity credential..."
upsert_federated_credential "$APP_ID" "$CREDENTIAL_NAME" "$SUBJECT"

# ---------------------------------------------------------------------------
# Role assignments
#
# Contributor at subscription scope: needed so this identity can:
#   - Call az group list (to discover branch resource groups by tag)
#   - Delete multiple resource groups (app, network, analytics) created per branch
# Resource group names are determined at runtime from tag queries, so we cannot
# pre-scope to individual RGs without knowing them in advance.
#
# Key Vault Secrets User on AZ-COSMOS-MONGO-ACCOUNT-NAME: the clean-up job
# fetches this from kv-ustp-cams-dev since it is not stored as a GitHub secret
# in the remove-branch environment.
# ---------------------------------------------------------------------------
SUBSCRIPTION_SCOPE="/subscriptions/${SUBSCRIPTION_ID}"
echo "==> Checking Contributor role assignment at subscription scope..."
ensure_role_assignment "$SP_ID" "Contributor" "$SUBSCRIPTION_SCOPE"

if [[ -z "$BRANCH_KV_RG" ]]; then
  echo "ERROR: AZ_BRANCH_KV_RG is required to grant Key Vault access." >&2
  exit 1
fi
echo "==> Checking Key Vault Secrets User role assignments on ${BRANCH_KV_NAME} (per-secret)..."
for SECRET_NAME in "${KV_SECRETS[@]}"; do
  SECRET_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${BRANCH_KV_RG}/providers/Microsoft.KeyVault/vaults/${BRANCH_KV_NAME}/secrets/${SECRET_NAME}"
  ensure_role_assignment "$SP_ID" "$KV_SECRETS_USER_ROLE" "$SECRET_SCOPE"
done

set_github_environment_secret "$GITHUB_ENVIRONMENT" "AZ_CLIENT_ID" "$APP_ID"

echo ""
echo "==> Done."
echo "    AZ_CLIENT_ID in environment '$GITHUB_ENVIRONMENT' = $APP_ID"
