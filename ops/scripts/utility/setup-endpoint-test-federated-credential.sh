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
  # This identity runs post-deployment endpoint health checks. It contacts the
  # application via HTTP to verify that key endpoints return expected responses
  # after a deployment completes.
  #
  # It likely needs:
  #   - Reader on the environment resource group (to look up the App Service
  #     hostname or deployment slot URL)
  #   - Key Vault Secrets User on specific secrets in the environment Key Vault
  #     (e.g., application base URL, health check credentials or tokens)
  #
  # No write access to Azure resources is required.
  #
  # Example (Reader on a resource group):
  #   RESOURCE_GROUP="rg-ustp-cams-<env>"
  #   RG_SCOPE=$(az group show --name "$RESOURCE_GROUP" --query id -o tsv)
  #   az role assignment create \
  #     --assignee-object-id "$SP_ID" \
  #     --assignee-principal-type ServicePrincipal \
  #     --role "Reader" \
  #     --scope "$RG_SCOPE" \
  #     --output none
  # ---------------------------------------------------------------------------

  local SECRET_VAR_NAME
  if [[ "$GITHUB_ENVIRONMENT" == "endpoint-test-main" ]]; then
    SECRET_VAR_NAME="AZ_ENDPOINT_TEST_MAIN_CLIENT_ID" # pragma: allowlist secret
  else
    SECRET_VAR_NAME="AZ_ENDPOINT_TEST_BRANCH_CLIENT_ID" # pragma: allowlist secret
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
