import { vi, describe, test, expect, beforeEach } from 'vitest';
import { QueueServiceClient } from '@azure/storage-queue';
import { StorageQueueHumbleObject } from './storage-queue-humble';

describe('StorageQueueHumbleObject', () => {
  let sendMessageMock: ReturnType<typeof vi.fn>;
  let createIfNotExistsMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    sendMessageMock = vi.fn().mockResolvedValue({});
    createIfNotExistsMock = vi.fn().mockResolvedValue({ succeeded: true });
    const mockQueueClient = {
      sendMessage: sendMessageMock,
      createIfNotExists: createIfNotExistsMock,
    };
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

  test('ensures the queue exists before sending the first message', async () => {
    const humble = StorageQueueHumbleObject.fromConnectionString(
      'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=key;EndpointSuffix=core.windows.net',
      'my-queue',
    );

    await humble.sendMessage(JSON.stringify({ foo: 'bar' }));

    expect(createIfNotExistsMock).toHaveBeenCalledTimes(1);
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
  });

  test('only ensures the queue exists once across multiple sends on the same instance', async () => {
    const humble = StorageQueueHumbleObject.fromConnectionString(
      'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=key;EndpointSuffix=core.windows.net',
      'my-queue',
    );

    await humble.sendMessage(JSON.stringify({ foo: 'bar' }));
    await humble.sendMessage(JSON.stringify({ foo: 'baz' }));
    await humble.sendMessage(JSON.stringify({ foo: 'qux' }));

    expect(createIfNotExistsMock).toHaveBeenCalledTimes(1);
    expect(sendMessageMock).toHaveBeenCalledTimes(3);
  });
});
