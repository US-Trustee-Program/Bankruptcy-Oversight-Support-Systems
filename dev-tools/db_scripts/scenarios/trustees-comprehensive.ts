/**
 * Scenario: trustees-comprehensive
 * Database: cams only
 *
 * Seeds 32 trustees with comprehensive coverage for testing trustee filtering and multi-division support:
 *
 * Geographic Distribution:
 *   - New York (081 Manhattan, 091 Manhattan): 32 trustees
 *     - Uses only division codes 081 and 091 (confirmed in DXTR)
 *     - These are the only codes guaranteed to resolve to proper division names
 *
 * Chapter Coverage:
 *   - Chapter 7 (panel): 11 trustees
 *   - Chapter 11 (panel): 6 trustees
 *   - Chapter 12 (standing): 3 trustees
 *   - Chapter 13 (standing): 9 trustees
 *   - Chapter 11 Subchapter V (panel): 3 trustees
 *
 * Multi-Division Support (CAMS-740):
 *   - Single-division appointments (29 trustees)
 *   - Multi-division appointments (3 trustees):
 *     - Patricia Manhattan: divisions 081, 091
 *     - William T Statewide: divisions 081, 091
 *     - Patricia Ann Statewide: divisions 081, 091
 *   - Mix of active and inactive statuses
 *
 * NOTE: Uses CAMS-only seeding pattern - no DXTR seeding required.
 * NOTE: All trustees use Manhattan (NY) divisions 081/091 since these are known valid codes.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import { faker } from '@faker-js/faker';
import { generateSearchTokens } from '../lib/phonetic-tokens.js';

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };

// Helper to create trustee with phonetic tokens
function createTrustee(opts: {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  status: 'active' | 'inactive';
  state: string;
  city: string;
  zoomInfo?: {
    link: string;
    phone: string;
    meetingId: string;
    passcode: string;
    accountEmail?: string;
  };
  banks?: string[];
  softwareId?: string;
}) {
  const name = opts.middleName
    ? `${opts.firstName} ${opts.middleName} ${opts.lastName}`
    : `${opts.firstName} ${opts.lastName}`;

  const trustee: Record<string, unknown> = {
    id: opts.id,
    documentType: 'TRUSTEE',
    trusteeId: opts.id,
    name,
    firstName: opts.firstName,
    lastName: opts.lastName,
    status: opts.status,
    phoneticTokens: generateSearchTokens(name),
    public: {
      address: {
        address1: faker.location.streetAddress(),
        city: opts.city,
        state: opts.state,
        zipCode: faker.location.zipCode(),
        countryCode: 'US',
      },
      phone: { number: faker.phone.number() },
      email: faker.internet.email(),
    },
    updatedOn: '2025-03-01T00:00:00.000Z',
    updatedBy: SEEDER,
  };

  // Only include middleName if it's defined
  if (opts.middleName) {
    trustee.middleName = opts.middleName;
  }

  // Include zoomInfo if provided
  if (opts.zoomInfo) {
    trustee.zoomInfo = opts.zoomInfo;
  }

  // Include banks and software if provided
  if (opts.banks && opts.banks.length > 0) {
    trustee.banks = opts.banks;
  }
  if (opts.softwareId) {
    trustee.softwareId = opts.softwareId;
  }

  return trustee;
}

// Helper to create appointment
function createAppointment(opts: {
  id: string;
  trusteeId: string;
  chapter: string;
  appointmentType: 'panel' | 'standing' | 'off-panel' | 'case-by-case';
  courtId: string;
  divisionCodes: string[];
  courtName: string;
  courtDivisionName: string;
  status: 'active' | 'inactive';
}) {
  const appointment: Record<string, unknown> = {
    id: opts.id,
    documentType: 'TRUSTEE_APPOINTMENT',
    trusteeId: opts.trusteeId,
    chapter: opts.chapter,
    appointmentType: opts.appointmentType,
    courtId: opts.courtId,
    divisionCodes: opts.divisionCodes,
    appointedDate: '2020-01-01',
    status: opts.status,
    effectiveDate: '2020-01-01',
    courtName: opts.courtName,
    courtDivisionName: opts.courtDivisionName,
    updatedOn: '2025-03-01T00:00:00.000Z',
    updatedBy: SEEDER,
  };

  // Include deprecated divisionCode field for backward compatibility
  // Use first division code if single division, undefined if multiple
  if (opts.divisionCodes.length === 1) {
    appointment.divisionCode = opts.divisionCodes[0];
  }

  return appointment;
}

export async function generate(_ctx: SeedContext): Promise<SeedOperation[]> {
  const trustees = [];
  const appointments = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // Additional Trustees (using Manhattan divisions 081/091)
  // ═══════════════════════════════════════════════════════════════════════════

  // Additional-1: Ch7 Panel, Single Division (081)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-001',
      firstName: 'Emma',
      lastName: 'Frostberg',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-001-ch7',
      trusteeId: 'seed-trustee-add-001',
      chapter: '7',
      appointmentType: 'panel',
      courtId: '0208',
      divisionCodes: ['081'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // Additional-2: Ch13 Standing, Single Division (091)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-002',
      firstName: 'Marcus',
      lastName: 'Snowden',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-002-ch13',
      trusteeId: 'seed-trustee-add-002',
      chapter: '13',
      appointmentType: 'standing',
      courtId: '0209',
      divisionCodes: ['091'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // Additional-3: Ch11 Panel, Single Division (081)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-003',
      firstName: 'Sarah',
      middleName: 'Lynn',
      lastName: 'Glacier',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-003-ch11',
      trusteeId: 'seed-trustee-add-003',
      chapter: '11',
      appointmentType: 'panel',
      courtId: '0208',
      divisionCodes: ['081'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // Additional-4: Ch7 Panel, Inactive (091)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-004',
      firstName: 'David',
      lastName: 'Winterhaven',
      status: 'inactive',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-004-ch7',
      trusteeId: 'seed-trustee-add-004',
      chapter: '7',
      appointmentType: 'panel',
      courtId: '0209',
      divisionCodes: ['091'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'inactive',
    }),
  );

  // Additional-5: Ch12 Standing (081)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-005',
      firstName: 'Jennifer',
      lastName: 'Tundra',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-005-ch12',
      trusteeId: 'seed-trustee-add-005',
      chapter: '12',
      appointmentType: 'standing',
      courtId: '0208',
      divisionCodes: ['081'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW YORK - Manhattan (081, 091) - 8 Trustees
  // ═══════════════════════════════════════════════════════════════════════════

  // NY-1: Ch7 Panel, Single Division (081) - with bank and software
  trustees.push(
    createTrustee({
      id: 'seed-trustee-ny-001',
      firstName: 'Michael',
      middleName: 'James',
      lastName: 'Brooklyn',
      status: 'active',
      state: 'NY',
      city: 'New York',
      banks: ['seed-bank-active-001'],
      softwareId: 'seed-software-active-001',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-ny-001-ch7',
      trusteeId: 'seed-trustee-ny-001',
      chapter: '7',
      appointmentType: 'panel',
      courtId: '0208',
      divisionCodes: ['081'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // NY-2: Multi-appointment trustee for testing 4-level sorting (state, region, chapter, type)
  // Using REAL court IDs and divisions from DXTR!
  // Expected sort order demonstrates ALL 4 sorting levels:
  // 1. CA Eastern Ch7 off-panel (state: California before Idaho)
  // 2. CA Eastern Ch7 panel (same state/region/chapter, type: off-panel < panel)
  // 3. CA Northern Ch11 case-by-case (same state, region: Eastern < Northern)
  // 4. ID District Ch12 standing (state: Idaho before Iowa, single-district state)
  // 5. IA Northern Ch13 case-by-case (state: Iowa after Idaho)
  // 6. IA Southern Ch13 standing (same state, region: Northern < Southern)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-ny-002',
      firstName: 'Patricia',
      lastName: 'Manhattan',
      status: 'active',
      state: 'NY',
      city: 'New York',
      zoomInfo: {
        link: 'https://zoom.us/j/9876543210',
        phone: '+1 646 558 8656',
        meetingId: '987 6543 2100',
        passcode: 'patricia456',
        accountEmail: 'patricia.manhattan@example.com',
      },
    }),
  );

  // California appointments (state: CA before ID)
  appointments.push(
    // CA Eastern Ch7 off-panel
    createAppointment({
      id: 'seed-appt-ny-002-ca-east-ch7-offpanel',
      trusteeId: 'seed-trustee-ny-002',
      chapter: '7',
      appointmentType: 'off-panel',
      courtId: '0972',
      divisionCodes: ['722'],
      courtName: 'Eastern District of California',
      courtDivisionName: 'Sacramento',
      status: 'active',
    }),
    // CA Eastern Ch7 panel (type: off-panel < panel)
    createAppointment({
      id: 'seed-appt-ny-002-ca-east-ch7-panel',
      trusteeId: 'seed-trustee-ny-002',
      chapter: '7',
      appointmentType: 'panel',
      courtId: '0972',
      divisionCodes: ['722'],
      courtName: 'Eastern District of California',
      courtDivisionName: 'Sacramento',
      status: 'active',
    }),
    // CA Northern Ch11 case-by-case (region: Eastern < Northern)
    createAppointment({
      id: 'seed-appt-ny-002-ca-north-ch11',
      trusteeId: 'seed-trustee-ny-002',
      chapter: '11',
      appointmentType: 'case-by-case',
      courtId: '0971',
      divisionCodes: ['713'],
      courtName: 'Northern District of California',
      courtDivisionName: 'San Francisco',
      status: 'active',
    }),
  );

  // Idaho appointment (state: ID after CA, before IA)
  appointments.push(
    createAppointment({
      id: 'seed-appt-ny-002-id-district-ch12',
      trusteeId: 'seed-trustee-ny-002',
      chapter: '12',
      appointmentType: 'standing',
      courtId: '0976',
      divisionCodes: ['761'],
      courtName: 'District of Idaho',
      courtDivisionName: 'Boise',
      status: 'active',
    }),
  );

  // Iowa appointments (state: IA after ID)
  appointments.push(
    // IA Northern Ch13 case-by-case
    createAppointment({
      id: 'seed-appt-ny-002-ia-north-ch13',
      trusteeId: 'seed-trustee-ny-002',
      chapter: '13',
      appointmentType: 'case-by-case',
      courtId: '0862',
      divisionCodes: ['621'],
      courtName: 'Northern District of Iowa',
      courtDivisionName: 'Cedar Rapids',
      status: 'active',
    }),
    // IA Southern Ch13 standing (region: Northern < Southern)
    createAppointment({
      id: 'seed-appt-ny-002-ia-south-ch13',
      trusteeId: 'seed-trustee-ny-002',
      chapter: '13',
      appointmentType: 'standing',
      courtId: '0863',
      divisionCodes: ['633'],
      courtName: 'Southern District of Iowa',
      courtDivisionName: 'Davenport',
      status: 'active',
    }),
  );

  // NY-3: Ch11 Panel, Single Division (091)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-ny-003',
      firstName: 'Robert',
      lastName: 'Hudson',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-ny-003-ch11',
      trusteeId: 'seed-trustee-ny-003',
      chapter: '11',
      appointmentType: 'panel',
      courtId: '0209',
      divisionCodes: ['091'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // NY-4: Ch7 Panel, Single Division (081)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-ny-004',
      firstName: 'Linda',
      lastName: 'Queens',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-ny-004-ch7',
      trusteeId: 'seed-trustee-ny-004',
      chapter: '7',
      appointmentType: 'panel',
      courtId: '0208',
      divisionCodes: ['081'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // NY-5: Ch13 Standing, Single Division (091)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-ny-005',
      firstName: 'William',
      lastName: 'Bronx',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-ny-005-ch13',
      trusteeId: 'seed-trustee-ny-005',
      chapter: '13',
      appointmentType: 'standing',
      courtId: '0209',
      divisionCodes: ['091'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // NY-6: Ch11 Subchapter V Panel
  trustees.push(
    createTrustee({
      id: 'seed-trustee-ny-006',
      firstName: 'Elizabeth',
      middleName: 'Ann',
      lastName: 'Harlem',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-ny-006-ch11v',
      trusteeId: 'seed-trustee-ny-006',
      chapter: '11-subchapter-v',
      appointmentType: 'panel',
      courtId: '0208',
      divisionCodes: ['081'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // NY-7: Ch7 Panel, Inactive
  trustees.push(
    createTrustee({
      id: 'seed-trustee-ny-007',
      firstName: 'James',
      lastName: 'Staten',
      status: 'inactive',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-ny-007-ch7',
      trusteeId: 'seed-trustee-ny-007',
      chapter: '7',
      appointmentType: 'panel',
      courtId: '0208',
      divisionCodes: ['081'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'inactive',
    }),
  );

  // NY-8: Ch11 Panel
  trustees.push(
    createTrustee({
      id: 'seed-trustee-ny-008',
      firstName: 'Barbara',
      lastName: 'Riverside',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-ny-008-ch11',
      trusteeId: 'seed-trustee-ny-008',
      chapter: '11',
      appointmentType: 'panel',
      courtId: '0209',
      divisionCodes: ['091'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Additional Trustees continued (using Manhattan divisions 081/091)
  // ═══════════════════════════════════════════════════════════════════════════

  // Additional-6: Ch7 Panel (081)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-006',
      firstName: 'Christopher',
      lastName: 'Longhorn',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-006-ch7',
      trusteeId: 'seed-trustee-add-006',
      chapter: '7',
      appointmentType: 'panel',
      courtId: '0208',
      divisionCodes: ['081'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // Additional-7: Ch13 Standing (091)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-007',
      firstName: 'Mary',
      middleName: 'Ellen',
      lastName: 'Maverick',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-007-ch13',
      trusteeId: 'seed-trustee-add-007',
      chapter: '13',
      appointmentType: 'standing',
      courtId: '0209',
      divisionCodes: ['091'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // Additional-8: Ch11 Panel (081)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-008',
      firstName: 'Daniel',
      lastName: 'Ranger',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-008-ch11',
      trusteeId: 'seed-trustee-add-008',
      chapter: '11',
      appointmentType: 'panel',
      courtId: '0208',
      divisionCodes: ['081'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // Additional-9: Ch7 Panel (091)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-009',
      firstName: 'Nancy',
      lastName: 'Bluebonnet',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-009-ch7',
      trusteeId: 'seed-trustee-add-009',
      chapter: '7',
      appointmentType: 'panel',
      courtId: '0209',
      divisionCodes: ['091'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // Additional-10: Ch12 Standing (081)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-010',
      firstName: 'Steven',
      lastName: 'Cowboy',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-010-ch12',
      trusteeId: 'seed-trustee-add-010',
      chapter: '12',
      appointmentType: 'standing',
      courtId: '0208',
      divisionCodes: ['081'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // Additional-11: Ch13 Standing (091)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-011',
      firstName: 'Karen',
      lastName: 'Armadillo',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-011-ch13',
      trusteeId: 'seed-trustee-add-011',
      chapter: '13',
      appointmentType: 'standing',
      courtId: '0209',
      divisionCodes: ['091'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Additional Trustees continued (using Manhattan divisions 081/091)
  // ═══════════════════════════════════════════════════════════════════════════

  // Additional-12: Ch7 Panel (081)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-012',
      firstName: 'Richard',
      lastName: 'Sunshine',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-012-ch7',
      trusteeId: 'seed-trustee-add-012',
      chapter: '7',
      appointmentType: 'panel',
      courtId: '0208',
      divisionCodes: ['081'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // Additional-13: Ch13 Standing (091)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-013',
      firstName: 'Susan',
      middleName: 'Marie',
      lastName: 'Pacific',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-013-ch13',
      trusteeId: 'seed-trustee-add-013',
      chapter: '13',
      appointmentType: 'standing',
      courtId: '0209',
      divisionCodes: ['091'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // Additional-14: Ch11 Panel (081)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-014',
      firstName: 'Joseph',
      lastName: 'Hollywood',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-014-ch11',
      trusteeId: 'seed-trustee-add-014',
      chapter: '11',
      appointmentType: 'panel',
      courtId: '0208',
      divisionCodes: ['081'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // Additional-15: Ch7 Panel (091)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-015',
      firstName: 'Jessica',
      lastName: 'Beachside',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-015-ch7',
      trusteeId: 'seed-trustee-add-015',
      chapter: '7',
      appointmentType: 'panel',
      courtId: '0209',
      divisionCodes: ['091'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // Additional-16: Ch11 Subchapter V Panel (081)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-016',
      firstName: 'Thomas',
      lastName: 'Golden',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-016-ch11v',
      trusteeId: 'seed-trustee-add-016',
      chapter: '11-subchapter-v',
      appointmentType: 'panel',
      courtId: '0208',
      divisionCodes: ['081'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // Additional-17: Ch13 Standing, Inactive (091)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-017',
      firstName: 'Margaret',
      lastName: 'Sunset',
      status: 'inactive',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-017-ch13',
      trusteeId: 'seed-trustee-add-017',
      chapter: '13',
      appointmentType: 'standing',
      courtId: '0209',
      divisionCodes: ['091'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'inactive',
    }),
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Additional Trustees continued (using Manhattan divisions 081/091)
  // ═══════════════════════════════════════════════════════════════════════════

  // Additional-18: Ch7 Panel (081)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-018',
      firstName: 'Charles',
      lastName: 'Palmetto',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-018-ch7',
      trusteeId: 'seed-trustee-add-018',
      chapter: '7',
      appointmentType: 'panel',
      courtId: '0208',
      divisionCodes: ['081'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // Additional-19: Ch13 Standing (091)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-019',
      firstName: 'Dorothy',
      middleName: 'Lee',
      lastName: 'Sunshine',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-019-ch13',
      trusteeId: 'seed-trustee-add-019',
      chapter: '13',
      appointmentType: 'standing',
      courtId: '0209',
      divisionCodes: ['091'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // Additional-20: Ch11 Panel (081)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-020',
      firstName: 'Edward',
      lastName: 'Seabreeze',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-020-ch11',
      trusteeId: 'seed-trustee-add-020',
      chapter: '11',
      appointmentType: 'panel',
      courtId: '0208',
      divisionCodes: ['081'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // Additional-21: Ch12 Standing (091)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-021',
      firstName: 'Helen',
      lastName: 'Citrus',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-021-ch12',
      trusteeId: 'seed-trustee-add-021',
      chapter: '12',
      appointmentType: 'standing',
      courtId: '0209',
      divisionCodes: ['091'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // Additional-22: Ch11 Subchapter V Panel (081)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-022',
      firstName: 'George',
      lastName: 'Manatee',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-022-ch11v',
      trusteeId: 'seed-trustee-add-022',
      chapter: '11-subchapter-v',
      appointmentType: 'panel',
      courtId: '0208',
      divisionCodes: ['081'],
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Additional Multi-Division Examples (CAMS-740 testing)
  // ═══════════════════════════════════════════════════════════════════════════

  // Note: Patricia Manhattan (NY-2) already has multi-division (081, 091)
  // Adding 2 more multi-division examples

  // Additional-23: Ch7 Panel across Manhattan divisions (081, 091)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-023',
      firstName: 'William',
      middleName: 'T',
      lastName: 'Statewide',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-023-ch7',
      trusteeId: 'seed-trustee-add-023',
      chapter: '7',
      appointmentType: 'panel',
      courtId: '0208',
      divisionCodes: ['081', '091'], // Multiple divisions
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // Additional-24: Ch13 Standing across Manhattan divisions (081, 091)
  trustees.push(
    createTrustee({
      id: 'seed-trustee-add-024',
      firstName: 'Patricia',
      middleName: 'Ann',
      lastName: 'Statewide',
      status: 'active',
      state: 'NY',
      city: 'New York',
    }),
  );
  appointments.push(
    createAppointment({
      id: 'seed-appt-add-024-ch13',
      trusteeId: 'seed-trustee-add-024',
      chapter: '13',
      appointmentType: 'standing',
      courtId: '0209',
      divisionCodes: ['081', '091'], // Multiple divisions
      courtName: 'U.S. Bankruptcy Court Southern District of New York',
      courtDivisionName: 'Manhattan',
      status: 'active',
    }),
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Return Operations
  // ═══════════════════════════════════════════════════════════════════════════

  return [
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: trustees,
    },
    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: appointments,
    },
  ];
}
