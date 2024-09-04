import {
  fetchLeadCaseAttorneys,
  getCurrentLeadCaseId,
} from '@/data-verification/consolidation/consolidationOrderAccordionUtils';
import { CaseAssignment } from '@common/cams/assignments';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { ConsolidationOrder } from '@common/cams/orders';
import { FeatureFlagSet } from '@common/feature-flags';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import Api2 from '@/lib/hooks/UseApi2';

describe('consolidationOrderAccordion presenter tests', () => {
  let mockFeatureFlags: FeatureFlagSet;

  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    mockFeatureFlags = {
      'consolidations-enabled': true,
    };
    vitest.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
  });

  test('should get lead case id', () => {
    const leadCaseCourt = '081';
    const leadCaseNumber = '24-12345';
    expect(getCurrentLeadCaseId({ leadCaseCourt, leadCaseNumber })).toEqual('081-24-12345');
  });

  const leadCaseIdInputCases = [
    { leadCaseCourt: '081' },
    { leadCaseNumber: '24-12345' },
    { leadCaseCourt: '2', leadCaseNumber: '12-42255' },
    { leadCaseCourt: '225', leadCaseNumber: '12-422' },
  ];

  test.each(leadCaseIdInputCases)(
    'should get empty string for lead case id',
    (params: { leadCaseCourt?: string; leadCaseNumber?: string }) => {
      expect(getCurrentLeadCaseId(params)).toEqual('');
    },
  );

  test('should return empty array when no attorneys are found', async () => {
    const order: ConsolidationOrder = MockData.getConsolidationOrder();
    vi.spyOn(Api2, 'getCaseAssignments').mockResolvedValue({ data: [] });

    const attorneys = await fetchLeadCaseAttorneys(order.childCases[0].caseId);
    expect(attorneys).toEqual([]);
  });

  test('should return string array of attorneys when found', async () => {
    const order: ConsolidationOrder = MockData.getConsolidationOrder();
    const mockAttorneys: CaseAssignment[] = MockData.buildArray(
      () => MockData.getAttorneyAssignment(),
      3,
    );
    const attorneyArray = mockAttorneys.map((assignment) => assignment.name);
    vi.spyOn(Api2, 'getCaseAssignments').mockResolvedValue({ data: mockAttorneys });

    const attorneys = await fetchLeadCaseAttorneys(order.childCases[0].caseId);
    expect(attorneys).toEqual(attorneyArray);
  });
});
