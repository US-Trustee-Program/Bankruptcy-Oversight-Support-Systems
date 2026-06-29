import { EmailClient, EmailMessage } from '@azure/communication-email';
import { Notification } from '@common/cams/notifications';
import { NotificationGateway } from '../../../use-cases/gateways.types';
import { CamsError } from '../../../common-errors/cams-error';

const MODULE_NAME = 'ACS-NOTIFICATION-GATEWAY';
const POLL_TIMEOUT_MS = 30_000;

export interface NotificationLogger {
  info(module: string, message: string, data?: unknown): void;
  error(module: string, message: string, data?: unknown): void;
}

export class AcsNotificationGateway implements NotificationGateway {
  private readonly client: EmailClient;
  private readonly senderAddress: string;
  private readonly logger?: NotificationLogger;

  constructor(client: EmailClient, senderAddress: string, logger?: NotificationLogger) {
    this.client = client;
    this.senderAddress = senderAddress;
    this.logger = logger;
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
      headers: notification.correlationId
        ? { 'X-Correlation-Id': notification.correlationId }
        : undefined,
    };

    const poller = await this.client.beginSend(message);
    const result = await poller.pollUntilDone({
      abortSignal: AbortSignal.timeout(POLL_TIMEOUT_MS),
    });

    if (result.status !== 'Succeeded') {
      throw new CamsError(MODULE_NAME, {
        message: `Email send failed with status '${result.status}' (id: ${result.id})`,
      });
    }

    this.logger?.info(MODULE_NAME, `Email sent successfully`, {
      messageId: result.id,
      to: notification.to,
      correlationId: notification.correlationId,
    });
  }
}
