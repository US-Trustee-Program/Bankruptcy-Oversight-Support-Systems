import { beforeEach, describe, expect, test, vi } from 'vitest';
import MockData from './test-utilities/mock-data';
import { TrusteeMatchVerification } from './trustee-match-verification';
import {
  computeTaskDate,
  isConsolidationOrder,
  isTransferOrder,
  isTrusteeMatchVerification,
} from './data-verification';

beforeEach(() => {
  vi.restoreAllMocks();
});

const baseVerification: TrusteeMatchVerification = {
  id: 'test-id',
  documentType: 'TRUSTEE_MATCH_VERIFICATION',
  caseId: '00-00000',
  courtId: 'test-court',
  dxtrTrustee: {
    fullName: 'Test Trustee',
  },
  matchCandidates: [],
  status: 'pending',
  orderType: 'trustee-match',
  updatedOn: '2025-03-15T00:00:00.000Z',
  updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
  taskDate: '2025-03-15T00:00:00.000Z',
};

describe('isTransferOrder', () => {
  test('should return true for a TransferOrder', () => {
    expect(isTransferOrder(MockData.getTransferOrder())).toBe(true);
  });

  test('should return false for a ConsolidationOrder', () => {
    expect(isTransferOrder(MockData.getConsolidationOrder())).toBe(false);
  });

  test('should return false for a TrusteeMatchVerification', () => {
    expect(isTransferOrder(baseVerification)).toBe(false);
  });
});

describe('isConsolidationOrder', () => {
  test('should return true for a ConsolidationOrder', () => {
    expect(isConsolidationOrder(MockData.getConsolidationOrder())).toBe(true);
  });

  test('should return false for a TransferOrder', () => {
    expect(isConsolidationOrder(MockData.getTransferOrder())).toBe(false);
  });

  test('should return false for a TrusteeMatchVerification', () => {
    expect(isConsolidationOrder(baseVerification)).toBe(false);
  });
});

describe('isTrusteeMatchVerification', () => {
  test('should return true for a TrusteeMatchVerification', () => {
    expect(isTrusteeMatchVerification(baseVerification)).toBe(true);
  });

  test('should return false for a TransferOrder', () => {
    expect(isTrusteeMatchVerification(MockData.getTransferOrder())).toBe(false);
  });

  test('should return false for a ConsolidationOrder', () => {
    expect(isTrusteeMatchVerification(MockData.getConsolidationOrder())).toBe(false);
  });
});

describe('computeTaskDate', () => {
  test('should return orderDate for TransferOrder', () => {
    const order = MockData.getTransferOrder({
      override: { orderDate: '2025-01-15T00:00:00.000Z' },
    });
    expect(computeTaskDate(order)).toBe('2025-01-15T00:00:00.000Z');
  });

  test('should return orderDate for ConsolidationOrder', () => {
    const order = MockData.getConsolidationOrder({
      override: { orderDate: '2025-02-20T00:00:00.000Z' },
    });
    expect(computeTaskDate(order)).toBe('2025-02-20T00:00:00.000Z');
  });

  test('should return createdOn for TrusteeMatchVerification when present', () => {
    const verification: TrusteeMatchVerification = {
      ...baseVerification,
      createdOn: '2025-03-10T00:00:00.000Z',
      updatedOn: '2025-03-15T00:00:00.000Z',
    };
    expect(computeTaskDate(verification)).toBe('2025-03-10T00:00:00.000Z');
  });

  test('should fallback to updatedOn when createdOn is missing', () => {
    const verification: TrusteeMatchVerification = {
      ...baseVerification,
      createdOn: undefined,
      updatedOn: '2025-03-20T00:00:00.000Z',
    };
    expect(computeTaskDate(verification)).toBe('2025-03-20T00:00:00.000Z');
  });
});
