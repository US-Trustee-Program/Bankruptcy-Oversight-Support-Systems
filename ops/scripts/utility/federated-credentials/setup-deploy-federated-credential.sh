#!/usr/bin/env bash
# Runbook: Create or update federated credentials for deploy-main and deploy-branch
#
# Purpose: Provision Azure app registrations and OIDC federated credentials for
#          the "deploy-main" and "deploy-branch" GitHub environments. These
#          identities are used by the "Continuous Deployment" workflow to deploy
#          Bicep infrastructure templates to the main and branch Azure environments.
#
# The subject claim includes repo, workflow, and environment per the repo OIDC
# customization template (include_claim_keys: ["repo", "workflow", "environment"]).
# Subject formats:
#   repo:ORG/REPO:workflow:Continuous Deployment:environment:deploy-main
#   repo:ORG/REPO:workflow:Continuous Deployment:environment:deploy-branch
#
# Permissions granted:
#   - Contributor at subscription scope (main and branch, identical):
#       covers az deployment sub create, resource group creation/reads, and
#       az deployment group create inside the (statically- or dynamically-named)
#       resource groups this identity deploys to.
#   - Custom role "CAMS KV Role Assignment Operator" on the KV resource:
#       the Bicep kv-setup-module creates Microsoft.Authorization/roleAssignments
#       on KV secrets; Contributor does not include roleAssignments/write.
#       Scoped to the KV resource (not the RG) to minimise privilege escalation surface.
#   - Key Vault Secrets User on each individual KV secret
#
# NOTE on least privilege: subscription-scope Contributor is broader than ideal.
# A least-privilege approach (resource-group-scoped grants) is incompatible with
# branch deployments, whose resource groups are created dynamically per-hash at
# deploy time and so cannot be pre-scoped (Azure RBAC has no wildcard scoping).
# Rather than diverge main (static RGs, scopable) from branch (dynamic RGs, not
# scopable), both environments use the same subscription-scope Contributor grant
# for consistency. Narrowing this is deferred to a focused follow-up that decides
# the branch approach (see the branch-deploy least-privilege design doc).
#
# Prerequisites:
#   - az CLI logged in as an Entra ID admin (can create app registrations and role assignments)
#   - The Azure subscription already exists
#
# Required environment variables:
#   AZ_MAIN_KV_RG    — resource group containing the main Key Vault
#   AZ_BRANCH_KV_RG  — resource group containing the dev/branch Key Vault
#
# This script is idempotent — re-running it will update existing resources in place
# rather than creating duplicates.
#
# Run with TARGET=main or TARGET=branch to provision one identity at a time:
#   TARGET=main ./setup-deploy-federated-credential.sh
#   TARGET=branch ./setup-deploy-federated-credential.sh
# Omit TARGET to provision both (default).
#
# Override the GitHub org/repo defaults if needed:
#   GITHUB_ORG=MyOrg GITHUB_REPO=MyRepo ./setup-deploy-federated-credential.sh

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
# KV-Workflows: reusable-deploy.yml
KV_SECRETS=(
  "AZ-APP-RG"
  "AZ-NETWORK-RG"
  "AZURE-RG"
  "AZ-ANALYTICS-RG"
  "AZ-KV-APP-CONFIG-MANAGED-ID"
  "AZ-KV-APP-CONFIG-NAME"
  "AZ-COSMOS-DATABASE-NAME"
  "AZ-ANALYTICS-WORKSPACE-ID"
  "SLOT-NAME"
  "AZ-NETWORK-VNET-NAME"
  "AZ-PLAN-TYPE"
  "CAMS-LOGIN-PROVIDER"
  "CAMS-ENABLED-DATAFLOWS"
  "MSSQL-REQUEST-TIMEOUT"
  "MIGRATE-CASE-APPOINTMENTS-FETCH-SIZE"
)
KV_SECRETS_USER_ROLE="4633458b-17de-408a-b874-0445c86b69e6" # Key Vault Secrets User (built-in role GUID)

# Custom role name for KV role assignment operations (replaces User Access Administrator)
KV_ROLE_ASSIGNMENT_ROLE_NAME="CAMS KV Role Assignment Operator"
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Helper: create or skip the KV role assignment operator role (idempotent)
#
# Grants only Microsoft.Authorization/roleAssignments write/read/delete,
# replacing the overly broad User Access Administrator. Required because the
# Bicep kv-setup-module creates roleAssignments on KV secrets (granting the
# app's managed identity access), and Contributor does not include
# roleAssignments/write.
# ---------------------------------------------------------------------------
# Echoes the role definition GUID on stdout (progress goes to stderr) so the
# caller can assign by ID rather than the lagging display-name filter.
ensure_kv_role_assignment_role() {
  local SUBSCRIPTION_ID="$1"

  echo "==> Checking custom role: '$KV_ROLE_ASSIGNMENT_ROLE_NAME'..." >&2
  local ROLE_ID
  ROLE_ID=$(az role definition list --custom-role-only true \
    --query "[?roleName=='${KV_ROLE_ASSIGNMENT_ROLE_NAME}'].name | [0]" -o tsv 2>/dev/null || true)

  if [[ -n "$ROLE_ID" ]]; then
    echo "    Custom role already exists, skipping creation." >&2
    echo "$ROLE_ID"
    return
  fi

  echo "    Creating custom role '$KV_ROLE_ASSIGNMENT_ROLE_NAME'..." >&2
  az role definition create --role-definition "$(cat <<EOF
{
  "Name": "${KV_ROLE_ASSIGNMENT_ROLE_NAME}",
  "Description": "Allows CAMS deploy identities to create role assignments on Key Vault secrets only. Required for Bicep kv-setup-module. Replaces User Access Administrator to limit privilege escalation surface.",
  "Actions": [
    "Microsoft.Authorization/roleAssignments/write",
    "Microsoft.Authorization/roleAssignments/read",
    "Microsoft.Authorization/roleAssignments/delete"
  ],
  "NotActions": [],
  "DataActions": [],
  "NotDataActions": [],
  "AssignableScopes": [
    "/subscriptions/${SUBSCRIPTION_ID}"
  ]
}
EOF
)" --output none
  echo "    Custom role created." >&2
  ROLE_ID=$(wait_for_role_definition "$KV_ROLE_ASSIGNMENT_ROLE_NAME")
  echo "$ROLE_ID"
}

# ---------------------------------------------------------------------------
# Helper: idempotent app registration + service principal + federated credential
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
  # Contributor at subscription scope: covers az deployment sub create, resource
  # group creation/reads, and az deployment group create inside the resource
  # groups this identity deploys to. Applied identically to main and branch.
  #
  # See the header NOTE on least privilege: resource-group-scoped grants are
  # incompatible with branch deployments (dynamic per-hash RGs that cannot be
  # pre-scoped), so both environments share this grant for consistency, pending
  # a focused follow-up.
  #
  # KV role assignment operator (custom role) on the KV resource: the Bicep
  # kv-setup-module creates Microsoft.Authorization/roleAssignments on KV secrets
  # (granting the app's managed identity access). Contributor does not include
  # Microsoft.Authorization/roleAssignments/write; the custom role scoped to the
  # KV resource provides the minimum required permission.
  # ---------------------------------------------------------------------------
  local SUBSCRIPTION_SCOPE="/subscriptions/${SUBSCRIPTION_ID}"

  echo "==> Checking Contributor role assignment at subscription scope..."
  ensure_role_assignment "$SP_ID" "Contributor" "$SUBSCRIPTION_SCOPE"

  # KV role assignment operator on the KV resource + Key Vault Secrets User per secret
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

  # Ensure the custom KV role exists before assigning it; assign by GUID.
  local KV_ROLE_ID
  KV_ROLE_ID=$(ensure_kv_role_assignment_role "$SUBSCRIPTION_ID")

  # Scope to the KV resource itself (not the whole RG) to minimise privilege escalation surface
  local KV_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${KV_RG}/providers/Microsoft.KeyVault/vaults/${KV_NAME}"
  echo "==> Checking '$KV_ROLE_ASSIGNMENT_ROLE_NAME' on Key Vault ${KV_NAME}..."
  ensure_role_assignment "$SP_ID" "$KV_ROLE_ID" "$KV_SCOPE"

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

# ---------------------------------------------------------------------------
# Dispatch
#
# Subscription-scope Contributor means the per-RG names are no longer needed
# here; only the KV resource group (AZ_MAIN_KV_RG / AZ_BRANCH_KV_RG) is required,
# and that is validated inside provision_identity.
# ---------------------------------------------------------------------------
case "$TARGET" in
  main)
    provision_identity "cams-deploy-main-oidc" "gha-deploy-main" "deploy-main"
    ;;
  branch)
    provision_identity "cams-deploy-branch-oidc" "gha-deploy-branch" "deploy-branch"
    ;;
  all)
    provision_identity "cams-deploy-main-oidc" "gha-deploy-main" "deploy-main"
    provision_identity "cams-deploy-branch-oidc" "gha-deploy-branch" "deploy-branch"
    ;;
  *)
    echo "ERROR: Unknown TARGET='$TARGET'. Use main, branch, or omit for all." >&2
    exit 1
    ;;
esac
