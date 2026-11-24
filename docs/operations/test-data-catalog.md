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

| Scenario                                 | Source Script                                              | What It Tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Oversight Assignments**                | `oversight-assignments.ts`                                 | Attorney-only, auditor-only, both, paralegal-only, and no-oversight assignment states                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Trustee Staff**                        | `trustee-staff.ts`                                         | Trustees with 0, 1, 2, and 3 staff for testing trustee staff management                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Key Dates**                            | `trustee-key-dates.ts`                                     | Trustees with and without key dates                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Match Verification**                   | `trustee-match-all-scenarios.ts`                           | Identity tasks whose findings are the real pipeline's output (see `trustee-match-findings.scenarios.ts`): no candidates, 2 tied candidates (ambiguous), 1 candidate per explanation-sentence shape (name/address/phone, state only, name/address/email, exact name, nothing to compare), multi-case mismatches (pending; already-resolved with a populated `affectedCaseIds` snapshot; already-resolved with no snapshot and no surviving surrogates), caseless pending tasks (DXTR **C Caselessmatch**; ACMS-sourced **A Acmsambiguous**, `seed-match-acms-ambiguous`, ambiguous between Avery and Ashley Acmsambiguous with ACMS professional id `SEED-ACMS-AMBIGUOUS`, as the ACMS professional-id sync writes it; ACMS-sourced **Noel Acmsnomatch**, `seed-match-acms-no-match`, no match with one name-passing candidate whose state differs, ACMS professional id `SEED-ACMS-NO-MATCH`), ACMS-sourced case-bearing tasks with their case's surrogate appointment, as the ACMS case-appointment sync writes them (CAMS-955): **B Acmscaseambiguous** (`091-99-64660`, Ch 11, ACMS professional id `SEED-ACMS-CASE-AMBIGUOUS`) and **Nova Acmscasenomatch** (`091-99-75623`, Ch 12) |
| **Trustee Name Search**                  | `trustee-fuzzy-search.ts`                                  | Exact/substring, phonetic (e.g. Smith/Smyth), nickname, and prefix name matching for trustee search — including the mismatch verification search modal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **341 Meeting Info**                     | `dxtr-historical-trustees.ts`, `trustees-comprehensive.ts` | Trustees with Zoom meeting details for 341 hearings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **4-Level Sorting Test**                 | `trustees-comprehensive.ts`                                | **Patricia Manhattan** (seed-trustee-ny-002) - 6 appointments demonstrating state → region → chapter → appointment type sorting across CA, ID, IA with real DXTR court IDs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Ch11 Accordion States**                | `trustees-comprehensive.ts`                                | **Olivia Ashworth** (seed-trustee-add-025) - one trustee holding both an active and an inactive Chapter 11 case-by-case appointment, for verifying the appointment accordion's green (active) vs. gray (inactive) status tags side by side on the same trustee; both appointments collapse by default and expand independently on click                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Ch7 Elected Accordion States**         | `trustees-comprehensive.ts`                                | **Marcus Whitfield** (seed-trustee-add-026) - one trustee holding both an active and an inactive Chapter 7 Elected appointment, for verifying the appointment accordion's green (active) vs. gray (inactive) status tags side by side on the same trustee; both appointments collapse by default and expand independently on click                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Ch11 SubV Accordion States**           | `trustees-comprehensive.ts`                                | **Derek Pemberton** (seed-trustee-add-027) - one trustee holding both a Chapter 11 Subchapter V Pool appointment (active) and an Out of Pool appointment (resigned), for verifying the appointment accordion's Pool ("Other" key-dates card) vs. Out of Pool (no key-dates card) bodies side by side on the same trustee; both appointments collapse by default and expand independently on click                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Comprehensive Trustee Set**            | `trustees-comprehensive.ts`                                | 24+ trustees with varied chapters, districts, and appointment types for pagination/filtering tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Zoom Phone Correction (CAMS-975)**     | `trustees-comprehensive.ts`                                | Six trustees whose Zoom phones are stored in the format the Zoom Info Import used before validation, for exercising the CORRECT-TRUSTEE-ZOOM-PHONES migration ([runbook](/operations/correct-trustee-zoom-phones.md)). All other Zoom fields are valid. Converted by the migration: **Alpha Zoomfix** (`seed-trustee-cams975-01`, `(555) 010-0123`), **Bravo Zoomfix** (`seed-trustee-cams975-02`, `(555)010-0123`), **Charlie Zoomfix** (`seed-trustee-cams975-03`, `(555) 010-0123 x123`). Flagged for review: **Delta Zoomfix** (`seed-trustee-cams975-04`, `214-45`), **Echo Zoomfix** (`seed-trustee-cams975-05`, empty). Already valid: **Foxtrot Zoomfix** (`seed-trustee-cams975-06`, `555-010-0123`). Re-seeding restores the original values                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Trustee Appointment Tasks (CAMS-956)** | `trustee-appointment-tasks.ts`                             | Data Verification "Trustee Appointment" tasks and the identity tasks whose approval reaches them. Requires `cases-fuzzy-search.ts` to be seeded first (a default run does). See [Trustee Appointment Tasks (CAMS-956)](#trustee-appointment-tasks-cams-956) below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Trustee Case List**                    | `trustee-case-list.ts`                                     | Paginated trustee with 60 active case appointments (pages of 25/25/10) across chapters 7, 11, 13 with varied dateFiled dates (2020–2024). Empty trustee for empty-state testing. Cases seeded in both DXTR (AO_CS, AO_PY, AO_DE) and Cosmos (SYNCED_CASE) so case detail and docket tabs render completely when following links.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Missing Email Trustee**                | `trustee-data.ts`                                          | **Nolan Nocontact** (seed-trustee-nocontact-001) - active, searchable trustee with an address and phone but no email, for exercising the "Email not provided" placeholder in `TrusteeSearchModal`'s selected-trustee comparison column                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Nickname Identity Task**               | `trustee-data.ts`                                          | **Samuel Seedtrustee** - a name-only DXTR source; the pipeline recalls **Sam** (nickname, `strong`) and **Pat Seedtrustee** (no name match), so the task is ambiguous                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Ch13 Standing Key Dates**              | `trustee-key-dates.ts`                                     | **Felicia Keydates** (seed-trustee-keydates-ch13-standing-001) - active appointment with fully populated key dates across all four Ch13 Standing accordion cards, and **Gregory Nokeydates** (seed-trustee-keydates-ch13-standing-empty) - inactive appointment with no key dates, for testing the "No date added" placeholder state and the accordion's default-closed behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

### Appointment Accordions (CAMS-909–915)

One-stop matrix of the trustee-appointment accordion coverage, which otherwise spans two scripts and
several rows above. Rows are the chapter/appointment-type variants the CAMS-909–915 epic migrated
onto `AppointmentAccordion`.

| Chapter / Appointment Type | Populated Key Dates                                                                            | Empty / No Saved Key Dates                  | Active + Inactive Side-by-Side (status tags)                                     | Source Script(s)                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Ch7 Panel**              | Marcus Keydates, Diana Keydates, Samuel Keydates (quarter/mid-quarter/year-boundary TIR dates) | Emily Nokeydates                            | —                                                                                | `trustee-key-dates.ts`                              |
| **Ch7 Elected**            | Owen Keydates (bond dates)                                                                     | Owen Nokeydates                             | Owen Inactivekeydates (inactive appt); Marcus Whitfield (`seed-trustee-add-026`) | `trustee-key-dates.ts`, `trustees-comprehensive.ts` |
| **Ch11 Case by Case**      | —                                                                                              | —                                           | Olivia Ashworth (`seed-trustee-add-025`)                                         | `trustees-comprehensive.ts`                         |
| **Ch11 Subchapter V Pool** | Priya Keydates                                                                                 | Priya Nokeydates                            | Derek Pemberton (`seed-trustee-add-027` — Pool active + Out of Pool resigned)    | `trustee-key-dates.ts`, `trustees-comprehensive.ts` |
| **Ch12 Case by Case**      | Nadia Keydates (TPR dates)                                                                     | —                                           | —                                                                                | `trustee-key-dates.ts`                              |
| **Ch13 Case by Case**      | —                                                                                              | Nadia Nokeydates                            | —                                                                                | `trustee-key-dates.ts`                              |
| **Ch12 Standing**          | Catherine Keydates (Audit/TPR completion status, Last TPR Submitted)                           | —                                           | —                                                                                | `trustee-key-dates.ts`                              |
| **Ch13 Standing**          | Felicia Keydates (all four accordion cards populated)                                          | Gregory Nokeydates (inactive, no key dates) | Felicia Keydates (active) / Gregory Nokeydates (inactive) pair                   | `trustee-key-dates.ts`                              |

### Trustee Appointment Tasks (CAMS-956)

Seeded by `trustee-appointment-tasks.ts`. Tasks 1-9 are Trustee Appointment tasks in the Data
Verification queue; 11-13 are Trustee Identity tasks whose approval reaches one. `unseed` also
removes any appointment task the app opens for a seeded trustee-match candidate during testing.

| #   | Trustee                                       | Court / Chapter           | What It Tests                                                                                                  |
| --- | --------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | **Pat Noappointments**                        | Buffalo Ch 11, 1 case     | No appointments at all ("This trustee has no appointments in CAMS."); add one on the profile, then refresh     |
| 2   | **Morgan Mismatchappt**                       | Manhattan Ch 12, 3 cases  | 7 appointments that differ in district, division, chapter or status: table ordering, pagination, warning icons |
| 3   | **Morgan Mismatchappt**                       | Delaware Ch 13, 1 case    | A second task for the same trustee                                                                             |
| 4   | **Ines Inactiveappt**                         | Buffalo Ch 12, 2 cases    | "Appointment inactive" reason sentence                                                                         |
| 5   | **Ria Readyappt**                             | Delaware Ch 7, 3 cases    | Already covered: Refresh Trustee Appointments resolves the task for all 3 cases                                |
| 6   | **Rae Resolvedappt**                          | Delaware Ch 7, 1 case     | Already resolved (shown when the queue includes verified tasks)                                                |
| 7   | **Mary Manycasesappt**                        | Manhattan Ch 7, 12 cases  | A long affected-case list                                                                                      |
| 8   | **Nolan Nocourtnameappt**                     | Court 0674 Ch 12, 2 cases | Unresolvable court names: the row and subject fall back to the codes ("0674 (674)")                            |
| 9   | **Paige Partialappt**                         | Delaware Ch 7, 3 cases    | Partial coverage: one case was closed and one reassigned, so refresh verifies 1 case                           |
| 10  | Placeholder and parked records                | Manhattan Ch 7            | A placeholder (`081-26-90171`) and a parked record (`081-99-90001`) that must never join a task                |
| 11  | **Jules Joinmatch** → **Julia Joinmatch**     | Manhattan Ch 13           | Approving joins Julia's open task, which grows from 1 to 2 cases                                               |
| 12  | **Remy Reopenmatch** → **Rowena Reopenmatch** | Delaware Ch 13            | Approving reopens Rowena's resolved task (her appointment has since resigned) with the new case                |
| 13  | **V Coverpair** → **Vera** or **Vince**       | Manhattan Ch 7            | Vera covers the case and Vince does not, so the approval preview differs; switch candidates to test staleness  |

### Administrative Data

| Scenario                  | Source Script                                    | What It Tests                                                                                                 |
| ------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **Banks**                 | `admin-data.ts`                                  | Active and inactive banks. Active: "Test Bank of America"                                                     |
| **Bankruptcy Software**   | `admin-data.ts`                                  | Active and inactive bankruptcy software. Active: "BestCase Pro" with associated bank                          |
| **User Groups**           | Synced from production via `sync-user-groups.ts` | Trial Attorney, Auditor, Paralegal roles with real Okta users                                                 |
| **Super User Permission** | Not seeded                                       | Provisioned once per environment with the Compass script; see [Super User Permission](#super-user-permission) |

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
accordion state), Catherine Keydates (Chapter 12 Standing; audit/TPR completion status and Last TPR
Submitted populated for the accordion's Audit and Trustee Performance Report cards)

### 341 Meeting Info

**Trustees:** Stable Trustee, Second Trustee, Patricia Manhattan **Cases:** `091-99-86706`

### Trustee Case List

**Trustees:** Paginated Trustee, Empty Trustee

**Paginated trustee:** `cams-593-paginated` (Paginated Trustee) — 60 cases across chapters 7 (×3),
11 (×1), 13 (×1), court division Buffalo NY. Case IDs are dynamically generated at seed time.
Appointments have distinct `appointedDate` (15th) vs `dateFiled` (1st) for column differentiation.
Each case has 3 docket entries (petition, commencement notice, 341 meeting).

**Empty trustee:** `cams-593-empty` (Empty Trustee) — no active appointments, renders empty state.

### Super User Permission

Super User isn't seeded. With `cams-role-assignments` on, nobody can use Administration >
Permissions until someone holds Super User, so the first one is written directly to the target
database: paste `dev-tools/superuser/provision-super-user.compass.js` into the MongoDB Compass shell
connected to that environment, after setting `USER_ID`, `USER_NAME`, `USER_EMAIL` and `DATABASE` at
the top. It writes one Super User permission and its CREATED audit entry, and does nothing if the
user already holds Super User. It stops without writing if `user-role-assignments` doesn't have its
unique `{userId, activeKey}` index yet; deploy `cosmos-collections.bicep` to the environment first.
The script comes from PR #3353. Grant every later permission from the Permissions screen. See
[ADR: Provision the first Super User with a Compass script](../architecture/decision-records/ProvisionFirstSuperUserWithCompassScript.md).

**Removing a Super User.** There's no revoke on the Permissions screen yet; it's planned as future
work. Until then, revoke in the same Compass shell with the update the app itself makes. Set
`active: false` **and** replace `activeKey`: the unique `{userId, activeKey}` index ignores
`active`, so a permission left with `activeKey: 'SuperUser|*|*'` would make a later grant for the
same user fail. Never delete the permission or its audit entries.

```js
const USER_ID = 'REPLACE_WITH_OKTA_USER_ID';
const cams = db.getSiblingDB('cams');
const held = cams.getCollection('user-role-assignments').findOne({
  documentType: 'USER_ROLE_ASSIGNMENT',
  userId: USER_ID,
  activeKey: 'SuperUser|*|*',
  active: true,
});
cams
  .getCollection('user-role-assignments')
  .updateOne(
    { userId: held.userId, id: held.id, active: true },
    { $set: { active: false, activeKey: 'inactive|' + held.id } },
  );
cams.getCollection('role-assignment-audit').insertOne({
  documentType: 'ROLE_ASSIGNMENT_AUDIT',
  id: UUID().toHexString(true),
  assignmentId: held.id,
  action: 'DEACTIVATED',
  userId: held.userId,
  userName: held.userName,
  role: 'SuperUser',
  regionId: null,
  officeCode: null,
  performedBy: 'SUPERUSER_MANUAL_REVOKE',
  performedByName: 'Manual Super User revoke',
  performedAt: new Date().toISOString(),
  previousState: { role: 'SuperUser', regionId: null, officeCode: null, active: true },
  newState: { role: 'SuperUser', regionId: null, officeCode: null, active: false },
  replacedByAssignmentId: null,
});
cams.getCollection('user-session-cache').deleteMany({ 'user.id': USER_ID });
```

Set `USER_ID`, and replace `'cams'` if the environment's database has another name. If `held` is
`null`, the user holds no active Super User and there's nothing to revoke. The last line clears the
user's cached sessions. Without it, a session already signed in keeps Super User until its token
expires, up to about an hour.

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
