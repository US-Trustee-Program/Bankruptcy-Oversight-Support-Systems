import { RoleAssignmentAuditEntry } from '@common/cams/user-access';
import { CamsRole } from '@common/cams/roles';
import { MockMongoRepository } from './mock-mongo.repository';

// The DATABASE_MOCK store stands in for RoleAssignmentAuditMongoRepository.search: these cover its
// ordering and the userIds filter no use case sends yet; the use-case tests cover paging.
describe('MockMongoRepository role-assignment audit search', () => {
  const repo = new MockMongoRepository();

  function audit(
    id: string,
    userId: string,
    performedAt: string,
    action: RoleAssignmentAuditEntry['action'] = 'CREATED',
  ): RoleAssignmentAuditEntry {
    return {
      documentType: 'ROLE_ASSIGNMENT_AUDIT',
      id,
      assignmentId: `assignment-${id}`,
      action,
      userId,
      userName: userId,
      role: CamsRole.Auditor,
      regionId: null,
      officeCode: null,
      performedBy: 'super-1',
      performedByName: 'Maria Garcia',
      performedAt,
      previousState: null,
      newState: { role: CamsRole.Auditor, regionId: null, officeCode: null, active: true },
      replacedByAssignmentId: null,
    };
  }

  beforeEach(async () => {
    MockMongoRepository.clearRoleAssignments();
    for (const entry of [
      audit('a1', 'user-a', '2026-11-01T10:00:00.000Z'),
      audit('b2', 'user-b', '2026-11-02T10:00:00.000Z'),
      audit('a3', 'user-a', '2026-11-03T10:00:00.000Z'),
    ]) {
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

  test('should order records made at the same moment DEACTIVATED first, then by id, highest first', async () => {
    MockMongoRepository.clearRoleAssignments();
    const sameMoment = '2026-11-04T10:00:00.000Z';
    for (const entry of [
      audit('c1', 'user-c', sameMoment),
      audit('c2', 'user-c', sameMoment, 'DEACTIVATED'),
      audit('c3', 'user-c', sameMoment),
    ]) {
      await repo.create(entry);
    }

    const page = await repo.search({ limit: 20, offset: 0 });

    expect(page.data.map((entry: RoleAssignmentAuditEntry) => entry.id)).toEqual([
      'c2',
      'c3',
      'c1',
    ]);
  });
});
