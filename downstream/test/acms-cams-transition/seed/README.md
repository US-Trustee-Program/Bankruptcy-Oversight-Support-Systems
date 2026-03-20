# Seed Data for Integration Testing

This directory contains SQL scripts to seed test databases with mock data.

## Scripts

### 01-seed-acms-replica.sql
Seeds the ACMS replica test database with mock data:
- **CMMPR** (Professional Master) - 5 professionals across NY and CA regions
- **CMMPT** (Professional Types) - TR (Trustee), AT (Attorney), S1/S2 (Staff)
- **CMMAP** (Appointments Master) - 5 case appointments

**Test Cases Created:**
- `081-24-12345`: Chapter 7 with NY trustee (ACMS only)
- `081-24-23456`: Chapter 11 with CA trustee (ACMS only)
- `081-24-34567`: Chapter 13 with NY trustee (ACMS only)
- `081-24-99999`: Chapter 15 with NY attorney (will be overridden by CAMS)
- `081-24-88888`: Chapter 15 with CA attorney (ACMS only, no CAMS override)

### 02-seed-cmmap-staging.sql
Seeds the CAMS downstream staging table with mock CAMS assignments:
- 3 Chapter 15 assignments using placeholder professional IDs (ZZ-*)

**Test Cases Created:**
- `081-24-77777`: NEW Chapter 15 assignment (not in ACMS)
- `081-24-99999`: OVERRIDE of existing ACMS Chapter 15 (replaces ACMS data)
- `081-24-66666`: UNASSIGNED Chapter 15 (inactive assignment)

## Expected View Results

When both seed scripts are run, the CMMAP view should return:

| Case ID | Source | Professional | Active | Notes |
|---------|--------|--------------|--------|-------|
| 081-24-12345 | ACMS | NY-00123 | Y | Ch7, ACMS only |
| 081-24-23456 | ACMS | CA-00789 | Y | Ch11, ACMS only |
| 081-24-34567 | ACMS | NY-00456 | Y | Ch13, ACMS only |
| 081-24-88888 | ACMS | CA-00222 | Y | Ch15, ACMS only |
| 081-24-99999 | **CAMS** | ZZ-99002 | Y | Ch15, **CAMS override** |
| 081-24-77777 | **CAMS** | ZZ-99001 | Y | Ch15, CAMS only |
| 081-24-66666 | **CAMS** | ZZ-99003 | N | Ch15, inactive |

**Key Observations:**
- Total: 7 appointments (5 from ACMS, 3 from CAMS, minus 1 override)
- ACMS case 081-24-99999 is **excluded** because CAMS has data for that case
- All CAMS assignments use placeholder professional IDs (ZZ-*)
- One CAMS assignment is inactive (APPTEE_ACTIVE='N')

## Usage

```bash
# Run on test databases
sqlcmd -S localhost -d acms_replica_test -i 01-seed-acms-replica.sql
sqlcmd -S localhost -d cams_downstream_test -i 02-seed-cmmap-staging.sql
```

## Notes

- Professional codes are realistic ACMS values (5-digit numeric)
- Dates use both ACMS numeric format (YYYYMMDD) and SQL DATETIME2
- All records use DELETE_CODE=' ' (active)
- CAMS assignments use SOURCE='CAMS' metadata field
