# Test Data Catalog

Quick reference for available test data scenarios. For detailed setup instructions, see
[dev-tools/README.md](../../dev-tools/README.md).

## Test Scenarios

### Cases

| Scenario                | Source Script                  | What It Tests                                                                                                                                                               |
| ----------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Historical Trustees** | `dxtr-historical-trustees.ts`  | Trustee changes over time: single stable trustee, single change, recent transitions, long tenure, multiple changes. Includes 341 meeting info for testing virtual meetings. |
| **Case Notes**          | `ch7-with-assignment.ts`       | Case notes and annotations                                                                                                                                                  |
| **Transfer Orders**     | `ch11-with-transfer-orders.ts` | Transfer order workflow (pending, approved, rejected states)                                                                                                                |
| **Consolidations**      | `consolidation-scenarios.ts`   | Case consolidations (lead cases, child cases, pending and approved states)                                                                                                  |
| **Case Assignments**    | `ch7-with-assignment.ts`       | Chapter 7 case assignment workflow                                                                                                                                          |
| **Fuzzy Search**        | `cases-fuzzy-search.ts`        | 41 cases with varied debtor names for testing phonetic search, homophones (John/Jon), misspellings (Smith/Smyth), nickname variations                                       |

### Trustees

| Scenario                         | Source Script                                              | What It Tests                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Oversight Assignments**        | `oversight-assignments.ts`                                 | Attorney-only, auditor-only, both, paralegal-only, and no-oversight assignment states                                                                                                                                                                                                                                                                                                             |
| **Trustee Staff**                | `trustee-staff.ts`                                         | Trustees with 0, 1, 2, and 3 staff for testing trustee staff management                                                                                                                                                                                                                                                                                                                           |
| **Key Dates**                    | `trustee-key-dates.ts`                                     | Trustees with and without key dates                                                                                                                                                                                                                                                                                                                                                               |
| **Match Verification**           | `trustee-match-all-scenarios.ts`                           | Multiple match candidates, imperfect matches, high-confidence matches, inactive trustees, status mismatches, multi-case mismatches (pending; already-resolved with a populated `affectedCaseIds` snapshot; already-resolved with no snapshot and no surviving surrogates, modeling the pre-CAMS-871 legacy state)                                                                                 |
| **Trustee Name Search**          | `trustee-fuzzy-search.ts`                                  | Exact/substring, phonetic (e.g. Smith/Smyth), nickname, and prefix name matching for trustee search — including the mismatch verification search modal                                                                                                                                                                                                                                            |
| **341 Meeting Info**             | `dxtr-historical-trustees.ts`, `trustees-comprehensive.ts` | Trustees with Zoom meeting details for 341 hearings                                                                                                                                                                                                                                                                                                                                               |
| **4-Level Sorting Test**         | `trustees-comprehensive.ts`                                | **Patricia Manhattan** (seed-trustee-ny-002) - 6 appointments demonstrating state → region → chapter → appointment type sorting across CA, ID, IA with real DXTR court IDs                                                                                                                                                                                                                        |
| **Ch11 Accordion States**        | `trustees-comprehensive.ts`                                | **Olivia Ashworth** (seed-trustee-add-025) - one trustee holding both an active and an inactive Chapter 11 case-by-case appointment, for verifying the appointment accordion's green (active) vs. gray (inactive) status tags side by side on the same trustee; both appointments collapse by default and expand independently on click                                                           |
| **Ch7 Elected Accordion States** | `trustees-comprehensive.ts`                                | **Marcus Whitfield** (seed-trustee-add-026) - one trustee holding both an active and an inactive Chapter 7 Elected appointment, for verifying the appointment accordion's green (active) vs. gray (inactive) status tags side by side on the same trustee; both appointments collapse by default and expand independently on click                                                                |
| **Ch11 SubV Accordion States**   | `trustees-comprehensive.ts`                                | **Derek Pemberton** (seed-trustee-add-027) - one trustee holding both a Chapter 11 Subchapter V Pool appointment (active) and an Out of Pool appointment (resigned), for verifying the appointment accordion's Pool ("Other" key-dates card) vs. Out of Pool (no key-dates card) bodies side by side on the same trustee; both appointments collapse by default and expand independently on click |
| **Comprehensive Trustee Set**    | `trustees-comprehensive.ts`                                | 24+ trustees with varied chapters, districts, and appointment types for pagination/filtering tests                                                                                                                                                                                                                                                                                                |
| **Trustee Case List**            | `trustee-case-list.ts`                                     | Paginated trustee with 60 active case appointments (pages of 25/25/10) across chapters 7, 11, 13 with varied dateFiled dates (2020–2024). Empty trustee for empty-state testing. Cases seeded in both DXTR (AO_CS, AO_PY, AO_DE) and Cosmos (SYNCED_CASE) so case detail and docket tabs render completely when following links.                                                                  |
| **Missing Email Trustee**        | `trustee-data.ts`                                          | **Nolan Nocontact** (seed-trustee-nocontact-001) - active, searchable trustee with an address and phone but no email, for exercising the "Email not provided" placeholder in `TrusteeSearchModal`'s selected-trustee comparison column                                                                                                                                                            |
| **Ch13 Standing Key Dates**      | `trustee-key-dates.ts`                                     | **Felicia Keydates** (seed-trustee-keydates-ch13-standing-001) - active appointment with fully populated key dates across all four Ch13 Standing accordion cards, and **Gregory Nokeydates** (seed-trustee-keydates-ch13-standing-empty) - inactive appointment with no key dates, for testing the "No date added" placeholder state and the accordion's default-closed behavior               |

### Administrative Data

| Scenario                | Source Script                                    | What It Tests                                                                        |
| ----------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| **Banks**               | `admin-data.ts`                                  | Active and inactive banks. Active: "Test Bank of America"                            |
| **Bankruptcy Software** | `admin-data.ts`                                  | Active and inactive bankruptcy software. Active: "BestCase Pro" with associated bank |
| **User Groups**         | Synced from production via `sync-user-groups.ts` | Trial Attorney, Auditor, Paralegal roles with real Okta users                        |

## Key Test Records

### 4-Level Appointment Sorting

**Trustee:** Patricia Manhattan

### Ch11 Accordion States

**Trustee:** Olivia Ashworth (`seed-trustee-add-025`) — active Ch11 case-by-case appointment
(Manhattan, division 091) and inactive Ch11 case-by-case appointment (Manhattan, division 081, dates
distinct from the 2020-01-01 default)

### Ch7 Elected Accordion States

**Trustee:** Marcus Whitfield (`seed-trustee-add-026`) — active Ch7 Elected appointment (Manhattan,
division 091) and inactive Ch7 Elected appointment (Manhattan, division 081, dates distinct from the
2020-01-01 default)

### Ch11 SubV Accordion States

**Trustee:** Derek Pemberton (`seed-trustee-add-027`) — active Chapter 11 Subchapter V Pool
appointment (Manhattan, division 091) and resigned Out of Pool appointment (Manhattan, division 081,
dates distinct from the 2020-01-01 default)

### Ch13 Standing Key Dates

**Trustees:** Felicia Keydates (`seed-trustee-keydates-ch13-standing-001`) — active appointment with
fully populated key dates across all four Ch13 Standing accordion cards; Gregory Nokeydates
(`seed-trustee-keydates-ch13-standing-empty`) — inactive appointment with no key dates

### Historical Trustee Changes

**Cases:** `091-99-86706`, `091-99-87899`, `091-99-99943`, `091-99-97816`, `091-99-98483`

### Oversight Assignment States

**Trustees:** Oliver Attorneyonly, Paula Auditoronly, Quinn Bothassigned, Rachel Paralegalassigned,
Steven Noassignments

### Trustee Staff

**Trustees:** Emma Singlestaff, Liam Singlestaff, Olivia Twostaff, Noah Twostaff, Sophia Threestaff,
Ethan Nostaff, Ava Nostaff

### Case Notes

**Cases:** `081-26-99476` (SEED Case Assignment Demo)

### Key Dates

**Trustees:** Marcus Keydates, Diana Keydates, Samuel Keydates, Emily Nokeydates, Priya Keydates
(Chapter 11 Subchapter V Pool, Last Monthly Report Received populated), Priya Nokeydates (Chapter 11
Subchapter V Pool, no key dates), Felicia Keydates (Chapter 13 Standing, active, all four accordion
cards populated including Audit and TPR completion-status tags), Gregory Nokeydates (Chapter 13
Standing, inactive appointment, no key dates — tests "No date added" defaults and default-closed
accordion state)

### 341 Meeting Info

**Trustees:** Stable Trustee, Second Trustee, Patricia Manhattan **Cases:** `091-99-86706`

### Trustee Case List

**Trustees:** Paginated Trustee, Empty Trustee

**Paginated trustee:** `cams-593-paginated` (Paginated Trustee) — 60 cases across chapters 7 (×3),
11 (×1), 13 (×1), court division Buffalo NY. Case IDs are dynamically generated at seed time.
Appointments have distinct `appointedDate` (15th) vs `dateFiled` (1st) for column differentiation.
Each case has 3 docket entries (petition, commencement notice, 341 meeting).

**Empty trustee:** `cams-593-empty` (Empty Trustee) — no active appointments, renders empty state.

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
