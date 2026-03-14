import { vi } from 'vitest';
import DetectDeletedCases from './detect-deleted-cases';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { DeletedCasesSyncState } from '../gateways.types';
import { AcmsGatewayImpl } from '../../adapters/gateways/acms/acms.gateway';
import { ApplicationContext } from '../../adapters/types/basic';

describe('getDeletedCaseEvents tests', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    vi.restoreAllMocks();
  });

  test('should query ACMS with lastChangeDate from runtime state', async () => {
    const lastChangeDate = '2025-01-15';
    const latestDeletedCaseDate = '2025-02-11';
    const caseIds = ['001-25-00001', '002-25-00002'];

    const syncState: DeletedCasesSyncState = {
      documentType: 'DELETED_CASES_SYNC_STATE',
      lastChangeDate,
    };
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(syncState);

    const getDeletedCaseIdsSpy = vi
      .spyOn(AcmsGatewayImpl.prototype, 'getDeletedCaseIds')
      .mockResolvedValue({
        caseIds,
        latestDeletedCaseDate,
      });

    vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(expect.anything());

    await DetectDeletedCases.getDeletedCaseEvents(context);

    expect(getDeletedCaseIdsSpy).toHaveBeenCalledWith(expect.anything(), lastChangeDate);
  });

  test('should create CaseDeletedEvent for each deleted case', async () => {
    const lastChangeDate = '2025-01-15';
    const latestDeletedCaseDate = '2025-02-11';
    const caseIds = ['001-25-00001', '002-25-00002', '003-25-00003'];

    const syncState: DeletedCasesSyncState = {
      documentType: 'DELETED_CASES_SYNC_STATE',
      lastChangeDate,
    };
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(syncState);

    vi.spyOn(AcmsGatewayImpl.prototype, 'getDeletedCaseIds').mockResolvedValue({
      caseIds,
      latestDeletedCaseDate,
    });

    vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(expect.anything());

    const actual = await DetectDeletedCases.getDeletedCaseEvents(context);

    expect(actual).toHaveLength(3);
    expect(actual[0]).toEqual({
      type: 'CASE_DELETED',
      caseId: '001-25-00001',
      deletedDate: latestDeletedCaseDate,
    });
    expect(actual[1]).toEqual({
      type: 'CASE_DELETED',
      caseId: '002-25-00002',
      deletedDate: latestDeletedCaseDate,
    });
    expect(actual[2]).toEqual({
      type: 'CASE_DELETED',
      caseId: '003-25-00003',
      deletedDate: latestDeletedCaseDate,
    });
  });

  test('should update runtime state with latestDeletedCaseDate from query results', async () => {
    const lastChangeDate = '2025-01-15';
    const latestDeletedCaseDate = '2025-02-11';
    const caseIds = ['001-25-00001', '002-25-00002'];

    const syncState: DeletedCasesSyncState = {
      documentType: 'DELETED_CASES_SYNC_STATE',
      lastChangeDate,
    };
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(syncState);

    vi.spyOn(AcmsGatewayImpl.prototype, 'getDeletedCaseIds').mockResolvedValue({
      caseIds,
      latestDeletedCaseDate,
    });

    const upsertSpy = vi
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockResolvedValue(expect.anything());

    await DetectDeletedCases.getDeletedCaseEvents(context);

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: 'DELETED_CASES_SYNC_STATE',
        lastChangeDate: latestDeletedCaseDate,
      }),
    );
  });

  test('should handle empty results (no deleted cases)', async () => {
    const lastChangeDate = '2025-01-15';
    const latestDeletedCaseDate = '2025-01-15'; // Same as lastChangeDate when no new deletions

    const syncState: DeletedCasesSyncState = {
      documentType: 'DELETED_CASES_SYNC_STATE',
      lastChangeDate,
    };
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(syncState);

    vi.spyOn(AcmsGatewayImpl.prototype, 'getDeletedCaseIds').mockResolvedValue({
      caseIds: [],
      latestDeletedCaseDate,
    });

    vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(expect.anything());

    const actual = await DetectDeletedCases.getDeletedCaseEvents(context);

    expect(actual).toEqual([]);
  });

  test('should initialize runtime state if it does not exist', async () => {
    const latestDeletedCaseDate = '2025-02-11';
    const caseIds = ['001-25-00001'];
    const defaultStartDate = '2018-01-01';

    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
      new Error('No matching item found.'),
    );

    const getDeletedCaseIdsSpy = vi
      .spyOn(AcmsGatewayImpl.prototype, 'getDeletedCaseIds')
      .mockResolvedValue({
        caseIds,
        latestDeletedCaseDate,
      });

    const upsertSpy = vi
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockResolvedValue(expect.anything());

    await DetectDeletedCases.getDeletedCaseEvents(context);

    expect(getDeletedCaseIdsSpy).toHaveBeenCalledWith(expect.anything(), defaultStartDate);
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: 'DELETED_CASES_SYNC_STATE',
        lastChangeDate: latestDeletedCaseDate,
      }),
    );
  });
});
