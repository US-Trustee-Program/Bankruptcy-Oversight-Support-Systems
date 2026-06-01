#!/usr/bin/env bash
# Runbook: Create or update federated credentials for e2e-main and e2e-branch
#
# Purpose: Provision Azure app registrations and OIDC federated credentials for
#          the "e2e-main" and "e2e-branch" GitHub environments. These identities
#          are used by reusable-e2e.yml, which is called from two top-level
#          workflows:
#
#            1. "Stand Alone E2E Test Runs"  — manual/scheduled standalone runs
#            2. "Continuous Deployment"      — post-deploy gate in the CD pipeline
#
#          The OIDC subject claim resolves to the top-level initiating workflow,
#          so each app registration must carry two federated credentials — one
#          per caller — to allow both callers to authenticate.
#
# The subject claim includes repo, workflow, and environment per the repo OIDC
# customization template (include_claim_keys: ["repo", "workflow", "environment"]).
# Subject formats:
#   repo:ORG/REPO:workflow:Stand Alone E2E Test Runs:environment:e2e-main
#   repo:ORG/REPO:workflow:Continuous Deployment:environment:e2e-main
#   repo:ORG/REPO:workflow:Stand Alone E2E Test Runs:environment:e2e-branch
#   repo:ORG/REPO:workflow:Continuous Deployment:environment:e2e-branch
#
# Prerequisites:
#   - az CLI logged in as an Entra ID admin (can create app registrations and role assignments)
#   - The Azure subscription already exists
#
# This script is idempotent — re-running it will update existing resources in place
# rather than creating duplicates.
#
# Run with TARGET=main or TARGET=branch to provision one identity at a time:
#   TARGET=main ./setup-e2e-federated-credential.sh
#   TARGET=branch ./setup-e2e-federated-credential.sh
# Omit TARGET to provision both (default).

set -euo pipefail

GITHUB_ORG="US-Trustee-Program"
GITHUB_REPO="Bankruptcy-Oversight-Support-Systems"
TARGET="${TARGET:-all}"

# ---------------------------------------------------------------------------
# Helper: add or update a single federated credential on an existing app
# ---------------------------------------------------------------------------
upsert_federated_credential() {
  local APP_ID="$1"
  local CREDENTIAL_NAME="$2"
  local SUBJECT="$3"

  local CREDENTIAL_ID
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
    echo "    Federated credential '$CREDENTIAL_NAME' updated (subject: $SUBJECT)"
  else
    az ad app federated-credential create \
      --id "$APP_ID" \
      --parameters "{
        \"name\": \"${CREDENTIAL_NAME}\",
        \"issuer\": \"https://token.actions.githubusercontent.com\",
        \"subject\": \"${SUBJECT}\",
        \"audiences\": [\"api://AzureADTokenExchange\"]
      }"
    echo "    Federated credential '$CREDENTIAL_NAME' created (subject: $SUBJECT)"
  fi
}

provision_identity() {
  local APP_NAME="$1"
  local GITHUB_ENVIRONMENT="$2"

  echo ""
  echo "==================================================================="
  echo "  Provisioning $APP_NAME"
  echo "==================================================================="

  echo "==> Looking up subscription and tenant..."
  local SUBSCRIPTION_ID TENANT_ID
  SUBSCRIPTION_ID=$(az account show --query id -o tsv)
  TENANT_ID=$(az account show --query tenantId -o tsv)
  echo "    Subscription: $SUBSCRIPTION_ID"
  echo "    Tenant:       $TENANT_ID"

  echo "==> Looking up app registration: $APP_NAME"
  local APP_ID
  APP_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv)
  if [[ -z "$APP_ID" ]]; then
    echo "    Not found — creating..."
    APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
    echo "    Created app (client) ID: $APP_ID"
  else
    echo "    Found existing app (client) ID: $APP_ID"
  fi

  echo "==> Looking up service principal for app..."
  local SP_ID
  SP_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv 2>/dev/null || true)
  if [[ -z "$SP_ID" ]]; then
    echo "    Not found — creating..."
    SP_ID=$(az ad sp create --id "$APP_ID" --query id -o tsv)
    echo "    Created service principal object ID: $SP_ID"
  else
    echo "    Found existing service principal object ID: $SP_ID"
  fi

  echo "==> Updating federated identity credentials (two callers)..."

  # Credential 1: called from "Stand Alone E2E Test Runs"
  upsert_federated_credential \
    "$APP_ID" \
    "gha-e2e-${GITHUB_ENVIRONMENT##e2e-}-standalone" \
    "repo:${GITHUB_ORG}/${GITHUB_REPO}:workflow:Stand Alone E2E Test Runs:environment:${GITHUB_ENVIRONMENT}"

  # Credential 2: called from "Continuous Deployment" (post-deploy gate)
  upsert_federated_credential \
    "$APP_ID" \
    "gha-e2e-${GITHUB_ENVIRONMENT##e2e-}-cd" \
    "repo:${GITHUB_ORG}/${GITHUB_REPO}:workflow:Continuous Deployment:environment:${GITHUB_ENVIRONMENT}"

  # ---------------------------------------------------------------------------
  # TODO: Add role assignments
  #
  # This identity runs end-to-end tests against the deployed application.
  # It likely needs:
  #   - Reader on the environment resource group (to discover App Service URLs
  #     and other resource details needed to configure the test run)
  #   - Key Vault Secrets User on specific secrets in the environment Key Vault
  #     (e.g., application URL, test credentials, Okta configuration)
  #
  # It does NOT need write access — E2E tests read and interact with the app
  # via HTTP, not via the Azure control plane.
  #
  # Example (Reader on a resource group):
  #   RESOURCE_GROUP="rg-ustp-cams-<env>"
  #   RG_SCOPE=$(az group show --name "$RESOURCE_GROUP" --query id -o tsv)
  #   az role assignment create \
  #     --assignee-object-id "$SP_ID" \
  #     --assignee-principal-type ServicePrincipal \
  #     --role "Reader" \
  #     --scope "$RG_SCOPE" \
  #     --output none
  # ---------------------------------------------------------------------------

  local SECRET_VAR_NAME
  if [[ "$GITHUB_ENVIRONMENT" == "e2e-main" ]]; then
    SECRET_VAR_NAME="AZ_E2E_MAIN_CLIENT_ID" # pragma: allowlist secret
  else
    SECRET_VAR_NAME="AZ_E2E_BRANCH_CLIENT_ID" # pragma: allowlist secret
  fi

  echo ""
  echo "==> Done: $APP_NAME"
  echo "    Set GitHub Actions secret/variable:"
  echo "    ${SECRET_VAR_NAME} = $APP_ID"
  echo "    AZ_TENANT_ID               = $TENANT_ID"
  echo "    AZ_SUBSCRIPTION_ID         = $SUBSCRIPTION_ID"
}

case "$TARGET" in
  main)
    provision_identity "cams-e2e-main-oidc" "e2e-main"
    ;;
  branch)
    provision_identity "cams-e2e-branch-oidc" "e2e-branch"
    ;;
  all)
    provision_identity "cams-e2e-main-oidc" "e2e-main"
    provision_identity "cams-e2e-branch-oidc" "e2e-branch"
    ;;
  *)
    echo "ERROR: Unknown TARGET='$TARGET'. Use main, branch, or omit for all." >&2
    exit 1
    ;;
esac
