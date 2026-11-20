import { describe, test, expect, beforeEach, vi } from 'vitest';
import { CamsRole } from '@common/cams/roles.js';
import type { RoleAssignmentAuditEntry, UserRoleAssignment } from '@common/cams/user-access.js';
import { grantSuperUser, revokeSuperUser, type SuperUserStore } from './superuser-access.js';

type Doc = Record<string, unknown>;

/** An in-memory stand-in for the two Mongo collections, matching filters by exact field value. */
function fakeCollection() {
  const docs: Doc[] = [];
  const matches = (doc: Doc, filter: Doc) =>
    Object.entries(filter).every(([key, value]) => doc[key] === value);
  return {
    docs,
    /** Like Mongo, returns a copy: later updates don't change what an earlier read returned. */
    async findOne(filter: Doc) {
      const doc = docs.find((d) => matches(d, filter));
      return doc ? { ...doc } : null;
    },
    async insertOne(doc: Doc) {
      docs.push({ ...doc });
      return { acknowledged: true };
    },
    /** Like Mongo, returns the document as it was before the update unless told otherwise. */
    async findOneAndUpdate(
      filter: Doc,
      update: { $set: Doc },
      options?: { returnDocument?: 'before' | 'after' },
    ) {
      const doc = docs.find((d) => matches(d, filter));
      if (!doc) return null;
      const before = { ...doc };
      Object.assign(doc, update.$set);
      return options?.returnDocument === 'after' ? { ...doc } : before;
    },
  };
}

const target = { id: '00uabc1234567890abcd', name: 'Alice Adams', email: 'alice@example.com' };
const NOW = new Date('2026-11-12T00:00:00.000Z');

describe('superuser grant and revoke', () => {
  let assignments: ReturnType<typeof fakeCollection>;
  let audits: ReturnType<typeof fakeCollection>;
  let store: SuperUserStore;

  beforeEach(() => {
    assignments = fakeCollection();
    audits = fakeCollection();
    store = { assignments, audits } as unknown as SuperUserStore;
  });

  test('should write an unscoped Super User permission and its CREATED audit entry', async () => {
    const result = await grantSuperUser(store, target, NOW);

    expect(result.outcome).toEqual('granted');
    expect(assignments.docs).toEqual([
      {
        documentType: 'USER_ROLE_ASSIGNMENT',
        id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        userId: target.id,
        userName: 'Alice Adams',
        email: 'alice@example.com',
        role: CamsRole.SuperUser,
        regionId: null,
        officeCode: null,
        assignedBy: 'SUPERUSER_COMMAND',
        assignedByName: 'Superuser command',
        assignedAt: NOW.toISOString(),
        expiresAt: null,
        active: true,
        activeKey: 'SuperUser|*|*',
      } satisfies UserRoleAssignment,
    ]);
    const assignmentId = assignments.docs[0].id as string;
    expect(audits.docs).toEqual([
      {
        documentType: 'ROLE_ASSIGNMENT_AUDIT',
        id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        assignmentId,
        action: 'CREATED',
        userId: target.id,
        userName: 'Alice Adams',
        role: CamsRole.SuperUser,
        regionId: null,
        officeCode: null,
        performedBy: 'SUPERUSER_COMMAND',
        performedByName: 'Superuser command',
        performedAt: NOW.toISOString(),
        previousState: null,
        newState: { role: CamsRole.SuperUser, regionId: null, officeCode: null, active: true },
        replacedByAssignmentId: null,
      } satisfies RoleAssignmentAuditEntry,
    ]);
  });

  test('should leave email off the permission when the target has none', async () => {
    await grantSuperUser(store, { id: target.id, name: target.name }, NOW);

    expect(assignments.docs[0]).not.toHaveProperty('email');
  });

  test('should write nothing when the user already holds Super User', async () => {
    await grantSuperUser(store, target, NOW);

    const result = await grantSuperUser(store, target, NOW);

    expect(result.outcome).toEqual('already-held');
    expect(assignments.docs).toHaveLength(1);
    expect(audits.docs).toHaveLength(1);
  });

  test('should deactivate the permission, never delete it, and write a DEACTIVATED audit entry', async () => {
    await grantSuperUser(store, target, NOW);
    const granted = { ...assignments.docs[0] };
    const revokedAt = new Date('2026-11-13T09:30:00.000Z');

    const result = await revokeSuperUser(store, target.id, revokedAt);

    expect(result.outcome).toEqual('revoked');
    expect(assignments.docs).toEqual([
      { ...granted, active: false, activeKey: `inactive|${granted.id}` },
    ]);
    expect(audits.docs).toHaveLength(2);
    expect(audits.docs[1]).toEqual({
      documentType: 'ROLE_ASSIGNMENT_AUDIT',
      id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
      assignmentId: granted.id as string,
      action: 'DEACTIVATED',
      userId: target.id,
      userName: 'Alice Adams',
      role: CamsRole.SuperUser,
      regionId: null,
      officeCode: null,
      performedBy: 'SUPERUSER_COMMAND',
      performedByName: 'Superuser command',
      performedAt: revokedAt.toISOString(),
      previousState: { role: CamsRole.SuperUser, regionId: null, officeCode: null, active: true },
      newState: { role: CamsRole.SuperUser, regionId: null, officeCode: null, active: false },
      replacedByAssignmentId: null,
    } satisfies RoleAssignmentAuditEntry);
    expect(audits.docs[1].id).not.toEqual(audits.docs[0].id);
  });

  test('should report nothing to revoke and write nothing when the user holds no Super User', async () => {
    const result = await revokeSuperUser(store, target.id, NOW);

    expect(result.outcome).toEqual('nothing-to-revoke');
    expect(assignments.docs).toEqual([]);
    expect(audits.docs).toEqual([]);
  });

  test('should keep the history when granting again after a revoke', async () => {
    await grantSuperUser(store, target, NOW);
    await revokeSuperUser(store, target.id, NOW);

    const result = await grantSuperUser(store, target, NOW);

    expect(result.outcome).toEqual('granted');
    expect(assignments.docs.map((d) => d.active)).toEqual([false, true]);
    expect(assignments.docs[0].id).not.toEqual(assignments.docs[1].id);
    expect(audits.docs.map((d) => d.action)).toEqual(['CREATED', 'DEACTIVATED', 'CREATED']);
  });

  test("should revoke only the named user's permission", async () => {
    const other = { id: '00uother0000000000000', name: 'Bob Brown' };
    await grantSuperUser(store, other, NOW);
    await grantSuperUser(store, target, NOW);

    await revokeSuperUser(store, target.id, NOW);

    expect(assignments.docs.map((d) => [d.userId, d.active])).toEqual([
      [other.id, true],
      [target.id, false],
    ]);
  });

  test('should revoke the newer permission after a revoke and a second grant', async () => {
    await grantSuperUser(store, target, NOW);
    await revokeSuperUser(store, target.id, NOW);
    await grantSuperUser(store, target, NOW);

    const result = await revokeSuperUser(store, target.id, NOW);

    expect(result.outcome).toEqual('revoked');
    expect(assignments.docs.map((d) => d.active)).toEqual([false, false]);
    expect(audits.docs.map((d) => [d.action, d.assignmentId])).toEqual([
      ['CREATED', assignments.docs[0].id],
      ['DEACTIVATED', assignments.docs[0].id],
      ['CREATED', assignments.docs[1].id],
      ['DEACTIVATED', assignments.docs[1].id],
    ]);
  });

  test('should report nothing to revoke and write no audit when another revoke wins the race', async () => {
    await grantSuperUser(store, target, NOW);
    const realFindOne = assignments.findOne;
    vi.spyOn(assignments, 'findOne').mockImplementationOnce(async (filter) => {
      const held = await realFindOne(filter);
      await revokeSuperUser(store, target.id, NOW); // the competing revoke
      return held;
    });

    const result = await revokeSuperUser(store, target.id, NOW);

    expect(result.outcome).toEqual('nothing-to-revoke');
    expect(audits.docs.map((d) => d.action)).toEqual(['CREATED', 'DEACTIVATED']);
  });
});
