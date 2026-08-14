import { ApplicationContext } from '../../adapters/types/basic';
import {
  Notification,
  NotificationRecipient,
  RoutingCategory,
  TrusteeChangeSet,
} from '@common/cams/notifications';
import {
  EmailNotificationArchiveRepository,
  NotificationGateway,
  NotificationRoutingRepository,
} from '../gateways.types';
import factory from '../../factory';
import { compileTrusteeChangeTemplate } from './templates/trustee-change-template';
import { isCamsError } from '../../common-errors/cams-error';

const MODULE_NAME = 'TRUSTEE-CHANGE-NOTIFICATION';

type NotificationFailureReason = 'connection' | 'send' | 'skipped';

export type NotificationFailure = {
  address?: string;
  reason: NotificationFailureReason;
  message: string;
};

export type TrusteeChangeNotificationSummary = {
  attempted: number;
  failed: number;
  failures: NotificationFailure[];
};

type AddressSendResult = {
  address: string;
  failure?: NotificationFailure;
};

export class TrusteeChangeNotificationUseCase {
  private readonly routingRepository: NotificationRoutingRepository;
  private readonly notificationGateway: NotificationGateway;
  private readonly archiveRepository: EmailNotificationArchiveRepository;

  constructor(context: ApplicationContext) {
    this.routingRepository = factory.getNotificationRoutingRepository(context);
    this.notificationGateway = factory.getNotificationGateway(context);
    this.archiveRepository = factory.getEmailNotificationArchiveRepository(context);
  }

  async notify(
    context: ApplicationContext,
    changeSet: TrusteeChangeSet,
  ): Promise<TrusteeChangeNotificationSummary> {
    const empty: TrusteeChangeNotificationSummary = {
      attempted: 0,
      failed: 0,
      failures: [],
    };
    if (changeSet.fields.length === 0) return empty;

    const { mailingLists, skipped } = await this.resolveMailingLists(context, changeSet);
    if (mailingLists.length === 0) {
      return { attempted: 0, failed: skipped.length, failures: skipped };
    }

    const compiled = compileTrusteeChangeTemplate(changeSet);
    const replyTo = changeSet.author?.email
      ? { address: changeSet.author.email, displayName: changeSet.author.name }
      : undefined;

    const results: AddressSendResult[] = [];
    for (const mailingList of mailingLists) {
      results.push(
        ...(await this.sendToMailingList(context, mailingList, changeSet, compiled, replyTo)),
      );
    }

    const sendFailures = results.filter((r) => r.failure).map((r) => r.failure!);
    const failures = [...skipped, ...sendFailures];
    return {
      attempted: results.length,
      failed: failures.length,
      failures,
    };
  }

  private async sendToMailingList(
    context: ApplicationContext,
    mailingList: NotificationRecipient,
    changeSet: TrusteeChangeSet,
    compiled: { subject: string; html: string; text: string },
    replyTo: Notification['replyTo'],
  ): Promise<AddressSendResult[]> {
    const results: AddressSendResult[] = [];
    for (const address of mailingList.recipientAddresses) {
      const notification: Notification = {
        to: address,
        toDisplayName: mailingList.displayName,
        subject: compiled.subject,
        html: compiled.html,
        text: compiled.text,
        correlationId: context.invocationId,
        replyTo,
        trusteeId: changeSet.trusteeId,
      };
      try {
        const result = await this.notificationGateway.send(notification);
        await this.archiveSentEmail(context, result.messageId, address, changeSet);
        results.push({ address });
      } catch (error) {
        const reason: NotificationFailureReason =
          isCamsError(error) &&
          (error.data as { reason?: NotificationFailureReason })?.reason === 'connection'
            ? 'connection'
            : 'send';
        const detail = error instanceof Error ? error.message : 'unknown error';
        const message = `Failed to notify ${address} (covers: ${mailingList.covers.join(', ')}): ${detail}`;
        context.logger.error(MODULE_NAME, message, error);
        results.push({ address, failure: { address, reason, message } });
      }
    }
    return results;
  }

  /**
   * Best-effort archive of the sent changeSet, keyed by the provider's messageId, so a
   * later bounce can be reconstructed and forwarded. Archive failures are logged, not
   * thrown -- the notification already sent successfully, and that outcome must stand
   * regardless of whether the archive write succeeds.
   */
  private async archiveSentEmail(
    context: ApplicationContext,
    messageId: string,
    recipientAddress: string,
    changeSet: TrusteeChangeSet,
  ): Promise<void> {
    try {
      await this.archiveRepository.archiveSentEmail({
        messageId,
        recipientAddress,
        changeSet,
      });
    } catch (error) {
      context.logger.error(
        MODULE_NAME,
        `Failed to archive sent trustee change notification (messageId: '${messageId}', recipient: '${recipientAddress}'). A bounce for this message cannot be reconstructed.`,
        error,
      );
    }
  }

  private async resolveMailingLists(
    context: ApplicationContext,
    changeSet: TrusteeChangeSet,
  ): Promise<{ mailingLists: NotificationRecipient[]; skipped: NotificationFailure[] }> {
    const categories = new Set<RoutingCategory>(changeSet.fields.map((f) => f.category));

    const candidates: NotificationRecipient[] = [];
    const skipped: NotificationFailure[] = [];
    for (const category of categories) {
      const resolved = await this.resolveMailingListsForCategory(
        context,
        category,
        changeSet.chapters,
      );
      candidates.push(...resolved.mailingLists);
      skipped.push(...resolved.skipped);
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
    return { mailingLists: unique, skipped };
  }

  private async resolveMailingListsForCategory(
    context: ApplicationContext,
    category: RoutingCategory,
    chapters: TrusteeChangeSet['chapters'],
  ): Promise<{ mailingLists: NotificationRecipient[]; skipped: NotificationFailure[] }> {
    const routingKeys =
      category === 'zoom-341'
        ? ['category:zoom-341']
        : (chapters ?? []).map((chapter) => `chapter:${chapter}`);

    if (routingKeys.length === 0) return { mailingLists: [], skipped: [] };

    const mailingLists: NotificationRecipient[] = [];
    const skipped: NotificationFailure[] = [];
    for (const routingKey of routingKeys) {
      const resolved = await this.resolveMailingListForRoutingKey(context, routingKey);
      if (resolved.mailingList) mailingLists.push(resolved.mailingList);
      if (resolved.skip) skipped.push(resolved.skip);
    }
    return { mailingLists, skipped };
  }

  private async resolveMailingListForRoutingKey(
    context: ApplicationContext,
    routingKey: string,
  ): Promise<{ mailingList: NotificationRecipient | null; skip?: NotificationFailure }> {
    const hit = await this.routingRepository.findRecipientByRoutingKey(routingKey);
    if (hit) return { mailingList: hit };

    const fallback = process.env.DEFAULT_NOTIFICATION_RECIPIENT;
    if (fallback) {
      return {
        mailingList: { covers: [], recipientAddresses: [fallback], displayName: 'Default' },
      };
    }

    const message = `No mailing list is configured to receive notifications for '${routingKey}'; the change was saved but no email notification was sent.`;
    context.logger.error(MODULE_NAME, message);
    return { mailingList: null, skip: { reason: 'skipped', message } };
  }
}
