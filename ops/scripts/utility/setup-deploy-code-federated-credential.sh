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
#
# Override the GitHub org/repo defaults if needed:
#   GITHUB_ORG=MyOrg GITHUB_REPO=MyRepo ./setup-deploy-code-federated-credential.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/utility/_oidc-helpers.sh
source "$SCRIPT_DIR/_oidc-helpers.sh"

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
  APP_ID=$(lookup_or_create_app "$APP_NAME")

  echo "==> Looking up service principal for app..."
  local _SP_ID
  _SP_ID=$(lookup_or_create_sp "$APP_ID")

  echo "==> Updating federated identity credential..."
  upsert_federated_credential "$APP_ID" "$CREDENTIAL_NAME" "$SUBJECT"

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
  echo "==> WARNING: Role assignments have NOT been configured for this identity."
  echo "    See TODO comments above. Complete role assignments before using this identity in production."

  set_github_environment_secret "$GITHUB_ENVIRONMENT" "AZ_CLIENT_ID" "$APP_ID"

  echo ""
  echo "==> Done: $APP_NAME"
  echo "    AZ_CLIENT_ID in environment '$GITHUB_ENVIRONMENT' = $APP_ID"
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
