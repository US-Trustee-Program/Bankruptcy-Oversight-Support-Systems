# Database Seed Scripts

## Architecture Overview

**CAMS uses four databases:**

- **DXTR (SQL Server)**: Source of truth for cases and court data. Synced from PACER.
- **ACMS (SQL Server)**: Stores trustee data (trustees, appointments, professional IDs).
- **TOD / ATS (SQL Server)**: The Office of Oversight's trustee records (`TRUSTEES`,
  `CHAPTER_DETAILS`), compared with CAMS by the trustee data report.
- **Cosmos DB (MongoDB)**: Stores synced cases for search, plus CAMS-specific entities (assignments,
  orders, consolidations, etc.)

## What to Seed vs. What to Sync

### ✅ Seed These (Mock Data)

**In Cosmos DB (`cams` collection):**

- `assignments` - Case assignments to trial attorneys
- `bankruptcy-software` - Software used by cases (maybe)
- `banks` - Banking information
- `case-appointments` - Trustee appointments on cases
- `cases` - Synced case records (must reference real DXTR cases)
- `consolidations` - Case consolidation relationships
- `orders` - Court orders
- `trustee-appointments` - Trustee appointment records
- `trustee-match-verification` - Trustee matching workflow states
- `trustee-professional-ids` - Trustee professional identifiers (each seeded doc must set
  `disposition: 'linked'`, or no reader sees it)
- `trustees` - Trustee records

**In TOD / ATS (SQL Server):**

- `TRUSTEES` and `CHAPTER_DETAILS` - only for the `trustee-data-report` scenario, with IDs in the
  reserved range `9900000`–`9900999` (`lib/tod-seed-ids.ts`). Seeds write only the columns the
  report reads; if an environment's TOD tables require other columns, the insert fails with a SQL
  error. Where `TRUSTEES.ID` is an identity column (as in dev), the seed writes its IDs with
  `IDENTITY_INSERT` on and then resets the identity counter, so TOD keeps assigning its own IDs from
  where it was, outside the reserved range. The login needs `ALTER` on the table for this.

### ❌ Don't Seed These (Synced from Real Sources)

**From DXTR:**

- `offices` - Office structure synced from DXTR
- `office-assignees` - Not applicable

**From Okta/DXTR:**

- `user-groups` - Synced from identity provider
- `users` - Synced from identity provider

**Not Important:**

- `archived-cases` - Not needed for testing
- `lists` - Not needed for testing
- `runtime_state` - Not needed for testing

## Current Status

**Slice 1 (Complete):** Core CAMS foundation

- ✅ `cases/chapter7.ts` - Sample Chapter 11 case (091-99-87899)
- ✅ `cases/chapter11.ts` - Sample Chapter 11 case (091-99-86706)
- ✅ `cases/chapter13.ts` - Sample Chapter 11 case (091-99-86447)

**Remaining Slices:** See beads issues for other entities

## Critical: DXTR ↔ Cosmos Pairing

For cases to work in the app:

1. ✅ Case MUST exist in DXTR - backend queries DXTR for case details
2. ✅ Case SHOULD exist in Cosmos with `documentType: 'SYNCED_CASE'` - enables search

**Our seed cases reference real DXTR case IDs** so they work immediately without additional DXTR
seeding.
