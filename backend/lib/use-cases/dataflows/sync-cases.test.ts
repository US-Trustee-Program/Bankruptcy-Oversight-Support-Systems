import { vi } from 'vitest';
import SyncCases from './sync-cases';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CasesSyncState } from '../gateways.types';
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
    const caseIds = MockData.buildArray(MockData.randomCaseId, 3);

    const getIdSpy = vi.spyOn(CasesLocalGateway.prototype, 'getUpdatedCaseIds').mockResolvedValue({
      caseIds,
      appointmentCaseIds: [],
      latestCasesSyncDate,
      latestTransactionsSyncDate,
    });

    const syncState: CasesSyncState = {
      documentType: 'CASES_SYNC_STATE',
      lastCasesSyncDate: lastSyncDate,
      lastTransactionsSyncDate: lastSyncDate,
    };
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(syncState);

    const actual = await SyncCases.getCaseIds(context);

    const expected = {
      events: caseIds.map((caseId) => {
        return { caseId, type: 'CASE_CHANGED' };
      }),
      lastCasesSyncDate: latestCasesSyncDate,
      lastTransactionsSyncDate: latestTransactionsSyncDate,
    };

    expect(getIdSpy).toHaveBeenCalledWith(expect.anything(), lastSyncDate, lastSyncDate);
    expect(actual).toEqual(expected);
  });

  test('should use provided lastSyncDate if provided and return gateway latestSyncDate', async () => {
    const lastSyncDate = '2025-02-01T23:59:59.000Z';
    const latestCasesSyncDate = '2025-02-11T14:00:00.456Z';
    const latestTransactionsSyncDate = '2025-02-11T15:30:00.123Z';
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
      new Error('this should not be called'),
    );

    const mockCaseIds = MockData.buildArray(MockData.randomCaseId, 3);

    const getUpdatedSpy = vi
      .spyOn(CasesLocalGateway.prototype, 'getUpdatedCaseIds')
      .mockResolvedValue({
        caseIds: mockCaseIds,
        appointmentCaseIds: [],
        latestCasesSyncDate,
        latestTransactionsSyncDate,
      });

    const actual = await SyncCases.getCaseIds(context, lastSyncDate);
    expect(getUpdatedSpy).toHaveBeenCalled();
    expect(actual).toEqual({
      events: expect.anything(),
      lastCasesSyncDate: latestCasesSyncDate,
      lastTransactionsSyncDate: latestTransactionsSyncDate,
    });
  });

  test('should self-heal legacy sync state documents with single lastSyncDate field', async () => {
    const legacyLastSyncDate = '2025-01-15T08:00:00.000Z';
    const latestCasesSyncDate = '2025-02-11T10:30:00.124Z';
    const latestTransactionsSyncDate = '2025-02-11T12:45:00.789Z';
    const caseIds = MockData.buildArray(MockData.randomCaseId, 2);

    const getIdSpy = vi.spyOn(CasesLocalGateway.prototype, 'getUpdatedCaseIds').mockResolvedValue({
      caseIds,
      appointmentCaseIds: [],
      latestCasesSyncDate,
      latestTransactionsSyncDate,
    });

    // Mock legacy sync state with only lastSyncDate
    const legacySyncState = {
      documentType: 'CASES_SYNC_STATE',
      lastSyncDate: legacyLastSyncDate,
    } as CasesSyncState;
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(legacySyncState);

    const actual = await SyncCases.getCaseIds(context);

    // Should call gateway with legacy date for both parameters
    expect(getIdSpy).toHaveBeenCalledWith(
      expect.anything(),
      legacyLastSyncDate,
      legacyLastSyncDate,
    );

    const expected = {
      events: caseIds.map((caseId) => {
        return { caseId, type: 'CASE_CHANGED' };
      }),
      lastCasesSyncDate: latestCasesSyncDate,
      lastTransactionsSyncDate: latestTransactionsSyncDate,
    };

    expect(actual).toEqual(expected);
  });

  test('should tag appointment case IDs with TRUSTEE_APPOINTMENT type', async () => {
    const lastSyncDate = '2025-01-01';
    const latestCasesSyncDate = '2025-02-11T10:30:00.124Z';
    const latestTransactionsSyncDate = '2025-02-11T12:45:00.789Z';
    const caseIds = ['081-20-10001', '081-20-10002', '081-20-10003'];
    const appointmentCaseIds = ['081-20-10002'];

    vi.spyOn(CasesLocalGateway.prototype, 'getUpdatedCaseIds').mockResolvedValue({
      caseIds,
      appointmentCaseIds,
      latestCasesSyncDate,
      latestTransactionsSyncDate,
    });

    const syncState: CasesSyncState = {
      documentType: 'CASES_SYNC_STATE',
      lastCasesSyncDate: lastSyncDate,
      lastTransactionsSyncDate: lastSyncDate,
    };
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(syncState);

    const actual = await SyncCases.getCaseIds(context);

    expect(actual.events).toEqual([
      { caseId: '081-20-10001', type: 'CASE_CHANGED' },
      { caseId: '081-20-10002', type: 'TRUSTEE_APPOINTMENT' },
      { caseId: '081-20-10003', type: 'CASE_CHANGED' },
    ]);
  });

  test('should tag case as TRUSTEE_APPOINTMENT when it appears in both terminal and appointment results', async () => {
    const caseIds = ['081-20-10001'];
    const appointmentCaseIds = ['081-20-10001'];

    vi.spyOn(CasesLocalGateway.prototype, 'getUpdatedCaseIds').mockResolvedValue({
      caseIds,
      appointmentCaseIds,
      latestCasesSyncDate: '2025-02-11T10:30:00.124Z',
      latestTransactionsSyncDate: '2025-02-11T12:45:00.789Z',
    });

    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue({
      documentType: 'CASES_SYNC_STATE',
      lastCasesSyncDate: '2025-01-01',
      lastTransactionsSyncDate: '2025-01-01',
    } as CasesSyncState);

    const actual = await SyncCases.getCaseIds(context);

    expect(actual.events).toEqual([{ caseId: '081-20-10001', type: 'TRUSTEE_APPOINTMENT' }]);
  });

  test('should produce all CASE_CHANGED events when appointmentCaseIds is empty', async () => {
    const caseIds = ['081-20-10001', '081-20-10002'];

    vi.spyOn(CasesLocalGateway.prototype, 'getUpdatedCaseIds').mockResolvedValue({
      caseIds,
      appointmentCaseIds: [],
      latestCasesSyncDate: '2025-02-11T10:30:00.124Z',
      latestTransactionsSyncDate: '2025-02-11T12:45:00.789Z',
    });

    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue({
      documentType: 'CASES_SYNC_STATE',
      lastCasesSyncDate: '2025-01-01',
      lastTransactionsSyncDate: '2025-01-01',
    } as CasesSyncState);

    const actual = await SyncCases.getCaseIds(context);

    expect(actual.events).toEqual([
      { caseId: '081-20-10001', type: 'CASE_CHANGED' },
      { caseId: '081-20-10002', type: 'CASE_CHANGED' },
    ]);
  });
});
