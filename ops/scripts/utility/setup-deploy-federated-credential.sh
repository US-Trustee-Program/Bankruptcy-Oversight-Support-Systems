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
# Permissions granted (least-privilege):
#   - Custom role "CAMS Deploy Subscription Role" at subscription scope:
#       Microsoft.Resources/deployments/*   (az deployment sub create)
#       Microsoft.Resources/resourceGroups/write  (create new RGs)
#       Microsoft.Resources/resourceGroups/read   (read RGs)
#   - Contributor scoped to each of the 4 known resource groups:
#       AZ_APP_RG, AZ_NETWORK_RG, AZ_ANALYTICS_RG, AZ_DB_RG
#       (required for az deployment group create inside those RGs)
#   - Custom role "CAMS KV Role Assignment Operator" on the KV resource:
#       the Bicep kv-setup-module creates Microsoft.Authorization/roleAssignments
#       on KV secrets; Contributor does not include roleAssignments/write.
#       Scoped to the KV resource (not the RG) to minimise privilege escalation surface.
#   - Key Vault Secrets User on each individual KV secret
#
# Prerequisites:
#   - az CLI logged in as an Entra ID admin (can create app registrations and role assignments)
#   - The Azure subscription already exists
#   - The 4 target resource groups must already exist (or their names provided)
#
# Required environment variables:
#   AZ_MAIN_KV_RG    — resource group containing the main Key Vault
#   AZ_BRANCH_KV_RG  — resource group containing the dev/branch Key Vault
#
#   For main environment (TARGET=main or TARGET=all):
#     AZ_MAIN_APP_RG        — application resource group name
#     AZ_MAIN_NETWORK_RG    — network resource group name
#     AZ_MAIN_ANALYTICS_RG  — analytics resource group name
#     AZ_MAIN_DB_RG         — shared/DB resource group name
#
#   For branch environment (TARGET=branch or TARGET=all):
#     AZ_BRANCH_APP_RG        — application resource group name
#     AZ_BRANCH_NETWORK_RG    — network resource group name
#     AZ_BRANCH_ANALYTICS_RG  — analytics resource group name
#     AZ_BRANCH_DB_RG         — shared/DB resource group name
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
# Secrets this workflow reads from each vault (reusable-deploy.yml)
KV_SECRETS=(
  "AZ-APP-RG"
  "AZ-NETWORK-RG"
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
)
KV_SECRETS_USER_ROLE="4633458b-17de-408a-b874-0445c86b69e6" # Key Vault Secrets User (built-in role GUID)

# Custom role name for subscription-scoped ARM/RG operations
CUSTOM_ROLE_NAME="CAMS Deploy Subscription Role"
# Custom role name for KV role assignment operations (replaces User Access Administrator)
KV_ROLE_ASSIGNMENT_ROLE_NAME="CAMS KV Role Assignment Operator"
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Helper: create or skip the custom subscription-scope deploy role (idempotent)
# ---------------------------------------------------------------------------
ensure_custom_deploy_role() {
  local SUBSCRIPTION_ID="$1"

  echo "==> Checking custom role: '$CUSTOM_ROLE_NAME'..."
  local EXISTING
  EXISTING=$(az role definition list --name "$CUSTOM_ROLE_NAME" --query "[0].name" -o tsv 2>/dev/null || true)

  if [[ -n "$EXISTING" ]]; then
    echo "    Custom role already exists, skipping creation."
    return
  fi

  echo "    Creating custom role '$CUSTOM_ROLE_NAME'..."
  az role definition create --role-definition "$(cat <<EOF
{
  "Name": "${CUSTOM_ROLE_NAME}",
  "Description": "Allows CAMS deploy identities to run az deployment sub create, create/read resource groups, and run ARM deployments. Does not grant resource-level write access (scoped Contributor on known RGs handles that).",
  "Actions": [
    "Microsoft.Resources/deployments/*",
    "Microsoft.Resources/resourceGroups/write",
    "Microsoft.Resources/resourceGroups/read"
  ],
  "NotActions": [],
  "DataActions": [],
  "NotDataActions": [],
  "AssignableScopes": [
    "/subscriptions/${SUBSCRIPTION_ID}"
  ]
}
EOF
)"
  echo "    Custom role created."
}

# ---------------------------------------------------------------------------
# Helper: create or skip the KV role assignment operator role (idempotent)
#
# Grants only Microsoft.Authorization/roleAssignments write/read/delete,
# replacing the overly broad User Access Administrator. Required because the
# Bicep kv-setup-module creates roleAssignments on KV secrets (granting the
# app's managed identity access), and Contributor does not include
# roleAssignments/write.
# ---------------------------------------------------------------------------
ensure_kv_role_assignment_role() {
  local SUBSCRIPTION_ID="$1"

  echo "==> Checking custom role: '$KV_ROLE_ASSIGNMENT_ROLE_NAME'..."
  local EXISTING
  EXISTING=$(az role definition list --name "$KV_ROLE_ASSIGNMENT_ROLE_NAME" --query "[0].name" -o tsv 2>/dev/null || true)

  if [[ -n "$EXISTING" ]]; then
    echo "    Custom role already exists, skipping creation."
    return
  fi

  echo "    Creating custom role '$KV_ROLE_ASSIGNMENT_ROLE_NAME'..."
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
)"
  echo "    Custom role created."
}

# ---------------------------------------------------------------------------
# Helper: idempotent app registration + service principal + federated credential
# ---------------------------------------------------------------------------
provision_identity() {
  local APP_NAME="$1"
  local CREDENTIAL_NAME="$2"
  local GITHUB_ENVIRONMENT="$3"
  # Receive the 4 known RG names for this environment
  local APP_RG="$4"
  local NETWORK_RG="$5"
  local ANALYTICS_RG="$6"
  local DB_RG="$7"
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
  # Role assignments (least-privilege)
  #
  # Custom role at subscription scope: allows ARM subscription-level deployments
  # (az deployment sub create) and resource group creation/reads. Does NOT grant
  # resource-level write access inside existing RGs.
  #
  # Contributor scoped to each of the 4 known RGs: required for
  # az deployment group create to create/update resources inside those RGs.
  # The specific RG names are passed in as parameters to this function.
  #
  # User Access Administrator on the KV resource group: the Bicep kv-setup-module
  # creates Microsoft.Authorization/roleAssignments on KV secrets (granting the
  # app's managed identity access). Contributor does not include
  # Microsoft.Authorization/roleAssignments/write; User Access Administrator
  # scoped to the KV RG provides the minimum required permission.
  # ---------------------------------------------------------------------------
  local SUBSCRIPTION_SCOPE="/subscriptions/${SUBSCRIPTION_ID}"

  # Ensure the custom role exists before assigning it
  ensure_custom_deploy_role "$SUBSCRIPTION_ID"

  echo "==> Checking '$CUSTOM_ROLE_NAME' role assignment at subscription scope..."
  ensure_role_assignment "$SP_ID" "$CUSTOM_ROLE_NAME" "$SUBSCRIPTION_SCOPE"

  # Contributor on each of the 4 known resource groups
  echo "==> Checking Contributor role assignments on the 4 known resource groups..."
  for RG_NAME in "$APP_RG" "$NETWORK_RG" "$ANALYTICS_RG" "$DB_RG"; do
    local RG_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RG_NAME}"
    echo "    RG: $RG_NAME"
    ensure_role_assignment "$SP_ID" "Contributor" "$RG_SCOPE"
  done

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

  # Ensure the custom KV role exists before assigning it
  ensure_kv_role_assignment_role "$SUBSCRIPTION_ID"

  # Scope to the KV resource itself (not the whole RG) to minimise privilege escalation surface
  local KV_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${KV_RG}/providers/Microsoft.KeyVault/vaults/${KV_NAME}"
  echo "==> Checking '$KV_ROLE_ASSIGNMENT_ROLE_NAME' on Key Vault ${KV_NAME}..."
  ensure_role_assignment "$SP_ID" "$KV_ROLE_ASSIGNMENT_ROLE_NAME" "$KV_SCOPE"

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
# Validate required RG env vars and dispatch
# ---------------------------------------------------------------------------
case "$TARGET" in
  main)
    for VAR in AZ_MAIN_APP_RG AZ_MAIN_NETWORK_RG AZ_MAIN_ANALYTICS_RG AZ_MAIN_DB_RG; do
      if [[ -z "${!VAR:-}" ]]; then
        echo "ERROR: $VAR is required when provisioning the main environment." >&2
        exit 1
      fi
    done
    provision_identity "cams-deploy-main-oidc" "gha-deploy-main" "deploy-main" \
      "$AZ_MAIN_APP_RG" "$AZ_MAIN_NETWORK_RG" "$AZ_MAIN_ANALYTICS_RG" "$AZ_MAIN_DB_RG"
    ;;
  branch)
    for VAR in AZ_BRANCH_APP_RG AZ_BRANCH_NETWORK_RG AZ_BRANCH_ANALYTICS_RG AZ_BRANCH_DB_RG; do
      if [[ -z "${!VAR:-}" ]]; then
        echo "ERROR: $VAR is required when provisioning the branch environment." >&2
        exit 1
      fi
    done
    provision_identity "cams-deploy-branch-oidc" "gha-deploy-branch" "deploy-branch" \
      "$AZ_BRANCH_APP_RG" "$AZ_BRANCH_NETWORK_RG" "$AZ_BRANCH_ANALYTICS_RG" "$AZ_BRANCH_DB_RG"
    ;;
  all)
    for VAR in AZ_MAIN_APP_RG AZ_MAIN_NETWORK_RG AZ_MAIN_ANALYTICS_RG AZ_MAIN_DB_RG \
               AZ_BRANCH_APP_RG AZ_BRANCH_NETWORK_RG AZ_BRANCH_ANALYTICS_RG AZ_BRANCH_DB_RG; do
      if [[ -z "${!VAR:-}" ]]; then
        echo "ERROR: $VAR is required when provisioning both environments (TARGET=all)." >&2
        exit 1
      fi
    done
    provision_identity "cams-deploy-main-oidc" "gha-deploy-main" "deploy-main" \
      "$AZ_MAIN_APP_RG" "$AZ_MAIN_NETWORK_RG" "$AZ_MAIN_ANALYTICS_RG" "$AZ_MAIN_DB_RG"
    provision_identity "cams-deploy-branch-oidc" "gha-deploy-branch" "deploy-branch" \
      "$AZ_BRANCH_APP_RG" "$AZ_BRANCH_NETWORK_RG" "$AZ_BRANCH_ANALYTICS_RG" "$AZ_BRANCH_DB_RG"
    ;;
  *)
    echo "ERROR: Unknown TARGET='$TARGET'. Use main, branch, or omit for all." >&2
    exit 1
    ;;
esac
