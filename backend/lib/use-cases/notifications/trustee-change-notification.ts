import { ApplicationContext } from '../../adapters/types/basic';
import {
  Notification,
  NotificationRecipient,
  RoutingCategory,
  TrusteeChangeSet,
} from '@common/cams/notifications';
import { NotificationGateway, NotificationRoutingRepository } from '../gateways.types';
import factory from '../../factory';
import { compileTrusteeChangeTemplate } from './templates/trustee-change-template';

const MODULE_NAME = 'TRUSTEE-CHANGE-NOTIFICATION';

export class TrusteeChangeNotificationUseCase {
  private readonly routingRepository: NotificationRoutingRepository;
  private readonly notificationGateway: NotificationGateway;

  constructor(context: ApplicationContext) {
    this.routingRepository = factory.getNotificationRoutingRepository(context);
    this.notificationGateway = factory.getNotificationGateway(context);
  }

  async notify(context: ApplicationContext, changeSet: TrusteeChangeSet): Promise<void> {
    if (changeSet.fields.length === 0) return;

    const recipients = await this.resolveRecipients(context, changeSet);
    if (recipients.length === 0) return;

    const compiled = compileTrusteeChangeTemplate(changeSet);

    for (const recipient of recipients) {
      const notification: Notification = {
        to: recipient.recipientAddress,
        toDisplayName: recipient.displayName,
        subject: compiled.subject,
        html: compiled.html,
        text: compiled.text,
        correlationId: context.invocationId,
      };
      await this.notificationGateway.send(notification);
    }
  }

  private async resolveRecipients(
    context: ApplicationContext,
    changeSet: TrusteeChangeSet,
  ): Promise<NotificationRecipient[]> {
    const categories = new Set<RoutingCategory>(changeSet.fields.map((f) => f.category));

    const candidates: NotificationRecipient[] = [];
    for (const category of categories) {
      const recipient = await this.resolveRecipientForCategory(
        context,
        category,
        changeSet.primaryChapter,
      );
      if (recipient) candidates.push(recipient);
    }

    const seen = new Set<string>();
    const unique: NotificationRecipient[] = [];
    for (const r of candidates) {
      const addr = r.recipientAddress.toLowerCase();
      if (!seen.has(addr)) {
        seen.add(addr);
        unique.push(r);
      }
    }
    return unique;
  }

  private async resolveRecipientForCategory(
    context: ApplicationContext,
    category: RoutingCategory,
    primaryChapter: TrusteeChangeSet['primaryChapter'],
  ): Promise<NotificationRecipient | null> {
    let routingKey: string;
    if (category === 'zoom-341') {
      routingKey = 'category:zoom-341';
    } else if (primaryChapter) {
      routingKey = `chapter:${primaryChapter}`;
    } else {
      return null;
    }

    const hit = await this.routingRepository.findRecipientByRoutingKey(routingKey);
    if (hit) return hit;

    const fallback = process.env.DEFAULT_NOTIFICATION_RECIPIENT;
    if (fallback) {
      return { covers: [], recipientAddress: fallback, displayName: 'Default' };
    }

    context.logger.error(
      MODULE_NAME,
      `No routing record for key '${routingKey}' and no DEFAULT_NOTIFICATION_RECIPIENT env var; dropping notification.`,
    );
    return null;
  }
}
