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

set -euo pipefail

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
GITHUB_ORG="US-Trustee-Program"
GITHUB_REPO="Bankruptcy-Oversight-Support-Systems"
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
APP_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv)
if [[ -z "$APP_ID" ]]; then
  echo "    Not found — creating..."
  APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
  echo "    Created app (client) ID: $APP_ID"
else
  echo "    Found existing app (client) ID: $APP_ID"
fi

echo "==> Looking up service principal for app..."
SP_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv 2>/dev/null || true)
if [[ -z "$SP_ID" ]]; then
  echo "    Not found — creating..."
  SP_ID=$(az ad sp create --id "$APP_ID" --query id -o tsv)
  echo "    Created service principal object ID: $SP_ID"
else
  echo "    Found existing service principal object ID: $SP_ID"
fi

echo "==> Updating federated identity credential..."
CREDENTIAL_ID=$(az ad app federated-credential list \
  --id "$APP_ID" \
  --query "[?name=='${CREDENTIAL_NAME}'].id" -o tsv)

if [[ -n "$CREDENTIAL_ID" ]]; then
  az ad app federated-credential update \
    --id "$APP_ID" \
    --federated-credential-id "$CREDENTIAL_ID" \
    --parameters "{
      \"name\": \"${CREDENTIAL_NAME}\",
      \"issuer\": \"https://token.actions.githubusercontent.com\",
      \"subject\": \"${SUBJECT}\",
      \"audiences\": [\"api://AzureADTokenExchange\"]
    }"
  echo "    Federated credential updated (subject: $SUBJECT)"
else
  az ad app federated-credential create \
    --id "$APP_ID" \
    --parameters "{
      \"name\": \"${CREDENTIAL_NAME}\",
      \"issuer\": \"https://token.actions.githubusercontent.com\",
      \"subject\": \"${SUBJECT}\",
      \"audiences\": [\"api://AzureADTokenExchange\"]
    }"
  echo "    Federated credential created (subject: $SUBJECT)"
fi

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
