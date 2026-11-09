/**
 * Scenario: access-management
 * Database: cams only
 *
 * Seeds one active Super User permission (CAMS-940), so a developer can reach
 * Administration > Permissions once sessions are built from role assignments
 * (flag `cams-role-assignments` on):
 *
 *   - One USER_ROLE_ASSIGNMENT: role SuperUser, no scope (regionId/officeCode null)
 *   - The matching ROLE_ASSIGNMENT_AUDIT record (action CREATED)
 *
 * The seeded user defaults to the shared Flexion Team account (doj-ustp-cms-team@flexion.us) in
 * the Flexion dev Okta org. To seed a different user, set:
 *
 *   SEED_SUPERUSER_ID     Okta user id (00u...): the access token's `uid` claim, which is also
 *                         the userinfo `sub` CAMS uses as the session user id
 *   SEED_SUPERUSER_NAME   display name
 *   SEED_SUPERUSER_EMAIL  email
 *
 * Document ids and timestamps are fixed, so a re-run upserts the same two documents.
 */

import { CamsRole } from '@common/cams/roles.js';
import {
  activeKeyFor,
  type RoleAssignmentAuditEntry,
  type UserRoleAssignment,
} from '@common/cams/user-access.js';
import type { SeedContext, SeedOperation } from '../../runner.js';

const SEEDER = { id: 'SYSTEM_SEED', name: 'Test Data Seeder' };
const SEEDED_AT = '2026-01-01T00:00:00.000Z';
const FLEXION_TEAM = {
  id: '00uxy2nwugG682IKt697',
  name: 'Flexion Team',
  email: 'doj-ustp-cms-team@flexion.us',
};

/** An unset or blank variable (e.g. `SEED_SUPERUSER_ID=` in .env) uses the fallback. */
function envOr(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

export async function generate(_ctx: SeedContext): Promise<SeedOperation[]> {
  const userId = envOr('SEED_SUPERUSER_ID', FLEXION_TEAM.id);
  const userName = envOr('SEED_SUPERUSER_NAME', FLEXION_TEAM.name);
  const email = envOr('SEED_SUPERUSER_EMAIL', FLEXION_TEAM.email);

  const assignment: UserRoleAssignment = {
    documentType: 'USER_ROLE_ASSIGNMENT',
    id: 'seed-role-assignment-superuser-001',
    userId,
    userName,
    email,
    role: CamsRole.SuperUser,
    regionId: null,
    officeCode: null,
    assignedBy: SEEDER.id,
    assignedByName: SEEDER.name,
    assignedAt: SEEDED_AT,
    expiresAt: null,
    active: true,
    activeKey: activeKeyFor(CamsRole.SuperUser, null, null),
  };

  const audit: RoleAssignmentAuditEntry = {
    documentType: 'ROLE_ASSIGNMENT_AUDIT',
    id: 'seed-role-assignment-audit-superuser-001',
    assignmentId: assignment.id,
    action: 'CREATED',
    userId,
    userName,
    role: assignment.role,
    regionId: null,
    officeCode: null,
    performedBy: SEEDER.id,
    performedByName: SEEDER.name,
    performedAt: SEEDED_AT,
    previousState: null,
    newState: { role: assignment.role, regionId: null, officeCode: null, active: true },
    replacedByAssignmentId: null,
  };

  return [
    { db: 'cams', collectionOrTable: 'user-role-assignments', data: [assignment] },
    { db: 'cams', collectionOrTable: 'role-assignment-audit', data: [audit] },
  ];
}
