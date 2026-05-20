import { vi, describe, test, expect, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import * as MigrateTrusteesUseCase from '../../../lib/use-cases/dataflows/migrate-trustees';
import * as MigrationStateService from '../../../lib/use-cases/dataflows/trustee-migration-state.service';
import { TrusteeMigrationState } from '../../../lib/use-cases/dataflows/trustee-migration-state.service';
import { handleStart, handlePage } from './migrate-trustees';

function makeMockInvocationContext(): InvocationContext {
  const extraOutputsMap = new Map();
  return {
    invocationId: 'test-invocation-id',
    functionName: 'migrate-trustees',
    extraOutputs: {
      set: vi.fn((key, value) => extraOutputsMap.set(key, value)),
      get: vi.fn((key) => extraOutputsMap.get(key)),
      _map: extraOutputsMap,
    },
    log: vi.fn(),
  } as unknown as InvocationContext;
}

function getExtraOutputsMap(ctx: InvocationContext): Map<unknown, unknown> {
  return (ctx.extraOutputs as unknown as { _map: Map<unknown, unknown> })._map;
}

function getCursorMessages(ctx: InvocationContext): unknown[] {
  const map = getExtraOutputsMap(ctx);
  return [...map.values()].filter(
    (v) => v !== null && typeof v === 'object' && 'lastId' in (v as object),
  );
}

function makeInProgressState(
  overrides: Partial<TrusteeMigrationState> = {},
): TrusteeMigrationState {
  return {
    documentType: 'TRUSTEE_MIGRATION_STATE',
    lastTrusteeId: null,
    processedCount: 0,
    appointmentsProcessedCount: 0,
    ambiguousCount: 0,
    errors: 0,
    startedAt: '2024-01-01T00:00:00Z',
    lastUpdatedAt: '2024-01-01T00:00:00Z',
    status: 'IN_PROGRESS',
    divisionMappingVersion: '1.0.0',
    ...overrides,
  };
}

describe('migrate-trustees function app', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await createMockApplicationContext();
  });

  describe('handleStart', () => {
    test('queues cursor with importAll=true when start message has importAll=true', async () => {
      vi.spyOn(MigrationStateService, 'getOrCreateMigrationState').mockResolvedValue({
        data: null,
      });

      const ctx = makeMockInvocationContext();
      await handleStart({ importAll: true }, ctx);

      const cursors = getCursorMessages(ctx);
      expect(cursors).toHaveLength(1);
      expect(cursors[0]).toMatchObject({ lastId: null, importAll: true });
    });

    test('queues cursor without importAll when start message omits importAll', async () => {
      vi.spyOn(MigrationStateService, 'getOrCreateMigrationState').mockResolvedValue({
        data: null,
      });

      const ctx = makeMockInvocationContext();
      await handleStart({}, ctx);

      const cursors = getCursorMessages(ctx);
      expect(cursors).toHaveLength(1);
      expect(cursors[0]).toMatchObject({ lastId: null });
      expect((cursors[0] as { importAll?: boolean }).importAll).toBeUndefined();
    });
  });

  describe('handlePage', () => {
    test('passes importAll=true to getPageOfTrustees when cursor has importAll=true', async () => {
      vi.spyOn(MigrationStateService, 'getOrCreateMigrationState').mockResolvedValue({
        data: makeInProgressState(),
      });
      const getPageSpy = vi
        .spyOn(MigrateTrusteesUseCase, 'getPageOfTrustees')
        .mockResolvedValue({ data: { trustees: [], hasMore: false, totalProcessed: 0 } });
      vi.spyOn(MigrationStateService, 'completeMigration').mockResolvedValue({ data: undefined });

      const ctx = makeMockInvocationContext();
      await handlePage({ lastId: null, importAll: true }, ctx);

      expect(getPageSpy).toHaveBeenCalledWith(expect.anything(), null, expect.any(Number), true);
    });

    test('passes importAll=undefined to getPageOfTrustees when cursor omits importAll', async () => {
      vi.spyOn(MigrationStateService, 'getOrCreateMigrationState').mockResolvedValue({
        data: makeInProgressState(),
      });
      const getPageSpy = vi
        .spyOn(MigrateTrusteesUseCase, 'getPageOfTrustees')
        .mockResolvedValue({ data: { trustees: [], hasMore: false, totalProcessed: 0 } });
      vi.spyOn(MigrationStateService, 'completeMigration').mockResolvedValue({ data: undefined });

      const ctx = makeMockInvocationContext();
      await handlePage({ lastId: null }, ctx);

      expect(getPageSpy).toHaveBeenCalledWith(
        expect.anything(),
        null,
        expect.any(Number),
        undefined,
      );
    });

    test('propagates importAll=true to next cursor when hasMore is true', async () => {
      vi.spyOn(MigrationStateService, 'getOrCreateMigrationState').mockResolvedValue({
        data: makeInProgressState(),
      });
      vi.spyOn(MigrateTrusteesUseCase, 'getPageOfTrustees').mockResolvedValue({
        data: { trustees: [{ ID: 42 }] as never, hasMore: true, totalProcessed: 1 },
      });
      vi.spyOn(MigrateTrusteesUseCase, 'processPageOfTrustees').mockResolvedValue({
        data: {
          processed: 1,
          appointments: 0,
          errors: 0,
          ambiguousCount: 0,
          failedAppointments: [],
        },
      });
      vi.spyOn(MigrationStateService, 'updateMigrationState').mockResolvedValue({
        data: undefined,
      });

      const ctx = makeMockInvocationContext();
      await handlePage({ lastId: null, importAll: true }, ctx);

      const cursors = getCursorMessages(ctx);
      expect(cursors).toHaveLength(1);
      expect(cursors[0]).toMatchObject({ importAll: true });
    });
  });
});
