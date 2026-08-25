import { ApplicationContext } from '../../types/basic';
import QueryBuilder from '../../../query/query-builder';
import { getCamsError } from '../../../common-errors/error-utilities';
import { isNotFoundError } from '../../../common-errors/not-found-error';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import {
  EmailNotificationArchiveRecord,
  EmailNotificationArchiveRepository,
} from '../../../use-cases/gateways.types';

const MODULE_NAME = 'EMAIL-NOTIFICATION-ARCHIVE-MONGO-REPOSITORY';
const COLLECTION_NAME = 'email-notification-archive';

// Bounces are expected to surface within minutes to hours of a send (per the
// alert's ~15 minute evaluation window). 7 days gives generous margin for a
// human to notice and act on the alert without retaining data indefinitely.
const TTL_SECONDS = 60 * 60 * 24 * 7;

const { using } = QueryBuilder;

type EmailNotificationArchiveDoc = EmailNotificationArchiveRecord & {
  ttl: number;
};

export class EmailNotificationArchiveMongoRepository
  extends BaseMongoRepository
  implements EmailNotificationArchiveRepository
{
  private static referenceCount: number = 0;
  private static instance: EmailNotificationArchiveMongoRepository | null;

  private readonly doc = using<EmailNotificationArchiveDoc>();

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!EmailNotificationArchiveMongoRepository.instance) {
      EmailNotificationArchiveMongoRepository.instance =
        new EmailNotificationArchiveMongoRepository(context);
    }
    EmailNotificationArchiveMongoRepository.referenceCount++;
    return EmailNotificationArchiveMongoRepository.instance;
  }

  public static dropInstance() {
    if (EmailNotificationArchiveMongoRepository.referenceCount > 0) {
      EmailNotificationArchiveMongoRepository.referenceCount--;
    }
    if (EmailNotificationArchiveMongoRepository.referenceCount < 1) {
      EmailNotificationArchiveMongoRepository.instance?.client.close().then();
      EmailNotificationArchiveMongoRepository.instance = null;
    }
  }

  public release() {
    EmailNotificationArchiveMongoRepository.dropInstance();
  }

  public async archiveSentEmail(record: EmailNotificationArchiveRecord): Promise<void> {
    try {
      const doc: EmailNotificationArchiveDoc = {
        ...record,
        ttl: TTL_SECONDS,
      };
      await this.getAdapter<EmailNotificationArchiveDoc>().insertOne(doc);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async readArchivedEmail(
    messageId: string,
  ): Promise<EmailNotificationArchiveRecord | null> {
    try {
      const query = this.doc('messageId').equals(messageId);
      const result = await this.getAdapter<EmailNotificationArchiveDoc>().findOne(query);
      const { ttl: _ttl, ...record } = result;
      return record;
    } catch (originalError) {
      if (isNotFoundError(originalError)) {
        return null;
      }
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
