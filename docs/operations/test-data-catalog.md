# Test Data Catalog

Quick reference for available test data scenarios. For detailed setup instructions, see [dev-tools/README.md](../../dev-tools/README.md).

## Test Scenarios

### Cases

| Scenario | Source Script | What It Tests |
|----------|---------------|---------------|
| **Historical Trustees** | `dxtr-historical-trustees.ts` | Trustee changes over time: single stable trustee, single change, recent transitions, long tenure, multiple changes. Includes 341 meeting info for testing virtual meetings. |
| **Case Notes** | `ch7-with-assignment.ts` | Case notes and annotations |
| **Transfer Orders** | `ch11-with-transfer-orders.ts` | Transfer order workflow (pending, approved, rejected states) |
| **Consolidations** | `consolidation-scenarios.ts` | Case consolidations (lead cases, child cases, pending and approved states) |
| **Case Assignments** | `ch7-with-assignment.ts` | Chapter 7 case assignment workflow |
| **Fuzzy Search** | `cases-fuzzy-search.ts` | 41 cases with varied debtor names for testing phonetic search, homophones (John/Jon), misspellings (Smith/Smyth), nickname variations |

### Trustees

| Scenario | Source Script | What It Tests |
|----------|---------------|---------------|
| **Oversight Assignments** | `oversight-assignments.ts` | Attorney-only, auditor-only, both, paralegal-only, and no-oversight assignment states |
| **Trustee Assistants** | `trustee-assistants.ts` | Trustees with 0, 1, 2, and 3 assistants for testing assistant management |
| **Key Dates** | `trustee-key-dates.ts` | Trustees with and without key dates |
| **Match Verification** | `trustee-match-all-scenarios.ts` | Multiple match candidates, imperfect matches, high-confidence matches, inactive trustees, status mismatches |
| **341 Meeting Info** | `dxtr-historical-trustees.ts`, `trustees-comprehensive.ts` | Trustees with Zoom meeting details for 341 hearings |
| **4-Level Sorting Test** | `trustees-comprehensive.ts` | **Patricia Manhattan** (seed-trustee-ny-002) - 6 appointments demonstrating state → region → chapter → appointment type sorting across CA, ID, IA with real DXTR court IDs |
| **Comprehensive Trustee Set** | `trustees-comprehensive.ts` | 24+ trustees with varied chapters, districts, and appointment types for pagination/filtering tests |
| **Trustee Case List** | `trustee-case-list.ts` | Paginated trustee with 60 active case appointments (pages of 25/25/10) across chapters 7, 11, 13 with varied dateFiled dates (2020–2024). Empty trustee for empty-state testing. Cases seeded in both DXTR (AO_CS, AO_PY, AO_DE) and Cosmos (SYNCED_CASE) so case detail and docket tabs render completely when following links. |

### Administrative Data

| Scenario | Source Script | What It Tests |
|----------|---------------|---------------|
| **Banks** | `admin-data.ts` | Active and inactive banks. Active: "Test Bank of America" |
| **Bankruptcy Software** | `admin-data.ts` | Active and inactive bankruptcy software. Active: "BestCase Pro" with associated bank |
| **User Groups** | Synced from production via `sync-user-groups.ts` | Trial Attorney, Auditor, Paralegal roles with real Okta users |

## Key Test Records

### 4-Level Appointment Sorting
**Trustee:** Patricia Manhattan

### Historical Trustee Changes
**Cases:** `091-99-86706`, `091-99-87899`, `091-99-99943`, `091-99-97816`, `091-99-98483`

### Oversight Assignment States
**Trustees:** Oliver Attorneyonly, Paula Auditoronly, Quinn Bothassigned, Rachel Paralegalassigned, Steven Noassignments

### Trustee Assistants
**Trustees:** Trustee OneAssistant, Trustee TwoAssistants, Trustee ThreeAssistants, Trustee NoAssistants

### Case Notes
**Cases:** `081-26-99476`

### Key Dates
**Trustees:** seed-trustee-keydates-001, seed-trustee-keydates-002, seed-trustee-keydates-003, seed-trustee-keydates-empty

### 341 Meeting Info
**Trustees:** Stable Trustee, Second Trustee, Patricia Manhattan
**Cases:** `091-99-86706`

### Trustee Case List
**Paginated trustee:** `cams-593-paginated` — 60 cases across chapters 7 (×3), 11 (×1), 13 (×1), court division Buffalo NY. Case IDs are dynamically generated at seed time. Appointments have distinct `appointedDate` (15th) vs `dateFiled` (1st) for column differentiation. Each case has 3 docket entries (petition, commencement notice, 341 meeting).
**Empty trustee:** `cams-593-empty` — no active appointments, renders empty state.

### Bank and Software Assignments
**Trustee:** Michael James Brooklyn

## Reseeding Data

Reseed all test data:
```bash
# Local environment
npm run seed:local

# Main/shared dev environment
npm run seed:main
```

Reseed specific scenarios:
```bash
npm run seed:local -- --scenario=trustees-comprehensive
npm run seed:local -- --scenario=oversight-assignments
npm run seed:local -- --scenario=dxtr-historical-trustees
npm run seed:local -- --scenario=trustee-case-list
```

For complete usage instructions, see [dev-tools/README.md](../../dev-tools/README.md).
