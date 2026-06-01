#!/usr/bin/env bash
# Runbook: Create or update federated credentials for deploy-code-main and deploy-code-branch
#
# Purpose: Provision Azure app registrations and OIDC federated credentials for
#          the "deploy-code-main" and "deploy-code-branch" GitHub environments.
#          These identities are used by the "Continuous Deployment" workflow (via
#          reusable-deploy-code.yml) to deploy application code to Azure App
#          Service and Function App instances.
#
# The subject claim includes repo, workflow, and environment per the repo OIDC
# customization template (include_claim_keys: ["repo", "workflow", "environment"]).
# Subject formats:
#   repo:ORG/REPO:workflow:Continuous Deployment:environment:deploy-code-main
#   repo:ORG/REPO:workflow:Continuous Deployment:environment:deploy-code-branch
#
# Prerequisites:
#   - az CLI logged in as an Entra ID admin (can create app registrations and role assignments)
#   - The Azure subscription already exists
#
# This script is idempotent — re-running it will update existing resources in place
# rather than creating duplicates.
#
# Run with TARGET=main or TARGET=branch to provision one identity at a time:
#   TARGET=main ./setup-deploy-code-federated-credential.sh
#   TARGET=branch ./setup-deploy-code-federated-credential.sh
# Omit TARGET to provision both (default).

set -euo pipefail

GITHUB_ORG="US-Trustee-Program"
GITHUB_REPO="Bankruptcy-Oversight-Support-Systems"
GITHUB_WORKFLOW="Continuous Deployment"
TARGET="${TARGET:-all}"

provision_identity() {
  local APP_NAME="$1"
  local CREDENTIAL_NAME="$2"
  local GITHUB_ENVIRONMENT="$3"
  local SUBJECT="repo:${GITHUB_ORG}/${GITHUB_REPO}:workflow:${GITHUB_WORKFLOW}:environment:${GITHUB_ENVIRONMENT}"

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

  echo "==> Updating federated identity credential..."
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
  # This identity deploys application code to App Service and Function Apps.
  # It likely needs:
  #   - Contributor on the environment resource group(s) (or Website Contributor
  #     scoped to the specific App Service / Function App resources) to push
  #     deployment ZIP packages and update app settings
  #   - Key Vault Secrets User on specific secrets in the environment Key Vault
  #     (e.g., app service names, deployment slot names, resource group names)
  #
  # Example (Contributor on a resource group):
  #   RESOURCE_GROUP="rg-ustp-cams-<env>"
  #   RG_SCOPE=$(az group show --name "$RESOURCE_GROUP" --query id -o tsv)
  #   az role assignment create \
  #     --assignee-object-id "$SP_ID" \
  #     --assignee-principal-type ServicePrincipal \
  #     --role "Contributor" \
  #     --scope "$RG_SCOPE" \
  #     --output none
  #
  # Add per-secret Key Vault Secrets User assignments once the KV secret list
  # for each environment is finalized in the Key Vault migration task.
  # ---------------------------------------------------------------------------

  echo ""
  echo "==> Done: $APP_NAME"
  echo "    Set GitHub Actions secret/variable:"
  echo "    Client ID = $APP_ID"
  echo "    AZ_TENANT_ID               = $TENANT_ID"
  echo "    AZ_SUBSCRIPTION_ID         = $SUBSCRIPTION_ID"
}

case "$TARGET" in
  main)
    provision_identity "cams-deploy-code-main-oidc" "gha-deploy-code-main" "deploy-code-main"
    ;;
  branch)
    provision_identity "cams-deploy-code-branch-oidc" "gha-deploy-code-branch" "deploy-code-branch"
    ;;
  all)
    provision_identity "cams-deploy-code-main-oidc" "gha-deploy-code-main" "deploy-code-main"
    provision_identity "cams-deploy-code-branch-oidc" "gha-deploy-code-branch" "deploy-code-branch"
    ;;
  *)
    echo "ERROR: Unknown TARGET='$TARGET'. Use main, branch, or omit for all." >&2
    exit 1
    ;;
esac
