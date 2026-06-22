/**
 * Scenario: trustee-assistants
 * Database: cams only
 *
 * Seeds trustee assistant data to exercise trustee assistant management features:
 *
 *   - Trustees with 0 assistants (empty state)
 *   - Trustees with 1 assistant
 *   - Trustees with 2 assistants
 *   - Trustees with 3 assistants
 *
 * NOTE: Assistants are separate documents with documentType='TRUSTEE_ASSISTANT'.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import { faker } from '@faker-js/faker';
import { fakeUsPhoneNumber, createTrusteeBase } from '../lib/test-data-utils.js';

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };

export async function generate(_ctx: SeedContext): Promise<SeedOperation[]> {
  return [
    // ── Cosmos: Trustee with 1 assistant ─────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-1-assistant',
            firstName: 'Emma',
            lastName: 'Singleassistant',
            status: 'active',
            address1: '100 Assistant Lane',
            city: 'New York',
            state: 'NY',
            zipCode: '10001',
            phone: '212-555-0100',
            email: 'emma.singleassistant@example.com',
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
          id: 'seed-assistant-001',
          documentType: 'TRUSTEE_ASSISTANT',
          trusteeId: 'seed-trustee-1-assistant',
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

    // ── Cosmos: Another trustee with 1 assistant ─────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-1-assistant-b',
            firstName: 'Liam',
            lastName: 'Singleassistant',
            status: 'active',
            address1: '200 Assistant Blvd',
            city: 'New York',
            state: 'NY',
            zipCode: '10002',
            phone: '212-555-0200',
            email: 'liam.singleassistant@example.com',
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
          id: 'seed-assistant-002',
          documentType: 'TRUSTEE_ASSISTANT',
          trusteeId: 'seed-trustee-1-assistant-b',
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

    // ── Cosmos: Trustee with 2 assistants ────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-2-assistants',
            firstName: 'Olivia',
            lastName: 'Twoassistants',
            status: 'active',
            address1: '300 Assistant Ave',
            city: 'New York',
            state: 'NY',
            zipCode: '10003',
            phone: '212-555-0300',
            email: 'olivia.twoassistants@example.com',
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
          id: 'seed-assistant-003',
          documentType: 'TRUSTEE_ASSISTANT',
          trusteeId: 'seed-trustee-2-assistants',
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
          id: 'seed-assistant-004',
          documentType: 'TRUSTEE_ASSISTANT',
          trusteeId: 'seed-trustee-2-assistants',
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

    // ── Cosmos: Another trustee with 2 assistants ────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-2-assistants-b',
            firstName: 'Noah',
            lastName: 'Twoassistants',
            status: 'active',
            address1: '400 Assistant St',
            city: 'New York',
            state: 'NY',
            zipCode: '10004',
            phone: '212-555-0400',
            email: 'noah.twoassistants@example.com',
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
          id: 'seed-assistant-005',
          documentType: 'TRUSTEE_ASSISTANT',
          trusteeId: 'seed-trustee-2-assistants-b',
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
          id: 'seed-assistant-006',
          documentType: 'TRUSTEE_ASSISTANT',
          trusteeId: 'seed-trustee-2-assistants-b',
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

    // ── Cosmos: Trustee with 3 assistants ────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-3-assistants',
            firstName: 'Sophia',
            lastName: 'Threeassistants',
            status: 'active',
            address1: '500 Assistant Dr',
            city: 'New York',
            state: 'NY',
            zipCode: '10005',
            phone: '212-555-0500',
            email: 'sophia.threeassistants@example.com',
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
          id: 'seed-assistant-007',
          documentType: 'TRUSTEE_ASSISTANT',
          trusteeId: 'seed-trustee-3-assistants',
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
          id: 'seed-assistant-008',
          documentType: 'TRUSTEE_ASSISTANT',
          trusteeId: 'seed-trustee-3-assistants',
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
          id: 'seed-assistant-009',
          documentType: 'TRUSTEE_ASSISTANT',
          trusteeId: 'seed-trustee-3-assistants',
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

    // ── Cosmos: Trustee with 0 assistants (empty state) ──────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-0-assistants',
            firstName: 'Ethan',
            lastName: 'Noassistants',
            status: 'active',
            address1: '600 Assistant Rd',
            city: 'New York',
            state: 'NY',
            zipCode: '10006',
            phone: '212-555-0600',
            email: 'ethan.noassistants@example.com',
          }),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Another trustee with 0 assistants ────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-0-assistants-b',
            firstName: 'Ava',
            lastName: 'Noassistants',
            status: 'active',
            address1: '700 Assistant Way',
            city: 'New York',
            state: 'NY',
            zipCode: '10007',
            phone: '212-555-0700',
            email: 'ava.noassistants@example.com',
          }),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Trustee appointments — makes all assistant trustees appear active ──
    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appt-1-assistant',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-1-assistant',
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
          id: 'seed-appt-1-assistant-b',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-1-assistant-b',
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
          id: 'seed-appt-2-assistants',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-2-assistants',
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
          id: 'seed-appt-2-assistants-b',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-2-assistants-b',
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
          id: 'seed-appt-3-assistants',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-3-assistants',
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
          id: 'seed-appt-0-assistants',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-0-assistants',
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
          id: 'seed-appt-0-assistants-b',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-0-assistants-b',
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
