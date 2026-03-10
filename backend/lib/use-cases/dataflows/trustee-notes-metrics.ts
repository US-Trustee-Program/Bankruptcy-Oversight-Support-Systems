import { CamsRole, CamsRoleType, OversightRoles } from '@common/cams/roles';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';

const MODULE_NAME = 'TRUSTEE-NOTES-METRICS-USE-CASE';

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

export type TrusteeNoteMetrics = {
  notesLast24Hrs: number;
  trusteesWithNotes: number;
  notesPerTrustee: Array<{ trusteeId: string; noteCount: number }>;
  uniqueNoteAuthors: number;
  totalTrustees: number;
  trusteesWithNotesPercent: number;
  usersWithNotePermission: number;
  usersWhoCreatedNotes: number;
  userEngagementPercent: number;
};

export class TrusteeNotesMetricsUseCase {
  public async gatherMetrics(context: ApplicationContext): Promise<TrusteeNoteMetrics> {
    const repo = factory.getTrusteeNotesRepository(context);
    const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const notes = await repo.getNotesSince(cutoffIso);

    const trusteesWithNotes = new Set(notes.map((n) => n.trusteeId)).size;

    const countMap = notes.reduce<Map<string, number>>((acc, n) => {
      acc.set(n.trusteeId, (acc.get(n.trusteeId) ?? 0) + 1);
      return acc;
    }, new Map());
    const notesPerTrustee = [...countMap.entries()]
      .map(([trusteeId, noteCount]) => ({ trusteeId, noteCount }))
      .sort((a, b) => b.noteCount - a.noteCount);

    const uniqueNoteAuthors = new Set(notes.map((n) => n.createdBy.id)).size;

    const trusteesRepo = factory.getTrusteesRepository(context);
    const trustees = await trusteesRepo.listTrustees();
    const totalTrustees = trustees.length;

    const storage = factory.getStorageGateway(context);
    const roleMapping = storage.getRoleMapping();
    const targetRoles = new Set<CamsRoleType>([...OversightRoles, CamsRole.TrusteeAdmin]);
    const permissionGroupNames: string[] = [];
    for (const [groupName, role] of roleMapping.entries()) {
      if (targetRoles.has(role)) {
        permissionGroupNames.push(groupName);
      }
    }

    const userGroupsRepo = factory.getUserGroupsRepository(context);
    const groups = await userGroupsRepo.getUserGroupsByNames(context, permissionGroupNames);

    if (groups.length < permissionGroupNames.length) {
      context.logger.warn(MODULE_NAME, 'Some expected permission groups not found', {
        expectedGroupCount: permissionGroupNames.length,
        foundGroupCount: groups.length,
      });
    }

    const permissionedUserIds = new Set<string>();
    for (const group of groups) {
      for (const user of group.users ?? []) {
        permissionedUserIds.add(user.id);
      }
    }
    const usersWithNotePermission = permissionedUserIds.size;

    const trusteesWithNotesPercent =
      totalTrustees === 0 ? 0 : round((trusteesWithNotes / totalTrustees) * 100, 2);

    const usersWhoCreatedNotes = uniqueNoteAuthors;

    const userEngagementPercent =
      usersWithNotePermission === 0
        ? 0
        : round((usersWhoCreatedNotes / usersWithNotePermission) * 100, 2);

    return {
      notesLast24Hrs: notes.length,
      trusteesWithNotes,
      notesPerTrustee,
      uniqueNoteAuthors,
      totalTrustees,
      trusteesWithNotesPercent,
      usersWithNotePermission,
      usersWhoCreatedNotes,
      userEngagementPercent,
    };
  }
}
