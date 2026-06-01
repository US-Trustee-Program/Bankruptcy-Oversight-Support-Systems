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
  # This identity reads the LaunchDarkly SDK key from Key Vault during the
  # frontend build so that it can be baked into the static bundle. It needs:
  #   - Key Vault Secrets User on the LaunchDarkly SDK key secret in the
  #     environment-specific Key Vault (main vault for build-frontend-main,
  #     branch vault for build-frontend-branch)
  #
  # Example (Key Vault Secrets User on a specific secret):
  #   KV_NAME="kv-ustp-cams"          # or kv-ustp-cams-dev for branch
  #   KV_RG="rg-ustp-cams-kv"
  #   SECRET_NAME="LAUNCH-DARKLY-SDK-KEY"  # pragma: allowlist secret
  #   SUBSCRIPTION_ID=$(az account show --query id -o tsv)
  #   SECRET_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${KV_RG}/providers/Microsoft.KeyVault/vaults/${KV_NAME}/secrets/${SECRET_NAME}"
  #   KV_SECRETS_USER_ROLE="4633458b-17de-408a-b874-0445c86b69e6"
  #   az role assignment create \
  #     --assignee-object-id "$SP_ID" \
  #     --assignee-principal-type ServicePrincipal \
  #     --role "$KV_SECRETS_USER_ROLE" \
  #     --scope "$SECRET_SCOPE" \
  #     --output none
  #
  # Add per-secret assignments once the exact KV secret names are confirmed
  # during the Key Vault migration task.
  # ---------------------------------------------------------------------------

  local SECRET_VAR_NAME
  if [[ "$GITHUB_ENVIRONMENT" == "build-frontend-main" ]]; then
    SECRET_VAR_NAME="AZ_BUILD_FRONTEND_MAIN_CLIENT_ID" # pragma: allowlist secret
  else
    SECRET_VAR_NAME="AZ_BUILD_FRONTEND_BRANCH_CLIENT_ID" # pragma: allowlist secret
  fi

  echo ""
  echo "==> WARNING: Role assignments have NOT been configured for this identity."
  echo "    See TODO comments above. Complete role assignments before using this identity in production."

  echo ""
  echo "==> Done: $APP_NAME"
  echo "    Set GitHub Actions secret/variable:"
  echo "    ${SECRET_VAR_NAME} = $APP_ID"
  echo "    AZ_TENANT_ID               = $TENANT_ID"
  echo "    AZ_SUBSCRIPTION_ID         = $SUBSCRIPTION_ID"
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
