import { describe, expect, test, vi, beforeEach, SpyInstance } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import ResyncTerminalTransactionCases from './resync-terminal-transaction-cases';
import factory from '../../factory';
import MockData from '@common/cams/test-utilities/mock-data';
import { CasesInterface } from '../../use-cases/cases/cases.interface';

describe('ResyncTerminalTransactionCases', () => {
  let context: ApplicationContext;
  let gatewaySpy: SpyInstance<[ApplicationContext], CasesInterface>;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    gatewaySpy = vi.spyOn(factory, 'getCasesGateway');
  });

  describe('getCaseIdsWithBlindSpot', () => {
    test('should return events with type MIGRATION', async () => {
      const mockCaseIds = MockData.buildArray(MockData.randomCaseId, 3);
      gatewaySpy.mockReturnValue({
        getCasesWithTerminalTransactionBlindSpot: vi.fn().mockResolvedValue(mockCaseIds),
      });

      const result = await ResyncTerminalTransactionCases.getCaseIdsWithBlindSpot(context);

      expect(result.events).toHaveLength(3);
      expect(result.events[0]).toEqual({
        type: 'MIGRATION',
        caseId: expect.any(String),
      });
    });

    test('should use default cutoffDate if not provided', async () => {
      const mockMethod = vi.fn().mockResolvedValue([]);
      gatewaySpy.mockReturnValue({
        getCasesWithTerminalTransactionBlindSpot: mockMethod,
      });

      await ResyncTerminalTransactionCases.getCaseIdsWithBlindSpot(context);

      expect(mockMethod).toHaveBeenCalledWith(context, '2018-01-01');
    });

    test('should use provided cutoffDate', async () => {
      const mockMethod = vi.fn().mockResolvedValue([]);
      gatewaySpy.mockReturnValue({
        getCasesWithTerminalTransactionBlindSpot: mockMethod,
      });

      await ResyncTerminalTransactionCases.getCaseIdsWithBlindSpot(context, '2020-01-01');

      expect(mockMethod).toHaveBeenCalledWith(context, '2020-01-01');
    });

    test('should return error when gateway fails', async () => {
      gatewaySpy.mockReturnValue({
        getCasesWithTerminalTransactionBlindSpot: vi
          .fn()
          .mockRejectedValue(new Error('DXTR error')),
      });

      const result = await ResyncTerminalTransactionCases.getCaseIdsWithBlindSpot(context);

      expect(result.error).toBeDefined();
      expect(result.error.message).toContain(
        'Failed to get case IDs with terminal transaction blind spot',
      );
    });
  });
});
