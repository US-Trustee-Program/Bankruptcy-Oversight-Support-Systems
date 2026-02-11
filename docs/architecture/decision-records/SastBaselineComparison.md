# SAST Baseline Comparison

## Context

Static Application Security Testing (SAST) scanning identifies code patterns that may represent security vulnerabilities. However, SAST tools lack the context to understand application-level risk mitigations. Code patterns that appear risky in isolation — such as decoding a JWT without signature verification — may be intentional and safe because the risk is mitigated by the application's design.

Without a mechanism to account for these accepted findings, the team would face a choice between removing useful, intentionally-written code to satisfy the scanner or disabling the scan gate entirely. Neither option is acceptable.

Several alternatives were considered:

- **Inline suppression comments** would pollute the codebase with tool-specific annotations and couple the source code to a particular scanning tool.
- **Removing flagged code** would eliminate functionality that is correct and useful, where the associated risk is already mitigated by design.
- **Disabling the scan gate** would eliminate the ability to catch genuinely new vulnerabilities.

## Decision

We adopted a baseline comparison approach for SAST scanning. A curated set of known finding fingerprints is maintained as the baseline, representing findings that have been reviewed and determined to be acceptable — either because the risk is mitigated by application design or because the finding is a false positive.

Each scan's results are compared against this baseline. Only new findings — those not present in the baseline — block deployment. Previously reviewed findings pass through without disrupting the pipeline.

The baseline is stored externally rather than in source control. The repository is public, and scan details should not be exposed in version history.

Baseline updates are a deliberate, manual process. Automation of baseline updates is intentionally avoided so that accepting findings into the baseline always requires human review and intent.

## Status

Accepted

## Consequences

- Intentional code patterns that are flagged by SAST but mitigated by application design can be preserved without removing useful functionality.
- New vulnerabilities introduced by code changes are caught and block deployment.
- Manual baseline updates ensure human oversight of which findings are accepted.
- The baseline must be maintained as an operational concern. Structural code changes (refactoring around a baselined finding) may alter finding fingerprints, requiring a baseline refresh even when the underlying findings have not changed.
- The baseline represents a point-in-time snapshot. If findings are resolved in code but the baseline is not updated, the stale entries are harmless — they simply go unmatched.
