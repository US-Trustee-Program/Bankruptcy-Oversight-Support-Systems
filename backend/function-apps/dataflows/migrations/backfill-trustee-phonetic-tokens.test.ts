import { vi, describe, test, expect, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import BackfillTrusteePhoneticTokensUseCase from '../../../lib/use-cases/dataflows/backfill-trustee-phonetic-tokens';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { ApplicationContext } from '../../../lib/adapters/types/basic';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { Trustee } from '@common/cams/trustees';
import { handleStart } from './backfill-trustee-phonetic-tokens';

function makeTrustee(trusteeId: string, name: string): Trustee {
  return {
    id: `doc-${trusteeId}`,
    trusteeId,
    firstName: name.split(' ')[0] || name,
    lastName: name.split(' ').slice(1).join(' ') || name,
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

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-invocation-id',
    functionName: 'backfill-trustee-phonetic-tokens',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

describe('Backfill Trustee Phonetic Tokens Migration', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  describe('handleStart', () => {
    test('should rethrow 429 error and not write to DLQ', async () => {
      const invocationContext = makeInvocationContext();
      const tooManyError = new TooManyRequestsError('BACKFILL-TRUSTEE-PHONETIC-TOKENS');

      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(context);
      vi.spyOn(
        BackfillTrusteePhoneticTokensUseCase,
        'getTrusteesNeedingBackfill',
      ).mockRejectedValue(tooManyError);

      await expect(handleStart({}, invocationContext)).rejects.toThrow(tooManyError);

      const outputs = invocationContext.extraOutputs as unknown as Map<
        { queueName: string },
        unknown
      >;
      const dlqOutput = Array.from(outputs.entries()).find(([key]) =>
        key.queueName?.includes('dlq'),
      );
      expect(dlqOutput).toBeUndefined();
    });

    test('should write to DLQ and not rethrow on non-429 error', async () => {
      const invocationContext = makeInvocationContext();
      const nonRateLimitError = new CamsError('BACKFILL-TRUSTEE-PHONETIC-TOKENS', {
        message: 'Database error',
      });

      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(context);
      vi.spyOn(
        BackfillTrusteePhoneticTokensUseCase,
        'getTrusteesNeedingBackfill',
      ).mockRejectedValue(nonRateLimitError);

      await expect(handleStart({}, invocationContext)).resolves.not.toThrow();

      const outputs = invocationContext.extraOutputs as unknown as Map<
        { queueName: string },
        unknown
      >;
      const dlqOutput = Array.from(outputs.entries()).find(([key]) =>
        key.queueName?.includes('dlq'),
      );
      expect(dlqOutput).toBeDefined();
    });

    test('should write failed trustee results to DLQ when backfill has partial failures', async () => {
      const invocationContext = makeInvocationContext();
      const trustees = [
        makeTrustee('trustee-001', 'John Smith'),
        makeTrustee('trustee-002', 'Jane Doe'),
      ];
      const backfillResults = [
        { success: true, trusteeId: 'trustee-001' },
        { success: false, trusteeId: 'trustee-002', error: 'Update failed' },
      ];

      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(context);
      vi.spyOn(
        BackfillTrusteePhoneticTokensUseCase,
        'getTrusteesNeedingBackfill',
      ).mockResolvedValue({ data: trustees, error: null });
      vi.spyOn(BackfillTrusteePhoneticTokensUseCase, 'backfillTokensForTrustees').mockResolvedValue(
        { data: backfillResults, error: null },
      );

      await handleStart({}, invocationContext);

      const outputs = invocationContext.extraOutputs as unknown as Map<
        { queueName: string },
        unknown
      >;
      const dlqOutput = Array.from(outputs.entries()).find(([key]) =>
        key.queueName?.includes('dlq'),
      );
      expect(dlqOutput).toBeDefined();
    });

    test('should complete without DLQ write when all trustees already have tokens', async () => {
      const invocationContext = makeInvocationContext();

      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(context);
      vi.spyOn(
        BackfillTrusteePhoneticTokensUseCase,
        'getTrusteesNeedingBackfill',
      ).mockResolvedValue({ data: [], error: null });

      await handleStart({}, invocationContext);

      const outputs = invocationContext.extraOutputs as unknown as Map<
        { queueName: string },
        unknown
      >;
      const dlqOutput = Array.from(outputs.entries()).find(([key]) =>
        key.queueName?.includes('dlq'),
      );
      expect(dlqOutput).toBeUndefined();
    });

    test('should write to DLQ when getTrusteesNeedingBackfill returns an error', async () => {
      const invocationContext = makeInvocationContext();
      const fetchError = new CamsError('BACKFILL-TRUSTEE-PHONETIC-TOKENS', {
        message: 'Repository read failed',
      });

      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(context);
      vi.spyOn(
        BackfillTrusteePhoneticTokensUseCase,
        'getTrusteesNeedingBackfill',
      ).mockResolvedValue({ data: undefined, error: fetchError });

      await handleStart({}, invocationContext);

      const outputs = invocationContext.extraOutputs as unknown as Map<
        { queueName: string },
        unknown
      >;
      const dlqOutput = Array.from(outputs.entries()).find(([key]) =>
        key.queueName?.includes('dlq'),
      );
      expect(dlqOutput).toBeDefined();
    });
  });

  describe('module structure', () => {
    test('should export MODULE_NAME', async () => {
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
