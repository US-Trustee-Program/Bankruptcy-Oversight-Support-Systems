import { vi } from 'vitest';
import MockData from '@common/cams/test-utilities/mock-data';
import { AcmsGatewayImpl } from '../../adapters/gateways/acms/acms.gateway';
import { ApplicationContext } from '../../adapters/types/basic';
import { UnknownError } from '../../common-errors/unknown-error';
import factory from '../../factory';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { AcmsGateway } from '../gateways.types';
import MigrateCases from './migrate-cases';
import { AcmsConsolidation } from './migrate-consolidations';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';

const mockAcmsGateway: AcmsGateway = {
  getLeadCaseIds: function (..._ignore): Promise<string[]> {
    throw new Error('Function not implemented.');
  },
  getConsolidationDetails: function (..._ignore): Promise<AcmsConsolidation> {
    throw new Error('Function not implemented.');
  },
  loadMigrationTable: function (..._ignore) {
    throw new Error('Function not implemented.');
  },
  getMigrationCaseIds: function (..._ignore) {
    throw new Error('Function not implemented.');
  },
  emptyMigrationTable: function (..._ignore) {
    throw new Error('Function not implemented.');
  },
  getMigrationCaseCount(..._ignore) {
    throw new Error('Function not implemented.');
  },
};

describe('Migrate cases use case', () => {
  let context: ApplicationContext;

  beforeAll(async () => {
    context = await createMockApplicationContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getMigrationCaseIds', () => {
    test('should return case events for migration', async () => {
      const caseIds = MockData.buildArray(MockData.randomCaseId, 1000);
      vi.spyOn(AcmsGatewayImpl.prototype, 'getMigrationCaseIds').mockResolvedValue(caseIds);

      const actual = await MigrateCases.getPageOfCaseEvents(context, 1, 1000);
      expect(actual.events).toEqual(
        caseIds.map((caseId) => MockData.getCaseSyncEvent({ type: 'MIGRATION', caseId })),
      );
    });

    test('should throw error if we cannot get case ids to migrate', async () => {
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue(mockAcmsGateway);
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
      vi.spyOn(MockMongoRepository.prototype, 'deleteSyncedCases').mockResolvedValue();
      vi.spyOn(AcmsGatewayImpl.prototype, 'loadMigrationTable').mockResolvedValue(undefined);
      vi.spyOn(AcmsGatewayImpl.prototype, 'getMigrationCaseCount').mockResolvedValue(100);

      const actual = await MigrateCases.loadMigrationTable(context);
      expect(actual).toEqual({ data: 100 });
    });

    test('should return an error if the migration table is not loaded', async () => {
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue(mockAcmsGateway);
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
    });
  });

  describe('emptyMigrationTable', () => {
    test('should empty the migration table', async () => {
      vi.spyOn(AcmsGatewayImpl.prototype, 'emptyMigrationTable').mockResolvedValue(undefined);

      const actual = await MigrateCases.emptyMigrationTable(context);
      expect(actual.success).toBeTruthy();
    });

    test('should return an error if the migration table is not dropped', async () => {
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue(mockAcmsGateway);
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
