import { randomUUID } from 'crypto';
import type { Collection } from 'mongodb';
import { CamsRole } from '@common/cams/roles.js';
import {
  activeKeyFor,
  deactivationOf,
  newRoleAssignment,
  roleAssignmentAuditEntry,
  roleAssignmentState,
  type RoleAssignmentAuditEntry,
  type UserRoleAssignment,
} from '@common/cams/user-access.js';

/** The two collections the commands write. mongo-guard.ts decides which Mongo they live in. */
export type SuperUserStore = {
  assignments: Collection<UserRoleAssignment>;
  audits: Collection<RoleAssignmentAuditEntry>;
};

export type SuperUserTarget = { id: string; name: string; email?: string };

const PERFORMER = { id: 'SUPERUSER_COMMAND', name: 'Superuser command' };
const SUPER_USER_KEY = activeKeyFor(CamsRole.SuperUser, null, null);

const activeSuperUser = (userId: string) => ({
  documentType: 'USER_ROLE_ASSIGNMENT' as const,
  userId,
  activeKey: SUPER_USER_KEY,
  active: true,
});

/**
 * Gives the user an unscoped Super User permission, with the same documents the access use case
 * writes. Each grant gets a new id, so granting again after a revoke keeps the old record and its
 * history. There is no Okta "USTP Cams Users" check.
 */
export async function grantSuperUser(
  store: SuperUserStore,
  target: SuperUserTarget,
  now: Date = new Date(),
): Promise<{ outcome: 'granted' | 'already-held'; assignment: UserRoleAssignment }> {
  const held = await store.assignments.findOne(activeSuperUser(target.id));
  if (held) return { outcome: 'already-held', assignment: held };

  const assignedAt = now.toISOString();
  const assignment = newRoleAssignment({
    id: randomUUID(),
    user: target,
    role: CamsRole.SuperUser,
    scope: { regionId: null, officeCode: null },
    assignedBy: PERFORMER,
    assignedAt,
  });
  await store.assignments.insertOne(assignment);
  await store.audits.insertOne(
    roleAssignmentAuditEntry({
      id: randomUUID(),
      action: 'CREATED',
      assignment,
      previousState: null,
      newState: roleAssignmentState(assignment),
      performer: PERFORMER,
      performedAt: assignedAt,
      replacedByAssignmentId: null,
    }),
  );
  return { outcome: 'granted', assignment };
}

/**
 * Deactivates the user's Super User permission (never deletes it) and audits that. Frees the
 * activeKey, so the user can be granted Super User again.
 */
export async function revokeSuperUser(
  store: SuperUserStore,
  userId: string,
  now: Date = new Date(),
): Promise<
  { outcome: 'revoked'; assignment: UserRoleAssignment } | { outcome: 'nothing-to-revoke' }
> {
  const held = await store.assignments.findOne(activeSuperUser(userId));
  if (!held) return { outcome: 'nothing-to-revoke' };

  const revoked = await store.assignments.findOneAndUpdate(
    { userId: held.userId, id: held.id, active: true },
    { $set: deactivationOf(held) },
    { returnDocument: 'after' },
  );
  if (!revoked) return { outcome: 'nothing-to-revoke' };

  await store.audits.insertOne(
    roleAssignmentAuditEntry({
      id: randomUUID(),
      action: 'DEACTIVATED',
      assignment: revoked,
      previousState: roleAssignmentState(held),
      newState: roleAssignmentState(revoked),
      performer: PERFORMER,
      performedAt: now.toISOString(),
      // Revoked, not replaced by a newer permission.
      replacedByAssignmentId: null,
    }),
  );
  return { outcome: 'revoked', assignment: revoked };
}
