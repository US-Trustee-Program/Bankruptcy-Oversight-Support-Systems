import { describe, test, expect, beforeEach } from 'vitest';
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
    async findOne(filter: Doc) {
      return docs.find((doc) => matches(doc, filter)) ?? null;
    },
    async insertOne(doc: Doc) {
      docs.push({ ...doc });
      return { acknowledged: true };
    },
    async findOneAndUpdate(filter: Doc, update: { $set: Doc }) {
      const doc = docs.find((d) => matches(d, filter));
      if (!doc) return null;
      Object.assign(doc, update.$set);
      return { ...doc };
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
        id: expect.stringMatching(/^seed-superuser-[0-9a-f-]{36}$/),
        userId: target.id,
        userName: 'Alice Adams',
        email: 'alice@example.com',
        role: CamsRole.SuperUser,
        regionId: null,
        officeCode: null,
        assignedBy: 'SYSTEM_SEED',
        assignedByName: 'Local superuser command',
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
        id: expect.stringMatching(/^seed-superuser-audit-[0-9a-f-]{36}$/),
        assignmentId,
        action: 'CREATED',
        userId: target.id,
        userName: 'Alice Adams',
        role: CamsRole.SuperUser,
        regionId: null,
        officeCode: null,
        performedBy: 'SYSTEM_SEED',
        performedByName: 'Local superuser command',
        performedAt: NOW.toISOString(),
        previousState: null,
        newState: { role: CamsRole.SuperUser, regionId: null, officeCode: null, active: true },
        replacedByAssignmentId: null,
      } satisfies RoleAssignmentAuditEntry,
    ]);
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

    const result = await revokeSuperUser(store, target.id, NOW);

    expect(result.outcome).toEqual('revoked');
    expect(assignments.docs).toEqual([
      { ...granted, active: false, activeKey: `inactive|${granted.id}` },
    ]);
    expect(audits.docs[1]).toEqual(
      expect.objectContaining({
        action: 'DEACTIVATED',
        assignmentId: granted.id,
        previousState: { role: CamsRole.SuperUser, regionId: null, officeCode: null, active: true },
        newState: { role: CamsRole.SuperUser, regionId: null, officeCode: null, active: false },
        replacedByAssignmentId: null,
        performedAt: NOW.toISOString(),
      }),
    );
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
});
