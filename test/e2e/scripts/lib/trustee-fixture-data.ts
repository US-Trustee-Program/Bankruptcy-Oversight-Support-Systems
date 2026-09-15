/**
 * Trustee fixture data for the Trustees list / Trustee Case List E2E specs.
 *
 * Single source of truth, imported by synthesize-fixtures.ts. Trustee IDs are exported
 * so the Playwright specs can reference them directly instead of searching/filtering.
 *
 * Schema notes (see common/src/cams/trustees.ts, common/src/cams/trustee-appointments.ts):
 * - `trustees` docs use top-level firstName/lastName plus a `public` ContactInformation
 *   object (NOT `professional` -- that field does not exist in the current schema).
 * - District/Division/Chapter/Type/Status columns on the Trustees list are driven entirely
 *   by `trustee-appointments` docs, not by anything on the trustee doc itself.
 * - CASE_APPOINTMENT docs must be written identically into BOTH `case-trustee-appointments`
 *   and `trustee-case-appointments` (two Cosmos-sharded partitions of the same data).
 * - The Trustee Case List panel's caseTitle/courtDivisionName come from a $lookup into the
 *   `cases` collection by caseId, not from the appointment doc.
 */

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };
const NOW = '2025-03-01T00:00:00.000Z';

// Note: trusteeId ...ffff00000001 ("test-trustee-0") already exists in the committed
// fixture (with its own trustee-appointments/case-trustee-appointments records used by
// other specs) -- deliberately left untouched here. Its lastName "Trustee" sorts after
// the AAA/AAB/AAC-prefixed trustees below and before the ZZZ-prefixed filler trustees,
// so it still counts toward the 30-trustee pagination total without being managed here.
export const SORT_TRUSTEE_ID = 'aaaabbbb-cccc-dddd-eeee-ffff00000002';
export const COMP_NEEDLE_TRUSTEE_ID = 'aaaabbbb-cccc-dddd-eeee-ffff00000003';
export const CASE_LIST_PAGINATED_TRUSTEE_ID = 'aaaabbbb-cccc-dddd-eeee-ffff00000004';
export const CASE_LIST_EMPTY_TRUSTEE_ID = 'aaaabbbb-cccc-dddd-eeee-ffff00000005';
export const SPLIT_TRUSTEE_ID = 'aaaabbbb-cccc-dddd-eeee-ffff00000006';

export const COMP_FILLER_COUNT = 26;

type MongoDoc = Record<string, unknown>;

function createTrustee(opts: {
  id: string;
  trusteeId: string;
  firstName: string;
  lastName: string;
  city?: string;
  state?: string;
}): MongoDoc {
  return {
    id: opts.id,
    documentType: 'TRUSTEE',
    trusteeId: opts.trusteeId,
    name: `${opts.lastName}, ${opts.firstName}`,
    firstName: opts.firstName,
    lastName: opts.lastName,
    status: 'active',
    public: {
      address: {
        address1: '100 Test Street',
        city: opts.city ?? 'New York',
        state: opts.state ?? 'NY',
        zipCode: '10001',
        countryCode: 'US',
      },
      phone: { number: '212-555-0100' },
      email: `${opts.id}@example.com`,
    },
    updatedOn: NOW,
    updatedBy: SEEDER,
  };
}

function createTrusteeAppointment(opts: {
  id: string;
  trusteeId: string;
  chapter: string;
  appointmentType: string;
  courtId: string;
  divisionCode: string;
  courtName: string;
  courtDivisionName: string;
  status?: string;
}): MongoDoc {
  return {
    id: opts.id,
    documentType: 'TRUSTEE_APPOINTMENT',
    trusteeId: opts.trusteeId,
    chapter: opts.chapter,
    appointmentType: opts.appointmentType,
    courtId: opts.courtId,
    divisionCode: opts.divisionCode,
    divisionCodes: [opts.divisionCode],
    appointedDate: '2020-01-01',
    status: opts.status ?? 'active',
    effectiveDate: '2020-01-01',
    courtName: opts.courtName,
    courtDivisionName: opts.courtDivisionName,
    updatedOn: NOW,
    updatedBy: SEEDER,
  };
}

function createCaseAppointment(opts: {
  id: string;
  trusteeId: string;
  caseId: string;
  dateFiled: string;
  chapter: string;
  courtDivisionCode: string;
}): MongoDoc {
  return {
    id: opts.id,
    documentType: 'CASE_APPOINTMENT',
    caseId: opts.caseId,
    trusteeId: opts.trusteeId,
    assignedOn: `${opts.dateFiled}T00:00:00Z`,
    appointedDate: opts.dateFiled,
    dateFiled: opts.dateFiled,
    chapter: opts.chapter,
    courtDivisionCode: opts.courtDivisionCode,
    caseStatus: 'OPEN',
    createdOn: NOW,
    createdBy: SEEDER,
    updatedOn: NOW,
    updatedBy: SEEDER,
  };
}

function createSyncedCase(opts: {
  caseId: string;
  caseTitle: string;
  courtDivisionName: string;
  courtId: string;
  chapter: string;
  dateFiled: string;
}): MongoDoc {
  return {
    id: opts.caseId,
    documentType: 'SYNCED_CASE',
    caseId: opts.caseId,
    caseNumber: opts.caseId.slice(4),
    caseTitle: opts.caseTitle,
    chapter: opts.chapter,
    dateFiled: opts.dateFiled,
    courtId: opts.courtId,
    courtDivisionName: opts.courtDivisionName,
    updatedOn: NOW,
    updatedBy: SEEDER,
  };
}

export type TrusteeFixtureCollections = {
  trustees: MongoDoc[];
  trusteeAppointments: MongoDoc[];
  caseAppointments: MongoDoc[]; // written to both case-trustee-appointments and trustee-case-appointments
  cases: MongoDoc[];
};

export function buildTrusteeFixtureData(): TrusteeFixtureCollections {
  const trustees: MongoDoc[] = [];
  const trusteeAppointments: MongoDoc[] = [];
  const caseAppointments: MongoDoc[] = [];
  const cases: MongoDoc[] = [];

  // ── Sort-test trustee: 6 appointments exercising all 4 sort levels ─────────
  // (state -> region -> chapter -> appointment type). Real, DXTR-confirmed
  // court/division codes, matching dev-tools/db_scripts/scenarios/trustees-comprehensive.ts's
  // "Patricia Manhattan" example.
  trustees.push(
    createTrustee({
      id: 'e2e-trustee-sort4level',
      trusteeId: SORT_TRUSTEE_ID,
      firstName: 'E2e',
      lastName: 'AaaSortFourLevel',
    }),
  );
  trusteeAppointments.push(
    createTrusteeAppointment({
      id: 'e2e-appt-sort-ca-east-ch7-offpanel',
      trusteeId: SORT_TRUSTEE_ID,
      chapter: '7',
      appointmentType: 'off-panel',
      courtId: '0972',
      divisionCode: '722',
      courtName: 'Eastern District of California',
      courtDivisionName: 'Sacramento',
    }),
    createTrusteeAppointment({
      id: 'e2e-appt-sort-ca-east-ch7-panel',
      trusteeId: SORT_TRUSTEE_ID,
      chapter: '7',
      appointmentType: 'panel',
      courtId: '0972',
      divisionCode: '722',
      courtName: 'Eastern District of California',
      courtDivisionName: 'Sacramento',
    }),
    createTrusteeAppointment({
      id: 'e2e-appt-sort-ca-north-ch11',
      trusteeId: SORT_TRUSTEE_ID,
      chapter: '11',
      appointmentType: 'case-by-case',
      courtId: '0971',
      divisionCode: '713',
      courtName: 'Northern District of California',
      courtDivisionName: 'San Francisco',
    }),
    createTrusteeAppointment({
      id: 'e2e-appt-sort-id-district-ch12',
      trusteeId: SORT_TRUSTEE_ID,
      chapter: '12',
      appointmentType: 'standing',
      courtId: '0976',
      divisionCode: '761',
      courtName: 'District of Idaho',
      courtDivisionName: 'Boise',
    }),
    createTrusteeAppointment({
      id: 'e2e-appt-sort-ia-north-ch13',
      trusteeId: SORT_TRUSTEE_ID,
      chapter: '13',
      appointmentType: 'case-by-case',
      courtId: '0862',
      divisionCode: '621',
      courtName: 'Northern District of Iowa',
      courtDivisionName: 'Cedar Rapids',
    }),
    createTrusteeAppointment({
      id: 'e2e-appt-sort-ia-south-ch13',
      trusteeId: SORT_TRUSTEE_ID,
      chapter: '13',
      appointmentType: 'standing',
      courtId: '0863',
      divisionCode: '633',
      courtName: 'Southern District of Iowa',
      courtDivisionName: 'Davenport',
    }),
  );

  // ── Comprehensive/pagination/filter set ─────────────────────────────────────
  // 26 identical "filler" trustees (Chapter 7 panel, SDNY Manhattan) to force a
  // second pagination page, plus one uniquely-tagged "needle" trustee
  // (Chapter 12 standing, WDNY Buffalo -- a combo no other fixture trustee
  // shares) for a precise, single-result filter assertion.
  for (let i = 1; i <= COMP_FILLER_COUNT; i += 1) {
    const suffix = String(i).padStart(3, '0');
    // Last UUID group must stay 12 hex chars: "ffff" + 8-digit padded (100+i), e.g. ffff00000101.
    const trusteeId = `aaaabbbb-cccc-dddd-eeee-ffff${String(100 + i).padStart(8, '0')}`;
    trustees.push(
      createTrustee({
        id: `e2e-trustee-comp-filler-${suffix}`,
        trusteeId,
        firstName: 'E2e',
        lastName: `Zzz${suffix}Filler`,
      }),
    );
    trusteeAppointments.push(
      createTrusteeAppointment({
        id: `e2e-appt-comp-filler-${suffix}`,
        trusteeId,
        chapter: '7',
        appointmentType: 'panel',
        courtId: '0208',
        divisionCode: '081',
        courtName: 'Southern District of New York',
        courtDivisionName: 'Manhattan',
      }),
    );
  }

  trustees.push(
    createTrustee({
      id: 'e2e-trustee-comp-needle',
      trusteeId: COMP_NEEDLE_TRUSTEE_ID,
      firstName: 'E2e',
      lastName: 'AabCompNeedle',
    }),
  );
  trusteeAppointments.push(
    createTrusteeAppointment({
      id: 'e2e-appt-comp-needle',
      trusteeId: COMP_NEEDLE_TRUSTEE_ID,
      chapter: '12',
      appointmentType: 'standing',
      courtId: '0209',
      divisionCode: '091',
      courtName: 'Western District of New York',
      courtDivisionName: 'Buffalo',
    }),
  );

  // ── CAMS-846 filter-conjunction regression: "Split Trustee" ────────────────
  // Two appointments that each individually satisfy one half of a filter combo
  // but should not, together, make the trustee match the combo's conjunction.
  trustees.push(
    createTrustee({
      id: 'e2e-trustee-split-conjunction',
      trusteeId: SPLIT_TRUSTEE_ID,
      firstName: 'E2e',
      lastName: 'AacSplitConjunction',
    }),
  );
  trusteeAppointments.push(
    createTrusteeAppointment({
      id: 'e2e-appt-split-ch7-sacramento',
      trusteeId: SPLIT_TRUSTEE_ID,
      chapter: '7',
      appointmentType: 'panel',
      courtId: '0972',
      divisionCode: '722',
      courtName: 'Eastern District of California',
      courtDivisionName: 'Sacramento',
    }),
    createTrusteeAppointment({
      id: 'e2e-appt-split-ch13-manhattan',
      trusteeId: SPLIT_TRUSTEE_ID,
      chapter: '13',
      appointmentType: 'standing',
      courtId: '0208',
      divisionCode: '081',
      courtName: 'Southern District of New York',
      courtDivisionName: 'Manhattan',
    }),
  );

  // ── Trustee Case List: paginated + empty trustees ──────────────────────────
  // Deliberately have NO trustee-appointments doc -- these trustees are reached
  // by navigating directly to /trustees/<trusteeId>, not via the main list, so
  // they don't affect main-list pagination/filter counts.
  trustees.push(
    createTrustee({
      id: 'e2e-trustee-caselist-paginated',
      trusteeId: CASE_LIST_PAGINATED_TRUSTEE_ID,
      firstName: 'E2e',
      lastName: 'CaseListPaginated',
    }),
    createTrustee({
      id: 'e2e-trustee-caselist-empty',
      trusteeId: CASE_LIST_EMPTY_TRUSTEE_ID,
      firstName: 'E2e',
      lastName: 'CaseListEmpty',
    }),
  );

  const CASE_LIST_TOTAL = 30;
  for (let i = 0; i < CASE_LIST_TOTAL; i += 1) {
    const suffix = String(i + 1).padStart(3, '0');
    const caseId = `081-24-9${String(i).padStart(4, '0')}`;
    const dateFiled = `2024-01-${String(i + 1).padStart(2, '0')}`;

    caseAppointments.push(
      createCaseAppointment({
        id: `e2e-case-appt-${suffix}`,
        trusteeId: CASE_LIST_PAGINATED_TRUSTEE_ID,
        caseId,
        dateFiled,
        chapter: '7',
        courtDivisionCode: '081',
      }),
    );
    cases.push(
      createSyncedCase({
        caseId,
        caseTitle: `E2E Trustee Case List Test Case ${suffix}`,
        courtDivisionName: 'Manhattan',
        courtId: '0208',
        chapter: '7',
        dateFiled,
      }),
    );
  }

  return { trustees, trusteeAppointments, caseAppointments, cases };
}
