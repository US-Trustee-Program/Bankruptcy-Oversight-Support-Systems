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

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration — update these before running
# ---------------------------------------------------------------------------
GITHUB_ORG="US-Trustee-Program"
GITHUB_REPO="Bankruptcy-Oversight-Support-Systems"
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

echo ""
echo "==> Done."
echo "    Ensure the following are set as GitHub Actions repository secrets:"
echo "    AZ_REMOVE_BRANCH_CLIENT_ID = $APP_ID"
echo "    AZ_TENANT_ID               = $TENANT_ID"
echo "    AZ_SUBSCRIPTION_ID         = $SUBSCRIPTION_ID"
