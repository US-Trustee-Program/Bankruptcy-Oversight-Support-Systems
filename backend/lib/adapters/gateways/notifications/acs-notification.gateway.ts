import { EmailClient, EmailMessage } from '@azure/communication-email';
import { Notification } from '@common/cams/notifications';
import { NotificationGateway } from '../../../use-cases/gateways.types';

const MODULE_NAME = 'ACS-NOTIFICATION-GATEWAY';

export class AcsNotificationGateway implements NotificationGateway {
  private readonly client: EmailClient;
  private readonly senderAddress: string;

  constructor(connectionString: string, senderAddress: string) {
    this.client = new EmailClient(connectionString);
    this.senderAddress = senderAddress;
  }

  async send(notification: Notification): Promise<void> {
    const message: EmailMessage = {
      senderAddress: this.senderAddress,
      content: {
        subject: notification.subject,
        html: notification.html,
        plainText: notification.text,
      },
      recipients: {
        to: [
          {
            address: notification.to,
            displayName: notification.toDisplayName,
          },
        ],
      },
    };

    const poller = await this.client.beginSend(message);
    const result = await poller.pollUntilDone();

    if (result.status !== 'Succeeded') {
      throw new Error(
        `${MODULE_NAME}: Email send failed with status '${result.status}' (id: ${result.id})`,
      );
    }
  }
}
