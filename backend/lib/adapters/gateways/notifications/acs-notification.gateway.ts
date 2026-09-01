import { EmailClient, EmailMessage } from '@azure/communication-email';
import { Notification } from '@common/cams/notifications';
import { NotificationGateway, NotificationSendResult } from '../../../use-cases/gateways.types';
import { CamsError } from '../../../common-errors/cams-error';

const MODULE_NAME = 'ACS-NOTIFICATION-GATEWAY';
const POLL_TIMEOUT_MS = 30_000;
const NETWORK_ERROR_CODES = [
  'ENOTFOUND',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'EPIPE',
];

export function isConnectionFailure(error: unknown): boolean {
  if (!(error instanceof Object)) return false;
  const err = error as {
    code?: string;
    name?: string;
    statusCode?: number;
    cause?: { code?: string };
  };
  if (typeof err.statusCode === 'number') return false;
  const code = err.code ?? err.cause?.code;
  if (typeof code === 'string' && NETWORK_ERROR_CODES.includes(code)) return true;
  return err.name === 'AbortError' || err.name === 'FetchError';
}

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

  async send(notification: Notification): Promise<NotificationSendResult> {
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
      replyTo: notification.replyTo
        ? [{ address: notification.replyTo.address, displayName: notification.replyTo.displayName }]
        : undefined,
      headers: notification.correlationId
        ? { 'X-Correlation-Id': notification.correlationId }
        : undefined,
    };

    let poller;
    try {
      poller = await this.client.beginSend(message);
    } catch (error) {
      throw this.toGatewayError(error, notification);
    }

    let result;
    try {
      result = await poller.pollUntilDone({
        abortSignal: AbortSignal.timeout(POLL_TIMEOUT_MS),
      });
    } catch (error) {
      throw this.toGatewayError(error, notification);
    }

    if (result.status !== 'Succeeded') {
      const message = `Email service rejected the message with status '${result.status}' (id: ${result.id})`;
      this.logger?.error(MODULE_NAME, message, {
        id: result.id,
        to: notification.to,
        correlationId: notification.correlationId,
        trusteeId: notification.trusteeId,
      });
      throw new CamsError(MODULE_NAME, {
        message,
        data: { reason: 'send', messageId: result.id },
      });
    }

    this.logger?.info(MODULE_NAME, `Email sent successfully`, {
      messageId: result.id,
      to: notification.to,
      correlationId: notification.correlationId,
      trusteeId: notification.trusteeId,
    });

    return { messageId: result.id };
  }

  private toGatewayError(error: unknown, notification: Notification): CamsError {
    const connection = isConnectionFailure(error);
    const message = connection
      ? 'Unable to connect to the email service'
      : `Failed to send email: ${error instanceof Error ? error.message : 'unknown error'}`;
    this.logger?.error(MODULE_NAME, message, {
      to: notification.to,
      correlationId: notification.correlationId,
      trusteeId: notification.trusteeId,
      errorCode: (error as { code?: string })?.code,
      errorName: (error as { name?: string })?.name,
    });
    return new CamsError(MODULE_NAME, {
      message,
      originalError: error instanceof Error ? error : undefined,
      data: { reason: connection ? 'connection' : 'send' },
    });
  }
}
