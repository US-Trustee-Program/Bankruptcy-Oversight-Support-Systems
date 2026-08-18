#!/usr/bin/env bash
# TEMPORARY runbook (CAMS-760): federated credential for deploy-branch-narrow-test
#
# Purpose: cams-deploy-branch-oidc (the "deploy-branch" GitHub environment) is
# shared by every branch's CD run. Validating CAMS-760's RG-scoped Contributor
# grant on that shared identity required revoking its old subscription-scope
# Contributor -- but other in-flight branches (e.g. CAMS-856) were built from
# a pre-Task-2 snapshot of main and still make an unconditional
# subscription-scope `az deployment sub create -w` call that only the old
# broad grant covered. Revoking it broke those branches, so the broad grant
# was restored on cams-deploy-branch-oidc to unblock them.
#
# This script provisions a SEPARATE identity + GitHub environment
# (deploy-branch-narrow-test) with the exact narrow grant CAMS-760 validated,
# so this branch's own CD runs can keep exercising least-privilege without
# holding other branches' deploys hostage to it. reusable-deploy.yml is
# temporarily repointed to this environment for this branch only (see the
# CAMS-760 comment there).
#
# RETIREMENT: once PR #2803 (Task 2's skip-logic) merges to main, every
# branch picks up the fix, cams-deploy-branch-oidc's subscription-scope
# Contributor can be revoked for real, reusable-deploy.yml's temporary
# branch-name gate should be removed, and this script plus the
# deploy-branch-narrow-test environment/identity should be deleted.
#
# Required environment variables (same values as setup-deploy-federated-credential.sh's
# branch target):
#   AZ_BRANCH_KV_RG        — resource group containing the dev/branch Key Vault
#   AZ_BRANCH_APP_RG       — stable app resource group branch deploys into
#   AZ_BRANCH_NETWORK_RG   — stable network resource group branch deploys into
#   AZ_BRANCH_ANALYTICS_RG — shared analytics resource group (rg-analytics)
#   AZ_BRANCH_AZURE_RG     — shared app-config/SQL-identity resource group
#
# This script is idempotent — re-running it will update existing resources in place
# rather than creating duplicates.
#
# Override the GitHub org/repo defaults if needed:
#   GITHUB_ORG=MyOrg GITHUB_REPO=MyRepo ./setup-deploy-branch-narrow-test-federated-credential.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/utility/federated-credentials/_oidc-helpers.sh
source "$SCRIPT_DIR/_oidc-helpers.sh"

GITHUB_WORKFLOW="Continuous Deployment"
APP_NAME="cams-deploy-branch-narrow-test-oidc"
CREDENTIAL_NAME="gha-deploy-branch-narrow-test"
GITHUB_ENVIRONMENT="deploy-branch-narrow-test"

BRANCH_KV_NAME="kv-ustp-cams-dev"
BRANCH_KV_RG="${AZ_BRANCH_KV_RG:-}"
BRANCH_APP_RG="${AZ_BRANCH_APP_RG:-}"
BRANCH_NETWORK_RG="${AZ_BRANCH_NETWORK_RG:-}"
BRANCH_ANALYTICS_RG="${AZ_BRANCH_ANALYTICS_RG:-}"
BRANCH_AZURE_RG="${AZ_BRANCH_AZURE_RG:-}"
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
KV_ROLE_ASSIGNMENT_ROLE_NAME="CAMS KV Role Assignment Operator"

require_var "$BRANCH_KV_RG" "AZ_BRANCH_KV_RG" "to provision this identity"
require_var "$BRANCH_APP_RG" "AZ_BRANCH_APP_RG" "to provision this identity"
require_var "$BRANCH_NETWORK_RG" "AZ_BRANCH_NETWORK_RG" "to provision this identity"
require_var "$BRANCH_ANALYTICS_RG" "AZ_BRANCH_ANALYTICS_RG" "to provision this identity"
require_var "$BRANCH_AZURE_RG" "AZ_BRANCH_AZURE_RG" "to provision this identity"

# Mirrors ensure_kv_role_assignment_role in setup-deploy-federated-credential.sh --
# duplicated rather than shared since this whole script is temporary scaffolding
# slated for deletion (see RETIREMENT note above), not a permanent library consumer.
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

echo ""
echo "==================================================================="
echo "  Provisioning $APP_NAME (TEMPORARY -- see retirement note in this script's header)"
echo "==================================================================="

echo "==> Looking up subscription..."
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo "    Subscription: $SUBSCRIPTION_ID"

echo "==> Looking up app registration: $APP_NAME"
APP_ID=$(lookup_or_create_app "$APP_NAME")

echo "==> Looking up service principal for app..."
SP_ID=$(lookup_or_create_sp "$APP_ID")

echo "==> Updating federated identity credential..."
SUBJECT="repo:${GITHUB_ORG}/${GITHUB_REPO}:workflow:${GITHUB_WORKFLOW}:environment:${GITHUB_ENVIRONMENT}"
upsert_federated_credential "$APP_ID" "$CREDENTIAL_NAME" "$SUBJECT"

BRANCH_APP_RG_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${BRANCH_APP_RG}"
BRANCH_NETWORK_RG_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${BRANCH_NETWORK_RG}"
BRANCH_ANALYTICS_RG_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${BRANCH_ANALYTICS_RG}"
BRANCH_AZURE_RG_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${BRANCH_AZURE_RG}"

echo "==> Checking Contributor role assignment on ${BRANCH_APP_RG}..."
ensure_role_assignment "$SP_ID" "Contributor" "$BRANCH_APP_RG_SCOPE"
echo "==> Checking Contributor role assignment on ${BRANCH_NETWORK_RG}..."
ensure_role_assignment "$SP_ID" "Contributor" "$BRANCH_NETWORK_RG_SCOPE"
echo "==> Checking Contributor role assignment on ${BRANCH_ANALYTICS_RG}..."
ensure_role_assignment "$SP_ID" "Contributor" "$BRANCH_ANALYTICS_RG_SCOPE"
echo "==> Checking Contributor role assignment on ${BRANCH_AZURE_RG}..."
ensure_role_assignment "$SP_ID" "Contributor" "$BRANCH_AZURE_RG_SCOPE"

KV_ROLE_ID=$(ensure_kv_role_assignment_role "$SUBSCRIPTION_ID")
KV_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${BRANCH_KV_RG}/providers/Microsoft.KeyVault/vaults/${BRANCH_KV_NAME}"
echo "==> Checking '$KV_ROLE_ASSIGNMENT_ROLE_NAME' on Key Vault ${BRANCH_KV_NAME}..."
ensure_role_assignment "$SP_ID" "$KV_ROLE_ID" "$KV_SCOPE"

echo "==> Checking Key Vault Secrets User role assignments on $BRANCH_KV_NAME (per-secret)..."
for SECRET_NAME in "${KV_SECRETS[@]}"; do
  SECRET_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${BRANCH_KV_RG}/providers/Microsoft.KeyVault/vaults/${BRANCH_KV_NAME}/secrets/${SECRET_NAME}"
  ensure_role_assignment "$SP_ID" "$KV_SECRETS_USER_ROLE" "$SECRET_SCOPE"
done

DENY_SETTING_ROLE_ID=$(ensure_deployment_stack_deny_setting_role "$SUBSCRIPTION_ID")
echo "==> Checking '$DEPLOYMENT_STACK_DENY_SETTING_ROLE_NAME' on ${BRANCH_NETWORK_RG}..."
ensure_role_assignment "$SP_ID" "$DENY_SETTING_ROLE_ID" "$BRANCH_NETWORK_RG_SCOPE"
echo "==> Checking '$DEPLOYMENT_STACK_DENY_SETTING_ROLE_NAME' on ${BRANCH_APP_RG}..."
ensure_role_assignment "$SP_ID" "$DENY_SETTING_ROLE_ID" "$BRANCH_APP_RG_SCOPE"

set_github_environment_secret "$GITHUB_ENVIRONMENT" "AZ_CLIENT_ID" "$APP_ID"

echo ""
echo "==> Done: $APP_NAME"
echo "    AZ_CLIENT_ID in environment '$GITHUB_ENVIRONMENT' = $APP_ID"
