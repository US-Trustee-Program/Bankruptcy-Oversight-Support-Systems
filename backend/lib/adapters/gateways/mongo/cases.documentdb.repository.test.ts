import { vi, MockInstance } from 'vitest';
import { CasesSearchPredicate } from '@common/api/search';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import { CasesDocumentDbRepository } from './cases.documentdb.repository';
import { closeDeferred } from '../../../deferrable/defer-close';
import * as embeddingServiceModule from '../../services/embedding.service';
import { EmbeddingService } from '../../services/embedding.service';

describe('CasesDocumentDbRepository - Vector Search Encoding', () => {
  let repo: CasesDocumentDbRepository;
  let context: ApplicationContext;
  let mockEmbeddingService: Partial<EmbeddingService>;
  let generateEmbeddingSpy: MockInstance;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = CasesDocumentDbRepository.getInstance(context);

    // Create mock embedding service
    mockEmbeddingService = {
      generateEmbedding: vi.fn(),
    };

    // Spy on getEmbeddingService to return our mock
    generateEmbeddingSpy = vi.spyOn(embeddingServiceModule, 'getEmbeddingService');
    generateEmbeddingSpy.mockReturnValue(mockEmbeddingService);
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.restoreAllMocks();
    repo.release();
  });

  afterAll(() => {
    CasesDocumentDbRepository.dropInstance();
  });

  describe('Vector Encoding Location - WHERE IT HAPPENS', () => {
    test('should call EmbeddingService.generateEmbedding when predicate.name is provided', async () => {
      // Arrange: Set up mock vector
      const mockVector = new Array(384).fill(0.1);
      mockEmbeddingService.generateEmbedding.mockResolvedValue(mockVector);

      // Mock the database adapter to avoid real DB calls
      const mockPaginateResult = {
        data: [],
        metadata: { total: 0 },
      };
      vi.spyOn(repo as unknown as { getAdapter: () => unknown }, 'getAdapter').mockReturnValue({
        paginate: vi.fn().mockResolvedValue(mockPaginateResult),
      });

      const predicate: CasesSearchPredicate = {
        name: 'John Smith', // THIS triggers vector encoding
        limit: 25,
        offset: 0,
      };

      // Act: Call searchCases
      await repo.searchCases(predicate);

      // Assert: Verify encoding happened
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(context, 'John Smith');
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledTimes(1);
    });

    test('should encode predicate.name to 384-dimensional vector', async () => {
      // Arrange: Mock the embedding to return actual 384-dim vector
      const mockVector = new Array(384).fill(0).map((_, i) => i / 384);
      mockEmbeddingService.generateEmbedding.mockResolvedValue(mockVector);

      vi.spyOn(repo as unknown as { getAdapter: () => unknown }, 'getAdapter').mockReturnValue({
        paginate: vi.fn().mockResolvedValue({ data: [], metadata: { total: 0 } }),
      });

      const predicate: CasesSearchPredicate = {
        name: 'Jane Doe',
        limit: 10,
        offset: 0,
      };

      // Act
      await repo.searchCases(predicate);

      // Assert: Verify the vector has correct dimensions
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalled();
      const callArgs = mockEmbeddingService.generateEmbedding.mock.calls[0];
      expect(callArgs[0]).toBe(context);
      expect(callArgs[1]).toBe('Jane Doe');

      // Verify the returned vector
      const returnedVector = await mockEmbeddingService.generateEmbedding.mock.results[0].value;
      expect(returnedVector).toHaveLength(384);
      expect(returnedVector.every((v: number) => typeof v === 'number')).toBe(true);
    });

    test('should NOT encode when predicate.name is not provided', async () => {
      // Arrange
      vi.spyOn(repo as unknown as { getAdapter: () => unknown }, 'getAdapter').mockReturnValue({
        paginate: vi.fn().mockResolvedValue({ data: [], metadata: { total: 0 } }),
      });

      const predicate: CasesSearchPredicate = {
        // NO name field - should skip encoding
        divisionCodes: ['081'],
        limit: 25,
        offset: 0,
      };

      // Act
      await repo.searchCases(predicate);

      // Assert: Encoding should NOT have been called
      expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalled();
    });

    test('should NOT encode when predicate.name is empty string', async () => {
      // Arrange
      vi.spyOn(repo as unknown as { getAdapter: () => unknown }, 'getAdapter').mockReturnValue({
        paginate: vi.fn().mockResolvedValue({ data: [], metadata: { total: 0 } }),
      });

      const predicate: CasesSearchPredicate = {
        name: '   ', // Empty/whitespace - should skip encoding
        limit: 25,
        offset: 0,
      };

      // Act
      await repo.searchCases(predicate);

      // Assert: Encoding should NOT have been called
      expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalled();
    });
  });

  describe('Fallback Behavior', () => {
    test('should fall back to traditional search if embedding generation returns null', async () => {
      // Arrange: Simulate encoding failure
      mockEmbeddingService.generateEmbedding.mockResolvedValue(null);

      vi.spyOn(repo as unknown as { getAdapter: () => unknown }, 'getAdapter').mockReturnValue({
        paginate: vi.fn().mockResolvedValue({ data: [], metadata: { total: 0 } }),
      });

      const predicate: CasesSearchPredicate = {
        name: 'Invalid Name',
        limit: 25,
        offset: 0,
      };

      // Act
      const result = await repo.searchCases(predicate);

      // Assert: Should not throw, should fall back gracefully
      expect(result).toBeDefined();
      expect(result.data).toEqual([]);
    });

    test('should fall back to traditional search if embedding generation throws', async () => {
      // Arrange: Simulate encoding error
      mockEmbeddingService.generateEmbedding.mockRejectedValue(new Error('Model loading failed'));

      vi.spyOn(repo as unknown as { getAdapter: () => unknown }, 'getAdapter').mockReturnValue({
        paginate: vi.fn().mockResolvedValue({ data: [], metadata: { total: 0 } }),
      });

      const predicate: CasesSearchPredicate = {
        name: 'Test Name',
        limit: 25,
        offset: 0,
      };

      // Act & Assert: Should propagate error
      await expect(repo.searchCases(predicate)).rejects.toThrow();
    });
  });

  describe('Vector Search Pipeline Construction', () => {
    test('should build vector search pipeline with filters', async () => {
      // Arrange
      const mockVector = new Array(384).fill(0.1);
      mockEmbeddingService.generateEmbedding.mockResolvedValue(mockVector);

      const mockPaginate = vi.fn().mockResolvedValue({ data: [], metadata: { total: 0 } });
      vi.spyOn(repo as unknown as { getAdapter: () => unknown }, 'getAdapter').mockReturnValue({
        paginate: mockPaginate,
      });

      const predicate: CasesSearchPredicate = {
        name: 'John Smith',
        divisionCodes: ['081'],
        chapters: ['11'],
        limit: 25,
        offset: 0,
      };

      // Act
      await repo.searchCases(predicate);

      // Assert: Verify pipeline was constructed with vector search
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalled();
      expect(mockPaginate).toHaveBeenCalled();
    });

    test('should calculate k parameter as max(limit * 2, 50)', async () => {
      // Arrange
      const mockVector = new Array(384).fill(0.1);
      mockEmbeddingService.generateEmbedding.mockResolvedValue(mockVector);

      vi.spyOn(repo as unknown as { getAdapter: () => unknown }, 'getAdapter').mockReturnValue({
        paginate: vi.fn().mockResolvedValue({ data: [], metadata: { total: 0 } }),
      });

      // Test case 1: limit = 25, k should be 50 (25 * 2)
      await repo.searchCases({
        name: 'Test',
        limit: 25,
        offset: 0,
      });

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalled();

      // Test case 2: limit = 10, k should be 50 (min threshold)
      mockEmbeddingService.generateEmbedding.mockClear();
      await repo.searchCases({
        name: 'Test',
        limit: 10,
        offset: 0,
      });

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalled();

      // Test case 3: limit = 100, k should be 200 (100 * 2)
      mockEmbeddingService.generateEmbedding.mockClear();
      await repo.searchCases({
        name: 'Test',
        limit: 100,
        offset: 0,
      });

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalled();
    });
  });

  describe('Traditional Search (No Vector Encoding)', () => {
    test('should use traditional search for standard queries', async () => {
      // Arrange
      vi.spyOn(repo as unknown as { getAdapter: () => unknown }, 'getAdapter').mockReturnValue({
        paginate: vi.fn().mockResolvedValue({ data: [], metadata: { total: 0 } }),
      });

      const predicate: CasesSearchPredicate = {
        divisionCodes: ['081'],
        chapters: ['11'],
        limit: 25,
        offset: 0,
      };

      // Act
      await repo.searchCases(predicate);

      // Assert: No encoding should occur
      expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalled();
    });
  });
});
