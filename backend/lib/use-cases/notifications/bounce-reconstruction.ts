import { ApplicationContext } from '../../adapters/types/basic';
import { Notification } from '@common/cams/notifications';
import { EmailNotificationArchiveRepository, NotificationGateway } from '../gateways.types';
import factory from '../../factory';
import {
  buildUndeliverableAdminHtml,
  buildUndeliverableAdminText,
  compileTrusteeChangeTemplate,
} from './templates/trustee-change-template';
import { NotFoundError } from '../../common-errors/not-found-error';

const MODULE_NAME = 'BOUNCE-RECONSTRUCTION';

export class BounceReconstructionUseCase {
  private readonly archiveRepository: EmailNotificationArchiveRepository;
  private readonly notificationGateway: NotificationGateway;

  constructor(context: ApplicationContext) {
    this.archiveRepository = factory.getEmailNotificationArchiveRepository(context);
    this.notificationGateway = factory.getNotificationGateway(context);
  }

  /**
   * Looks up the archived changeSet for a bounced messageId, recompiles the original
   * email content, and sends it to the admin in forwardable form.
   */
  async reconstructAndForward(
    context: ApplicationContext,
    messageId: string,
    adminEmail: string,
    deliveryStatus?: string,
  ): Promise<void> {
    const archived = await this.archiveRepository.readArchivedEmail(messageId);
    if (!archived) {
      throw new NotFoundError(MODULE_NAME, {
        message: `No archived email found for messageId '${messageId}'. It may have already expired (TTL) or never existed.`,
      });
    }

    if (deliveryStatus === 'Suppressed') {
      context.logger.warn(
        MODULE_NAME,
        `Recipient '${archived.recipientAddress}' is on ACS's suppression list (messageId: '${messageId}'); ACS will silently decline to send further notifications to this address until it's removed from the list.`,
      );
    }

    const compiled = compileTrusteeChangeTemplate(archived.changeSet);
    const notification: Notification = {
      to: adminEmail,
      subject: `[Bounced] ${compiled.subject}`,
      html: buildUndeliverableAdminHtml(archived.recipientAddress, compiled.html),
      text: buildUndeliverableAdminText(archived.recipientAddress, compiled.text),
      correlationId: context.invocationId,
    };

    await this.notificationGateway.send(notification);

    context.logger.info(
      MODULE_NAME,
      `Forwarded bounced trustee change notification to admin (messageId: '${messageId}', originalRecipient: '${archived.recipientAddress}', deliveryStatus: '${deliveryStatus ?? 'unknown'}').`,
    );
  }
}
