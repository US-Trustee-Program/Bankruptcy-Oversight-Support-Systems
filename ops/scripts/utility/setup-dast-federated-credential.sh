#!/usr/bin/env bash
# Runbook: Create or update federated credentials for dast-main and dast-branch
#
# Purpose: Provision Azure app registrations and OIDC federated credentials for
#          the "dast-main" and "dast-branch" GitHub environments. These identities
#          are used by the "Stand Alone DAST Scan" workflow (via reusable-dast.yml)
#          to authenticate to Azure before running OWASP ZAP / DAST security
#          scans against the deployed application.
#
# The subject claim includes repo, workflow, and environment per the repo OIDC
# customization template (include_claim_keys: ["repo", "workflow", "environment"]).
# Subject formats:
#   repo:ORG/REPO:workflow:Stand Alone DAST Scan:environment:dast-main
#   repo:ORG/REPO:workflow:Stand Alone DAST Scan:environment:dast-branch
#
# Prerequisites:
#   - az CLI logged in as an Entra ID admin (can create app registrations and role assignments)
#   - The Azure subscription already exists
#
# This script is idempotent — re-running it will update existing resources in place
# rather than creating duplicates.
#
# Run with TARGET=main or TARGET=branch to provision one identity at a time:
#   TARGET=main ./setup-dast-federated-credential.sh
#   TARGET=branch ./setup-dast-federated-credential.sh
# Omit TARGET to provision both (default).
#
# Override the GitHub org/repo defaults if needed:
#   GITHUB_ORG=MyOrg GITHUB_REPO=MyRepo ./setup-dast-federated-credential.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/utility/_oidc-helpers.sh
source "$SCRIPT_DIR/_oidc-helpers.sh"

GITHUB_WORKFLOW="Stand Alone DAST Scan"
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
# Secrets this workflow reads from each vault (reusable-dast.yml)
KV_SECRETS=("AZ-APP-RG" "AZURE-RG" "SLOT-NAME")
KV_SECRETS_USER_ROLE="4633458b-17de-408a-b874-0445c86b69e6" # Key Vault Secrets User (built-in role GUID)
# ---------------------------------------------------------------------------

echo "==> Looking up subscription and tenant..."
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "    Subscription: $SUBSCRIPTION_ID"
echo "    Tenant:       $TENANT_ID"

provision_identity() {
  local APP_NAME="$1"
  local CREDENTIAL_NAME="$2"
  local GITHUB_ENVIRONMENT="$3"
  local SUBJECT="repo:${GITHUB_ORG}/${GITHUB_REPO}:workflow:${GITHUB_WORKFLOW}:environment:${GITHUB_ENVIRONMENT}"

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

  echo "==> Updating federated identity credential..."
  upsert_federated_credential "$APP_ID" "$CREDENTIAL_NAME" "$SUBJECT"

  # ---------------------------------------------------------------------------
  # Role assignments
  #
  # Website Contributor at subscription scope: covers App Service access
  # restriction operations (dev-add-allowed-ip.sh). This replaces the broader
  # Contributor role.
  #
  # SQL Server Contributor at subscription scope: covers SQL Server firewall
  # rule operations (add-sql-firewall-rule.sh).
  #
  # Key Vault Secrets User on AZ-APP-RG, AZURE-RG, and SLOT-NAME:
  # reusable-dast.yml now fetches these directly from Key Vault after OIDC login.
  # ---------------------------------------------------------------------------
  local SUBSCRIPTION_SCOPE="/subscriptions/${SUBSCRIPTION_ID}"
  ensure_role_assignment "$SP_ID" "Website Contributor" "$SUBSCRIPTION_SCOPE"
  ensure_role_assignment "$SP_ID" "SQL Server Contributor" "$SUBSCRIPTION_SCOPE"

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
    provision_identity "cams-dast-main-oidc" "gha-dast-main" "dast-main"
    ;;
  branch)
    provision_identity "cams-dast-branch-oidc" "gha-dast-branch" "dast-branch"
    ;;
  all)
    provision_identity "cams-dast-main-oidc" "gha-dast-main" "dast-main"
    provision_identity "cams-dast-branch-oidc" "gha-dast-branch" "dast-branch"
    ;;
  *)
    echo "ERROR: Unknown TARGET='$TARGET'. Use main, branch, or omit for all." >&2
    exit 1
    ;;
esac
