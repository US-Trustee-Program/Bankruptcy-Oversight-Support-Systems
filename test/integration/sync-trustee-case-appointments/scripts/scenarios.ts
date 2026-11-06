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
 *   provisional - a conceivable edge case with a reasonable but UNCONFIRMED expectation; confirm or
 *                 correct it when the behavior is built
 *
 * This file is intentionally self-contained and not shared with any other harness.
 */

export type Lane = 'ACMS' | 'DXTR';
export type Basis = 'feature' | 'bead' | 'code' | 'provisional';

// ---------------------------------------------------------------------------
// Fixed synthetic geography. Region 02 / group NY / division 081 / court 0208 mirror real USTP codes;
// region 03 / group PA / division 301 / court 0301 are synthetic and only exist to prove isolation.
// ---------------------------------------------------------------------------

export const REGION = '02';
export const OTHER_REGION = '03';
export const GROUP = 'NY';
export const OTHER_GROUP = 'PA';
export const DIVISION = '081';
export const OTHER_DIVISION = '301';
export const COURT_ID = '0208';
export const OTHER_COURT_ID = '0301';
export const ACMS_PREFIX = '081-26-';

export type Person = {
  first: string;
  middle?: string;
  last: string;
  address1: string;
  city: string;
  state: string;
  zip: string;
  /** 10 digits, no punctuation (ACMS stores NUMERIC(10)). */
  phone: string;
  email?: string;
};

/** A distinctive, internally consistent person. `last` must be unique within a scenario. */
export function person(last: string, overrides: Partial<Person> = {}): Person {
  return {
    first: 'Fixture',
    middle: 'Q',
    last,
    address1: `1 ${last} Way`,
    city: 'Albany',
    state: 'NY',
    zip: '12207',
    phone: '5185550100',
    email: `${last.toLowerCase()}@example.com`,
    ...overrides,
  };
}

export type CamsTrustee = {
  id: string;
  person: Person;
  /** Seeds an ACTIVE trustee appointment covering court 0208 / division 081 / chapter 7. */
  covers?: boolean;
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
  /** ISO date of a reopening key event (CMMKE OCO). */
  reopenedOn?: string;
  /** CMMDB.DELETE_CODE = 'D'. */
  cmmdbDeleted?: boolean;
  /** How the case exists in CAMS (SYNCED_CASE). Default 'synced'. */
  cams?: 'synced' | 'absent' | { movedTo: string };
  /** Division the case belongs to (default 081 / court 0208). */
  division?: typeof DIVISION | typeof OTHER_DIVISION;
};

export type ProfessionalSpec = {
  group: string;
  code: number;
  person: Person;
  /** CMMPR.DELETE_CODE = 'D'. */
  cmmprDeleted?: boolean;
};

export type Row = {
  caseId: string;
  prof: ProfessionalSpec;
  /** ISO date; ACMS APPT_DATE / DXTR REC aptDate. */
  apptDate: string;
  /** ISO date; ACMS DISP_DATE. Not representable in DXTR. */
  dispDate?: string;
  /** CMMAP.DELETE_CODE = 'D'. */
  deleted?: boolean;
  /** CMMAP.APPT_TYPE (default 'TR'). */
  apptType?: string;
  /** ISO CDB_UPDATE_DATE / TX_DATE (default: the pass's changeDate). */
  changeDate?: string;
  /** CMMAP.REGION_CODE (default '02'). */
  region?: string;
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
  /** Last name of the source trustee the task is about (unique within the scenario). */
  last: string;
  count: number;
  source?: Lane;
  reason?: 'no match' | 'ambiguous';
  acmsProfessionalId?: string;
};

export type Expect = {
  /** Exact set of CaseAppointment documents per case, after this pass. Omitted case = not asserted. */
  appointments?: Record<string, ExpectedAppointment[]>;
  tasks?: ExpectedTask[];
  /** Number of events the SOURCE returned for this pass (grounds query-level filtering). */
  sourceEvents?: number;
  dlq?: number;
  notYetSynced?: number;
  /** Existing seeded appointments for these caseIds must be byte-for-byte untouched (same updatedOn). */
  untouched?: string[];
};

export type Pass = {
  /** Rows present in the source during this pass. Replaces the previous pass's rows. */
  rows: Row[];
  /** ISO date the source is asked for (ACMS CDB_UPDATE_DATE). */
  changeDate: string;
  region?: string;
  expect: Expect;
};

export type CamsState = {
  trustees?: CamsTrustee[];
  /** acms like 'NY-00063'. Default disposition 'linked'. */
  links?: { acms: string; trustee: string; disposition?: 'linked' | 'no-match' | 'ambiguous' }[];
  /** A saved variation: the source event whose trustee has this last name resolves to `trustee`. */
  variations?: { last: string; trustee: string }[];
  /** A pending identity task for the fingerprint of the source event whose trustee has this last name. */
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
  cases: CaseSpec[];
  cams?: CamsState;
  passes: Pass[];
  /** Per-lane expectation overrides for lanes whose source cannot express the same facts. */
  dxtrExpect?: Partial<Expect>;
  /** When set the scenario is reported as pending rather than run, with this reason. */
  pending?: string;
};

// ---------------------------------------------------------------------------
// Helpers to keep the catalog readable
// ---------------------------------------------------------------------------

const D1 = '2026-07-01';
const D2 = '2026-07-02';

let caseSeq = 0;
/** Fresh 081-26-nnnnn case id; deterministic by declaration order. */
function nextCase(): string {
  caseSeq += 1;
  return `${ACMS_PREFIX}${String(caseSeq).padStart(5, '0')}`;
}

function nyProf(code: number, p: Person): ProfessionalSpec {
  return { group: GROUP, code, person: p };
}

function tr(id: string, p: Person, covers = true): CamsTrustee {
  return { id, person: p, covers };
}

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
  const c = nextCase();
  const p = person('Birch');
  add({
    key: 'known-by-variation',
    title: 'Known trustee found by variation',
    basis: 'feature',
    note:
      'Variation is seeded from the fingerprint of the event the source actually returns, so the ' +
      'harness does not assume how a source formats its variant.',
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
    note: 'cams-fd8qd.1.7: ambiguous link falls through to variation and the pipeline, never picks one.',
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
  const cUt = nextCase();
  const shared = person('Dogwood');
  const stranger = person('Dunmore');
  add({
    key: 'compound-professional-key',
    title: 'The same PROF_CODE in a different group is a different professional',
    basis: 'bead',
    note:
      'cams-gateways PROCEDURE 1 step 2B: ACMS ids are (GROUP_DESIGNATOR, PROF_CODE), never PROF_CODE alone. ' +
      'NY-00063 is linked to T-1; UT-00063 is an unrelated professional and must not resolve to T-1.',
    lanes: ['ACMS'],
    cases: [{ caseId: cNy }, { caseId: cUt }],
    cams: { trustees: [tr('T-1', shared)], links: [{ acms: 'NY-00063', trustee: 'T-1' }] },
    passes: [
      {
        rows: [
          { caseId: cNy, prof: nyProf(63, shared), apptDate: D1 },
          { caseId: cUt, prof: { group: 'UT', code: 63, person: stranger }, apptDate: D1 },
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
        expect: { appointments: { [c]: [{ trustee: 'T-1', assignedOn: D1 }] }, untouched: [c] },
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
    note: 'Two CMMAP rows (RECORD_SEQ_NBR 1 closed, 2 open) for one professional on one case.',
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

{
  const c = nextCase();
  const t5 = person('Kestrel');
  add({
    key: 'jurisdiction-check-fails',
    title: 'Jurisdiction check fails but the appointment is still written',
    basis: 'feature',
    note: 'Decision 1a. Also covers "matchedTrusteeAppointment defaults to false": the field is present and false.',
    lanes: ['ACMS'],
    cases: [{ caseId: c }],
    // covers=false: no active trustee appointment for court 0208 / division 081 / chapter 7.
    cams: { trustees: [tr('T-5', t5, false)], links: [{ acms: 'NY-00073', trustee: 'T-5' }] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(73, t5), apptDate: D1 }],
        changeDate: D2,
        expect: {
          appointments: {
            [c]: [
              {
                trustee: 'T-5',
                assignedOn: D1,
                matchedBy: 'professional-id',
                matchedTrusteeAppointment: false,
              },
            ],
          },
          tasks: [{ last: 'Kestrel', count: 0 }],
        },
      },
    ],
  });
}

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
      'phone/email no-match and were the same person.',
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
            },
          ],
        },
      },
    ],
    dxtrExpect: {
      tasks: [{ last: 'Nutmeg', count: 1, source: 'DXTR', reason: 'no match' }],
    },
  });
}

{
  const c = nextCase();
  const p = person('Oak');
  add({
    key: 'unknown-closed-removes-placeholder',
    title: 'Unknown trustee with a closed appointment removes the open placeholder',
    basis: 'feature',
    note: 'cams-fd8qd.1.9: no existing code path deletes the placeholder; the identity task itself stays.',
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
        expect: { appointments: { [c]: [] }, tasks: [{ last: 'Oak', count: 1, source: 'ACMS' }] },
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
          // Seeded task is the only one: no second task is created.
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
      'Pipeline outcome "ambiguous": 2+ candidates pass the name check and nothing separates them. ' +
      'Same shape as trustee-match-scenarios scenario 8.',
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

// ===== Skips, DLQ, parking behaviors =====

{
  const c = nextCase();
  const t1 = person('Sumac');
  add({
    key: 'moved-case-skipped',
    title: 'An appointment on a moved case is skipped',
    basis: 'feature',
    lanes: ['ACMS', 'DXTR'],
    cases: [{ caseId: c, cams: { movedTo: `${ACMS_PREFIX}90010` } }],
    cams: { trustees: [tr('T-1', t1)], links: [{ acms: 'NY-00063', trustee: 'T-1' }] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(63, t1), apptDate: D1 }],
        changeDate: D2,
        expect: { appointments: { [c]: [] }, tasks: [{ last: 'Sumac', count: 0 }] },
      },
    ],
  });
}

{
  const c = nextCase();
  const t1 = person('Tamarack');
  add({
    key: 'case-not-yet-synced',
    title: 'An appointment for a case not yet in CAMS is not written',
    basis: 'code',
    note:
      'Slice 1 behavior: the event is reported not-yet-synced (requeued by the function app). ' +
      'Slice 3 replaces this with parking - update this scenario then ("An appointment for a case not yet in CAMS is parked").',
    lanes: ['ACMS', 'DXTR'],
    cases: [{ caseId: c, cams: 'absent' }],
    cams: { trustees: [tr('T-1', t1)], links: [{ acms: 'NY-00063', trustee: 'T-1' }] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(63, t1), apptDate: D1 }],
        changeDate: D2,
        expect: { appointments: { [c]: [] }, notYetSynced: 1 },
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
      'CURR_CASE_CHAPT "AC" is not a chapter CAMS recognizes (acms-case-appointment.helpers.ts). ' +
      'The other record on the page is still processed.',
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
          sourceEvents: 2,
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
        expect: { dlq: 1, appointments: { [c]: [] } },
      },
    ],
  });
}

{
  const c = nextCase();
  const p = person('Willow');
  add({
    key: 'unappointable-chapter-skipped',
    title: 'Chapter 9 and 15 cases never receive a trustee appointment',
    basis: 'code',
    note: 'isUnappointableChapter: routing them to verification would create a permanently unapprovable task.',
    lanes: ['ACMS', 'DXTR'],
    cases: [{ caseId: c, chapter: '15' }],
    cams: { trustees: [] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(86, p), apptDate: D1 }],
        changeDate: D2,
        expect: { appointments: { [c]: [] }, tasks: [{ last: 'Willow', count: 0 }] },
      },
    ],
  });
}

{
  const c = nextCase();
  const bogus: Person = {
    ...person('Trustee'),
    first: 'US',
    middle: undefined,
    last: 'Trustee 11',
    email: undefined,
  };
  add({
    key: 'administrative-placeholder-name-skipped',
    title: 'An administrative placeholder name ("US Trustee 11") is not treated as a trustee',
    basis: 'code',
    note:
      'isUnattributableBogusName / skipAdministrativePlaceholder, which exists for DXTR today. Whether the ' +
      'ACMS source applies the same rule is exactly what this scenario will tell us.',
    lanes: ['ACMS', 'DXTR'],
    cases: [{ caseId: c }],
    cams: { trustees: [] },
    passes: [
      {
        rows: [{ caseId: c, prof: nyProf(87, bogus), apptDate: D1 }],
        changeDate: D2,
        expect: { appointments: { [c]: [] }, tasks: [{ last: 'Trustee 11', count: 0 }] },
      },
    ],
  });
}

// ===== Case facts carried onto the appointment (CMMDB / CMMKE) =====

{
  const c = nextCase();
  const t1 = person('Yarrow');
  add({
    key: 'chapter-7a-normalized',
    title: 'ACMS chapter 7A is written as chapter 7',
    basis: 'code',
    note: 'normalizeAcmsCaseChapter (acms.gateway.helper). 7A and 7N both map to 7.',
    lanes: ['ACMS'],
    cases: [{ caseId: c, acmsChapterRaw: '7A' }],
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
    basis: 'code',
    note:
      'buildAppointmentFields: closedDate from CLOSED_BY_COURT_DATE (else CLOSED_BY_UST_DATE); ' +
      'reopenedDate from the CMMKE OCO key event.',
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

// ===== Source-level filtering (what the ACMS read returns at all) =====

{
  const cDel = nextCase();
  const cSent = nextCase();
  const cType = nextCase();
  const cProfDel = nextCase();
  const cCaseDel = nextCase();
  const cOld = nextCase();
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
      'Grounds getCmmapAppointmentsRaw: DELETE_CODE "D" on CMMAP/CMMDB/CMMPR, PROF_CODE >= 98000, ' +
      'APPT_TYPE != TR, and cases closed on or before 2018-01-01. Only the one valid row yields an event.',
    lanes: ['ACMS'],
    cases: [
      { caseId: cDel },
      { caseId: cSent },
      { caseId: cType },
      { caseId: cProfDel },
      { caseId: cCaseDel, cmmdbDeleted: true },
      { caseId: cOld, closedByCourt: '2015-06-01' },
      { caseId: cOk },
    ],
    cams: { trustees: [tr('T-1', t1)], links: [{ acms: 'NY-00063', trustee: 'T-1' }] },
    passes: [
      {
        rows: [
          { caseId: cDel, prof: mk(11), apptDate: D1, deleted: true },
          { caseId: cSent, prof: mk(99999), apptDate: D1 },
          { caseId: cType, prof: mk(13), apptDate: D1, apptType: 'AT' },
          { caseId: cProfDel, prof: mk(14, { cmmprDeleted: true }), apptDate: D1 },
          { caseId: cCaseDel, prof: mk(15), apptDate: D1 },
          { caseId: cOld, prof: mk(16), apptDate: D1 },
          { caseId: cOk, prof: nyProf(63, t1), apptDate: D1 },
        ],
        changeDate: D2,
        expect: {
          sourceEvents: 1,
          appointments: {
            [cDel]: [],
            [cSent]: [],
            [cType]: [],
            [cProfDel]: [],
            [cCaseDel]: [],
            [cOld]: [],
            [cOk]: [{ trustee: 'T-1', assignedOn: D1 }],
          },
        },
      },
    ],
  });
}

{
  const cIn = nextCase();
  const cOtherRegion = nextCase();
  const cOtherDate = nextCase();
  const t1 = person('Basswood');
  const t2 = person('Beech');
  add({
    key: 'region-and-date-isolation',
    title: 'A read returns only the requested region and change date',
    basis: 'feature',
    note: 'Per-region, per-day reads are the unit of the sync (TrusteeAppointmentSource.getEventsForDate).',
    lanes: ['ACMS'],
    cases: [
      { caseId: cIn },
      { caseId: cOtherRegion, division: OTHER_DIVISION },
      { caseId: cOtherDate },
    ],
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
          { caseId: cIn, prof: nyProf(63, t1), apptDate: D1 },
          {
            caseId: cOtherRegion,
            prof: { group: OTHER_GROUP, code: 71, person: t2 },
            apptDate: D1,
            region: OTHER_REGION,
          },
          { caseId: cOtherDate, prof: nyProf(71, t2), apptDate: D1, changeDate: '2026-07-03' },
        ],
        changeDate: D2,
        expect: {
          sourceEvents: 1,
          appointments: {
            [cIn]: [{ trustee: 'T-1', assignedOn: D1 }],
            [cOtherRegion]: [],
            [cOtherDate]: [],
          },
        },
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Region driver scenarios (bookmark, catch-up, run-date exclusion, named regions).
// These need the per-region driver (cams-fd8qd.1.10) and are reported "NOT IMPLEMENTED" until it is
// wired into bindings.ts.
// ---------------------------------------------------------------------------

export type DriverScenario = {
  key: string;
  title: string;
  basis: Basis;
  note?: string;
  cases: CaseSpec[];
  cams?: CamsState;
  /** Rows present in ACMS; each carries its own change date. */
  rows: Row[];
  /** Region -> bookmark (lastSyncDate) present before the run. */
  bookmarks?: Record<string, string>;
  runDate: string;
  regions: string[];
  expect: {
    /** Cases that must have an appointment written. */
    written: string[];
    /** Cases that must NOT have been touched. */
    notWritten: string[];
    /** Region -> bookmark after the run. */
    bookmarks: Record<string, string>;
  };
};

export const DRIVER_SCENARIOS: DriverScenario[] = (() => {
  const cases = [
    nextCase(), // 06-30
    nextCase(), // 07-01
    nextCase(), // 07-02
    nextCase(), // 07-03
    nextCase(), // run-date
    nextCase(), // region 03
  ];
  const [c0630, c0701, c0702, c0703, cRun, cOther] = cases;
  const t1 = person('Cottonwood');
  const prof = nyProf(63, t1);
  const base = {
    cases: [
      ...cases.slice(0, 5).map((caseId) => ({ caseId })),
      { caseId: cOther, division: OTHER_DIVISION } as CaseSpec,
    ],
    cams: {
      trustees: [tr('T-1', t1)],
      links: [{ acms: 'NY-00063', trustee: 'T-1' }],
    } as CamsState,
  };
  const row = (caseId: string, changeDate: string, extra: Partial<Row> = {}): Row => ({
    caseId,
    prof,
    apptDate: '2026-06-15',
    changeDate,
    ...extra,
  });
  return [
    {
      key: 'driver-first-run-catches-up',
      title: "A region's first run catches up from 2026-07-01",
      basis: 'feature',
      note:
        'cams-fd8qd.1.10. Bookmark ends at 07-02 because 07-03 is the latest date in the replica and ' +
        'a date is complete only when a later date exists.',
      ...base,
      rows: [
        row(c0630, '2026-06-30'),
        row(c0701, '2026-07-01'),
        row(c0702, '2026-07-02'),
        row(c0703, '2026-07-03'),
      ],
      runDate: '2026-07-05',
      regions: [REGION],
      expect: {
        written: [c0701, c0702, c0703],
        notWritten: [c0630],
        bookmarks: { [REGION]: '2026-07-02' },
      },
    },
    {
      key: 'driver-run-date-never-read',
      title: 'Rows changed on the run date are never read',
      basis: 'feature',
      ...base,
      rows: [row(c0702, '2026-07-02'), row(cRun, '2026-07-05')],
      bookmarks: { [REGION]: '2026-07-01' },
      runDate: '2026-07-05',
      regions: [REGION],
      expect: { written: [c0702], notWritten: [cRun], bookmarks: { [REGION]: '2026-07-02' } },
    },
    {
      key: 'driver-named-regions-only',
      title: 'An operator starts the sync for named regions',
      basis: 'feature',
      note: 'Only the named region is processed; region 03 is left alone.',
      ...base,
      rows: [
        row(c0701, '2026-07-01'),
        row(c0702, '2026-07-02'),
        row(cOther, '2026-07-02', {
          region: OTHER_REGION,
          prof: { group: OTHER_GROUP, code: 63, person: t1 },
        }),
      ],
      runDate: '2026-07-05',
      regions: [REGION],
      expect: { written: [c0701], notWritten: [cOther], bookmarks: { [REGION]: '2026-07-01' } },
    },
  ];
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
    title: 'SLICE 2 lanes / SLICE 3 parking and healing / SLICE 4 admin page',
    reason: 'Not built. Add scenarios here when those slices are designed (cams-fd8qd.5, .3, .4).',
  },
  {
    title: 'Region switched to DXTR and region source routing',
    reason:
      'CAMS-957 (cams-rxb7a, cams-rxb7a.1). Extend this harness with routed regions once it exists.',
  },
];
