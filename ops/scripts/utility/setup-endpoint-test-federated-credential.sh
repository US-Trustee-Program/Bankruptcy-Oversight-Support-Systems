#!/usr/bin/env bash
# Runbook: Create or update federated credentials for endpoint-test-main and endpoint-test-branch
#
# Purpose: Provision Azure app registrations and OIDC federated credentials for
#          the "endpoint-test-main" and "endpoint-test-branch" GitHub environments.
#          These identities are used by the "Continuous Deployment" workflow (via
#          reusable-endpoint-test.yml) to run post-deployment endpoint health
#          checks against the deployed application.
#
# The subject claim includes repo, workflow, and environment per the repo OIDC
# customization template (include_claim_keys: ["repo", "workflow", "environment"]).
# Subject formats:
#   repo:ORG/REPO:workflow:Continuous Deployment:environment:endpoint-test-main
#   repo:ORG/REPO:workflow:Continuous Deployment:environment:endpoint-test-branch
#
# Prerequisites:
#   - az CLI logged in as an Entra ID admin (can create app registrations and role assignments)
#   - The Azure subscription already exists
#
# This script is idempotent — re-running it will update existing resources in place
# rather than creating duplicates.
#
# Run with TARGET=main or TARGET=branch to provision one identity at a time:
#   TARGET=main ./setup-endpoint-test-federated-credential.sh
#   TARGET=branch ./setup-endpoint-test-federated-credential.sh
# Omit TARGET to provision both (default).
#
# Override the GitHub org/repo defaults if needed:
#   GITHUB_ORG=MyOrg GITHUB_REPO=MyRepo ./setup-endpoint-test-federated-credential.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/utility/_oidc-helpers.sh
source "$SCRIPT_DIR/_oidc-helpers.sh"

GITHUB_WORKFLOW="Continuous Deployment"
TARGET="${TARGET:-all}"

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
  # Contributor at subscription scope: needed so this identity can:
  #   - Read/write App Service firewall rules (dev-add-allowed-ip.sh,
  #     dev-rm-allowed-ip.sh) to allow/revoke the GHA runner's IP access
  # The endpoint-test workflow does not read from Key Vault — all inputs are
  # passed in by the caller. No per-secret KV role assignments are required.
  # The resource group names are passed as inputs at runtime, so we cannot
  # pre-scope to a specific RG without a chicken-and-egg dependency.
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

  set_github_environment_secret "$GITHUB_ENVIRONMENT" "AZ_CLIENT_ID" "$APP_ID"

  echo ""
  echo "==> Done: $APP_NAME"
  echo "    AZ_CLIENT_ID in environment '$GITHUB_ENVIRONMENT' = $APP_ID"
}

case "$TARGET" in
  main)
    provision_identity "cams-endpoint-test-main-oidc" "gha-endpoint-test-main" "endpoint-test-main"
    ;;
  branch)
    provision_identity "cams-endpoint-test-branch-oidc" "gha-endpoint-test-branch" "endpoint-test-branch"
    ;;
  all)
    provision_identity "cams-endpoint-test-main-oidc" "gha-endpoint-test-main" "endpoint-test-main"
    provision_identity "cams-endpoint-test-branch-oidc" "gha-endpoint-test-branch" "endpoint-test-branch"
    ;;
  *)
    echo "ERROR: Unknown TARGET='$TARGET'. Use main, branch, or omit for all." >&2
    exit 1
    ;;
esac
