import { describe, test, expect, vi } from 'vitest';
import type { SeedContext, SeedOperation } from '../../runner.js';
import {
  generate as generateOversightAssignments,
  GROUP_TRIAL_ATTORNEY,
  GROUP_AUDITOR,
  GROUP_PARALEGAL,
  TRUSTEE_ID_ATTORNEY,
  TRUSTEE_ID_AUDITOR,
  TRUSTEE_ID_BOTH,
  TRUSTEE_ID_PARALEGAL,
  TRUSTEE_ID_NONE,
  ASSIGNMENT_ID_ATTORNEY,
  ASSIGNMENT_ID_AUDITOR,
  ASSIGNMENT_ID_BOTH_ATTORNEY,
  ASSIGNMENT_ID_BOTH_AUDITOR,
  ASSIGNMENT_ID_PARALEGAL,
} from './oversight-assignments.js';
import type { UserGroupDocument } from './oversight-assignments.js';

// Mock MongoDB client and user-groups data
function mockMongoContext(
  attorneys: Array<{ id: string; name: string }>,
  auditors: Array<{ id: string; name: string }>,
  paralegals: Array<{ id: string; name: string }>,
): SeedContext {
  const mockCollection = {
    findOne: vi.fn((query: { groupName: string }) => {
      if (query.groupName === GROUP_TRIAL_ATTORNEY) {
        return Promise.resolve(attorneys.length > 0 ? { users: attorneys } : null);
      }
      if (query.groupName === GROUP_AUDITOR) {
        return Promise.resolve(auditors.length > 0 ? { users: auditors } : null);
      }
      if (query.groupName === GROUP_PARALEGAL) {
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

  describe('with real user-groups', () => {
    test('creates 5 trustees and 5 assignments across all operations', async () => {
      const ctx = mockMongoContext([REAL_ATTORNEY], [REAL_AUDITOR], [REAL_PARALEGAL]);
      const ops = await generateOversightAssignments(ctx);

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

    test('uses first user from group when multiple users are present', async () => {
      const SECOND_ATTORNEY = { id: 'second-attorney-id', name: 'Second, Attorney' };
      const ctx = mockMongoContext(
        [REAL_ATTORNEY, SECOND_ATTORNEY],
        [REAL_AUDITOR],
        [REAL_PARALEGAL],
      );
      const ops = await generateOversightAssignments(ctx);

      const assignment = findDataItem(ops, 'trustees', (d) => d.id === ASSIGNMENT_ID_ATTORNEY);
      expect(assignment).toMatchObject({ user: REAL_ATTORNEY });
    });

    test('creates Oliver Attorneyonly trustee with Trial Attorney assignment', async () => {
      const ctx = mockMongoContext([REAL_ATTORNEY], [REAL_AUDITOR], []);
      const ops = await generateOversightAssignments(ctx);

      const trustee = findDataItem(ops, 'trustees', (d) => d.trusteeId === TRUSTEE_ID_ATTORNEY);
      expect(trustee).toMatchObject({
        id: TRUSTEE_ID_ATTORNEY,
        documentType: 'TRUSTEE',
        trusteeId: TRUSTEE_ID_ATTORNEY,
        name: 'Oliver Attorneyonly',
        status: 'active',
      });
      expect(trustee!.id).toBe(trustee!.trusteeId);

      const assignment = findDataItem(ops, 'trustees', (d) => d.id === ASSIGNMENT_ID_ATTORNEY);
      expect(assignment).toStrictEqual({
        id: ASSIGNMENT_ID_ATTORNEY,
        documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
        trusteeId: TRUSTEE_ID_ATTORNEY,
        user: REAL_ATTORNEY,
        role: 'TrialAttorney',
        updatedOn: '2025-03-01T00:00:00.000Z',
        updatedBy: { id: 'SEED', name: 'Test Data Seeder' },
      });
    });

    test('creates Paula Auditoronly trustee with Auditor assignment', async () => {
      const ctx = mockMongoContext([REAL_ATTORNEY], [REAL_AUDITOR], []);
      const ops = await generateOversightAssignments(ctx);

      const trustee = findDataItem(ops, 'trustees', (d) => d.trusteeId === TRUSTEE_ID_AUDITOR);
      expect(trustee).toMatchObject({
        documentType: 'TRUSTEE',
        name: 'Paula Auditoronly',
        status: 'active',
      });
      expect(trustee!.id).toBe(trustee!.trusteeId);

      const assignment = findDataItem(ops, 'trustees', (d) => d.id === ASSIGNMENT_ID_AUDITOR);
      expect(assignment).toMatchObject({
        documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
        trusteeId: TRUSTEE_ID_AUDITOR,
        user: REAL_AUDITOR,
        role: 'Auditor',
        updatedOn: '2025-03-01T00:00:00.000Z',
      });
    });

    test('creates Quinn Bothassigned trustee with both Trial Attorney AND Auditor assignments', async () => {
      const ctx = mockMongoContext([REAL_ATTORNEY], [REAL_AUDITOR], []);
      const ops = await generateOversightAssignments(ctx);

      const trustee = findDataItem(ops, 'trustees', (d) => d.trusteeId === TRUSTEE_ID_BOTH);
      expect(trustee).toMatchObject({
        documentType: 'TRUSTEE',
        name: 'Quinn Bothassigned',
        status: 'active',
      });
      expect(trustee!.id).toBe(trustee!.trusteeId);

      const attorneyAssignment = findDataItem(
        ops,
        'trustees',
        (d) => d.id === ASSIGNMENT_ID_BOTH_ATTORNEY,
      );
      expect(attorneyAssignment).toMatchObject({
        documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
        trusteeId: TRUSTEE_ID_BOTH,
        user: REAL_ATTORNEY,
        role: 'TrialAttorney',
        updatedOn: '2025-03-01T00:00:00.000Z',
      });

      const auditorAssignment = findDataItem(
        ops,
        'trustees',
        (d) => d.id === ASSIGNMENT_ID_BOTH_AUDITOR,
      );
      expect(auditorAssignment).toMatchObject({
        documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
        trusteeId: TRUSTEE_ID_BOTH,
        user: REAL_AUDITOR,
        role: 'Auditor',
        updatedOn: '2025-03-01T00:00:00.000Z',
      });
    });

    test('creates Rachel Paralegalassigned trustee with Paralegal assignment', async () => {
      const ctx = mockMongoContext([REAL_ATTORNEY], [REAL_AUDITOR], [REAL_PARALEGAL]);
      const ops = await generateOversightAssignments(ctx);

      const trustee = findDataItem(ops, 'trustees', (d) => d.trusteeId === TRUSTEE_ID_PARALEGAL);
      expect(trustee).toMatchObject({
        documentType: 'TRUSTEE',
        name: 'Rachel Paralegalassigned',
        status: 'active',
      });
      expect(trustee!.id).toBe(trustee!.trusteeId);

      const assignment = findDataItem(ops, 'trustees', (d) => d.id === ASSIGNMENT_ID_PARALEGAL);
      expect(assignment).toMatchObject({
        documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
        trusteeId: TRUSTEE_ID_PARALEGAL,
        user: REAL_PARALEGAL,
        role: 'Paralegal',
        updatedOn: '2025-03-01T00:00:00.000Z',
      });
    });

    test('creates Steven Noassignments trustee with NO assignments', async () => {
      const ctx = mockMongoContext([REAL_ATTORNEY], [REAL_AUDITOR], []);
      const ops = await generateOversightAssignments(ctx);

      const trustee = findDataItem(ops, 'trustees', (d) => d.trusteeId === TRUSTEE_ID_NONE);
      expect(trustee).toMatchObject({
        documentType: 'TRUSTEE',
        name: 'Steven Noassignments',
        status: 'active',
      });
      expect(trustee!.id).toBe(trustee!.trusteeId);

      const assignment = findDataItem(
        ops,
        'trustees',
        (d) => d.documentType === 'TRUSTEE_OVERSIGHT_ASSIGNMENT' && d.trusteeId === TRUSTEE_ID_NONE,
      );
      expect(assignment).toBeNull();
    });
  });

  describe('defensive fallbacks for missing user-groups', () => {
    test('all operations succeed when all user-groups are empty, using TEST users for every assignment', async () => {
      const ctx = mockMongoContext([], [], []);
      const ops = await generateOversightAssignments(ctx);

      let assignmentCount = 0;
      let testUserCount = 0;
      for (const op of ops) {
        if (op.collectionOrTable === 'trustees') {
          for (const data of op.data) {
            if (data.documentType === 'TRUSTEE_OVERSIGHT_ASSIGNMENT') {
              assignmentCount++;
              const user = data.user as { name: string };
              if (user.name.startsWith('TEST')) {
                testUserCount++;
              }
            }
          }
        }
      }

      expect(assignmentCount).toBe(5);
      expect(testUserCount).toBe(5);
    });

    test('uses TEST user when Trial Attorney group is empty', async () => {
      const ctx = mockMongoContext([], [REAL_AUDITOR], []);
      const ops = await generateOversightAssignments(ctx);

      const assignment = findDataItem(ops, 'trustees', (d) => d.id === ASSIGNMENT_ID_ATTORNEY);
      expect(assignment).toMatchObject({
        user: { id: 'test-trial-attorney-001', name: 'TEST Trial Attorney' },
        role: 'TrialAttorney',
        updatedOn: '2025-03-01T00:00:00.000Z',
      });
    });

    test('uses TEST user when Auditor group is empty', async () => {
      const ctx = mockMongoContext([REAL_ATTORNEY], [], []);
      const ops = await generateOversightAssignments(ctx);

      const assignment = findDataItem(ops, 'trustees', (d) => d.id === ASSIGNMENT_ID_AUDITOR);
      expect(assignment).toMatchObject({
        user: { id: 'test-auditor-001', name: 'TEST Auditor' },
        role: 'Auditor',
        updatedOn: '2025-03-01T00:00:00.000Z',
      });
    });

    test('uses TEST user when Paralegal group is empty', async () => {
      const ctx = mockMongoContext([REAL_ATTORNEY], [REAL_AUDITOR], []);
      const ops = await generateOversightAssignments(ctx);

      const assignment = findDataItem(ops, 'trustees', (d) => d.id === ASSIGNMENT_ID_PARALEGAL);
      expect(assignment).toMatchObject({
        user: { id: 'test-paralegal-001', name: 'TEST Paralegal' },
        role: 'Paralegal',
        updatedOn: '2025-03-01T00:00:00.000Z',
      });
    });

    test('uses TEST user when group document exists but has no users field', async () => {
      // Exercises the `?? []` fallback for a non-null document missing the users array
      const mockCollection = {
        findOne: vi.fn(() => Promise.resolve({} satisfies UserGroupDocument)),
      };
      const mockDb = { collection: vi.fn().mockReturnValue(mockCollection) };
      const emptyGroupCtx: SeedContext = {
        generateCaseId: vi.fn(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mongoClient: { db: vi.fn().mockReturnValue(mockDb) } as any,
      };

      const ops = await generateOversightAssignments(emptyGroupCtx);

      const assignment = findDataItem(ops, 'trustees', (d) => d.id === ASSIGNMENT_ID_ATTORNEY);
      expect(assignment).toMatchObject({
        user: { id: 'test-trial-attorney-001', name: 'TEST Trial Attorney' },
      });
    });
  });

  test('all trustee ids are stable seed-prefixed strings for idempotent reruns', async () => {
    const ctx = mockMongoContext([REAL_ATTORNEY], [REAL_AUDITOR], [REAL_PARALEGAL]);
    const ops = await generateOversightAssignments(ctx);

    const trusteeIds: string[] = [];
    const trusteeIdPairs: Array<{ id: string; trusteeId: string }> = [];
    for (const op of ops) {
      if (op.collectionOrTable === 'trustees') {
        for (const data of op.data) {
          if (data.documentType === 'TRUSTEE') {
            trusteeIds.push(data.id as string);
            trusteeIdPairs.push({ id: data.id as string, trusteeId: data.trusteeId as string });
          }
        }
      }
    }

    trusteeIdPairs.forEach((r) => expect(r.id).toBe(r.trusteeId));

    expect(trusteeIds).toEqual([
      TRUSTEE_ID_ATTORNEY,
      TRUSTEE_ID_AUDITOR,
      TRUSTEE_ID_BOTH,
      TRUSTEE_ID_PARALEGAL,
      TRUSTEE_ID_NONE,
    ]);
  });

  test('all assignment ids are stable seed-prefixed strings for idempotent reruns', async () => {
    const ctx = mockMongoContext([REAL_ATTORNEY], [REAL_AUDITOR], [REAL_PARALEGAL]);
    const ops = await generateOversightAssignments(ctx);

    const assignmentIds: string[] = [];
    for (const op of ops) {
      if (op.collectionOrTable === 'trustees') {
        for (const data of op.data) {
          if (data.documentType === 'TRUSTEE_OVERSIGHT_ASSIGNMENT') {
            assignmentIds.push(data.id as string);
          }
        }
      }
    }

    expect(assignmentIds.sort()).toEqual([
      ASSIGNMENT_ID_ATTORNEY,
      ASSIGNMENT_ID_AUDITOR,
      ASSIGNMENT_ID_BOTH_ATTORNEY,
      ASSIGNMENT_ID_BOTH_AUDITOR,
      ASSIGNMENT_ID_PARALEGAL,
    ]);
  });

  test('scenario requires MongoDB client in context', async () => {
    const ctxWithoutMongo: SeedContext = { generateCaseId: vi.fn() };

    await expect(generateOversightAssignments(ctxWithoutMongo)).rejects.toThrow(
      'MongoDB client not available in seed context',
    );
  });
});
