import { randomUUID } from 'crypto';
import type { Collection } from 'mongodb';
import { CamsRole } from '@common/cams/roles.js';
import {
  activeKeyFor,
  inactiveKeyFor,
  type RoleAssignmentAuditEntry,
  type UserRoleAssignment,
} from '@common/cams/user-access.js';

/** The two collections the commands write. Local Mongo only; see local-mongo-guard.ts. */
export type SuperUserStore = {
  assignments: Collection<UserRoleAssignment>;
  audits: Collection<RoleAssignmentAuditEntry>;
};

export type SuperUserTarget = { id: string; name: string; email?: string };

const PERFORMER = { id: 'SYSTEM_SEED', name: 'Local superuser command' };
const SUPER_USER_KEY = activeKeyFor(CamsRole.SuperUser, null, null);
const SCOPE = { role: CamsRole.SuperUser, regionId: null, officeCode: null };

function audit(
  action: RoleAssignmentAuditEntry['action'],
  assignment: UserRoleAssignment,
  previousActive: boolean | null,
  now: string,
): RoleAssignmentAuditEntry {
  return {
    documentType: 'ROLE_ASSIGNMENT_AUDIT',
    // The seed- prefix lets unseed clear local Super Users with the rest of the seed data.
    id: `seed-superuser-audit-${randomUUID()}`,
    assignmentId: assignment.id,
    action,
    userId: assignment.userId,
    userName: assignment.userName,
    ...SCOPE,
    performedBy: PERFORMER.id,
    performedByName: PERFORMER.name,
    performedAt: now,
    previousState: previousActive === null ? null : { ...SCOPE, active: previousActive },
    newState: { ...SCOPE, active: assignment.active },
    replacedByAssignmentId: null,
  };
}

const activeSuperUser = (userId: string) => ({
  documentType: 'USER_ROLE_ASSIGNMENT' as const,
  userId,
  activeKey: SUPER_USER_KEY,
  active: true,
});

/**
 * Gives the user an unscoped Super User permission, with the same documents the access use case
 * writes. Each grant gets a new id, so granting again after a revoke keeps the old record and its
 * history. There is no Okta "USTP Cams Users" check locally.
 */
export async function grantSuperUser(
  store: SuperUserStore,
  target: SuperUserTarget,
  now: Date = new Date(),
): Promise<{ outcome: 'granted' | 'already-held'; assignment: UserRoleAssignment }> {
  const held = await store.assignments.findOne(activeSuperUser(target.id));
  if (held) return { outcome: 'already-held', assignment: held };

  const assignedAt = now.toISOString();
  const assignment: UserRoleAssignment = {
    documentType: 'USER_ROLE_ASSIGNMENT',
    id: `seed-superuser-${randomUUID()}`,
    userId: target.id,
    userName: target.name,
    ...(target.email ? { email: target.email } : {}),
    ...SCOPE,
    assignedBy: PERFORMER.id,
    assignedByName: PERFORMER.name,
    assignedAt,
    expiresAt: null,
    active: true,
    activeKey: SUPER_USER_KEY,
  };
  await store.assignments.insertOne(assignment);
  await store.audits.insertOne(audit('CREATED', assignment, null, assignedAt));
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
    { id: held.id, active: true },
    { $set: { active: false, activeKey: inactiveKeyFor(held.id) } },
    { returnDocument: 'after' },
  );
  if (!revoked) return { outcome: 'nothing-to-revoke' };

  await store.audits.insertOne(audit('DEACTIVATED', revoked, true, now.toISOString()));
  return { outcome: 'revoked', assignment: revoked };
}
