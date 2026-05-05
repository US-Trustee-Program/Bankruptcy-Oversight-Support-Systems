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

  test('base64-encodes message content before sending to SDK', async () => {
    const humble = StorageQueueHumbleObject.fromConnectionString(
      'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=key;EndpointSuffix=core.windows.net',
      'my-queue',
    );
    const message = JSON.stringify({ foo: 'bar' });
    const expected = Buffer.from(message).toString('base64');

    await humble.sendMessage(message);

    expect(sendMessageMock).toHaveBeenCalledWith(expected, { visibilityTimeout: undefined });
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
