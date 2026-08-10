/**
 * Scenario: trustee-filter-conjunction
 * Database: cams only
 *
 * Seeds a trustee whose two appointments satisfy different filter criteria,
 * demonstrating the CAMS-846 conjunctive filter bug and verifying its fix.
 *
 *   - "Split Trustee" (cams-846-split) has TWO appointments:
 *       Appointment A: Chapter 7  — District of Colorado (Denver, 082)
 *       Appointment B: Chapter 13 — Southern District of New York (Manhattan, 081)
 *
 * To see the bug (pre-fix): apply Chapter 7 + SDNY Manhattan — the trustee
 * appears with a blank row because filterTrustees passed (Ch7 via Appt A,
 * Manhattan via Appt B) but filterAppointments stripped both rows.
 *
 * To verify the fix: apply the same filters — the trustee is excluded entirely.
 *
 * Filter instructions:
 *   Status:            Active
 *   District/Division: Southern District of New York (Manhattan)
 *   Chapter:           Chapter 7
 *
 * Expected result (after fix): "Split Trustee" does NOT appear.
 * Expected result (pre-fix):   "Split Trustee" appears with blank columns.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import { createTrusteeBase } from '../lib/test-data-utils.js';

const SPLIT_TRUSTEE_ID = 'cams-846-split';
const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };
const NOW = '2026-01-01T00:00:00.000Z';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function generate(_ctx: SeedContext): Promise<SeedOperation[]> {
  return [
    // ── Trustee ───────────────────────────────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: SPLIT_TRUSTEE_ID,
            firstName: 'Split',
            lastName: 'Trustee',
            status: 'active',
            address1: '100 Conjunction Ave',
            city: 'Denver',
            state: 'CO',
            zipCode: '80202',
            phone: '303-555-0846',
            email: 'split.trustee@example.com',
          }),
          updatedOn: NOW,
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Appointment A: Chapter 7, District of Colorado (Denver 082) ───────────
    // Satisfies the Chapter 7 filter but NOT the SDNY Manhattan filter.
    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'cams-846-appt-ch7-colorado',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: SPLIT_TRUSTEE_ID,
          chapter: '7',
          appointmentType: 'panel',
          courtId: '0210',
          divisionCodes: ['082'],
          appointedDate: '2021-03-01',
          status: 'active',
          effectiveDate: '2021-03-01',
          courtName: 'U.S. Bankruptcy Court District of Colorado',
          courtDivisionName: 'Denver',
          updatedOn: NOW,
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Appointment B: Chapter 13, SDNY Manhattan (081) ──────────────────────
    // Satisfies the SDNY Manhattan filter but NOT the Chapter 7 filter.
    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'cams-846-appt-ch13-manhattan',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: SPLIT_TRUSTEE_ID,
          chapter: '13',
          appointmentType: 'standing',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2019-06-01',
          status: 'active',
          effectiveDate: '2019-06-01',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: NOW,
          updatedBy: SEEDER,
        },
      ],
    },
  ];
}
