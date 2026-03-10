import { CamsRole, CamsRoleType, OversightRoles } from '@common/cams/roles';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';

function toPercent(n: number): number {
  return Math.round(n * 100);
}

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
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const storage = factory.getStorageGateway(context);
    const roleMapping = storage.getRoleMapping();
    const targetRoles = new Set<CamsRoleType>([...OversightRoles, CamsRole.TrusteeAdmin]);
    const permissionGroupNames = [...roleMapping.entries()]
      .filter(([, role]) => targetRoles.has(role))
      .map(([groupName]) => groupName);

    const [notes, trustees, groups] = await Promise.all([
      factory.getTrusteeNotesRepository(context).getNotesSince(twentyFourHoursAgo),
      factory.getTrusteesRepository(context).listTrustees(),
      factory.getUserGroupsRepository(context).getUserGroupsByNames(context, permissionGroupNames),
    ]);

    const trusteesWithNotes = new Set(notes.map((n) => n.trusteeId)).size;

    const countMap = notes.reduce<Map<string, number>>((acc, n) => {
      acc.set(n.trusteeId, (acc.get(n.trusteeId) ?? 0) + 1);
      return acc;
    }, new Map());
    const notesPerTrustee = [...countMap.entries()]
      .map(([trusteeId, noteCount]) => ({ trusteeId, noteCount }))
      .sort((a, b) => b.noteCount - a.noteCount);

    const uniqueNoteAuthors = new Set(notes.map((n) => n.createdBy.id)).size;

    const totalTrustees = trustees.length;

    const permissionedUserIds = new Set<string>();
    for (const group of groups) {
      for (const user of group.users ?? []) {
        permissionedUserIds.add(user.id);
      }
    }
    const usersWithNotePermission = permissionedUserIds.size;

    const trusteesWithNotesPercent =
      totalTrustees === 0 ? 0 : toPercent(trusteesWithNotes / totalTrustees);

    const usersWhoCreatedNotes = uniqueNoteAuthors;

    const userEngagementPercent =
      usersWithNotePermission === 0 ? 0 : toPercent(usersWhoCreatedNotes / usersWithNotePermission);

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
