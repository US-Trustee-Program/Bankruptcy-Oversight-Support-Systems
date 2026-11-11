import { vi, describe, test, expect, beforeEach } from 'vitest';
import { QueueServiceClient, RestError } from '@azure/storage-queue';
import { StorageQueueHumbleObject } from './storage-queue-humble';

describe('StorageQueueHumbleObject', () => {
  let sendMessageMock: ReturnType<typeof vi.fn>;
  let createIfNotExistsMock: ReturnType<typeof vi.fn>;
  let receiveMessagesMock: ReturnType<typeof vi.fn>;
  let deleteMessageMock: ReturnType<typeof vi.fn>;
  let getPropertiesMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendMessageMock = vi.fn().mockResolvedValue({});
    createIfNotExistsMock = vi.fn().mockResolvedValue({ succeeded: true });
    receiveMessagesMock = vi.fn().mockResolvedValue({ receivedMessageItems: [] });
    deleteMessageMock = vi.fn().mockResolvedValue({});
    getPropertiesMock = vi.fn().mockResolvedValue({ approximateMessagesCount: 0 });
    const mockQueueClient = {
      sendMessage: sendMessageMock,
      createIfNotExists: createIfNotExistsMock,
      receiveMessages: receiveMessagesMock,
      deleteMessage: deleteMessageMock,
      getProperties: getPropertiesMock,
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

  test('sends the first message only after the queue has been created', async () => {
    let queueCreated = false;
    createIfNotExistsMock.mockImplementation(async () => {
      queueCreated = true;
      return { succeeded: true };
    });
    sendMessageMock.mockImplementation(async () => {
      if (!queueCreated) {
        throw new RestError('The specified queue does not exist.', {
          statusCode: 404,
          code: 'QueueNotFound',
        });
      }
      return {};
    });
    const humble = StorageQueueHumbleObject.fromConnectionString(
      'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=key;EndpointSuffix=core.windows.net',
      'my-queue',
    );

    await expect(humble.sendMessage(JSON.stringify({ foo: 'bar' }))).resolves.toBeUndefined();
  });

  test('a failed queue creation rejects that send, and the next send creates the queue again', async () => {
    createIfNotExistsMock.mockRejectedValueOnce(new Error('storage unavailable'));
    const humble = StorageQueueHumbleObject.fromConnectionString(
      'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=key;EndpointSuffix=core.windows.net',
      'my-queue',
    );

    await expect(humble.sendMessage(JSON.stringify({ foo: 'bar' }))).rejects.toThrow(
      'storage unavailable',
    );
    await expect(humble.sendMessage(JSON.stringify({ foo: 'baz' }))).resolves.toBeUndefined();

    expect(createIfNotExistsMock).toHaveBeenCalledTimes(2);
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
  });

  test('creates the queue once when concurrent first sends race on a new instance', async () => {
    const humble = StorageQueueHumbleObject.fromConnectionString(
      'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=key;EndpointSuffix=core.windows.net',
      'my-queue',
    );
    const messages = Array.from({ length: 5 }, (_, index) => JSON.stringify({ index }));

    await Promise.all(messages.map((message) => humble.sendMessage(message)));

    expect(createIfNotExistsMock).toHaveBeenCalledTimes(1);
    const sent = sendMessageMock.mock.calls.map(([encoded]) =>
      Buffer.from(encoded, 'base64').toString('utf-8'),
    );
    expect(sent.sort()).toEqual([...messages].sort());
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

  const connectionString =
    'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=key;EndpointSuffix=core.windows.net';

  test('passes a time-to-live when provided, so a message can be sent that never expires', async () => {
    const humble = StorageQueueHumbleObject.fromConnectionString(connectionString, 'my-queue');

    await humble.sendMessage(JSON.stringify({ test: 'data' }), undefined, -1);

    expect(sendMessageMock).toHaveBeenCalledWith(expect.any(String), {
      visibilityTimeout: undefined,
      messageTimeToLive: -1,
    });
  });

  test('receives one message, hidden for the given visibility timeout, with its text decoded', async () => {
    receiveMessagesMock.mockResolvedValue({
      receivedMessageItems: [
        {
          messageId: 'message-1',
          popReceipt: 'receipt-1',
          messageText: Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64'),
        },
      ],
    });
    const humble = StorageQueueHumbleObject.fromConnectionString(connectionString, 'my-queue');

    const received = await humble.receiveMessage(300);

    expect(receiveMessagesMock).toHaveBeenCalledWith({
      numberOfMessages: 1,
      visibilityTimeout: 300,
    });
    expect(received).toEqual({
      messageId: 'message-1',
      popReceipt: 'receipt-1',
      messageText: JSON.stringify({ foo: 'bar' }),
    });
  });

  test('returns undefined when the queue has no visible message', async () => {
    const humble = StorageQueueHumbleObject.fromConnectionString(connectionString, 'my-queue');

    await expect(humble.receiveMessage(300)).resolves.toBeUndefined();
  });

  test('deletes a message by id and pop receipt and reports it deleted', async () => {
    const humble = StorageQueueHumbleObject.fromConnectionString(connectionString, 'my-queue');

    await expect(humble.deleteMessage('message-1', 'receipt-1')).resolves.toBe(true);

    expect(deleteMessageMock).toHaveBeenCalledWith('message-1', 'receipt-1');
  });

  test('reports false instead of throwing when the service answers 404 (stale pop receipt or already deleted)', async () => {
    deleteMessageMock.mockRejectedValue(
      new RestError('The specified message does not exist.', { statusCode: 404 }),
    );
    const humble = StorageQueueHumbleObject.fromConnectionString(connectionString, 'my-queue');

    await expect(humble.deleteMessage('message-1', 'receipt-1')).resolves.toBe(false);
  });

  test('rethrows any other delete failure', async () => {
    deleteMessageMock.mockRejectedValue(
      new RestError('Internal server error', { statusCode: 500 }),
    );
    const humble = StorageQueueHumbleObject.fromConnectionString(connectionString, 'my-queue');

    await expect(humble.deleteMessage('message-1', 'receipt-1')).rejects.toThrow(
      'Internal server error',
    );
  });

  test('reports the approximate message count from the queue properties', async () => {
    getPropertiesMock.mockResolvedValue({ approximateMessagesCount: 42 });
    const humble = StorageQueueHumbleObject.fromConnectionString(connectionString, 'my-queue');

    await expect(humble.getApproximateMessageCount()).resolves.toBe(42);
  });

  test('reports zero when the queue properties omit the approximate count', async () => {
    getPropertiesMock.mockResolvedValue({});
    const humble = StorageQueueHumbleObject.fromConnectionString(connectionString, 'my-queue');

    await expect(humble.getApproximateMessageCount()).resolves.toBe(0);
  });
});
