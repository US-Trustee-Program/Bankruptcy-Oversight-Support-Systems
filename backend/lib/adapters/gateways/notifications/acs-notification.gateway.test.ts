import { vi } from 'vitest';
import { AcsNotificationGateway } from './acs-notification.gateway';
import { Notification } from '@common/cams/notifications';

const mockPollUntilDone = vi.fn();
const mockBeginSend = vi.fn().mockResolvedValue({ pollUntilDone: mockPollUntilDone });

vi.mock('@azure/communication-email', () => {
  return {
    EmailClient: class {
      beginSend = mockBeginSend;
    },
  };
});

describe('AcsNotificationGateway', () => {
  const connectionString = 'endpoint=https://test.communication.azure.com/;accesskey=abc123';
  const senderAddress = 'DoNotReply@notifications.example.com';
  let gateway: AcsNotificationGateway;

  const notification: Notification = {
    to: 'recipient@example.com',
    toDisplayName: 'Test Recipient',
    subject: 'Trustee Information Changed: Henry Green',
    html: '<p>Change details</p>',
    text: 'Change details',
    correlationId: 'inv-123',
  };

  beforeEach(() => {
    mockBeginSend.mockReset();
    mockPollUntilDone.mockReset();
    mockBeginSend.mockResolvedValue({ pollUntilDone: mockPollUntilDone });
    gateway = new AcsNotificationGateway(connectionString, senderAddress);
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
    });
  });

  test('throws when ACS returns a non-Succeeded status', async () => {
    mockPollUntilDone.mockResolvedValue({ status: 'Failed', id: 'msg-2' });

    await expect(gateway.send(notification)).rejects.toThrow(
      "ACS-NOTIFICATION-GATEWAY: Email send failed with status 'Failed' (id: msg-2)",
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
});
