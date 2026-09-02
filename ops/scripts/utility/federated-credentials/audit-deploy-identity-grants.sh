#!/usr/bin/env bash
# Runbook: Audit the Azure role assignments held by a CAMS deploy identity
#
# Purpose: Report what cams-deploy-main-oidc / cams-deploy-branch-oidc ACTUALLY
#          hold in live Azure, classified against the least-privilege target
#          state that setup-deploy-federated-credential.sh grants. Written for
#          the CAMS-760 Slice 3 cutover (beads cams-v4ngd), whose whole risk is
#          that Azure RBAC is additive: the new RG-scoped grants are a no-op for
#          permission checking while the old subscription-scope grants survive,
#          so "the deploy went green" proves nothing about privilege until you
#          have actually looked at the assignment list. This is the tool for
#          looking.
#
# ############################################################################
# # READ-ONLY. THIS SCRIPT NEVER MUTATES ANYTHING.                           #
# #                                                                          #
# # Every az invocation below is `az ... list` or `az ... show`. There is no  #
# # create, no update, no delete, no `--yes`, no role assignment write, no    #
# # role definition write. It is safe to run against production at any time,  #
# # by anyone with Reader, and safe to run mid-cutover. Keep it that way: if  #
# # you find yourself wanting this script to FIX something it reported, that  #
# # belongs in setup-deploy-federated-credential.sh (grants) or in the manual #
# # revoke runbook (revocations) -- not here. An audit tool that can also     #
# # change the thing it audits is a tool nobody can trust the output of.      #
# ############################################################################
#
# Exitcodes
# ==========
# 0   The audit ran and a report was produced -- INCLUDING when that report is
#     full of findings. See "Why findings do not fail this script" below.
# 10+ Validation check errors
#     10  a required environment variable is missing -- see require_var in
#         _oidc-helpers.sh
#     11  a required prerequisite does not exist: not logged in to az, or the
#         app registration / service principal for the requested identity was
#         not found. Matches the "prerequisite Azure resource does not exist"
#         meaning this bucket already has in setup-deploy-federated-credential.sh.
#     13  STRICT=true was requested AND the audit found drift. Opt-in only.
#     (12 is deliberately not used here -- it means "custom role definition did
#     not propagate" in _oidc-helpers.sh's wait_for_role_definition, and this
#     script never creates a role definition, so it can never hit that state.)
#
# Why findings do not fail this script (the exit-code decision)
# =============================================================
# A non-empty TO-BE-REVOKED set exits 0. So does a missing EXPECTED grant, and
# so does an UNKNOWN/UNMANAGED one. Non-zero is reserved for "the audit could
# not be performed" (10, 11) plus the opt-in STRICT gate (13).
#
# The reasoning: this script is run repeatedly THROUGHOUT a multi-step manual
# cutover, and at every step some findings are the correct state.
#
#   * Before the grant step   -- the new RG-scoped grants are legitimately
#                                MISSING.
#   * After grant, pre-revoke -- the whole TO-BE-REVOKED set is legitimately
#                                STILL PRESENT. That is the definition of the
#                                pre-revoke checkpoint.
#   * After revoke            -- TO-BE-REVOKED is empty, but the MUST-NOT-
#                                REVOKE-YET hold is still deliberately present.
#
# There is no single moment where "clean" and "correct" coincide, so a script
# that exited non-zero on findings would be red for the entire cutover. An
# operator who is told to expect red cannot use red to detect the one thing
# that matters -- an UNKNOWN grant nobody authorised. That is exactly how the
# existing KV parity hook went blind, and it is not a mistake worth repeating
# in the tool written to recover from it. Reporting reality is this script's
# job; deciding whether reality is acceptable at this point in the sequence is
# the operator's, and the report is grouped so that judgement is a glance.
#
# For the post-cutover world, where "no drift" IS the expected steady state and
# a machine should enforce it, run with STRICT=true to get exit 13 on any
# finding. Kept opt-in so wiring this into CI later is a flag, not a rewrite.
#
# Why `--all` is MANDATORY on the role assignment list
# ====================================================
# The one command this script exists to run is:
#
#     az role assignment list --assignee <spObjectId> --all
#
# WITHOUT --all, `az role assignment list` only returns assignments at or below
# the CURRENT subscription's default scope handling and silently drops the rest.
# In practice that omits the resource-group- and resource-scoped assignments --
# which for these identities is nearly everything that matters: the four
# RG-scoped Contributor grants, the per-secret Key Vault Secrets User grants,
# the KV- and workspace-resource-scoped custom roles, and the RG-scoped User
# Access Administrator that the cutover is meant to remove. An audit missing
# --all therefore returns a short, tidy, subscription-scope-only list and looks
# like it worked. The audit commands in the manual runbook omitted --all, which
# is precisely why they could not see the assignments they existed to verify.
# Do not remove it. Do not "simplify" it away.
#
# The expected set is DERIVED, not duplicated
# ===========================================
# Every expected grant below is read out of setup-deploy-federated-credential.sh
# at runtime (see derive_from_granting_script) rather than restated here: the KV
# secret list, the Key Vault / workspace resource names, and the custom role
# display names. A hand-copied expected set is a second source of truth that
# drifts the moment someone adds a KV secret to the granting runbook, and an
# audit whose baseline has drifted reports confident nonsense. Deriving also
# means this file declares no KV_SECRETS array of its own, so it stays outside
# the check-kv-secret-parity pre-commit hook (whose file filter matches only
# setup-*-federated-credential.sh -- this filename deliberately does not).
#
# Prerequisites:
#   - az CLI logged in. Reader on the subscription is sufficient; no write
#     permission of any kind is needed or used.
#   - Directory.Read.All (or equivalent) to resolve the app registration by
#     display name.
#
# Required environment variables (same names and meanings as the granting
# runbook, so an operator can reuse one exported env for both):
#   TARGET=main   needs AZ_MAIN_KV_RG and AZ_BRANCH_ANALYTICS_RG (the latter
#                       despite the branch- prefix: the granting runbook's own
#                       header documents rg-analytics as shared with main, and
#                       main holds a load-bearing grant there too)
#   TARGET=branch needs AZ_BRANCH_KV_RG, AZ_BRANCH_APP_RG, AZ_BRANCH_NETWORK_RG,
#                       AZ_BRANCH_ANALYTICS_RG, AZ_BRANCH_AZURE_RG
#   TARGET=all    needs all of the above (default)
#
# Usage:
#   TARGET=branch ./audit-deploy-identity-grants.sh
#   TARGET=main   ./audit-deploy-identity-grants.sh
#   STRICT=true TARGET=branch ./audit-deploy-identity-grants.sh   # exit 13 on drift
#
# Override the GitHub org/repo defaults if needed (only affects nothing here --
# inherited from _oidc-helpers.sh):
#   GITHUB_ORG=MyOrg GITHUB_REPO=MyRepo ./audit-deploy-identity-grants.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/utility/federated-credentials/_oidc-helpers.sh
source "$SCRIPT_DIR/_oidc-helpers.sh"

# The granting runbook is this script's baseline; see "The expected set is
# DERIVED" in the header.
GRANTING_SCRIPT="$SCRIPT_DIR/setup-deploy-federated-credential.sh"

TARGET="${TARGET:-all}"
STRICT="${STRICT:-false}"

MAIN_KV_RG="${AZ_MAIN_KV_RG:-}"
BRANCH_KV_RG="${AZ_BRANCH_KV_RG:-}"
BRANCH_APP_RG="${AZ_BRANCH_APP_RG:-}"
BRANCH_NETWORK_RG="${AZ_BRANCH_NETWORK_RG:-}"
BRANCH_ANALYTICS_RG="${AZ_BRANCH_ANALYTICS_RG:-}"
BRANCH_AZURE_RG="${AZ_BRANCH_AZURE_RG:-}"

# Set by audit_identity when it reports anything at all; read by the STRICT gate
# at the very bottom. Accumulated across targets so TARGET=all reports both
# identities before exiting.
DRIFT_FOUND=false

# ---------------------------------------------------------------------------
# Deriving the baseline from the granting script
#
# Both helpers below are deliberately dumb text extraction against a file we
# control, in the same style as .pre-commit-hooks/check-kv-secret-parity.sh
# (which reads the same KV_SECRETS array the same way). Sourcing the granting
# script instead is NOT an option: it executes role-assignment writes at the
# bottom, which would blow the read-only guarantee wide open.
# ---------------------------------------------------------------------------

# Print the KV_SECRETS array entries from the granting script, one per line.
derive_kv_secrets() {
  sed -n '/^KV_SECRETS=(/,/^)/p' "$GRANTING_SCRIPT" |
    grep -oE '"[A-Za-z0-9_-]+"' | tr -d '"'
}

# Print the value of a top-level FOO="literal" assignment in the granting
# script. Exits 11 if absent: a silently-empty resource name would build a
# nonsense expected scope that matches nothing, and the report would then
# blame Azure for a grant that is actually present.
derive_from_granting_script() {
  local var_name="$1"
  local value
  value=$(grep -m1 "^${var_name}=\"" "$GRANTING_SCRIPT" |
    sed -E "s/^${var_name}=\"([^\"]*)\".*/\1/") || true
  if [[ -z "$value" ]]; then
    echo "ERROR: could not read ${var_name} from ${GRANTING_SCRIPT##*/}." >&2
    echo "       This script derives its expected set from that runbook; if the" >&2
    echo "       variable was renamed there, update the name here to match." >&2
    exit 11
  fi
  printf '%s' "$value"
}

# ---------------------------------------------------------------------------
# Set plumbing
#
# Sets are newline-delimited blobs of TAB-separated fields rather than
# associative arrays, so this runs on bash 3.2 (macOS system bash) as well as
# 4+. Two blobs per set: *_SET carries the original text for display, *_KEYS
# carries a lowercased "role<TAB>scope" for matching.
#
# Matching is case-insensitive because Azure is inconsistent about scope
# casing -- `resourceGroups` vs `resourcegroups`, and occasionally an uppercase
# subscription GUID -- depending on which API or portal created the assignment.
# A case-sensitive compare would report a present grant as both MISSING and
# UNKNOWN simultaneously, which is worse than useless.
# ---------------------------------------------------------------------------
canon() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

count_lines() {
  if [[ -z "$1" ]]; then
    echo 0
  else
    printf '%s' "$1" | grep -c ''
  fi
}

# Is "role<TAB>scope" (first two fields of $2) present in the key blob $1?
in_set() {
  local keys="$1" line="$2" key
  key=$(canon "$(printf '%s' "$line" | cut -f1,2)")
  printf '%s\n' "$keys" | grep -qxF "$key"
}

# Replace the audited subscription's GUID with a stable <SUB> token. Redaction
# is a substitution, not a deletion, so scopes stay directly comparable between
# runs, between the two identities, and against the expected set -- which is the
# whole point of auditing scopes. A scope that survives redaction with a
# different GUID still in it is an assignment in ANOTHER subscription, and
# showing that loudly is intentional.
redact() {
  local s="$1"
  s="${s//$SUBSCRIPTION_ID/<SUB>}"
  s="${s//$SUBSCRIPTION_ID_LC/<SUB>}"
  printf '%s' "$s"
}

print_block() {
  local blob="$1" role scope
  [[ -z "$blob" ]] && return 0
  printf '%s' "$blob" | sort | while IFS=$'\t' read -r role scope _; do
    printf '      %-45s %s\n' "$role" "$(redact "$scope")"
  done
}

# ---------------------------------------------------------------------------
# Read-only service principal lookup.
#
# Deliberately NOT _oidc-helpers.sh's lookup_or_create_sp / lookup_or_create_app:
# those CREATE the app registration and service principal when absent, which an
# audit must never do. (Reusing them would also make a typo'd identity name
# provision a brand new empty identity and then cheerfully report that it holds
# no grants.) Prints the SP object ID on stdout; progress to stderr.
# ---------------------------------------------------------------------------
lookup_sp_readonly() {
  local app_name="$1"
  local app_ids count=0 sp_id

  app_ids=$(az ad app list --display-name "$app_name" --query "[].appId" -o tsv)
  if [[ -n "$app_ids" ]]; then
    count=$(printf '%s\n' "$app_ids" | wc -l | tr -d ' ')
  fi
  if [[ "$count" -eq 0 ]]; then
    echo "ERROR: no app registration found with display name '$app_name'." >&2
    echo "       Provision it first: TARGET=${TARGET} ./setup-deploy-federated-credential.sh" >&2
    exit 11
  fi
  if [[ "$count" -gt 1 ]]; then
    # Same guard as lookup_or_create_app: auditing an arbitrary one of several
    # same-named identities would produce a confidently wrong report.
    echo "ERROR: found $count app registrations with display name '$app_name'." >&2
    printf '%s\n' "$app_ids" >&2
    exit 11
  fi

  sp_id=$(az ad sp show --id "$app_ids" --query id -o tsv 2>/dev/null || true)
  if [[ -z "$sp_id" ]]; then
    echo "ERROR: app registration '$app_name' ($app_ids) has no service principal." >&2
    echo "       It can hold no role assignments until one exists. Run the granting" >&2
    echo "       runbook: TARGET=${TARGET} ./setup-deploy-federated-credential.sh" >&2
    exit 11
  fi

  echo "    App (client) ID: $app_ids" >&2
  echo "    Service principal object ID: $sp_id" >&2
  printf '%s' "$sp_id"
}

# ---------------------------------------------------------------------------
# audit_identity APP_NAME IS_MAIN
#
# Builds the three classification sets for one identity, lists what Azure
# actually holds, and prints the six-way report.
# ---------------------------------------------------------------------------
audit_identity() {
  local APP_NAME="$1"
  local IS_MAIN="$2"

  if [[ "$IS_MAIN" != "true" && "$IS_MAIN" != "false" ]]; then
    echo "ERROR: audit_identity's IS_MAIN argument must be 'true' or 'false', got '$IS_MAIN'." >&2
    exit 1
  fi

  echo ""
  echo "==================================================================="
  echo "  Role assignment audit: $APP_NAME"
  echo "==================================================================="
  echo "==> Looking up identity (read-only)..."
  local SP_ID
  SP_ID=$(lookup_sp_readonly "$APP_NAME")

  # --- Derived names, shared by both targets -------------------------------
  local KV_SECRETS_USER_ROLE_ID KV_SECRETS_USER_ROLE_NAME
  KV_SECRETS_USER_ROLE_ID=$(derive_from_granting_script KV_SECRETS_USER_ROLE)
  # `az role assignment list` reports roleDefinitionName (a display name) even
  # for assignments the granting script created by GUID, so the expected set has
  # to hold display names. Resolve the built-in GUID rather than hardcoding
  # "Key Vault Secrets User" in a second place. Read-only.
  KV_SECRETS_USER_ROLE_NAME=$(az role definition list \
    --name "$KV_SECRETS_USER_ROLE_ID" --query "[0].roleName" -o tsv)
  if [[ -z "$KV_SECRETS_USER_ROLE_NAME" ]]; then
    echo "ERROR: could not resolve built-in role $KV_SECRETS_USER_ROLE_ID to a display name." >&2
    exit 11
  fi
  local KV_ROLE_NAME ANALYTICS_ROLE_NAME
  KV_ROLE_NAME=$(derive_from_granting_script KV_ROLE_ASSIGNMENT_ROLE_NAME)
  ANALYTICS_ROLE_NAME=$(derive_from_granting_script ANALYTICS_ROLE_ASSIGNMENT_ROLE_NAME)

  local KV_NAME KV_RG
  local EXPECTED_SET="" EXPECTED_KEYS=""
  local REVOKE_SET="" REVOKE_KEYS=""
  local HOLD_SET="" HOLD_KEYS=""

  # Local closures over the four blobs above; each takes ROLE, SCOPE [, REASON].
  expect() {
    EXPECTED_SET+="$1"$'\t'"$2"$'\n'
    EXPECTED_KEYS+="$(canon "$1"$'\t'"$2")"$'\n'
  }
  revoke() {
    REVOKE_SET+="$1"$'\t'"$2"$'\t'"$3"$'\n'
    REVOKE_KEYS+="$(canon "$1"$'\t'"$2")"$'\n'
  }
  hold() {
    HOLD_SET+="$1"$'\t'"$2"$'\t'"$3"$'\n'
    HOLD_KEYS+="$(canon "$1"$'\t'"$2")"$'\n'
  }

  local SUBSCRIPTION_SCOPE="/subscriptions/${SUBSCRIPTION_ID}"

  if [[ "$IS_MAIN" == "true" ]]; then
    require_var "$MAIN_KV_RG" "AZ_MAIN_KV_RG" "when auditing the main identity"
    # Branch-prefixed name for a resource group that the granting runbook's own
    # header documents as "shared with main" (rg-analytics). Required for the
    # main audit too, because main holds a load-bearing grant there (below).
    # Reusing the existing variable rather than inventing a second name for the
    # identical value: two env vars for one RG is a way to audit against the
    # wrong scope and be told everything is fine.
    require_var "$BRANCH_ANALYTICS_RG" "AZ_BRANCH_ANALYTICS_RG" \
      "when auditing the main identity (rg-analytics is shared with main)"
    KV_NAME=$(derive_from_granting_script MAIN_KV_NAME)
    KV_RG="$MAIN_KV_RG"

    # Main's target state is still subscription-scope Contributor: narrowing
    # main is tracked separately as cams-y8s2 and is explicitly out of scope for
    # CAMS-760 Slice 3, so this script reports main against what the granting
    # runbook grants TODAY rather than against a target nobody has agreed yet.
    expect "Contributor" "$SUBSCRIPTION_SCOPE"

    # Main has NO to-be-revoked set, on purpose. Slice 3 is a branch-only
    # cutover; there is no approved main revoke list, and inventing one here
    # would launder this script's guess into an operator's checklist. Anything
    # main holds beyond the grants above therefore lands in UNKNOWN/UNMANAGED,
    # which is the honest classification: unmanaged, and not yet triaged. Feed
    # that section into cams-y8s2 rather than acting on it from here.
    #
    # The ONE exception, which must not sit in UNKNOWN where a reader could
    # mistake it for sweepable residue: main needs roleAssignments/write in
    # rg-analytics for exactly the same reason branch does, via the sibling
    # module on the other side of the same isDevTier gate. Verified against
    # app-shared-setup.bicep:385 -- standaloneAnalyticsReaderRoleAssignment
    # (the !isDevTier path, i.e. main/staging/USTP) deploys with
    # `scope: resourceGroup(analyticsSubscriptionId, analyticsResourceGroupName)`
    # and creates a Log Analytics Reader roleAssignment there. The granting
    # runbook's header asserts this is "covered by main's own subscription-scope
    # grant", which is NOT true: Contributor's notActions exclude
    # Microsoft.Authorization/*/Write at every scope, so the subscription-scope
    # Contributor cannot perform that write either. This out-of-band grant is
    # what makes main's analytics reader assignment succeed today, and main has
    # no narrower replacement queued the way branch now does. Left as a hold,
    # not promoted to an expected grant, because no script in this repo creates
    # it -- reclassifying it as "expected" would imply the granting runbook
    # would restore it, and it would not.
    hold "Role Based Access Control Administrator" \
      "${SUBSCRIPTION_SCOPE}/resourceGroups/${BRANCH_ANALYTICS_RG}" \
      "LOAD-BEARING for main, and unmanaged by any script here. app-shared-setup.bicep:385's standaloneAnalyticsReaderRoleAssignment (the !isDevTier path) creates a Log Analytics Reader roleAssignment in this resource group on every main/staging/USTP deploy. Contributor excludes Microsoft.Authorization/roleAssignments/write at EVERY scope, so main's subscription-scope Contributor does not cover it, contrary to the note in setup-deploy-federated-credential.sh's header. Unlike branch, main has no narrower workspace-scoped replacement queued yet -- see cams-y8s2. Do not revoke."
  else
    require_var "$BRANCH_KV_RG" "AZ_BRANCH_KV_RG" "when auditing the branch identity"
    require_var "$BRANCH_APP_RG" "AZ_BRANCH_APP_RG" "when auditing the branch identity"
    require_var "$BRANCH_NETWORK_RG" "AZ_BRANCH_NETWORK_RG" "when auditing the branch identity"
    require_var "$BRANCH_ANALYTICS_RG" "AZ_BRANCH_ANALYTICS_RG" "when auditing the branch identity"
    require_var "$BRANCH_AZURE_RG" "AZ_BRANCH_AZURE_RG" "when auditing the branch identity"
    KV_NAME=$(derive_from_granting_script BRANCH_KV_NAME)
    KV_RG="$BRANCH_KV_RG"

    local APP_RG_SCOPE="${SUBSCRIPTION_SCOPE}/resourceGroups/${BRANCH_APP_RG}"
    local NETWORK_RG_SCOPE="${SUBSCRIPTION_SCOPE}/resourceGroups/${BRANCH_NETWORK_RG}"
    local ANALYTICS_RG_SCOPE="${SUBSCRIPTION_SCOPE}/resourceGroups/${BRANCH_ANALYTICS_RG}"
    local AZURE_RG_SCOPE="${SUBSCRIPTION_SCOPE}/resourceGroups/${BRANCH_AZURE_RG}"

    # Contributor on the four stable RGs -- the Slice 3 replacement for the
    # subscription-scope grant listed under revoke() below.
    expect "Contributor" "$APP_RG_SCOPE"
    expect "Contributor" "$NETWORK_RG_SCOPE"
    expect "Contributor" "$ANALYTICS_RG_SCOPE"
    expect "Contributor" "$AZURE_RG_SCOPE"

    # Deny-setting operator on app + network only: those are the only two tiers
    # deployed as denyDelete Deployment Stacks.
    expect "$DEPLOYMENT_STACK_DENY_SETTING_ROLE_NAME" "$APP_RG_SCOPE"
    expect "$DEPLOYMENT_STACK_DENY_SETTING_ROLE_NAME" "$NETWORK_RG_SCOPE"

    # Analytics role-assignment operator on the WORKSPACE RESOURCE.
    #
    # Added by commit 0b1a49faa on this branch and not yet applied to live
    # Azure, so a clean pre-cutover run reports this as EXPECTED-BUT-MISSING.
    # That is a first-class reported state here, not an error: the missing grant
    # is the reason the RBAC Administrator hold below cannot be lifted yet, and
    # crashing on it would take the rest of the report -- including the UNKNOWN
    # section -- down with it.
    local ANALYTICS_WORKSPACE_NAME
    ANALYTICS_WORKSPACE_NAME=$(derive_from_granting_script BRANCH_ANALYTICS_WORKSPACE_NAME)
    expect "$ANALYTICS_ROLE_NAME" \
      "${ANALYTICS_RG_SCOPE}/providers/Microsoft.OperationalInsights/workspaces/${ANALYTICS_WORKSPACE_NAME}"

    # ---- What Slice 3 is meant to remove --------------------------------
    revoke "Contributor" "$SUBSCRIPTION_SCOPE" \
      "Superseded by the four RG-scoped Contributor grants above. Azure RBAC is additive, so this grant keeps subscription-wide write in effect and makes the narrow grants a no-op until it is gone."
    revoke "CAMS Deploy Subscription Role" "$SUBSCRIPTION_SCOPE" \
      "Custom role defined only in live Azure, referenced by NO script in this repo; its own description marks it as residue of the abandoned per-RG design. Grants Microsoft.Resources/deployments/* plus subscriptions/resourceGroups/{write,read} -- precisely the capabilities this slice exists to remove. Revoke the Contributor above but not this one and the identity still holds subscription-scope resource-group and deployment write."
    revoke "User Access Administrator" \
      "${SUBSCRIPTION_SCOPE}/resourceGroups/${BRANCH_AZURE_RG}" \
      "Resource-group scoped (NOT subscription-scoped, as earlier notes implied). Unmanaged by any script. Lets the identity grant itself Owner within that resource group; superseded for its actual purpose by the KV-resource-scoped '${KV_ROLE_NAME}'."

    # ---- What must NOT be swept yet -------------------------------------
    hold "Role Based Access Control Administrator" "$ANALYTICS_RG_SCOPE" \
      "LOAD-BEARING. This is the ONLY grant that lets app-shared-setup.bicep's sharedAnalyticsReaderRoleAssignment module create its Log Analytics Reader assignment, which fires on EVERY branch deploy (isDevTier is true whenever createAlerts is false). Contributor excludes Microsoft.Authorization/roleAssignments/write, so none of the four RG-scoped Contributor grants can substitute -- including the one on this very resource group. Revoke it before the workspace-scoped '${ANALYTICS_ROLE_NAME}' grant is present AND validated by a green branch deploy and every branch deploy fails at the app-shared-setup step."
  fi

  # KV grants: identical shape for main and branch, only the vault differs.
  local KV_SCOPE="${SUBSCRIPTION_SCOPE}/resourceGroups/${KV_RG}/providers/Microsoft.KeyVault/vaults/${KV_NAME}"
  expect "$KV_ROLE_NAME" "$KV_SCOPE"
  local SECRET_NAME
  while IFS= read -r SECRET_NAME; do
    [[ -n "$SECRET_NAME" ]] || continue
    expect "$KV_SECRETS_USER_ROLE_NAME" "${KV_SCOPE}/secrets/${SECRET_NAME}"
  done < <(derive_kv_secrets)

  # -------------------------------------------------------------------------
  # What Azure actually holds.
  #
  # --all is MANDATORY -- see the header. Without it this returns only the
  # subscription-scope assignments and the report becomes actively misleading.
  # -------------------------------------------------------------------------
  echo "==> Listing role assignments (az role assignment list --assignee ... --all)..."
  local ACTUAL_SET ACTUAL_KEYS
  # Tab-separated "roleDefinitionName<TAB>scope", matching the *_SET shape.
  # Command substitution strips trailing newlines, so re-add one when non-empty
  # to keep count_lines and the read loops uniform across all the blobs.
  ACTUAL_SET=$(az role assignment list --assignee "$SP_ID" --all \
    --query "[].[roleDefinitionName, scope]" -o tsv)
  if [[ -n "$ACTUAL_SET" ]]; then
    ACTUAL_SET+=$'\n'
  fi
  ACTUAL_KEYS=$(canon "$ACTUAL_SET")

  # -------------------------------------------------------------------------
  # Classification. Both directions, always: for each actual assignment ask
  # "is this authorised?", and for each expected grant ask "is it really
  # there?". A one-directional audit is how the KV parity hook went blind --
  # it only ever asked one of those two questions.
  # -------------------------------------------------------------------------
  local EXPECTED_PRESENT="" EXPECTED_MISSING=""
  local REVOKE_PRESENT="" REVOKE_GONE=""
  local HOLD_PRESENT="" HOLD_MISSING=""
  local UNKNOWN=""
  local line

  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    if in_set "$EXPECTED_KEYS" "$line"; then
      EXPECTED_PRESENT+="$line"$'\n'
    elif in_set "$REVOKE_KEYS" "$line"; then
      REVOKE_PRESENT+="$line"$'\n'
    elif in_set "$HOLD_KEYS" "$line"; then
      HOLD_PRESENT+="$line"$'\n'
    else
      UNKNOWN+="$line"$'\n'
    fi
  done <<<"$ACTUAL_SET"

  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    in_set "$ACTUAL_KEYS" "$line" || EXPECTED_MISSING+="$line"$'\n'
  done <<<"$EXPECTED_SET"

  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    in_set "$ACTUAL_KEYS" "$line" || REVOKE_GONE+="$line"$'\n'
  done <<<"$REVOKE_SET"

  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    in_set "$ACTUAL_KEYS" "$line" || HOLD_MISSING+="$line"$'\n'
  done <<<"$HOLD_SET"

  # -------------------------------------------------------------------------
  # Report
  # -------------------------------------------------------------------------
  echo ""
  echo "-------------------------------------------------------------------"
  echo "  $APP_NAME — $(count_lines "$ACTUAL_SET") assignment(s) in Azure"
  echo "  Subscription GUID redacted as <SUB> throughout (subscription: ${SUBSCRIPTION_NAME})"
  echo "-------------------------------------------------------------------"

  echo ""
  echo "  [EXPECTED — PRESENT] $(count_lines "$EXPECTED_PRESENT") of $(count_lines "$EXPECTED_SET")"
  echo "    Part of the intended least-privilege target set, and in place."
  print_block "$EXPECTED_PRESENT"

  echo ""
  if [[ -n "$EXPECTED_MISSING" ]]; then
    DRIFT_FOUND=true
    echo "  [EXPECTED — MISSING] $(count_lines "$EXPECTED_MISSING")   <-- granting runbook has not been run, or was run without these env vars"
    echo "    In the target set but ABSENT from Azure. Not an error by itself:"
    echo "    pre-cutover, or for a grant added by an unreleased commit, absent is"
    echo "    the correct state. Fix by re-running the granting runbook:"
    echo "      TARGET=${TARGET} ./setup-deploy-federated-credential.sh"
    print_block "$EXPECTED_MISSING"
  else
    echo "  [EXPECTED — MISSING] 0"
    echo "    Every grant in the target set is in place."
  fi

  echo ""
  if [[ -n "$REVOKE_PRESENT" ]]; then
    DRIFT_FOUND=true
    echo "  [TO-BE-REVOKED — STILL PRESENT] $(count_lines "$REVOKE_PRESENT")"
    echo "    The cutover is meant to remove these. Still present is the CORRECT,"
    echo "    expected state before the revoke step — this script exits 0 on it."
    echo "    Revoke only per the manual runbook, and only after the EXPECTED set"
    echo "    above is complete (Azure RBAC is additive: while these exist, the"
    echo "    narrow grants are unverifiable no-ops)."
    # Iterate the DEFINITION set, not the listing: the per-entry reason only
    # exists on the definition, and walking it means the reason can never be
    # printed against the wrong scope.
    printf '%s' "$REVOKE_SET" | sort | while IFS=$'\t' read -r role scope reason; do
      in_set "$ACTUAL_KEYS" "$role"$'\t'"$scope" || continue
      printf '      %-45s %s\n' "$role" "$(redact "$scope")"
      printf '        why: %s\n' "$reason"
    done
  else
    echo "  [TO-BE-REVOKED — STILL PRESENT] 0"
  fi

  if [[ -n "$REVOKE_GONE" ]]; then
    echo ""
    echo "  [TO-BE-REVOKED — ALREADY GONE] $(count_lines "$REVOKE_GONE")"
    echo "    Revoked already (or never granted). Reported so the revoke step is"
    echo "    verifiable in both directions rather than assumed."
    print_block "$REVOKE_GONE"
  fi

  if [[ -n "$HOLD_PRESENT" ]]; then
    echo ""
    echo "  [MUST NOT REVOKE YET — PRESENT] $(count_lines "$HOLD_PRESENT")"
    echo "    !! DO NOT sweep these along with the TO-BE-REVOKED set. They are"
    echo "    !! unmanaged by any script in this repo, which makes them LOOK like"
    echo "    !! cleanup candidates, but they are currently load-bearing."
    printf '%s' "$HOLD_SET" | sort | while IFS=$'\t' read -r role scope reason; do
      in_set "$ACTUAL_KEYS" "$role"$'\t'"$scope" || continue
      printf '      %-45s %s\n' "$role" "$(redact "$scope")"
      printf '        KEEP because: %s\n' "$reason"
    done
  fi

  if [[ -n "$HOLD_MISSING" ]]; then
    DRIFT_FOUND=true
    echo ""
    echo "  [MUST NOT REVOKE YET — MISSING] $(count_lines "$HOLD_MISSING")   <-- !! LIKELY BROKEN DEPLOYS"
    echo "    A load-bearing grant is GONE. If the EXPECTED replacement above is"
    echo "    also missing, deploys for this identity are broken right now."
    print_block "$HOLD_MISSING"
  fi

  echo ""
  if [[ -n "$UNKNOWN" ]]; then
    DRIFT_FOUND=true
    echo "  ###################################################################"
    echo "  #  [UNKNOWN / UNMANAGED] $(count_lines "$UNKNOWN")"
    echo "  #"
    echo "  #  Present in Azure but created by NO script in this repo, and not"
    echo "  #  on the reviewed to-be-revoked or must-keep lists. THESE ARE THE"
    echo "  #  DANGEROUS ONES: nobody owns them, nothing recreates them, and no"
    echo "  #  review has established whether anything depends on them."
    echo "  #"
    echo "  #  Triage each one before the cutover. Do NOT revoke on sight --"
    echo "  #  every must-keep entry above is unmanaged too, and revoking one of"
    echo "  #  those breaks every deploy for this identity."
    echo "  ###################################################################"
    print_block "$UNKNOWN"
  else
    echo "  [UNKNOWN / UNMANAGED] 0"
    echo "    Every assignment in Azure is accounted for by this repo's scripts or"
    echo "    by a reviewed entry above."
  fi

  echo ""
  echo "  Summary for $APP_NAME:"
  printf '    %-32s %s\n' "expected, present"        "$(count_lines "$EXPECTED_PRESENT")"
  printf '    %-32s %s\n' "expected, MISSING"        "$(count_lines "$EXPECTED_MISSING")"
  printf '    %-32s %s\n' "to-be-revoked, present"   "$(count_lines "$REVOKE_PRESENT")"
  printf '    %-32s %s\n' "to-be-revoked, gone"      "$(count_lines "$REVOKE_GONE")"
  printf '    %-32s %s\n' "must-not-revoke, present" "$(count_lines "$HOLD_PRESENT")"
  printf '    %-32s %s\n' "must-not-revoke, MISSING" "$(count_lines "$HOLD_MISSING")"
  printf '    %-32s %s\n' "UNKNOWN / UNMANAGED"      "$(count_lines "$UNKNOWN")"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
echo "==> Looking up subscription (read-only)..."
if ! SUBSCRIPTION_ID=$(az account show --query id -o tsv 2>/dev/null) || [[ -z "$SUBSCRIPTION_ID" ]]; then
  echo "ERROR: could not read the current subscription. Run 'az login' first." >&2
  exit 11
fi
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
SUBSCRIPTION_ID_LC=$(canon "$SUBSCRIPTION_ID")
echo "    Subscription: ${SUBSCRIPTION_NAME} (<SUB>)"
echo "    Baseline:     ${GRANTING_SCRIPT##*/}"

if [[ ! -r "$GRANTING_SCRIPT" ]]; then
  echo "ERROR: granting runbook not readable: $GRANTING_SCRIPT" >&2
  echo "       This script derives its expected set from that file." >&2
  exit 11
fi

case "$TARGET" in
  main)
    audit_identity "cams-deploy-main-oidc" true
    ;;
  branch)
    audit_identity "cams-deploy-branch-oidc" false
    ;;
  all)
    audit_identity "cams-deploy-main-oidc" true
    audit_identity "cams-deploy-branch-oidc" false
    ;;
  *)
    echo "ERROR: Unknown TARGET='$TARGET'. Use main, branch, or omit for all." >&2
    exit 1
    ;;
esac

echo ""
echo "==> Audit complete. Nothing was modified."

# Opt-in machine gate. Default is exit 0 regardless of findings -- see the
# header's exit-code decision for why a cutover-time audit must not be red for
# the entire cutover.
if [[ "$STRICT" == "true" && "$DRIFT_FOUND" == "true" ]]; then
  echo "ERROR: STRICT=true and the audit found drift (see the sections above)." >&2
  exit 13
fi
