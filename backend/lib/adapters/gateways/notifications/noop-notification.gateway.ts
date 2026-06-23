import { Notification } from '@common/cams/notifications';
import { NotificationGateway } from '../../../use-cases/gateways.types';

export class NoOpNotificationGateway implements NotificationGateway {
  async send(_notification: Notification): Promise<void> {
    // Intentional no-op: used in non-mock environments until a real provider is wired (Slice 5).
  }
}
