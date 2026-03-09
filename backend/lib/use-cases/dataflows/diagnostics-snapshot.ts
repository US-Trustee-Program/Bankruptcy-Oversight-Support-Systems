import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { CamsRole, CamsRoleType, OversightRoles } from '@common/cams/roles';

const OVERSIGHT_USER_ROLES: CamsRoleType[] = [...OversightRoles, CamsRole.TrusteeAdmin];
import { DiagnosticsSnapshot } from '../gateways.types';

async function captureDiagnosticsSnapshot(context: ApplicationContext): Promise<void> {
  const trace = context.observability.startTrace(context.invocationId);

  try {
    const userGroupsRepository = factory.getUserGroupsRepository(context);
    const storage = factory.getStorageGateway(context);
    const groupToRoleMap = storage.getRoleMapping();

    const groupNames = Array.from(groupToRoleMap.keys());
    const roleGroups = await userGroupsRepository.getUserGroupsByNames(context, groupNames);

    const userIdsByRole = new Map<CamsRoleType, Set<string>>();
    for (const group of roleGroups) {
      const role = groupToRoleMap.get(group.groupName);
      if (!userIdsByRole.has(role)) {
        userIdsByRole.set(role, new Set<string>());
      }
      for (const user of group.users) {
        userIdsByRole.get(role).add(user.id);
      }
    }

    const userCountByRole: Record<string, number> = {};
    for (const [role, userIds] of userIdsByRole) {
      userCountByRole[role] = userIds.size;
    }

    const oversightUserIds = new Set<string>();
    for (const role of OVERSIGHT_USER_ROLES) {
      for (const id of userIdsByRole.get(role) ?? []) {
        oversightUserIds.add(id);
      }
    }

    const snapshot: DiagnosticsSnapshot = {
      documentType: 'DIAGNOSTICS_SNAPSHOT',
      snapshotDate: new Date().toISOString().split('T')[0],
      userCountByRole,
      oversightUserCount: oversightUserIds.size,
    };

    const repository = factory.getDiagnosticsSnapshotRepository(context);
    await repository.create(snapshot);

    context.observability.completeTrace(trace, 'diagnostics-snapshot', {
      success: true,
      properties: {
        oversightUserCount: String(snapshot.oversightUserCount),
        snapshotDate: snapshot.snapshotDate,
      },
      measurements: {},
    });
  } catch (originalError) {
    context.observability.completeTrace(trace, 'diagnostics-snapshot', {
      success: false,
      properties: {},
      measurements: {},
      error: String(originalError),
    });
    throw originalError;
  }
}

const DiagnosticsSnapshotUseCase = {
  captureDiagnosticsSnapshot,
};

export default DiagnosticsSnapshotUseCase;
