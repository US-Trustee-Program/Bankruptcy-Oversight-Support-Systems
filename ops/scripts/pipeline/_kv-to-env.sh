#!/usr/bin/env bash
# Shared helper for fetching a Key Vault secret into GITHUB_ENV, masked.
# Source this file from a workflow's `run:` block; do not execute it directly.
#
# Two GitHub Actions behaviours make the obvious one-liner unsafe:
#
#   echo "NAME=$(az keyvault secret show ...)" >> "$GITHUB_ENV"
#
# 1. Values fetched at runtime are NOT auto-masked. GitHub only redacts what
#    came from the `secrets.*` context, so a value read via `az` appears in
#    clear anywhere it is later echoed. It must be registered with
#    ::add-mask:: explicitly.
# 2. ::add-mask:: is LINE-ORIENTED and the `NAME=value` env syntax is
#    single-line. A value containing a newline therefore masks only its first
#    line -- the rest stay in clear -- and the env file parser rejects the
#    continuation, failing the job.
#
# No secret in either vault is multiline today (140 checked, 2026-08-31), so
# (2) is latent rather than live. It is handled here anyway because the cost
# is a few lines and the failure is silent partial masking: the kind of thing
# that is only noticed after a credential has already been printed.

# Fetches SECRET_NAME from VAULT and exports it as ENV_NAME via GITHUB_ENV.
#
#   kv_to_env ENV_NAME VAULT SECRET_NAME [--optional [DEFAULT]]
#
# --optional tolerates a missing secret, using DEFAULT (or empty) instead --
# for settings an environment may simply not have opted into. Without it, a
# missing secret fails the step, which is the right default for a credential.
#
# Returns 0 on success. Echoes nothing to stdout: the value goes to
# GITHUB_ENV, never to the log.
function kv_to_env() {
    local envName=$1 vault=$2 secretName=$3
    local optional=false defaultValue=''
    if [[ "${4:-}" == "--optional" ]]; then
        optional=true
        defaultValue="${5:-}"
    fi

    local val rc
    # Captured as a plain assignment, not inline in a test: a real CLI failure
    # (expired token, throttling) must surface, not be read as "no value".
    set +e
    val=$(az keyvault secret show --vault-name "${vault}" --name "${secretName}" --query value -o tsv 2>/dev/null)
    rc=$?
    set -e

    if [[ ${rc} -ne 0 || -z "${val}" ]]; then
        if [[ "${optional}" == "true" ]]; then
            val="${defaultValue}"
        else
            echo "ERROR: required secret '${secretName}' not found in vault '${vault}'." >&2
            return 1
        fi
    fi

    kv_mask_and_write "${envName}" "${val}"
}

# Masks a value and writes it to GITHUB_ENV. Split out from kv_to_env so a
# caller that already holds a value (e.g. one it derived or defaulted) gets
# the same masking and multiline handling.
function kv_mask_and_write() {
    local envName=$1 val=$2

    # Mask line by line: ::add-mask:: registers one line at a time, so a
    # single call on a multiline value would leave every line after the first
    # unmasked. Empty lines are skipped -- masking "" makes Actions warn and
    # would redact nothing useful.
    local line
    while IFS= read -r line; do
        [[ -n "${line}" ]] && echo "::add-mask::${line}"
    done <<<"${val}"

    # Heredoc syntax so a newline in the value cannot break the env file. The
    # delimiter is randomised because a fixed one that happened to appear in a
    # secret would let the value terminate its own block -- and an attacker who
    # controlled a secret could otherwise inject arbitrary environment
    # variables into the job.
    local delimiter
    delimiter="EOF_$(openssl rand -hex 8)"
    {
        echo "${envName}<<${delimiter}"
        echo "${val}"
        echo "${delimiter}"
    } >>"${GITHUB_ENV}"
}
