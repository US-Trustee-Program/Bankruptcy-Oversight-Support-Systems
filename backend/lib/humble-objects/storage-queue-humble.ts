import { QueueServiceClient, QueueClient } from '@azure/storage-queue';

export class StorageQueueHumbleObject {
  private client: QueueClient;

  private constructor(client: QueueClient) {
    this.client = client;
  }

  static fromConnectionString(
    connectionString: string,
    queueName: string,
  ): StorageQueueHumbleObject {
    const serviceClient = QueueServiceClient.fromConnectionString(connectionString);
    return new StorageQueueHumbleObject(serviceClient.getQueueClient(queueName));
  }

  async sendMessage(messageContent: string, visibilityTimeout?: number): Promise<void> {
    // The REST API requires XML-safe content; base64 is the standard encoding per the docs.
    const encoded = Buffer.from(messageContent).toString('base64');
    await this.client.sendMessage(encoded, { visibilityTimeout });
  }
}
