#!/usr/bin/env bash
# Runbook: Create or update federated credentials for build-frontend-main and build-frontend-branch
#
# Purpose: Provision Azure app registrations and OIDC federated credentials for
#          the "build-frontend-main" and "build-frontend-branch" GitHub
#          environments. These identities are used by the "Continuous Deployment"
#          workflow (via reusable-build-frontend.yml) to build the React frontend
#          with the LaunchDarkly SDK key fetched from Key Vault at build time.
#
# The subject claim includes repo, workflow, and environment per the repo OIDC
# customization template (include_claim_keys: ["repo", "workflow", "environment"]).
# Subject formats:
#   repo:ORG/REPO:workflow:Continuous Deployment:environment:build-frontend-main
#   repo:ORG/REPO:workflow:Continuous Deployment:environment:build-frontend-branch
#
# Prerequisites:
#   - az CLI logged in as an Entra ID admin (can create app registrations and role assignments)
#   - kv-ustp-cams (main) and kv-ustp-cams-dev (branch) Key Vaults already exist
#   - The LaunchDarkly SDK key secret already exists in each vault
#
# This script is idempotent — re-running it will update existing resources in place
# rather than creating duplicates.
#
# Run with TARGET=main or TARGET=branch to provision one identity at a time:
#   TARGET=main ./setup-build-frontend-federated-credential.sh
#   TARGET=branch ./setup-build-frontend-federated-credential.sh
# Omit TARGET to provision both (default).
#
# Override the GitHub org/repo defaults if needed:
#   GITHUB_ORG=MyOrg GITHUB_REPO=MyRepo ./setup-build-frontend-federated-credential.sh

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
MAIN_KV_RG="${AZ_MAIN_KV_RG:-}"
# Resource group that contains the dev/branch Key Vault (kv-ustp-cams-dev)
BRANCH_KV_NAME="kv-ustp-cams-dev"
BRANCH_KV_RG="${AZ_BRANCH_KV_RG:-}"
# Secrets this workflow reads from each vault (reusable-build-frontend.yml)
KV_SECRETS=(
  "AZ-APP-RG"
  "SLOT-NAME"
  "CAMS-LOGIN-PROVIDER"
)
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
  # Reader at subscription scope: this identity only reads Key Vault secrets
  # and runs az monitor app-insights component show (read-only). Reader at
  # subscription scope is sufficient and follows least-privilege.
  # ---------------------------------------------------------------------------
  local SUBSCRIPTION_SCOPE="/subscriptions/${SUBSCRIPTION_ID}"
  echo "==> Checking Reader role assignment at subscription scope..."
  ensure_role_assignment "$SP_ID" "Reader" "$SUBSCRIPTION_SCOPE"

  # Key Vault Secrets User on each secret in the environment-specific vault
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
    provision_identity "cams-build-frontend-main-oidc" "gha-build-frontend-main" "build-frontend-main"
    ;;
  branch)
    provision_identity "cams-build-frontend-branch-oidc" "gha-build-frontend-branch" "build-frontend-branch"
    ;;
  all)
    provision_identity "cams-build-frontend-main-oidc" "gha-build-frontend-main" "build-frontend-main"
    provision_identity "cams-build-frontend-branch-oidc" "gha-build-frontend-branch" "build-frontend-branch"
    ;;
  *)
    echo "ERROR: Unknown TARGET='$TARGET'. Use main, branch, or omit for all." >&2
    exit 1
    ;;
esac
