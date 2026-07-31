import { Notification } from '@common/cams/notifications';
import { NotificationGateway, NotificationSendResult } from '../../use-cases/gateways.types';

export class MockNotificationGateway implements NotificationGateway {
  private static instance: MockNotificationGateway | null = null;
  private recorded: Notification[] = [];
  private messageIdSequence = 0;

  static getInstance(): MockNotificationGateway {
    if (!MockNotificationGateway.instance) {
      MockNotificationGateway.instance = new MockNotificationGateway();
    }
    return MockNotificationGateway.instance;
  }

  async send(notification: Notification): Promise<NotificationSendResult> {
    this.recorded.push(notification);
    this.messageIdSequence++;
    return { messageId: `mock-message-id-${this.messageIdSequence}` };
  }

  /** Test-only. Returns a defensive copy of recorded notifications. */
  getRecorded(): Notification[] {
    return [...this.recorded];
  }

  /** Test-only. Resets recorded notifications between tests. */
  clear(): void {
    this.recorded = [];
    this.messageIdSequence = 0;
  }
}
