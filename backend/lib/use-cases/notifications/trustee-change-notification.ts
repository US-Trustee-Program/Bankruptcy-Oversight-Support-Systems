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

    const mailingLists = await this.resolveMailingLists(context, changeSet);
    if (mailingLists.length === 0) return;

    const compiled = compileTrusteeChangeTemplate(changeSet);
    const replyTo = changeSet.author?.email
      ? { address: changeSet.author.email, displayName: changeSet.author.name }
      : undefined;

    for (const mailingList of mailingLists) {
      await this.sendToMailingList(context, mailingList, compiled, replyTo);
    }
  }

  private async sendToMailingList(
    context: ApplicationContext,
    mailingList: NotificationRecipient,
    compiled: { subject: string; html: string; text: string },
    replyTo: Notification['replyTo'],
  ): Promise<void> {
    for (const address of mailingList.recipientAddresses) {
      const notification: Notification = {
        to: address,
        toDisplayName: mailingList.displayName,
        subject: compiled.subject,
        html: compiled.html,
        text: compiled.text,
        correlationId: context.invocationId,
        replyTo,
      };
      try {
        await this.notificationGateway.send(notification);
      } catch (error) {
        context.logger.error(
          MODULE_NAME,
          `Failed to send trustee change notification to '${address}' (covers: ${mailingList.covers.join(', ')}).`,
          error,
        );
      }
    }
  }

  private async resolveMailingLists(
    context: ApplicationContext,
    changeSet: TrusteeChangeSet,
  ): Promise<NotificationRecipient[]> {
    const categories = new Set<RoutingCategory>(changeSet.fields.map((f) => f.category));

    const candidates: NotificationRecipient[] = [];
    for (const category of categories) {
      const mailingLists = await this.resolveMailingListsForCategory(
        context,
        category,
        changeSet.chapters,
      );
      candidates.push(...mailingLists);
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

  private async resolveMailingListsForCategory(
    context: ApplicationContext,
    category: RoutingCategory,
    chapters: TrusteeChangeSet['chapters'],
  ): Promise<NotificationRecipient[]> {
    const routingKeys =
      category === 'zoom-341'
        ? ['category:zoom-341']
        : (chapters ?? []).map((chapter) => `chapter:${chapter}`);

    if (routingKeys.length === 0) return [];

    const mailingLists: NotificationRecipient[] = [];
    for (const routingKey of routingKeys) {
      const mailingList = await this.resolveMailingListForRoutingKey(context, routingKey);
      if (mailingList) mailingLists.push(mailingList);
    }
    return mailingLists;
  }

  private async resolveMailingListForRoutingKey(
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
