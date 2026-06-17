# Seed Data for Integration Testing

This directory contains SQL scripts to seed test databases with mock data.

## Scripts

### 01-seed-acms-replica.sql
Seeds the ACMS replica test database with mock data:
- **CMMPR** (Professional Master) - 5 professionals across NY and CA regions
- **CMMPT** (Professional Types) - TR (Trustee), AT (Attorney), S1/S2 (Staff)
- **CMMAP** (Appointments Master) - 6 case appointments

**Test Cases Created:**
- `081-24-12345`: Chapter 7 with NY trustee (ACMS only)
- `081-24-23456`: Chapter 11 with CA trustee (ACMS only)
- `081-24-34567`: Chapter 13 with NY trustee (ACMS only)
- `081-24-88888`: Chapter 15 with CA attorney (ACMS only, no CAMS override)
- `081-24-99999`: Chapter 15 with NY attorney (will be overridden by CAMS S1)
- `081-24-55555`: Chapter 7 trustee (will be overridden by CAMS TR)

### 02-seed-cmmap-cams.sql
Seeds the `CMMAP_CAMS` table with mock CAMS appointments (audit trail).

**Test Cases Created:**
- `081-24-77777 S1`: NEW Ch15 assignment (not in ACMS)
- `081-24-99999 S1`: OVERRIDE of existing ACMS Ch15 assignment
- `081-24-66666 S1`: UNASSIGNED Ch15 (inactive, APPT_DISP='WD')
- `081-24-55555 TR`: OVERRIDE of existing ACMS trustee (APPT_DISP='GR')

### 03-seed-cmmap-all.sql
Seeds the `CMMAP_ALL` table with unified appointment state — the same state that
the dual-write path (event handler) and daily ACMS sync would produce in production.

**ACMS-sourced rows (SOURCE='ACMS'):**
- `081-24-12345 TR`, `081-24-23456 TR`, `081-24-34567 TR`, `081-24-88888 S1`

**CAMS-sourced rows (SOURCE='CAMS'):**
- `081-24-77777 S1`, `081-24-99999 S1`, `081-24-66666 S1`, `081-24-55555 TR`

## Expected CMMAP_ALL State After Seeding

| Case ID | APPT_TYPE | Source | Prof | Active | Notes |
|---------|-----------|--------|------|--------|-------|
| 081-24-12345 | TR | ACMS | 123 | Y | Ch7, ACMS only |
| 081-24-23456 | TR | ACMS | 789 | Y | Ch11, ACMS only |
| 081-24-34567 | TR | ACMS | 456 | Y | Ch13, ACMS only |
| 081-24-88888 | S1 | ACMS | 222 | Y | Ch15, ACMS only |
| 081-24-77777 | S1 | **CAMS** | 63 | Y | Ch15, CAMS only |
| 081-24-99999 | S1 | **CAMS** | 88 | Y | Ch15, **CAMS override** of ACMS Prof 111 |
| 081-24-55555 | TR | **CAMS** | 321 | Y | Ch7, **CAMS override** of ACMS Prof 123 |
| 081-24-66666 | S1 | **CAMS** | 42 | N | Ch15, inactive (WD) |

**Total: 8 rows** — the 6 ACMS rows from `01-seed-acms-replica.sql` contribute 4 rows
to `CMMAP_ALL` (the ACMS rows for `081-24-99999 S1` and `081-24-55555 TR` are excluded
because CAMS owns those). The 4 CAMS rows bring the total to 8. No duplicates.
