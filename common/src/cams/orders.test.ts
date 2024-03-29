import {
  getCaseSummaryFromConsolidationOrderCase,
  getCaseSummaryFromTransferOrder,
  isConsolidationOrder,
  isTransferOrder,
} from './orders';
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

  describe('temporary mapper function tests', () => {
    test('should get CaseSummary from TransferOrder', () => {
      const summaryIdentity = MockData.getCaseSummary();
      const summaryProperties = Object.getOwnPropertyNames(summaryIdentity);
      const transferIdentity = MockData.getTransferOrder();
      const transferProperties = Object.getOwnPropertyNames(transferIdentity);
      const transferOnlyProperties = transferProperties.filter(
        (prop) => !summaryProperties.includes(prop),
      );

      const transfer = MockData.getTransferOrder();
      const summary = getCaseSummaryFromTransferOrder(transfer);

      for (const idx in summaryProperties) {
        expect(summary).toHaveProperty(summaryProperties[idx]);
      }
      for (const idx in transferOnlyProperties) {
        expect(summary).not.toHaveProperty(transferOnlyProperties[idx]);
      }
    });
  });

  test('should get CaseSummary from ConsolidationOrderCase', () => {
    const summaryIdentity = MockData.getCaseSummary();
    const summaryProperties = Object.getOwnPropertyNames(summaryIdentity);
    const consolidationIdentity = MockData.getConsolidatedOrderCase();
    const consolidationProperties = Object.getOwnPropertyNames(consolidationIdentity);
    const consolidationOnlyProperties = consolidationProperties.filter(
      (prop) => !summaryProperties.includes(prop),
    );

    const consolidation = MockData.getConsolidatedOrderCase();
    const summary = getCaseSummaryFromConsolidationOrderCase(consolidation);

    for (const idx in summaryProperties) {
      expect(summary).toHaveProperty(summaryProperties[idx]);
    }
    for (const idx in consolidationOnlyProperties) {
      expect(summary).not.toHaveProperty(consolidationOnlyProperties[idx]);
    }
  });

  test('should get CaseSummary from RawConsolidationOrder', () => {
    const summaryIdentity = MockData.getCaseSummary();
    const summaryProperties = Object.getOwnPropertyNames(summaryIdentity);
    const rawConsolidationIdentity = MockData.getRawConsolidationOrder();
    const rawConsolidationProperties = Object.getOwnPropertyNames(rawConsolidationIdentity);
    const rawConsolidationOnlyProperties = rawConsolidationProperties.filter(
      (prop) => !summaryProperties.includes(prop),
    );

    const rawConsolidation = MockData.getRawConsolidationOrder();
    const summary = getCaseSummaryFromConsolidationOrderCase(rawConsolidation);

    for (const idx in summaryProperties) {
      expect(summary).toHaveProperty(summaryProperties[idx]);
    }
    for (const idx in rawConsolidationOnlyProperties) {
      expect(summary).not.toHaveProperty(rawConsolidationOnlyProperties[idx]);
    }
  });
});
