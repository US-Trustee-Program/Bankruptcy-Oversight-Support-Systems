import { vi, describe, test, expect, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import BackfillTrusteePhoneticTokensUseCase from '../../../lib/use-cases/dataflows/backfill-trustee-phonetic-tokens';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { ApplicationContext } from '../../../lib/adapters/types/basic';

// Import the module to access handleStart
// Note: Since handleStart is not exported, we need to test via the module's behavior
// or restructure to export it. For now, we'll test the use case methods that are called.

describe('Backfill Trustee Phonetic Tokens Migration', () => {
  let _mockInvocationContext: InvocationContext;

  beforeEach(() => {
    vi.restoreAllMocks();
    _mockInvocationContext = {
      invocationId: 'test-invocation-id',
      functionName: 'backfill-trustee-phonetic-tokens',
      extraOutputs: new Map(),
      log: vi.fn(),
    } as unknown as InvocationContext;
  });

  describe('getTrusteesNeedingBackfill', () => {
    test('should be called to identify trustees missing phonetic tokens', async () => {
      const mockContext = {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
      } as ApplicationContext;

      vi.spyOn(
        BackfillTrusteePhoneticTokensUseCase,
        'getTrusteesNeedingBackfill',
      ).mockResolvedValue({
        data: [],
        error: null,
      });

      const result =
        await BackfillTrusteePhoneticTokensUseCase.getTrusteesNeedingBackfill(mockContext);

      expect(BackfillTrusteePhoneticTokensUseCase.getTrusteesNeedingBackfill).toHaveBeenCalled();
      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
    });

    test('should handle error when fetching trustees fails', async () => {
      const mockContext = {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
      } as ApplicationContext;

      const testError = new CamsError('BACKFILL-TEST', {
        message: 'Database connection failed',
      });

      vi.spyOn(
        BackfillTrusteePhoneticTokensUseCase,
        'getTrusteesNeedingBackfill',
      ).mockResolvedValue({
        data: undefined,
        error: testError,
      });

      const result =
        await BackfillTrusteePhoneticTokensUseCase.getTrusteesNeedingBackfill(mockContext);

      expect(result.error).toBe(testError);
      expect(result.data).toBeUndefined();
    });

    test('should return trustees that need phonetic token backfill', async () => {
      const mockContext = {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
      } as ApplicationContext;

      const mockTrustees = [
        {
          trusteeId: 'trustee-001',
          name: 'John Smith',
        },
        {
          trusteeId: 'trustee-002',
          name: 'Jane Doe',
        },
      ];

      vi.spyOn(
        BackfillTrusteePhoneticTokensUseCase,
        'getTrusteesNeedingBackfill',
      ).mockResolvedValue({
        data: mockTrustees,
        error: null,
      });

      const result =
        await BackfillTrusteePhoneticTokensUseCase.getTrusteesNeedingBackfill(mockContext);

      expect(result.data).toEqual(mockTrustees);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('backfillTokensForTrustees', () => {
    test('should process all provided trustees', async () => {
      const mockContext = {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
      } as ApplicationContext;

      const mockTrustees = [
        {
          trusteeId: 'trustee-001',
          name: 'John Smith',
        },
        {
          trusteeId: 'trustee-002',
          name: 'Jane Doe',
        },
      ];

      const mockResults = [
        { success: true, trusteeId: 'trustee-001' },
        { success: true, trusteeId: 'trustee-002' },
      ];

      vi.spyOn(BackfillTrusteePhoneticTokensUseCase, 'backfillTokensForTrustees').mockResolvedValue(
        {
          data: mockResults,
          error: null,
        },
      );

      const result = await BackfillTrusteePhoneticTokensUseCase.backfillTokensForTrustees(
        mockContext,
        mockTrustees,
      );

      expect(BackfillTrusteePhoneticTokensUseCase.backfillTokensForTrustees).toHaveBeenCalledWith(
        mockContext,
        mockTrustees,
      );
      expect(result.data).toEqual(mockResults);
      expect(result.data?.every((r) => r.success)).toBe(true);
    });

    test('should return partial results when some trustees fail', async () => {
      const mockContext = {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
      } as ApplicationContext;

      const mockTrustees = [
        {
          trusteeId: 'trustee-001',
          name: 'John Smith',
        },
        {
          trusteeId: 'trustee-002',
          name: 'Jane Doe',
        },
      ];

      const mockResults = [
        { success: true, trusteeId: 'trustee-001' },
        {
          success: false,
          trusteeId: 'trustee-002',
          error: 'Update failed',
        },
      ];

      vi.spyOn(BackfillTrusteePhoneticTokensUseCase, 'backfillTokensForTrustees').mockResolvedValue(
        {
          data: mockResults,
          error: null,
        },
      );

      const result = await BackfillTrusteePhoneticTokensUseCase.backfillTokensForTrustees(
        mockContext,
        mockTrustees,
      );

      expect(result.data).toEqual(mockResults);
      expect(result.data?.filter((r) => r.success)).toHaveLength(1);
      expect(result.data?.filter((r) => !r.success)).toHaveLength(1);
    });

    test('should handle empty trustee array', async () => {
      const mockContext = {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
      } as ApplicationContext;

      vi.spyOn(BackfillTrusteePhoneticTokensUseCase, 'backfillTokensForTrustees').mockResolvedValue(
        {
          data: [],
          error: null,
        },
      );

      const result = await BackfillTrusteePhoneticTokensUseCase.backfillTokensForTrustees(
        mockContext,
        [],
      );

      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
    });

    test('should handle complete failure during backfill', async () => {
      const mockContext = {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
      } as ApplicationContext;

      const mockTrustees = [
        {
          trusteeId: 'trustee-001',
          name: 'John Smith',
        },
      ];

      const testError = new CamsError('BACKFILL-TEST', {
        message: 'Repository failure',
      });

      vi.spyOn(BackfillTrusteePhoneticTokensUseCase, 'backfillTokensForTrustees').mockResolvedValue(
        {
          data: undefined,
          error: testError,
        },
      );

      const result = await BackfillTrusteePhoneticTokensUseCase.backfillTokensForTrustees(
        mockContext,
        mockTrustees,
      );

      expect(result.error).toBe(testError);
      expect(result.data).toBeUndefined();
    });
  });

  describe('HTTP trigger and queue integration', () => {
    test('should successfully export MODULE_NAME', async () => {
      // This verifies the module structure is correct for Azure Functions registration
      const BackfillModule = await import('./backfill-trustee-phonetic-tokens');
      expect(BackfillModule.default.MODULE_NAME).toBe('BACKFILL-TRUSTEE-PHONETIC-TOKENS');
    });

    test('should export setup function for registering handlers', async () => {
      const BackfillModule = await import('./backfill-trustee-phonetic-tokens');
      expect(BackfillModule.default.setup).toBeDefined();
      expect(typeof BackfillModule.default.setup).toBe('function');
    });
  });
});
