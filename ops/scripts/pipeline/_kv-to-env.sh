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
# --optional covers ABSENCE ONLY, where absence means the vault answered
# SecretNotFound (see _kv_stderr_means_absent) or returned an empty value. Any
# other failure -- RBAC, token expiry, throttling, vault firewall, a
# misspelled vault, or a non-zero exit with no diagnostic at all -- is fatal
# either way: a default standing in for a transient fault turns a retryable
# error into a successful deploy of the wrong configuration.
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

# Classifies an `az keyvault secret show` failure: true only when the vault
# answered and its answer was "no such secret".
#
#   _kv_stderr_means_absent SECRET_NAME STDERR_TEXT
#
# Same grep-the-captured-stderr idiom as delete_vnet_link_if_exists in
# ops/scripts/utility/az-delete-branch-resources.sh, and for the same reason:
# one specific error code is a legitimate "there is nothing there", every other
# failure is a fault that must stay loud.
#
# SecretNotFound is the ONLY code treated as absence:
#
#   * SecretNotFound -- the 404 the data plane returns for a name that is not
#     in the vault. A soft-deleted secret also 404s on this path (the
#     recoverable-object codes only appear when SETTING a name that is pending
#     purge), so deleted-but-recoverable is covered by this same code.
#   * SecretDisabled is deliberately NOT absence. The secret exists; a human
#     turned it off, and disabling is how a compromised credential gets
#     revoked in a hurry. Quietly deploying a default over a value someone
#     just revoked is the opposite of what they asked for.
#   * A missing or misspelled VAULT (VaultNotFound, ResourceNotFound, or a bare
#     DNS resolution failure) is NOT absence either -- it is a misconfigured
#     pipeline, and the secret's real value may well exist in the vault that
#     was meant. This is why the broad "ResourceNotFound" match used for the
#     DNS-zone cleanup is too coarse here and only the secret-scoped code is
#     matched.
#   * Forbidden / ForbiddenByRbac stay fatal. Key Vault's data plane returns
#     403 rather than a decoy 404 when the identity lacks the role, so a 404 is
#     genuinely about existence and not about permission.
function _kv_stderr_means_absent() {
    local _kv_absName=$1 _kv_absText=$2
    # az echoes the requested name back inside its diagnostic, so a secret
    # LITERALLY named e.g. "SecretNotFound" could otherwise make an unrelated
    # 403 read as absence -- the one direction that must never misfire, since
    # it is the one that substitutes a default. Stripping the name first makes
    # the classification depend on az's words alone. Key Vault names are
    # [0-9a-zA-Z-] only, so there are no glob metacharacters to worry about in
    # the pattern; anything stranger can only strip MORE and therefore only
    # fail closed.
    if [[ -n "${_kv_absName}" ]]; then
        _kv_absText="${_kv_absText//${_kv_absName}/}"
    fi
    grep -qi 'SecretNotFound' <<<"${_kv_absText}"
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
    # caller would see nothing.
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

    local _kv_val _kv_rc _kv_stderrFile _kv_stderrText
    # Captured as a plain assignment, not inline in a test: a real CLI failure
    # (expired token, throttling) must surface, not be read as "no value".
    #
    # stderr goes to a FILE, not /dev/null: ForbiddenByRbac, an expired AAD
    # token and 429 throttling are distinct causes with distinct fixes, and a
    # blanket "not found in vault" sends whoever is on call to the wrong
    # problem -- the secret exists, the identity's RBAC does not. Same
    # stderrFile idiom as ops/scripts/utility/az-delete-branch-resources.sh.
    _kv_stderrFile=$(mktemp)
    set +e
    _kv_val=$(az keyvault secret show --vault-name "${_kv_vault}" --name "${_kv_secretName}" --query value -o tsv 2>"${_kv_stderrFile}")
    _kv_rc=$?
    set -e
    _kv_stderrText=$(cat "${_kv_stderrFile}")
    rm -f "${_kv_stderrFile}"

    # A non-zero rc and an empty value are DISTINCT outcomes and are reported
    # as such. Conflating them is what let a transient Key Vault fault read as
    # "this environment did not opt in": under --optional the step then
    # deployed the DEFAULT and reported success -- e.g. a throttled
    # AZ_FUNCTIONS_LOCATION silently placing Function Apps, plans and the VNet
    # in the wrong region.
    if [[ ${_kv_rc} -ne 0 ]]; then
        # Nothing on stderr at all. Real `az` always says why it failed --
        # including for a missing secret -- so this shape is not a plain
        # absence, it is a fetch whose cause was lost (az killed mid-flight, a
        # wrapper swallowing stderr). Absence has a known signature; anything
        # without that signature has not been SHOWN to be absence, so it is
        # fatal in both modes rather than defaulted past. Failing closed here
        # costs nothing in practice: az does not produce this in production, so
        # if it ever fires something is genuinely broken.
        if [[ -z "${_kv_stderrText}" ]]; then
            echo "ERROR: failed to read secret '${_kv_secretName}' from vault '${_kv_vault}': az exited ${_kv_rc} with nothing on stderr. Cause unattributable, so absence cannot be told from a fault and no default is applied (even under --optional)." >&2
            return 1
        fi
        if _kv_stderr_means_absent "${_kv_secretName}" "${_kv_stderrText}"; then
            # The vault answered, and its answer is that the secret is not
            # there. THIS is the case --optional exists for.
            if [[ "${_kv_optional}" != "true" ]]; then
                echo "ERROR: required secret '${_kv_secretName}' does not exist in vault '${_kv_vault}' (az exited ${_kv_rc}: ${_kv_stderrText})." >&2
                return 1
            fi
            # Says a default was substituted, but never what it was. Somebody
            # reading the log later has to be able to see WHY a Function App
            # landed in the default region; the value itself has not reached
            # kv_mask yet, so echoing it would put it in the log in clear.
            echo "Note: secret '${_kv_secretName}' does not exist in vault '${_kv_vault}'; using the --optional default." >&2
        else
            # The CLI failed for some OTHER reason -- RBAC, expired token,
            # throttling, vault firewall, not logged in. Fatal even under
            # --optional: a default must only ever stand in for a value the
            # vault genuinely does not hold, and a default standing in for a
            # transient fault turns a retryable error into a successful deploy
            # of the wrong configuration. The CLI's own text is echoed verbatim
            # because "not found in vault" for what was really a 403 sends
            # whoever is on call to the wrong problem.
            local _kv_optionalNote=''
            if [[ "${_kv_optional}" == "true" ]]; then
                _kv_optionalNote=' --optional covers absence only, so its default was NOT applied.'
            fi
            echo "ERROR: failed to read secret '${_kv_secretName}' from vault '${_kv_vault}': az exited ${_kv_rc}: ${_kv_stderrText}${_kv_optionalNote}" >&2
            return 1
        fi
        _kv_val="${_kv_default}"
    elif [[ -z "${_kv_val}" ]]; then
        # rc 0 and empty: the fetch worked and the value really is empty. This
        # is the genuine "not set" case --optional exists for.
        if [[ "${_kv_optional}" != "true" ]]; then
            echo "ERROR: required secret '${_kv_secretName}' is present but empty in vault '${_kv_vault}'." >&2
            return 1
        fi
        _kv_val="${_kv_default}"
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
    # Skipping a line is a no-op, not an error, so the caller must not inherit
    # its status. Without this the `&&` chain's status on the LAST line becomes
    # the loop body's, the loop's, and then the function's -- so kv_mask "" and
    # any value ending in a blank line returned 1. kv_get calls kv_mask
    # unconditionally, so under `set -euo pipefail` (every real `run:` block)
    # that killed the step outright with no message and no output variable.
    # Invisible through kv_to_env, which shields it with `|| return 1`, but
    # live at the bare `kv_get` call sites.
    return 0
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
    #
    # Generating the delimiter and checking that it worked are SEPARATE
    # statements. Written as one `delimiter="EOF_$(openssl rand -hex 8)"` the
    # assignment takes the command substitution's exit status, so under
    # `set -e` the shell aborts here and the guard below never runs: an openssl
    # missing from the runner image gave a bare non-zero exit, no message, and
    # a GITHUB_ENV left partially written. `|| randomRc=$?` keeps the status
    # without letting it abort the function.
    local delimiter randomHex randomRc=0
    randomHex=$(openssl rand -hex 8) || randomRc=$?
    delimiter="EOF_${randomHex}"
    # Guard against failed random generation (security property must not degrade to predictable EOF_).
    if [[ ! "${delimiter}" =~ ^EOF_[0-9a-f]{16}$ ]]; then
        echo "ERROR: failed to generate a random GITHUB_ENV delimiter for '${envName}' (openssl rand exited ${randomRc}); refusing to write '${envName}' with a predictable one." >&2
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
    # No explicit `return 0`: unlike kv_mask, kv_write_env's status is the
    # meaningful one here (a bad delimiter or a failed append must reach the
    # caller), so the tail call's status is deliberately the return value.
    kv_write_env "${envName}" "${val}"
}
