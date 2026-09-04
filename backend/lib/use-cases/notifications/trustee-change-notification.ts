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
import {
  buildUndeliverableAdminHtml,
  buildUndeliverableAdminText,
  compileTrusteeChangeTemplate,
} from './templates/trustee-change-template';
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

function getSendFailureReason(error: unknown): NotificationFailureReason {
  if (!isCamsError(error)) return 'send';
  const data = error.data as { reason?: NotificationFailureReason };
  return data?.reason === 'connection' ? 'connection' : 'send';
}

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
      context.logger.info(
        MODULE_NAME,
        `Trustee change notification for trusteeId '${changeSet.trusteeId}' sent to 0 recipients; no mailing list resolved.`,
      );
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
    context.logger.info(
      MODULE_NAME,
      `Trustee change notification for trusteeId '${changeSet.trusteeId}' complete: attempted ${results.length}, failed ${failures.length}.`,
    );
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
        const reason = getSendFailureReason(error);
        const detail = error instanceof Error ? error.message : 'unknown error';
        const message = `Failed to notify ${address} (covers: ${mailingList.covers.join(', ')}): ${detail}`;
        context.logger.error(MODULE_NAME, message, error);
        if (reason === 'send') {
          await this.forwardUndeliverableToAdmin(context, address, compiled, detail);
        }
        results.push({ address, failure: { address, reason, message } });
      }
    }
    return results;
  }

  /**
   * ACS rejecting a send synchronously (e.g. a recipient on its suppression list) means no
   * delivery was ever attempted, so no later bounce log will surface for it -- the async
   * bounce-poll dataflow will never see this failure. The compiled content is already in
   * hand here, so forward it to the admin immediately instead of archiving it for a poll
   * that will never find it. Connection failures are excluded: they're transient and don't
   * indicate a bad recipient, so a retry is more appropriate than an admin forward.
   */
  private async forwardUndeliverableToAdmin(
    context: ApplicationContext,
    address: string,
    compiled: { subject: string; html: string; text: string },
    detail: string,
  ): Promise<void> {
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
    if (!adminEmail) {
      context.logger.error(
        MODULE_NAME,
        `ADMIN_NOTIFICATION_EMAIL is not configured; cannot forward the undeliverable notification originally addressed to '${address}'.`,
      );
      return;
    }

    const notification: Notification = {
      to: adminEmail,
      subject: `[Undeliverable] ${compiled.subject}`,
      html: buildUndeliverableAdminHtml(address, compiled.html),
      text: buildUndeliverableAdminText(address, compiled.text),
      correlationId: context.invocationId,
    };

    try {
      await this.notificationGateway.send(notification);
      context.logger.info(
        MODULE_NAME,
        `Forwarded undeliverable trustee change notification to admin (originalRecipient: '${address}', detail: '${detail}').`,
      );
    } catch (error) {
      context.logger.error(
        MODULE_NAME,
        `Failed to forward undeliverable trustee change notification to admin for '${address}'.`,
        error,
      );
    }
  }

  /**
   * Best-effort archive of a successfully-sent changeSet email, keyed by ACS's messageId, so
   * a later async bounce can be reconstructed and forwarded. Synchronous rejections don't
   * archive here -- see forwardUndeliverableToAdmin, which handles those immediately since
   * ACS never attempted delivery and thus will never produce a bounce log for them. Archive
   * failures are logged, not thrown -- the underlying send outcome (success or failure) must
   * stand regardless of whether the archive write succeeds.
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
