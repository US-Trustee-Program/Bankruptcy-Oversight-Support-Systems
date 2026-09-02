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
# Exitcodes
# ==========
# 0   No error
# 1   Invalid usage (unknown TARGET, or an internal invariant violation)
# 10+ Validation check errors
#     10  a required environment variable is missing -- see require_var in
#         _oidc-helpers.sh
#     11  a required prerequisite Azure resource does not exist yet -- see the
#         law-cams-branches workspace check in provision_identity
#
# Permissions granted:
#   - main: Contributor at subscription scope. Covers az deployment sub
#       create, resource group creation/reads, and az deployment group create
#       inside whatever resource groups this identity deploys to.
#   - branch: Contributor scoped to four stable resource groups instead of the
#       whole subscription -- exactly the same four RGs main's own grant
#       already covers:
#         AZ_BRANCH_APP_RG       -- rg-cams-app-dev; branch-only, distinct from
#         AZ_BRANCH_NETWORK_RG   -- rg-cams-network-dev; main's unsuffixed
#                                   rg-cams-app/rg-cams-network
#         AZ_BRANCH_ANALYTICS_RG -- rg-analytics; shared with main
#         AZ_BRANCH_AZURE_RG     -- bankruptcy-oversight-support-systems;
#                                   shared with main (see below)
#       Branch resource groups used to be created dynamically per-hash
#       (Azure RBAC has no wildcard scoping over dynamic names), which forced
#       subscription-scope Contributor here too. CAMS-760 Slices 1-2 moved
#       branch's app/network deploys onto the same two stable RGs main uses
#       (distinguished by per-branch-unique resource names instead of a
#       per-branch RG), so branch can now be pre-scoped like main is. The
#       other two RGs (analytics, azure/shared-config) were never
#       per-branch -- every branch deploy already writes into them today
#       (azure-deploy-app-shared-setup.sh's KV/managed-identity setup, and the
#       branch-only Log Analytics Workspace deploy in reusable-deploy.yml) --
#       so they must be included in branch's scoped grant too, or narrowing
#       Contributor down to just the app/network RGs would break those two
#       steps on every branch deploy once the old subscription-scope grant is
#       revoked. Confirmed via a full static trace of every az CLI call the
#       deploy-branch identity makes across a branch deploy (cams-aolb notes,
#       2026-08-18) before revoking anything live.
#   - Custom role "CAMS KV Role Assignment Operator" on the KV resource
#       (main and branch, identical): the Bicep kv-setup-module creates
#       Microsoft.Authorization/roleAssignments on KV secrets; Contributor
#       does not include roleAssignments/write. Scoped to the KV resource
#       (not the RG) to minimise privilege escalation surface.
#   - Key Vault Secrets User on each individual KV secret (main and branch, identical)
#   - Custom role "CAMS Deployment Stack Deny Setting Operator" on the same two
#       branch resource groups (AZ_BRANCH_APP_RG, AZ_BRANCH_NETWORK_RG; branch
#       only): both azure-deploy-network.sh (network resources) and
#       azure-deploy.sh (app resources, main.bicep) deploy their branch
#       resources as an Azure Deployment Stack with --deny-settings-mode
#       denyDelete. Microsoft.Resources/deploymentStacks/manageDenySetting/action
#       is not part of Contributor, and Azure's own built-in "Deployment Stack
#       Contributor" role deliberately excludes it too (only "Deployment Stack
#       Owner" — a much broader grant — includes it).
#   - Custom role "CAMS Analytics Role Assignment Operator" on the shared
#       law-cams-branches Log Analytics WORKSPACE RESOURCE (branch only):
#       app-shared-setup.bicep's sharedAnalyticsReaderRoleAssignment module
#       (app-shared-setup.bicep:360) creates a
#       Microsoft.Authorization/roleAssignments granting the app-config managed
#       identity Log Analytics Reader on that workspace, so the dev-tier ACS
#       bounce poller can query it. That module is gated on isDevTier, which is
#       !(createAlerts || isUstpDeployment) -- and reusable-deploy.yml sets
#       createAlerts=false for every non-Main-Gov deploy, so isDevTier is true
#       and the module fires on EVERY branch deploy. Same root cause as the KV
#       role above: Contributor's notActions exclude
#       Microsoft.Authorization/*/Write, so NONE of the four RG-scoped
#       Contributor grants can perform this write -- including the one on
#       rg-analytics. Scoped to the workspace resource, which is the exact
#       scope the Bicep roleAssignment targets (`scope: workspace` in
#       lib/analytics/log-analytics-reader-role-assignment.bicep), and
#       deliberately NOT to rg-analytics, so the grant cannot hand out roles on
#       anything else in that shared resource group (law-ustp-cams, the
#       per-branch law-ustp-cams-dev-* workspaces, the shared action group, the
#       shared bounce alert rule).
#       Why a SECOND custom role instead of reusing "CAMS KV Role Assignment
#       Operator": the two carry the identical three actions and differ only in
#       intended target, but the role NAME is what an auditor reading
#       `az role assignment list` actually sees, and a "KV Role Assignment
#       Operator" grant sitting on a Log Analytics workspace reads as a
#       misconfiguration someone would eventually "clean up". The role
#       description is likewise the only place the per-grant rationale lives,
#       and one shared role can only carry one. The shared create-or-return
#       plumbing is factored into ensure_role_assignment_operator_role below
#       rather than duplicated.
#
#       SEQUENCING — read this before revoking anything: branch deploys succeed
#       today only because cams-deploy-branch-oidc holds the built-in "Role
#       Based Access Control Administrator" on rg-analytics, an out-of-band
#       grant created by no script in this repo. This narrower grant must exist
#       AND be validated by a green branch deploy BEFORE that RBAC
#       Administrator grant is revoked. Revoke first and every branch deploy
#       fails at the app-shared-setup step. As everywhere else here, this
#       script only grants — it never revokes.
#
# NOTE on least privilege: this script only GRANTS — it never revokes. Cutting
# branch over from its former subscription-scope Contributor (plus, historically,
# User Access Administrator) to the RG-scoped grant above requires a manual,
# out-of-band runbook procedure, because Azure RBAC is additive across scopes:
# as long as the old subscription-scope grant still exists, the new RG-scoped
# grant is a complete no-op for permission-checking purposes, so the old grant
# must be revoked before the new scope's sufficiency can even be verified. See
# branch-deploy-shared-rgs.slice-3-prompts.md (Manual Runbook Procedure) in the
# ustp-cams-fdp spec repo for the exact grant -> revoke -> verify -> rollback
# sequence, including live-Azure cleanup of orphaned grants left over from an
# earlier, abandoned per-RG RBAC design.
#
# Prerequisites:
#   - az CLI logged in as an Entra ID admin (can create app registrations and role assignments)
#   - The Azure subscription already exists
#
# Required environment variables:
#   AZ_MAIN_KV_RG          — resource group containing the main Key Vault
#   AZ_BRANCH_KV_RG        — resource group containing the dev/branch Key Vault
#   AZ_BRANCH_APP_RG       — stable app resource group branch deploys into
#                            (branch only; also where the deny-setting role is granted)
#   AZ_BRANCH_NETWORK_RG   — stable network resource group branch deploys into
#                            (branch only; also where the deny-setting role is granted)
#   AZ_BRANCH_ANALYTICS_RG — shared analytics resource group (rg-analytics) every
#                            branch deploy also writes into (branch only); also
#                            the resource group holding the law-cams-branches
#                            workspace that the analytics role-assignment
#                            operator role is granted on (see above)
#   AZ_BRANCH_AZURE_RG     — shared app-config/SQL-identity resource group every
#                            branch deploy also writes into (branch only)
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
# Stable resource groups every branch deploys into (CAMS-760 Slice 3).
# App/network are branch-only (rg-cams-app-dev/rg-cams-network-dev, distinct
# from main's own rg-cams-app/rg-cams-network); analytics and azure/shared-
# config are the SAME two RGs main already writes into (rg-analytics,
# bankruptcy-oversight-support-systems) -- every branch deploy also writes
# there today (the branch-only Log Analytics Workspace deploy, and the
# app-shared-setup KV/managed-identity setup that runs for every deploy
# regardless of branch/main), confirmed by tracing every az CLI call the
# deploy-branch identity makes across reusable-deploy.yml. App/network are
# also reused below for the deny-setting role grant (see
# ensure_deployment_stack_deny_setting_role), which analytics/azure never need
# because those two deployments are always plain (never stacked). Analytics is
# reused once more, for the analytics role-assignment operator grant below --
# but that one is scoped to a single workspace resource INSIDE this RG, not to
# the RG itself. Azure/shared-config is Contributor plus the KV grants only.
BRANCH_APP_RG="${AZ_BRANCH_APP_RG:-}"
BRANCH_NETWORK_RG="${AZ_BRANCH_NETWORK_RG:-}"
BRANCH_ANALYTICS_RG="${AZ_BRANCH_ANALYTICS_RG:-}"
BRANCH_AZURE_RG="${AZ_BRANCH_AZURE_RG:-}"
# Shared dev-tier ACS bounce-poll Log Analytics workspace that every branch
# deploy creates a role assignment on. Also hardcoded (as
# sharedBounceWorkspaceName) in app-shared-setup.bicep:261, where it is a fixed
# var, not a param -- can't share the literal across bash/bicep, keep both in
# lockstep by hand. Deliberately NOT an env var: in Bicep this name can never
# vary by environment (it is a var, not a param), so an env var would offer
# configurability that does not exist while adding a way to typo the grant onto
# a scope that does not resolve. Matches how MAIN_KV_NAME/BRANCH_KV_NAME are
# handled here too -- resource NAMES are literals in this script, only their
# resource groups come from the environment.
BRANCH_ANALYTICS_WORKSPACE_NAME="law-cams-branches"
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
  "AZ-FUNCTIONS-PLAN-TYPE"
  "AZ-FUNCTIONS-LOCATION"
  "ADMIN-NOTIFICATION-EMAIL"
  "DEFAULT-NOTIFICATION-RECIPIENT"
)
KV_SECRETS_USER_ROLE="4633458b-17de-408a-b874-0445c86b69e6" # Key Vault Secrets User (built-in role GUID)

# Custom role name for KV role assignment operations (replaces User Access Administrator)
KV_ROLE_ASSIGNMENT_ROLE_NAME="CAMS KV Role Assignment Operator"
# Custom role name for the shared-analytics-workspace role assignment the
# dev-tier (== branch) path of app-shared-setup.bicep creates. Separate from the
# KV role above despite carrying identical actions -- see the header for why the
# display name is worth a second role definition.
ANALYTICS_ROLE_ASSIGNMENT_ROLE_NAME="CAMS Analytics Role Assignment Operator"
# DEPLOYMENT_STACK_DENY_SETTING_ROLE_NAME and ensure_deployment_stack_deny_setting_role
# come from _oidc-helpers.sh -- shared with setup-remove-branch-federated-credential.sh,
# which needs the identical role for the teardown (delete) side of the same
# --deny-settings-mode denyDelete requirement.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Helper: create or skip a "role assignment operator" custom role (idempotent)
#
# Grants only Microsoft.Authorization/roleAssignments write/read/delete,
# replacing the overly broad User Access Administrator / Role Based Access
# Control Administrator that these identities used to be handed for the same
# jobs. Every Bicep template this repo deploys that creates a roleAssignment
# needs exactly these three actions at exactly one resource scope, so the
# action list is fixed here rather than parameterised -- a caller wanting a
# different action set wants a different function (see
# ensure_deployment_stack_deny_setting_role in _oidc-helpers.sh, deliberately
# left standalone: different action, and shared with the teardown runbook).
#
# ROLE_NAME and ROLE_DESCRIPTION are per-role because they are the ONLY record
# of which resource a given grant is meant for -- Azure enforces nothing about
# that intent, so the display name an auditor sees next to the scope in
# `az role assignment list` has to carry it. Neither may contain a double quote
# or a '$'; both are interpolated straight into the JSON heredoc below.
#
# Echoes the role definition GUID on stdout (progress goes to stderr) so the
# caller can assign by ID rather than the lagging display-name filter.
# ---------------------------------------------------------------------------
ensure_role_assignment_operator_role() {
  local ROLE_NAME="$1"
  local ROLE_DESCRIPTION="$2"
  local SUBSCRIPTION_ID="$3"

  echo "==> Checking custom role: '$ROLE_NAME'..." >&2
  local ROLE_ID
  ROLE_ID=$(az role definition list --custom-role-only true \
    --query "[?roleName=='${ROLE_NAME}'].name | [0]" -o tsv 2>/dev/null || true)

  if [[ -n "$ROLE_ID" ]]; then
    echo "    Custom role already exists, skipping creation." >&2
    echo "$ROLE_ID"
    return
  fi

  echo "    Creating custom role '$ROLE_NAME'..." >&2
  az role definition create --role-definition "$(cat <<EOF
{
  "Name": "${ROLE_NAME}",
  "Description": "${ROLE_DESCRIPTION}",
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
  ROLE_ID=$(wait_for_role_definition "$ROLE_NAME")
  echo "$ROLE_ID"
}

# Required because the Bicep kv-setup-module creates roleAssignments on KV
# secrets (granting the app's managed identity access), and Contributor does
# not include roleAssignments/write. Description text is unchanged from when
# this role was created live -- the lookup above short-circuits on name, so
# editing it here would silently NOT update the existing role definition.
ensure_kv_role_assignment_role() {
  ensure_role_assignment_operator_role \
    "$KV_ROLE_ASSIGNMENT_ROLE_NAME" \
    "Allows CAMS deploy identities to create role assignments on Key Vault secrets only. Required for Bicep kv-setup-module. Replaces User Access Administrator to limit privilege escalation surface." \
    "$1"
}

# Required because app-shared-setup.bicep's sharedAnalyticsReaderRoleAssignment
# module (app-shared-setup.bicep:360) creates a roleAssignment on the shared
# law-cams-branches workspace on every branch deploy, and Contributor does not
# include roleAssignments/write. See the header for the full rationale, the
# reason this is a separate role from the KV one, and the sequencing constraint
# against the out-of-band Role Based Access Control Administrator grant.
ensure_analytics_role_assignment_role() {
  ensure_role_assignment_operator_role \
    "$ANALYTICS_ROLE_ASSIGNMENT_ROLE_NAME" \
    "Allows the CAMS deploy-branch identity to create the Log Analytics Reader role assignment that app-shared-setup.bicep creates on the shared dev-tier bounce workspace (law-cams-branches) on every branch deploy. Required because Contributor excludes Microsoft.Authorization/roleAssignments/write. Assigned to the workspace resource only, replacing an out-of-band Role Based Access Control Administrator grant on the whole analytics resource group." \
    "$1"
}

# ---------------------------------------------------------------------------
# Helper: idempotent app registration + service principal + federated credential
# ---------------------------------------------------------------------------
provision_identity() {
  local APP_NAME="$1"
  local CREDENTIAL_NAME="$2"
  local GITHUB_ENVIRONMENT="$3"
  # Explicit main/branch signal for control flow below, rather than
  # re-deriving it by pattern-matching GITHUB_ENVIRONMENT (which exists to
  # build the OIDC subject claim, not to drive dispatch) — the dispatch case
  # block at the bottom of this script already knows unambiguously which
  # target it's calling for, so it passes that here directly instead of
  # everyone downstream re-parsing a string for the same answer.
  local IS_MAIN="$4"
  local SUBJECT="repo:${GITHUB_ORG}/${GITHUB_REPO}:workflow:${GITHUB_WORKFLOW}:environment:${GITHUB_ENVIRONMENT}"

  if [[ "$IS_MAIN" != "true" && "$IS_MAIN" != "false" ]]; then
    echo "ERROR: provision_identity's IS_MAIN argument must be 'true' or 'false', got '$IS_MAIN'." >&2
    exit 1
  fi

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
  # Contributor: main gets subscription scope; branch gets Contributor scoped
  # to just its four stable resource groups (CAMS-760 Slice 3) instead of the
  # whole subscription -- see the header for exactly which four and why. This
  # is branch's actual least-privilege payoff: branch's resource groups used
  # to be created dynamically per-hash, which forced subscription-scope
  # Contributor here (Azure RBAC has no wildcard scoping); now that they're
  # stable, branch can be pre-scoped like main already could have been.
  # Main's own subscription-scope grant is NOT defended as necessary here --
  # main's four resource groups are equally static and known, so main likely
  # doesn't need standing subscription-scope Contributor either. That cleanup
  # is real but deliberately out of scope for this script's branch-focused
  # change; see cams-y8s2 for the live-Azure audit and decision on narrowing
  # main separately. This call only ever ADDS grants — see the header NOTE on
  # least privilege for why revoking branch's former subscription-scope grant
  # is a separate, manual, out-of-band step, not something this script does.
  #
  # KV role assignment operator (custom role) on the KV resource: the Bicep
  # kv-setup-module creates Microsoft.Authorization/roleAssignments on KV secrets
  # (granting the app's managed identity access). Contributor does not include
  # Microsoft.Authorization/roleAssignments/write; the custom role scoped to the
  # KV resource provides the minimum required permission.
  # ---------------------------------------------------------------------------
  local SUBSCRIPTION_SCOPE="/subscriptions/${SUBSCRIPTION_ID}"

  if [[ "$IS_MAIN" == "true" ]]; then
    echo "==> Checking Contributor role assignment at subscription scope..."
    ensure_role_assignment "$SP_ID" "Contributor" "$SUBSCRIPTION_SCOPE"
  else
    require_var "$BRANCH_APP_RG" "AZ_BRANCH_APP_RG" "when provisioning the branch environment"
    require_var "$BRANCH_NETWORK_RG" "AZ_BRANCH_NETWORK_RG" "when provisioning the branch environment"
    require_var "$BRANCH_ANALYTICS_RG" "AZ_BRANCH_ANALYTICS_RG" "when provisioning the branch environment"
    require_var "$BRANCH_AZURE_RG" "AZ_BRANCH_AZURE_RG" "when provisioning the branch environment"
    local BRANCH_APP_RG_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${BRANCH_APP_RG}"
    local BRANCH_NETWORK_RG_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${BRANCH_NETWORK_RG}"
    local BRANCH_ANALYTICS_RG_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${BRANCH_ANALYTICS_RG}"
    local BRANCH_AZURE_RG_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${BRANCH_AZURE_RG}"
    echo "==> Checking Contributor role assignment on ${BRANCH_APP_RG}..."
    ensure_role_assignment "$SP_ID" "Contributor" "$BRANCH_APP_RG_SCOPE"
    echo "==> Checking Contributor role assignment on ${BRANCH_NETWORK_RG}..."
    ensure_role_assignment "$SP_ID" "Contributor" "$BRANCH_NETWORK_RG_SCOPE"
    echo "==> Checking Contributor role assignment on ${BRANCH_ANALYTICS_RG}..."
    ensure_role_assignment "$SP_ID" "Contributor" "$BRANCH_ANALYTICS_RG_SCOPE"
    echo "==> Checking Contributor role assignment on ${BRANCH_AZURE_RG}..."
    ensure_role_assignment "$SP_ID" "Contributor" "$BRANCH_AZURE_RG_SCOPE"
    echo "    REMINDER: this only ADDS the RG-scoped grants above — if this identity still" >&2
    echo "    also has the old subscription-scope Contributor, that broader grant remains" >&2
    echo "    in effect (Azure RBAC is additive) until revoked via the separate manual" >&2
    echo "    runbook. See the header NOTE on least privilege." >&2
  fi

  # KV role assignment operator on the KV resource + Key Vault Secrets User per secret
  if [[ "$IS_MAIN" == "true" ]]; then
    require_var "$MAIN_KV_RG" "AZ_MAIN_KV_RG" "when provisioning the main environment"
    local KV_NAME="$MAIN_KV_NAME"
    local KV_RG="$MAIN_KV_RG"
  else
    require_var "$BRANCH_KV_RG" "AZ_BRANCH_KV_RG" "when provisioning the branch environment"
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

  # Deployment-stack deny-setting operator on just the app + network RGs
  # (branch only) -- deliberately NOT the analytics/azure RGs too: only the
  # network and app tiers are ever deployed as Azure Deployment Stacks with
  # --deny-settings-mode denyDelete (azure-deploy-network.sh/azure-deploy.sh's
  # is_branch_deployment gates); the analytics and azure/shared-config
  # deploys are always plain (never stacked), so they only ever need
  # Contributor, granted above, and never need manageDenySetting. Main's
  # network and app deploys are never stacked either, so main never needs
  # this action at all. BRANCH_APP_RG/BRANCH_NETWORK_RG and their _SCOPE
  # strings were already validated and computed above for the Contributor
  # grant — reused here rather than re-validated.
  if [[ "$IS_MAIN" == "false" ]]; then
    local DENY_SETTING_ROLE_ID
    DENY_SETTING_ROLE_ID=$(ensure_deployment_stack_deny_setting_role "$SUBSCRIPTION_ID")

    echo "==> Checking '$DEPLOYMENT_STACK_DENY_SETTING_ROLE_NAME' on ${BRANCH_NETWORK_RG}..."
    ensure_role_assignment "$SP_ID" "$DENY_SETTING_ROLE_ID" "$BRANCH_NETWORK_RG_SCOPE"

    echo "==> Checking '$DEPLOYMENT_STACK_DENY_SETTING_ROLE_NAME' on ${BRANCH_APP_RG}..."
    ensure_role_assignment "$SP_ID" "$DENY_SETTING_ROLE_ID" "$BRANCH_APP_RG_SCOPE"
  fi

  # Analytics role-assignment operator on the shared law-cams-branches Log
  # Analytics workspace RESOURCE (branch only, never main). See the header for
  # the full rationale; in short, app-shared-setup.bicep:360 creates a
  # roleAssignment on this workspace on EVERY branch deploy (its isDevTier gate
  # is true whenever createAlerts is false, which reusable-deploy.yml sets for
  # every non-Main-Gov deploy), and Contributor cannot perform that write.
  # Main never needs it: isDevTier is false for main/staging/USTP, whose
  # equivalent grant is standaloneAnalyticsReaderRoleAssignment against their
  # own pre-existing workspace, covered by main's own subscription-scope grant.
  # BRANCH_ANALYTICS_RG was already validated and BRANCH_ANALYTICS_RG_SCOPE
  # computed above for the Contributor grant -- reused here rather than
  # re-validated, same as the deny-setting block does for app/network.
  if [[ "$IS_MAIN" == "false" ]]; then
    # Unlike the Key Vaults above (long-lived, shared, restored by hand when
    # lost), this workspace is created BY the very deploy that then needs the
    # grant -- app-shared-setup.bicep's sharedBounceWorkspace module, using the
    # rg-analytics Contributor grant. So on a fresh subscription the ordering is
    # deploy-once (fails at the role assignment) -> run this script -> redeploy.
    # Checked explicitly because `az role assignment create` against a scope
    # that does not resolve fails with an opaque error, and this ordering is
    # not something a runbook reader would guess.
    local BRANCH_ANALYTICS_WORKSPACE_SCOPE="${BRANCH_ANALYTICS_RG_SCOPE}/providers/Microsoft.OperationalInsights/workspaces/${BRANCH_ANALYTICS_WORKSPACE_NAME}"
    if ! az resource show --ids "$BRANCH_ANALYTICS_WORKSPACE_SCOPE" --output none 2>/dev/null; then
      echo "ERROR: Log Analytics workspace '${BRANCH_ANALYTICS_WORKSPACE_NAME}' not found in ${BRANCH_ANALYTICS_RG}." >&2
      echo "       It is created by app-shared-setup.bicep's sharedBounceWorkspace module on the" >&2
      echo "       first branch deploy. Run one branch deploy (it will fail at the analytics role" >&2
      echo "       assignment), then re-run this script, then redeploy." >&2
      exit 11
    fi

    local ANALYTICS_ROLE_ID
    ANALYTICS_ROLE_ID=$(ensure_analytics_role_assignment_role "$SUBSCRIPTION_ID")

    echo "==> Checking '$ANALYTICS_ROLE_ASSIGNMENT_ROLE_NAME' on workspace ${BRANCH_ANALYTICS_WORKSPACE_NAME}..."
    ensure_role_assignment "$SP_ID" "$ANALYTICS_ROLE_ID" "$BRANCH_ANALYTICS_WORKSPACE_SCOPE"
    echo "    REMINDER: do NOT revoke this identity's out-of-band 'Role Based Access Control" >&2
    echo "    Administrator' on ${BRANCH_ANALYTICS_RG} until a branch deploy has gone green on" >&2
    echo "    the narrower grant above. See the header SEQUENCING note." >&2
  fi

  set_github_environment_secret "$GITHUB_ENVIRONMENT" "AZ_CLIENT_ID" "$APP_ID"

  echo ""
  echo "==> Done: $APP_NAME"
  echo "    AZ_CLIENT_ID in environment '$GITHUB_ENVIRONMENT' = $APP_ID"
}

# ---------------------------------------------------------------------------
# Dispatch
#
# Required env vars differ by target: main needs AZ_MAIN_KV_RG; branch needs
# AZ_BRANCH_KV_RG, AZ_BRANCH_APP_RG, AZ_BRANCH_NETWORK_RG,
# AZ_BRANCH_ANALYTICS_RG, and AZ_BRANCH_AZURE_RG. All validated
# inside provision_identity.
# ---------------------------------------------------------------------------
case "$TARGET" in
  main)
    provision_identity "cams-deploy-main-oidc" "gha-deploy-main" "deploy-main" true
    ;;
  branch)
    provision_identity "cams-deploy-branch-oidc" "gha-deploy-branch" "deploy-branch" false
    ;;
  all)
    provision_identity "cams-deploy-main-oidc" "gha-deploy-main" "deploy-main" true
    provision_identity "cams-deploy-branch-oidc" "gha-deploy-branch" "deploy-branch" false
    ;;
  *)
    echo "ERROR: Unknown TARGET='$TARGET'. Use main, branch, or omit for all." >&2
    exit 1
    ;;
esac
