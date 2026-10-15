/**
 * Scenario: ust-division-tn-eastern
 * Database: dxtr + cams
 *
 * Seeds test data for CAMS-936 (ustDivisionCode) in the Eastern District of
 * Tennessee (court 0649) — the only district where bare DXTR CS_DIV diverges
 * from CS_DIV_ACMS (courtDivisionCode). AO_CS_DIV/AO_OFFICE/AO_GRP_DES/
 * AO_REGION reference rows for court 0649 already exist in the shared DXTR
 * instance (real production reference data), so this scenario only seeds
 * AO_CS/AO_PY case rows plus Cosmos documents — it does not touch the office
 * tables.
 *
 * Confirmed live against sql-ustp-cams AODATEX_SUB (2026):
 *   CS_DIV | CS_DIV_ACMS | Office
 *   -------|-------------|------------
 *   491    | 491         | Chattanooga
 *   492    | 492         | Greeneville
 *   493    | 493         | Knoxville
 *   494    | 491         | Winchester    <- diverges
 *   495    | 492         | Johnson City  <- diverges
 *
 * Seeds:
 *   - Chattanooga case (491-26-99601): CS_DIV=491, caseId prefix 491.
 *     SYNCED_CASE already has ustDivisionCode='491' (simulates a
 *     forward-synced, unaffected case).
 *   - Winchester case (491-26-99602): CS_DIV=494, caseId prefix 491 (case
 *     identity/caseId is unchanged by this feature — see CAMS-936). Its
 *     SYNCED_CASE document deliberately OMITS ustDivisionCode, to exercise
 *     the TN-scoped backfill-ust-division-code dataflow — run it locally and
 *     confirm this case's SYNCED_CASE doc gets ustDivisionCode='494' added.
 *   - Knoxville case (493-26-99603): CS_DIV=493=CS_DIV_ACMS (control, no
 *     divergence). SYNCED_CASE already has ustDivisionCode='493'.
 *   - One trustee ("Eastern TN Test Trustee") with two TRUSTEE_APPOINTMENT
 *     docs — divisionCodes ['491'] (Chattanooga) and ['494'] (Winchester) —
 *     to manually verify in the admin UI that Winchester is selectable as
 *     its own division, distinct from Chattanooga, even though both share
 *     courtDivisionCode '491'.
 *   - One CASE_APPOINTMENT linking that trustee to the Winchester case.
 *
 * NOT covered here: exercising the live trustee-appointment matching
 * pipeline (sync-trustee-case-appointments) requires a real DXTR
 * "trustee appointed" transaction (AO_TX, TX_TYPE='A'/TX_CODE='TR') with a
 * fixed-width embedded date, which this scenario does not seed — that exact
 * bug (Winchester trustee matching a Chattanooga case) is covered by the
 * unit test in trustee-match.helpers.test.ts
 * ("CAMS-936: a Winchester-appointed trustee scores a district match...").
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import { ensureDxtrCase } from '../lib/ensure-dxtr-case.js';
import { createDebtor, createTrusteeBase } from '../lib/test-data-utils.js';

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };
const COURT_ID = '0649';
const GROUP_DESIGNATOR = 'CN';
const COURT_NAME = 'U.S. Bankruptcy Court Eastern District of Tennessee';
const REGION_ID = '08';
const REGION_NAME = 'ATLANTA';
const TRUSTEE_ID = 'seed-trustee-tn-eastern';

export async function generate(ctx: SeedContext): Promise<SeedOperation[]> {
  const operations: SeedOperation[] = [];
  const syncedCases: Record<string, unknown>[] = [];

  // ── Chattanooga (491/491 — no divergence) ──────────────────────────────────
  const chattanooga = await ensureDxtrCase(ctx, {
    divisionCode: '491',
    chapter: '7',
    debtorName: 'SEED Chattanooga Debtor',
    courtId: COURT_ID,
    groupDesignator: GROUP_DESIGNATOR,
    caseInfo: { caseId: '491-26-99601', caseNumber: '26-99601', csCaseId: 'SEED99601' },
  });
  operations.push(...chattanooga.operations);
  syncedCases.push({
    id: chattanooga.caseInfo.caseId,
    documentType: 'SYNCED_CASE',
    dxtrId: chattanooga.caseInfo.csCaseId,
    caseId: chattanooga.caseInfo.caseId,
    caseNumber: chattanooga.caseInfo.caseNumber,
    chapter: '7',
    caseTitle: 'SEED Chattanooga Debtor',
    dateFiled: '2026-01-15',
    officeName: 'Chattanooga',
    officeCode: '1',
    courtId: COURT_ID,
    courtName: COURT_NAME,
    courtDivisionCode: '491',
    ustDivisionCode: '491',
    courtDivisionName: 'Chattanooga',
    groupDesignator: GROUP_DESIGNATOR,
    regionId: REGION_ID,
    regionName: REGION_NAME,
    consolidation: [],
    debtor: createDebtor('SEED Chattanooga Debtor', {
      address1: '1 Chattanooga Way',
      city: 'Chattanooga',
      state: 'TN',
      zip: '37402',
      ssn: '***-**-4910',
    }),
    updatedOn: '2026-01-15T10:00:00.000Z',
    updatedBy: SEEDER,
  });

  // ── Winchester (494/491 — diverges; SYNCED_CASE omits ustDivisionCode) ─────
  const winchester = await ensureDxtrCase(ctx, {
    divisionCode: '494', // bare CS_DIV — Winchester, diverges from the caseId's courtDivisionCode
    chapter: '7',
    debtorName: 'SEED Winchester Debtor',
    courtId: COURT_ID,
    groupDesignator: GROUP_DESIGNATOR,
    // caseId prefix stays '491' (CS_DIV_ACMS) — case identity is unchanged by CAMS-936.
    caseInfo: { caseId: '491-26-99602', caseNumber: '26-99602', csCaseId: 'SEED99602' },
  });
  operations.push(...winchester.operations);
  syncedCases.push({
    id: winchester.caseInfo.caseId,
    documentType: 'SYNCED_CASE',
    dxtrId: winchester.caseInfo.csCaseId,
    caseId: winchester.caseInfo.caseId,
    caseNumber: winchester.caseInfo.caseNumber,
    chapter: '7',
    caseTitle: 'SEED Winchester Debtor',
    dateFiled: '2026-01-16',
    officeName: 'Winchester',
    officeCode: '4',
    courtId: COURT_ID,
    courtName: COURT_NAME,
    courtDivisionCode: '491',
    // ustDivisionCode intentionally omitted — run backfill-ust-division-code locally
    // and confirm this document gets ustDivisionCode: '494' added.
    courtDivisionName: 'Winchester',
    groupDesignator: GROUP_DESIGNATOR,
    regionId: REGION_ID,
    regionName: REGION_NAME,
    consolidation: [],
    debtor: createDebtor('SEED Winchester Debtor', {
      address1: '1 Winchester Way',
      city: 'Winchester',
      state: 'TN',
      zip: '37398',
      ssn: '***-**-4940',
    }),
    updatedOn: '2026-01-16T10:00:00.000Z',
    updatedBy: SEEDER,
  });

  // ── Knoxville (493/493 — control, no divergence) ───────────────────────────
  const knoxville = await ensureDxtrCase(ctx, {
    divisionCode: '493',
    chapter: '7',
    debtorName: 'SEED Knoxville Debtor',
    courtId: COURT_ID,
    groupDesignator: GROUP_DESIGNATOR,
    caseInfo: { caseId: '493-26-99603', caseNumber: '26-99603', csCaseId: 'SEED99603' },
  });
  operations.push(...knoxville.operations);
  syncedCases.push({
    id: knoxville.caseInfo.caseId,
    documentType: 'SYNCED_CASE',
    dxtrId: knoxville.caseInfo.csCaseId,
    caseId: knoxville.caseInfo.caseId,
    caseNumber: knoxville.caseInfo.caseNumber,
    chapter: '7',
    caseTitle: 'SEED Knoxville Debtor',
    dateFiled: '2026-01-17',
    officeName: 'Knoxville',
    officeCode: '3',
    courtId: COURT_ID,
    courtName: COURT_NAME,
    courtDivisionCode: '493',
    ustDivisionCode: '493',
    courtDivisionName: 'Knoxville',
    groupDesignator: GROUP_DESIGNATOR,
    regionId: REGION_ID,
    regionName: REGION_NAME,
    consolidation: [],
    debtor: createDebtor('SEED Knoxville Debtor', {
      address1: '1 Knoxville Way',
      city: 'Knoxville',
      state: 'TN',
      zip: '37902',
      ssn: '***-**-4930',
    }),
    updatedOn: '2026-01-17T10:00:00.000Z',
    updatedBy: SEEDER,
  });

  operations.push({ db: 'cams', collectionOrTable: 'cases', data: syncedCases });

  // ── Trustee appointed to Chattanooga and Winchester as distinct divisions ──
  operations.push({
    db: 'cams',
    collectionOrTable: 'trustees',
    data: [
      {
        ...createTrusteeBase({
          id: TRUSTEE_ID,
          firstName: 'Eastern TN',
          lastName: 'Test Trustee',
          status: 'active',
          address1: '1 Trustee Row',
          city: 'Chattanooga',
          state: 'TN',
          zipCode: '37402',
          phone: '423-555-0100',
          email: 'eastern.tn.test.trustee@example.com',
        }),
        updatedOn: '2026-01-15T00:00:00.000Z',
        updatedBy: SEEDER,
      },
    ],
  });

  operations.push({
    db: 'cams',
    collectionOrTable: 'trustee-appointments',
    data: [
      {
        id: 'seed-tn-eastern-trustee-appt-chattanooga',
        documentType: 'TRUSTEE_APPOINTMENT',
        trusteeId: TRUSTEE_ID,
        chapter: '7',
        appointmentType: 'panel',
        courtId: COURT_ID,
        divisionCodes: ['491'],
        appointedDate: '2026-01-01',
        status: 'active',
        effectiveDate: '2026-01-01',
        courtName: COURT_NAME,
        courtDivisionName: 'Chattanooga',
        createdOn: '2026-01-01T00:00:00.000Z',
        createdBy: SEEDER,
        updatedOn: '2026-01-01T00:00:00.000Z',
        updatedBy: SEEDER,
      },
      {
        id: 'seed-tn-eastern-trustee-appt-winchester',
        documentType: 'TRUSTEE_APPOINTMENT',
        trusteeId: TRUSTEE_ID,
        chapter: '7',
        appointmentType: 'panel',
        courtId: COURT_ID,
        // ustDivisionCode-valued, per migrate-trustees.ts's buildDistrictToDivisionsMap fix —
        // this is what makes Winchester selectable distinctly from Chattanooga above.
        divisionCodes: ['494'],
        appointedDate: '2026-01-01',
        status: 'active',
        effectiveDate: '2026-01-01',
        courtName: COURT_NAME,
        courtDivisionName: 'Winchester',
        createdOn: '2026-01-01T00:00:00.000Z',
        createdBy: SEEDER,
        updatedOn: '2026-01-01T00:00:00.000Z',
        updatedBy: SEEDER,
      },
    ],
  });

  // ── Case appointment linking the trustee to the Winchester case ────────────
  const winchesterAppointment = {
    id: 'seed-tn-eastern-case-appt-winchester',
    documentType: 'CASE_APPOINTMENT',
    caseId: winchester.caseInfo.caseId,
    trusteeId: TRUSTEE_ID,
    assignedOn: '2026-01-16T00:00:00Z',
    appointedDate: '2026-01-16',
    dateFiled: '2026-01-16',
    chapter: '7',
    courtDivisionCode: '491',
    caseStatus: 'OPEN',
    source: 'dxtr',
    createdOn: '2026-01-16T00:00:00.000Z',
    createdBy: SEEDER,
    updatedOn: '2026-01-16T00:00:00.000Z',
    updatedBy: SEEDER,
  };
  operations.push({
    db: 'cams',
    collectionOrTable: 'case-trustee-appointments',
    data: [winchesterAppointment],
  });
  operations.push({
    db: 'cams',
    collectionOrTable: 'trustee-case-appointments',
    data: [winchesterAppointment],
  });

  return operations;
}
