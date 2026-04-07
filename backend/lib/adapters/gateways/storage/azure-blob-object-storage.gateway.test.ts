import { describe, test, expect, vi, beforeEach } from 'vitest';

const { mockDownload, mockExists, mockFromConnectionString } = vi.hoisted(() => {
  const mockDownload = vi.fn();
  const mockExists = vi.fn();
  const mockGetBlobClient = vi.fn(() => ({ exists: mockExists, download: mockDownload }));
  const mockGetContainerClient = vi.fn(() => ({ getBlobClient: mockGetBlobClient }));
  const mockFromConnectionString = vi.fn(() => ({ getContainerClient: mockGetContainerClient }));
  return { mockDownload, mockExists, mockFromConnectionString };
});

vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: mockFromConnectionString,
  },
}));

describe('AzureBlobObjectStorageGateway', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockExists.mockReset();
    mockDownload.mockReset();
    mockFromConnectionString.mockReset();
    mockFromConnectionString.mockImplementation(() => ({
      getContainerClient: vi.fn(() => ({
        getBlobClient: vi.fn(() => ({ exists: mockExists, download: mockDownload })),
      })),
    }));
    vi.resetModules();
    process.env.AzureWebJobsStorage = 'DefaultEndpointsProtocol=https;AccountName=test';
  });

  async function makeGateway() {
    const { AzureBlobObjectStorageGateway } = await import('./azure-blob-object-storage.gateway');
    return new AzureBlobObjectStorageGateway();
  }

  describe('readObject', () => {
    test('should return null when blob does not exist', async () => {
      mockExists.mockResolvedValue(false);
      const gateway = await makeGateway();

      const result = await gateway.readObject('my-container', 'my-blob.tsv');

      expect(result).toBeNull();
    });

    test('should return empty string when download has no readable stream', async () => {
      mockExists.mockResolvedValue(true);
      mockDownload.mockResolvedValue({ readableStreamBody: null });
      const gateway = await makeGateway();

      const result = await gateway.readObject('my-container', 'my-blob.tsv');

      expect(result).toBe('');
    });

    test('should return file content as utf-8 string', async () => {
      const content = 'col1\tcol2\nval1\tval2';
      const readable = (async function* () {
        yield Buffer.from(content);
      })();
      mockExists.mockResolvedValue(true);
      mockDownload.mockResolvedValue({ readableStreamBody: readable });
      const gateway = await makeGateway();

      const result = await gateway.readObject('my-container', 'my-blob.tsv');

      expect(result).toBe(content);
    });

    test('should concatenate multiple chunks', async () => {
      const readable = (async function* () {
        yield Buffer.from('hello ');
        yield Buffer.from('world');
      })();
      mockExists.mockResolvedValue(true);
      mockDownload.mockResolvedValue({ readableStreamBody: readable });
      const gateway = await makeGateway();

      const result = await gateway.readObject('my-container', 'my-blob.tsv');

      expect(result).toBe('hello world');
    });

    test('should throw when AzureWebJobsStorage env var is missing', async () => {
      delete process.env.AzureWebJobsStorage;
      const gateway = await makeGateway();

      await expect(gateway.readObject('container', 'blob')).rejects.toThrow(
        'Missing required environment variable: AzureWebJobsStorage',
      );
    });
  });
});
