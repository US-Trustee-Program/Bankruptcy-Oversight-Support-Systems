#!/usr/bin/env bash
# Runbook: Create or update federated credential and scoped role for sub-security-scan.yml
#
# Purpose: Eliminate the long-lived AZURE_CREDENTIALS secret from the security scan workflow
#          by replacing it with OIDC Workload Identity Federation. The new credential grants
#          Storage Blob Data Contributor only on the security scan storage account — no broader
#          subscription or resource group access.
#
# The subject claim uses a dedicated GitHub environment ("security-scan") so the credential
# is scoped to this workflow and works from any branch. The subject format is:
#   repo:ORG/REPO:environment:security-scan
#
# Prerequisites:
#   - az CLI logged in as an Entra ID admin (can create app registrations)
#   - The security scan storage account already exists
#   - jq installed
#   - A "security-scan" environment created in the GitHub repository settings
#
# Re-running this script with EXISTING_APP_ID set will update the federated credential
# subject in place without recreating the app registration or role assignment.

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration — update these before running
# ---------------------------------------------------------------------------
STORAGE_ACCOUNT_NAME="${AZ_SECURITY_SCAN_STORAGE_NAME:?Set AZ_SECURITY_SCAN_STORAGE_NAME}"
RESOURCE_GROUP="${AZ_SECURITY_SCAN_RG:?Set AZ_SECURITY_SCAN_RG}"
GITHUB_ORG="US-Trustee-Program"
GITHUB_REPO="Bankruptcy-Oversight-Support-Systems"
GITHUB_ENVIRONMENT="security-scan"
APP_NAME="cams-security-scan-oidc"
CREDENTIAL_NAME="gha-security-scan"
# Set to an existing app (client) ID to update rather than create. Leave blank to create new.
EXISTING_APP_ID="${EXISTING_APP_ID:-}"
# ---------------------------------------------------------------------------

SUBJECT="repo:${GITHUB_ORG}/${GITHUB_REPO}:environment:${GITHUB_ENVIRONMENT}"

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

if [[ -n "$EXISTING_APP_ID" ]]; then
  APP_ID="$EXISTING_APP_ID"
  echo "==> Using existing app registration: $APP_ID"

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
    echo "    No existing credential named '${CREDENTIAL_NAME}' found — creating..."
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
else
  echo "==> Creating app registration: $APP_NAME"
  APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
  echo "    App (client) ID: $APP_ID"

  echo "==> Creating service principal for app..."
  SP_ID=$(az ad sp create --id "$APP_ID" --query id -o tsv)
  echo "    Service principal object ID: $SP_ID"

  echo "==> Adding federated identity credential..."
  az ad app federated-credential create \
    --id "$APP_ID" \
    --parameters "{
      \"name\": \"${CREDENTIAL_NAME}\",
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
fi

echo ""
echo "==> Done."
if [[ -z "$EXISTING_APP_ID" ]]; then
  echo "    Add the following as GitHub Actions repository variables (not secrets):"
  echo "    AZ_SECURITY_SCAN_CLIENT_ID = $APP_ID"
  echo "    AZ_TENANT_ID               = $TENANT_ID"
  echo "    AZ_SUBSCRIPTION_ID         = $SUBSCRIPTION_ID"
fi
