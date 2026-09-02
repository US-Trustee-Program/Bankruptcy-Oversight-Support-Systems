#!/usr/bin/env bash
# Shared helpers for OIDC federated credential runbook scripts.
# Source this file from individual runbooks; do not execute it directly.
#
# Exports:
#   GITHUB_ORG   - GitHub organization (override via env var)
#   GITHUB_REPO  - GitHub repository name (override via env var)
#   DEPLOYMENT_STACK_DENY_SETTING_ROLE_NAME - shared custom role display name
#   lookup_or_create_app        APP_NAME  -> prints app (client) ID to stdout
#   lookup_or_create_sp         APP_ID    -> prints SP object ID to stdout
#   upsert_federated_credential APP_ID CREDENTIAL_NAME SUBJECT
#   set_github_environment_secret ENVIRONMENT SECRET_NAME VALUE
#   wait_for_role_definition    ROLE_NAME [ATTEMPTS] -> prints role definition GUID to stdout
#   ensure_role_assignment      SP_ID ROLE SCOPE
#   ensure_deployment_stack_deny_setting_role SUBSCRIPTION_ID -> prints role definition GUID to stdout
#   require_var                 VALUE ENV_VAR_NAME CONTEXT -> exits 10 (validation error, see consuming
#                                script's Exitcodes header) with a consistent error if VALUE is empty

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "ERROR: This script must be sourced, not executed directly." >&2
  exit 1
fi

GITHUB_ORG="${GITHUB_ORG:-US-Trustee-Program}"
GITHUB_REPO="${GITHUB_REPO:-Bankruptcy-Oversight-Support-Systems}"

# Custom role name shared by every identity that creates or deletes an Azure
# Deployment Stack with --deny-settings-mode denyDelete -- see
# ensure_deployment_stack_deny_setting_role below.
DEPLOYMENT_STACK_DENY_SETTING_ROLE_NAME="CAMS Deployment Stack Deny Setting Operator"

if [[ ! "$GITHUB_ORG" =~ ^[A-Za-z0-9_-]+$ ]] || [[ ! "$GITHUB_REPO" =~ ^[A-Za-z0-9_.-]+$ ]]; then
  echo "ERROR: GITHUB_ORG ('$GITHUB_ORG') or GITHUB_REPO ('$GITHUB_REPO') contains unexpected characters." >&2
  echo "       These values control the OIDC trust boundary. Set them intentionally." >&2
  exit 1
fi

# Fails fast with a consistent message if VALUE is empty. Replaces the
# `if [[ -z "$VAR" ]]; then echo "ERROR: ..."; exit 1; fi` shape that had
# accumulated across both runbooks in this directory (7 near-identical
# occurrences) as each new required variable was added independently.
# Exits 10 rather than 1 -- matches the "10+ Validation check errors" bucket
# already established by sibling scripts (e.g. az-delete-branch-resources.sh),
# distinct from the invalid-usage/configuration errors (exit 1) elsewhere in
# these two runbooks.
require_var() {
  local value="$1"
  local env_var_name="$2"
  local context="$3"
  if [[ -z "$value" ]]; then
    echo "ERROR: ${env_var_name} is required ${context}." >&2
    exit 10
  fi
}

# Look up an app registration by display name, or create one if absent.
# Fails with exit 1 if multiple registrations share the display name to prevent
# silently binding to the wrong app in tenants with naming collisions.
# Progress messages go to stderr; the app (client) ID is printed to stdout.
lookup_or_create_app() {
  local APP_NAME="$1"
  local APP_IDS COUNT=0
  APP_IDS=$(az ad app list --display-name "$APP_NAME" --query "[].appId" -o tsv)
  if [[ -n "$APP_IDS" ]]; then
    COUNT=$(printf '%s\n' "$APP_IDS" | wc -l | tr -d ' ')
  fi
  if [[ "$COUNT" -gt 1 ]]; then
    echo "ERROR: Found $COUNT app registrations with display name '$APP_NAME'." >&2
    echo "       Resolve the name conflict before running this script:" >&2
    printf '%s\n' "$APP_IDS" >&2
    return 1
  fi
  if [[ "$COUNT" -eq 0 ]]; then
    echo "    Not found — creating..." >&2
    local NEW_ID
    NEW_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
    echo "    Created app (client) ID: $NEW_ID" >&2
    printf '%s' "$NEW_ID"
  else
    echo "    Found existing app (client) ID: $APP_IDS" >&2
    printf '%s' "$APP_IDS"
  fi
}

# Look up or create the service principal for an app registration.
# Progress messages go to stderr; the SP object ID is printed to stdout.
lookup_or_create_sp() {
  local APP_ID="$1"
  local SP_ID
  SP_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv 2>/dev/null || true)
  if [[ -z "$SP_ID" ]]; then
    echo "    Not found — creating..." >&2
    SP_ID=$(az ad sp create --id "$APP_ID" --query id -o tsv)
    echo "    Created service principal object ID: $SP_ID" >&2
  else
    echo "    Found existing service principal object ID: $SP_ID" >&2
  fi
  printf '%s' "$SP_ID"
}

# Add or update a single federated credential on an app registration.
# Idempotent: updates if a credential with the given name already exists.
upsert_federated_credential() {
  local APP_ID="$1"
  local CREDENTIAL_NAME="$2"
  local SUBJECT="$3"
  local CREDENTIAL_ID
  CREDENTIAL_ID=$(az ad app federated-credential list \
    --id "$APP_ID" \
    --query "[?name=='${CREDENTIAL_NAME}'].id" -o tsv)
  if [[ -n "$CREDENTIAL_ID" ]]; then
    az ad app federated-credential update \
      --id "$APP_ID" \
      --federated-credential-id "$CREDENTIAL_ID" \
      --parameters "{
        \"name\": \"${CREDENTIAL_NAME}\",
        \"issuer\": \"https://token.actions.githubusercontent.com\",
        \"subject\": \"${SUBJECT}\",
        \"audiences\": [\"api://AzureADTokenExchange\"]
      }"
    echo "    Federated credential '$CREDENTIAL_NAME' updated (subject: $SUBJECT)"
  else
    az ad app federated-credential create \
      --id "$APP_ID" \
      --parameters "{
        \"name\": \"${CREDENTIAL_NAME}\",
        \"issuer\": \"https://token.actions.githubusercontent.com\",
        \"subject\": \"${SUBJECT}\",
        \"audiences\": [\"api://AzureADTokenExchange\"]
      }"
    echo "    Federated credential '$CREDENTIAL_NAME' created (subject: $SUBJECT)"
  fi
}

# Set a secret in a GitHub Actions environment using the gh CLI.
# Requires gh CLI authenticated with secrets:write scope.
set_github_environment_secret() {
  local ENVIRONMENT="$1"
  local SECRET_NAME="$2"
  local VALUE="$3"
  echo "==> Setting GitHub secret $SECRET_NAME in environment '$ENVIRONMENT'..."
  if gh secret set "$SECRET_NAME" \
      --env "$ENVIRONMENT" \
      --repo "${GITHUB_ORG}/${GITHUB_REPO}" \
      --body "$VALUE" 2>/dev/null; then
    echo "    Set."
  else
    echo "    WARNING: Failed to set $SECRET_NAME in environment '$ENVIRONMENT'." >&2
    echo "    Set it manually: gh secret set $SECRET_NAME --env $ENVIRONMENT --body \"$VALUE\"" >&2
  fi
}

# Resolve a custom role definition's GUID by display name, echoing it on stdout.
# A freshly-created role does not appear via the server-side `--name` filter for
# some time (propagation lag), which makes `az role assignment create --role
# "<display name>"` fail with "Role '...' doesn't exist." A client-side
# roleName filter over `--custom-role-only` resolves the GUID immediately, so we
# poll that and return the ID for the caller to assign by GUID. All progress
# output goes to stderr so stdout carries only the GUID.
wait_for_role_definition() {
  local ROLE_NAME="$1"
  local attempts="${2:-30}" # ~30 * 5s = 2.5 min max
  local i id
  for ((i = 1; i <= attempts; i++)); do
    id=$(az role definition list --custom-role-only true \
      --query "[?roleName=='${ROLE_NAME}'].name | [0]" -o tsv 2>/dev/null || true)
    if [[ -n "$id" ]]; then
      echo "$id"
      return 0
    fi
    echo "    Waiting for role definition '$ROLE_NAME' to propagate ($i/$attempts)..." >&2
    sleep 5
  done
  # Fail CLOSED. Returning 0 here used to hand the caller an EMPTY stdout, which
  # every caller assigns straight into a ROLE_ID and passes to
  # ensure_role_assignment as `--role ""`. set -e does abort on the resulting
  # `az role assignment create` failure, so nothing silently half-applied -- but
  # the operator saw an az usage error about an empty role rather than the
  # propagation timeout that actually caused it. Exiting here names the real
  # cause at the point it happens. Exit 12 = infrastructure/propagation error,
  # distinct from require_var's 10 (validation); see the consuming script's
  # Exitcodes header.
  echo "ERROR: role definition '$ROLE_NAME' still not resolvable after ${attempts} attempts (~$((attempts * 5))s)." >&2
  echo "       The role was created but has not propagated. Re-run this script -- it is" >&2
  echo "       idempotent and will pick up the existing definition." >&2
  exit 12
}

# Idempotent role assignment: assigns ROLE at SCOPE to SP_ID if not already present.
ensure_role_assignment() {
  local SP_ID="$1"
  local ROLE="$2"
  local SCOPE="$3"
  local EXISTING
  EXISTING=$(az role assignment list \
    --assignee "$SP_ID" \
    --role "$ROLE" \
    --scope "$SCOPE" \
    --query "[0].id" -o tsv 2>/dev/null || true)
  if [[ -z "$EXISTING" ]]; then
    az role assignment create \
      --assignee-object-id "$SP_ID" \
      --assignee-principal-type ServicePrincipal \
      --role "$ROLE" \
      --scope "$SCOPE" \
      --output none
    echo "    '$ROLE' assigned at scope."
  else
    echo "    '$ROLE' already assigned — skipping."
  fi
}

# Create or skip the deployment-stack deny-setting operator role (idempotent).
#
# Grants only Microsoft.Resources/deploymentStacks/manageDenySetting/action.
# Required by any identity that CREATES an Azure Deployment Stack with
# --deny-settings-mode denyDelete (azure-deploy-network.sh, azure-deploy.sh)
# or DELETES one (az-delete-branch-resources.sh's az stack group delete) --
# both directions need this action, each in whatever resource group(s) that
# identity operates on. Contributor does not include this action, and
# Azure's own built-in "Deployment Stack Contributor" role deliberately
# excludes it too — only "Deployment Stack Owner" includes it, which also
# grants unrelated deploymentStacks actions (delete, etc.) these identities
# don't need. A narrow custom role avoids that broader grant. Shared here
# (not duplicated per runbook) since the deploy and teardown identities both
# need the exact same role, just assigned at different scopes.
#
# Echoes the role definition GUID on stdout (progress goes to stderr) so the
# caller can assign by ID rather than the lagging display-name filter.
ensure_deployment_stack_deny_setting_role() {
  local SUBSCRIPTION_ID="$1"

  echo "==> Checking custom role: '$DEPLOYMENT_STACK_DENY_SETTING_ROLE_NAME'..." >&2
  local ROLE_ID
  ROLE_ID=$(az role definition list --custom-role-only true \
    --query "[?roleName=='${DEPLOYMENT_STACK_DENY_SETTING_ROLE_NAME}'].name | [0]" -o tsv 2>/dev/null || true)

  if [[ -n "$ROLE_ID" ]]; then
    echo "    Custom role already exists, skipping creation." >&2
    echo "$ROLE_ID"
    return
  fi

  echo "    Creating custom role '$DEPLOYMENT_STACK_DENY_SETTING_ROLE_NAME'..." >&2
  az role definition create --role-definition "$(cat <<EOF
{
  "Name": "${DEPLOYMENT_STACK_DENY_SETTING_ROLE_NAME}",
  "Description": "Allows CAMS branch deploy and teardown identities to manage deny settings on Azure Deployment Stacks. Required for --deny-settings-mode denyDelete on both stack creation (azure-deploy-network.sh, azure-deploy.sh) and stack deletion (az-delete-branch-resources.sh). Narrower than the built-in Deployment Stack Owner role.",
  "Actions": [
    "Microsoft.Resources/deploymentStacks/manageDenySetting/action"
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
  ROLE_ID=$(wait_for_role_definition "$DEPLOYMENT_STACK_DENY_SETTING_ROLE_NAME")
  echo "$ROLE_ID"
}
