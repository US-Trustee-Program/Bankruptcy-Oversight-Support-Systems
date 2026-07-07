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
    const replyTo = changeSet.author?.email
      ? { address: changeSet.author.email, displayName: changeSet.author.name }
      : undefined;

    for (const recipient of recipients) {
      for (const address of recipient.recipientAddresses) {
        const notification: Notification = {
          to: address,
          toDisplayName: recipient.displayName,
          subject: compiled.subject,
          html: compiled.html,
          text: compiled.text,
          correlationId: context.invocationId,
          replyTo,
        };
        await this.notificationGateway.send(notification);
      }
    }
  }

  private async resolveRecipients(
    context: ApplicationContext,
    changeSet: TrusteeChangeSet,
  ): Promise<NotificationRecipient[]> {
    const categories = new Set<RoutingCategory>(changeSet.fields.map((f) => f.category));

    const candidates: NotificationRecipient[] = [];
    for (const category of categories) {
      const recipients = await this.resolveRecipientsForCategory(
        context,
        category,
        changeSet.chapters,
      );
      candidates.push(...recipients);
    }

    const seen = new Set<string>();
    const unique: NotificationRecipient[] = [];
    for (const r of candidates) {
      const deduped = r.recipientAddresses.filter((a) => {
        const key = a.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (deduped.length > 0) {
        unique.push({ ...r, recipientAddresses: deduped });
      }
    }
    return unique;
  }

  private async resolveRecipientsForCategory(
    context: ApplicationContext,
    category: RoutingCategory,
    chapters: TrusteeChangeSet['chapters'],
  ): Promise<NotificationRecipient[]> {
    const routingKeys =
      category === 'zoom-341'
        ? ['category:zoom-341']
        : (chapters ?? []).map((chapter) => `chapter:${chapter}`);

    if (routingKeys.length === 0) return [];

    const recipients: NotificationRecipient[] = [];
    for (const routingKey of routingKeys) {
      const recipient = await this.resolveRecipientForRoutingKey(context, routingKey);
      if (recipient) recipients.push(recipient);
    }
    return recipients;
  }

  private async resolveRecipientForRoutingKey(
    context: ApplicationContext,
    routingKey: string,
  ): Promise<NotificationRecipient | null> {
    const hit = await this.routingRepository.findRecipientByRoutingKey(routingKey);
    if (hit) return hit;

    const fallback = process.env.DEFAULT_NOTIFICATION_RECIPIENT;
    if (fallback) {
      return { covers: [], recipientAddresses: [fallback], displayName: 'Default' };
    }

    context.logger.error(
      MODULE_NAME,
      `No routing record for key '${routingKey}' and no DEFAULT_NOTIFICATION_RECIPIENT env var; dropping notification.`,
    );
    return null;
  }
}
