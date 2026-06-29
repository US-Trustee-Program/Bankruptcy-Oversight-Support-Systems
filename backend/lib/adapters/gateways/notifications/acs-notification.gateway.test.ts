import { vi } from 'vitest';
import { AcsNotificationGateway, NotificationLogger } from './acs-notification.gateway';
import { Notification } from '@common/cams/notifications';
import { EmailClient } from '@azure/communication-email';
import { CamsError } from '../../../common-errors/cams-error';

describe('AcsNotificationGateway', () => {
  const senderAddress = 'DoNotReply@notifications.example.com';

  const notification: Notification = {
    to: 'recipient@example.com',
    toDisplayName: 'Test Recipient',
    subject: 'Trustee Information Changed: Henry Green',
    html: '<p>Change details</p>',
    text: 'Change details',
    correlationId: 'inv-123',
  };

  const mockPollUntilDone = vi.fn();
  const mockBeginSend = vi.fn();
  const mockClient = { beginSend: mockBeginSend } as unknown as EmailClient;
  const mockLogger: NotificationLogger = {
    info: vi.fn(),
    error: vi.fn(),
  };

  let gateway: AcsNotificationGateway;

  beforeEach(() => {
    vi.resetAllMocks();
    mockBeginSend.mockResolvedValue({ pollUntilDone: mockPollUntilDone });
    gateway = new AcsNotificationGateway(mockClient, senderAddress, mockLogger);
  });

  test('sends an email via ACS with correct message structure', async () => {
    mockPollUntilDone.mockResolvedValue({ status: 'Succeeded', id: 'msg-1' });

    await gateway.send(notification);

    expect(mockBeginSend).toHaveBeenCalledWith({
      senderAddress,
      content: {
        subject: notification.subject,
        html: notification.html,
        plainText: notification.text,
      },
      recipients: {
        to: [{ address: notification.to, displayName: notification.toDisplayName }],
      },
      headers: { 'X-Correlation-Id': 'inv-123' },
    });
  });

  test('throws CamsError when ACS returns a non-Succeeded status', async () => {
    mockPollUntilDone.mockResolvedValue({ status: 'Failed', id: 'msg-2' });

    await expect(gateway.send(notification)).rejects.toThrow(CamsError);
    await expect(gateway.send(notification)).rejects.toThrow(
      "Email send failed with status 'Failed' (id: msg-2)",
    );
  });

  test('propagates errors from the ACS client', async () => {
    mockBeginSend.mockRejectedValue(new Error('Network timeout'));

    await expect(gateway.send(notification)).rejects.toThrow('Network timeout');
  });

  test('handles notification without displayName', async () => {
    mockPollUntilDone.mockResolvedValue({ status: 'Succeeded', id: 'msg-3' });

    const noDisplayName: Notification = { ...notification, toDisplayName: undefined };
    await gateway.send(noDisplayName);

    expect(mockBeginSend).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: {
          to: [{ address: notification.to, displayName: undefined }],
        },
      }),
    );
  });

  test('passes abort signal with timeout to pollUntilDone', async () => {
    mockPollUntilDone.mockResolvedValue({ status: 'Succeeded', id: 'msg-4' });

    await gateway.send(notification);

    expect(mockPollUntilDone).toHaveBeenCalledWith({
      abortSignal: expect.objectContaining({ aborted: false }),
    });
  });

  test('logs success with message ID and correlation ID', async () => {
    mockPollUntilDone.mockResolvedValue({ status: 'Succeeded', id: 'msg-5' });

    await gateway.send(notification);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'ACS-NOTIFICATION-GATEWAY',
      'Email sent successfully',
      { messageId: 'msg-5', to: 'recipient@example.com', correlationId: 'inv-123' },
    );
  });

  test('omits correlation header when correlationId is undefined', async () => {
    mockPollUntilDone.mockResolvedValue({ status: 'Succeeded', id: 'msg-6' });

    const noCorrelation: Notification = { ...notification, correlationId: undefined };
    await gateway.send(noCorrelation);

    expect(mockBeginSend).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: undefined,
      }),
    );
  });
});
