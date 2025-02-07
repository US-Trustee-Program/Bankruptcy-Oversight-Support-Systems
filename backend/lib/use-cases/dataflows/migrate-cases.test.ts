import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { AcmsGatewayImpl } from '../../adapters/gateways/acms/acms.gateway';
import { ApplicationContext } from '../../adapters/types/basic';
import { UnknownError } from '../../common-errors/unknown-error';
import Factory from '../../factory';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { AcmsGateway } from '../gateways.types';
import MigrateCases from './migrate-cases';
import { AcmsConsolidation } from './migrate-consolidations';

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
};

describe('Migate cases use case', () => {
  let context: ApplicationContext;

  beforeAll(async () => {
    context = await createMockApplicationContext();
  });

  describe('getMigrationCaseIds', () => {
    test('should return case ids for migration', async () => {
      const caseIds = MockData.buildArray(MockData.randomCaseId, 1000);
      jest.spyOn(AcmsGatewayImpl.prototype, 'getMigrationCaseIds').mockResolvedValue(caseIds);

      const actual = await MigrateCases.getPageOfCaseIds(context, 1, 1000);
      expect(actual.caseIds).toEqual(caseIds);
    });

    test('should throw error if we cannot get case ids to migrate', async () => {
      jest.spyOn(Factory, 'getAcmsGateway').mockReturnValue(mockAcmsGateway);
      const expected = new UnknownError('test-module', {
        message: 'Failed to get case IDs to migrate from the ACMS gateway.',
      });

      const actual = await MigrateCases.getPageOfCaseIds(context, 1, 1000);

      expect(actual.error).toEqual(
        expect.objectContaining({
          ...expected,
          module: expect.any(String),
          originalError: expect.anything(),
        }),
      );
    });
  });

  describe('createMigrationTable', () => {
    test('should create the migration table', async () => {
      jest.spyOn(AcmsGatewayImpl.prototype, 'loadMigrationTable').mockResolvedValue(undefined);

      const actual = await MigrateCases.loadMigrationTable(context);
      expect(actual.success).toBeTruthy();
    });

    test('should return an error if the migration table is not created', async () => {
      jest.spyOn(Factory, 'getAcmsGateway').mockReturnValue(mockAcmsGateway);
      const expected = new UnknownError('test-module', {
        message: 'Failed to create and populate temporary migration table.',
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

  describe('dropMigrationTable', () => {
    test('should drop the migration table', async () => {
      jest.spyOn(AcmsGatewayImpl.prototype, 'emptyMigrationTable').mockResolvedValue(undefined);

      const actual = await MigrateCases.emptyMigrationTable(context);
      expect(actual.success).toBeTruthy();
    });

    test('should return an error if the migration table is not dropped', async () => {
      jest.spyOn(Factory, 'getAcmsGateway').mockReturnValue(mockAcmsGateway);
      const expected = new UnknownError('test-module', {
        message: 'Failed to drop temporary migration table.',
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
