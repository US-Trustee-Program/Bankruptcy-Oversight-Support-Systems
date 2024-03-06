import { isConsolidationOrder, isTransferOrder } from './orders';
import { MockData } from './test-utilities/mock-data';
import { isConsolidationHistory } from './history';

describe('orders model tests', () => {
  test('should properly identify transfers', () => {
    const mockOrder = MockData.getTransferOrder();
    expect(isTransferOrder(mockOrder)).toEqual(true);
    expect(isConsolidationOrder(mockOrder)).toEqual(false);
  });

  test('should properly identify consolidations', () => {
    const mockOrder = MockData.getConsolidationOrder();
    expect(isTransferOrder(mockOrder)).toEqual(false);
    expect(isConsolidationOrder(mockOrder)).toEqual(true);
  });

  test('should properly identify consolidation history', () => {
    const mockHistory = MockData.getConsolidationHistory();
    expect(isConsolidationHistory(mockHistory)).toEqual(true);
  });
});
