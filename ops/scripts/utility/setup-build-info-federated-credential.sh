#!/usr/bin/env bash
# Runbook: Create or update federated credentials for build-info-main and build-info-branch
#
# Purpose: Provision Azure app registrations and OIDC federated credentials for
#          the "build-info-main" and "build-info-branch" GitHub environments.
#          These identities are used by the "Continuous Deployment" workflow AND
#          the "Pull Request E2E Validation" workflow (via reusable-build-info.yml)
#          to detect the target environment and read build configuration.
#
# The subject claim includes repo, workflow, and environment per the repo OIDC
# customization template (include_claim_keys: ["repo", "workflow", "environment"]).
# Subject formats:
#   repo:ORG/REPO:workflow:Continuous Deployment:environment:build-info-main
#   repo:ORG/REPO:workflow:Continuous Deployment:environment:build-info-branch
#   repo:ORG/REPO:workflow:Pull Request E2E Validation:environment:build-info-branch
#
# NOTE: build-info-branch has TWO federated credentials because it is called from
#       both "Continuous Deployment" and "Pull Request E2E Validation". Both
#       credentials are provisioned on the single cams-build-info-branch-oidc app
#       registration. build-info-main is only called from "Continuous Deployment".
#
# Prerequisites:
#   - az CLI logged in as an Entra ID admin (can create app registrations and role assignments)
#   - The Azure subscription already exists
#
# This script is idempotent — re-running it will update existing resources in place
# rather than creating duplicates.
#
# Run with TARGET=main or TARGET=branch to provision one identity at a time:
#   TARGET=main ./setup-build-info-federated-credential.sh
#   TARGET=branch ./setup-build-info-federated-credential.sh
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

echo "==> Looking up subscription and tenant..."
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "    Subscription: $SUBSCRIPTION_ID"
echo "    Tenant:       $TENANT_ID"

provision_main() {
  local APP_NAME="cams-build-info-main-oidc"

  echo ""
  echo "==================================================================="
  echo "  Provisioning $APP_NAME"
  echo "==================================================================="

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

  upsert_federated_credential \
    "$APP_ID" \
    "gha-build-info-main" \
    "repo:${GITHUB_ORG}/${GITHUB_REPO}:workflow:Continuous Deployment:environment:build-info-main"

  # ---------------------------------------------------------------------------
  # TODO: Add role assignments
  #
  # This identity detects the target environment and reads build configuration.
  # It likely needs:
  #   - Reader on the environment resource group to check whether Azure resources
  #     exist (used to determine deploy vs. create paths)
  #   - Key Vault Secrets User on specific secrets in the main Key Vault
  #     (e.g., environment identifiers, slot names, resource group names)
  #
  # Example (Reader on a resource group):
  #   RESOURCE_GROUP="rg-ustp-cams-main"
  #   RG_SCOPE=$(az group show --name "$RESOURCE_GROUP" --query id -o tsv)
  #   az role assignment create \
  #     --assignee-object-id "$SP_ID" \
  #     --assignee-principal-type ServicePrincipal \
  #     --role "Reader" \
  #     --scope "$RG_SCOPE" \
  #     --output none
  # ---------------------------------------------------------------------------

  echo ""
  echo "==> Done: $APP_NAME"
  echo "    AZ_BUILD_INFO_MAIN_CLIENT_ID = $APP_ID"
}

provision_branch() {
  local APP_NAME="cams-build-info-branch-oidc"

  echo ""
  echo "==================================================================="
  echo "  Provisioning $APP_NAME (two federated credentials)"
  echo "==================================================================="

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

  # Credential 1: called from Continuous Deployment
  upsert_federated_credential \
    "$APP_ID" \
    "gha-build-info-branch-cd" \
    "repo:${GITHUB_ORG}/${GITHUB_REPO}:workflow:Continuous Deployment:environment:build-info-branch"

  # Credential 2: called from Pull Request E2E Validation
  upsert_federated_credential \
    "$APP_ID" \
    "gha-build-info-branch-pr" \
    "repo:${GITHUB_ORG}/${GITHUB_REPO}:workflow:Pull Request E2E Validation:environment:build-info-branch"

  # ---------------------------------------------------------------------------
  # TODO: Add role assignments
  #
  # Same as build-info-main but scoped to the branch/develop Key Vault and
  # resource groups. Needs Reader access to check if branch resources exist,
  # plus Key Vault Secrets User on relevant branch vault secrets.
  # ---------------------------------------------------------------------------

  echo ""
  echo "==> Done: $APP_NAME"
  echo "    AZ_BUILD_INFO_BRANCH_CLIENT_ID = $APP_ID"
}

case "$TARGET" in
  main)
    provision_main
    ;;
  branch)
    provision_branch
    ;;
  all)
    provision_main
    provision_branch
    ;;
  *)
    echo "ERROR: Unknown TARGET='$TARGET'. Use main, branch, or omit for all." >&2
    exit 1
    ;;
esac

echo ""
echo "==> Summary"
echo "    AZ_TENANT_ID               = $TENANT_ID"
echo "    AZ_SUBSCRIPTION_ID         = $SUBSCRIPTION_ID"
