import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { CamsRole, CamsRoleType, OversightRoles } from '@common/cams/roles';

const OVERSIGHT_USER_ROLES: CamsRoleType[] = [...OversightRoles, CamsRole.TrusteeAdmin];
import { DiagnosticsSnapshot } from '../gateways.types';

async function captureDiagnosticsSnapshot(context: ApplicationContext): Promise<void> {
  const userGroupGateway = await factory.getUserGroupGateway(context);
  const storage = factory.getStorageGateway(context);
  const groupToRoleMap = storage.getRoleMapping();

  const allGroups = await userGroupGateway.getUserGroups(context);
  const roleGroups = allGroups.filter((group) => groupToRoleMap.has(group.name));

  const userIdsByRole = new Map<CamsRoleType, Set<string>>();
  for (const group of roleGroups) {
    const role = groupToRoleMap.get(group.name);
    const users = await userGroupGateway.getUserGroupUsers(context, group);
    if (!userIdsByRole.has(role)) {
      userIdsByRole.set(role, new Set<string>());
    }
    for (const user of users) {
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
}

const DiagnosticsSnapshotUseCase = {
  captureDiagnosticsSnapshot,
};

export default DiagnosticsSnapshotUseCase;
