import { NoOpNotificationGateway } from './noop-notification.gateway';

describe('NoOpNotificationGateway', () => {
  test('send resolves without throwing', async () => {
    const gateway = new NoOpNotificationGateway();
    await expect(
      gateway.send({
        to: 'test@example.test',
        subject: 'Test',
        html: '<p>test</p>',
        text: 'test',
        correlationId: 'corr-1',
      }),
    ).resolves.toBeUndefined();
  });
});
