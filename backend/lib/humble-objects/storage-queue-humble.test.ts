import { vi, describe, test, expect, beforeEach } from 'vitest';
import { QueueServiceClient } from '@azure/storage-queue';
import { StorageQueueHumbleObject } from './storage-queue-humble';

describe('StorageQueueHumbleObject', () => {
  let sendMessageMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    sendMessageMock = vi.fn().mockResolvedValue({});
    const mockQueueClient = { sendMessage: sendMessageMock };
    vi.spyOn(QueueServiceClient, 'fromConnectionString').mockReturnValue({
      getQueueClient: vi.fn().mockReturnValue(mockQueueClient),
    } as unknown as QueueServiceClient);
  });

  test('fromConnectionString creates a humble object that sends base64-encoded messages', async () => {
    const humble = StorageQueueHumbleObject.fromConnectionString(
      'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=key;EndpointSuffix=core.windows.net',
      'my-queue',
    );
    const message = JSON.stringify({ foo: 'bar' });
    const expectedBase64 = Buffer.from(message).toString('base64');

    await humble.sendMessage(message);

    expect(sendMessageMock).toHaveBeenCalledWith(expectedBase64, { visibilityTimeout: undefined });
  });

  test('should pass visibilityTimeout when provided', async () => {
    const humble = StorageQueueHumbleObject.fromConnectionString(
      'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=key;EndpointSuffix=core.windows.net',
      'my-queue',
    );
    const message = JSON.stringify({ test: 'data' });

    await humble.sendMessage(message, 120);

    expect(sendMessageMock).toHaveBeenCalledWith(expect.any(String), { visibilityTimeout: 120 });
  });
});
