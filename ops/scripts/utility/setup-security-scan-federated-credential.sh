#!/usr/bin/env bash
# Runbook: Create or update federated credential and scoped roles for sub-security-scan.yml
#
# Purpose: Eliminate the long-lived AZURE_CREDENTIALS secret from the security scan workflow
#          by replacing it with OIDC Workload Identity Federation. The identity is granted:
#            - Storage Blob Data Contributor on the security scan storage account
#            - Key Vault Secrets User on each individual secret it reads from kv-ustp-cams
#
# The subject claim includes repo, workflow, and environment per the repo OIDC customization
# template (include_claim_keys: ["repo", "workflow", "environment"]). The subject format is:
#   repo:ORG/REPO:workflow:CALLER-WORKFLOW-NAME:environment:security-scan
#
# Prerequisites:
#   - az CLI logged in as an Entra ID admin (can create app registrations and role assignments)
#   - The security scan storage account already exists
#   - kv-ustp-cams already exists and contains the secrets listed in KV_SECRETS
#
# This script is idempotent — re-running it will update existing resources in place
# rather than creating duplicates.
#
# Override the GitHub org/repo defaults if needed:
#   GITHUB_ORG=MyOrg GITHUB_REPO=MyRepo ./setup-security-scan-federated-credential.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/utility/_oidc-helpers.sh
source "$SCRIPT_DIR/_oidc-helpers.sh"

# ---------------------------------------------------------------------------
# Configuration — update these before running
# ---------------------------------------------------------------------------
STORAGE_ACCOUNT_NAME="${AZ_SECURITY_SCAN_STORAGE_NAME:?Set AZ_SECURITY_SCAN_STORAGE_NAME}"
RESOURCE_GROUP="${AZ_SECURITY_SCAN_RG:?Set AZ_SECURITY_SCAN_RG}"
KV_NAME="kv-ustp-cams"
KV_RESOURCE_GROUP="${AZ_KV_RG:-$RESOURCE_GROUP}"
# Secrets this workflow reads from the vault — must exist before running
KV_SECRETS=("SNYK-OAUTH-CLIENT-ID" "SNYK-OAUTH-CLIENT-SECRET" "AZ-SECURITY-SCAN-STORAGE-NAME")
KV_SECRETS_USER_ROLE="4633458b-17de-408a-b874-0445c86b69e6" # Key Vault Secrets User
GITHUB_WORKFLOW="Continuous Deployment"
GITHUB_ENVIRONMENT="security-scan"
APP_NAME="cams-security-scan-oidc"
CREDENTIAL_NAME="gha-security-scan"
# ---------------------------------------------------------------------------

SUBJECT="repo:${GITHUB_ORG}/${GITHUB_REPO}:workflow:${GITHUB_WORKFLOW}:environment:${GITHUB_ENVIRONMENT}"

echo "==> Looking up subscription and tenant..."
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "    Subscription: $SUBSCRIPTION_ID"
echo "    Tenant:       $TENANT_ID"

echo "==> Looking up storage account resource ID..."
STORAGE_ID=$(az storage account show \
  --name "$STORAGE_ACCOUNT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query id -o tsv)
echo "    Storage ID: $STORAGE_ID"

echo "==> Looking up app registration: $APP_NAME"
APP_ID=$(lookup_or_create_app "$APP_NAME")

echo "==> Looking up service principal for app..."
SP_ID=$(lookup_or_create_sp "$APP_ID")

echo "==> Updating federated identity credential..."
upsert_federated_credential "$APP_ID" "$CREDENTIAL_NAME" "$SUBJECT"

echo "==> Checking Storage Blob Data Contributor role assignment..."
EXISTING_ROLE=$(az role assignment list \
  --assignee "$SP_ID" \
  --role "Storage Blob Data Contributor" \
  --scope "$STORAGE_ID" \
  --query "[0].id" -o tsv 2>/dev/null || true)

if [[ -z "$EXISTING_ROLE" ]]; then
  az role assignment create \
    --assignee-object-id "$SP_ID" \
    --assignee-principal-type ServicePrincipal \
    --role "Storage Blob Data Contributor" \
    --scope "$STORAGE_ID" \
    --output none
  echo "    Role assigned."
else
  echo "    Role already assigned — skipping."
fi

echo "==> Checking Key Vault Secrets User role assignments (per-secret)..."
for SECRET_NAME in "${KV_SECRETS[@]}"; do
  SECRET_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${KV_RESOURCE_GROUP}/providers/Microsoft.KeyVault/vaults/${KV_NAME}/secrets/${SECRET_NAME}"
  EXISTING_SECRET_ROLE=$(az role assignment list \
    --assignee "$SP_ID" \
    --role "$KV_SECRETS_USER_ROLE" \
    --scope "$SECRET_SCOPE" \
    --query "[0].id" -o tsv 2>/dev/null || true)

  if [[ -z "$EXISTING_SECRET_ROLE" ]]; then
    az role assignment create \
      --assignee-object-id "$SP_ID" \
      --assignee-principal-type ServicePrincipal \
      --role "$KV_SECRETS_USER_ROLE" \
      --scope "$SECRET_SCOPE" \
      --output none
    echo "    Key Vault Secrets User assigned on ${KV_NAME}/secrets/${SECRET_NAME}."
  else
    echo "    Key Vault Secrets User already assigned on ${KV_NAME}/secrets/${SECRET_NAME} — skipping."
  fi
done

echo ""
echo "==> Done."
echo "    Ensure the following are set as GitHub Actions repository secrets:"
echo "    AZ_SECURITY_SCAN_CLIENT_ID = $APP_ID"
echo "    AZ_TENANT_ID               = $TENANT_ID"
echo "    AZ_SUBSCRIPTION_ID         = $SUBSCRIPTION_ID"
