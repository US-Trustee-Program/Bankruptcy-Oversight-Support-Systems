# Veracode to Snyk Migration Plan

## Executive Summary

**Complexity Assessment: LOW-MEDIUM**

The migration is straightforward because:
1. Snyk provides drop-in GitHub Actions similar to Veracode's
2. Your current workflow structure can remain largely the same
3. Snyk's Node.js action directly supports your TypeScript monorepo

## Current Veracode Setup (What Needs Replacing)

### Blocking Scans (Per-Commit in CI/CD)
| Scan Type | Current Implementation | Files |
|-----------|----------------------|-------|
| **SCA** | `veracode/veracode-sca` action (5 parallel jobs) | `reusable-sca-scan.yml` |
| **SAST Pipeline** | `pipeline-scan.jar` with baseline comparison | `sub-security-scan.yml` |

### Non-Blocking Scheduled Scans
| Scan Type | Frequency | Files |
|-----------|-----------|-------|
| **SAST Full Upload** | Weekly Monday 6 AM | `veracode-sast-upload.yml` |
| **DAST (Veracode)** | Tue/Thu/Sat 3 AM | `veracode-dast-scan.yml` |
| **DAST (ZAP)** | Monday 1 PM | `dast-scan.yml`, `reusable-dast.yml` |

### Secrets to Retire
- `VERACODE_API_ID`, `VERACODE_API_KEY`, `VERACODE_SAST_POLICY`
- `SRCCLR_API_TOKEN`, `SRCCLR_REGION`
- `AZ_STOR_VERACODE_NAME`, `AZ_STOR_VERACODE_KEY` (for baseline storage)

## Snyk Replacement Strategy

### New Secret Required
- `SNYK_TOKEN` - API token from Snyk account settings

### SCA Scanning (Software Composition Analysis)
**Replaces**: `reusable-sca-scan.yml` using `veracode/veracode-sca`

Snyk provides the `snyk/actions/node@master` action which scans `package.json` and `package-lock.json` for known vulnerabilities in dependencies.

```yaml
# Example SCA scan for one component
- uses: snyk/actions/node@master
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
  with:
    args: --all-projects  # Scans all package.json files in monorepo
```

**Key differences from Veracode:**
- Single action can scan entire monorepo with `--all-projects`
- No need for 5 parallel jobs (optional optimization)
- Supports SARIF output for GitHub Security tab integration

### SAST Scanning (Static Application Security Testing)
**Replaces**: `sub-security-scan.yml` SAST pipeline scan

Snyk Code (SAST) uses the same CLI with `snyk code test`:

```yaml
- uses: snyk/actions/node@master
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
  with:
    command: code test
    args: --sarif-file-output=snyk-code.sarif
```

**Key differences from Veracode:**
- No need to manage baseline files in Azure Storage
- Snyk tracks baselines in their platform
- Results appear in Snyk dashboard and GitHub Security tab

### DAST Scanning
**Keep**: Your existing OWASP ZAP DAST setup (`reusable-dast.yml`) is independent of Veracode and should remain unchanged.

**Remove**: `veracode-dast-scan.yml` (Veracode-specific DAST)

Snyk does not provide DAST capabilities - ZAP is already the industry standard for this.

## Implementation Plan

### Phase 1: Add Snyk (Non-Blocking) - LOW EFFORT
Add Snyk scans alongside Veracode to validate they work correctly.

1. **Add `SNYK_TOKEN` secret** to GitHub repository
2. **Create new workflow**: `.github/workflows/snyk-security-scan.yml`

```yaml
name: Snyk Security Scan

on:
  workflow_call:

jobs:
  snyk-sca:
    name: Snyk SCA Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # SCA Test - blocks on medium+ severity
      - uses: snyk/actions/node@master
        continue-on-error: true  # Non-blocking during validation phase
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --all-projects --severity-threshold=medium --sarif-file-output=snyk-sca.sarif

      # Monitor - send results to Snyk dashboard for tracking
      - uses: snyk/actions/node@master
        continue-on-error: true
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          command: monitor
          args: --all-projects

      # Upload SARIF to GitHub Security tab
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: snyk-sca.sarif

  snyk-code:
    name: Snyk Code (SAST)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # SAST Test - blocks on medium+ severity
      - uses: snyk/actions/node@master
        continue-on-error: true  # Non-blocking during validation phase
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          command: code test
          args: --severity-threshold=medium --sarif-file-output=snyk-code.sarif

      # Upload SARIF to GitHub Security tab
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: snyk-code.sarif
```

3. **Update `continuous-deployment.yml`** to call Snyk workflow in parallel with Veracode

### Phase 2: Validate & Tune - MEDIUM EFFORT
1. Run both Veracode and Snyk for 1-2 weeks
2. Compare findings between tools
3. Configure Snyk policies/ignore rules as needed
4. Ensure GitHub Security tab shows Snyk results

### Phase 3: Switch to Blocking - LOW EFFORT
1. Remove `continue-on-error: true` from Snyk jobs
2. Add Snyk scan job to `needs` array of deploy job

### Phase 4: Remove Veracode - LOW EFFORT
Delete the following files:
- `.github/workflows/sub-security-scan.yml` (or remove SAST portion)
- `.github/workflows/reusable-sca-scan.yml`
- `.github/workflows/veracode-sast-upload.yml`
- `.github/workflows/veracode-dast-scan.yml`
- `/ops/scripts/pipeline/veracode-prescan.py`
- `/ops/scripts/pipeline/veracode-dast-scan.py`
- `/ops/scripts/pipeline/sec-update-baseline.sh`

Remove from Bicep files:
- `allowVeracodeScan` parameter and related firewall rules

Remove secrets:
- All Veracode-related secrets listed above

## Files to Modify

| File | Action |
|------|--------|
| `.github/workflows/continuous-deployment.yml` | Add Snyk workflow call, eventually remove Veracode |
| `.github/workflows/snyk-security-scan.yml` | **CREATE** - New Snyk reusable workflow |
| `.github/workflows/sub-security-scan.yml` | Eventually DELETE |
| `.github/workflows/reusable-sca-scan.yml` | Eventually DELETE |
| `.github/workflows/veracode-sast-upload.yml` | DELETE |
| `.github/workflows/veracode-dast-scan.yml` | DELETE |
| `/ops/cloud-deployment/*.bicep` | Remove `allowVeracodeScan` parameter |

## Verification Steps

1. **After Phase 1:**
   - Check Snyk dashboard shows project
   - Check GitHub Security tab shows Snyk findings
   - Verify workflow runs complete successfully

2. **After Phase 3:**
   - Verify deployments are blocked when vulnerabilities found
   - Confirm same blocking behavior as Veracode

3. **After Phase 4:**
   - Verify all Veracode references removed
   - Confirm no orphaned secrets
   - Check ZAP DAST still works independently

## Configuration Choices (Confirmed)

- **Snyk Plan**: Snyk Code included (full SAST + SCA capability)
- **Severity Threshold**: Block on Medium and above
- **Monitor Mode**: Enabled - results will be tracked in Snyk dashboard

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Different findings between tools | Run in parallel for 1-2 weeks to compare |
| False positives in Snyk | Configure `.snyk` policy file to ignore |
| Missing DAST capability | Keep existing ZAP implementation |
| Learning curve | Snyk has excellent documentation and simpler than Veracode |
