import { Collection, Document, MongoClient } from 'mongodb';
import { randomUUID } from 'crypto';
import {
  activeKeyFor,
  inactiveKeyFor,
  RoleAssignmentAuditEntry,
  UserRoleAssignment,
} from '../../../../common/src/cams/user-access';
import { CamsRole } from '../../../../common/src/cams/roles';
import { isE2eDatabase } from '../superuser';

/**
 * Temporarily grants, then revokes, an unscoped Super User permission for the shared e2e Okta
 * account by writing directly to Mongo — the same bootstrap the Compass script
 * (dev-tools/superuser/provision-super-user.compass.js) uses in production, since no application
 * API can grant the very first Super User.
 *
 * This runs only in the superuser-setup/superuser-teardown Playwright projects, around the single
 * chromium-superuser project (playwright.config.ts). The regular chromium project's session is
 * already established — and cached by token — before the grant runs, so it never becomes
 * privileged: this direct write, unlike a grant from the Permissions screen, leaves cached sessions
 * in place, so it takes effect only at the next login.
 */

const ACTIVE_KEY = activeKeyFor(CamsRole.SuperUser, null, null);
const PERFORMER = { id: 'E2E_SUPERUSER_SETUP', name: 'E2E SuperUser setup' };

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required to grant/revoke Super User`);
  }
  return value;
}

async function withAssignments<T>(
  fn: (assignments: Collection<Document>, audits: Collection<Document>) => Promise<T>,
): Promise<T> {
  const dbName = requiredEnv('COSMOS_DATABASE_NAME');
  if (!isE2eDatabase(dbName)) {
    throw new Error(`Refusing to grant/revoke Super User outside an e2e database: ${dbName}`);
  }
  const client = await MongoClient.connect(requiredEnv('MONGO_CONNECTION_STRING'));
  try {
    const db = client.db(dbName);
    return await fn(db.collection('user-role-assignments'), db.collection('role-assignment-audit'));
  } finally {
    await client.close();
  }
}

export async function grantSuperUser(userId: string, userName: string): Promise<void> {
  await withAssignments(async (assignments, audits) => {
    const held = await assignments.findOne({
      documentType: 'USER_ROLE_ASSIGNMENT',
      userId,
      activeKey: ACTIVE_KEY,
      active: true,
    });
    // Already held, most likely left over from a prior run whose teardown didn't run; nothing to do.
    if (held) return;

    const assignmentId = randomUUID();
    const performedAt = new Date().toISOString();
    const assignment: UserRoleAssignment = {
      documentType: 'USER_ROLE_ASSIGNMENT',
      id: assignmentId,
      userId,
      userName,
      role: CamsRole.SuperUser,
      regionId: null,
      officeCode: null,
      assignedBy: PERFORMER.id,
      assignedByName: PERFORMER.name,
      assignedAt: performedAt,
      active: true,
      activeKey: ACTIVE_KEY,
    };
    await assignments.insertOne(assignment);

    const audit: RoleAssignmentAuditEntry = {
      documentType: 'ROLE_ASSIGNMENT_AUDIT',
      id: randomUUID(),
      assignmentId,
      action: 'CREATED',
      userId,
      userName,
      role: CamsRole.SuperUser,
      regionId: null,
      officeCode: null,
      performedBy: PERFORMER.id,
      performedByName: PERFORMER.name,
      performedAt,
      previousState: null,
      newState: { role: CamsRole.SuperUser, regionId: null, officeCode: null, active: true },
      replacedByAssignmentId: null,
    };
    await audits.insertOne(audit);
  });
}

export async function revokeSuperUser(userId: string): Promise<void> {
  await withAssignments(async (assignments, audits) => {
    const held = await assignments.findOne({
      documentType: 'USER_ROLE_ASSIGNMENT',
      userId,
      activeKey: ACTIVE_KEY,
      active: true,
    });
    // Nothing held — the grant step didn't run, or a retry already cleaned this up.
    if (!held) return;
    await deactivateWithAudit(assignments, audits, held as unknown as UserRoleAssignment);
  });
}

/**
 * Removes one of the e2e account's own permissions, which the API refuses (a Super User cannot
 * remove their own permissions). Like the grant, it leaves cached sessions in place.
 */
export async function revokePermission(userId: string, assignmentId: string): Promise<void> {
  await withAssignments(async (assignments, audits) => {
    const held = await assignments.findOne({
      documentType: 'USER_ROLE_ASSIGNMENT',
      userId,
      id: assignmentId,
      active: true,
    });
    if (!held) return;
    await deactivateWithAudit(assignments, audits, held as unknown as UserRoleAssignment);
  });
}

async function deactivateWithAudit(
  assignments: Collection<Document>,
  audits: Collection<Document>,
  held: UserRoleAssignment,
): Promise<void> {
  // userId is the collection's shard key.
  await assignments.updateOne(
    { userId: held.userId, id: held.id, active: true },
    { $set: { active: false, activeKey: inactiveKeyFor(held.id) } },
  );

  const scope = { role: held.role, regionId: held.regionId, officeCode: held.officeCode };
  const audit: RoleAssignmentAuditEntry = {
    documentType: 'ROLE_ASSIGNMENT_AUDIT',
    id: randomUUID(),
    assignmentId: held.id,
    action: 'DEACTIVATED',
    userId: held.userId,
    userName: held.userName,
    ...scope,
    performedBy: PERFORMER.id,
    performedByName: 'E2E SuperUser teardown',
    performedAt: new Date().toISOString(),
    previousState: { ...scope, active: true },
    newState: { ...scope, active: false },
    replacedByAssignmentId: null,
  };
  await audits.insertOne(audit);
}
