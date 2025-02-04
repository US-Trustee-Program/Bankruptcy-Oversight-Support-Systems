import CaseManagement from '../../../lib/use-cases/cases/case-management';
import { CaseSyncEvent } from './import-dataflow-types';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import CamsActivities from './cams-activities';
import { InvocationContext } from '@azure/functions';
import { BadRequestError } from '../../../lib/common-errors/bad-request';
import { UnknownError } from '../../../lib/common-errors/unknown-error';

describe('cams-activities tests', () => {
  let context: InvocationContext;

  beforeEach(() => {
    context = new InvocationContext();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return event with existing error', async () => {
    jest
      .spyOn(CaseManagement.prototype, 'syncCase')
      .mockRejectedValue(new Error('this should not be called'));
    const setDlqSpy = jest.spyOn(context.extraOutputs, 'set');

    const event: CaseSyncEvent = {
      type: 'CASE_CHANGED',
      caseId: MockData.randomCaseId(),
      error: new UnknownError('test-module', { message: 'some earlier activity erred' }),
    };

    const actual = await CamsActivities.loadCase(event, context);
    expect(actual).toEqual(event);
    expect(setDlqSpy).not.toHaveBeenCalled();
  });

  test('should return event with no case error', async () => {
    jest
      .spyOn(CaseManagement.prototype, 'syncCase')
      .mockRejectedValue(new Error('this should not be called'));
    const setDlqSpy = jest.spyOn(context.extraOutputs, 'set');

    const event: CaseSyncEvent = {
      type: 'CASE_CHANGED',
      caseId: MockData.randomCaseId(),
      bCase: undefined,
    };
    const expected: CaseSyncEvent = {
      ...event,
      error: expect.any(BadRequestError),
    };

    const actual = await CamsActivities.loadCase(event, context);
    expect(actual).toEqual(expected);
    expect(setDlqSpy).not.toHaveBeenCalled();
  });

  test('should return event with unknown error', async () => {
    jest.spyOn(CaseManagement.prototype, 'syncCase').mockRejectedValue(new Error('some error'));
    const setDlqSpy = jest.spyOn(context.extraOutputs, 'set');

    const bCase = MockData.getDxtrCase();
    const event: CaseSyncEvent = {
      type: 'CASE_CHANGED',
      caseId: bCase.caseId,
      bCase,
    };
    const expected: CaseSyncEvent = {
      ...event,
      error: expect.any(UnknownError),
    };

    const actual = await CamsActivities.loadCase(event, context);
    expect(actual).toEqual(expected);
    expect(setDlqSpy).toHaveBeenCalledTimes(1);
  });

  test('should return event and not write to DLQ', async () => {
    jest.spyOn(CaseManagement.prototype, 'syncCase').mockResolvedValue();
    const setDlqSpy = jest.spyOn(context.extraOutputs, 'set');

    const bCase = MockData.getDxtrCase();
    const event: CaseSyncEvent = {
      type: 'CASE_CHANGED',
      caseId: bCase.caseId,
      bCase,
    };

    await CamsActivities.loadCase(event, context);
    expect(setDlqSpy).not.toHaveBeenCalled();
  });

  test('should call use case with provided transaction id and not throw', async () => {
    const spy = jest.spyOn(CaseManagement.prototype, 'storeRuntimeState').mockResolvedValue();

    const params = {
      lastTxId: '1001',
    };

    await CamsActivities.storeRuntimeState(params, context);
    expect(spy).toHaveBeenCalledWith(expect.anything(), params.lastTxId);
  });

  test('should call use case with no transaction id and not throw', async () => {
    const spy = jest.spyOn(CaseManagement.prototype, 'storeRuntimeState').mockResolvedValue();

    const params = {};

    await CamsActivities.storeRuntimeState(params, context);
    expect(spy).toHaveBeenCalledWith(expect.anything(), undefined);
  });

  test('should not throw caught error', async () => {
    jest
      .spyOn(CaseManagement.prototype, 'storeRuntimeState')
      .mockRejectedValue(new Error('some error'));

    const params = {};

    await expect(CamsActivities.storeRuntimeState(params, context)).resolves.toBeUndefined();
  });
});
