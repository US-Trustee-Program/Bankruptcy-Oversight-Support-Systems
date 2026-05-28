# Database Seed Scripts

## Architecture Overview

**CAMS uses three databases:**

- **DXTR (SQL Server)**: Source of truth for cases and court data. Synced from PACER.
- **ACMS (SQL Server)**: Stores trustee data (trustees, appointments, professional IDs).
- **Cosmos DB (MongoDB)**: Stores synced cases for search, plus CAMS-specific entities (assignments, orders, consolidations, etc.)

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
- `trustee-professional-ids` - Trustee professional identifiers
- `trustees` - Trustee records

**In ATS (SQL Server):**
- TBD - May not need any seed data

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

**Our seed cases reference real DXTR case IDs** so they work immediately without additional DXTR seeding.
