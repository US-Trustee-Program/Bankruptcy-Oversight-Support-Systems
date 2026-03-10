# ATS Cleansing Test Data

This directory contains TSV files used for testing the ATS cleansing pipeline.

## Files

### `trustee_cross_reference_enriched_v4_ts.tsv`
- **Original Source:** Python prototype in `.ustp-cams-fdp/ai/specs/CAMS-596-migrate-trustee-appointments/brainstorming/`
- **Purpose:** Reference data for validating the TypeScript cleansing pipeline
- **Size:** 8,244 appointments across all classification types (CLEAN, AUTO_RECOVERABLE, PROBLEMATIC, UNCLEANSABLE)
- **Used by:**
  - `ats-cleansing-pipeline.test.ts` - Unit tests grouped by classification
  - `validate-tsv-parity.test.ts` - Field-by-field parity validation

### `trustee_appointment_overrides.tsv`
- **Original Source:** Python prototype in `.ustp-cams-fdp/ai/specs/CAMS-596-migrate-trustee-appointments/brainstorming/`
- **Purpose:** Override directives for specific trustee appointments
- **Usage:** Tests validate that overrides are correctly applied during cleansing

## Maintenance

These files are maintained in version control to ensure tests always have the reference data:
- ✅ Colocated with tests (no external dependencies)
- ✅ Version controlled
- ✅ Can be updated from `.ustp-cams-fdp/` when prototype output changes
