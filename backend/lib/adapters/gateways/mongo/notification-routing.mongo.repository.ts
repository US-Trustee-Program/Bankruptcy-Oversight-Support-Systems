import { ApplicationContext } from '../../types/basic';
import QueryBuilder from '../../../query/query-builder';
import { getCamsError } from '../../../common-errors/error-utilities';
import { isNotFoundError, NotFoundError } from '../../../common-errors/not-found-error';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { NotificationRecipient } from '@common/cams/notifications';
import { NotificationRoutingRepository } from '../../../use-cases/gateways.types';

const MODULE_NAME = 'NOTIFICATION-ROUTING-MONGO-REPOSITORY';
const COLLECTION_NAME = 'notification-routing';

const { using } = QueryBuilder;

type NotificationRoutingDoc = NotificationRecipient;

export class NotificationRoutingMongoRepository
  extends BaseMongoRepository
  implements NotificationRoutingRepository
{
  private static referenceCount: number = 0;
  private static instance: NotificationRoutingMongoRepository | null;

  private readonly doc = using<NotificationRoutingDoc>();

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!NotificationRoutingMongoRepository.instance) {
      NotificationRoutingMongoRepository.instance = new NotificationRoutingMongoRepository(context);
    }
    NotificationRoutingMongoRepository.referenceCount++;
    return NotificationRoutingMongoRepository.instance;
  }

  public static dropInstance() {
    if (NotificationRoutingMongoRepository.referenceCount > 0) {
      NotificationRoutingMongoRepository.referenceCount--;
    }
    if (NotificationRoutingMongoRepository.referenceCount < 1) {
      NotificationRoutingMongoRepository.instance?.client.close().then();
      NotificationRoutingMongoRepository.instance = null;
    }
  }

  public release() {
    NotificationRoutingMongoRepository.dropInstance();
  }

  public async findRecipientByKey(key: string): Promise<NotificationRecipient | null> {
    const query = this.doc('key').equals(key);
    try {
      return await this.getAdapter<NotificationRoutingDoc>().findOne(query);
    } catch (originalError) {
      if (isNotFoundError(originalError)) {
        return null;
      }
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async getDefaultRecipient(): Promise<NotificationRecipient> {
    const recipient = await this.findRecipientByKey('default');
    if (!recipient) {
      throw new NotFoundError(MODULE_NAME, {
        message: 'Notification routing default recipient is not seeded.',
      });
    }
    return recipient;
  }
}
