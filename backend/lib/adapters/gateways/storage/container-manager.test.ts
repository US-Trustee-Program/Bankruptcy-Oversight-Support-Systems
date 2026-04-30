import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { ensureContainersExistAsync } from './container-manager';

vi.mock('@azure/storage-blob');
vi.mock('../../services/logger.service', () => {
  return {
    LoggerImpl: class {
      info = vi.fn();
      warn = vi.fn();
      error = vi.fn();
      debug = vi.fn();
    },
  };
});

describe('Container Manager', () => {
  const { env } = process;
  let mockGetContainerClient: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env = {
      ...env,
      AzureWebJobsDataflowsStorage: 'UseDevelopmentStorage=true',
    };

    mockGetContainerClient = vi.fn();

    vi.mocked(BlobServiceClient.fromConnectionString).mockReturnValue({
      getContainerClient: mockGetContainerClient,
    } as unknown as BlobServiceClient);
  });

  afterEach(() => {
    process.env = env;
    vi.clearAllMocks();
  });

  describe('ensureContainersExistAsync', () => {
    test('should skip container creation when AzureWebJobsDataflowsStorage is not configured', async () => {
      delete process.env.AzureWebJobsDataflowsStorage;

      await ensureContainersExistAsync(['test-container'], 'TEST_MODULE');

      expect(BlobServiceClient.fromConnectionString).not.toHaveBeenCalled();
    });

    test('should create container when it does not exist', async () => {
      const mockContainerClient = {
        exists: vi.fn().mockResolvedValue(false),
        create: vi.fn().mockResolvedValue({}),
      };
      mockGetContainerClient.mockReturnValue(mockContainerClient as unknown as ContainerClient);

      await ensureContainersExistAsync(['new-container'], 'TEST_MODULE');

      expect(mockContainerClient.exists).toHaveBeenCalledTimes(1);
      expect(mockContainerClient.create).toHaveBeenCalledWith({ access: 'none' });
    });

    test('should not create container when it already exists', async () => {
      const mockContainerClient = {
        exists: vi.fn().mockResolvedValue(true),
        create: vi.fn(),
      };
      mockGetContainerClient.mockReturnValue(mockContainerClient as unknown as ContainerClient);

      await ensureContainersExistAsync(['existing-container'], 'TEST_MODULE');

      expect(mockContainerClient.exists).toHaveBeenCalledTimes(1);
      expect(mockContainerClient.create).not.toHaveBeenCalled();
    });

    test('should handle multiple containers', async () => {
      const mockContainerClient1 = {
        exists: vi.fn().mockResolvedValue(false),
        create: vi.fn().mockResolvedValue({}),
      };
      const mockContainerClient2 = {
        exists: vi.fn().mockResolvedValue(true),
        create: vi.fn(),
      };

      mockGetContainerClient
        .mockReturnValueOnce(mockContainerClient1 as unknown as ContainerClient)
        .mockReturnValueOnce(mockContainerClient2 as unknown as ContainerClient);

      // Use unique container names to avoid cache hits from other tests
      await ensureContainersExistAsync(
        ['multi-new-container-unique', 'multi-existing-container-unique'],
        'TEST_MODULE',
      );

      expect(mockContainerClient1.exists).toHaveBeenCalledTimes(1);
      expect(mockContainerClient1.create).toHaveBeenCalledTimes(1);
      expect(mockContainerClient2.exists).toHaveBeenCalledTimes(1);
      expect(mockContainerClient2.create).not.toHaveBeenCalled();
    });

    test('should cache verified containers and skip rechecking them', async () => {
      const mockContainerClient = {
        exists: vi.fn().mockResolvedValue(true),
        create: vi.fn(),
      };
      mockGetContainerClient.mockReturnValue(mockContainerClient as unknown as ContainerClient);

      // First call - should check existence
      await ensureContainersExistAsync(['cached-container'], 'TEST_MODULE');
      expect(mockContainerClient.exists).toHaveBeenCalledTimes(1);

      mockContainerClient.exists.mockClear();

      // Second call - should skip check (cached)
      await ensureContainersExistAsync(['cached-container'], 'TEST_MODULE');
      expect(mockContainerClient.exists).not.toHaveBeenCalled();
    });

    test('should continue with other containers when one fails', async () => {
      const mockContainerClient1 = {
        exists: vi.fn().mockResolvedValue(false),
        create: vi.fn().mockResolvedValue({}),
      };
      const mockContainerClient2 = {
        exists: vi.fn().mockRejectedValue(new Error('Container check failed')),
        create: vi.fn(),
      };
      const mockContainerClient3 = {
        exists: vi.fn().mockResolvedValue(false),
        create: vi.fn().mockResolvedValue({}),
      };

      mockGetContainerClient
        .mockReturnValueOnce(mockContainerClient1 as unknown as ContainerClient)
        .mockReturnValueOnce(mockContainerClient2 as unknown as ContainerClient)
        .mockReturnValueOnce(mockContainerClient3 as unknown as ContainerClient);

      await ensureContainersExistAsync(
        ['container-1', 'container-2', 'container-3'],
        'TEST_MODULE',
      );

      // Should attempt all three containers despite one failure
      expect(mockContainerClient1.exists).toHaveBeenCalledTimes(1);
      expect(mockContainerClient1.create).toHaveBeenCalledTimes(1);
      expect(mockContainerClient2.exists).toHaveBeenCalledTimes(1);
      expect(mockContainerClient3.exists).toHaveBeenCalledTimes(1);
      expect(mockContainerClient3.create).toHaveBeenCalledTimes(1);
    });

    test('should handle connection failure gracefully', async () => {
      vi.mocked(BlobServiceClient.fromConnectionString).mockImplementation(() => {
        throw new Error('Connection failed');
      });

      // Should not throw
      await expect(
        ensureContainersExistAsync(['test-container'], 'TEST_MODULE'),
      ).resolves.not.toThrow();
    });

    test('should return early when no containers need verification', async () => {
      const mockContainerClient = {
        exists: vi.fn().mockResolvedValue(true),
        create: vi.fn(),
      };
      mockGetContainerClient.mockReturnValue(mockContainerClient as unknown as ContainerClient);

      // Cache a container
      await ensureContainersExistAsync(['cached-container'], 'TEST_MODULE');

      mockGetContainerClient.mockClear();

      // Try to check only the cached container - should return early
      await ensureContainersExistAsync(['cached-container'], 'TEST_MODULE');

      expect(mockGetContainerClient).not.toHaveBeenCalled();
    });
  });
});
