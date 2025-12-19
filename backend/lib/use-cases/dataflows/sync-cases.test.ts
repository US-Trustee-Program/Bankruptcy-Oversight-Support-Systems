import { vi } from 'vitest';
import SyncCases from './sync-cases';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CasesSyncState } from '../gateways.types';
import { CasesLocalGateway } from '../../adapters/gateways/cases.local.gateway';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
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

  test('should return events to sync and last sync date', async () => {
    const lastSyncDate = '2025-01-01';
    const gatewayResponse = MockData.buildArray(MockData.randomCaseId, 3);

    const getIdSpy = vi
      .spyOn(CasesLocalGateway.prototype, 'getUpdatedCaseIds')
      .mockResolvedValue(gatewayResponse);

    const syncState: CasesSyncState = {
      documentType: 'CASES_SYNC_STATE',
      lastSyncDate,
    };
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(syncState);

    const actual = await SyncCases.getCaseIds(context);

    const expected = {
      events: gatewayResponse.map((caseId) => {
        return { caseId, type: 'CASE_CHANGED' };
      }),
    };

    expect(getIdSpy).toHaveBeenCalledWith(expect.anything(), lastSyncDate);
    expect(actual).toEqual(expect.objectContaining(expected));
    expect(Date.parse(actual.lastSyncDate)).toBeGreaterThan(Date.parse(lastSyncDate));
  });

  test('should use provided lastSyncDate if provided', async () => {
    const lastSyncDate = '2025-02-01 23:59:59';
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
      new Error('this should not be called'),
    );

    const mockCaseIds = MockData.buildArray(MockData.randomCaseId, 3);

    const getUpdatedSpy = vi
      .spyOn(CasesLocalGateway.prototype, 'getUpdatedCaseIds')
      .mockResolvedValue(mockCaseIds);

    const actual = await SyncCases.getCaseIds(context, lastSyncDate);
    expect(getUpdatedSpy).toHaveBeenCalled();
    expect(actual).toEqual({
      events: expect.anything(),
      lastSyncDate: expect.any(String),
    });
    expect(Date.parse(actual.lastSyncDate)).toBeGreaterThan(Date.parse(lastSyncDate));
  });
});
