import SyncCases from './sync-cases';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CasesSyncState } from '../gateways.types';
import { CasesLocalGateway } from '../../adapters/gateways/cases.local.gateway';
import { CasesSyncMeta } from '../cases/cases.interface';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';

describe('getCaseIds tests', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  test('should return empty events array when error is caught', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new Error('some error'));
    const actual = await SyncCases.getCaseIds(context);
    expect(actual).toEqual({ events: [] });
  });

  test('should return events to sync and last transaction id', async () => {
    const initialTxId = '0';
    const lastTxId = '1000';
    const gatewayResponse: CasesSyncMeta = {
      caseIds: MockData.buildArray(MockData.randomCaseId, 3),
      lastTxId,
    };

    const getIdSpy = jest
      .spyOn(CasesLocalGateway.prototype, 'getCaseIdsAndMaxTxIdToSync')
      .mockResolvedValue(gatewayResponse);

    const syncState: CasesSyncState = {
      documentType: 'CASES_SYNC_STATE',
      txId: initialTxId,
    };
    jest.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(syncState);
    jest
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockRejectedValue(new Error('this should not be called'));

    const actual = await SyncCases.getCaseIds(context);

    const expected = {
      events: gatewayResponse.caseIds.map((caseId) => {
        return { caseId, type: 'CASE_CHANGED' };
      }),
      lastTxId,
    };

    expect(getIdSpy).toHaveBeenCalledWith(expect.anything(), syncState.txId);
    expect(actual).toEqual(expected);
  });

  test('should use provided lastRunTxId', async () => {
    jest
      .spyOn(MockMongoRepository.prototype, 'read')
      .mockRejectedValue(new Error('this should not be called'));

    const lastRunTxId = '12345678901234567890';
    const lastTxId = '98765432109876543210';
    const gatewayResponse: CasesSyncMeta = {
      caseIds: MockData.buildArray(MockData.randomCaseId, 3),
      lastTxId,
    };

    const getIdSpy = jest
      .spyOn(CasesLocalGateway.prototype, 'getCaseIdsAndMaxTxIdToSync')
      .mockResolvedValue(gatewayResponse);

    const actual = await SyncCases.getCaseIds(context, '12345678901234567890');

    const expected = {
      events: gatewayResponse.caseIds.map((caseId) => {
        return { caseId, type: 'CASE_CHANGED' };
      }),
      lastTxId,
    };

    expect(getIdSpy).toHaveBeenCalledWith(expect.anything(), lastRunTxId);
    expect(actual).toEqual(expected);
  });
});
