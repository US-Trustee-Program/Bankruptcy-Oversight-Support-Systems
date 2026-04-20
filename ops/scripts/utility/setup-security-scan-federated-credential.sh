#!/usr/bin/env bash
# Runbook: Create federated credential and scoped role for sub-security-scan.yml (CAMS-730 / cams-5ln3)
#
# Purpose: Eliminate the long-lived AZURE_CREDENTIALS secret from the security scan workflow
#          by replacing it with OIDC Workload Identity Federation. The new credential grants
#          Storage Blob Data Contributor only on the security scan storage account — no broader
#          subscription or resource group access.
#
# Prerequisites:
#   - az CLI logged in as an Entra ID admin (can create app registrations)
#   - The security scan storage account already exists
#   - jq installed
#
# After this script runs, complete the workflow migration (cams-i4k1):
#   - Replace `creds: ${{ secrets.AZURE_CREDENTIALS }}` in sub-security-scan.yml with:
#       client-id: ${{ vars.AZ_SECURITY_SCAN_CLIENT_ID }}
#       tenant-id: ${{ vars.AZ_TENANT_ID }}
#       subscription-id: ${{ vars.AZ_SUBSCRIPTION_ID }}
#   - Add `permissions: id-token: write` to both scan jobs
#   - Remove AZURE_CREDENTIALS from the workflow_call secrets block
#   - Add the three vars above as GitHub Actions repository variables (not secrets)

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration — update these before running
# ---------------------------------------------------------------------------
STORAGE_ACCOUNT_NAME="${AZ_SECURITY_SCAN_STORAGE_NAME:?Set AZ_SECURITY_SCAN_STORAGE_NAME}"
RESOURCE_GROUP="${AZ_SECURITY_SCAN_RG:?Set AZ_SECURITY_SCAN_RG}"
GITHUB_ORG="US-Trustee-Program"
GITHUB_REPO="Bankruptcy-Oversight-Support-Systems"
# Scope the federated credential to the Main-Gov environment so it only fires
# on runs that target that environment. Leave blank to allow any branch/tag.
GITHUB_ENVIRONMENT="Main-Gov"
APP_NAME="cams-security-scan-oidc"
# ---------------------------------------------------------------------------

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

echo "==> Creating app registration: $APP_NAME"
APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
echo "    App (client) ID: $APP_ID"

echo "==> Creating service principal for app..."
SP_ID=$(az ad sp create --id "$APP_ID" --query id -o tsv)
echo "    Service principal object ID: $SP_ID"

echo "==> Adding federated identity credential (environment: ${GITHUB_ENVIRONMENT:-any})..."
if [[ -n "$GITHUB_ENVIRONMENT" ]]; then
  SUBJECT="repo:${GITHUB_ORG}/${GITHUB_REPO}:environment:${GITHUB_ENVIRONMENT}"
else
  SUBJECT="repo:${GITHUB_ORG}/${GITHUB_REPO}:ref:refs/heads/main"
fi

az ad app federated-credential create \
  --id "$APP_ID" \
  --parameters "{
    \"name\": \"gha-security-scan\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"${SUBJECT}\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }"
echo "    Federated credential created (subject: $SUBJECT)"

echo "==> Assigning Storage Blob Data Contributor scoped to storage account..."
az role assignment create \
  --assignee-object-id "$SP_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" \
  --scope "$STORAGE_ID"
echo "    Role assigned."

echo ""
echo "==> Done. Add the following as GitHub Actions repository variables (not secrets):"
echo "    AZ_SECURITY_SCAN_CLIENT_ID = $APP_ID"
echo "    AZ_TENANT_ID               = $TENANT_ID"
echo "    AZ_SUBSCRIPTION_ID         = $SUBSCRIPTION_ID"
echo ""
echo "    Then complete cams-i4k1: migrate sub-security-scan.yml azure/login to OIDC."
