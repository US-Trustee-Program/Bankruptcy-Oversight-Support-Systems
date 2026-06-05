#!/usr/bin/env bash
# Shared helpers for OIDC federated credential runbook scripts.
# Source this file from individual runbooks; do not execute it directly.
#
# Exports:
#   GITHUB_ORG   - GitHub organization (override via env var)
#   GITHUB_REPO  - GitHub repository name (override via env var)
#   lookup_or_create_app        APP_NAME  -> prints app (client) ID to stdout
#   lookup_or_create_sp         APP_ID    -> prints SP object ID to stdout
#   upsert_federated_credential APP_ID CREDENTIAL_NAME SUBJECT
#   set_github_environment_secret ENVIRONMENT SECRET_NAME VALUE

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "ERROR: This script must be sourced, not executed directly." >&2
  exit 1
fi

GITHUB_ORG="${GITHUB_ORG:-US-Trustee-Program}"
GITHUB_REPO="${GITHUB_REPO:-Bankruptcy-Oversight-Support-Systems}"

if [[ ! "$GITHUB_ORG" =~ ^[A-Za-z0-9_-]+$ ]] || [[ ! "$GITHUB_REPO" =~ ^[A-Za-z0-9_.-]+$ ]]; then
  echo "ERROR: GITHUB_ORG ('$GITHUB_ORG') or GITHUB_REPO ('$GITHUB_REPO') contains unexpected characters." >&2
  echo "       These values control the OIDC trust boundary. Set them intentionally." >&2
  exit 1
fi

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
