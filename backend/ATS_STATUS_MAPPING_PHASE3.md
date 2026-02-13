# ATS Status Mapping Corrections - Phase 3

**CAMS-596**: Migrate Trustee Profiles - Phase 3: Status Mapping Corrections

## Overview

Phase 3 corrected the mappings from ATS `CHAPTER_DETAILS.STATUS` (TOD STATUS) codes to CAMS appointment types and statuses. These corrections ensure accurate appointment data migration from the legacy ATS system.

## Background

The initial implementation (Phase 1-2) used incorrect mappings that didn't align with the actual meanings of ATS status codes. Phase 3 corrected these mappings based on analysis of production ATS data and business requirements.

## Complete Status Code Mapping

### Letter Codes

| ATS Code | CAMS Appointment Type | CAMS Status | Notes |
|----------|----------------------|-------------|-------|
| **P** | panel | active | Standard panel appointment |
| **PA** | panel | active | Panel active (explicit) |
| **PI** | panel | voluntarily-suspended | Panel inactive (Phase 3: was 'inactive') |
| **NP** | off-panel | resigned | New in Phase 3 |
| **VR** | out-of-pool | resigned | New in Phase 3 (Subchapter V) |
| **V** | pool | active | Phase 3: was 'converted-case', now pool |
| **O** | converted-case | active | Phase 3: was 'off-panel' |
| **C** | case-by-case | active | Case-by-case appointment |
| **S** | standing | active | Standing trustee |
| **E** | elected | active | New in Phase 3 |

### Numeric Codes

Phase 3 replaced 16 invalid codes with 9 correct codes:

| ATS Code | CAMS Appointment Type | CAMS Status | Valid For |
|----------|----------------------|-------------|-----------|
| **1** | case-by-case | active | Ch11 (default); Ch12/13 override to 'standing' |
| **3** | standing | resigned | Ch12/13 |
| **5** | standing | terminated | Ch12/13 |
| **6** | standing | terminated | Ch13 |
| **7** | standing | deceased | Ch12/13 |
| **8** | case-by-case | active | Ch11 |
| **9** | case-by-case | inactive | Ch11 |
| **10** | case-by-case | inactive | Ch11 |
| **12** | case-by-case | active | Ch11 |

**Removed Invalid Codes** (Phase 1-2): 2, 4, 11, 13, 14, 15, 16

## Special Case Handling

### 1. CBC Chapter Overrides

CBC (Case-by-Case) chapters (`12CBC`, `13CBC`) override BOTH `appointmentType` and `status` from the flat map.

#### 12CBC Status Map
| Status Code | Appointment Type | Status |
|------------|-----------------|--------|
| 1 | case-by-case | active |
| 2 | case-by-case | active |
| 3 | case-by-case | inactive |
| 5 | case-by-case | inactive |
| 7 | case-by-case | inactive |

#### 13CBC Status Map
| Status Code | Appointment Type | Status |
|------------|-----------------|--------|
| 1 | case-by-case | active |
| 3 | case-by-case | inactive |

**Implementation**: `CBC_STATUS_MAP` in `ats.constants.ts`

### 2. Chapter 11 Subchapter V

When `CHAPTER = 11` and `STATUS = V` or `VR`, the chapter resolves to `11-subchapter-v`:

| Status Code | Resolved Chapter | Appointment Type | Status |
|------------|------------------|-----------------|--------|
| V | 11-subchapter-v | pool | active |
| VR | 11-subchapter-v | out-of-pool | resigned |

**Implementation**: `SUBCHAPTER_V_STATUS_CODES` in `ats.constants.ts`

### 3. Code 1 Chapter-Dependent Override

Status code `1` has different meanings depending on the chapter:

| Chapter | Appointment Type | Status |
|---------|-----------------|--------|
| 12 | standing | active |
| 13 | standing | active |
| 11 | case-by-case | active (flat map default) |
| 7 | case-by-case | active (flat map default) |

**Implementation**: `CODE_1_STANDING_CHAPTERS` in `ats.constants.ts`

## Transformation Logic

The transformation follows this precedence order:

1. **CBC Chapter Override**: If `CHAPTER` is in `CBC_STATUS_MAP`, use CBC-specific mapping
2. **Subchapter V Resolution**: If `CHAPTER = 11` and `STATUS` in `SUBCHAPTER_V_STATUS_CODES`, resolve to `11-subchapter-v`
3. **Code 1 Chapter Override**: If `STATUS = 1` and `CHAPTER` in `CODE_1_STANDING_CHAPTERS`, map to standing/active
4. **Legacy CBC Appointment Type**: If chapter parsing gave an appointmentType (12CBC/13CBC), use that
5. **Flat Map Default**: Use `TOD_STATUS_MAP` lookup

**Implementation**: `transformAppointmentRecord()` in `ats-mappings.ts`

## Status Derivation (Trustee-Level)

Trustee-level status is derived from all appointment statuses:

```
Priority:
1. If ANY appointment is 'active' → Trustee is ACTIVE
2. If ANY appointment is 'voluntarily-suspended' or 'involuntarily-suspended' → Trustee is SUSPENDED
3. Otherwise → Trustee is NOT_ACTIVE
```

**Key Change in Phase 3**: The derivation now uses `transformAppointmentRecord()` instead of `parseTodStatus()` to ensure CBC overrides and chapter-dependent logic are applied correctly.

**Implementation**: `deriveTrusteeStatus()` in `ats-mappings.ts`, called from `migrate-trustees.ts`

## Validation Checklist

### Chapter/Appointment Type Validation

Valid combinations enforced by `isValidAppointmentForChapter()`:

| Chapter | Valid Appointment Types |
|---------|------------------------|
| 7 | panel, off-panel, elected, converted-case |
| 11 | case-by-case |
| 11-subchapter-v | pool, out-of-pool |
| 12 | standing, case-by-case |
| 13 | standing, case-by-case |

Invalid combinations are logged and skipped during migration.

## Testing

### Unit Tests

**Mapping Tests** (`ats-mappings.test.ts`):
- 91 test cases covering all status codes
- Tests for CBC overrides
- Tests for Subchapter V resolution
- Tests for Code 1 chapter-dependent override

**Migration Tests** (`migrate-trustees.test.ts`):
- 22 test cases including status derivation
- Tests for CBC-aware status derivation
- Tests for fallback logic when transformation fails

### Mock Data

**File**: `backend/mock-chapter-details.sql`
- 155 appointment records
- 20 real TRU_IDs from ATS
- Comprehensive coverage of all status codes
- Edge cases (NULL status, old/recent dates)

### Manual Testing

Use the test script to verify mappings against real ATS data:

```bash
# Preview appointments with their mapped values
npx tsx scripts/test-trustee-migration-local.ts preview 10
```

## Migration Notes

### Error Handling

- **Unknown Status Codes**: Default to `panel` / `active`, log warning
- **NULL Status**: Falls back to `parseTodStatus()` if full transformation fails
- **Invalid Chapter/Type**: Logged as warning, appointment skipped
- **Transformation Errors**: Caught and logged, uses fallback logic

### Performance Considerations

- Status derivation processes all appointments for each trustee
- Each appointment is fully transformed (CBC-aware)
- Fallback logic prevents migration failures due to data quality issues

## References

### Source Files

- **Constants**: `lib/adapters/gateways/ats/ats.constants.ts`
- **Mappings**: `lib/adapters/gateways/ats/ats-mappings.ts`
- **Migration**: `lib/use-cases/dataflows/migrate-trustees.ts`
- **Tests**: `lib/adapters/gateways/ats/ats-mappings.test.ts`
- **Tests**: `lib/use-cases/dataflows/migrate-trustees.test.ts`

### Related Documentation

- **Testing Guide**: `TESTING_TRUSTEE_MIGRATION.md`
- **Mock Data**: `mock-chapter-details.sql`
- **Phase 3 Plan**: `/Users/jonathancruz/git/ustp-cams-fdp/ai/specs/CAMS-596-migrate-trustee-profiles/phase-3-status-mappings.md`

## Change History

### Phase 3 (2026-02-13)

**Letter Code Changes:**
- PI: `inactive` → `voluntarily-suspended`
- O: `off-panel` → `converted-case`
- V: `converted-case` → `pool`
- Added: NP, VR, E

**Numeric Code Changes:**
- Removed: 2, 4, 11, 13, 14, 15, 16
- Updated meanings for: 1, 3, 5, 6, 7, 8, 9, 10, 12

**New Features:**
- CBC chapter status overrides
- Subchapter V resolution (11-subchapter-v)
- Code 1 chapter-dependent override
- CBC-aware status derivation

**Testing:**
- 91 mapping test cases (was ~42)
- 22 migration test cases (was 20)
- Mock SQL data with 155 records

### Phase 1-2 (Previous)

- Initial TOD_STATUS_MAP with 42+ codes
- Basic chapter/status mapping
- Flat map lookup only

---

**Last Updated**: 2026-02-13
**Author**: Phase 3 Implementation Team
**Ticket**: CAMS-596
