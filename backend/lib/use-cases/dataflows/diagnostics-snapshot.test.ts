import { vi } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import factory from '../../factory';
import { CamsRole } from '@common/cams/roles';
import { CamsUserReference } from '@common/cams/users';
import {
  DiagnosticsSnapshot,
  DiagnosticsSnapshotRepository,
  ObservabilityGateway,
  ObservabilityTrace,
} from '../gateways.types';
import { UserGroupGateway } from '../../adapters/types/authorization';
import { StorageGateway } from '../../adapters/types/storage';
import DiagnosticsSnapshotUseCase from './diagnostics-snapshot';

describe('DiagnosticsSnapshotUseCase', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeUser(id: string): CamsUserReference {
    return { id, name: `User ${id}` };
  }

  function makeMockUserGroupGateway(
    groupUsers: Record<string, CamsUserReference[]>,
  ): UserGroupGateway {
    return {
      getUserGroups: vi
        .fn()
        .mockResolvedValue(Object.keys(groupUsers).map((name) => ({ id: name, name }))),
      getUserGroupUsers: vi
        .fn()
        .mockImplementation((_ctx, group) => Promise.resolve(groupUsers[group.name] ?? [])),
      getUserGroupWithUsers: vi.fn(),
      getUserById: vi.fn(),
    };
  }

  function makeMockStorageGateway(entries: [string, string][]): StorageGateway {
    return {
      getRoleMapping: vi.fn().mockReturnValue(new Map(entries)),
      get: vi.fn(),
      getPrivilegedIdentityUserRoleGroupName: vi.fn(),
    };
  }

  test('should insert a snapshot with user counts per role and oversightUserCount', async () => {
    const user1 = makeUser('u1');
    const user2 = makeUser('u2');
    const user3 = makeUser('u3');

    const groupUsers = {
      'USTP CAMS Trial Attorney': [user1, user2],
      'USTP CAMS TrusteeAdmin': [user3],
    };

    const context = await createMockApplicationContext();
    vi.spyOn(factory, 'getUserGroupGateway').mockResolvedValue(
      makeMockUserGroupGateway(groupUsers),
    );
    vi.spyOn(factory, 'getStorageGateway').mockReturnValue(
      makeMockStorageGateway([
        ['USTP CAMS Trial Attorney', CamsRole.OversightAttorney],
        ['USTP CAMS TrusteeAdmin', CamsRole.TrusteeAdmin],
      ]),
    );

    let capturedSnapshot: DiagnosticsSnapshot | undefined;
    const mockRepository: DiagnosticsSnapshotRepository = {
      create: vi.fn().mockImplementation(async (snapshot: DiagnosticsSnapshot) => {
        capturedSnapshot = snapshot;
      }),
    };
    vi.spyOn(factory, 'getDiagnosticsSnapshotRepository').mockReturnValue(mockRepository);

    await DiagnosticsSnapshotUseCase.captureDiagnosticsSnapshot(context);

    expect(mockRepository.create).toHaveBeenCalledOnce();
    expect(capturedSnapshot).toMatchObject({
      documentType: 'DIAGNOSTICS_SNAPSHOT',
      snapshotDate: expect.any(String),
      userCountByRole: {
        [CamsRole.OversightAttorney]: 2,
        [CamsRole.TrusteeAdmin]: 1,
      },
      oversightUserCount: 3,
    });
  });

  test('should deduplicate users with multiple oversight roles in oversightUserCount', async () => {
    const sharedUser = makeUser('shared');
    const exclusiveUser = makeUser('exclusive');

    const groupUsers = {
      'USTP CAMS Trial Attorney': [sharedUser, exclusiveUser],
      'USTP CAMS TrusteeAdmin': [sharedUser],
    };

    const context = await createMockApplicationContext();
    vi.spyOn(factory, 'getUserGroupGateway').mockResolvedValue(
      makeMockUserGroupGateway(groupUsers),
    );
    vi.spyOn(factory, 'getStorageGateway').mockReturnValue(
      makeMockStorageGateway([
        ['USTP CAMS Trial Attorney', CamsRole.OversightAttorney],
        ['USTP CAMS TrusteeAdmin', CamsRole.TrusteeAdmin],
      ]),
    );

    let capturedSnapshot: DiagnosticsSnapshot | undefined;
    const mockRepository: DiagnosticsSnapshotRepository = {
      create: vi.fn().mockImplementation(async (snapshot: DiagnosticsSnapshot) => {
        capturedSnapshot = snapshot;
      }),
    };
    vi.spyOn(factory, 'getDiagnosticsSnapshotRepository').mockReturnValue(mockRepository);

    await DiagnosticsSnapshotUseCase.captureDiagnosticsSnapshot(context);

    expect(capturedSnapshot!.oversightUserCount).toBe(2);
    expect(capturedSnapshot!.userCountByRole[CamsRole.OversightAttorney]).toBe(2);
    expect(capturedSnapshot!.userCountByRole[CamsRole.TrusteeAdmin]).toBe(1);
  });

  test('should include snapshotDate as a date-only string (YYYY-MM-DD)', async () => {
    const context = await createMockApplicationContext();
    vi.spyOn(factory, 'getUserGroupGateway').mockResolvedValue(makeMockUserGroupGateway({}));
    vi.spyOn(factory, 'getStorageGateway').mockReturnValue(makeMockStorageGateway([]));

    let capturedSnapshot: DiagnosticsSnapshot | undefined;
    const mockRepository: DiagnosticsSnapshotRepository = {
      create: vi.fn().mockImplementation(async (snapshot: DiagnosticsSnapshot) => {
        capturedSnapshot = snapshot;
      }),
    };
    vi.spyOn(factory, 'getDiagnosticsSnapshotRepository').mockReturnValue(mockRepository);

    await DiagnosticsSnapshotUseCase.captureDiagnosticsSnapshot(context);

    expect(capturedSnapshot!.snapshotDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('should not count non-oversight roles toward oversightUserCount', async () => {
    const user = makeUser('u1');

    const groupUsers = {
      'USTP CAMS Trial Attorney': [user],
      'USTP CAMS SuperUser': [user],
    };

    const context = await createMockApplicationContext();
    vi.spyOn(factory, 'getUserGroupGateway').mockResolvedValue(
      makeMockUserGroupGateway(groupUsers),
    );
    vi.spyOn(factory, 'getStorageGateway').mockReturnValue(
      makeMockStorageGateway([
        ['USTP CAMS Trial Attorney', CamsRole.OversightAttorney],
        ['USTP CAMS SuperUser', CamsRole.SuperUser],
      ]),
    );

    let capturedSnapshot: DiagnosticsSnapshot | undefined;
    const mockRepository: DiagnosticsSnapshotRepository = {
      create: vi.fn().mockImplementation(async (snapshot: DiagnosticsSnapshot) => {
        capturedSnapshot = snapshot;
      }),
    };
    vi.spyOn(factory, 'getDiagnosticsSnapshotRepository').mockReturnValue(mockRepository);

    await DiagnosticsSnapshotUseCase.captureDiagnosticsSnapshot(context);

    expect(capturedSnapshot!.oversightUserCount).toBe(1);
  });

  test('should emit a diagnostics-snapshot telemetry event with oversightUserCount on success', async () => {
    const user1 = makeUser('u1');
    const user2 = makeUser('u2');

    const groupUsers = {
      'USTP CAMS Trial Attorney': [user1, user2],
    };

    const mockTrace: ObservabilityTrace = {
      invocationId: 'mock-invocation',
      instanceId: 'local',
      startTime: Date.now(),
    };
    const mockObservability: ObservabilityGateway = {
      startTrace: vi.fn().mockReturnValue(mockTrace),
      completeTrace: vi.fn(),
    };

    const context = await createMockApplicationContext();
    context.observability = mockObservability;

    vi.spyOn(factory, 'getUserGroupGateway').mockResolvedValue(
      makeMockUserGroupGateway(groupUsers),
    );
    vi.spyOn(factory, 'getStorageGateway').mockReturnValue(
      makeMockStorageGateway([['USTP CAMS Trial Attorney', CamsRole.OversightAttorney]]),
    );
    vi.spyOn(factory, 'getDiagnosticsSnapshotRepository').mockReturnValue({
      create: vi.fn(),
    });

    await DiagnosticsSnapshotUseCase.captureDiagnosticsSnapshot(context);

    expect(mockObservability.startTrace).toHaveBeenCalledWith(context.invocationId);
    expect(mockObservability.completeTrace).toHaveBeenCalledWith(
      mockTrace,
      'diagnostics-snapshot',
      expect.objectContaining({
        success: true,
        properties: expect.objectContaining({
          oversightUserCount: '2',
        }),
      }),
    );
  });

  test('should emit a diagnostics-snapshot telemetry event with success=false when an error occurs', async () => {
    const mockTrace: ObservabilityTrace = {
      invocationId: 'mock-invocation',
      instanceId: 'local',
      startTime: Date.now(),
    };
    const mockObservability: ObservabilityGateway = {
      startTrace: vi.fn().mockReturnValue(mockTrace),
      completeTrace: vi.fn(),
    };

    const context = await createMockApplicationContext();
    context.observability = mockObservability;

    vi.spyOn(factory, 'getUserGroupGateway').mockRejectedValue(new Error('IdP unavailable'));

    await expect(DiagnosticsSnapshotUseCase.captureDiagnosticsSnapshot(context)).rejects.toThrow(
      'IdP unavailable',
    );

    expect(mockObservability.completeTrace).toHaveBeenCalledWith(
      mockTrace,
      'diagnostics-snapshot',
      expect.objectContaining({
        success: false,
      }),
    );
  });
});
