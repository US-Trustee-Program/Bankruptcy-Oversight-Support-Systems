import { InvocationContext } from '@azure/functions';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { CaseSyncEvent } from './import-dataflow-types';
import DxtrActivities from './dxtr-activities';
import CaseManagement from '../../../lib/use-cases/cases/case-management';
import { UnknownError } from '../../../lib/common-errors/unknown-error';

describe('acms-activities tests', () => {
  let context: InvocationContext;

  beforeEach(() => {
    context = new InvocationContext();
  });

  test('should return empty array when error occurs', async () => {
    jest
      .spyOn(CaseManagement.prototype, 'getCaseIdsToSync')
      .mockRejectedValue(new Error('some error'));

    const actual = await DxtrActivities.getCaseIdsToSync(null, context);
    expect(actual).toEqual([]);
  });

  test('should return properly decorated events', async () => {
    const caseIds = MockData.buildArray(MockData.randomCaseId, 5);
    jest.spyOn(CaseManagement.prototype, 'getCaseIdsToSync').mockResolvedValue(caseIds);
    const expected: CaseSyncEvent[] = [
      { type: 'CASE_CHANGED', caseId: caseIds[0] },
      { type: 'CASE_CHANGED', caseId: caseIds[1] },
      { type: 'CASE_CHANGED', caseId: caseIds[2] },
      { type: 'CASE_CHANGED', caseId: caseIds[3] },
      { type: 'CASE_CHANGED', caseId: caseIds[4] },
    ];

    const actual = await DxtrActivities.getCaseIdsToSync(null, context);
    expect(actual).toEqual(expected);
  });

  test('should return event with case', async () => {
    const bCase = MockData.getDxtrCase();
    jest.spyOn(CaseManagement.prototype, 'getDxtrCase').mockResolvedValue(bCase);
    const setDlqSpy = jest.spyOn(context.extraOutputs, 'set');

    const event: CaseSyncEvent = {
      type: 'MIGRATION',
      caseId: bCase.caseId,
    };
    const expected: CaseSyncEvent = {
      ...event,
      bCase,
    };

    const actual = await DxtrActivities.exportCase(event, context);

    expect(actual).toEqual(expected);
    expect(setDlqSpy).not.toHaveBeenCalled();
  });

  test('should return event with error and write to DLQ', async () => {
    jest.spyOn(CaseManagement.prototype, 'getDxtrCase').mockRejectedValue(new Error('some error'));
    const setDlqSpy = jest.spyOn(context.extraOutputs, 'set');

    const event: CaseSyncEvent = {
      type: 'MIGRATION',
      caseId: MockData.randomCaseId(),
    };
    const expected: CaseSyncEvent = {
      ...event,
      error: expect.any(UnknownError),
    };

    const actual = await DxtrActivities.exportCase(event, context);
    expect(actual).toEqual(expected);
    expect(setDlqSpy).toHaveBeenCalledTimes(1);
  });
});
