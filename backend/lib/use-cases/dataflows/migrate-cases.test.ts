import { vi, describe, test, expect, beforeEach } from 'vitest';
import MockData from '@common/cams/test-utilities/mock-data';
import { AcmsGatewayImpl } from '../../adapters/gateways/acms/acms.gateway';
import { ApplicationContext } from '../../adapters/types/basic';
import { UnknownError } from '../../common-errors/unknown-error';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import MigrateCases from './migrate-cases';

describe('Migrate cases use case', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  describe('getMigrationCaseIds', () => {
    test('should return case events for migration', async () => {
      const caseIds = MockData.buildArray(MockData.randomCaseId, 1000);
      const spy = vi
        .spyOn(AcmsGatewayImpl.prototype, 'getMigrationCaseIds')
        .mockResolvedValue(caseIds);

      const actual = await MigrateCases.getPageOfCaseEvents(context, 1, 1000);
      expect(actual.events).toEqual(
        caseIds.map((caseId) => MockData.getCaseSyncEvent({ type: 'MIGRATION', caseId })),
      );
      expect(spy).toHaveBeenCalledWith(expect.anything(), 1, 1000);
    });

    test('should throw error if we cannot get case ids to migrate', async () => {
      vi.spyOn(AcmsGatewayImpl.prototype, 'getMigrationCaseIds').mockRejectedValue(
        new Error('simulated gateway failure'),
      );
      const expected = new UnknownError('test-module', {
        message: 'Failed to get case IDs to migrate from the ACMS gateway.',
      });

      const actual = await MigrateCases.getPageOfCaseEvents(context, 1, 1000);

      expect(actual.error).toEqual(
        expect.objectContaining({
          ...expected,
          module: expect.any(String),
          originalError: expect.anything(),
        }),
      );
    });
  });

  describe('loadMigrationTable', () => {
    test('should load the migration table', async () => {
      vi.spyOn(AcmsGatewayImpl.prototype, 'loadMigrationTable').mockResolvedValue(undefined);
      vi.spyOn(AcmsGatewayImpl.prototype, 'getMigrationCaseCount').mockResolvedValue(100);

      const actual = await MigrateCases.loadMigrationTable(context);
      expect(actual).toEqual({ data: 100 });
    });

    test('should return an error if the migration table is not loaded', async () => {
      vi.spyOn(AcmsGatewayImpl.prototype, 'loadMigrationTable').mockRejectedValue(
        new Error('simulated gateway failure'),
      );
      const countSpy = vi.spyOn(AcmsGatewayImpl.prototype, 'getMigrationCaseCount');
      const expected = new UnknownError('test-module', {
        message: 'Failed to populate migration table.',
      });

      const actual = await MigrateCases.loadMigrationTable(context);

      expect(actual.error).toEqual(
        expect.objectContaining({
          ...expected,
          module: expect.any(String),
          originalError: expect.anything(),
        }),
      );
      expect(countSpy).not.toHaveBeenCalled();
    });
  });

  describe('emptyMigrationTable', () => {
    test('should empty the migration table', async () => {
      vi.spyOn(AcmsGatewayImpl.prototype, 'emptyMigrationTable').mockResolvedValue(undefined);

      const actual = await MigrateCases.emptyMigrationTable(context);
      expect(actual.success).toBeTruthy();
    });

    test('should return an error if the migration table is not dropped', async () => {
      vi.spyOn(AcmsGatewayImpl.prototype, 'emptyMigrationTable').mockRejectedValue(
        new Error('simulated gateway failure'),
      );
      const expected = new UnknownError('test-module', {
        message: 'Failed to empty migration table.',
      });

      const actual = await MigrateCases.emptyMigrationTable(context);

      expect(actual.error).toEqual(
        expect.objectContaining({
          ...expected,
          module: expect.any(String),
          originalError: expect.anything(),
        }),
      );
    });
  });
});
