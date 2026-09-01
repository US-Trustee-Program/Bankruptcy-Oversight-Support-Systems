import { vi } from 'vitest';
import {
  AcsNotificationGateway,
  isConnectionFailure,
  NotificationLogger,
} from './acs-notification.gateway';
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
    vi.restoreAllMocks();
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
      replyTo: undefined,
      headers: { 'X-Correlation-Id': 'inv-123' },
    });
  });

  test('returns the ACS messageId on a successful send', async () => {
    mockPollUntilDone.mockResolvedValue({ status: 'Succeeded', id: 'msg-1' });

    const result = await gateway.send(notification);

    expect(result).toEqual({ messageId: 'msg-1' });
  });

  test.each([
    {
      description: 'includes replyTo on the message when notification has replyTo',
      replyTo: { address: 'author@example.com', displayName: 'Jane Author' },
      expected: [{ address: 'author@example.com', displayName: 'Jane Author' }],
    },
    {
      description: 'omits replyTo when notification does not have replyTo',
      replyTo: undefined,
      expected: undefined,
    },
    {
      description:
        'includes replyTo with address only when notification replyTo has no displayName',
      replyTo: { address: 'author@example.com' },
      expected: [{ address: 'author@example.com', displayName: undefined }],
    },
  ])('$description', async ({ replyTo, expected }) => {
    mockPollUntilDone.mockResolvedValue({ status: 'Succeeded', id: 'msg-reply' });

    await gateway.send({ ...notification, replyTo });

    expect(mockBeginSend).toHaveBeenCalledWith(
      expect.objectContaining({
        replyTo: expected,
      }),
    );
  });

  test.each([{ trusteeId: 'trustee-42' }, { trusteeId: undefined }])(
    'includes trusteeId $trusteeId in the success log line',
    async ({ trusteeId }) => {
      mockPollUntilDone.mockResolvedValue({ status: 'Succeeded', id: 'msg-trustee' });

      await gateway.send({ ...notification, trusteeId });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'ACS-NOTIFICATION-GATEWAY',
        'Email sent successfully',
        expect.objectContaining({
          messageId: 'msg-trustee',
          to: 'recipient@example.com',
          correlationId: 'inv-123',
          trusteeId,
        }),
      );
    },
  );

  test('sends successfully when no logger is provided', async () => {
    mockPollUntilDone.mockResolvedValue({ status: 'Succeeded', id: 'msg-no-logger' });
    const loggerlessGateway = new AcsNotificationGateway(mockClient, senderAddress);

    await expect(loggerlessGateway.send(notification)).resolves.toEqual({
      messageId: 'msg-no-logger',
    });
  });

  test('includes trusteeId in the success log line when present on the notification', async () => {
    mockPollUntilDone.mockResolvedValue({ status: 'Succeeded', id: 'msg-trustee-1' });

    await gateway.send({ ...notification, trusteeId: 'trustee-42' });

    expect(mockLogger.info).toHaveBeenCalledWith(
      'ACS-NOTIFICATION-GATEWAY',
      'Email sent successfully',
      expect.objectContaining({ messageId: 'msg-trustee-1', trusteeId: 'trustee-42' }),
    );
  });

  test('throws CamsError when ACS returns a non-Succeeded status', async () => {
    mockPollUntilDone.mockResolvedValue({ status: 'Failed', id: 'msg-2' });

    const error = await gateway.send(notification).catch((e) => e);

    expect(error).toBeInstanceOf(CamsError);
    expect(error.message).toContain(
      "Email service rejected the message with status 'Failed' (id: msg-2)",
    );
    expect(error.data).toEqual({ reason: 'send', messageId: 'msg-2' });
  });

  test('logs an error when ACS returns a non-Succeeded status', async () => {
    mockPollUntilDone.mockResolvedValue({ status: 'Failed', id: 'msg-err' });

    await gateway.send(notification).catch(() => undefined);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'ACS-NOTIFICATION-GATEWAY',
      expect.stringContaining(
        "Email service rejected the message with status 'Failed' (id: msg-err)",
      ),
      expect.objectContaining({ id: 'msg-err', to: 'recipient@example.com' }),
    );
  });

  test('wraps beginSend errors in a CamsError', async () => {
    mockBeginSend.mockRejectedValue(new Error('Network timeout'));

    const error = await gateway.send(notification).catch((e) => e);

    expect(error).toBeInstanceOf(CamsError);
    expect(error.message).toBe('Failed to send email: Network timeout');
    expect(error.data).toEqual({ reason: 'send' });
    expect(error.originalError).toContain('Network timeout');
    expect(mockLogger.error).toHaveBeenCalledWith(
      'ACS-NOTIFICATION-GATEWAY',
      'Failed to send email: Network timeout',
      expect.objectContaining({
        to: notification.to,
        correlationId: notification.correlationId,
        trusteeId: notification.trusteeId,
        errorName: 'Error',
      }),
    );
  });

  test('wraps pollUntilDone errors in a CamsError', async () => {
    mockPollUntilDone.mockRejectedValue(new Error('Timed out'));

    const error = await gateway.send(notification).catch((e) => e);

    expect(error).toBeInstanceOf(CamsError);
    expect(error.message).toBe('Failed to send email: Timed out');
    expect(error.data).toEqual({ reason: 'send' });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'ACS-NOTIFICATION-GATEWAY',
      'Failed to send email: Timed out',
      expect.objectContaining({
        to: notification.to,
        correlationId: notification.correlationId,
        trusteeId: notification.trusteeId,
        errorName: 'Error',
      }),
    );
  });

  test('falls back to a generic message when a non-Error value is thrown', async () => {
    mockBeginSend.mockRejectedValue('a rejected string, not an Error');

    const error = await gateway.send(notification).catch((e) => e);

    expect(error).toBeInstanceOf(CamsError);
    expect(error.message).toBe('Failed to send email: unknown error');
  });

  test('reports a connection failure with a distinct message and reason', async () => {
    const connectionError = Object.assign(new Error('connect ECONNREFUSED'), {
      code: 'ECONNREFUSED',
    });
    mockBeginSend.mockRejectedValue(connectionError);

    const error = await gateway.send(notification).catch((e) => e);

    expect(error).toBeInstanceOf(CamsError);
    expect(error.message).toBe('Unable to connect to the email service');
    expect(error.data).toEqual({ reason: 'connection' });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'ACS-NOTIFICATION-GATEWAY',
      'Unable to connect to the email service',
      expect.objectContaining({
        to: notification.to,
        correlationId: notification.correlationId,
        trusteeId: notification.trusteeId,
        errorCode: 'ECONNREFUSED',
        errorName: 'Error',
      }),
    );
  });

  test('passes abort signal with a 30 second timeout to pollUntilDone', async () => {
    mockPollUntilDone.mockResolvedValue({ status: 'Succeeded', id: 'msg-4' });
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');

    await gateway.send(notification);

    expect(timeoutSpy).toHaveBeenCalledWith(30_000);
    expect(mockPollUntilDone).toHaveBeenCalledWith({
      abortSignal: expect.objectContaining({ aborted: false }),
    });
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

describe('isConnectionFailure', () => {
  test.each([
    { description: 'a network error code', error: { code: 'ECONNREFUSED' } },
    { description: 'an ENOTFOUND error code', error: { code: 'ENOTFOUND' } },
    { description: 'an ECONNRESET error code', error: { code: 'ECONNRESET' } },
    { description: 'an EAI_AGAIN error code', error: { code: 'EAI_AGAIN' } },
    { description: 'an EPIPE error code', error: { code: 'EPIPE' } },
    {
      description: 'a network error code nested under cause',
      error: { cause: { code: 'ETIMEDOUT' } },
    },
    { description: 'AbortError by name', error: { name: 'AbortError' } },
    { description: 'FetchError by name', error: { name: 'FetchError' } },
  ])('returns true for $description', ({ error }) => {
    expect(isConnectionFailure(error)).toBe(true);
  });

  test('returns false when statusCode is present, even if the code would otherwise match', () => {
    expect(isConnectionFailure({ code: 'ECONNREFUSED', statusCode: 500 })).toBe(false);
  });

  test.each([
    { description: 'a non-network error code', error: { code: 'SOME_OTHER_CODE' } },
    { description: 'a plain Error with an unrelated name', error: new Error('boom') },
  ])('returns false for $description', ({ error }) => {
    expect(isConnectionFailure(error)).toBe(false);
  });

  test.each([{ value: null }, { value: undefined }, { value: 'a string' }, { value: 42 }])(
    'returns false for non-object input $value',
    ({ value }) => {
      expect(isConnectionFailure(value)).toBe(false);
    },
  );
});
