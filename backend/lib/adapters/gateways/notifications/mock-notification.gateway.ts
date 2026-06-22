import { Notification } from '@common/cams/notifications';
import { NotificationGateway } from '../../../use-cases/gateways.types';

export const MODULE_NAME = 'MOCK-NOTIFICATION-GATEWAY';

export class MockNotificationGateway implements NotificationGateway {
  private static instance: MockNotificationGateway | null = null;
  private recorded: Notification[] = [];

  static getInstance(): MockNotificationGateway {
    if (!MockNotificationGateway.instance) {
      MockNotificationGateway.instance = new MockNotificationGateway();
    }
    return MockNotificationGateway.instance;
  }

  async send(notification: Notification): Promise<void> {
    this.recorded.push(notification);
  }

  /** Test-only. Returns a defensive copy of recorded notifications. */
  getRecorded(): Notification[] {
    return [...this.recorded];
  }

  /** Test-only. Resets recorded notifications between tests. */
  clear(): void {
    this.recorded = [];
  }
}
