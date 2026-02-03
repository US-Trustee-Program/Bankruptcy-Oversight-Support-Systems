import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import MockData from '@common/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import BackfillPhoneticTokens from './backfill-phonetic-tokens';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { generateSearchTokens } from '../../adapters/utils/phonetic-helper';

describe('BackfillPhoneticTokens use case', () => {
  let context: ApplicationContext;

  beforeAll(async () => {
    context = await createMockApplicationContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateTokenUpdates', () => {
    it('should generate tokens for debtor name', () => {
      const bCase = {
        caseId: '123-45-67890',
        debtor: { name: 'John Smith' },
      };

      const updates = BackfillPhoneticTokens.generateTokenUpdates(bCase);

      expect(updates['debtor.phoneticTokens']).toBeDefined();
      expect(updates['debtor.phoneticTokens'].length).toBeGreaterThan(0);
      expect(updates['jointDebtor.phoneticTokens']).toBeUndefined();
    });

    it('should generate tokens for joint debtor name', () => {
      const bCase = {
        caseId: '123-45-67890',
        jointDebtor: { name: 'Jane Doe' },
      };

      const updates = BackfillPhoneticTokens.generateTokenUpdates(bCase);

      expect(updates['debtor.phoneticTokens']).toBeUndefined();
      expect(updates['jointDebtor.phoneticTokens']).toBeDefined();
      expect(updates['jointDebtor.phoneticTokens'].length).toBeGreaterThan(0);
    });

    it('should generate tokens for both debtor and joint debtor', () => {
      const bCase = {
        caseId: '123-45-67890',
        debtor: { name: 'John Smith' },
        jointDebtor: { name: 'Jane Smith' },
      };

      const updates = BackfillPhoneticTokens.generateTokenUpdates(bCase);

      expect(updates['debtor.phoneticTokens']).toBeDefined();
      expect(updates['jointDebtor.phoneticTokens']).toBeDefined();
    });

    it('should return empty object when no names exist', () => {
      const bCase = {
        caseId: '123-45-67890',
      };

      const updates = BackfillPhoneticTokens.generateTokenUpdates(bCase);

      expect(Object.keys(updates).length).toBe(0);
    });

    it('should match output of generateSearchTokens', () => {
      const name = 'John Smith';
      const bCase = {
        caseId: '123-45-67890',
        debtor: { name },
      };

      const updates = BackfillPhoneticTokens.generateTokenUpdates(bCase);
      const expectedTokens = generateSearchTokens(name);

      expect(updates['debtor.phoneticTokens']).toEqual(expectedTokens);
    });
  });

  describe('backfillTokensForCases', () => {
    it('should update cases with phonetic tokens', async () => {
      const updateManyByQuerySpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateManyByQuery')
        .mockResolvedValue({ modifiedCount: 1, matchedCount: 1 });

      const cases = [
        { caseId: '123-45-67890', debtor: { name: 'John Smith' } },
        { caseId: '123-45-67891', debtor: { name: 'Jane Doe' } },
      ];

      const result = await BackfillPhoneticTokens.backfillTokensForCases(context, cases);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBe(2);
      expect(result.data?.every((r) => r.success)).toBe(true);
      expect(updateManyByQuerySpy).toHaveBeenCalledTimes(2);
    });

    it('should handle cases with no names gracefully', async () => {
      const updateManyByQuerySpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateManyByQuery')
        .mockResolvedValue({ modifiedCount: 1, matchedCount: 1 });

      const cases = [{ caseId: '123-45-67890' }];

      const result = await BackfillPhoneticTokens.backfillTokensForCases(context, cases);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].success).toBe(true);
      // Should not call updateManyByQuery when there are no token updates
      expect(updateManyByQuerySpy).not.toHaveBeenCalled();
    });

    it('should record failure when update throws error', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'updateManyByQuery').mockRejectedValue(
        new Error('Database error'),
      );

      const cases = [{ caseId: '123-45-67890', debtor: { name: 'John Smith' } }];

      const result = await BackfillPhoneticTokens.backfillTokensForCases(context, cases);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].success).toBe(false);
      expect(result.data?.[0].error).toBe('Database error');
    });
  });

  describe('getPageOfCasesNeedingBackfill', () => {
    it('should return cases that need backfill', async () => {
      // Only cases needing backfill are returned by searchByQuery (filtering happens at DB level)
      const caseNeedingBackfill = MockData.getSyncedCase({
        override: { caseId: '123-45-67890', debtor: { name: 'John Smith' } },
      });
      const mockCases = [caseNeedingBackfill];

      vi.spyOn(MockMongoRepository.prototype, 'searchByQuery').mockResolvedValue({
        data: mockCases,
        metadata: { total: 1 },
      });

      const result = await BackfillPhoneticTokens.getPageOfCasesNeedingBackfill(context, 0, 100);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].caseId).toBe('123-45-67890');
    });

    it('should return error when searchByQuery fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'searchByQuery').mockRejectedValue(
        new Error('Database error'),
      );

      const result = await BackfillPhoneticTokens.getPageOfCasesNeedingBackfill(context, 0, 100);

      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  describe('initializeBackfill', () => {
    it('should return total count of cases needing backfill', async () => {
      // countByQuery returns the count directly from the database
      vi.spyOn(MockMongoRepository.prototype, 'countByQuery').mockResolvedValue(5);

      const result = await BackfillPhoneticTokens.initializeBackfill(context);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data).toBe(5);
    });

    it('should return error when countByQuery fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'countByQuery').mockRejectedValue(
        new Error('Database error'),
      );

      const result = await BackfillPhoneticTokens.initializeBackfill(context);

      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  describe('completeBackfill', () => {
    it('should return success', async () => {
      const result = await BackfillPhoneticTokens.completeBackfill(context);

      expect(result.success).toBe(true);
    });
  });
});
