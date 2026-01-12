import {
  fetchLeadCaseAttorneys,
  getCaseId,
} from '@/data-verification/consolidation/consolidationOrderAccordionUtils';
import { CaseAssignment } from '@common/cams/assignments';
import MockData from '@common/cams/test-utilities/mock-data';
import { ConsolidationOrder } from '@common/cams/orders';
import { FeatureFlagSet } from '@common/feature-flags';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import Api2 from '@/lib/models/api2';

describe('consolidationOrderAccordion presenter tests', () => {
  let mockFeatureFlags: FeatureFlagSet;

  beforeEach(async () => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    mockFeatureFlags = {
      'consolidations-enabled': true,
    };
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
  });

  test('should get case id', () => {
    const court = '081';
    const caseNumber = '24-12345';
    expect(getCaseId({ court, caseNumber })).toEqual('081-24-12345');
  });

  const caseIdInputCases = [
    { court: '081' },
    { court: '24-12345' },
    { court: '2', caseNumber: '12-42255' },
    { court: '225', caseNumber: '12-422' },
  ];

  test.each(caseIdInputCases)('should get empty string for lead case id', (params) => {
    expect(getCaseId(params)).toEqual('');
  });

  test('should return empty array when no attorneys are found', async () => {
    const order: ConsolidationOrder = MockData.getConsolidationOrder();
    vi.spyOn(Api2, 'getCaseAssignments').mockResolvedValue({ data: [] });

    const attorneys = await fetchLeadCaseAttorneys(order.memberCases[0].caseId);
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

    const attorneys = await fetchLeadCaseAttorneys(order.memberCases[0].caseId);
    expect(attorneys).toEqual(attorneyArray);
  });
});
