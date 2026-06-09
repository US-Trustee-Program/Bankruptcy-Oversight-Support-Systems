#!/usr/bin/env bash
# Runbook: Create or update federated credentials for build-info-main and build-info-branch
#
# Purpose: Provision Azure app registrations and OIDC federated credentials for
#          the "build-info-main" and "build-info-branch" GitHub environments.
#          These identities are used by three top-level workflows (via reusable-build-info.yml)
#          to detect the target environment and read build configuration:
#
#            1. "Continuous Deployment"       — CD pipeline
#            2. "Stand Alone DAST Scan"       — manual/scheduled DAST scans
#            3. "Stand Alone E2E Test Runs"   — manual/scheduled E2E test runs
#
# The subject claim includes repo, workflow, and environment per the repo OIDC
# customization template (include_claim_keys: ["repo", "workflow", "environment"]).
# Subject formats:
#   repo:ORG/REPO:workflow:Continuous Deployment:environment:build-info-main
#   repo:ORG/REPO:workflow:Stand Alone DAST Scan:environment:build-info-main
#   repo:ORG/REPO:workflow:Stand Alone E2E Test Runs:environment:build-info-main
#   repo:ORG/REPO:workflow:Continuous Deployment:environment:build-info-branch
#   repo:ORG/REPO:workflow:Stand Alone DAST Scan:environment:build-info-branch
#   repo:ORG/REPO:workflow:Stand Alone E2E Test Runs:environment:build-info-branch
#
# NOTE: Both build-info-main and build-info-branch have THREE federated credentials
#       each (one per caller workflow), all provisioned on a single app registration.
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
#
# Override the GitHub org/repo defaults if needed:
#   GITHUB_ORG=MyOrg GITHUB_REPO=MyRepo ./setup-build-info-federated-credential.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/utility/_oidc-helpers.sh
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
KV_SECRETS=("AZ-APP-RG" "AZ-NETWORK-RG" "AZ-NETWORK-VNET-NAME")
KV_SECRETS_USER_ROLE="4633458b-17de-408a-b874-0445c86b69e6" # Key Vault Secrets User (built-in role GUID)
# ---------------------------------------------------------------------------

TARGET="${TARGET:-all}"

echo "==> Looking up subscription and tenant..."
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "    Subscription: $SUBSCRIPTION_ID"
echo "    Tenant:       $TENANT_ID"

provision_main() {
  if [[ -z "$MAIN_KV_RG" ]]; then
    echo "ERROR: AZ_MAIN_KV_RG is required when provisioning the main environment." >&2
    exit 1
  fi

  local APP_NAME="cams-build-info-main-oidc"
  local GITHUB_ENVIRONMENT="build-info-main"

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

  # Credential 1: called from Continuous Deployment
  upsert_federated_credential \
    "$APP_ID" \
    "gha-build-info-main" \
    "repo:${GITHUB_ORG}/${GITHUB_REPO}:workflow:Continuous Deployment:environment:${GITHUB_ENVIRONMENT}"

  # Credential 2: called from Stand Alone DAST Scan
  upsert_federated_credential \
    "$APP_ID" \
    "gha-build-info-main-dast" \
    "repo:${GITHUB_ORG}/${GITHUB_REPO}:workflow:Stand Alone DAST Scan:environment:${GITHUB_ENVIRONMENT}"

  # Credential 3: called from Stand Alone E2E Test Runs
  upsert_federated_credential \
    "$APP_ID" \
    "gha-build-info-main-e2e" \
    "repo:${GITHUB_ORG}/${GITHUB_REPO}:workflow:Stand Alone E2E Test Runs:environment:${GITHUB_ENVIRONMENT}"

  # ---------------------------------------------------------------------------
  # Role assignments
  #
  # Reader at subscription scope: needed so az webapp list / az functionapp list /
  # az network vnet list can read resources in any resource group. The RG names
  # are fetched from Key Vault at runtime, so we cannot pre-scope to a specific RG
  # without a chicken-and-egg dependency.
  # ---------------------------------------------------------------------------
  local SUBSCRIPTION_SCOPE="/subscriptions/${SUBSCRIPTION_ID}"
  echo "==> Checking Reader role assignment at subscription scope..."
  ensure_role_assignment "$SP_ID" "Reader" "$SUBSCRIPTION_SCOPE"

  # Key Vault Secrets User on each secret in kv-ustp-cams (main vault)
  echo "==> Checking Key Vault Secrets User role assignments on $MAIN_KV_NAME (per-secret)..."
  for SECRET_NAME in "${KV_SECRETS[@]}"; do
    local SECRET_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${MAIN_KV_RG}/providers/Microsoft.KeyVault/vaults/${MAIN_KV_NAME}/secrets/${SECRET_NAME}"
    ensure_role_assignment "$SP_ID" "$KV_SECRETS_USER_ROLE" "$SECRET_SCOPE"
  done

  set_github_environment_secret "$GITHUB_ENVIRONMENT" "AZ_CLIENT_ID" "$APP_ID"

  echo ""
  echo "==> Done: $APP_NAME"
  echo "    AZ_CLIENT_ID in environment '$GITHUB_ENVIRONMENT' = $APP_ID"
}

provision_branch() {
  if [[ -z "$BRANCH_KV_RG" ]]; then
    echo "ERROR: AZ_BRANCH_KV_RG is required when provisioning the branch environment." >&2
    exit 1
  fi

  local APP_NAME="cams-build-info-branch-oidc"
  local GITHUB_ENVIRONMENT="build-info-branch"

  echo ""
  echo "==================================================================="
  echo "  Provisioning $APP_NAME (three federated credentials)"
  echo "==================================================================="

  echo "==> Looking up app registration: $APP_NAME"
  local APP_ID
  APP_ID=$(lookup_or_create_app "$APP_NAME")

  echo "==> Looking up service principal for app..."
  local SP_ID
  SP_ID=$(lookup_or_create_sp "$APP_ID")

  # Credential 1: called from Continuous Deployment
  upsert_federated_credential \
    "$APP_ID" \
    "gha-build-info-branch-cd" \
    "repo:${GITHUB_ORG}/${GITHUB_REPO}:workflow:Continuous Deployment:environment:${GITHUB_ENVIRONMENT}"

  # Credential 2: called from Stand Alone DAST Scan
  upsert_federated_credential \
    "$APP_ID" \
    "gha-build-info-branch-dast" \
    "repo:${GITHUB_ORG}/${GITHUB_REPO}:workflow:Stand Alone DAST Scan:environment:${GITHUB_ENVIRONMENT}"

  # Credential 3: called from Stand Alone E2E Test Runs
  upsert_federated_credential \
    "$APP_ID" \
    "gha-build-info-branch-e2e" \
    "repo:${GITHUB_ORG}/${GITHUB_REPO}:workflow:Stand Alone E2E Test Runs:environment:${GITHUB_ENVIRONMENT}"

  # ---------------------------------------------------------------------------
  # Role assignments
  #
  # Reader at subscription scope: needed so az webapp list / az functionapp list /
  # az network vnet list can read resources in any resource group. The RG names
  # are fetched from Key Vault at runtime, so we cannot pre-scope to a specific RG
  # without a chicken-and-egg dependency.
  # ---------------------------------------------------------------------------
  local SUBSCRIPTION_SCOPE="/subscriptions/${SUBSCRIPTION_ID}"
  echo "==> Checking Reader role assignment at subscription scope..."
  ensure_role_assignment "$SP_ID" "Reader" "$SUBSCRIPTION_SCOPE"

  # Key Vault Secrets User on each secret in kv-ustp-cams-dev (branch vault)
  echo "==> Checking Key Vault Secrets User role assignments on $BRANCH_KV_NAME (per-secret)..."
  for SECRET_NAME in "${KV_SECRETS[@]}"; do
    local SECRET_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${BRANCH_KV_RG}/providers/Microsoft.KeyVault/vaults/${BRANCH_KV_NAME}/secrets/${SECRET_NAME}"
    ensure_role_assignment "$SP_ID" "$KV_SECRETS_USER_ROLE" "$SECRET_SCOPE"
  done

  set_github_environment_secret "$GITHUB_ENVIRONMENT" "AZ_CLIENT_ID" "$APP_ID"

  echo ""
  echo "==> Done: $APP_NAME"
  echo "    AZ_CLIENT_ID in environment '$GITHUB_ENVIRONMENT' = $APP_ID"
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
