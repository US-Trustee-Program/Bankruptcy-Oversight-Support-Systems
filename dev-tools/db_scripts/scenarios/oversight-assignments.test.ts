import { describe, test, expect, vi } from 'vitest';
import type { SeedContext, SeedOperation } from '../../runner.js';
import { generate as generateOversightAssignments } from './oversight-assignments.js';

// Mock MongoDB client and user-groups data
function mockMongoContext(
  attorneys: Array<{ id: string; name: string }>,
  auditors: Array<{ id: string; name: string }>,
  paralegals: Array<{ id: string; name: string }>,
): SeedContext {
  const mockCollection = {
    findOne: vi.fn((query: { groupName: string }) => {
      if (query.groupName === 'USTP CAMS Trial Attorney') {
        return Promise.resolve(attorneys.length > 0 ? { users: attorneys } : null);
      }
      if (query.groupName === 'USTP CAMS Auditor') {
        return Promise.resolve(auditors.length > 0 ? { users: auditors } : null);
      }
      if (query.groupName === 'USTP CAMS Paralegal') {
        return Promise.resolve(paralegals.length > 0 ? { users: paralegals } : null);
      }
      return Promise.resolve(null);
    }),
  };

  const mockDb = {
    collection: vi.fn().mockReturnValue(mockCollection),
  };

  const mockClient = {
    db: vi.fn().mockReturnValue(mockDb),
  };

  return {
    generateCaseId: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mongoClient: mockClient as any,
  };
}

// Helper to find operations by collection and optional filter
function findOperations(
  ops: SeedOperation[],
  collection: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter?: (data: any) => boolean,
) {
  return ops.filter(
    (o) =>
      o.db === 'cams' && o.collectionOrTable === collection && (!filter || o.data.some(filter)),
  );
}

// Helper to find a specific data item across all operations
function findDataItem(
  ops: SeedOperation[],
  collection: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter: (data: any) => boolean,
) {
  for (const op of ops) {
    if (op.db === 'cams' && op.collectionOrTable === collection) {
      const item = op.data.find(filter);
      if (item) return item;
    }
  }
  return null;
}

describe('oversight-assignments scenario', () => {
  const REAL_ATTORNEY = { id: '00uxy5h9217qKbv69697', name: 'Manhattan, Alice' };
  const REAL_AUDITOR = { id: '00uxy5ptgkN4npr8v697', name: 'Auditor, Audrey' };
  const REAL_PARALEGAL = { id: '00uxy5test123', name: 'Test, Paralegal' };

  async function operations(ctx: SeedContext) {
    return generateOversightAssignments(ctx);
  }

  describe('with real user-groups', () => {
    test('returns 9 operations: 5 trustees + 4 assignment operations (one has 2 assignments)', async () => {
      const ctx = mockMongoContext([REAL_ATTORNEY], [REAL_AUDITOR], [REAL_PARALEGAL]);
      const ops = await operations(ctx);

      expect(ops).toHaveLength(9);
      expect(ops.every((o) => o.db === 'cams')).toBe(true);

      const trustees = findOperations(ops, 'trustees', (d) => d.documentType === 'TRUSTEE');
      const assignments = findOperations(
        ops,
        'trustees',
        (d) => d.documentType === 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
      );

      expect(trustees).toHaveLength(5);
      expect(assignments).toHaveLength(4); // 3 single-assignment ops + 1 op with 2 assignments (both)
    });

    test('creates Oliver Attorneyonly trustee with Trial Attorney assignment', async () => {
      const ctx = mockMongoContext([REAL_ATTORNEY], [REAL_AUDITOR], []);
      const ops = await operations(ctx);

      const trustee = findDataItem(
        ops,
        'trustees',
        (d) => d.trusteeId === 'seed-trustee-oversight-attorney',
      );
      expect(trustee).toMatchObject({
        documentType: 'TRUSTEE',
        name: 'Oliver Attorneyonly',
        status: 'active',
      });

      const assignment = findDataItem(
        ops,
        'trustees',
        (d) => d.id === 'trustee-assignment-attorney-001',
      );
      expect(assignment).toMatchObject({
        documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
        trusteeId: 'seed-trustee-oversight-attorney',
        user: REAL_ATTORNEY,
        role: 'TrialAttorney',
      });
    });

    test('creates Paula Auditoronly trustee with Auditor assignment', async () => {
      const ctx = mockMongoContext([REAL_ATTORNEY], [REAL_AUDITOR], []);
      const ops = await operations(ctx);

      const trustee = findDataItem(
        ops,
        'trustees',
        (d) => d.trusteeId === 'seed-trustee-oversight-auditor',
      );
      expect(trustee).toMatchObject({
        documentType: 'TRUSTEE',
        name: 'Paula Auditoronly',
        status: 'active',
      });

      const assignment = findDataItem(
        ops,
        'trustees',
        (d) => d.id === 'trustee-assignment-auditor-001',
      );
      expect(assignment).toMatchObject({
        documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
        trusteeId: 'seed-trustee-oversight-auditor',
        user: REAL_AUDITOR,
        role: 'Auditor',
      });
    });

    test('creates Quinn Bothassigned trustee with both Trial Attorney AND Auditor assignments', async () => {
      const ctx = mockMongoContext([REAL_ATTORNEY], [REAL_AUDITOR], []);
      const ops = await operations(ctx);

      const trustee = findDataItem(
        ops,
        'trustees',
        (d) => d.trusteeId === 'seed-trustee-oversight-both',
      );
      expect(trustee).toMatchObject({
        documentType: 'TRUSTEE',
        name: 'Quinn Bothassigned',
        status: 'active',
      });

      const attorneyAssignment = findDataItem(
        ops,
        'trustees',
        (d) => d.id === 'trustee-assignment-both-attorney',
      );
      expect(attorneyAssignment).toMatchObject({
        documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
        trusteeId: 'seed-trustee-oversight-both',
        user: REAL_ATTORNEY,
        role: 'TrialAttorney',
      });

      const auditorAssignment = findDataItem(
        ops,
        'trustees',
        (d) => d.id === 'trustee-assignment-both-auditor',
      );
      expect(auditorAssignment).toMatchObject({
        documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
        trusteeId: 'seed-trustee-oversight-both',
        user: REAL_AUDITOR,
        role: 'Auditor',
      });
    });

    test('creates Rachel Paralegalassigned trustee with Paralegal assignment', async () => {
      const ctx = mockMongoContext([REAL_ATTORNEY], [REAL_AUDITOR], [REAL_PARALEGAL]);
      const ops = await operations(ctx);

      const trustee = findDataItem(
        ops,
        'trustees',
        (d) => d.trusteeId === 'seed-trustee-oversight-paralegal',
      );
      expect(trustee).toMatchObject({
        documentType: 'TRUSTEE',
        name: 'Rachel Paralegalassigned',
        status: 'active',
      });

      const assignment = findDataItem(
        ops,
        'trustees',
        (d) => d.id === 'trustee-assignment-paralegal-001',
      );
      expect(assignment).toMatchObject({
        documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
        trusteeId: 'seed-trustee-oversight-paralegal',
        user: REAL_PARALEGAL,
        role: 'Paralegal',
      });
    });

    test('creates Steven Noassignments trustee with NO assignments', async () => {
      const ctx = mockMongoContext([REAL_ATTORNEY], [REAL_AUDITOR], []);
      const ops = await operations(ctx);

      const trustee = findDataItem(
        ops,
        'trustees',
        (d) => d.trusteeId === 'seed-trustee-oversight-none',
      );
      expect(trustee).toMatchObject({
        documentType: 'TRUSTEE',
        name: 'Steven Noassignments',
        status: 'active',
      });

      // Verify NO assignment exists for this trustee
      const assignment = findDataItem(
        ops,
        'trustees',
        (d) =>
          d.documentType === 'TRUSTEE_OVERSIGHT_ASSIGNMENT' &&
          d.trusteeId === 'seed-trustee-oversight-none',
      );
      expect(assignment).toBeNull();
    });
  });

  describe('defensive fallbacks for missing user-groups', () => {
    test('uses TEST user when Trial Attorney group is empty', async () => {
      const ctx = mockMongoContext([], [REAL_AUDITOR], []);
      const ops = await operations(ctx);

      const assignment = findDataItem(
        ops,
        'trustees',
        (d) => d.id === 'trustee-assignment-attorney-001',
      );
      expect(assignment).toMatchObject({
        user: { id: 'test-trial-attorney-001', name: 'TEST Trial Attorney' },
        role: 'TrialAttorney',
      });
    });

    test('uses TEST user when Auditor group is empty', async () => {
      const ctx = mockMongoContext([REAL_ATTORNEY], [], []);
      const ops = await operations(ctx);

      const assignment = findDataItem(
        ops,
        'trustees',
        (d) => d.id === 'trustee-assignment-auditor-001',
      );
      expect(assignment).toMatchObject({
        user: { id: 'test-auditor-001', name: 'TEST Auditor' },
        role: 'Auditor',
      });
    });

    test('uses TEST user when Paralegal group is empty', async () => {
      const ctx = mockMongoContext([REAL_ATTORNEY], [REAL_AUDITOR], []);
      const ops = await operations(ctx);

      const assignment = findDataItem(
        ops,
        'trustees',
        (d) => d.id === 'trustee-assignment-paralegal-001',
      );
      expect(assignment).toMatchObject({
        user: { id: 'test-paralegal-001', name: 'TEST Paralegal' },
        role: 'Paralegal',
      });
    });

    test('all operations succeed even when all user-groups are empty', async () => {
      const ctx = mockMongoContext([], [], []);
      const ops = await operations(ctx);

      // Should still create all 5 trustees and 4 assignment operations (one with 2 assignments)
      expect(ops).toHaveLength(9);

      // Count all assignment data items across all operations
      let assignmentCount = 0;
      let testUserCount = 0;
      for (const op of ops) {
        if (op.collectionOrTable === 'trustees') {
          for (const data of op.data) {
            if (data.documentType === 'TRUSTEE_OVERSIGHT_ASSIGNMENT') {
              assignmentCount++;
              if (data.user.name.startsWith('TEST')) {
                testUserCount++;
              }
            }
          }
        }
      }

      expect(assignmentCount).toBe(5); // 5 total assignments
      expect(testUserCount).toBe(5); // All use TEST users
    });
  });

  test('all trustee ids are stable seed-prefixed strings for idempotent reruns', async () => {
    const ctx = mockMongoContext([REAL_ATTORNEY], [REAL_AUDITOR], [REAL_PARALEGAL]);
    const ops = await operations(ctx);

    const trusteeIds: string[] = [];
    for (const op of ops) {
      if (op.collectionOrTable === 'trustees') {
        for (const data of op.data) {
          if (data.documentType === 'TRUSTEE') {
            trusteeIds.push(data.id);
          }
        }
      }
    }

    expect(trusteeIds).toEqual([
      'seed-trustee-oversight-attorney',
      'seed-trustee-oversight-auditor',
      'seed-trustee-oversight-both',
      'seed-trustee-oversight-paralegal',
      'seed-trustee-oversight-none',
    ]);
  });

  test('all assignment ids are stable seed-prefixed strings for idempotent reruns', async () => {
    const ctx = mockMongoContext([REAL_ATTORNEY], [REAL_AUDITOR], [REAL_PARALEGAL]);
    const ops = await operations(ctx);

    const assignmentIds: string[] = [];
    for (const op of ops) {
      if (op.collectionOrTable === 'trustees') {
        for (const data of op.data) {
          if (data.documentType === 'TRUSTEE_OVERSIGHT_ASSIGNMENT') {
            assignmentIds.push(data.id);
          }
        }
      }
    }

    expect(assignmentIds.sort()).toEqual([
      'trustee-assignment-attorney-001',
      'trustee-assignment-auditor-001',
      'trustee-assignment-both-attorney',
      'trustee-assignment-both-auditor',
      'trustee-assignment-paralegal-001',
    ]);
  });

  test('scenario requires MongoDB client in context', async () => {
    const ctxWithoutMongo: SeedContext = { generateCaseId: vi.fn() };

    await expect(operations(ctxWithoutMongo)).rejects.toThrow(
      'MongoDB client not available in seed context',
    );
  });
});
