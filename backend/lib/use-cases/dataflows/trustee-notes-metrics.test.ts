import { vi } from 'vitest';
import MockData from '@common/cams/test-utilities/mock-data';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeNotesMetricsUseCase } from './trustee-notes-metrics';
import factory from '../../factory';
import {
  TrusteeNotesRepository,
  TrusteesRepository,
  UserGroupsRepository,
} from '../gateways.types';
import { StorageGateway } from '../../adapters/types/storage';
import { UserGroup } from '@common/cams/users';
import { CamsRole, CamsRoleType, OversightRoles } from '@common/cams/roles';

const OVERSIGHT_USER_ROLES: CamsRoleType[] = [...OversightRoles, CamsRole.TrusteeAdmin];

const ALL_PERMISSION_GROUPS: UserGroup[] = [
  { id: 'g1', groupName: 'USTP CAMS Trustee Admin', users: [] },
  { id: 'g2', groupName: 'USTP CAMS Trial Attorney', users: [] },
  { id: 'g3', groupName: 'USTP CAMS Auditor', users: [] },
  { id: 'g4', groupName: 'USTP CAMS Paralegal', users: [] },
];

function makeRoleMapping(): Map<string, CamsRoleType> {
  return new Map([
    ['USTP CAMS Trustee Admin', CamsRole.TrusteeAdmin],
    ['USTP CAMS Trial Attorney', CamsRole.TrialAttorney],
    ['USTP CAMS Auditor', CamsRole.Auditor],
    ['USTP CAMS Paralegal', CamsRole.Paralegal],
  ]);
}

function makeUserGroup(groupName: string, userIds: string[]): UserGroup {
  return {
    id: groupName,
    groupName,
    users: userIds.map((id) => ({ id, name: `User ${id}` })),
  };
}

describe('TrusteeNotesMetricsUseCase', () => {
  let context: ApplicationContext;
  let mockNotesRepo: Partial<TrusteeNotesRepository>;
  let mockTrusteesRepo: Partial<TrusteesRepository>;
  let mockUserGroupsRepo: Partial<UserGroupsRepository>;
  let mockStorage: Partial<StorageGateway>;

  beforeEach(async () => {
    context = await createMockApplicationContext();

    mockNotesRepo = { getNotesSince: vi.fn().mockResolvedValue([]), release: vi.fn() };
    mockTrusteesRepo = { listTrustees: vi.fn().mockResolvedValue([]), release: vi.fn() };
    mockUserGroupsRepo = {
      getUserGroupsByNames: vi.fn().mockResolvedValue(ALL_PERMISSION_GROUPS),
      release: vi.fn(),
    };
    mockStorage = { getRoleMapping: vi.fn().mockReturnValue(makeRoleMapping()) };

    vi.spyOn(factory, 'getTrusteeNotesRepository').mockReturnValue(
      mockNotesRepo as TrusteeNotesRepository,
    );
    vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
      mockTrusteesRepo as TrusteesRepository,
    );
    vi.spyOn(factory, 'getUserGroupsRepository').mockReturnValue(
      mockUserGroupsRepo as UserGroupsRepository,
    );
    vi.spyOn(factory, 'getStorageGateway').mockReturnValue(mockStorage as StorageGateway);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Slice 1 metrics', () => {
    test('should compute note volume metrics from notes in the last 24 hours', async () => {
      const trusteeId1 = 'trustee-1';
      const trusteeId2 = 'trustee-2';
      const authorId1 = 'author-1';
      const authorId2 = 'author-2';

      vi.mocked(mockNotesRepo.getNotesSince).mockResolvedValue([
        MockData.getTrusteeNote({
          trusteeId: trusteeId1,
          createdBy: { id: authorId1, name: 'Author One' },
        }),
        MockData.getTrusteeNote({
          trusteeId: trusteeId1,
          createdBy: { id: authorId1, name: 'Author One' },
        }),
        MockData.getTrusteeNote({
          trusteeId: trusteeId2,
          createdBy: { id: authorId2, name: 'Author Two' },
        }),
      ]);

      const metrics = await new TrusteeNotesMetricsUseCase().gatherMetrics(context);

      expect(metrics.notesLast24Hrs).toBe(3);
      expect(metrics.trusteesWithNotes).toBe(2);
      expect(metrics.uniqueNoteAuthors).toBe(2);
      expect(metrics.notesPerTrustee).toEqual([
        { trusteeId: trusteeId1, noteCount: 2 },
        { trusteeId: trusteeId2, noteCount: 1 },
      ]);
      expect(mockNotesRepo.getNotesSince).toHaveBeenCalledTimes(1);
      expect(mockNotesRepo.release).toHaveBeenCalled();
    });

    test('should return zero note metrics when no notes exist in last 24 hours', async () => {
      const metrics = await new TrusteeNotesMetricsUseCase().gatherMetrics(context);

      expect(metrics.notesLast24Hrs).toBe(0);
      expect(metrics.trusteesWithNotes).toBe(0);
      expect(metrics.uniqueNoteAuthors).toBe(0);
      expect(metrics.notesPerTrustee).toEqual([]);
    });

    test('should propagate repository errors', async () => {
      vi.mocked(mockNotesRepo.getNotesSince).mockRejectedValue(new Error('DB connection failed'));

      await expect(new TrusteeNotesMetricsUseCase().gatherMetrics(context)).rejects.toThrow(
        'DB connection failed',
      );
    });
  });

  describe('Slice 2 metrics', () => {
    test('should compute trustee coverage and user engagement on happy path', async () => {
      vi.mocked(mockNotesRepo.getNotesSince).mockResolvedValue([
        MockData.getTrusteeNote({
          trusteeId: 'trustee-1',
          createdBy: { id: 'user-1', name: 'U1' },
        }),
        MockData.getTrusteeNote({
          trusteeId: 'trustee-2',
          createdBy: { id: 'user-2', name: 'U2' },
        }),
      ]);
      vi.mocked(mockTrusteesRepo.listTrustees).mockResolvedValue([
        MockData.getTrustee(),
        MockData.getTrustee(),
        MockData.getTrustee(),
        MockData.getTrustee(),
      ]);
      vi.mocked(mockUserGroupsRepo.getUserGroupsByNames).mockResolvedValue([
        makeUserGroup('USTP CAMS Trustee Admin', ['user-1', 'user-2', 'user-3', 'user-4']),
        makeUserGroup('USTP CAMS Trial Attorney', ['user-5']),
      ]);

      const metrics = await new TrusteeNotesMetricsUseCase().gatherMetrics(context);

      expect(metrics.totalTrustees).toBe(4);
      expect(metrics.trusteesWithNotes).toBe(2);
      expect(metrics.trusteesWithNotesPercent).toBe(50);
      expect(metrics.usersWithNotePermission).toBe(5);
      expect(metrics.usersWhoCreatedNotes).toBe(2);
      expect(metrics.userEngagementPercent).toBe(40);
    });

    test('should return trusteesWithNotesPercent of 0 when totalTrustees is 0', async () => {
      const metrics = await new TrusteeNotesMetricsUseCase().gatherMetrics(context);

      expect(metrics.totalTrustees).toBe(0);
      expect(metrics.trusteesWithNotesPercent).toBe(0);
    });

    test('should return userEngagementPercent of 0 when usersWithNotePermission is 0', async () => {
      vi.mocked(mockNotesRepo.getNotesSince).mockResolvedValue([
        MockData.getTrusteeNote({ createdBy: { id: 'user-1', name: 'U1' } }),
      ]);
      vi.mocked(mockTrusteesRepo.listTrustees).mockResolvedValue([MockData.getTrustee()]);
      vi.mocked(mockUserGroupsRepo.getUserGroupsByNames).mockResolvedValue([]);

      const metrics = await new TrusteeNotesMetricsUseCase().gatherMetrics(context);

      expect(metrics.usersWithNotePermission).toBe(0);
      expect(metrics.userEngagementPercent).toBe(0);
    });

    test('should log warning when some permission groups are missing', async () => {
      vi.mocked(mockUserGroupsRepo.getUserGroupsByNames).mockResolvedValue([
        makeUserGroup('USTP CAMS Trustee Admin', ['user-1']),
      ]);
      const warnSpy = vi.spyOn(context.logger, 'warn');

      await new TrusteeNotesMetricsUseCase().gatherMetrics(context);

      expect(warnSpy).toHaveBeenCalledWith(
        'TRUSTEE-NOTES-METRICS-USE-CASE',
        'Some expected permission groups not found',
        expect.objectContaining({
          expectedGroupCount: OVERSIGHT_USER_ROLES.length,
          foundGroupCount: 1,
        }),
      );
    });

    test('should deduplicate users appearing in multiple groups', async () => {
      vi.mocked(mockUserGroupsRepo.getUserGroupsByNames).mockResolvedValue([
        makeUserGroup('USTP CAMS Trustee Admin', ['user-1', 'user-2']),
        makeUserGroup('USTP CAMS Trial Attorney', ['user-2', 'user-3']),
      ]);

      const metrics = await new TrusteeNotesMetricsUseCase().gatherMetrics(context);

      expect(metrics.usersWithNotePermission).toBe(3);
    });

    test('should return usersWithNotePermission of 0 when no groups match target roles', async () => {
      mockStorage.getRoleMapping = vi
        .fn()
        .mockReturnValue(new Map([['USTP CAMS Super User', CamsRole.SuperUser]]));
      const warnSpy = vi.spyOn(context.logger, 'warn');

      const metrics = await new TrusteeNotesMetricsUseCase().gatherMetrics(context);

      expect(metrics.usersWithNotePermission).toBe(0);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    test('usersWhoCreatedNotes should equal uniqueNoteAuthors', async () => {
      vi.mocked(mockNotesRepo.getNotesSince).mockResolvedValue([
        MockData.getTrusteeNote({ createdBy: { id: 'author-1', name: 'A1' } }),
        MockData.getTrusteeNote({ createdBy: { id: 'author-2', name: 'A2' } }),
      ]);

      const metrics = await new TrusteeNotesMetricsUseCase().gatherMetrics(context);

      expect(metrics.usersWhoCreatedNotes).toBe(metrics.uniqueNoteAuthors);
    });
  });
});
