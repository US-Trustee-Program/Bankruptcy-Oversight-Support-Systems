import { QueueServiceClient, QueueClient, RestError } from '@azure/storage-queue';

export type ReceivedQueueMessage = {
  messageId: string;
  popReceipt: string;
  messageText: string;
};

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

  /**
   * @param visibilityTimeout seconds before the message becomes visible
   * @param messageTimeToLive seconds before the message expires; -1 means it never expires
   *   (the queue service default is 7 days)
   */
  async sendMessage(
    messageContent: string,
    visibilityTimeout?: number,
    messageTimeToLive?: number,
  ): Promise<void> {
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
    await this.client.sendMessage(encoded, { visibilityTimeout, messageTimeToLive });
  }

  /**
   * Receives at most one message and hides it for visibilityTimeout seconds. Only the returned
   * popReceipt can delete it; if the timeout passes first, the message becomes visible again and
   * another reader may receive it.
   */
  async receiveMessage(visibilityTimeout: number): Promise<ReceivedQueueMessage | undefined> {
    const response = await this.client.receiveMessages({ numberOfMessages: 1, visibilityTimeout });
    const [item] = response.receivedMessageItems;
    if (!item) {
      return undefined;
    }
    return {
      messageId: item.messageId,
      popReceipt: item.popReceipt,
      messageText: Buffer.from(item.messageText, 'base64').toString('utf-8'),
    };
  }

  /**
   * Returns false when the service answers 404: the pop receipt is stale because another reader
   * received the message after its visibility timeout, or the message was already deleted.
   * Any other failure throws.
   */
  async deleteMessage(messageId: string, popReceipt: string): Promise<boolean> {
    try {
      await this.client.deleteMessage(messageId, popReceipt);
      return true;
    } catch (error) {
      if (error instanceof RestError && error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async getApproximateMessageCount(): Promise<number> {
    const properties = await this.client.getProperties();
    return properties.approximateMessagesCount ?? 0;
  }
}
