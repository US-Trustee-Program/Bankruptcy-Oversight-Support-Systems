import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import BackfillTrusteePhoneticTokens from './backfill-trustee-phonetic-tokens';
import factory from '../../factory';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { generateSearchTokens } from '../../adapters/utils/phonetic-helper';
import { Trustee } from '@common/cams/trustees';

describe('BackfillTrusteePhoneticTokens use case', () => {
  let context: ApplicationContext;

  const makeTrustee = (
    overrides: Partial<Trustee> & { trusteeId: string; name: string },
  ): Trustee =>
    ({
      id: overrides.id ?? `doc-${overrides.trusteeId}`,
      trusteeId: overrides.trusteeId,
      name: overrides.name,
      public: {
        address: {
          address1: '123 Main St',
          city: 'Anytown',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
        email: 'test@example.com',
      },
      documentType: 'TRUSTEE',
      ...overrides,
    }) as unknown as Trustee;

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getTrusteesNeedingBackfill', () => {
    test('should return trustees missing phoneticTokens', async () => {
      const trusteeWithTokens = makeTrustee({
        trusteeId: 'trustee-001',
        name: 'John Smith',
        phoneticTokens: ['jo', 'oh', 'hn', 'J500'],
      });
      const trusteeWithoutTokens = makeTrustee({
        trusteeId: 'trustee-002',
        name: 'Jane Doe',
      });
      const trusteeWithEmptyTokens = makeTrustee({
        trusteeId: 'trustee-003',
        name: 'Bob Jones',
        phoneticTokens: [],
      });

      vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          listTrustees: vi
            .fn()
            .mockResolvedValue([trusteeWithTokens, trusteeWithoutTokens, trusteeWithEmptyTokens]),
        }),
      );

      const result = await BackfillTrusteePhoneticTokens.getTrusteesNeedingBackfill(context);

      expect(result.data).toBeDefined();
      expect(result.data).toHaveLength(2);
      expect(result.data![0].trusteeId).toBe('trustee-002');
      expect(result.data![1].trusteeId).toBe('trustee-003');
    });

    test('should return empty array when all trustees have tokens', async () => {
      const trustee = makeTrustee({
        trusteeId: 'trustee-001',
        name: 'John Smith',
        phoneticTokens: ['jo', 'oh', 'hn', 'J500'],
      });

      vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          listTrustees: vi.fn().mockResolvedValue([trustee]),
        }),
      );

      const result = await BackfillTrusteePhoneticTokens.getTrusteesNeedingBackfill(context);

      expect(result.data).toEqual([]);
    });

    test('should return error when listTrustees fails', async () => {
      vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          listTrustees: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      );

      const result = await BackfillTrusteePhoneticTokens.getTrusteesNeedingBackfill(context);

      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  describe('backfillTokensForTrustees', () => {
    test('should generate and set phoneticTokens on each trustee', async () => {
      const trustee1 = makeTrustee({ trusteeId: 'trustee-001', name: 'John Smith' });
      const trustee2 = makeTrustee({ trusteeId: 'trustee-002', name: 'Jane Doe' });

      const setPhoneticTokensSpy = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          setPhoneticTokens: setPhoneticTokensSpy,
        }),
      );

      const result = await BackfillTrusteePhoneticTokens.backfillTokensForTrustees(context, [
        trustee1,
        trustee2,
      ]);

      expect(result.data).toBeDefined();
      expect(result.data).toHaveLength(2);
      expect(result.data!.every((r) => r.success)).toBe(true);
      expect(setPhoneticTokensSpy).toHaveBeenCalledTimes(2);

      // Verify tokens match generateSearchTokens output
      const expectedTokens1 = generateSearchTokens('John Smith');
      expect(setPhoneticTokensSpy).toHaveBeenCalledWith('trustee-001', expectedTokens1);

      const expectedTokens2 = generateSearchTokens('Jane Doe');
      expect(setPhoneticTokensSpy).toHaveBeenCalledWith('trustee-002', expectedTokens2);
    });

    test('should record failure for individual trustee update errors', async () => {
      const trustee = makeTrustee({ trusteeId: 'trustee-001', name: 'John Smith' });

      const setPhoneticTokensSpy = vi.fn().mockRejectedValue(new Error('Update failed'));
      vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          setPhoneticTokens: setPhoneticTokensSpy,
        }),
      );

      const result = await BackfillTrusteePhoneticTokens.backfillTokensForTrustees(context, [
        trustee,
      ]);

      expect(result.data).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.data![0].success).toBe(false);
      expect(result.data![0].error).toBe('Update failed');
    });

    test('should return empty results for empty input', async () => {
      const result = await BackfillTrusteePhoneticTokens.backfillTokensForTrustees(context, []);

      expect(result.data).toEqual([]);
    });
  });
});
