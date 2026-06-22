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

export const MODULE_NAME = 'TRUSTEE-CHANGE-NOTIFICATION';

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
      const key = r.recipientAddress.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
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
    // Resolution order:
    //   1. category === 'zoom-341' -> 'category:zoom-341' (Slice 2 seeds this;
    //      Slice 1 falls through to default)
    //   2. category === 'profile'  -> 'chapter:<primaryChapter>' if present
    //   3. fallback                -> 'default'
    const tryKeys: string[] = [];
    if (category === 'zoom-341') {
      tryKeys.push('category:zoom-341');
    } else if (primaryChapter) {
      tryKeys.push(`chapter:${primaryChapter}`);
    }

    for (const key of tryKeys) {
      const hit = await this.routingRepository.findRecipientByKey(key);
      if (hit) return hit;
      context.logger.warn(
        MODULE_NAME,
        `No routing rule for key '${key}'; falling back to default.`,
      );
    }

    try {
      return await this.routingRepository.getDefaultRecipient();
    } catch (originalError) {
      context.logger.error(
        MODULE_NAME,
        `Default recipient missing from routing config; dropping notification for category '${category}'.`,
        originalError,
      );
      return null;
    }
  }
}
