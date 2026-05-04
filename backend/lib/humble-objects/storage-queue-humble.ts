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
    await this.client.sendMessage(messageContent, { visibilityTimeout });
  }
}
