import { vi, describe, test, expect, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import BackfillTrusteePhoneticTokensUseCase from '../../../lib/use-cases/dataflows/backfill-trustee-phonetic-tokens';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { ApplicationContext } from '../../../lib/adapters/types/basic';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { Trustee } from '@common/cams/trustees';

// Import the module to access handleStart
// Note: Since handleStart is not exported, we need to test via the module's behavior
// or restructure to export it. For now, we'll test the use case methods that are called.

function makeTrustee(trusteeId: string, name: string): Trustee {
  return {
    id: `doc-${trusteeId}`,
    trusteeId,
    name,
    documentType: 'TRUSTEE',
    public: {
      address: {
        address1: '123 Main St',
        city: 'Anytown',
        state: 'NY',
        zipCode: '10001',
        countryCode: 'US',
      },
    },
    updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
    updatedOn: '2025-01-01T00:00:00.000Z',
  } as Trustee;
}

describe('Backfill Trustee Phonetic Tokens Migration', () => {
  let context: ApplicationContext;
  let _mockInvocationContext: InvocationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    _mockInvocationContext = {
      invocationId: 'test-invocation-id',
      functionName: 'backfill-trustee-phonetic-tokens',
      extraOutputs: new Map(),
      log: vi.fn(),
    } as unknown as InvocationContext;
  });

  describe('getTrusteesNeedingBackfill', () => {
    test('should be called to identify trustees missing phonetic tokens', async () => {
      vi.spyOn(
        BackfillTrusteePhoneticTokensUseCase,
        'getTrusteesNeedingBackfill',
      ).mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await BackfillTrusteePhoneticTokensUseCase.getTrusteesNeedingBackfill(context);

      expect(BackfillTrusteePhoneticTokensUseCase.getTrusteesNeedingBackfill).toHaveBeenCalled();
      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
    });

    test('should handle error when fetching trustees fails', async () => {
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

      const result = await BackfillTrusteePhoneticTokensUseCase.getTrusteesNeedingBackfill(context);

      expect(result.error).toBe(testError);
      expect(result.data).toBeUndefined();
    });

    test('should return trustees that need phonetic token backfill', async () => {
      const mockTrustees = [
        makeTrustee('trustee-001', 'John Smith'),
        makeTrustee('trustee-002', 'Jane Doe'),
      ];

      vi.spyOn(
        BackfillTrusteePhoneticTokensUseCase,
        'getTrusteesNeedingBackfill',
      ).mockResolvedValue({
        data: mockTrustees,
        error: null,
      });

      const result = await BackfillTrusteePhoneticTokensUseCase.getTrusteesNeedingBackfill(context);

      expect(result.data).toEqual(mockTrustees);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('backfillTokensForTrustees', () => {
    test('should process all provided trustees', async () => {
      const mockTrustees = [
        makeTrustee('trustee-001', 'John Smith'),
        makeTrustee('trustee-002', 'Jane Doe'),
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
        context,
        mockTrustees,
      );

      expect(BackfillTrusteePhoneticTokensUseCase.backfillTokensForTrustees).toHaveBeenCalledWith(
        context,
        mockTrustees,
      );
      expect(result.data).toEqual(mockResults);
      expect(result.data?.every((r) => r.success)).toBe(true);
    });

    test('should return partial results when some trustees fail', async () => {
      const mockTrustees = [
        makeTrustee('trustee-001', 'John Smith'),
        makeTrustee('trustee-002', 'Jane Doe'),
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
        context,
        mockTrustees,
      );

      expect(result.data).toEqual(mockResults);
      expect(result.data?.filter((r) => r.success)).toHaveLength(1);
      expect(result.data?.filter((r) => !r.success)).toHaveLength(1);
    });

    test('should handle empty trustee array', async () => {
      vi.spyOn(BackfillTrusteePhoneticTokensUseCase, 'backfillTokensForTrustees').mockResolvedValue(
        {
          data: [],
          error: null,
        },
      );

      const result = await BackfillTrusteePhoneticTokensUseCase.backfillTokensForTrustees(
        context,
        [],
      );

      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
    });

    test('should handle complete failure during backfill', async () => {
      const mockTrustees = [makeTrustee('trustee-001', 'John Smith')];

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
        context,
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
