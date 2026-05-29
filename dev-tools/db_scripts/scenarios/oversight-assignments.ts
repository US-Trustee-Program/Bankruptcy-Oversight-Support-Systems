/**
 * Scenario: oversight-assignments
 * Database: cams only
 *
 * Seeds oversight assignment data to exercise trustee oversight features:
 *
 *   - Trustees with various assignment states (none, attorney, auditor, both, paralegal)
 *   - Dynamically reads users from existing user-groups
 *
 * PREREQUISITES:
 *   - User-groups must already exist in the database
 *   - Run `npx tsx sync-user-groups.ts` to sync from production if needed
 *
 * This script queries the user-groups collection for:
 *   - "USTP CAMS Trial Attorney"
 *   - "USTP CAMS Auditor"
 *   - "USTP CAMS Paralegal"
 */

import type { SeedContext, SeedOperation } from '../../runner.js';

export const GROUP_TRIAL_ATTORNEY = 'USTP CAMS Trial Attorney';
export const GROUP_AUDITOR = 'USTP CAMS Auditor';
export const GROUP_PARALEGAL = 'USTP CAMS Paralegal';

export interface UserGroupDocument {
  users?: Array<{ id: string; name: string }>;
}

export const TRUSTEE_ID_ATTORNEY = 'seed-trustee-oversight-attorney';
export const TRUSTEE_ID_AUDITOR = 'seed-trustee-oversight-auditor';
export const TRUSTEE_ID_BOTH = 'seed-trustee-oversight-both';
export const TRUSTEE_ID_PARALEGAL = 'seed-trustee-oversight-paralegal';
export const TRUSTEE_ID_NONE = 'seed-trustee-oversight-none';

export const ASSIGNMENT_ID_ATTORNEY = 'trustee-assignment-attorney-001';
export const ASSIGNMENT_ID_AUDITOR = 'trustee-assignment-auditor-001';
export const ASSIGNMENT_ID_BOTH_ATTORNEY = 'trustee-assignment-both-attorney';
export const ASSIGNMENT_ID_BOTH_AUDITOR = 'trustee-assignment-both-auditor';
export const ASSIGNMENT_ID_PARALEGAL = 'trustee-assignment-paralegal-001';

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };

/**
 * Fetches users from a user-group by name
 */
async function getUsersFromGroup(
  ctx: SeedContext,
  groupName: string,
): Promise<Array<{ id: string; name: string }>> {
  if (!ctx.mongoClient) {
    throw new Error('MongoDB client not available in seed context');
  }

  const db = ctx.mongoClient.db('cams');
  const group = await db.collection('user-groups').findOne({ groupName });

  if (!group) {
    console.warn(`⚠️  User group "${groupName}" not found`);
    return [];
  }

  const users = (group as UserGroupDocument).users ?? [];
  console.log(`✓ Found ${users.length} user(s) in "${groupName}"`);
  return users;
}

export async function generate(ctx: SeedContext): Promise<SeedOperation[]> {
  // Query user-groups for real users
  console.log('📖 Reading users from user-groups...');
  const attorneys = await getUsersFromGroup(ctx, GROUP_TRIAL_ATTORNEY);
  const auditors = await getUsersFromGroup(ctx, GROUP_AUDITOR);
  const paralegals = await getUsersFromGroup(ctx, GROUP_PARALEGAL);

  // Use real users if available, otherwise fall back to test users (defensive)
  const TRIAL_ATTORNEY =
    attorneys.length > 0
      ? attorneys[0]
      : { id: 'test-trial-attorney-001', name: 'TEST Trial Attorney' };

  const AUDITOR =
    auditors.length > 0 ? auditors[0] : { id: 'test-auditor-001', name: 'TEST Auditor' };

  const PARALEGAL =
    paralegals.length > 0 ? paralegals[0] : { id: 'test-paralegal-001', name: 'TEST Paralegal' };

  // Log what we're using
  console.log(
    `   Using Trial Attorney: ${TRIAL_ATTORNEY.name}${attorneys.length === 0 ? ' ⚠️  TEST USER' : ''}`,
  );
  console.log(`   Using Auditor: ${AUDITOR.name}${auditors.length === 0 ? ' ⚠️  TEST USER' : ''}`);
  console.log(
    `   Using Paralegal: ${PARALEGAL.name}${paralegals.length === 0 ? ' ⚠️  TEST USER' : ''}\n`,
  );

  return [
    // ── Cosmos: Trustees for oversight assignments ───────────────────────────
    // NOTE: User-groups are NOT created here - they must already exist in the database

    // Trustee 1: Attorney only
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: TRUSTEE_ID_ATTORNEY,
          documentType: 'TRUSTEE',
          trusteeId: TRUSTEE_ID_ATTORNEY,
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
          id: ASSIGNMENT_ID_ATTORNEY,
          documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
          trusteeId: TRUSTEE_ID_ATTORNEY,
          user: TRIAL_ATTORNEY,
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
          id: TRUSTEE_ID_AUDITOR,
          documentType: 'TRUSTEE',
          trusteeId: TRUSTEE_ID_AUDITOR,
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
          id: ASSIGNMENT_ID_AUDITOR,
          documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
          trusteeId: TRUSTEE_ID_AUDITOR,
          user: AUDITOR,
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
          id: TRUSTEE_ID_BOTH,
          documentType: 'TRUSTEE',
          trusteeId: TRUSTEE_ID_BOTH,
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
    // Note: Using same users as above since we only have one of each in production
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: ASSIGNMENT_ID_BOTH_ATTORNEY,
          documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
          trusteeId: TRUSTEE_ID_BOTH,
          user: TRIAL_ATTORNEY,
          role: 'TrialAttorney',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
        {
          id: ASSIGNMENT_ID_BOTH_AUDITOR,
          documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
          trusteeId: TRUSTEE_ID_BOTH,
          user: AUDITOR,
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
          id: TRUSTEE_ID_PARALEGAL,
          documentType: 'TRUSTEE',
          trusteeId: TRUSTEE_ID_PARALEGAL,
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
          id: ASSIGNMENT_ID_PARALEGAL,
          documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
          trusteeId: TRUSTEE_ID_PARALEGAL,
          user: PARALEGAL,
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
          id: TRUSTEE_ID_NONE,
          documentType: 'TRUSTEE',
          trusteeId: TRUSTEE_ID_NONE,
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
