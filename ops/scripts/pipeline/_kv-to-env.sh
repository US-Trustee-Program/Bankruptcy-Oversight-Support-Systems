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
# The value is masked by kv_get; kv_write_env writes without re-masking.
#
# Returns 0 on success. Echoes nothing to stdout: the value goes to
# GITHUB_ENV, never to the log.
function kv_to_env() {
    local envName=$1
    # Deliberately NOT _kv_-prefixed: that prefix is reserved for kv_get's own
    # locals and kv_get refuses it. The name only has to avoid colliding with
    # those, which this does.
    local kvToEnvValue=''
    kv_get kvToEnvValue "${@:2}" || return 1
    kv_write_env "${envName}" "${kvToEnvValue}"
}

# Fetches a secret, masks it, and assigns it to the shell variable named by
# the first argument -- WITHOUT writing to GITHUB_ENV.
#
#   kv_get OUT_VAR VAULT SECRET_NAME [--optional [DEFAULT]]
#
# For the several call sites that derive a final value before exporting it
# (e.g. a branch deploy overriding a KV-sourced VNet name with a computed
# one). Masking still happens here, so the fetched value is registered even
# when the derived value is what ends up in the environment.
function kv_get() {
    # Every local here is _kv_-prefixed. bash is dynamically scoped, so an
    # unprefixed local sharing a name with the caller's output variable would
    # shadow it -- printf -v would then assign to this function's copy and the
    # caller would see nothing. Caught in testing with a caller using "val".
    local _kv_outVar=$1 _kv_vault=$2 _kv_secretName=$3

    # The prefix keeps callers safe, but only if they stay off it. A caller
    # asking for "_kv_val" would be handed this function's own local and
    # silently receive nothing -- refuse rather than fail quietly, since a
    # silent empty secret is the exact failure mode this file exists to stop.
    if [[ "${_kv_outVar}" == _kv_* ]]; then
        echo "ERROR: kv_get output variable '${_kv_outVar}' uses the reserved _kv_ prefix." >&2
        return 2
    fi

    local _kv_optional=false _kv_default=''
    if [[ "${4:-}" == "--optional" ]]; then
        _kv_optional=true
        _kv_default="${5:-}"
    fi

    local _kv_val _kv_rc
    # Captured as a plain assignment, not inline in a test: a real CLI failure
    # (expired token, throttling) must surface, not be read as "no value".
    set +e
    _kv_val=$(az keyvault secret show --vault-name "${_kv_vault}" --name "${_kv_secretName}" --query value -o tsv 2>/dev/null)
    _kv_rc=$?
    set -e

    if [[ ${_kv_rc} -ne 0 || -z "${_kv_val}" ]]; then
        if [[ "${_kv_optional}" == "true" ]]; then
            _kv_val="${_kv_default}"
        else
            echo "ERROR: required secret '${_kv_secretName}' not found in vault '${_kv_vault}'." >&2
            return 1
        fi
    fi

    kv_mask "${_kv_val}"
    # printf -v rather than a nameref: works on bash 3.2 as well, so the
    # helper stays usable outside the runner's bash 5.
    printf -v "${_kv_outVar}" '%s' "${_kv_val}"
}

# Registers a value with the log redactor, one line at a time.
function kv_mask() {
    # ::add-mask:: registers ONE line, so a single call on a multiline value
    # would leave every line after the first unmasked. Empty lines are skipped
    # -- masking "" makes Actions warn and would redact nothing useful.
    local line
    # The GitHub Actions runner percent-DECODES the data portion of workflow commands
    # before acting on it, so a value literally containing `%25`, `%0A`, or `%0D` would
    # get decoded to a different string and the runner would register a mask for the
    # wrong value. Escaping must happen inside the loop after the newline split -- not
    # on ${1} before the loop -- because pre-escaping \n→%0A would collapse to single
    # iteration and lose multiline masking. Percent sign is escaped first so that the
    # % introduced by later substitutions is not re-escaped.
    while IFS= read -r line; do
        [[ -n "${line}" ]] && line="${line//\%/%25}" && line="${line//$'\r'/%0D}" && line="${line//$'\n'/%0A}" && echo "::add-mask::${line}"
    done <<<"${1}"
}

# Writes a masked value to GITHUB_ENV. Assumes the value has ALREADY been masked
# by the caller -- it deliberately does not mask, so it must never be called with
# an unmasked value. Use this when the value has already been registered via
# ::add-mask:: elsewhere (e.g., by kv_get).
function kv_write_env() {
    local envName=$1 val=$2

    # Heredoc syntax so a newline in the value cannot break the env file. The
    # delimiter is randomised: randomness is a security property that ensures an
    # attacker who controlled a secret cannot inject arbitrary environment variables.
    # A predictable delimiter that happened to appear in a secret would let the value
    # terminate its own block, enabling injection.
    local delimiter
    delimiter="EOF_$(openssl rand -hex 8)"
    # Guard against failed random generation (security property must not degrade to predictable EOF_).
    if [[ ! "${delimiter}" =~ ^EOF_[0-9a-f]{16}$ ]]; then
        echo "ERROR: failed to generate a random GITHUB_ENV delimiter." >&2
        return 1
    fi
    {
        echo "${envName}<<${delimiter}"
        printf '%s\n' "${val}"  # printf instead of echo to prevent -n, -e, -E being consumed as flags
        echo "${delimiter}"
    } >>"${GITHUB_ENV}"
}

# Masks a value and writes it to GITHUB_ENV. For callers that already hold a value
# (e.g. one derived or defaulted) and need both the masking and multiline-safe write.
function kv_mask_and_write() {
    local envName=$1 val=$2

    kv_mask "${val}"
    kv_write_env "${envName}" "${val}"
}
