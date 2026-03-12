# ATS Appointment Cleansing Pipeline

**⚠️ TEMPORARY TECH DEBT - DELETE AFTER MIGRATION**

This directory contains the ATS appointment cleansing pipeline used for the one-time
trustee migration from legacy ATS to CAMS. This code is intentionally colocated with
the migration dataflow to make cleanup easier after migration completes.

## Purpose

The ATS database contains "dirty" appointment data with various quality issues:
- NULL or missing districts
- Typos in district/state names (e.g., "Nothern" → "NORTHERN", "District Columbia" → "DISTRICT OF COLUMBIA")
- Multi-value fields (e.g., "Eastern, Western")
- Column reversals (district ↔ state swapped)
- Invalid district/state combinations
- Delimiter artifacts (trailing slashes)

This pipeline cleanses the data through a 5-stage process to produce valid CAMS
appointments with mapped court IDs.

## Pipeline Stages

### 0. Override Check
Manual corrections or skip directives from `trustee-appointment-overrides.tsv`.
- **SKIP**: Silently skip appointment (logged at DEBUG level, counted as success)
- **MAP**: Apply manual corrections and/or court ID mapping

### 1. Pre-Cleanse
Fix data quality issues:
- Typo corrections (district and state names)
- Column reversal detection (DC/Virginia edge case)
- Delimiter artifact removal (trailing slashes)
- Abbreviation expansion (ND/SD → Northern/Southern)
- Adjacent direction word fixes (add comma separators)
- City-to-geography mapping
- One-off corrections (Western OH → Southern OH, etc.)

### 2. Expansion
Split multi-value fields into N records:
- Regional responsibility patterns (8 patterns: Chicago/Milwaukee, LA/MS, Upper Midwest, Iowa/SD, Northern CA/NV, Upstate NY/VT, Pacific NW, NY State/VT)
- Parallel array detection (position-correlated district/state pairs)
- Hybrid expansion (1 district + multiple states with mix of single/multi-district)
- Multi-district only expansion
- Multi-state only expansion (all single-district)

### 3. Mapping
Map district+state → court ID:
- Single-district states (NULL district inferred)
- Multi-district states (requires district)
- Validation of district/state combinations

### 4. Classification
Assign final classification:
- **CLEAN**: Successfully cleansed and mapped, ready for migration
- **AUTO_RECOVERABLE**: Successfully cleansed with inference (NULL district + single-state, expansions)
- **PROBLEMATIC**: Failed validation - ambiguous data (multi-district × multi-state without pattern)
- **UNCLEANSABLE**: Failed validation - missing required data (NULL status, NULL geography)
- **SKIP**: Skipped per override directive (not an error)

### 5. Transform
Convert to CAMS format (only for CLEAN/AUTO_RECOVERABLE):
- Parse chapter and status codes
- Apply appointment type overrides (CBC, subchapter-v, standing)
- Format dates
- Validate chapter type

## Files

- `ats-cleansing-pipeline.ts` - Main orchestration and entry point
- `ats-cleansing-types.ts` - TypeScript interfaces and enums
- `ats-cleansing-maps.ts` - District/state mappings (ported from discovery)
- `ats-cleansing-utils.ts` - Shared utility functions
- `ats-cleansing-overrides.ts` - Stage 0: Override file loading and checking
- `ats-cleansing-precleanse.ts` - Stage 1: Data quality fixes
- `ats-cleansing-expansion.ts` - Stage 2: Multi-value handling
- `ats-cleansing-mapping.ts` - Stage 3: District/state → court ID
- `ats-cleansing-classification.ts` - Stage 4: Final classification
- `ats-cleansing-transform.ts` - Stage 5: Convert to CAMS format
- `trustee-appointment-overrides.tsv` - Manual override data
- `README.md` - This file

## Integration

The cleansing pipeline is integrated into the trustee migration via `appointments-sync.helpers.ts`:

```typescript
const cleansingResult = cleanseAndMapAppointment(
  context,
  truId,
  atsAppointment,
  overridesCache,
);

// Handle SKIP (success, not an error)
if (cleansingResult.classification === CleansingClassification.SKIP) {
  return { success: true };
}

// Handle UNCLEANSABLE/PROBLEMATIC (failures → DLQ)
if (cleansingResult.classification === CleansingClassification.UNCLEANSABLE ||
    cleansingResult.classification === CleansingClassification.PROBLEMATIC) {
  return {
    success: false,
    failedAppointment: { /* DLQ payload */ },
  };
}

// Handle CLEAN/AUTO_RECOVERABLE (success → create appointment)
const appointmentInput = cleansingResult.appointment!;
await repo.createAppointment(trusteeId, appointmentInput, SYSTEM_USER);
```

## Failed Appointment DLQ Format

```json
{
  "type": "FAILED_APPOINTMENT",
  "trusteeId": "550e8400-e29b-41d4-a716-446655440000",
  "truId": "12345",
  "classification": "PROBLEMATIC",
  "notes": ["Ambiguous: 2 districts × 2 states"],
  "timestamp": "2026-03-10T15:30:00.000Z",
  "atsAppointment": {
    "DISTRICT": "Eastern, Western",
    "STATE": "New York, Vermont",
    "DIVISION": "207",
    "CHAPTER": "11",
    "STATUS": "PA",
    "DATE_APPOINTED": "2020-01-15T00:00:00.000Z",
    "EFFECTIVE_DATE": "2020-01-15T00:00:00.000Z"
  }
}
```

## Statistics (from v4 prototype validation)

Based on 8,246 ATS trustee records:
- **CLEAN**: 5,496 (66.7%) - Ready for migration
- **AUTO_RECOVERABLE**: 2,635 (32.0%) - Inferred or expanded, ready for migration
- **PROBLEMATIC**: 79 (1.0%) - Ambiguous data → DLQ
- **UNCLEANSABLE**: 34 (0.4%) - Missing required data → DLQ
- **SKIPPED**: 2 (0.0%) - Per override directive (not errors)

**Success rate**: 98.6% of appointments can be migrated

## Cleanup Plan

**DELETE THIS ENTIRE DIRECTORY AFTER MIGRATION COMPLETES**

Timeline:
1. Run migration in all environments (dev, staging, prod)
2. Validate appointment counts and data quality
3. Monitor production for 30 days
4. Delete this directory and all references in Q2 2026

## Discovery Artifacts

The logic in this directory was prototyped in:
`.ustp-cams-fdp/ai/specs/CAMS-596-migrate-trustee-appointments/brainstorming/classify-appointments-v4.ts`

The prototype was validated against 8,246 ATS trustee records with 100% parity between
Python and TypeScript implementations.

## Testing

Unit tests for the cleansing pipeline are in `ats-cleansing.test.ts` at the parent level.

Due to lack of ATS data in dev environments, integration testing must be performed in
environments with access to the ATS database (staging/production).
