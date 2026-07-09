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
#
# Override the GitHub org/repo defaults if needed:
#   GITHUB_ORG=MyOrg GITHUB_REPO=MyRepo ./setup-e2e-federated-credential.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/utility/federated-credentials/_oidc-helpers.sh
source "$SCRIPT_DIR/_oidc-helpers.sh"

# ---------------------------------------------------------------------------
# Configuration — update these before running
# ---------------------------------------------------------------------------
# Resource group that contains the main Key Vault (kv-ustp-cams)
MAIN_KV_NAME="kv-ustp-cams"
MAIN_KV_RG="${AZ_MAIN_KV_RG:-}"
# Resource group that contains the dev/branch Key Vault (kv-ustp-cams-dev)
BRANCH_KV_NAME="kv-ustp-cams-dev"
BRANCH_KV_RG="${AZ_BRANCH_KV_RG:-}"
# Secrets this workflow reads from each vault
KV_SECRETS=("AZ-APP-RG" "AZURE-RG" "SLOT-NAME" "AZ-COSMOS-DATABASE-NAME" "AZ-COSMOS-MONGO-ACCOUNT-NAME" "CAMS-LOGIN-PROVIDER")
KV_SECRETS_USER_ROLE="4633458b-17de-408a-b874-0445c86b69e6" # Key Vault Secrets User (built-in role GUID)
# ---------------------------------------------------------------------------

TARGET="${TARGET:-all}"

echo "==> Looking up subscription and tenant..."
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "    Subscription: $SUBSCRIPTION_ID"
echo "    Tenant:       $TENANT_ID"

provision_identity() {
  local APP_NAME="$1"
  local GITHUB_ENVIRONMENT="$2"

  echo ""
  echo "==================================================================="
  echo "  Provisioning $APP_NAME"
  echo "==================================================================="

  echo "==> Looking up app registration: $APP_NAME"
  local APP_ID
  APP_ID=$(lookup_or_create_app "$APP_NAME")

  echo "==> Looking up service principal for app..."
  local SP_ID
  SP_ID=$(lookup_or_create_sp "$APP_ID")

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
  # Role assignments
  #
  # Contributor at subscription scope: needed so this identity can:
  #   - Read/write App Service and SQL Server firewall rules (add-allowed-ip, add-sql-firewall-rule)
  #   - Call az cosmosdb keys list to get the MongoDB connection string
  #   - Call az sql db show / az sql db create to provision the E2E SQL database
  #   - Call az sql server show and az identity show to configure SQL authentication
  # The resource group names are injected at runtime via environment secrets, so
  # we cannot pre-scope to a specific RG without a chicken-and-egg dependency.
  # ---------------------------------------------------------------------------
  local SUBSCRIPTION_SCOPE="/subscriptions/${SUBSCRIPTION_ID}"
  echo "==> Checking Contributor role assignment at subscription scope..."
  ensure_role_assignment "$SP_ID" "Contributor" "$SUBSCRIPTION_SCOPE"

  # Key Vault Secrets User on each secret — e2e-main reads from kv-ustp-cams,
  # e2e-branch reads from kv-ustp-cams-dev.
  if [[ "$GITHUB_ENVIRONMENT" == "e2e-main" ]]; then
    if [[ -z "$MAIN_KV_RG" ]]; then
      echo "ERROR: AZ_MAIN_KV_RG is required when provisioning the main environment." >&2
      exit 1
    fi
    local KV_NAME="$MAIN_KV_NAME"
    local KV_RG="$MAIN_KV_RG"
  else
    if [[ -z "$BRANCH_KV_RG" ]]; then
      echo "ERROR: AZ_BRANCH_KV_RG is required when provisioning the branch environment." >&2
      exit 1
    fi
    local KV_NAME="$BRANCH_KV_NAME"
    local KV_RG="$BRANCH_KV_RG"
  fi
  echo "==> Checking Key Vault Secrets User role assignments on $KV_NAME (per-secret)..."
  for SECRET_NAME in "${KV_SECRETS[@]}"; do
    local SECRET_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${KV_RG}/providers/Microsoft.KeyVault/vaults/${KV_NAME}/secrets/${SECRET_NAME}"
    ensure_role_assignment "$SP_ID" "$KV_SECRETS_USER_ROLE" "$SECRET_SCOPE"
  done

  set_github_environment_secret "$GITHUB_ENVIRONMENT" "AZ_CLIENT_ID" "$APP_ID"

  echo ""
  echo "==> Done: $APP_NAME"
  echo "    AZ_CLIENT_ID in environment '$GITHUB_ENVIRONMENT' = $APP_ID"
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
