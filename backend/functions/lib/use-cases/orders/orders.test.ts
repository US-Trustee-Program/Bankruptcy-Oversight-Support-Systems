import { MockCaseDocketGateway } from '../../adapters/gateways/dxtr/case-docket.mock.gateway';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { DXTR_CASE_DOCKET_ENTRIES } from '../../testing/mock-data/case-docket-entries.mock';
import { OrdersUseCase } from './orders';

describe('Orders use case', () => {
  test('should return list of orders', async () => {
    const gateway = new MockCaseDocketGateway();
    const useCase = new OrdersUseCase(gateway);
    const mockContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    const result = await useCase.getOrders(mockContext);
    expect(result).toEqual(DXTR_CASE_DOCKET_ENTRIES);
  });
});
