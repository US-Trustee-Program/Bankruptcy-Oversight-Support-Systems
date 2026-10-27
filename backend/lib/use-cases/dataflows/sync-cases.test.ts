import { vi } from 'vitest';
import SyncCases from './sync-cases';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CasesSyncState, LegacyCasesSyncState } from '../gateways.types';
import { CasesLocalGateway } from '../../adapters/gateways/cases.local.gateway';
import MockData from '@common/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';

describe('getCaseIds tests', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  test('should return empty events array when error is caught', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new Error('some error'));
    const actual = await SyncCases.getCaseIds(context);
    expect(actual).toEqual({ events: [] });
  });

  test('should return events to sync and last sync date from gateway', async () => {
    const lastSyncDate = '2025-01-01';
    const latestCasesSyncDate = '2025-02-11T10:30:00.124Z';
    const latestTransactionsSyncDate = '2025-02-11T12:45:00.789Z';
    const latestTransactionsTxId = 42;
    const caseIds = MockData.buildArray(MockData.randomCaseId, 3);

    const getIdSpy = vi.spyOn(CasesLocalGateway.prototype, 'getUpdatedCaseIds').mockResolvedValue({
      caseIds,
      latestCasesSyncDate,
      latestTransactionsSyncDate,
      latestTransactionsTxId,
    });

    const syncState: CasesSyncState = {
      documentType: 'CASES_SYNC_STATE',
      lastCasesSyncDate: lastSyncDate,
      lastTransactionsSyncDate: lastSyncDate,
      lastTransactionsTxId: 10,
    };
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(syncState);

    const actual = await SyncCases.getCaseIds(context);

    const expected = {
      events: caseIds.map((caseId) => {
        return { caseId, type: 'CASE_CHANGED' };
      }),
      lastCasesSyncDate: latestCasesSyncDate,
      lastTransactionsSyncDate: latestTransactionsSyncDate,
      lastTransactionsTxId: latestTransactionsTxId,
    };

    expect(getIdSpy).toHaveBeenCalledWith(expect.anything(), lastSyncDate, 10, lastSyncDate);
    expect(actual).toEqual(expected);
  });

  test('should use provided lastSyncDate if provided, bootstrap TX_ID, and not read stored state', async () => {
    const lastSyncDate = '2025-02-01T23:59:59.000Z';
    const latestCasesSyncDate = '2025-02-11T14:00:00.456Z';
    const latestTransactionsSyncDate = '2025-02-11T15:30:00.123Z';
    const latestTransactionsTxId = 99;
    const readSpy = vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(undefined);

    const mockCaseIds = MockData.buildArray(MockData.randomCaseId, 3);

    vi.spyOn(CasesLocalGateway.prototype, 'findTransactionIdRangeForDate').mockResolvedValue({
      findDate: lastSyncDate,
      found: true,
      end: 50,
      start: 45,
    });

    const getIdSpy = vi.spyOn(CasesLocalGateway.prototype, 'getUpdatedCaseIds').mockResolvedValue({
      caseIds: mockCaseIds,
      latestCasesSyncDate,
      latestTransactionsSyncDate,
      latestTransactionsTxId,
    });

    const actual = await SyncCases.getCaseIds(context, lastSyncDate);
    expect(readSpy).not.toHaveBeenCalled();
    expect(getIdSpy).toHaveBeenCalledWith(expect.anything(), lastSyncDate, 50, lastSyncDate);
    expect(actual).toEqual({
      events: expect.anything(),
      lastCasesSyncDate: latestCasesSyncDate,
      lastTransactionsSyncDate: latestTransactionsSyncDate,
      lastTransactionsTxId: latestTransactionsTxId,
    });
  });

  test('should self-heal legacy sync state documents with single lastSyncDate field', async () => {
    const legacyLastSyncDate = '2025-01-15T08:00:00.000Z';
    const latestCasesSyncDate = '2025-02-11T10:30:00.124Z';
    const latestTransactionsSyncDate = '2025-02-11T12:45:00.789Z';
    const latestTransactionsTxId = 77;
    const caseIds = MockData.buildArray(MockData.randomCaseId, 2);

    vi.spyOn(CasesLocalGateway.prototype, 'findTransactionIdRangeForDate').mockResolvedValue({
      findDate: legacyLastSyncDate,
      found: true,
      end: 77,
      start: 70,
    });

    const getIdSpy = vi.spyOn(CasesLocalGateway.prototype, 'getUpdatedCaseIds').mockResolvedValue({
      caseIds,
      latestCasesSyncDate,
      latestTransactionsSyncDate,
      latestTransactionsTxId,
    });

    // Mock legacy sync state with only lastSyncDate
    const legacySyncState: LegacyCasesSyncState = {
      documentType: 'CASES_SYNC_STATE',
      lastSyncDate: legacyLastSyncDate,
    };
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(legacySyncState);

    const actual = await SyncCases.getCaseIds(context);

    // Should call gateway with legacy date for cases cursor and bootstrapped TX_ID
    expect(getIdSpy).toHaveBeenCalledWith(
      expect.anything(),
      legacyLastSyncDate,
      77,
      legacyLastSyncDate,
    );

    const expected = {
      events: caseIds.map((caseId) => {
        return { caseId, type: 'CASE_CHANGED' };
      }),
      lastCasesSyncDate: latestCasesSyncDate,
      lastTransactionsSyncDate: latestTransactionsSyncDate,
      lastTransactionsTxId: latestTransactionsTxId,
    };

    expect(actual).toEqual(expected);
  });

  test('should bootstrap TX_ID from date range when lastTransactionsTxId absent from sync state', async () => {
    const lastSyncDate = '2025-03-01T00:00:00.000Z';
    const caseIds = MockData.buildArray(MockData.randomCaseId, 2);

    const findRangeSpy = vi
      .spyOn(CasesLocalGateway.prototype, 'findTransactionIdRangeForDate')
      .mockResolvedValue({ findDate: lastSyncDate, found: true, end: 42, start: 40 });

    const getIdSpy = vi.spyOn(CasesLocalGateway.prototype, 'getUpdatedCaseIds').mockResolvedValue({
      caseIds,
      latestCasesSyncDate: lastSyncDate,
      latestTransactionsSyncDate: lastSyncDate,
      latestTransactionsTxId: 42,
    });

    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue({
      documentType: 'CASES_SYNC_STATE',
      lastCasesSyncDate: lastSyncDate,
      lastTransactionsSyncDate: lastSyncDate,
      // no lastTransactionsTxId — simulates first run after deploy
    } as CasesSyncState);

    const actual = await SyncCases.getCaseIds(context);

    expect(findRangeSpy).toHaveBeenCalledWith(expect.anything(), lastSyncDate);
    expect(getIdSpy).toHaveBeenCalledWith(expect.anything(), lastSyncDate, 42, lastSyncDate);
    expect(actual).toEqual({
      events: caseIds.map((caseId) => ({ caseId, type: 'CASE_CHANGED' })),
      lastCasesSyncDate: lastSyncDate,
      lastTransactionsSyncDate: lastSyncDate,
      lastTransactionsTxId: 42,
    });
  });

  test('should bootstrap TX_ID using findMaxTransactionId when date range not found', async () => {
    const lastSyncDate = '2025-03-01T00:00:00.000Z';
    const caseIds = MockData.buildArray(MockData.randomCaseId, 2);

    vi.spyOn(CasesLocalGateway.prototype, 'findTransactionIdRangeForDate').mockResolvedValue({
      findDate: lastSyncDate,
      found: false,
    });

    const findMaxSpy = vi
      .spyOn(CasesLocalGateway.prototype, 'findMaxTransactionId')
      .mockResolvedValue('999');

    const getIdSpy = vi.spyOn(CasesLocalGateway.prototype, 'getUpdatedCaseIds').mockResolvedValue({
      caseIds,
      latestCasesSyncDate: lastSyncDate,
      latestTransactionsSyncDate: lastSyncDate,
      latestTransactionsTxId: 999,
    });

    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue({
      documentType: 'CASES_SYNC_STATE',
      lastCasesSyncDate: lastSyncDate,
      lastTransactionsSyncDate: lastSyncDate,
      // no lastTransactionsTxId
    } as CasesSyncState);

    const actual = await SyncCases.getCaseIds(context);

    expect(findMaxSpy).toHaveBeenCalled();
    expect(getIdSpy).toHaveBeenCalledWith(expect.anything(), lastSyncDate, 999, lastSyncDate);
    expect(actual).toEqual({
      events: caseIds.map((caseId) => ({ caseId, type: 'CASE_CHANGED' })),
      lastCasesSyncDate: lastSyncDate,
      lastTransactionsSyncDate: lastSyncDate,
      lastTransactionsTxId: 999,
    });
  });

  test('should bootstrap TX_ID using findMaxTransactionId when range found but end is undefined', async () => {
    const lastSyncDate = '2025-03-01T00:00:00.000Z';
    const caseIds = MockData.buildArray(MockData.randomCaseId, 2);

    vi.spyOn(CasesLocalGateway.prototype, 'findTransactionIdRangeForDate').mockResolvedValue({
      findDate: lastSyncDate,
      found: true,
      // end deliberately absent — edge case where range found but end could not be determined
    });

    const findMaxSpy = vi
      .spyOn(CasesLocalGateway.prototype, 'findMaxTransactionId')
      .mockResolvedValue('888');

    const getIdSpy = vi.spyOn(CasesLocalGateway.prototype, 'getUpdatedCaseIds').mockResolvedValue({
      caseIds,
      latestCasesSyncDate: lastSyncDate,
      latestTransactionsSyncDate: lastSyncDate,
      latestTransactionsTxId: 888,
    });

    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue({
      documentType: 'CASES_SYNC_STATE',
      lastCasesSyncDate: lastSyncDate,
      lastTransactionsSyncDate: lastSyncDate,
    } as CasesSyncState);

    await SyncCases.getCaseIds(context);

    expect(findMaxSpy).toHaveBeenCalled();
    expect(getIdSpy).toHaveBeenCalledWith(expect.anything(), lastSyncDate, 888, lastSyncDate);
  });

  test('should fall back to findMaxTransactionId when bootstrap bisection throws (TX_ID gap)', async () => {
    const lastSyncDate = '2025-03-01T00:00:00.000Z';
    const caseIds = MockData.buildArray(MockData.randomCaseId, 2);

    vi.spyOn(CasesLocalGateway.prototype, 'findTransactionIdRangeForDate').mockRejectedValue(
      new Error('Found gap in the transaction IDs'),
    );

    const findMaxSpy = vi
      .spyOn(CasesLocalGateway.prototype, 'findMaxTransactionId')
      .mockResolvedValue('777');

    const getIdSpy = vi.spyOn(CasesLocalGateway.prototype, 'getUpdatedCaseIds').mockResolvedValue({
      caseIds,
      latestCasesSyncDate: lastSyncDate,
      latestTransactionsSyncDate: lastSyncDate,
      latestTransactionsTxId: 777,
    });

    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue({
      documentType: 'CASES_SYNC_STATE',
      lastCasesSyncDate: lastSyncDate,
      lastTransactionsSyncDate: lastSyncDate,
    } as CasesSyncState);

    await SyncCases.getCaseIds(context);

    expect(findMaxSpy).toHaveBeenCalled();
    expect(getIdSpy).toHaveBeenCalledWith(expect.anything(), lastSyncDate, 777, lastSyncDate);
  });

  test('should not self-heal when sync state has both lastSyncDate and lastCasesSyncDate', async () => {
    const lastCasesSyncDate = '2025-04-01T00:00:00.000Z';
    const lastTransactionsTxId = 500;

    const getIdSpy = vi.spyOn(CasesLocalGateway.prototype, 'getUpdatedCaseIds').mockResolvedValue({
      caseIds: [],
      latestCasesSyncDate: lastCasesSyncDate,
      latestTransactionsSyncDate: lastCasesSyncDate,
      latestTransactionsTxId: lastTransactionsTxId,
    });

    // Document has both fields — should NOT be treated as legacy (lastSyncDate field ignored)
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue({
      documentType: 'CASES_SYNC_STATE',
      lastSyncDate: '2020-01-01T00:00:00.000Z',
      lastCasesSyncDate,
      lastTransactionsSyncDate: lastCasesSyncDate,
      lastTransactionsTxId,
    } as CasesSyncState);

    await SyncCases.getCaseIds(context);

    // Should use lastCasesSyncDate from the modern fields, not lastSyncDate from legacy field
    expect(getIdSpy).toHaveBeenCalledWith(
      expect.anything(),
      lastCasesSyncDate,
      lastTransactionsTxId,
      lastCasesSyncDate,
    );
  });
});
