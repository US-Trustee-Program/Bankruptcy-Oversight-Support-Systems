import AcmsOrders from '../../../lib/use-cases/dataflows/migrate-consolidations';
import { InvocationContext } from '@azure/functions';
import AcmsActivities from './acms-activities';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { CaseSyncEvent } from '../../../lib/use-cases/dataflows/dataflow-types';

describe('acms-activities tests', () => {
  let context: InvocationContext;

  beforeEach(() => {
    context = new InvocationContext();
  });

  test('should return empty array when error occurs', async () => {
    jest
      .spyOn(AcmsOrders.prototype, 'getCaseIdsToMigrate')
      .mockRejectedValue(new Error('some error'));

    const actual = await AcmsActivities.getCaseIdsToMigrate(null, context);
    expect(actual).toEqual([]);
  });

  test('should return properly decorated events', async () => {
    const caseIds = MockData.buildArray(MockData.randomCaseId, 5);
    jest.spyOn(AcmsOrders.prototype, 'getCaseIdsToMigrate').mockResolvedValue(caseIds);
    const expected: CaseSyncEvent[] = [
      { type: 'MIGRATION', caseId: caseIds[0] },
      { type: 'MIGRATION', caseId: caseIds[1] },
      { type: 'MIGRATION', caseId: caseIds[2] },
      { type: 'MIGRATION', caseId: caseIds[3] },
      { type: 'MIGRATION', caseId: caseIds[4] },
    ];

    const actual = await AcmsActivities.getCaseIdsToMigrate(null, context);
    expect(actual).toEqual(expected);
  });
});
