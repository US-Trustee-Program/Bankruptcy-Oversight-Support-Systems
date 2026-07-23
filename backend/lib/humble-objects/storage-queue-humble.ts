import { QueueServiceClient, QueueClient } from '@azure/storage-queue';

export class StorageQueueHumbleObject {
  private client: QueueClient;
  private queueEnsured = false;

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
    // Unlike the Azure Functions storageQueue output binding, this SDK client does not
    // create its queue lazily — sendMessage() 404s (QueueNotFound) if the queue has
    // never been created. createIfNotExists() no-ops cleanly if it already exists, so
    // this is safe to call once per instance before the first send.
    if (!this.queueEnsured) {
      await this.client.createIfNotExists();
      this.queueEnsured = true;
    }

    // The REST API requires XML-safe content; base64 is the standard encoding per the docs.
    const encoded = Buffer.from(messageContent).toString('base64');
    await this.client.sendMessage(encoded, { visibilityTimeout });
  }
}
