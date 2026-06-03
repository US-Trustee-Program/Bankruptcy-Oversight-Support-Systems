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
  # manages App Service / Function App access restrictions. Website Contributor
  # is sufficient for these operations and avoids the broad write access of
  # Contributor. The target resource group name is passed as a workflow input at
  # runtime, so we cannot pre-scope to a specific RG without a chicken-and-egg
  # dependency.
  # ---------------------------------------------------------------------------
  local SUBSCRIPTION_SCOPE="/subscriptions/${SUBSCRIPTION_ID}"
  ensure_role_assignment "$SP_ID" "Website Contributor" "$SUBSCRIPTION_SCOPE"

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
