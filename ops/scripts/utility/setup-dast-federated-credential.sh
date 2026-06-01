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
  # This identity runs DAST security scans against the deployed application.
  # It likely needs:
  #   - Reader on the environment resource group (to discover the App Service
  #     URL and other resource details needed to configure the scan target)
  #   - Key Vault Secrets User on specific secrets in the environment Key Vault
  #     (e.g., application URL, test credentials used by the DAST scanner)
  #
  # DAST scans interact with the application over HTTP — no write access to
  # Azure resources is required.
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
  if [[ "$GITHUB_ENVIRONMENT" == "dast-main" ]]; then
    SECRET_VAR_NAME="AZ_DAST_MAIN_CLIENT_ID" # pragma: allowlist secret
  else
    SECRET_VAR_NAME="AZ_DAST_BRANCH_CLIENT_ID" # pragma: allowlist secret
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
