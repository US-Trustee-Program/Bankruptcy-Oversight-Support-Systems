import {
  ConsolidationOrderActionApproval,
  ConsolidationOrderActionRejection,
  generateConsolidationId,
  getCaseSummaryFromConsolidationOrderCase,
  getCaseSummaryFromTransferOrder,
  isConsolidationOrder,
  isConsolidationOrderApproval,
  isConsolidationOrderRejection,
  isTransferOrder,
  OrderStatus,
} from './orders';
import MockData from './test-utilities/mock-data';
import { isConsolidationHistory } from './history';

describe('orders model tests', () => {
  test('should properly identify transfers', () => {
    const mockOrder = MockData.getTransferOrder();
    expect(isTransferOrder(mockOrder)).toBeTruthy();
    expect(isConsolidationOrder(mockOrder)).toBeFalsy();
  });

  test('should properly identify consolidations', () => {
    const mockOrder = MockData.getConsolidationOrder();
    expect(isTransferOrder(mockOrder)).toBeFalsy();
    expect(isConsolidationOrder(mockOrder)).toBeTruthy();
  });

  test('should properly identify consolidation rejections', () => {
    const mockOrder = MockData.getConsolidationOrder();
    const mockOrderAction: ConsolidationOrderActionRejection = {
      consolidationId: mockOrder.consolidationId,
      rejectedCases: mockOrder.memberCases.map((bCase) => bCase.caseId),
    };
    mockOrderAction.rejectedCases = [];
    mockOrderAction.reason = 'rejection reason';
    expect(isConsolidationOrderRejection(mockOrderAction)).toBeTruthy();
  });

  test('should properly identify consolidation approvals', () => {
    const mockOrder = MockData.getConsolidationOrder();
    const mockOrderAction: ConsolidationOrderActionApproval = {
      consolidationId: mockOrder.consolidationId,
      approvedCases: mockOrder.memberCases.map((bCase) => bCase.caseId),
      leadCase: MockData.getCaseSummary(),
      consolidationType: 'administrative',
    };
    mockOrderAction.approvedCases = [];
    mockOrderAction.leadCase = MockData.getCaseSummary();
    expect(isConsolidationOrderApproval(mockOrderAction)).toBeTruthy();
  });

  test('should properly identify consolidation history', () => {
    const mockHistory = MockData.getConsolidationHistory();
    expect(isConsolidationHistory(mockHistory)).toBeTruthy();
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
      expect(
        (summary as Record<string, unknown>)[consolidationOnlyProperties[idx]],
      ).toBeUndefined();
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

  describe('generateConsolidationId', () => {
    const idTests = [
      [[1000, 'pending'], '1000/pending'],
      [[1000, 'pending', 0], '1000/pending'],
      [[2000, 'approved', 0], '2000/approved/0'],
      [[2000, 'approved', 10], '2000/approved/10'],
      [[3000, 'rejected', 1], '3000/rejected/1'],
    ];
    test.each(idTests)('should generate expected consolidation id for %s', (args, expected) => {
      expect(
        generateConsolidationId(...(args as [number, OrderStatus, number | undefined])),
      ).toEqual(expected);
    });
  });
});
