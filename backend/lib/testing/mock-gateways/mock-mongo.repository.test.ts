import { RoleAssignmentAuditEntry } from '@common/cams/user-access';
import { CamsRole } from '@common/cams/roles';
import { MockMongoRepository } from './mock-mongo.repository';

// The DATABASE_MOCK store stands in for RoleAssignmentAuditMongoRepository.search; the use-case
// tests cover its ordering and paging, and these cover the userIds filter no use case sends yet.
describe('MockMongoRepository role-assignment audit search', () => {
  const repo = new MockMongoRepository();

  function audit(id: string, userId: string): RoleAssignmentAuditEntry {
    return {
      documentType: 'ROLE_ASSIGNMENT_AUDIT',
      id,
      assignmentId: `assignment-${id}`,
      action: 'CREATED',
      userId,
      userName: userId,
      role: CamsRole.Auditor,
      regionId: null,
      officeCode: null,
      performedBy: 'super-1',
      performedByName: 'Maria Garcia',
      performedAt: `2026-11-0${id.slice(-1)}T10:00:00.000Z`,
      previousState: null,
      newState: { role: CamsRole.Auditor, regionId: null, officeCode: null, active: true },
      replacedByAssignmentId: null,
    };
  }

  beforeEach(async () => {
    MockMongoRepository.clearRoleAssignments();
    for (const entry of [audit('a1', 'user-a'), audit('b2', 'user-b'), audit('a3', 'user-a')]) {
      await repo.create(entry);
    }
  });

  test("should return only the named users' records, newest first, with their total", async () => {
    const page = await repo.search({ limit: 20, offset: 0, userIds: ['user-a'] });

    expect(page.metadata.total).toEqual(2);
    expect(page.data.map((entry: RoleAssignmentAuditEntry) => entry.id)).toEqual(['a3', 'a1']);
  });

  test('should return an empty page for an empty list of users', async () => {
    const page = await repo.search({ limit: 20, offset: 0, userIds: [] });

    expect(page).toEqual({ metadata: { total: 0 }, data: [] });
  });

  test('should return every record when no users are named', async () => {
    const page = await repo.search({ limit: 20, offset: 0 });

    expect(page.metadata.total).toEqual(3);
  });
});
