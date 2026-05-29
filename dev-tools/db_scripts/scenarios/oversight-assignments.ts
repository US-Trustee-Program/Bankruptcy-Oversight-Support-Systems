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

  const users = (group as { users?: Array<{ id: string; name: string }> }).users || [];
  console.log(`✓ Found ${users.length} user(s) in "${groupName}"`);
  return users;
}

export async function generate(ctx: SeedContext): Promise<SeedOperation[]> {
  // Query user-groups for real users
  console.log('📖 Reading users from user-groups...');
  const attorneys = await getUsersFromGroup(ctx, 'USTP CAMS Trial Attorney');
  const auditors = await getUsersFromGroup(ctx, 'USTP CAMS Auditor');
  const paralegals = await getUsersFromGroup(ctx, 'USTP CAMS Paralegal');

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
    // Note: Using same users as above since we only have one of each in production
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'trustee-assignment-both-attorney',
          documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
          trusteeId: 'seed-trustee-oversight-both',
          user: TRIAL_ATTORNEY,
          role: 'TrialAttorney',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
        {
          id: 'trustee-assignment-both-auditor',
          documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
          trusteeId: 'seed-trustee-oversight-both',
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
