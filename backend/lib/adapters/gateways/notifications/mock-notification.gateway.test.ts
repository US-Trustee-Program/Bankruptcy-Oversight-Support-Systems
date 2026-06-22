import { Notification } from '@common/cams/notifications';
import { MockNotificationGateway } from './mock-notification.gateway';

function buildNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    to: 'oversight@example.test',
    subject: 'Trustee Information Changed: Henry Green',
    html: '<html></html>',
    text: 'plaintext body',
    correlationId: 'invocation-1',
    ...overrides,
  };
}

describe('MockNotificationGateway', () => {
  beforeEach(() => {
    MockNotificationGateway.getInstance().clear();
  });

  describe('getInstance', () => {
    test('returns the same instance on repeated calls', () => {
      const a = MockNotificationGateway.getInstance();
      const b = MockNotificationGateway.getInstance();

      expect(a).toBe(b);
    });
  });

  describe('send', () => {
    test('records the dispatched notification', async () => {
      const gateway = MockNotificationGateway.getInstance();
      const notification = buildNotification();

      await gateway.send(notification);

      expect(gateway.getRecorded()).toEqual([notification]);
    });

    test('appends each subsequent dispatch in order', async () => {
      const gateway = MockNotificationGateway.getInstance();
      const first = buildNotification({ correlationId: 'invocation-1' });
      const second = buildNotification({ correlationId: 'invocation-2' });

      await gateway.send(first);
      await gateway.send(second);

      const recorded = gateway.getRecorded();
      expect(recorded).toHaveLength(2);
      expect(recorded[0].correlationId).toBe('invocation-1');
      expect(recorded[1].correlationId).toBe('invocation-2');
    });
  });

  describe('getRecorded', () => {
    test('returns a defensive copy — mutating the result does not affect later reads', async () => {
      const gateway = MockNotificationGateway.getInstance();
      await gateway.send(buildNotification({ correlationId: 'preserved' }));

      const snapshot = gateway.getRecorded();
      snapshot.length = 0;
      snapshot.push(buildNotification({ correlationId: 'tampered' }));

      const fresh = gateway.getRecorded();
      expect(fresh).toHaveLength(1);
      expect(fresh[0].correlationId).toBe('preserved');
    });
  });

  describe('clear', () => {
    test('empties the recorded list', async () => {
      const gateway = MockNotificationGateway.getInstance();
      await gateway.send(buildNotification());
      expect(gateway.getRecorded()).toHaveLength(1);

      gateway.clear();

      expect(gateway.getRecorded()).toEqual([]);
    });
  });
});
