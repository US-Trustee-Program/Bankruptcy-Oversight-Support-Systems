#!/usr/bin/env bash
# Runbook: Create or update federated credentials for deploy-main and deploy-branch
#
# Purpose: Provision Azure app registrations and OIDC federated credentials for
#          the "deploy-main" and "deploy-branch" GitHub environments. These
#          identities are used by the "Continuous Deployment" workflow to deploy
#          Bicep infrastructure templates to the main and branch Azure environments.
#
# The subject claim includes repo, workflow, and environment per the repo OIDC
# customization template (include_claim_keys: ["repo", "workflow", "environment"]).
# Subject formats:
#   repo:ORG/REPO:workflow:Continuous Deployment:environment:deploy-main
#   repo:ORG/REPO:workflow:Continuous Deployment:environment:deploy-branch
#
# Prerequisites:
#   - az CLI logged in as an Entra ID admin (can create app registrations and role assignments)
#   - The Azure subscription already exists
#
# This script is idempotent — re-running it will update existing resources in place
# rather than creating duplicates.
#
# Run with TARGET=main or TARGET=branch to provision one identity at a time:
#   TARGET=main ./setup-deploy-federated-credential.sh
#   TARGET=branch ./setup-deploy-federated-credential.sh
# Omit TARGET to provision both (default).
#
# Override the GitHub org/repo defaults if needed:
#   GITHUB_ORG=MyOrg GITHUB_REPO=MyRepo ./setup-deploy-federated-credential.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/utility/_oidc-helpers.sh
source "$SCRIPT_DIR/_oidc-helpers.sh"

GITHUB_WORKFLOW="Continuous Deployment"
TARGET="${TARGET:-all}"

# ---------------------------------------------------------------------------
# Configuration — update these before running
# ---------------------------------------------------------------------------
# Resource group that contains the main Key Vault (kv-ustp-cams)
MAIN_KV_NAME="kv-ustp-cams"
MAIN_KV_RG="${AZ_MAIN_KV_RG:?Set AZ_MAIN_KV_RG to the resource group containing $MAIN_KV_NAME}"
# Resource group that contains the dev/branch Key Vault (kv-ustp-cams-dev)
BRANCH_KV_NAME="kv-ustp-cams-dev"
BRANCH_KV_RG="${AZ_BRANCH_KV_RG:?Set AZ_BRANCH_KV_RG to the resource group containing $BRANCH_KV_NAME}"
# Secrets this workflow reads from each vault (reusable-deploy.yml)
KV_SECRETS=(
  "AZ-KV-APP-CONFIG-MANAGED-ID"
  "AZ-KV-APP-CONFIG-NAME"
  "AZ-COSMOS-DATABASE-NAME"
  "AZ-ANALYTICS-WORKSPACE-ID"
  "SLOT-NAME"
  "AZ-NETWORK-VNET-NAME"
  "AZ-PLAN-TYPE"
  "CAMS-LOGIN-PROVIDER"
  "CAMS-ENABLED-DATAFLOWS"
  "MSSQL-REQUEST-TIMEOUT"
)
KV_SECRETS_USER_ROLE="4633458b-17de-408a-b874-0445c86b69e6" # Key Vault Secrets User (built-in role GUID)
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Helper: idempotent app registration + service principal + federated credential
# ---------------------------------------------------------------------------
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
  local SP_ID
  SP_ID=$(lookup_or_create_sp "$APP_ID")

  echo "==> Updating federated identity credential..."
  upsert_federated_credential "$APP_ID" "$CREDENTIAL_NAME" "$SUBJECT"

  # ---------------------------------------------------------------------------
  # Role assignments
  #
  # Contributor at subscription scope: this identity deploys Bicep infrastructure
  # templates (az deployment group create) and creates/modifies resource groups
  # and resources within them. The target resource group names are fetched from
  # Key Vault at runtime, so we cannot pre-scope to a specific RG without a
  # chicken-and-egg dependency.
  # ---------------------------------------------------------------------------
  local SUBSCRIPTION_SCOPE="/subscriptions/${SUBSCRIPTION_ID}"
  echo "==> Checking Contributor role assignment at subscription scope..."
  local EXISTING_CONTRIBUTOR
  EXISTING_CONTRIBUTOR=$(az role assignment list \
    --assignee "$SP_ID" \
    --role "Contributor" \
    --scope "$SUBSCRIPTION_SCOPE" \
    --query "[0].id" -o tsv 2>/dev/null || true)
  if [[ -z "$EXISTING_CONTRIBUTOR" ]]; then
    az role assignment create \
      --assignee-object-id "$SP_ID" \
      --assignee-principal-type ServicePrincipal \
      --role "Contributor" \
      --scope "$SUBSCRIPTION_SCOPE" \
      --output none
    echo "    Contributor assigned at subscription scope."
  else
    echo "    Contributor already assigned at subscription scope — skipping."
  fi

  # Key Vault Secrets User on each secret in the environment-specific vault
  if [[ "$GITHUB_ENVIRONMENT" == *"main"* ]]; then
    local KV_NAME="$MAIN_KV_NAME"
    local KV_RG="$MAIN_KV_RG"
  else
    local KV_NAME="$BRANCH_KV_NAME"
    local KV_RG="$BRANCH_KV_RG"
  fi
  echo "==> Checking Key Vault Secrets User role assignments on $KV_NAME (per-secret)..."
  for SECRET_NAME in "${KV_SECRETS[@]}"; do
    local SECRET_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${KV_RG}/providers/Microsoft.KeyVault/vaults/${KV_NAME}/secrets/${SECRET_NAME}"
    local EXISTING_SECRET_ROLE
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

  set_github_environment_secret "$GITHUB_ENVIRONMENT" "AZ_CLIENT_ID" "$APP_ID"

  echo ""
  echo "==> Done: $APP_NAME"
  echo "    AZ_CLIENT_ID in environment '$GITHUB_ENVIRONMENT' = $APP_ID"
}

case "$TARGET" in
  main)
    provision_identity "cams-deploy-main-oidc" "gha-deploy-main" "deploy-main"
    ;;
  branch)
    provision_identity "cams-deploy-branch-oidc" "gha-deploy-branch" "deploy-branch"
    ;;
  all)
    provision_identity "cams-deploy-main-oidc" "gha-deploy-main" "deploy-main"
    provision_identity "cams-deploy-branch-oidc" "gha-deploy-branch" "deploy-branch"
    ;;
  *)
    echo "ERROR: Unknown TARGET='$TARGET'. Use main, branch, or omit for all." >&2
    exit 1
    ;;
esac
