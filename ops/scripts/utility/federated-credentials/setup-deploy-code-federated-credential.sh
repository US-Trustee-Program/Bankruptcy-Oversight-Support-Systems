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
# shellcheck source=ops/scripts/utility/federated-credentials/_oidc-helpers.sh
source "$SCRIPT_DIR/_oidc-helpers.sh"

GITHUB_WORKFLOW="Continuous Deployment"
TARGET="${TARGET:-all}"

# ---------------------------------------------------------------------------
# Configuration — update these before running
# ---------------------------------------------------------------------------
# Resource group that contains the main Key Vault (kv-ustp-cams)
MAIN_KV_NAME="kv-ustp-cams"
MAIN_KV_RG="${AZ_MAIN_KV_RG:-}"
# Resource group that contains the dev/branch Key Vault (kv-ustp-cams-dev)
BRANCH_KV_NAME="kv-ustp-cams-dev"
BRANCH_KV_RG="${AZ_BRANCH_KV_RG:-}"
# Secrets this workflow reads from each vault (sub-deploy-code.yml, sub-deploy-code-slot.yml)
KV_SECRETS=("AZ-APP-RG" "SLOT-NAME")
KV_SECRETS_USER_ROLE="4633458b-17de-408a-b874-0445c86b69e6" # Key Vault Secrets User (built-in role GUID)
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

  echo "==> Looking up subscription..."
  local SUBSCRIPTION_ID
  SUBSCRIPTION_ID=$(az account show --query id -o tsv)
  echo "    Subscription: $SUBSCRIPTION_ID"

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
  # Website Contributor at subscription scope: this identity deploys application
  # code (az webapp deploy, az functionapp deployment source config-zip) and
  # manages App Service / Function App access restrictions.
  #
  # Key Vault Secrets User on AZ-APP-RG and SLOT-NAME: sub-deploy-code.yml and
  # sub-deploy-code-slot.yml now fetch these directly from Key Vault after OIDC
  # login instead of receiving them as workflow inputs.
  # ---------------------------------------------------------------------------
  local SUBSCRIPTION_SCOPE="/subscriptions/${SUBSCRIPTION_ID}"
  ensure_role_assignment "$SP_ID" "Website Contributor" "$SUBSCRIPTION_SCOPE"

  if [[ "$GITHUB_ENVIRONMENT" == *"main"* ]]; then
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
