import { describe, test, expect, vi, beforeAll, afterEach } from 'vitest';
import MockData from '@common/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import ResyncRemainingCases from './resync-remaining-cases';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';

describe('ResyncRemainingCases use case', () => {
  let context: ApplicationContext;

  beforeAll(async () => {
    context = await createMockApplicationContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPageOfRemainingCasesByCursor', () => {
    test('should return case IDs for cases not updated since cutoff date', async () => {
      const staleCaseId = '081-20-10508';
      const staleCase = {
        ...MockData.getSyncedCase({
          override: {
            caseId: staleCaseId,
            updatedOn: '2024-01-01T00:00:00.000Z',
          },
        }),
        _id: 'mongo-id-1',
      };

      vi.spyOn(MockMongoRepository.prototype, 'getCaseIdsRemainingToSync').mockResolvedValue([
        staleCase,
      ]);

      const result = await ResyncRemainingCases.getPageOfRemainingCasesByCursor(
        context,
        '2025-01-01T00:00:00.000Z',
        null,
        100,
      );

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.caseIds).toEqual([staleCaseId]);
      expect(result.data?.lastId).toBe('mongo-id-1');
      expect(result.data?.hasMore).toBe(false);
    });

    test('should detect hasMore when more results than limit', async () => {
      const case1 = {
        ...MockData.getSyncedCase({ override: { caseId: '081-20-10508' } }),
        _id: 'mongo-id-1',
      };
      const case2 = {
        ...MockData.getSyncedCase({ override: { caseId: '081-21-12345' } }),
        _id: 'mongo-id-2',
      };

      vi.spyOn(MockMongoRepository.prototype, 'getCaseIdsRemainingToSync').mockResolvedValue([
        case1,
        case2,
      ]);

      const result = await ResyncRemainingCases.getPageOfRemainingCasesByCursor(
        context,
        '2025-01-01T00:00:00.000Z',
        null,
        1,
      );

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.caseIds).toHaveLength(1);
      expect(result.data?.caseIds[0]).toBe('081-20-10508');
      expect(result.data?.hasMore).toBe(true);
      expect(result.data?.lastId).toBe('mongo-id-1');
    });

    test('should return empty result when no stale cases found', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getCaseIdsRemainingToSync').mockResolvedValue([]);

      const result = await ResyncRemainingCases.getPageOfRemainingCasesByCursor(
        context,
        '2025-01-01T00:00:00.000Z',
        'some-cursor',
        100,
      );

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.caseIds).toHaveLength(0);
      expect(result.data?.hasMore).toBe(false);
      expect(result.data?.lastId).toBeNull();
    });

    test('should return results and advance cursor when lastId is provided', async () => {
      const staleCase = {
        ...MockData.getSyncedCase({
          override: {
            caseId: '081-22-99999',
            updatedOn: '2024-06-15T00:00:00.000Z',
          },
        }),
        _id: 'mongo-id-5',
      };

      vi.spyOn(MockMongoRepository.prototype, 'getCaseIdsRemainingToSync').mockResolvedValue([
        staleCase,
      ]);

      const result = await ResyncRemainingCases.getPageOfRemainingCasesByCursor(
        context,
        '2025-01-01T00:00:00.000Z',
        'mongo-id-4',
        100,
      );

      expect(result.error).toBeUndefined();
      expect(result.data?.caseIds).toEqual(['081-22-99999']);
      expect(result.data?.lastId).toBe('mongo-id-5');
      expect(result.data?.hasMore).toBe(false);
    });

    test('should return error when repository call fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getCaseIdsRemainingToSync').mockRejectedValue(
        new Error('Database error'),
      );

      const result = await ResyncRemainingCases.getPageOfRemainingCasesByCursor(
        context,
        '2025-01-01T00:00:00.000Z',
        null,
        100,
      );

      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });
});
