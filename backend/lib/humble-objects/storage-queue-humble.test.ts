import { vi, describe, test, expect, beforeEach } from 'vitest';
import { StorageQueueHumbleObject } from './storage-queue-humble';

let mockSendMessage: ReturnType<typeof vi.fn>;
let mockGetQueueClient: ReturnType<typeof vi.fn>; // used by mock factory

vi.mock('@azure/storage-queue', () => {
  class MockQueueServiceClient {
    getQueueClient(queueName: string) {
      return mockGetQueueClient(queueName);
    }
    static fromConnectionString(_connectionString: string) {
      return new MockQueueServiceClient();
    }
  }

  return {
    QueueServiceClient: MockQueueServiceClient,
  };
});

describe('StorageQueueHumbleObject', () => {
  beforeEach(() => {
    mockSendMessage = vi.fn().mockResolvedValue({});
    mockGetQueueClient = vi.fn().mockReturnValue({
      sendMessage: (...args: unknown[]) => mockSendMessage(...args),
    });
  });

  test('fromConnectionString creates a humble object that sends base64-encoded messages', async () => {
    const humble = StorageQueueHumbleObject.fromConnectionString(
      'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=key;EndpointSuffix=core.windows.net',
      'my-queue',
    );
    const message = JSON.stringify({ foo: 'bar' });
    const expectedBase64 = Buffer.from(message).toString('base64');

    await humble.sendMessage(message);

    expect(mockSendMessage).toHaveBeenCalledWith(expectedBase64, { visibilityTimeout: undefined });
  });

  test('should pass visibilityTimeout when provided', async () => {
    const humble = StorageQueueHumbleObject.fromConnectionString(
      'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=key;EndpointSuffix=core.windows.net',
      'my-queue',
    );
    const message = JSON.stringify({ test: 'data' });

    await humble.sendMessage(message, 120);

    expect(mockSendMessage).toHaveBeenCalledWith(expect.any(String), { visibilityTimeout: 120 });
  });
});
