#!/usr/bin/env bash
# Runbook: Create or update federated credential and scoped roles for dora-metrics.yml
#
# Purpose: Give the DORA Metrics workflow's publish job an OIDC identity that can
#          write report CSVs to the DORA metrics storage account. The identity is granted:
#            - Storage Blob Data Contributor on the dora-metrics CONTAINER only
#              (not the whole account)
#            - Key Vault Secrets User on each individual secret it reads from kv-ustp-cams
#
# The subject claim includes repo, workflow, and environment per the repo OIDC customization
# template (include_claim_keys: ["repo", "workflow", "environment"]). The subject format is:
#   repo:ORG/REPO:workflow:DORA Metrics:environment:dora-metrics
#
# Prerequisites:
#   - az CLI logged in as an Entra ID admin (can create app registrations and role assignments)
#   - The DORA metrics storage account already exists (deploy-dora-metrics-storage.yml)
#   - kv-ustp-cams already exists and contains the secrets listed in KV_SECRETS
#   - The dora-metrics GitHub environment already exists
#
# This script is idempotent — re-running it will update existing resources in place
# rather than creating duplicates.
#
# Override the GitHub org/repo defaults if needed:
#   GITHUB_ORG=MyOrg GITHUB_REPO=MyRepo ./setup-dora-metrics-federated-credential.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/utility/federated-credentials/_oidc-helpers.sh
source "$SCRIPT_DIR/_oidc-helpers.sh"

# ---------------------------------------------------------------------------
# Configuration — update these before running
# ---------------------------------------------------------------------------
STORAGE_ACCOUNT_NAME="${AZ_DORA_METRICS_STORAGE_NAME:?Set AZ_DORA_METRICS_STORAGE_NAME}"
RESOURCE_GROUP="${AZ_DORA_METRICS_RG:?Set AZ_DORA_METRICS_RG}"
CONTAINER_NAME="dora-metrics"
KV_NAME="kv-ustp-cams"
KV_RESOURCE_GROUP="${AZ_MAIN_KV_RG:?Set AZ_MAIN_KV_RG (resource group containing kv-ustp-cams)}"
# KV-Workflows: dora-metrics.yml
# Secrets this workflow reads from the vault — must exist before running
KV_SECRETS=("AZ-DORA-METRICS-STORAGE-NAME")
KV_SECRETS_USER_ROLE="4633458b-17de-408a-b874-0445c86b69e6" # Key Vault Secrets User
GITHUB_WORKFLOW="DORA Metrics"
GITHUB_ENVIRONMENT="dora-metrics"
APP_NAME="cams-dora-metrics-oidc"
CREDENTIAL_NAME="gha-dora-metrics"
# ---------------------------------------------------------------------------

SUBJECT="repo:${GITHUB_ORG}/${GITHUB_REPO}:workflow:${GITHUB_WORKFLOW}:environment:${GITHUB_ENVIRONMENT}"

echo "==> Looking up subscription and tenant..."
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "    Subscription: $SUBSCRIPTION_ID"
echo "    Tenant:       $TENANT_ID"

echo "==> Looking up storage account resource ID..."
STORAGE_ID=$(az storage account show \
  --name "$STORAGE_ACCOUNT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query id -o tsv)
CONTAINER_SCOPE="${STORAGE_ID}/blobServices/default/containers/${CONTAINER_NAME}"
echo "    Container scope: $CONTAINER_SCOPE"

echo "==> Looking up app registration: $APP_NAME"
APP_ID=$(lookup_or_create_app "$APP_NAME")

echo "==> Looking up service principal for app..."
SP_ID=$(lookup_or_create_sp "$APP_ID")

echo "==> Updating federated identity credential..."
upsert_federated_credential "$APP_ID" "$CREDENTIAL_NAME" "$SUBJECT"

echo "==> Checking Storage Blob Data Contributor role assignment (container scope)..."
ensure_role_assignment "$SP_ID" "Storage Blob Data Contributor" "$CONTAINER_SCOPE"

echo "==> Checking Key Vault Secrets User role assignments (per-secret)..."
for SECRET_NAME in "${KV_SECRETS[@]}"; do
  SECRET_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${KV_RESOURCE_GROUP}/providers/Microsoft.KeyVault/vaults/${KV_NAME}/secrets/${SECRET_NAME}"
  ensure_role_assignment "$SP_ID" "$KV_SECRETS_USER_ROLE" "$SECRET_SCOPE"
done

set_github_environment_secret "$GITHUB_ENVIRONMENT" "AZ_CLIENT_ID" "$APP_ID"

echo ""
echo "==> Done."
echo "    AZ_CLIENT_ID in environment '$GITHUB_ENVIRONMENT' = $APP_ID"
