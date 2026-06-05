import { describe, test, expect } from 'vitest';
import { asDbDoc, fromDbDoc } from './mock-db-transformations';
import MockData from '@common/cams/test-utilities/mock-data';

describe('mock-db-transformations', () => {
  describe('asDbDoc', () => {
    test('should rename taskType to orderType for transfer order', () => {
      const order = {
        id: '123',
        taskType: 'transfer',
        caseId: '456',
        status: 'pending',
      };

      const dbDoc = asDbDoc(order);

      expect(dbDoc).toHaveProperty('orderType', 'transfer');
      expect(dbDoc).not.toHaveProperty('taskType');
      expect(dbDoc).toHaveProperty('id', '123');
      expect(dbDoc).toHaveProperty('caseId', '456');
      expect(dbDoc).toHaveProperty('status', 'pending');
    });

    test('should rename taskType to orderType for consolidation order', () => {
      const order = {
        id: '789',
        taskType: 'consolidation',
        caseId: '012',
      };

      const dbDoc = asDbDoc(order);

      expect(dbDoc).toHaveProperty('orderType', 'consolidation');
      expect(dbDoc).not.toHaveProperty('taskType');
    });

    test('should preserve all other fields unchanged', () => {
      const order = {
        id: 'order-1',
        taskType: 'transfer',
        caseId: 'case-1',
        courtName: 'Test Court',
        orderDate: '2024-01-01',
        docketSuggestedCaseNumber: '24-12345',
        status: 'approved',
        newCase: {
          caseId: 'new-case-1',
          chapter: '7',
        },
      };

      const dbDoc = asDbDoc(order);

      expect(dbDoc).toHaveProperty('id', 'order-1');
      expect(dbDoc).toHaveProperty('caseId', 'case-1');
      expect(dbDoc).toHaveProperty('courtName', 'Test Court');
      expect(dbDoc).toHaveProperty('orderDate', '2024-01-01');
      expect(dbDoc).toHaveProperty('docketSuggestedCaseNumber', '24-12345');
      expect(dbDoc).toHaveProperty('status', 'approved');
      expect(dbDoc).toHaveProperty('newCase');
      expect(dbDoc.newCase).toEqual({ caseId: 'new-case-1', chapter: '7' });
    });

    test('should handle missing taskType gracefully', () => {
      const order = { id: '123', caseId: '456' };

      const dbDoc = asDbDoc(order);

      expect(dbDoc).toHaveProperty('orderType', undefined);
      expect(dbDoc).not.toHaveProperty('taskType');
      expect(dbDoc).toHaveProperty('id', '123');
      expect(dbDoc).toHaveProperty('caseId', '456');
    });

    test('should work with MockData transfer order', () => {
      const order = MockData.getTransferOrder();

      const dbDoc = asDbDoc(order);

      expect(dbDoc).toHaveProperty('orderType', 'transfer');
      expect(dbDoc).not.toHaveProperty('taskType');
      expect(dbDoc).toHaveProperty('id', order.id);
    });

    test('should work with MockData consolidation order', () => {
      const order = MockData.getConsolidationOrder();

      const dbDoc = asDbDoc(order);

      expect(dbDoc).toHaveProperty('orderType', 'consolidation');
      expect(dbDoc).not.toHaveProperty('taskType');
      expect(dbDoc).toHaveProperty('id', order.id);
    });

    test('should handle nested objects correctly', () => {
      const order = {
        id: '123',
        taskType: 'transfer',
        newCase: {
          caseId: 'nested-case',
          chapter: '11',
        },
      };

      const dbDoc = asDbDoc(order);

      expect(dbDoc).toHaveProperty('orderType', 'transfer');
      expect(dbDoc).not.toHaveProperty('taskType');
      expect(dbDoc.newCase).toEqual({ caseId: 'nested-case', chapter: '11' });
    });
  });

  describe('fromDbDoc', () => {
    test('should rename orderType to taskType for transfer order', () => {
      const dbDoc = {
        id: '123',
        orderType: 'transfer',
        caseId: '456',
        status: 'pending',
      };

      const domainObject = fromDbDoc(dbDoc);

      expect(domainObject).toHaveProperty('taskType', 'transfer');
      expect(domainObject).not.toHaveProperty('orderType');
      expect(domainObject).toHaveProperty('id', '123');
      expect(domainObject).toHaveProperty('caseId', '456');
      expect(domainObject).toHaveProperty('status', 'pending');
    });

    test('should rename orderType to taskType for consolidation order', () => {
      const dbDoc = {
        id: '789',
        orderType: 'consolidation',
        caseId: '012',
      };

      const domainObject = fromDbDoc(dbDoc);

      expect(domainObject).toHaveProperty('taskType', 'consolidation');
      expect(domainObject).not.toHaveProperty('orderType');
    });

    test('should preserve all other fields unchanged', () => {
      const dbDoc = {
        id: 'order-1',
        orderType: 'transfer',
        caseId: 'case-1',
        courtName: 'Test Court',
        orderDate: '2024-01-01',
      };

      const domainObject = fromDbDoc(dbDoc);

      expect(domainObject).toHaveProperty('taskType', 'transfer');
      expect(domainObject).toHaveProperty('id', 'order-1');
      expect(domainObject).toHaveProperty('caseId', 'case-1');
      expect(domainObject).toHaveProperty('courtName', 'Test Court');
      expect(domainObject).toHaveProperty('orderDate', '2024-01-01');
    });

    test('should handle missing orderType gracefully', () => {
      const dbDoc = { id: '123', caseId: '456' };

      const domainObject = fromDbDoc(dbDoc);

      expect(domainObject).toHaveProperty('taskType', undefined);
      expect(domainObject).not.toHaveProperty('orderType');
    });

    test('should be inverse of asDbDoc for transfer order', () => {
      const original = {
        id: '123',
        taskType: 'transfer',
        caseId: '456',
      };

      const dbDoc = asDbDoc(original);
      const roundTripped = fromDbDoc(dbDoc);

      expect(roundTripped).toEqual(original);
    });

    test('should be inverse of asDbDoc for consolidation order', () => {
      const original = {
        id: '789',
        taskType: 'consolidation',
        caseId: '012',
      };

      const dbDoc = asDbDoc(original);
      const roundTripped = fromDbDoc(dbDoc);

      expect(roundTripped).toEqual(original);
    });
  });

  describe('round-trip transformations', () => {
    test('should correctly round-trip domain → DB → domain for transfer order', () => {
      const domainOrder = MockData.getTransferOrder();

      // Simulate saving to DB
      const dbDoc = asDbDoc(domainOrder);
      expect(dbDoc).toHaveProperty('orderType', 'transfer');
      expect(dbDoc).not.toHaveProperty('taskType');

      // Simulate loading from DB
      const loadedOrder = fromDbDoc(dbDoc);
      expect(loadedOrder).toHaveProperty('taskType', 'transfer');
      expect(loadedOrder).not.toHaveProperty('orderType');

      // Verify data integrity
      expect(loadedOrder.id).toBe(domainOrder.id);
      expect(loadedOrder.caseId).toBe(domainOrder.caseId);
    });

    test('should correctly round-trip domain → DB → domain for consolidation order', () => {
      const domainOrder = MockData.getConsolidationOrder();

      const dbDoc = asDbDoc(domainOrder);
      expect(dbDoc).toHaveProperty('orderType', 'consolidation');

      const loadedOrder = fromDbDoc(dbDoc);
      expect(loadedOrder).toHaveProperty('taskType', 'consolidation');

      expect(loadedOrder.id).toBe(domainOrder.id);
      expect(loadedOrder.consolidationId).toBe(domainOrder.consolidationId);
    });
  });
});
