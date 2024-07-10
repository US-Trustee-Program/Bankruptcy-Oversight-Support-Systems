import { MockData } from '@common/cams/test-utilities/mock-data';
import { useConsolidationStoreMock } from './consolidationStoreMock';
import { consolidationUseCase } from './consolidationsUseCase';
import { orderStatusType, orderType } from '@/lib/utils/labels';
import { useConsolidationControlsMock } from '@/data-verification/consolidation/consolidationControlsMock';

describe('Consolidation UseCase tests', () => {
  test('should call showConfirmationModal when handleApproveButtonClick is called', () => {
    const props = {
      order: MockData.getConsolidationOrder(),
      statusType: orderStatusType,
      orderType: orderType,
      officesList: MockData.getOffices(),
      regionsMap: new Map(),
      onOrderUpdate: vi.fn(),
      onExpand: vi.fn(),
    };
    const consolidationStore = useConsolidationStoreMock(props, []);
    const consolidationControls = useConsolidationControlsMock();
    const useCase = consolidationUseCase(
      consolidationStore,
      consolidationControls,
      props.onOrderUpdate,
      props.onExpand,
    );
    const controlSpy = vitest.spyOn(consolidationControls, 'showConfirmationModal');
    useCase.handleApproveButtonClick();
    expect(controlSpy).toHaveBeenCalled();
  });
});
