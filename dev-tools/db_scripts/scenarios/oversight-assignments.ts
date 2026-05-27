/**
 * Scenario: oversight-assignments
 * Database: cams only
 *
 * Seeds oversight assignment data to exercise trustee oversight features:
 *
 *   - User-groups for Trial Attorney, Auditor, Paralegal roles
 *   - Trustees with various assignment states (none, attorney, auditor, both)
 *   - Uses dev-mode user references
 *
 * NOTE: Uses existing trustees - no new trustees created.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };

// Dev-mode users (mock references for testing)
const ATTORNEYS = [
  { id: 'attorney-001', name: 'Alice Attorney' },
  { id: 'attorney-002', name: 'Bob Attorney' },
  { id: 'attorney-003', name: 'Carol Attorney' },
  { id: 'attorney-004', name: 'David Attorney' },
  { id: 'attorney-005', name: 'Emma Attorney' },
];

const AUDITORS = [
  { id: 'auditor-001', name: 'Frank Auditor' },
  { id: 'auditor-002', name: 'Grace Auditor' },
  { id: 'auditor-003', name: 'Henry Auditor' },
];

const PARALEGALS = [
  { id: 'paralegal-001', name: 'Iris Paralegal' },
  { id: 'paralegal-002', name: 'Jack Paralegal' },
];

export async function generate(_ctx: SeedContext): Promise<SeedOperation[]> {
  return [
    // ── Cosmos: User-Groups ───────────────────────────────────────────────────

    // Trial Attorney group
    {
      db: 'cams',
      collectionOrTable: 'user-groups',
      data: [
        {
          id: 'user-group-trial-attorney',
          documentType: 'USER_GROUP',
          name: 'USTP CAMS Trial Attorney',
          members: ATTORNEYS,
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // Auditor group
    {
      db: 'cams',
      collectionOrTable: 'user-groups',
      data: [
        {
          id: 'user-group-auditor',
          documentType: 'USER_GROUP',
          name: 'USTP CAMS Auditor',
          members: AUDITORS,
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // Paralegal group
    {
      db: 'cams',
      collectionOrTable: 'user-groups',
      data: [
        {
          id: 'user-group-paralegal',
          documentType: 'USER_GROUP',
          name: 'USTP CAMS Paralegal',
          members: PARALEGALS,
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Trustees for oversight assignments ───────────────────────────

    // Trustee 1: Attorney only
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-trustee-oversight-attorney',
          documentType: 'TRUSTEE',
          trusteeId: 'seed-trustee-oversight-attorney',
          name: 'Oliver Attorneyonly',
          firstName: 'Oliver',
          lastName: 'Attorneyonly',
          status: 'active',
          public: {
            address: {
              address1: '100 Oversight Lane',
              city: 'New York',
              state: 'NY',
              zipCode: '10001',
              countryCode: 'US',
            },
            phone: { number: '212-555-2000' },
            email: 'oliver.attorneyonly@example.com',
          },
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // Attorney assignment
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'trustee-assignment-attorney-001',
          documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
          trusteeId: 'seed-trustee-oversight-attorney',
          user: ATTORNEYS[0],
          role: 'TrialAttorney',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // Trustee 2: Auditor only
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-trustee-oversight-auditor',
          documentType: 'TRUSTEE',
          trusteeId: 'seed-trustee-oversight-auditor',
          name: 'Paula Auditoronly',
          firstName: 'Paula',
          lastName: 'Auditoronly',
          status: 'active',
          public: {
            address: {
              address1: '200 Oversight Blvd',
              city: 'New York',
              state: 'NY',
              zipCode: '10002',
              countryCode: 'US',
            },
            phone: { number: '212-555-2100' },
            email: 'paula.auditoronly@example.com',
          },
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // Auditor assignment
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'trustee-assignment-auditor-001',
          documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
          trusteeId: 'seed-trustee-oversight-auditor',
          user: AUDITORS[0],
          role: 'Auditor',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // Trustee 3: Both attorney AND auditor
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-trustee-oversight-both',
          documentType: 'TRUSTEE',
          trusteeId: 'seed-trustee-oversight-both',
          name: 'Quinn Bothassigned',
          firstName: 'Quinn',
          lastName: 'Bothassigned',
          status: 'active',
          public: {
            address: {
              address1: '300 Oversight Ave',
              city: 'New York',
              state: 'NY',
              zipCode: '10003',
              countryCode: 'US',
            },
            phone: { number: '212-555-2200' },
            email: 'quinn.bothassigned@example.com',
          },
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // Attorney + Auditor assignments
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'trustee-assignment-both-attorney',
          documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
          trusteeId: 'seed-trustee-oversight-both',
          user: ATTORNEYS[1],
          role: 'TrialAttorney',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
        {
          id: 'trustee-assignment-both-auditor',
          documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
          trusteeId: 'seed-trustee-oversight-both',
          user: AUDITORS[1],
          role: 'Auditor',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // Trustee 4: Paralegal
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-trustee-oversight-paralegal',
          documentType: 'TRUSTEE',
          trusteeId: 'seed-trustee-oversight-paralegal',
          name: 'Rachel Paralegalassigned',
          firstName: 'Rachel',
          lastName: 'Paralegalassigned',
          status: 'active',
          public: {
            address: {
              address1: '400 Oversight St',
              city: 'New York',
              state: 'NY',
              zipCode: '10004',
              countryCode: 'US',
            },
            phone: { number: '212-555-2300' },
            email: 'rachel.paralegalassigned@example.com',
          },
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // Paralegal assignment
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'trustee-assignment-paralegal-001',
          documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
          trusteeId: 'seed-trustee-oversight-paralegal',
          user: PARALEGALS[0],
          role: 'Paralegal',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // Trustee 5: No assignments (empty state)
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-trustee-oversight-none',
          documentType: 'TRUSTEE',
          trusteeId: 'seed-trustee-oversight-none',
          name: 'Steven Noassignments',
          firstName: 'Steven',
          lastName: 'Noassignments',
          status: 'active',
          public: {
            address: {
              address1: '500 Oversight Dr',
              city: 'New York',
              state: 'NY',
              zipCode: '10005',
              countryCode: 'US',
            },
            phone: { number: '212-555-2400' },
            email: 'steven.noassignments@example.com',
          },
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },
  ];
}
