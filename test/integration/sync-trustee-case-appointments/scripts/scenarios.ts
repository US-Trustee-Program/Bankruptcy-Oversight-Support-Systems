/**
 * Scenario catalog for the sync-trustee-case-appointments harness.
 *
 * Each scenario is written once, source-neutral, and rendered by harness.ts into ACMS rows
 * (CMMAP/CMMDB/CMMPR/CMMKE), DXTR rows (AO_CS/AO_PY/AO_TX), or both. Scenarios are BDD in principle:
 * Given (cases, trustees, links, prior CAMS state) / When (a source read + sync pass) / Then
 * (expected CAMS state). Expectations describe DESIRED behavior; where production code does not yet
 * behave that way the scenario fails, and that failure is the harness doing its job.
 *
 * `basis` says where each expectation comes from, so nobody mistakes a guess for a requirement:
 *   feature     - scenario of the same name in test/bdd2/specs/CAMS-955-acms-case-appointment-sync.feature
 *   bead        - a beads issue (referenced in `note`)
 *   code        - read from production code (referenced in `note`); not yet a stated requirement
 *   decision    - stated by a maintainer in review (named in `note`)
 *   provisional - a conceivable edge case with a reasonable but UNCONFIRMED expectation; confirm or
 *                 correct it when the behavior is built
 *
 * REGIONS. Region is a first-class axis: every case belongs to a division, every division to a group
 * and a region (DIVISIONS below), and CAMS-955/956/957 all segment by region (per-region bookmarks,
 * per-region ACMS/DXTR source). Fixtures are therefore spread over three regions, and region 02 has
 * two divisions in two groups so one region exercises multi-division behavior.
 *
 * REALISM. Shapes were checked against retained staging exports (aggregates only; no real values are
 * stored here): ACMS names are upper-case (6,769 of 6,770), 4% have no address, 14% have phone 0,
 * every ZIP is ZIP+4, 304 last names carry a suffix or decoration, 511 first names are multi-word;
 * DXTR variants have generation (4%), address2 (40%), parenthesized phones (22%), and 5% upper-case
 * names. The ACMS renderer in harness.ts upper-cases every text field to match, so every ACMS scenario
 * also proves case-insensitive matching.
 *
 * This file is intentionally self-contained and not shared with any other harness.
 */

export type Lane = 'ACMS' | 'DXTR';
export type Basis = 'feature' | 'bead' | 'decision' | 'code' | 'provisional';

// ---------------------------------------------------------------------------
// Geography: region -> group -> division -> court. Region 02 uses real USTP codes (081 Manhattan /
// court 0208, 066 Utica / court 0206; note UT is the Utica NY group, NOT Utah). Regions 03 and 04 are
// synthetic and exist to prove isolation and routing.
// ---------------------------------------------------------------------------

export type Division = {
  code: string;
  region: string;
  regionName: string;
  group: string;
  court: string;
  courtName: string;
  officeCode: string;
  officeName: string;
  /** Two-letter state the division's trustees live in. */
  state: string;
  /** DXTR AO_CS.CS_DIV when it differs from the ACMS division code (AO_CS_DIV.CS_DIV_ACMS). */
  dxtrDivision?: string;
};

export const DIVISIONS: Record<string, Division> = {
  '081': {
    code: '081',
    region: '02',
    regionName: 'NEW YORK',
    group: 'NY',
    court: '0208',
    courtName: 'Southern District of New York',
    officeCode: '1',
    officeName: 'Manhattan',
    state: 'NY',
  },
  '066': {
    code: '066',
    region: '02',
    regionName: 'NEW YORK',
    group: 'UT',
    court: '0206',
    courtName: 'Northern District of New York',
    officeCode: '6',
    officeName: 'Utica',
    state: 'NY',
  },
  '301': {
    code: '301',
    region: '03',
    regionName: 'SYNTHETIC REGION 3',
    group: 'PA',
    court: '0301',
    courtName: 'Synthetic District 3',
    officeCode: '1',
    officeName: 'Synthetic Office 3',
    state: 'PA',
  },
  '401': {
    code: '401',
    region: '04',
    regionName: 'SYNTHETIC REGION 4',
    group: 'DA',
    court: '0401',
    courtName: 'Synthetic District 4',
    officeCode: '1',
    officeName: 'Synthetic Office 4',
    state: 'TX',
  },
  // Second division in region 04 whose DXTR CS_DIV (492) differs from its ACMS division code (402), so a
  // DXTR caseId built from the wrong column cannot go unnoticed.
  '402': {
    code: '402',
    region: '04',
    regionName: 'SYNTHETIC REGION 4',
    group: 'DB',
    court: '0402',
    courtName: 'Synthetic District 4B',
    officeCode: '2',
    officeName: 'Synthetic Office 4B',
    state: 'TX',
    dxtrDivision: '492',
  },
};

export const REGION = '02';
export const OTHER_REGION = '03';
export const THIRD_REGION = '04';
export const DIVISION = '081';
export const UTICA_DIVISION = '066';
export const OTHER_DIVISION = '301';
export const THIRD_DIVISION = '401';
export const DXTR_MISMATCH_DIVISION = '402';
export const GROUP = 'NY';
export const COURT_ID = '0208';

export const divisionOfCase = (caseId: string): Division => {
  const d = DIVISIONS[caseId.split('-')[0]];
  if (!d) throw new Error(`Case ${caseId} is not in a known division`);
  return d;
};
export const regionOfCase = (caseId: string): string => divisionOfCase(caseId).region;
export const regionOfDivision = (code: string): string => DIVISIONS[code].region;

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export type Person = {
  first: string;
  middle?: string;
  last: string;
  /** Generation suffix. DXTR: PY_GENERATION ('Jr.'). ACMS: carried inside the last name (', JR.'). CAMS: in the name. */
  generation?: string;
  /** Raw text appended to the ACMS last name, e.g. ' (NY)' (104 real records carry such a decoration). */
  acmsLastSuffix?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  /** Last four of a ZIP+4. ACMS always has one (real data); DXTR only when dxtrZipPlus4. */
  zipPlus4?: string;
  dxtrZipPlus4?: boolean;
  /** 10 digits, no punctuation. Empty string = no phone (ACMS stores 0). */
  phone: string;
  /** DXTR phone punctuation. Default dashed '518-555-0100'. */
  phoneStyle?: 'dashed' | 'parens' | 'space';
  email?: string;
  /** ACMS rows with no street address / no city-state-zip (4% / 3.5% of real records). */
  noAddress?: boolean;
  noCityStateZip?: boolean;
  /** DXTR rows keep their natural case unless set (5% of real DXTR variants are upper-case). */
  dxtrUpper?: boolean;
};

/** A distinctive, internally consistent person. `last` is the scenario's lookup key: keep it unique. */
export function person(last: string, overrides: Partial<Person> = {}): Person {
  return {
    first: 'Fixture',
    middle: 'Q',
    last,
    address1: `1 ${last} Way`,
    city: 'Albany',
    state: 'NY',
    zip: '12207',
    zipPlus4: '4567',
    phone: '5185550100',
    email: `${last.toLowerCase().replace(/[^a-z]/g, '')}@example.com`,
    ...overrides,
  };
}

export type CamsAppointment = {
  court: string;
  division: string;
  chapter: string;
  status?: 'active' | 'voluntarily-suspended' | 'resigned';
};

export type CamsTrustee = {
  id: string;
  person: Person;
  /** Shorthand: an ACTIVE appointment covering court 0208 / division 081 / chapter 7. */
  covers?: boolean;
  /** Explicit appointments (use instead of `covers` to model other courts, divisions, chapters, statuses). */
  appointments?: CamsAppointment[];
  /** 40% of real trustees carry a company name. */
  companyName?: string;
};

export type CaseSpec = {
  caseId: string;
  /** CAMS chapter ('7', '11', '13', ...). ACMS CURR_CASE_CHAPT is rendered as the padded 2-char form. */
  chapter?: string;
  /** Raw ACMS CURR_CASE_CHAPT, overriding the rendering of `chapter` (e.g. '7A', '7N', 'AC'). */
  acmsChapterRaw?: string;
  filed?: string;
  /** ISO date the court closed the case (CMMDB.CLOSED_BY_COURT_DATE). */
  closedByCourt?: string;
  /** ISO date the UST closed the case (CMMDB.CLOSED_BY_UST_DATE). */
  closedByUst?: string;
  /** ISO date of a reopening key event (CMMKE OCO). */
  reopenedOn?: string;
  /** CMMDB.DELETE_CODE = 'D'. */
  cmmdbDeleted?: boolean;
  /** How the case exists in CAMS (SYNCED_CASE). Default 'synced'. */
  cams?: 'synced' | 'absent' | { movedTo: string };
};

export type ProfessionalSpec = {
  group: string;
  code: number;
  person: Person;
  /** CMMPR.DELETE_CODE = 'D'. */
  cmmprDeleted?: boolean;
  /** No CMMPR row at all for this professional (an orphaned CMMAP row; the production join is INNER). */
  cmmprMissing?: boolean;
};

export type Row = {
  caseId: string;
  prof: ProfessionalSpec;
  /** ISO date; ACMS APPT_DATE / DXTR REC aptDate. Empty = ACMS 0. */
  apptDate: string;
  /** ISO date; ACMS DISP_DATE. Not representable in DXTR. */
  dispDate?: string;
  /** CMMAP.DELETE_CODE = 'D'. */
  deleted?: boolean;
  /** CMMAP.APPT_TYPE (default 'TR'). */
  apptType?: string;
  /** ISO CDB_UPDATE_DATE / TX_DATE (default: the pass's changeDate). */
  changeDate?: string;
  /** CMMAP.REGION_CODE (default: the case's region). */
  region?: string;
  /** DXTR only: the professional code packed into the transaction record (REC[17..21]), e.g. '00000'. */
  dxtrProfCode?: string;
};

export type ExpectedAppointment = {
  /** A CamsTrustee.id from `cams.trustees`, or 'PLACEHOLDER' for an identity-task surrogate. */
  trustee: string;
  assignedOn: string;
  /** undefined = must be open; 'ANY' = must be closed on some date; a date = closed on exactly that date. */
  unassignedOn?: string | 'ANY';
  /** Exact checks.matchedBy, or 'PIPELINE' = present and neither 'professional-id' nor 'variation'. */
  matchedBy?: string;
  matchedTrusteeAppointment?: boolean;
  chapter?: string;
  closedDate?: string;
  reopenedDate?: string;
};

export type ExpectedTask = {
  /** Lookup key: the unique last name (any case) of the source trustee the task is about. */
  last: string;
  count: number;
  source?: Lane;
  reason?: 'no match' | 'ambiguous';
  acmsProfessionalId?: string;
  /** The task's courtId, which carries the case's region (see DIVISIONS). */
  court?: string;
};

export type Expect = {
  /** Exact set of CaseAppointment documents per case, after this pass. Omitted case = not asserted. */
  appointments?: Record<string, ExpectedAppointment[]>;
  tasks?: ExpectedTask[];
  /** Number of events the SOURCE returned for this pass (grounds query-level filtering). */
  sourceEvents?: number;
  /** Rows the ACMS query returns, when it differs from sourceEvents (rows the source cannot
   *  convert are reported as failures, not events -- cams-fd8qd.24). Defaults to sourceEvents. */
  sourceRows?: number;
  dlq?: number;
  /** Exact set of parked (CASE_APPOINTMENT_UNATTACHED) documents per case. Omitted case = not asserted. */
  parked?: Record<string, ExpectedAppointment[]>;
  /** The run's scenarioDistribution.parkedCount. */
  parkedCount?: number;
  /** Total identity tasks in the whole collection, so a task under any name is caught. */
  tasksTotal?: number;
  /** Existing seeded appointments for these caseIds must be byte-for-byte untouched (same updatedOn). */
  untouched?: string[];
  /**
   * Ports the retired test/integration/case-trustee-appointments harness's read-path check
   * (cams-rsn9a): calls CaseTrusteeAppointmentUseCase.getCaseTrusteeAppointmentHistory(caseId)
   * directly against whatever this pass actually wrote, and asserts history length and that the
   * first (most-recently-closed) entry's trustee name resolved correctly. The sort/history-vs-
   * current logic itself is exhaustively unit-tested (case-trustee-appointment.use-case.test.ts);
   * this proves only that it works end-to-end against real ACMS-sync-written documents.
   */
  historyRead?: { caseId: string; expectedLength: number; expectedFirstTrusteeName: string };
};

export type Pass = {
  /** Rows present in the source during this pass. Replaces the previous pass's rows. */
  rows: Row[];
  /** ISO date the source is asked for (ACMS CDB_UPDATE_DATE). */
  changeDate: string;
  /** Region the source is asked for. Default: the scenario's region. */
  region?: string;
  expect: Expect;
};

export type CamsState = {
  trustees?: CamsTrustee[];
  /** acms like 'NY-00063'. Default disposition 'linked'. */
  links?: { acms: string; trustee: string; disposition?: 'linked' | 'no-match' | 'ambiguous' }[];
  /** A saved variation: the source event whose trustee matches this key resolves to `trustee`. */
  variations?: { last: string; trustee: string }[];
  /** A pending identity task for the fingerprint of the source event whose trustee matches this key. */
  pendingTasks?: { last: string }[];
  existing?: { caseId: string; trustee: string; assignedOn: string; unassignedOn?: string }[];
};

export type Scenario = {
  key: string;
  /** Scenario title: the .feature scenario name when basis is 'feature', else a descriptive name. */
  title: string;
  basis: Basis;
  note?: string;
  lanes: Lane[];
  /** Default region for the scenario's passes. Default '02'. */
  region?: string;
  cases: CaseSpec[];
  cams?: CamsState;
  passes: Pass[];
  /** Per-lane expectation overrides for lanes whose source cannot express the same facts. */
  dxtrExpect?: Partial<Expect>;
};

// ---------------------------------------------------------------------------
// Helpers to keep the catalog readable
// ---------------------------------------------------------------------------

const D1 = '2026-07-01';
const D2 = '2026-07-02';

const caseSeqByDivision = new Map<string, number>();
/** Fresh {division}-26-nnnnn case id; deterministic by declaration order. */
function nextCase(division: string = DIVISION): string {
  const n = (caseSeqByDivision.get(division) ?? 0) + 1;
  caseSeqByDivision.set(division, n);
  return `${division}-26-${String(n).padStart(5, '0')}`;
}

/** A professional in the group of the given division (default Manhattan / NY). */
function prof(code: number, p: Person, division: string = DIVISION): ProfessionalSpec {
  return { group: DIVISIONS[division].group, code, person: p };
}
const nyProf = (code: number, p: Person): ProfessionalSpec => prof(code, p);

function tr(id: string, p: Person, covers = true): CamsTrustee {
  return { id, person: p, covers };
}
function trWith(
  id: string,
  p: Person,
  appointments: CamsAppointment[],
  companyName?: string,
): CamsTrustee {
  return { id, person: p, appointments, companyName };
}
const covering = (
  chapter: string,
  division: string = DIVISION,
  status: CamsAppointment['status'] = 'active',
): CamsAppointment => ({ court: DIVISIONS[division].court, division, chapter, status });

// ---------------------------------------------------------------------------
// Scenario catalog
// ---------------------------------------------------------------------------

export const SCENARIOS: Scenario[] = [];

function add(s: Scenario): void {
  SCENARIOS.push(s);
}

// ===== Known-trustee identification (steps 1 and 2 of the identification order) =====

{
  const c = nextCase();
  const t1 = person('Alder');
  add({
    key: 'known-by-professional-id',
    title: 'Known trustee with no active appointment on the case',
    basis: 'feature',
    note: 'cams-fd8qd.1.7. matchedBy "professional-id" is a new value this slice introduces.',
    lanes: ['ACMS'],
    cases: [{ caseId: c }],
    cams: { trustees: [tr('T-1', t1)], links: [{ acms: 'NY-00063', trustee: 'T-1' }] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(63, t1), apptDate: D1 }],
        changeDate: D2,
        expect: {
          sourceEvents: 1,
          appointments: {
            [c]: [
              {
                trustee: 'T-1',
                assignedOn: D1,
                matchedBy: 'professional-id',
                matchedTrusteeAppointment: true,
              },
            ],
          },
          tasks: [{ last: 'Alder', count: 0 }],
        },
      },
    ],
  });
}

{
  const c = nextCase();
  // The CMMPR identity differs from the CAMS trustee on purpose: only the link can resolve it.
  const acmsPerson = person('Aldrin', { first: 'Alfred', address1: '9 Stale Rd' });
  const t1 = person('Alder');
  add({
    key: 'professional-id-beats-name-mismatch',
    title: 'A linked professional id resolves even when the ACMS name differs from the CAMS name',
    basis: 'provisional',
    note: 'Step 1 (verified link) precedes the pipeline; the link is the identity signal, not the name.',
    lanes: ['ACMS'],
    cases: [{ caseId: c }],
    cams: { trustees: [tr('T-1', t1)], links: [{ acms: 'NY-00063', trustee: 'T-1' }] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(63, acmsPerson), apptDate: D1 }],
        changeDate: D2,
        expect: {
          appointments: { [c]: [{ trustee: 'T-1', assignedOn: D1, matchedBy: 'professional-id' }] },
          tasks: [{ last: 'Aldrin', count: 0 }],
        },
      },
    ],
  });
}

{
  const cNy = nextCase();
  const cUt = nextCase(UTICA_DIVISION);
  const cPa = nextCase(OTHER_DIVISION);
  const linked = person('Alder');
  const add1 = person('Pelham', { first: 'Peter' });
  const add2 = person('Pierce', { first: 'Paula' });
  add({
    key: 'one-trustee-two-professional-ids',
    title: 'One CAMS trustee linked from several ACMS professional ids resolves from each',
    basis: 'bead',
    note:
      'cams-gateways: one real person has several ACMS ids (e.g. NY-00063 and UT-05321). In the 2026-10-05 ' +
      'export 1,227 CAMS trustees have more than one id (max 11).',
    lanes: ['ACMS'],
    cases: [{ caseId: cNy }, { caseId: cUt }, { caseId: cPa }],
    cams: {
      trustees: [
        trWith('T-1', linked, [
          covering('7'),
          covering('7', UTICA_DIVISION),
          covering('7', OTHER_DIVISION),
        ]),
      ],
      links: [
        { acms: 'NY-00063', trustee: 'T-1' },
        { acms: 'UT-05321', trustee: 'T-1' },
        { acms: 'PA-00112', trustee: 'T-1' },
      ],
    },
    passes: [
      {
        rows: [
          { caseId: cNy, prof: prof(63, add1), apptDate: D1 },
          { caseId: cUt, prof: prof(5321, add2, UTICA_DIVISION), apptDate: D1 },
        ],
        changeDate: D2,
        expect: {
          sourceEvents: 2,
          appointments: {
            [cNy]: [{ trustee: 'T-1', assignedOn: D1, matchedBy: 'professional-id' }],
            [cUt]: [{ trustee: 'T-1', assignedOn: D1, matchedBy: 'professional-id' }],
          },
        },
      },
      {
        rows: [{ caseId: cPa, prof: prof(112, add1, OTHER_DIVISION), apptDate: D1 }],
        changeDate: D2,
        region: OTHER_REGION,
        expect: {
          sourceEvents: 1,
          appointments: {
            [cPa]: [{ trustee: 'T-1', assignedOn: D1, matchedBy: 'professional-id' }],
          },
        },
      },
    ],
  });
}

{
  const c = nextCase();
  const p = person('Birch');
  add({
    key: 'known-by-variation',
    title: 'Known trustee found by variation',
    basis: 'feature',
    note:
      'Variation is seeded from the fingerprint of the event the source actually returns, so the harness ' +
      'does not assume how a source formats its variant.',
    lanes: ['ACMS', 'DXTR'],
    cases: [{ caseId: c }],
    cams: {
      trustees: [tr('T-2', person('Birchwood'))],
      variations: [{ last: 'Birch', trustee: 'T-2' }],
    },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(70, p), apptDate: D1 }],
        changeDate: D2,
        expect: {
          sourceEvents: 1,
          appointments: { [c]: [{ trustee: 'T-2', assignedOn: D1, matchedBy: 'variation' }] },
          tasks: [{ last: 'Birch', count: 0 }],
        },
      },
    ],
  });
}

{
  const c = nextCase();
  // Two CAMS trustees are linked to the same ACMS professional (an ambiguous link). The ACMS name
  // matches neither, so the pipeline cannot rescue it either: no trustee appointment may be written.
  const acmsPerson = person('Cypress');
  add({
    key: 'ambiguous-link-not-used',
    title: 'An ambiguous professional-id link is not used',
    basis: 'feature',
    note:
      'cams-fd8qd.1.7 and the .feature: an ambiguous link falls through to variation and the pipeline and ' +
      'never picks one. DISCREPANCY: the CAMS-955 bead (cams-nd7ns) says 2+ links is an integrity error that ' +
      'goes straight to a "multiple linked trustees" identity task. Resolve which is intended; this scenario ' +
      'follows the .feature and .1.7.',
    lanes: ['ACMS'],
    cases: [{ caseId: c }],
    cams: {
      trustees: [tr('T-3a', person('Cedar')), tr('T-3b', person('Cedarwood'))],
      links: [
        { acms: 'NY-00064', trustee: 'T-3a' },
        { acms: 'NY-00064', trustee: 'T-3b' },
      ],
    },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(64, acmsPerson), apptDate: D1 }],
        changeDate: D2,
        expect: {
          appointments: { [c]: [{ trustee: 'PLACEHOLDER', assignedOn: D1 }] },
          tasks: [{ last: 'Cypress', count: 1, source: 'ACMS', reason: 'no match' }],
        },
      },
    ],
  });
}

{
  const cNy = nextCase();
  const cUt = nextCase(UTICA_DIVISION);
  const shared = person('Dogwood');
  const stranger = person('Dunmore');
  add({
    key: 'compound-professional-key',
    title: 'The same PROF_CODE in a different group is a different professional',
    basis: 'bead',
    note:
      'cams-gateways PROCEDURE 1 step 2B: ACMS ids are (GROUP_DESIGNATOR, PROF_CODE), never PROF_CODE alone. ' +
      'NY-00063 is linked to T-1; UT-00063 (Utica, same region) is an unrelated professional and must not ' +
      'resolve to T-1.',
    lanes: ['ACMS'],
    cases: [{ caseId: cNy }, { caseId: cUt }],
    cams: { trustees: [tr('T-1', shared)], links: [{ acms: 'NY-00063', trustee: 'T-1' }] },
    passes: [
      {
        rows: [
          { caseId: cNy, prof: nyProf(63, shared), apptDate: D1 },
          { caseId: cUt, prof: prof(63, stranger, UTICA_DIVISION), apptDate: D1 },
        ],
        changeDate: D2,
        expect: {
          sourceEvents: 2,
          appointments: {
            [cNy]: [{ trustee: 'T-1', assignedOn: D1, matchedBy: 'professional-id' }],
            [cUt]: [{ trustee: 'PLACEHOLDER', assignedOn: D1 }],
          },
          tasks: [{ last: 'Dunmore', count: 1, source: 'ACMS' }],
        },
      },
    ],
  });
}

{
  const cNy = nextCase();
  const cPa = nextCase(OTHER_DIVISION);
  const shared = person('Eucalyptus');
  const stranger = person('Everett', { state: 'PA', city: 'Harrisburg', zip: '17101' });
  add({
    key: 'compound-professional-key-across-regions',
    title: 'The same PROF_CODE in another region is a different professional',
    basis: 'bead',
    note: 'Region-level variant of the compound-key rule: NY-00063 (region 02) is linked; PA-00063 (region 03) is not.',
    lanes: ['ACMS'],
    cases: [{ caseId: cNy }, { caseId: cPa }],
    cams: { trustees: [tr('T-1', shared)], links: [{ acms: 'NY-00063', trustee: 'T-1' }] },
    passes: [
      {
        rows: [{ caseId: cNy, prof: nyProf(63, shared), apptDate: D1 }],
        changeDate: D2,
        expect: {
          appointments: {
            [cNy]: [{ trustee: 'T-1', assignedOn: D1, matchedBy: 'professional-id' }],
          },
        },
      },
      {
        rows: [{ caseId: cPa, prof: prof(63, stranger, OTHER_DIVISION), apptDate: D1 }],
        changeDate: D2,
        region: OTHER_REGION,
        expect: {
          appointments: { [cPa]: [{ trustee: 'PLACEHOLDER', assignedOn: D1 }] },
          tasks: [
            { last: 'Everett', count: 1, source: 'ACMS', court: DIVISIONS[OTHER_DIVISION].court },
          ],
        },
      },
    ],
  });
}

// ===== Active-trustee rules =====

{
  const c = nextCase();
  const t1 = person('Elm');
  add({
    key: 'same-trustee-already-active',
    title: 'Same trustee already active writes nothing',
    basis: 'feature',
    lanes: ['ACMS'],
    cases: [{ caseId: c }],
    cams: {
      trustees: [tr('T-1', t1)],
      links: [{ acms: 'NY-00063', trustee: 'T-1' }],
      existing: [{ caseId: c, trustee: 'T-1', assignedOn: D1 }],
    },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(63, t1), apptDate: D1 }],
        changeDate: D2,
        expect: {
          sourceEvents: 1,
          appointments: { [c]: [{ trustee: 'T-1', assignedOn: D1 }] },
          untouched: [c],
        },
      },
    ],
  });
}

{
  const c = nextCase();
  const t1 = person('Fir');
  const t2 = person('Fennel');
  add({
    key: 'newer-different-trustee-closes-active',
    title: 'A newer appointment for a different trustee closes the active one',
    basis: 'feature',
    lanes: ['ACMS'],
    cases: [{ caseId: c }],
    cams: {
      trustees: [tr('T-1', t1), tr('T-2', t2)],
      links: [
        { acms: 'NY-00063', trustee: 'T-1' },
        { acms: 'NY-00071', trustee: 'T-2' },
      ],
      existing: [{ caseId: c, trustee: 'T-1', assignedOn: D1 }],
    },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(71, t2), apptDate: '2026-08-10' }],
        changeDate: '2026-08-11',
        expect: {
          appointments: {
            [c]: [
              { trustee: 'T-1', assignedOn: D1, unassignedOn: '2026-08-09' },
              { trustee: 'T-2', assignedOn: '2026-08-10' },
            ],
          },
          // cams-rsn9a: proves the case-appointment history read works end-to-end against a real
          // ACMS-sync-written, now-closed appointment (T-1) -- T-2 is still open, so it's `current`,
          // not `history`.
          historyRead: { caseId: c, expectedLength: 1, expectedFirstTrusteeName: 'Fixture Q Fir' },
        },
      },
    ],
  });
}

{
  const c = nextCase();
  const t1 = person('Ginkgo');
  const t2 = person('Gorse');
  add({
    key: 'same-day-replacement',
    title: 'A same-day replacement never closes before the active appointment starts',
    basis: 'feature',
    note: 'deriveUnassignedOn clamps to the existing assignedOn.',
    lanes: ['ACMS'],
    cases: [{ caseId: c }],
    cams: {
      trustees: [tr('T-1', t1), tr('T-2', t2)],
      links: [
        { acms: 'NY-00063', trustee: 'T-1' },
        { acms: 'NY-00071', trustee: 'T-2' },
      ],
      existing: [{ caseId: c, trustee: 'T-1', assignedOn: '2026-08-10' }],
    },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(71, t2), apptDate: '2026-08-10' }],
        changeDate: '2026-08-11',
        expect: {
          appointments: {
            [c]: [
              { trustee: 'T-1', assignedOn: '2026-08-10', unassignedOn: '2026-08-10' },
              { trustee: 'T-2', assignedOn: '2026-08-10' },
            ],
          },
        },
      },
    ],
  });
}

{
  const c = nextCase();
  const t2 = person('Hazel');
  const t3 = person('Holly');
  add({
    key: 'older-appointment-written-closed',
    title: 'An older appointment is written already closed',
    basis: 'feature',
    note: 'New behavior (cams-fd8qd.1.8): an out-of-order older row must not displace the active appointment.',
    lanes: ['ACMS'],
    cases: [{ caseId: c }],
    cams: {
      trustees: [tr('T-2', t2), tr('T-3', t3)],
      links: [
        { acms: 'NY-00071', trustee: 'T-2' },
        { acms: 'NY-00072', trustee: 'T-3' },
      ],
      existing: [{ caseId: c, trustee: 'T-2', assignedOn: '2026-08-10' }],
    },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(72, t3), apptDate: '2026-07-15' }],
        changeDate: '2026-08-11',
        expect: {
          appointments: {
            [c]: [
              { trustee: 'T-3', assignedOn: '2026-07-15', unassignedOn: 'ANY' },
              { trustee: 'T-2', assignedOn: '2026-08-10' },
            ],
          },
        },
      },
    ],
  });
}

{
  const c = nextCase();
  const t1 = person('Iris');
  add({
    key: 'disp-date-closes-matching',
    title: 'DISP_DATE closes the matching appointment',
    basis: 'feature',
    note: 'cams-fd8qd.1.8: the one genuinely new code path - close with no replacement.',
    lanes: ['ACMS'],
    cases: [{ caseId: c }],
    cams: { trustees: [tr('T-1', t1)], links: [{ acms: 'NY-00063', trustee: 'T-1' }] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(63, t1), apptDate: D1 }],
        changeDate: D2,
        expect: { appointments: { [c]: [{ trustee: 'T-1', assignedOn: D1 }] } },
      },
      {
        rows: [{ caseId: c, prof: nyProf(63, t1), apptDate: D1, dispDate: '2026-09-01' }],
        changeDate: '2026-09-02',
        expect: {
          appointments: { [c]: [{ trustee: 'T-1', assignedOn: D1, unassignedOn: '2026-09-01' }] },
        },
      },
    ],
  });
}

{
  const c = nextCase();
  const t1 = person('Juniper');
  add({
    key: 'reappointed-after-disposition',
    title: 'The same trustee reappointed after a disposition gets a second appointment',
    basis: 'provisional',
    note:
      'Two CMMAP rows (RECORD_SEQ_NBR 1 closed, 2 open) for one professional on one case. The 2026-09-14 ' +
      'export has one such case in 10,000.',
    lanes: ['ACMS'],
    cases: [{ caseId: c }],
    cams: { trustees: [tr('T-1', t1)], links: [{ acms: 'NY-00063', trustee: 'T-1' }] },
    passes: [
      {
        rows: [
          { caseId: c, prof: nyProf(63, t1), apptDate: D1, dispDate: '2026-08-01' },
          { caseId: c, prof: nyProf(63, t1), apptDate: '2026-09-01' },
        ],
        changeDate: '2026-09-02',
        expect: {
          sourceEvents: 2,
          appointments: {
            [c]: [
              { trustee: 'T-1', assignedOn: D1, unassignedOn: '2026-08-01' },
              { trustee: 'T-1', assignedOn: '2026-09-01' },
            ],
          },
        },
      },
    ],
  });
}

// ===== Jurisdiction check (checks.matchedTrusteeAppointment). CAMS-955 writes the appointment either
// way; CAMS-956 later turns `false` into a "Trustee Appointment" task, so these fixtures span the
// courts, divisions, chapters and statuses that task needs. =====

function jurisdictionScenario(args: {
  key: string;
  title: string;
  note: string;
  basis?: Basis;
  caseDivision?: string;
  chapter: string;
  appointments: CamsAppointment[];
  expectCovered: boolean;
  code: number;
  last: string;
}): void {
  const c = nextCase(args.caseDivision ?? DIVISION);
  const p = person(args.last, { state: DIVISIONS[args.caseDivision ?? DIVISION].state });
  const acms = `${DIVISIONS[args.caseDivision ?? DIVISION].group}-${String(args.code).padStart(5, '0')}`;
  add({
    key: args.key,
    title: args.title,
    basis: args.basis ?? 'bead',
    note: args.note,
    lanes: ['ACMS'],
    region: regionOfDivision(args.caseDivision ?? DIVISION),
    cases: [{ caseId: c, chapter: args.chapter }],
    cams: { trustees: [trWith('T-J', p, args.appointments)], links: [{ acms, trustee: 'T-J' }] },
    passes: [
      {
        rows: [
          { caseId: c, prof: prof(args.code, p, args.caseDivision ?? DIVISION), apptDate: D1 },
        ],
        changeDate: D2,
        expect: {
          appointments: {
            [c]: [
              {
                trustee: 'T-J',
                assignedOn: D1,
                matchedTrusteeAppointment: args.expectCovered,
                chapter: args.chapter,
              },
            ],
          },
          tasks: [{ last: args.last, count: 0 }],
        },
      },
    ],
  });
}

jurisdictionScenario({
  key: 'jurisdiction-no-appointment',
  title: 'Jurisdiction check fails but the appointment is still written',
  basis: 'feature',
  note: 'Decision 1a. Also covers "matchedTrusteeAppointment defaults to false": the field is present and false. No task (CAMS-956).',
  chapter: '7',
  appointments: [],
  expectCovered: false,
  code: 73,
  last: 'Kestrel',
});
jurisdictionScenario({
  key: 'jurisdiction-inactive-appointment',
  title: 'A matching but inactive trustee appointment does not cover the case',
  note: 'CAMS-956 task reason "appointment inactive": a matching appointment exists but is not active.',
  chapter: '7',
  appointments: [covering('7', DIVISION, 'voluntarily-suspended')],
  expectCovered: false,
  code: 74,
  last: 'Lark',
});
jurisdictionScenario({
  key: 'jurisdiction-resigned-appointment',
  title: 'A resigned trustee appointment does not cover the case',
  note: 'Real appointment statuses include voluntarily-suspended and resigned (2026-08-25 verification export).',
  chapter: '7',
  appointments: [covering('7', DIVISION, 'resigned')],
  expectCovered: false,
  code: 75,
  last: 'Linden',
});
jurisdictionScenario({
  key: 'jurisdiction-wrong-chapter',
  title: 'A chapter 7 appointment does not cover a chapter 13 case',
  note: 'CAMS-956: an appointment task covers one (trustee, court, division, chapter).',
  chapter: '13',
  appointments: [covering('7')],
  expectCovered: false,
  code: 76,
  last: 'Magnolia',
});
jurisdictionScenario({
  key: 'jurisdiction-covering-chapter-13',
  title: 'An active chapter 13 appointment covers a chapter 13 case',
  note: '33% of real unmatched appointments are chapter 13.',
  chapter: '13',
  appointments: [covering('13')],
  expectCovered: true,
  code: 77,
  last: 'Mulberry',
});
jurisdictionScenario({
  key: 'jurisdiction-covering-chapter-11',
  title: 'An active chapter 11 appointment covers a chapter 11 case',
  note: '1% of real unmatched appointments are chapter 11.',
  chapter: '11',
  appointments: [covering('11')],
  expectCovered: true,
  code: 78,
  last: 'Nettle',
});
jurisdictionScenario({
  key: 'jurisdiction-covering-chapter-12',
  title: 'An active chapter 12 appointment covers a chapter 12 case',
  note: 'Chapter 12 is rare (4 in 10,000) but present.',
  chapter: '12',
  appointments: [covering('12')],
  expectCovered: true,
  code: 79,
  last: 'Olive',
});
jurisdictionScenario({
  key: 'jurisdiction-other-division',
  title: 'An appointment in Manhattan does not cover a Utica case in the same region',
  note: 'Region 02 has two divisions; coverage is per court and division, not per region.',
  caseDivision: UTICA_DIVISION,
  chapter: '7',
  appointments: [covering('7', DIVISION)],
  expectCovered: false,
  code: 80,
  last: 'Persimmon',
});
jurisdictionScenario({
  key: 'jurisdiction-other-court',
  title: 'An appointment in another court and region does not cover the case',
  note: 'The trustee is appointed only in region 03; the case is in region 02.',
  chapter: '7',
  appointments: [covering('7', OTHER_DIVISION)],
  expectCovered: false,
  code: 81,
  last: 'Quillwort',
});
jurisdictionScenario({
  key: 'jurisdiction-one-of-several-covers',
  title: 'One active covering appointment among several is enough',
  note: 'A trustee with a suspended chapter 7 appointment and an active one in the same court and division.',
  chapter: '7',
  appointments: [covering('7', DIVISION, 'voluntarily-suspended'), covering('13'), covering('7')],
  expectCovered: true,
  code: 82,
  last: 'Rosemary',
  basis: 'provisional',
});

// ===== Unknown trustees: pipeline, placeholder, identity tasks =====

{
  const c = nextCase();
  const p = person('Larch');
  add({
    key: 'pipeline-links-unknown',
    title: 'The trustee-match pipeline links an unknown trustee',
    basis: 'feature',
    note: 'No link, no variation. The CAMS trustee is the same person, so the pipeline resolves it.',
    lanes: ['ACMS', 'DXTR'],
    cases: [{ caseId: c }],
    cams: { trustees: [tr('T-4', p)] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(81, p), apptDate: D1 }],
        changeDate: D2,
        expect: {
          appointments: { [c]: [{ trustee: 'T-4', assignedOn: D1, matchedBy: 'PIPELINE' }] },
          tasks: [{ last: 'Larch', count: 0 }],
        },
      },
    ],
  });
}

{
  const c = nextCase();
  const camsPerson = person('Maple');
  // Same name and address; the ACMS phone and email are stale. Stale ACMS contact data is the norm.
  const acmsPerson = person('Maple', { phone: '5185559999', email: 'old.maple@example.org' });
  add({
    key: 'acms-stale-phone-still-links',
    title: 'A stale ACMS phone or email does not veto a pipeline link',
    basis: 'bead',
    note:
      'bd memory acms-phone-no-match-not-disqualifier (CAMS-876): 431 of 539 state-only links had a ' +
      'phone/email no-match and were the same person. In the 2026-10-05 export 705 of 5,751 links have a phone ' +
      'mismatch.',
    lanes: ['ACMS'],
    cases: [{ caseId: c }],
    cams: { trustees: [tr('T-4', camsPerson)] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(81, acmsPerson), apptDate: D1 }],
        changeDate: D2,
        expect: {
          appointments: { [c]: [{ trustee: 'T-4', assignedOn: D1, matchedBy: 'PIPELINE' }] },
          tasks: [{ last: 'Maple', count: 0 }],
        },
      },
    ],
  });
}

{
  const c = nextCase();
  const p = person('Nutmeg');
  add({
    key: 'unknown-open-placeholder-and-task',
    title: 'Unknown trustee with an open appointment gets a placeholder and an identity task',
    basis: 'feature',
    note: 'The task is source ACMS with the case attached; the ACMS professional id is carried on it.',
    lanes: ['ACMS', 'DXTR'],
    cases: [{ caseId: c }],
    cams: { trustees: [] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(82, p), apptDate: D1 }],
        changeDate: D2,
        expect: {
          appointments: { [c]: [{ trustee: 'PLACEHOLDER', assignedOn: D1 }] },
          tasks: [
            {
              last: 'Nutmeg',
              count: 1,
              source: 'ACMS',
              reason: 'no match',
              acmsProfessionalId: 'NY-00082',
              court: COURT_ID,
            },
          ],
        },
      },
    ],
    dxtrExpect: {
      tasks: [{ last: 'Nutmeg', count: 1, source: 'DXTR', reason: 'no match', court: COURT_ID }],
    },
  });
}

{
  const c = nextCase();
  const p = person('Oak');
  add({
    key: 'unknown-closed-removes-placeholder',
    title: 'Unknown trustee with a closed appointment closes the open placeholder',
    basis: 'feature',
    note: 'cams-fd8qd.1.9: the disposition closes the placeholder as given; it is not deleted, and the identity task itself stays.',
    lanes: ['ACMS'],
    cases: [{ caseId: c }],
    cams: { trustees: [] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(82, p), apptDate: D1 }],
        changeDate: D2,
        expect: {
          appointments: { [c]: [{ trustee: 'PLACEHOLDER', assignedOn: D1 }] },
          tasks: [{ last: 'Oak', count: 1, source: 'ACMS' }],
        },
      },
      {
        rows: [{ caseId: c, prof: nyProf(82, p), apptDate: D1, dispDate: '2026-09-01' }],
        changeDate: '2026-09-02',
        expect: {
          sourceEvents: 1,
          appointments: {
            [c]: [{ trustee: 'PLACEHOLDER', assignedOn: D1, unassignedOn: '2026-09-01' }],
          },
          tasks: [{ last: 'Oak', count: 1, source: 'ACMS' }],
          tasksTotal: 1,
        },
      },
    ],
  });
}

{
  const c = nextCase();
  const p = person('Pine');
  add({
    key: 'pending-task-reused',
    title: 'A pending identity task for the same contact details is reused',
    basis: 'feature',
    lanes: ['ACMS', 'DXTR'],
    cases: [{ caseId: c }],
    cams: { trustees: [], pendingTasks: [{ last: 'Pine' }] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(83, p), apptDate: D1 }],
        changeDate: D2,
        expect: {
          appointments: { [c]: [{ trustee: 'PLACEHOLDER', assignedOn: D1 }] },
          // The seeded task is the only one: no second task is created.
          tasks: [{ last: 'Pine', count: 1 }],
        },
      },
    ],
  });
}

{
  const c = nextCase();
  const p = person('Quince');
  add({
    key: 'replay-placeholders-and-tasks',
    title: 'Replaying a date does not duplicate placeholders or tasks',
    basis: 'feature',
    lanes: ['ACMS', 'DXTR'],
    cases: [{ caseId: c }],
    cams: { trustees: [] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(84, p), apptDate: D1 }],
        changeDate: D2,
        expect: {
          appointments: { [c]: [{ trustee: 'PLACEHOLDER', assignedOn: D1 }] },
          tasks: [{ last: 'Quince', count: 1 }],
        },
      },
      {
        rows: [{ caseId: c, prof: nyProf(84, p), apptDate: D1 }],
        changeDate: D2,
        expect: {
          appointments: { [c]: [{ trustee: 'PLACEHOLDER', assignedOn: D1 }] },
          tasks: [{ last: 'Quince', count: 1 }],
        },
      },
    ],
  });
}

{
  const c = nextCase();
  const p = person('Rowan');
  add({
    key: 'ambiguous-pipeline-task',
    title: 'Two indistinguishable CAMS trustees produce an ambiguous identity task',
    basis: 'code',
    note:
      'Pipeline outcome "ambiguous": 2+ candidates pass the name check and nothing separates them. Same ' +
      'shape as trustee-match-scenarios scenario 8. Real data: 57 last+first collisions among 5,320 CAMS trustees.',
    lanes: ['ACMS', 'DXTR'],
    cases: [{ caseId: c }],
    cams: {
      trustees: [
        tr(
          'T-6a',
          person('Rowan', {
            address1: '1 Tie Ave',
            city: 'Faraway',
            state: 'FA',
            zip: '99999',
            phone: '5185550001',
            email: 'a@example.org',
          }),
        ),
        tr(
          'T-6b',
          person('Rowan', {
            address1: '2 Tie Ave',
            city: 'Faraway',
            state: 'FA',
            zip: '99999',
            phone: '5185550002',
            email: 'b@example.org',
          }),
        ),
      ],
    },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(85, p), apptDate: D1 }],
        changeDate: D2,
        expect: {
          appointments: { [c]: [{ trustee: 'PLACEHOLDER', assignedOn: D1 }] },
          tasks: [{ last: 'Rowan', count: 1, reason: 'ambiguous' }],
        },
      },
    ],
  });
}

{
  const c = nextCase();
  const same = {
    address1: '5 Twin Row',
    city: 'Albany',
    state: 'NY',
    zip: '12207',
    phone: '5185550777',
    email: 'dup@example.org',
  };
  add({
    key: 'duplicate-cams-trustee-records',
    title:
      'Two CAMS records for the same person (identical contact details) are ambiguous, not a tie-break',
    basis: 'provisional',
    note:
      'Suspected-duplicate CAMS trustees (8 of 20 real ambiguous professional-id records are flagged ' +
      'suspectDuplicateCamsTrustee). Both candidates match on everything, so no auto-link: an ambiguous task.',
    lanes: ['ACMS', 'DXTR'],
    cases: [{ caseId: c }],
    cams: { trustees: [tr('T-7a', person('Sorrel', same)), tr('T-7b', person('Sorrel', same))] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(86, person('Sorrel', same)), apptDate: D1 }],
        changeDate: D2,
        expect: {
          appointments: { [c]: [{ trustee: 'PLACEHOLDER', assignedOn: D1 }] },
          tasks: [{ last: 'Sorrel', count: 1, reason: 'ambiguous' }],
        },
      },
    ],
  });
}

// ===== Realistic ACMS name and contact shapes (staging profile, 6,770 records) =====

type NameVariant = {
  key: string;
  note: string;
  acms: Partial<Person>;
  cams: Partial<Person>;
};

const NAME_VARIANTS: NameVariant[] = [
  {
    key: 'hyphenated-last',
    note: '48 of 6,770 real last names are hyphenated.',
    acms: { last: 'Thorn-Whitlock' },
    cams: { last: 'Thorn-Whitlock' },
  },
  {
    key: 'apostrophe-last',
    note: "52 real last names contain an apostrophe (e.g. O'BRIEN).",
    acms: { last: "O'Tamarisk" },
    cams: { last: "O'Tamarisk" },
  },
  {
    key: 'multiword-last',
    note: '753 real last names contain a space (van der..., de la...).',
    acms: { last: 'Van Der Ulmus' },
    cams: { last: 'Van Der Ulmus' },
  },
  {
    key: 'generation-suffix',
    note: '304 real last names carry ", JR."/" JR." style suffixes inside CMMPR.',
    acms: { last: 'Vervain', generation: 'Jr.' },
    cams: { last: 'Vervain', generation: 'Jr.' },
  },
  {
    key: 'parenthetical-decoration',
    note: '104 real last names carry a trailing "(XX)" decoration.',
    acms: { last: 'Walnut', acmsLastSuffix: ' (NY)' },
    cams: { last: 'Walnut' },
  },
  {
    key: 'multiword-first',
    note: '511 real first names are multi-word (e.g. MARY ANN).',
    acms: { last: 'Xylosma', first: 'Mary Ann' },
    cams: { last: 'Xylosma', first: 'Mary Ann' },
  },
  {
    key: 'initial-first',
    note: '33 real first names are a bare initial.',
    acms: { last: 'Yewtree', first: 'J.' },
    cams: { last: 'Yewtree', first: 'J.' },
  },
  {
    key: 'no-middle-name',
    note: '40% of real records have no middle initial.',
    acms: { last: 'Zelkova', middle: undefined },
    cams: { last: 'Zelkova', middle: undefined },
  },
  {
    key: 'address-line-2',
    note: '45% of real records have an address line 2.',
    acms: { last: 'Acacia', address2: 'Suite 400' },
    cams: { last: 'Acacia' },
  },
];

for (const v of NAME_VARIANTS) {
  const c = nextCase();
  const acmsPerson = person(v.acms.last as string, v.acms);
  const camsPerson = person(v.cams.last as string, v.cams);
  add({
    key: `acms-name-shape-${v.key}`,
    title: `ACMS ${v.key.replace(/-/g, ' ')} matches the CAMS trustee through the pipeline`,
    basis: 'provisional',
    note: `${v.note} ACMS is upper-cased by the renderer; CAMS keeps natural case.`,
    lanes: ['ACMS'],
    cases: [{ caseId: c }],
    cams: { trustees: [tr('T-N', camsPerson)] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(90, acmsPerson), apptDate: D1 }],
        changeDate: D2,
        expect: {
          appointments: { [c]: [{ trustee: 'T-N', assignedOn: D1, matchedBy: 'PIPELINE' }] },
          tasks: [{ last: acmsPerson.last, count: 0 }],
        },
      },
    ],
  });
}

{
  const c = nextCase();
  const sparse = person('Ailanthus', {
    noAddress: true,
    noCityStateZip: true,
    phone: '',
    email: undefined,
  });
  add({
    key: 'acms-sparse-contact-unique-name-links',
    title: 'An ACMS record with no address, city/state/zip or phone still links on a unique name',
    basis: 'provisional',
    note: '4% of real records have no address, 3.5% no city/state/zip, 14% phone 0; 126 real links resolved by name only.',
    lanes: ['ACMS'],
    cases: [{ caseId: c }],
    cams: { trustees: [tr('T-N', person('Ailanthus'))] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(91, sparse), apptDate: D1 }],
        changeDate: D2,
        expect: {
          appointments: { [c]: [{ trustee: 'T-N', assignedOn: D1, matchedBy: 'PIPELINE' }] },
          tasks: [{ last: 'Ailanthus', count: 0 }],
        },
      },
    ],
  });
}

{
  const c = nextCase();
  const sparse = person('Baobab', {
    noAddress: true,
    noCityStateZip: true,
    phone: '',
    email: undefined,
  });
  add({
    key: 'acms-sparse-contact-unknown-task',
    title: 'An ACMS record with no contact details and no CAMS trustee becomes an identity task',
    basis: 'provisional',
    note: '637 of 881 real no-match professional ids had no candidate at all.',
    lanes: ['ACMS'],
    cases: [{ caseId: c }],
    cams: { trustees: [] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(92, sparse), apptDate: D1 }],
        changeDate: D2,
        expect: {
          appointments: { [c]: [{ trustee: 'PLACEHOLDER', assignedOn: D1 }] },
          tasks: [{ last: 'Baobab', count: 1, source: 'ACMS', reason: 'no match' }],
        },
      },
    ],
  });
}

// ===== Administrative / placeholder names (118 skipped professionals in the staging export) =====

const PLACEHOLDER_NAMES: {
  key: string;
  first: string;
  last: string;
  basis: Basis;
  note: string;
}[] = [
  {
    key: 'us-trustee-numbered',
    first: 'US',
    last: 'Trustee 11',
    basis: 'code',
    note:
      'Skipped today by the matching pipeline (UST_STAFF_PATTERN / NON_PERSON_ONLY_WORDS in ' +
      'source-name-normalization.helpers.ts), not by isUnattributableBogusName.',
  },
  {
    key: 'do-not-use',
    first: 'Do Not',
    last: 'Use Duplicate',
    basis: 'provisional',
    note: '44 of 118 real skipped names contain "DO NOT". Which gate skips this shape on the DXTR path has not been traced.',
  },
  {
    key: 'no-trustee-assigned',
    first: 'No',
    last: 'Trustee Assigned',
    basis: 'code',
    note:
      '20 of 118 real skipped names contain "NO TRUSTEE". Skipped today by the pipeline (NON_PERSON_ONLY_WORDS), ' +
      'not by isUnattributableBogusName.',
  },
  {
    key: 'united-states-trustee-bare',
    first: 'United States',
    last: 'Trustee',
    basis: 'code',
    note:
      'Real exports have "...UNITED STATES TRUSTEE" names among their 118 skipped professionals. Reviewer-verified: ' +
      'without a state suffix the pipeline skips this, so it is expected to pass today.',
  },
  {
    key: 'united-states-trustee',
    first: 'United States',
    last: 'Trustee (NY)',
    basis: 'decision',
    note:
      'MAINTAINER DECISION (PR 3263 review): this is a US Trustee, so the matching pipeline must filter it. ' +
      'UST_STAFF_PATTERN (source-name-normalization.helpers.ts) matches the spelled-out "United States Trustee" ' +
      'as well as "U.S. Trustee" and "(UST)", so the pipeline skips it as U.S. Trustee staff (cams-fd8qd.37).',
  },
];

for (const n of PLACEHOLDER_NAMES) {
  const c = nextCase();
  const bogus: Person = { ...person(n.last), first: n.first, middle: undefined, email: undefined };
  add({
    key: `administrative-placeholder-${n.key}`,
    title: `An administrative placeholder name ("${n.first} ${n.last}") is not treated as a trustee`,
    basis: n.basis,
    note: `${n.note} Whether the ACMS source applies the same gate is what the ACMS lane of this scenario will tell us.`,
    lanes: ['ACMS', 'DXTR'],
    cases: [{ caseId: c }],
    cams: { trustees: [] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(87, bogus), apptDate: D1 }],
        changeDate: D2,
        expect: {
          sourceEvents: 1,
          appointments: { [c]: [] },
          tasks: [{ last: n.last, count: 0 }],
          tasksTotal: 0,
        },
      },
    ],
  });
}

// ===== Skips, DLQ, parking behaviors =====

{
  const c = nextCase();
  const t1 = person('Sumac');
  add({
    key: 'moved-case-skipped',
    title: 'An appointment on a moved case is skipped',
    basis: 'feature',
    lanes: ['ACMS', 'DXTR'],
    cases: [{ caseId: c, cams: { movedTo: `${DIVISION}-26-90010` } }],
    cams: { trustees: [tr('T-1', t1)], links: [{ acms: 'NY-00063', trustee: 'T-1' }] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(63, t1), apptDate: D1 }],
        changeDate: D2,
        expect: {
          sourceEvents: 1,
          appointments: { [c]: [] },
          tasks: [{ last: 'Sumac', count: 0 }],
          tasksTotal: 0,
        },
      },
    ],
  });
}

{
  const c = nextCase();
  const t1 = person('Tamarack');
  add({
    key: 'case-not-yet-synced-parked',
    title: 'An appointment for a case not yet in CAMS is parked',
    basis: 'feature',
    note:
      'ACMS only: parking needs dateFiled, which only the ACMS source sets (the DXTR source is unused ' +
      'until #3191). The heal (Task 6) attaches it once the case loads.',
    lanes: ['ACMS'],
    cases: [{ caseId: c, cams: 'absent' }],
    cams: { trustees: [tr('T-1', t1)], links: [{ acms: 'NY-00063', trustee: 'T-1' }] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(63, t1), apptDate: D1 }],
        changeDate: D2,
        expect: {
          sourceEvents: 1,
          appointments: { [c]: [] },
          parked: { [c]: [{ trustee: 'T-1', assignedOn: D1, matchedBy: 'professional-id' }] },
          parkedCount: 1,
        },
      },
    ],
  });
}

{
  const c = nextCase();
  const p = person('Tupelo');
  add({
    key: 'unknown-trustee-case-not-yet-synced-parked-placeholder',
    title: 'An unknown trustee on a case not yet in CAMS is parked as a placeholder',
    basis: 'feature',
    note: 'The identity task lists the case even though the case is not in CAMS yet.',
    lanes: ['ACMS'],
    cases: [{ caseId: c, cams: 'absent' }],
    cams: { trustees: [] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(93, p), apptDate: D1 }],
        changeDate: D2,
        expect: {
          sourceEvents: 1,
          appointments: { [c]: [] },
          parked: { [c]: [{ trustee: 'PLACEHOLDER', assignedOn: D1 }] },
          parkedCount: 1,
          tasks: [{ last: 'Tupelo', count: 1, source: 'ACMS', reason: 'no match' }],
        },
      },
    ],
  });
}

{
  const cBad = nextCase();
  const cGood = nextCase();
  const t1 = person('Umber');
  const t2 = person('Urn');
  add({
    key: 'invalid-chapter-goes-to-dlq-alone',
    title: 'A record that fails on every attempt goes to the dead-letter queue alone',
    basis: 'feature',
    note:
      'CURR_CASE_CHAPT "AC" is not a chapter CAMS recognizes (acms-case-appointment.helpers.ts). Since ' +
      'cams-fd8qd.24 the source reports the row as a conversion failure instead of an event, and the driver ' +
      'sends it to the DLQ alone. The other record on the page is still processed.',
    lanes: ['ACMS'],
    cases: [{ caseId: cBad, acmsChapterRaw: 'AC' }, { caseId: cGood }],
    cams: {
      trustees: [tr('T-1', t1), tr('T-2', t2)],
      links: [
        { acms: 'NY-00063', trustee: 'T-1' },
        { acms: 'NY-00071', trustee: 'T-2' },
      ],
    },
    passes: [
      {
        rows: [
          { caseId: cBad, prof: nyProf(63, t1), apptDate: D1 },
          { caseId: cGood, prof: nyProf(71, t2), apptDate: D1 },
        ],
        changeDate: D2,
        expect: {
          sourceRows: 2,
          sourceEvents: 1,
          dlq: 1,
          appointments: { [cBad]: [], [cGood]: [{ trustee: 'T-2', assignedOn: D1 }] },
        },
      },
    ],
  });
}

{
  const c = nextCase();
  const t1 = person('Vetch');
  add({
    key: 'zero-appointment-date',
    title: 'A CMMAP row with no appointment date is not silently written',
    basis: 'provisional',
    note:
      'APPT_DATE 0 maps to a null apptDate (rawToAppointmentRecord) and assertAppointedDate rejects a ' +
      'missing appointedDate. Expectation: DLQ, nothing written. Confirm against the as-built source.',
    lanes: ['ACMS'],
    cases: [{ caseId: c }],
    cams: { trustees: [tr('T-1', t1)], links: [{ acms: 'NY-00063', trustee: 'T-1' }] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(63, t1), apptDate: '' }],
        changeDate: D2,
        expect: { sourceEvents: 1, dlq: 1, appointments: { [c]: [] } },
      },
    ],
  });
}

for (const chapter of ['9', '15']) {
  const c = nextCase();
  const p = person(chapter === '9' ? 'Willow' : 'Wisteria');
  add({
    key: `unappointable-chapter-${chapter}-skipped`,
    title: `Chapter ${chapter} cases never receive a trustee appointment`,
    basis: 'code',
    note: 'isUnappointableChapter: routing them to verification would create a permanently unapprovable task.',
    lanes: ['ACMS', 'DXTR'],
    cases: [{ caseId: c, chapter }],
    cams: { trustees: [] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(86, p), apptDate: D1 }],
        changeDate: D2,
        expect: {
          sourceEvents: 1,
          appointments: { [c]: [] },
          tasks: [{ last: p.last, count: 0 }],
          tasksTotal: 0,
        },
      },
    ],
  });
}

// ===== Case facts carried onto the appointment (CMMDB / CMMKE) =====

for (const raw of ['7A', '7N']) {
  const c = nextCase();
  const t1 = person(raw === '7A' ? 'Yarrow' : 'Yucca');
  add({
    key: `chapter-${raw.toLowerCase()}-normalized`,
    title: `ACMS chapter ${raw} is written as chapter 7`,
    basis: 'code',
    note: 'normalizeAcmsCaseChapter (acms.gateway.helper). 7A and 7N both map to 7.',
    lanes: ['ACMS'],
    cases: [{ caseId: c, acmsChapterRaw: raw }],
    cams: { trustees: [tr('T-1', t1)], links: [{ acms: 'NY-00063', trustee: 'T-1' }] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(63, t1), apptDate: D1 }],
        changeDate: D2,
        expect: { appointments: { [c]: [{ trustee: 'T-1', assignedOn: D1, chapter: '7' }] } },
      },
    ],
  });
}

{
  const c = nextCase();
  const t1 = person('Zinnia');
  add({
    key: 'closed-and-reopened-case-dates',
    title: 'Case closed and reopen dates are carried onto the appointment',
    basis: 'decision',
    note:
      'cams-fd8qd.37 (Matt Stankey, 2026-11-11): the ACMS row is the source. rawToTrusteeAppointmentSyncEvent ' +
      'takes closedDate from CLOSED_BY_COURT_DATE (else CLOSED_BY_UST_DATE) and reopenedDate from the CMMKE OCO ' +
      'key event; the repository derives caseStatus from them. 78% of real appointments are on closed cases.',
    lanes: ['ACMS'],
    cases: [{ caseId: c, closedByCourt: '2026-05-01', reopenedOn: '2026-06-10' }],
    cams: { trustees: [tr('T-1', t1)], links: [{ acms: 'NY-00063', trustee: 'T-1' }] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(63, t1), apptDate: D1 }],
        changeDate: D2,
        expect: {
          appointments: {
            [c]: [
              {
                trustee: 'T-1',
                assignedOn: D1,
                closedDate: '2026-05-01',
                reopenedDate: '2026-06-10',
              },
            ],
          },
        },
      },
    ],
  });
}

{
  const c = nextCase();
  const t1 = person('Anemone');
  add({
    key: 'closed-by-ust-only',
    title: 'A case closed only by the UST carries that closed date',
    basis: 'decision',
    note: 'cams-fd8qd.37: rawToTrusteeAppointmentSyncEvent falls back to CLOSED_BY_UST_DATE when the court date is 0.',
    lanes: ['ACMS'],
    cases: [{ caseId: c, closedByUst: '2026-06-15' }],
    cams: { trustees: [tr('T-1', t1)], links: [{ acms: 'NY-00063', trustee: 'T-1' }] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(63, t1), apptDate: D1 }],
        changeDate: D2,
        expect: {
          appointments: { [c]: [{ trustee: 'T-1', assignedOn: D1, closedDate: '2026-06-15' }] },
        },
      },
    ],
  });
}

{
  const c = nextCase();
  const t1 = person('Begonia');
  add({
    key: 'closed-before-appointed',
    title: 'An appointment dated after the case closed is still written',
    basis: 'provisional',
    note:
      'Data quality edge: 30 of 10,000 real appointments have a closedDate earlier than the appointed date. ' +
      'Expectation: written as-is with the closed date carried; confirm whether it should be flagged instead.',
    lanes: ['ACMS'],
    cases: [{ caseId: c, closedByCourt: '2026-05-01' }],
    cams: { trustees: [tr('T-1', t1)], links: [{ acms: 'NY-00063', trustee: 'T-1' }] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(63, t1), apptDate: D1 }],
        changeDate: D2,
        expect: {
          appointments: { [c]: [{ trustee: 'T-1', assignedOn: D1, closedDate: '2026-05-01' }] },
        },
      },
    ],
  });
}

// ===== Source-level filtering (what the ACMS read returns at all) =====

{
  const cDel = nextCase();
  const cSent = nextCase();
  const cZero = nextCase();
  const cBoundary = nextCase();
  const cType = nextCase();
  const cProfDel = nextCase();
  const cCaseDel = nextCase();
  const cOld = nextCase();
  const cEdge = nextCase();
  const cOrphan = nextCase();
  const cOk = nextCase();
  const t1 = person('Aspen');
  const mk = (code: number, extra: Partial<ProfessionalSpec> = {}): ProfessionalSpec => ({
    group: GROUP,
    code,
    person: person(`Filter${code}`),
    ...extra,
  });
  add({
    key: 'source-filters',
    title: 'Deleted, sentinel, non-trustee, orphaned and long-closed rows are never read',
    basis: 'feature',
    note:
      'Grounds getCmmapAppointmentsRaw: DELETE_CODE "D" on CMMAP/CMMDB/CMMPR, PROF_CODE 0 and >= 98000 ' +
      '(97999 is the last real code and IS read), APPT_TYPE != TR, and cases closed on or before 2018-01-01. ' +
      '31 of 10,000 real migrated appointments carry sentinel codes 00000/99999. The sentinel rows deliberately ' +
      'keep a CMMPR row so the PROF_CODE filter is exercised independently of the INNER JOIN; the 96000 row has no ' +
      'CMMPR row at all, which only the join excludes.',
    lanes: ['ACMS'],
    cases: [
      { caseId: cDel },
      { caseId: cSent },
      { caseId: cZero },
      { caseId: cBoundary },
      { caseId: cType },
      { caseId: cProfDel },
      { caseId: cCaseDel, cmmdbDeleted: true },
      { caseId: cOld, closedByCourt: '2015-06-01' },
      { caseId: cEdge },
      { caseId: cOrphan },
      { caseId: cOk },
    ],
    cams: { trustees: [tr('T-1', t1)], links: [{ acms: 'NY-00063', trustee: 'T-1' }] },
    passes: [
      {
        rows: [
          { caseId: cDel, prof: mk(11), apptDate: D1, deleted: true },
          { caseId: cSent, prof: mk(99999), apptDate: D1 },
          { caseId: cZero, prof: mk(0), apptDate: D1 },
          { caseId: cBoundary, prof: mk(98000), apptDate: D1 },
          { caseId: cType, prof: mk(13), apptDate: D1, apptType: 'AT' },
          { caseId: cProfDel, prof: mk(14, { cmmprDeleted: true }), apptDate: D1 },
          { caseId: cCaseDel, prof: mk(15), apptDate: D1 },
          { caseId: cOld, prof: mk(16), apptDate: D1 },
          { caseId: cEdge, prof: mk(97999), apptDate: D1 },
          { caseId: cOrphan, prof: mk(96000, { cmmprMissing: true }), apptDate: D1 },
          { caseId: cOk, prof: nyProf(63, t1), apptDate: D1 },
        ],
        changeDate: D2,
        expect: {
          sourceEvents: 2,
          appointments: {
            [cDel]: [],
            [cSent]: [],
            [cZero]: [],
            [cBoundary]: [],
            [cType]: [],
            [cProfDel]: [],
            [cCaseDel]: [],
            [cOld]: [],
            [cOrphan]: [],
            [cOk]: [{ trustee: 'T-1', assignedOn: D1 }],
          },
        },
      },
    ],
  });
}

// ===== Region segmentation =====

{
  const c02 = nextCase(DIVISION);
  const c03 = nextCase(OTHER_DIVISION);
  const c04 = nextCase(THIRD_DIVISION);
  const cLate = nextCase(DIVISION);
  const t02 = person('Basswood');
  const t03 = person('Beech', { state: 'PA', city: 'Harrisburg', zip: '17101' });
  const t04 = person('Birchbark', { state: 'TX', city: 'Dallas', zip: '75201' });
  const rows: Row[] = [
    { caseId: c02, prof: prof(63, t02), apptDate: D1, changeDate: D2 },
    { caseId: c03, prof: prof(63, t03, OTHER_DIVISION), apptDate: D1, changeDate: D2 },
    { caseId: c04, prof: prof(63, t04, THIRD_DIVISION), apptDate: D1, changeDate: D2 },
    { caseId: cLate, prof: prof(64, t02), apptDate: D1, changeDate: '2026-07-03' },
  ];
  const links = [
    { acms: 'NY-00063', trustee: 'T-02' },
    { acms: 'PA-00063', trustee: 'T-03' },
    { acms: 'DA-00063', trustee: 'T-04' },
    { acms: 'NY-00064', trustee: 'T-02' },
  ];
  add({
    key: 'region-and-date-isolation',
    title: 'A read returns only the requested region and change date',
    basis: 'feature',
    note:
      'Per-region, per-day reads are the unit of the sync (TrusteeAppointmentSource.getEventsForDate). The same ' +
      'rows are present for every pass; only the requested region changes, and each region sees only its own.',
    lanes: ['ACMS'],
    cases: [{ caseId: c02 }, { caseId: c03 }, { caseId: c04 }, { caseId: cLate }],
    cams: {
      trustees: [
        trWith('T-02', t02, [covering('7')]),
        trWith('T-03', t03, [covering('7', OTHER_DIVISION)]),
        trWith('T-04', t04, [covering('7', THIRD_DIVISION)]),
      ],
      links,
    },
    passes: [
      {
        rows,
        changeDate: D2,
        region: REGION,
        expect: {
          sourceEvents: 1,
          appointments: {
            [c02]: [{ trustee: 'T-02', assignedOn: D1 }],
            [c03]: [],
            [c04]: [],
            [cLate]: [],
          },
        },
      },
      {
        rows,
        changeDate: D2,
        region: OTHER_REGION,
        expect: {
          sourceEvents: 1,
          appointments: {
            [c02]: [{ trustee: 'T-02', assignedOn: D1 }],
            [c03]: [{ trustee: 'T-03', assignedOn: D1 }],
            [c04]: [],
            [cLate]: [],
          },
        },
      },
      {
        rows,
        changeDate: D2,
        region: THIRD_REGION,
        expect: {
          sourceEvents: 1,
          appointments: {
            [c02]: [{ trustee: 'T-02', assignedOn: D1 }],
            [c03]: [{ trustee: 'T-03', assignedOn: D1 }],
            [c04]: [{ trustee: 'T-04', assignedOn: D1 }],
            [cLate]: [],
          },
        },
      },
      {
        rows,
        changeDate: '2026-07-03',
        region: REGION,
        expect: {
          sourceEvents: 1,
          appointments: { [cLate]: [{ trustee: 'T-02', assignedOn: D1 }] },
        },
      },
    ],
  });
}

{
  const c02 = nextCase(DIVISION);
  const c03 = nextCase(OTHER_DIVISION);
  const p02 = person('Cassia');
  const p03 = person('Catalpa', { state: 'PA', city: 'Harrisburg', zip: '17101' });
  add({
    key: 'identity-tasks-carry-their-region',
    title: 'Identity tasks created for unknown trustees carry the court of their own region',
    basis: 'bead',
    note: 'cams-rxb7a staging script: a region produces its own Data Verification tasks to work by hand.',
    lanes: ['ACMS'],
    cases: [{ caseId: c02 }, { caseId: c03 }],
    cams: { trustees: [] },
    passes: [
      {
        rows: [
          { caseId: c02, prof: prof(95, p02), apptDate: D1 },
          { caseId: c03, prof: prof(95, p03, OTHER_DIVISION), apptDate: D1 },
        ],
        changeDate: D2,
        region: REGION,
        expect: {
          tasks: [
            { last: 'Cassia', count: 1, source: 'ACMS', court: DIVISIONS[DIVISION].court },
            { last: 'Catalpa', count: 0 },
          ],
        },
      },
      {
        rows: [
          { caseId: c02, prof: prof(95, p02), apptDate: D1 },
          { caseId: c03, prof: prof(95, p03, OTHER_DIVISION), apptDate: D1 },
        ],
        changeDate: D2,
        region: OTHER_REGION,
        expect: {
          tasks: [
            { last: 'Cassia', count: 1, court: DIVISIONS[DIVISION].court },
            { last: 'Catalpa', count: 1, source: 'ACMS', court: DIVISIONS[OTHER_DIVISION].court },
          ],
        },
      },
    ],
  });
}

// ===== DXTR-only shapes (792 real variants) =====

type DxtrVariant = { key: string; note: string; overrides: Partial<Person> };
const DXTR_VARIANTS: DxtrVariant[] = [
  {
    key: 'generation',
    note: '30 of 792 real variants carry a generation (Jr., III).',
    overrides: { last: 'Delphinium', generation: 'Jr.' },
  },
  {
    key: 'address-line-2',
    note: '321 of 792 have address line 2.',
    overrides: { last: 'Elderberry', address2: 'Suite 210' },
  },
  {
    key: 'parenthesized-phone',
    note: '22% of phones are (999) 999-9999.',
    overrides: { last: 'Forsythia', phoneStyle: 'parens' },
  },
  {
    key: 'space-phone',
    note: '2% of phones are "999 999-9999".',
    overrides: { last: 'Gardenia', phoneStyle: 'space' },
  },
  {
    key: 'zip-plus-4',
    note: '47 of 792 have ZIP+4.',
    overrides: { last: 'Hibiscus', dxtrZipPlus4: true },
  },
  {
    key: 'no-email',
    note: '4 of 792 have no email.',
    overrides: { last: 'Jasmine', email: undefined },
  },
  {
    key: 'upper-case-name',
    note: '47 of 792 real variants are upper-case.',
    overrides: { last: 'Kudzu', dxtrUpper: true },
  },
];

for (const v of DXTR_VARIANTS) {
  const c = nextCase();
  const p = person(v.overrides.last as string, v.overrides);
  add({
    key: `dxtr-shape-${v.key}`,
    title: `DXTR ${v.key.replace(/-/g, ' ')} variant resolves by variation`,
    basis: 'provisional',
    note: `${v.note} The variation is derived from the event the source returns, so the exact fingerprint shape is exercised.`,
    lanes: ['DXTR'],
    cases: [{ caseId: c }],
    cams: {
      trustees: [tr('T-V', person('Verbena'))],
      variations: [{ last: p.last, trustee: 'T-V' }],
    },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(88, p), apptDate: D1 }],
        changeDate: D2,
        expect: {
          sourceEvents: 1,
          appointments: { [c]: [{ trustee: 'T-V', assignedOn: D1, matchedBy: 'variation' }] },
        },
      },
    ],
  });
}

for (const [key, p, expectSkipped, note] of [
  [
    'sentinel-00000-no-identity',
    {
      ...person('Kale'),
      first: '',
      middle: undefined,
      last: '',
      address1: '',
      city: '',
      state: '',
      zip: '',
      phone: '',
      email: undefined,
    } as Person,
    true,
    'No name and no contact details at all: nothing can be attributed.',
  ],
  [
    'sentinel-99999-genuine-name-and-address',
    person('Lovage'),
    false,
    'A sentinel code on a record with a genuine name and address still reaches matching (an identity task).',
  ],
] as [string, Person, boolean, string][]) {
  const c = nextCase();
  add({
    key: `dxtr-${key}`,
    title: key.replace(/-/g, ' '),
    basis: 'code',
    note: `${note} (trustee-match-scenarios 15a-15d; CAMS-957 requires the same placeholder rules for DXTR events.)`,
    lanes: ['DXTR'],
    cases: [{ caseId: c }],
    cams: { trustees: [] },
    passes: [
      {
        rows: [
          {
            caseId: c,
            prof: nyProf(0, p),
            apptDate: D1,
            dxtrProfCode: key.includes('00000') ? '00000' : '99999',
          },
        ],
        changeDate: D2,
        expect: expectSkipped
          ? { sourceEvents: 1, appointments: { [c]: [] }, tasksTotal: 0 }
          : {
              sourceEvents: 1,
              appointments: { [c]: [{ trustee: 'PLACEHOLDER', assignedOn: D1 }] },
              tasks: [{ last: p.last, count: 1, source: 'DXTR', reason: 'no match' }],
              tasksTotal: 1,
            },
      },
    ],
  });
}

{
  const c = nextCase(DXTR_MISMATCH_DIVISION);
  const p = person('Mimosa', { state: 'TX', city: 'Dallas', zip: '75201' });
  add({
    key: 'dxtr-case-id-uses-acms-division-code',
    title: 'A DXTR case id is built from the ACMS division code, not the DXTR division code',
    basis: 'code',
    note:
      'cases.dxtr.gateway.ts builds caseId from AO_CS_DIV.CS_DIV_ACMS and joins on CS_DIV. This division has CS_DIV 492 ' +
      'but CS_DIV_ACMS 402, so a caseId built from the wrong column (492-26-...) would match no case. Real data ' +
      'mismatches were not confirmed by a repo grep; the coverage gap does not depend on it.',
    lanes: ['DXTR'],
    region: DIVISIONS[DXTR_MISMATCH_DIVISION].region,
    cases: [{ caseId: c }],
    cams: { trustees: [] },
    passes: [
      {
        rows: [{ caseId: c, prof: prof(95, p, DXTR_MISMATCH_DIVISION), apptDate: D1 }],
        changeDate: D2,
        expect: {
          sourceEvents: 1,
          appointments: { [c]: [{ trustee: 'PLACEHOLDER', assignedOn: D1 }] },
          tasks: [
            {
              last: 'Mimosa',
              count: 1,
              source: 'DXTR',
              court: DIVISIONS[DXTR_MISMATCH_DIVISION].court,
            },
          ],
          tasksTotal: 1,
        },
      },
    ],
  });
}

// ===== Core behaviors per region =====
// The same identification, active-trustee and placeholder rules must hold in every region, on that
// region's own group, division, court and state. Region 02 is covered above; this repeats the core
// set for the synthetic regions 03 and 04 so a region-specific bug (court lookup, group designator,
// per-region read) cannot hide behind region 02.

for (const division of [OTHER_DIVISION, THIRD_DIVISION]) {
  const d = DIVISIONS[division];
  const region = d.region;
  const loc = {
    state: d.state,
    city: d.state === 'PA' ? 'Harrisburg' : 'Dallas',
    zip: d.state === 'PA' ? '17101' : '75201',
  };
  const tag = `region-${region}`;
  const grp = d.group;
  const link = (code: number, trustee: string) => ({
    acms: `${grp}-${String(code).padStart(5, '0')}`,
    trustee,
  });

  {
    const c = nextCase(division);
    const t1 = person(`Core${region}Alpha`, loc);
    add({
      key: `${tag}-known-by-professional-id`,
      title: `Region ${region}: a linked professional id resolves the trustee`,
      basis: 'feature',
      region,
      lanes: ['ACMS'],
      cases: [{ caseId: c }],
      cams: { trustees: [trWith('T-1', t1, [covering('7', division)])], links: [link(63, 'T-1')] },
      passes: [
        {
          rows: [{ caseId: c, prof: prof(63, t1, division), apptDate: D1 }],
          changeDate: D2,
          expect: {
            sourceEvents: 1,
            appointments: {
              [c]: [
                {
                  trustee: 'T-1',
                  assignedOn: D1,
                  matchedBy: 'professional-id',
                  matchedTrusteeAppointment: true,
                },
              ],
            },
          },
        },
      ],
    });
  }

  {
    const c = nextCase(division);
    const p = person(`Core${region}Beta`, loc);
    add({
      key: `${tag}-pipeline-links-unknown`,
      title: `Region ${region}: the pipeline links an unknown trustee`,
      basis: 'feature',
      region,
      lanes: ['ACMS'],
      cases: [{ caseId: c }],
      cams: { trustees: [trWith('T-4', p, [covering('7', division)])] },
      passes: [
        {
          rows: [{ caseId: c, prof: prof(81, p, division), apptDate: D1 }],
          changeDate: D2,
          expect: {
            appointments: { [c]: [{ trustee: 'T-4', assignedOn: D1, matchedBy: 'PIPELINE' }] },
          },
        },
      ],
    });
  }

  {
    const c = nextCase(division);
    const p = person(`Core${region}Gamma`, loc);
    add({
      key: `${tag}-unknown-open-placeholder-and-task`,
      title: `Region ${region}: an unknown trustee gets a placeholder and a task carrying the region's court`,
      basis: 'feature',
      region,
      lanes: ['ACMS'],
      cases: [{ caseId: c }],
      cams: { trustees: [] },
      passes: [
        {
          rows: [{ caseId: c, prof: prof(82, p, division), apptDate: D1 }],
          changeDate: D2,
          expect: {
            appointments: { [c]: [{ trustee: 'PLACEHOLDER', assignedOn: D1 }] },
            tasks: [
              {
                last: p.last,
                count: 1,
                source: 'ACMS',
                reason: 'no match',
                acmsProfessionalId: `${grp}-00082`,
                court: d.court,
              },
            ],
          },
        },
      ],
    });
  }

  {
    const c = nextCase(division);
    const t1 = person(`Core${region}Delta`, loc);
    const t2 = person(`Core${region}Epsilon`, loc);
    add({
      key: `${tag}-newer-different-trustee-closes-active`,
      title: `Region ${region}: a newer appointment for a different trustee closes the active one`,
      basis: 'feature',
      region,
      lanes: ['ACMS'],
      cases: [{ caseId: c }],
      cams: {
        trustees: [
          trWith('T-1', t1, [covering('7', division)]),
          trWith('T-2', t2, [covering('7', division)]),
        ],
        links: [link(63, 'T-1'), link(71, 'T-2')],
        existing: [{ caseId: c, trustee: 'T-1', assignedOn: D1 }],
      },
      passes: [
        {
          rows: [{ caseId: c, prof: prof(71, t2, division), apptDate: '2026-08-10' }],
          changeDate: '2026-08-11',
          expect: {
            appointments: {
              [c]: [
                { trustee: 'T-1', assignedOn: D1, unassignedOn: '2026-08-09' },
                { trustee: 'T-2', assignedOn: '2026-08-10' },
              ],
            },
          },
        },
      ],
    });
  }

  {
    const c = nextCase(division);
    const t1 = person(`Core${region}Zeta`, loc);
    add({
      key: `${tag}-disp-date-closes-matching`,
      title: `Region ${region}: DISP_DATE closes the matching appointment`,
      basis: 'feature',
      region,
      lanes: ['ACMS'],
      cases: [{ caseId: c }],
      cams: { trustees: [trWith('T-1', t1, [covering('7', division)])], links: [link(63, 'T-1')] },
      passes: [
        {
          rows: [{ caseId: c, prof: prof(63, t1, division), apptDate: D1 }],
          changeDate: D2,
          expect: { appointments: { [c]: [{ trustee: 'T-1', assignedOn: D1 }] } },
        },
        {
          rows: [{ caseId: c, prof: prof(63, t1, division), apptDate: D1, dispDate: '2026-09-01' }],
          changeDate: '2026-09-02',
          expect: {
            appointments: { [c]: [{ trustee: 'T-1', assignedOn: D1, unassignedOn: '2026-09-01' }] },
          },
        },
      ],
    });
  }
}

// ---------------------------------------------------------------------------
// Region driver scenarios (bookmark, catch-up, run-date exclusion, named regions, per-region source
// routing). These need the per-region driver (cams-fd8qd.1.10) and the region source switch (CAMS-957)
// and are reported "NOT IMPLEMENTED" until wired into bindings.ts.
// ---------------------------------------------------------------------------

export type DriverRow = Row & { source: Lane };

/**
 * BOOKMARK RULE (maintainer decision, PR 3263 review): for BOTH sources, a date is complete only when a
 * later date exists, so the newest date is processed but never bookmarked and is read again on the next
 * run. Legacy DXTR ran to the end of its result set and never held back the newest date, so for DXTR this
 * is NEW behavior the production driver must implement (see cams-rxb7a). Every bookmark expectation below
 * follows it: each region needs a row on a later date than the one it expects to be bookmarked.
 */
export const BOOKMARK_RULE =
  'A date is complete only when a later date exists, for both ACMS and DXTR (maintainer decision).';

export type DriverScenario = {
  key: string;
  title: string;
  basis: Basis;
  note?: string;
  cases: CaseSpec[];
  cams?: CamsState;
  /** Rows present in ACMS (source 'ACMS') or DXTR (source 'DXTR'); each carries its own change date. */
  rows: DriverRow[];
  /** Region -> bookmark (lastSyncDate) present before the run. */
  bookmarks?: Record<string, string>;
  /** Regions switched to DXTR before the run (default: every region is on ACMS). */
  switchedToDxtr?: string[];
  runDate: string;
  regions: string[];
  /**
   * An operator's delete, run for `regions` before the driver (cams-fd8qd.32): the appointments in
   * those regions assigned within the range are deleted and the bookmarks rewound.
   */
  delete?: { from?: string; to?: string };
  expect: {
    /** Exact appointments per case that must have been written (content, not just presence). */
    written: Record<string, ExpectedAppointment[]>;
    /** Cases that must NOT have been touched. */
    notWritten: string[];
    /** Region -> bookmark after the run. */
    bookmarks: Record<string, string>;
    /** Cases whose seeded appointments must still be present and untouched. */
    kept?: string[];
    /** Cases with no appointment left in either partition (deleted and not replaced). */
    deleted?: string[];
    tasks?: ExpectedTask[];
    tasksTotal?: number;
  };
};

export const DRIVER_SCENARIOS: DriverScenario[] = (() => {
  const c0630 = nextCase();
  const c0701 = nextCase();
  const c0702 = nextCase();
  const c0703 = nextCase();
  const cRun = nextCase();
  const c02late = nextCase();
  const c03a = nextCase(OTHER_DIVISION);
  const c03b = nextCase(OTHER_DIVISION);
  const c03late = nextCase(OTHER_DIVISION);
  const c04 = nextCase(THIRD_DIVISION);
  const cUtica = nextCase(UTICA_DIVISION);
  const t1 = person('Cottonwood');
  const t3 = person('Cypresswood', { state: 'PA', city: 'Harrisburg', zip: '17101' });
  const t4 = person('Cedarbark', { state: 'TX', city: 'Dallas', zip: '75201' });
  const ACMS_ASSIGNED = '2026-06-15';
  const DXTR_ASSIGNED = '2026-07-01';
  const acmsRow = (caseId: string, changeDate: string, extra: Partial<Row> = {}): DriverRow => ({
    source: 'ACMS',
    caseId,
    prof: nyProf(63, t1),
    apptDate: ACMS_ASSIGNED,
    changeDate,
    ...extra,
  });
  const dxtrRow = (caseId: string, changeDate: string, p: ProfessionalSpec): DriverRow => ({
    source: 'DXTR',
    caseId,
    prof: p,
    apptDate: DXTR_ASSIGNED,
    changeDate,
  });
  const camsBase: CamsState = {
    trustees: [
      trWith('T-1', t1, [covering('7')]),
      trWith('T-3', t3, [covering('7', OTHER_DIVISION)]),
      trWith('T-4', t4, [covering('7', THIRD_DIVISION)]),
    ],
    links: [
      { acms: 'NY-00063', trustee: 'T-1' },
      { acms: 'PA-00063', trustee: 'T-3' },
      { acms: 'DA-00063', trustee: 'T-4' },
    ],
  };
  const casesAll: CaseSpec[] = [
    c0630,
    c0701,
    c0702,
    c0703,
    cRun,
    c02late,
    c03a,
    c03b,
    c03late,
    c04,
  ].map((caseId) => ({ caseId }));
  const prof03 = prof(63, t3, OTHER_DIVISION);
  const by = (trustee: string, assignedOn: string): ExpectedAppointment[] => [
    { trustee, assignedOn },
  ];

  const list: DriverScenario[] = [
    {
      key: 'driver-first-run-catches-up',
      title: "A region's first run catches up from 2026-07-01",
      basis: 'feature',
      note:
        `cams-fd8qd.1.10. ${BOOKMARK_RULE} The bookmark ends at 07-02 because 07-03 is the latest date in ` +
        'the replica; 07-03 is processed but not yet bookmarked.',
      cases: casesAll,
      cams: camsBase,
      rows: [
        acmsRow(c0630, '2026-06-30'),
        acmsRow(c0701, '2026-07-01'),
        acmsRow(c0702, '2026-07-02'),
        acmsRow(c0703, '2026-07-03'),
      ],
      runDate: '2026-07-05',
      regions: [REGION],
      expect: {
        written: {
          [c0701]: by('T-1', ACMS_ASSIGNED),
          [c0702]: by('T-1', ACMS_ASSIGNED),
          [c0703]: by('T-1', ACMS_ASSIGNED),
        },
        notWritten: [c0630],
        bookmarks: { [REGION]: '2026-07-02' },
      },
    },
    {
      key: 'driver-run-date-never-read',
      title: 'Rows changed on the run date are never read',
      basis: 'feature',
      note:
        `${BOOKMARK_RULE} The run-date row is never read, but it proves the days before it are complete, so ` +
        'the driver reads through 07-04 (the day before the run date). The bookmark advances through every ' +
        'date before that last date, empty ones included (cams-fd8qd.27), so it ends at 07-03.',
      cases: casesAll,
      cams: camsBase,
      rows: [acmsRow(c0702, '2026-07-02'), acmsRow(cRun, '2026-07-05')],
      bookmarks: { [REGION]: '2026-07-01' },
      runDate: '2026-07-05',
      regions: [REGION],
      expect: {
        written: { [c0702]: by('T-1', ACMS_ASSIGNED) },
        notWritten: [cRun],
        bookmarks: { [REGION]: '2026-07-03' },
      },
    },
    {
      key: 'driver-named-regions-only',
      title: 'An operator starts the sync for named regions',
      basis: 'feature',
      note: `Only the named region is processed; regions 03 and 04 are left alone and get no bookmark. ${BOOKMARK_RULE}`,
      cases: casesAll,
      cams: camsBase,
      rows: [
        acmsRow(c0701, '2026-07-01'),
        acmsRow(c0702, '2026-07-02'),
        acmsRow(c03a, '2026-07-02', { prof: prof03 }),
        acmsRow(c04, '2026-07-02', { prof: prof(63, t4, THIRD_DIVISION) }),
      ],
      runDate: '2026-07-05',
      regions: [REGION],
      expect: {
        written: { [c0701]: by('T-1', ACMS_ASSIGNED), [c0702]: by('T-1', ACMS_ASSIGNED) },
        notWritten: [c03a, c04],
        bookmarks: { [REGION]: '2026-07-01' },
      },
    },
    {
      key: 'driver-bookmarks-are-per-region',
      title: 'Each region advances its own bookmark independently',
      basis: 'bead',
      note: `cams-nd7ns: region.<regionId>.lastSyncDate, one per region, written with setField. ${BOOKMARK_RULE}`,
      cases: casesAll,
      cams: camsBase,
      rows: [
        acmsRow(c0702, '2026-07-02'),
        acmsRow(c0703, '2026-07-03'),
        acmsRow(c03a, '2026-07-04', { prof: prof03 }),
        acmsRow(c03b, '2026-07-05', { prof: prof03 }),
      ],
      bookmarks: { [REGION]: '2026-07-01', [OTHER_REGION]: '2026-07-03' },
      runDate: '2026-07-08',
      regions: [REGION, OTHER_REGION],
      expect: {
        written: {
          [c0702]: by('T-1', ACMS_ASSIGNED),
          [c0703]: by('T-1', ACMS_ASSIGNED),
          [c03a]: by('T-3', ACMS_ASSIGNED),
          [c03b]: by('T-3', ACMS_ASSIGNED),
        },
        notWritten: [],
        bookmarks: { [REGION]: '2026-07-02', [OTHER_REGION]: '2026-07-04' },
      },
    },
    {
      key: 'driver-switched-region-syncs-from-dxtr',
      title: 'A region switched to DXTR syncs from DXTR while the others stay on ACMS',
      basis: 'bead',
      note:
        'cams-rxb7a staging script: switch one region to DXTR before its first run, every other region stays ' +
        `ACMS. ACMS rows for the switched region and DXTR rows for the unswitched region must be ignored. ${BOOKMARK_RULE}`,
      cases: casesAll,
      cams: camsBase,
      rows: [
        acmsRow(c0701, '2026-07-01'),
        acmsRow(c02late, '2026-07-02'),
        acmsRow(c03a, '2026-07-01', { prof: prof03 }),
        dxtrRow(c03b, '2026-07-01', prof03),
        dxtrRow(c03late, '2026-07-02', prof03),
        dxtrRow(c0702, '2026-07-01', nyProf(63, t1)),
      ],
      switchedToDxtr: [OTHER_REGION],
      runDate: '2026-07-05',
      regions: [REGION, OTHER_REGION],
      expect: {
        written: {
          [c0701]: by('T-1', ACMS_ASSIGNED),
          [c02late]: by('T-1', ACMS_ASSIGNED),
          [c03b]: by('T-3', DXTR_ASSIGNED),
          [c03late]: by('T-3', DXTR_ASSIGNED),
        },
        notWritten: [c03a, c0702],
        bookmarks: { [REGION]: '2026-07-01', [OTHER_REGION]: '2026-07-01' },
      },
    },
    {
      key: 'driver-switched-region-first-run-starts-at-2026-07-01',
      title: 'A region switched to DXTR before its first run starts from 2026-07-01',
      basis: 'bead',
      note: `cams-rxb7a: continues from lastSyncDate, or from 2026-07-01 if switched before its first run. ${BOOKMARK_RULE}`,
      cases: casesAll,
      cams: camsBase,
      rows: [
        dxtrRow(c03a, '2026-06-30', prof03),
        dxtrRow(c03b, '2026-07-01', prof03),
        dxtrRow(c03late, '2026-07-02', prof03),
      ],
      switchedToDxtr: [OTHER_REGION],
      runDate: '2026-07-05',
      regions: [OTHER_REGION],
      expect: {
        written: { [c03b]: by('T-3', DXTR_ASSIGNED), [c03late]: by('T-3', DXTR_ASSIGNED) },
        notWritten: [c03a],
        bookmarks: { [OTHER_REGION]: '2026-07-01' },
      },
    },
    {
      key: 'driver-switch-keeps-existing-records',
      title: 'Switching a region to DXTR keeps the appointments ACMS already wrote',
      basis: 'bead',
      note: `cams-rxb7a: existing records are kept when a region switches (no data loss or rewrite). ${BOOKMARK_RULE}`,
      cases: casesAll,
      cams: { ...camsBase, existing: [{ caseId: c03a, trustee: 'T-3', assignedOn: '2026-06-15' }] },
      rows: [dxtrRow(c03b, '2026-07-01', prof03), dxtrRow(c03late, '2026-07-02', prof03)],
      switchedToDxtr: [OTHER_REGION],
      runDate: '2026-07-05',
      regions: [OTHER_REGION],
      expect: {
        written: { [c03b]: by('T-3', DXTR_ASSIGNED), [c03late]: by('T-3', DXTR_ASSIGNED) },
        notWritten: [],
        kept: [c03a],
        bookmarks: { [OTHER_REGION]: '2026-07-01' },
      },
    },
    {
      key: 'driver-switched-region-unknown-trustee-task',
      title: 'An unknown trustee in a DXTR-switched region becomes an identity task from DXTR',
      basis: 'bead',
      note:
        'cams-rxb7a: DXTR events go through the same identity order and pipeline; unresolved ones become identity ' +
        `tasks. The second row is the same professional on a later date, so it reuses the pending task. ${BOOKMARK_RULE}`,
      cases: casesAll,
      cams: { trustees: [] },
      rows: [
        dxtrRow(
          c03a,
          '2026-07-01',
          prof(
            63,
            person('Dracaena', { state: 'PA', city: 'Harrisburg', zip: '17101' }),
            OTHER_DIVISION,
          ),
        ),
        dxtrRow(
          c03late,
          '2026-07-02',
          prof(
            63,
            person('Dracaena', { state: 'PA', city: 'Harrisburg', zip: '17101' }),
            OTHER_DIVISION,
          ),
        ),
      ],
      switchedToDxtr: [OTHER_REGION],
      runDate: '2026-07-05',
      regions: [OTHER_REGION],
      expect: {
        written: {
          [c03a]: by('PLACEHOLDER', DXTR_ASSIGNED),
          [c03late]: by('PLACEHOLDER', DXTR_ASSIGNED),
        },
        notWritten: [],
        bookmarks: { [OTHER_REGION]: '2026-07-01' },
        tasks: [
          {
            last: 'Dracaena',
            count: 1,
            source: 'DXTR',
            reason: 'no match',
            court: DIVISIONS[OTHER_DIVISION].court,
          },
        ],
        tasksTotal: 1,
      },
    },
    {
      key: 'driver-delete-region-date-range-replaces',
      title:
        "An operator's delete removes a region's appointments in a date range and the sync replaces them",
      basis: 'decision',
      note:
        'cams-fd8qd.32 (Matt Stankey, 2026-11-11): operators delete by region and assignedOn range, whatever ' +
        'loaded the row. The seeded rows have no courtId, like rows from the pre-2026-07-01 migration. ' +
        `Region ${REGION} covers divisions 081 and 066, so both are deleted. Its bookmark (09-30) is rewound to ` +
        `07-31, so the run re-reads 08-01 onward; without the delete case ${c0630} would end with two rows. ` +
        BOOKMARK_RULE,
      cases: [...casesAll, { caseId: cUtica }],
      cams: {
        ...camsBase,
        existing: [
          { caseId: c0630, trustee: 'T-OLD', assignedOn: '2026-08-05' },
          { caseId: cUtica, trustee: 'T-OLD', assignedOn: '2026-08-20' },
          { caseId: c0701, trustee: 'T-1', assignedOn: '2026-06-15' },
          { caseId: c0702, trustee: 'T-1', assignedOn: '2026-10-05' },
          { caseId: c03a, trustee: 'T-3', assignedOn: '2026-08-15' },
        ],
      },
      rows: [
        acmsRow(c0630, '2026-08-10', { apptDate: '2026-08-10' }),
        acmsRow(c02late, '2026-08-12', { apptDate: '2026-08-12' }),
      ],
      bookmarks: { [REGION]: '2026-09-30', [OTHER_REGION]: '2026-09-30' },
      runDate: '2026-10-10',
      regions: [REGION],
      delete: { from: '2026-08-01', to: '2026-09-30' },
      expect: {
        written: {
          [c0630]: by('T-1', '2026-08-10'),
          [c02late]: by('T-1', '2026-08-12'),
        },
        notWritten: [],
        deleted: [cUtica],
        kept: [c0701, c0702, c03a],
        bookmarks: { [REGION]: '2026-08-11', [OTHER_REGION]: '2026-09-30' },
      },
    },
    {
      key: 'driver-delete-whole-region-replays-from-cutover',
      title:
        "An operator's delete with no dates clears a region and the sync rebuilds it from 2026-07-01",
      basis: 'decision',
      note:
        `cams-fd8qd.32: with no dates, every appointment in the region goes, including one assigned before ` +
        `2026-07-01, and its bookmark is cleared so the run starts at 2026-07-01. Region ${REGION} is untouched. ` +
        BOOKMARK_RULE,
      cases: casesAll,
      cams: {
        ...camsBase,
        existing: [
          { caseId: c03a, trustee: 'T-3', assignedOn: '2026-05-01' },
          { caseId: c03b, trustee: 'T-OLD', assignedOn: '2026-07-15' },
          { caseId: c0701, trustee: 'T-1', assignedOn: '2026-06-15' },
        ],
      },
      rows: [
        acmsRow(c03late, '2026-07-01', { prof: prof03 }),
        acmsRow(c03b, '2026-07-02', { prof: prof03 }),
      ],
      bookmarks: { [REGION]: '2026-07-20', [OTHER_REGION]: '2026-07-20' },
      runDate: '2026-07-25',
      regions: [OTHER_REGION],
      delete: {},
      expect: {
        written: {
          [c03late]: by('T-3', ACMS_ASSIGNED),
          [c03b]: by('T-3', ACMS_ASSIGNED),
        },
        notWritten: [],
        deleted: [c03a],
        kept: [c0701],
        bookmarks: { [OTHER_REGION]: '2026-07-01', [REGION]: '2026-07-20' },
      },
    },
  ];
  return list;
})();

/** Behaviors the catalog cannot express yet, kept visible so they are not forgotten. */
export const PENDING_BEHAVIORS: { title: string; reason: string }[] = [
  {
    title: 'A transient error retries in place',
    reason:
      'Needs fault injection into the Mongo write path; a real-infrastructure harness cannot produce a ' +
      'transient Cosmos 429 on demand. Covered by unit tests.',
  },
  {
    title: 'A long date continues in a fresh message',
    reason:
      'Needs an invocation time budget the harness can shrink; becomes feasible once the driver ' +
      '(cams-fd8qd.1.10) accepts an injectable budget.',
  },
  {
    title: 'ACMS ambiguous link: integrity-error task vs fall-through',
    reason:
      'cams-nd7ns says 2+ links goes straight to a "multiple linked trustees" identity task; the .feature and ' +
      'cams-fd8qd.1.7 say it falls through. The "ambiguous-link-not-used" scenario follows the latter; revisit when decided.',
  },
  {
    title: 'Slice 3: daily heal and abandoned counts',
    reason:
      'Parking is covered by the two parked scenarios. Heal (cams-fd8qd.3.7) needs a pass type that ' +
      'loads the case into CAMS and then runs healParkedPage; the harness only runs processAppointments.',
  },
  {
    title: 'Slice 2 lanes and Slice 4 admin page',
    reason: 'Not built (cams-fd8qd.5, .4).',
  },
  {
    title: 'CAMS-956 Trustee Appointment task (placeholders and parked records never join)',
    reason:
      'Not built. The jurisdiction-* scenarios already span court, division, chapter, inactive and missing ' +
      'appointments; add task assertions when the trustee-appointment-verification collection exists.',
  },
  {
    title: 'CAMS-957 gap report, SuperUser-only switch and rejecting a switch back to ACMS',
    reason:
      'API and admin behavior, not sync behavior; test at the API/BDD layer. Region routing itself is in the driver scenarios.',
  },
  {
    title: 'Empty first names (83 of 6,770 real ACMS records)',
    reason:
      'Expected outcome is unknown (mononymous or organization names); add once the pipeline rule is known.',
  },
];
