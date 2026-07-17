/**
 * Scenario: trustee-staff
 * Database: cams only
 *
 * Seeds trustee staff data to exercise trustee staff management features:
 *
 *   - Trustees with 0 staff (empty state)
 *   - Trustees with 1 staff member
 *   - Trustees with 2 staff
 *   - Trustees with 3 staff
 *
 * NOTE: Staff are separate documents with documentType='TRUSTEE_STAFF'.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import { faker } from '@faker-js/faker';
import { fakeUsPhoneNumber, createTrusteeBase } from '../lib/test-data-utils.js';

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };

export async function generate(_ctx: SeedContext): Promise<SeedOperation[]> {
  return [
    // ── Cosmos: Trustee with 1 staff member ─────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-1-staff',
            firstName: 'Emma',
            lastName: 'Singlestaff',
            status: 'active',
            address1: '100 Staff Lane',
            city: 'New York',
            state: 'NY',
            zipCode: '10001',
            phone: '212-555-0100',
            email: 'emma.singlestaff@example.com',
          }),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-staff-001',
          documentType: 'TRUSTEE_STAFF',
          trusteeId: 'seed-trustee-1-staff',
          name: faker.person.fullName(),
          contact: {
            address: {
              address1: faker.location.streetAddress(),
              city: faker.location.city(),
              state: faker.location.state({ abbreviated: true }),
              zipCode: faker.location.zipCode(),
              countryCode: 'US',
            },
            phone: {
              number: fakeUsPhoneNumber(),
            },
            email: faker.internet.email(),
          },
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Another trustee with 1 staff member ─────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-1-staff-b',
            firstName: 'Liam',
            lastName: 'Singlestaff',
            status: 'active',
            address1: '200 Staff Blvd',
            city: 'New York',
            state: 'NY',
            zipCode: '10002',
            phone: '212-555-0200',
            email: 'liam.singlestaff@example.com',
          }),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-staff-002',
          documentType: 'TRUSTEE_STAFF',
          trusteeId: 'seed-trustee-1-staff-b',
          name: faker.person.fullName(),
          contact: {
            address: {
              address1: faker.location.streetAddress(),
              city: faker.location.city(),
              state: faker.location.state({ abbreviated: true }),
              zipCode: faker.location.zipCode(),
              countryCode: 'US',
            },
            phone: {
              number: fakeUsPhoneNumber(),
            },
            email: faker.internet.email(),
          },
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Trustee with 2 staff ────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-2-staff',
            firstName: 'Olivia',
            lastName: 'Twostaff',
            status: 'active',
            address1: '300 Staff Ave',
            city: 'New York',
            state: 'NY',
            zipCode: '10003',
            phone: '212-555-0300',
            email: 'olivia.twostaff@example.com',
          }),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-staff-003',
          documentType: 'TRUSTEE_STAFF',
          trusteeId: 'seed-trustee-2-staff',
          name: faker.person.fullName(),
          contact: {
            address: {
              address1: faker.location.streetAddress(),
              city: faker.location.city(),
              state: faker.location.state({ abbreviated: true }),
              zipCode: faker.location.zipCode(),
              countryCode: 'US',
            },
            phone: {
              number: fakeUsPhoneNumber(),
            },
            email: faker.internet.email(),
          },
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
        {
          id: 'seed-staff-004',
          documentType: 'TRUSTEE_STAFF',
          trusteeId: 'seed-trustee-2-staff',
          name: faker.person.fullName(),
          contact: {
            address: {
              address1: faker.location.streetAddress(),
              city: faker.location.city(),
              state: faker.location.state({ abbreviated: true }),
              zipCode: faker.location.zipCode(),
              countryCode: 'US',
            },
            phone: {
              number: fakeUsPhoneNumber(),
            },
            email: faker.internet.email(),
          },
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Another trustee with 2 staff ────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-2-staff-b',
            firstName: 'Noah',
            lastName: 'Twostaff',
            status: 'active',
            address1: '400 Staff St',
            city: 'New York',
            state: 'NY',
            zipCode: '10004',
            phone: '212-555-0400',
            email: 'noah.twostaff@example.com',
          }),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-staff-005',
          documentType: 'TRUSTEE_STAFF',
          trusteeId: 'seed-trustee-2-staff-b',
          name: faker.person.fullName(),
          contact: {
            address: {
              address1: faker.location.streetAddress(),
              city: faker.location.city(),
              state: faker.location.state({ abbreviated: true }),
              zipCode: faker.location.zipCode(),
              countryCode: 'US',
            },
            phone: {
              number: fakeUsPhoneNumber(),
            },
            email: faker.internet.email(),
          },
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
        {
          id: 'seed-staff-006',
          documentType: 'TRUSTEE_STAFF',
          trusteeId: 'seed-trustee-2-staff-b',
          name: faker.person.fullName(),
          contact: {
            address: {
              address1: faker.location.streetAddress(),
              city: faker.location.city(),
              state: faker.location.state({ abbreviated: true }),
              zipCode: faker.location.zipCode(),
              countryCode: 'US',
            },
            phone: {
              number: fakeUsPhoneNumber(),
            },
            email: faker.internet.email(),
          },
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Trustee with 3 staff ────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-3-staff',
            firstName: 'Sophia',
            lastName: 'Threestaff',
            status: 'active',
            address1: '500 Staff Dr',
            city: 'New York',
            state: 'NY',
            zipCode: '10005',
            phone: '212-555-0500',
            email: 'sophia.threestaff@example.com',
          }),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-staff-007',
          documentType: 'TRUSTEE_STAFF',
          trusteeId: 'seed-trustee-3-staff',
          name: faker.person.fullName(),
          contact: {
            address: {
              address1: faker.location.streetAddress(),
              city: faker.location.city(),
              state: faker.location.state({ abbreviated: true }),
              zipCode: faker.location.zipCode(),
              countryCode: 'US',
            },
            phone: {
              number: fakeUsPhoneNumber(),
            },
            email: faker.internet.email(),
          },
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
        {
          id: 'seed-staff-008',
          documentType: 'TRUSTEE_STAFF',
          trusteeId: 'seed-trustee-3-staff',
          name: faker.person.fullName(),
          contact: {
            address: {
              address1: faker.location.streetAddress(),
              city: faker.location.city(),
              state: faker.location.state({ abbreviated: true }),
              zipCode: faker.location.zipCode(),
              countryCode: 'US',
            },
            phone: {
              number: fakeUsPhoneNumber(),
            },
            email: faker.internet.email(),
          },
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
        {
          id: 'seed-staff-009',
          documentType: 'TRUSTEE_STAFF',
          trusteeId: 'seed-trustee-3-staff',
          name: faker.person.fullName(),
          contact: {
            address: {
              address1: faker.location.streetAddress(),
              city: faker.location.city(),
              state: faker.location.state({ abbreviated: true }),
              zipCode: faker.location.zipCode(),
              countryCode: 'US',
            },
            phone: {
              number: fakeUsPhoneNumber(),
            },
            email: faker.internet.email(),
          },
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Trustee with 0 staff (empty state) ──────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-0-staff',
            firstName: 'Ethan',
            lastName: 'Nostaff',
            status: 'active',
            address1: '600 Staff Rd',
            city: 'New York',
            state: 'NY',
            zipCode: '10006',
            phone: '212-555-0600',
            email: 'ethan.nostaff@example.com',
          }),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Another trustee with 0 staff ────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-0-staff-b',
            firstName: 'Ava',
            lastName: 'Nostaff',
            status: 'active',
            address1: '700 Staff Way',
            city: 'New York',
            state: 'NY',
            zipCode: '10007',
            phone: '212-555-0700',
            email: 'ava.nostaff@example.com',
          }),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Trustee appointments — makes all staff trustees appear active ──
    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appt-1-staff',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-1-staff',
          chapter: '7',
          appointmentType: 'panel',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2020-01-01',
          status: 'active',
          effectiveDate: '2020-01-01',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
        {
          id: 'seed-appt-1-staff-b',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-1-staff-b',
          chapter: '7',
          appointmentType: 'panel',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2020-01-01',
          status: 'active',
          effectiveDate: '2020-01-01',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
        {
          id: 'seed-appt-2-staff',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-2-staff',
          chapter: '7',
          appointmentType: 'panel',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2020-01-01',
          status: 'active',
          effectiveDate: '2020-01-01',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
        {
          id: 'seed-appt-2-staff-b',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-2-staff-b',
          chapter: '7',
          appointmentType: 'panel',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2020-01-01',
          status: 'active',
          effectiveDate: '2020-01-01',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
        {
          id: 'seed-appt-3-staff',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-3-staff',
          chapter: '7',
          appointmentType: 'panel',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2020-01-01',
          status: 'active',
          effectiveDate: '2020-01-01',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
        {
          id: 'seed-appt-0-staff',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-0-staff',
          chapter: '7',
          appointmentType: 'panel',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2020-01-01',
          status: 'active',
          effectiveDate: '2020-01-01',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
        {
          id: 'seed-appt-0-staff-b',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-0-staff-b',
          chapter: '7',
          appointmentType: 'panel',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2020-01-01',
          status: 'active',
          effectiveDate: '2020-01-01',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },
  ];
}
