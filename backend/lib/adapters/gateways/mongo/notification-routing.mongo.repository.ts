import { ApplicationContext } from '../../types/basic';
import QueryBuilder from '../../../query/query-builder';
import { getCamsError } from '../../../common-errors/error-utilities';
import { isNotFoundError } from '../../../common-errors/not-found-error';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import {
  NotificationRecipient,
  NotificationRoutingAuditHistory,
  NotificationRoutingRecord,
  NotificationRoutingUpdateInput,
  NOTIFICATION_ROUTING_DEFINITIONS,
} from '@common/cams/notifications';
import { Creatable } from '@common/cams/creatable';
import { NotificationRoutingRepository } from '../../../use-cases/gateways.types';

const MODULE_NAME = 'NOTIFICATION-ROUTING-MONGO-REPOSITORY';
const COLLECTION_NAME = 'notification-routing';

const { using } = QueryBuilder;

type NotificationRoutingDoc = NotificationRoutingRecord & {
  enabled?: boolean;
};

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

  public async findRecipientByRoutingKey(key: string): Promise<NotificationRecipient | null> {
    const query = this.doc('covers').contains([key]);
    try {
      const result = await this.getAdapter<NotificationRoutingDoc>().findOne(query);
      return {
        covers: result.covers ?? [],
        recipientAddress: result.recipientAddress ?? '',
        displayName: result.displayName ?? '',
      };
    } catch (originalError) {
      if (isNotFoundError(originalError)) {
        return null;
      }
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async getAll(): Promise<NotificationRoutingRecord[]> {
    try {
      const query = this.doc('documentType').equals('NOTIFICATION_ROUTING');
      const results = await this.getAdapter<NotificationRoutingDoc>().find(query);
      return results.map((doc) => ({
        id: doc.id,
        documentType: 'NOTIFICATION_ROUTING' as const,
        covers: doc.covers,
        recipientAddress: doc.recipientAddress,
        displayName: doc.displayName,
      }));
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async updateRoutingRecord(
    id: string,
    input: NotificationRoutingUpdateInput,
  ): Promise<NotificationRoutingRecord> {
    try {
      const definition = NOTIFICATION_ROUTING_DEFINITIONS.find((d) => d.id === id);
      const query = this.doc('id').equals(id);
      const doc: NotificationRoutingDoc = {
        id,
        covers: definition?.covers ?? [],
        displayName: definition?.displayName ?? '',
        recipientAddress: input.recipientAddress,
        documentType: 'NOTIFICATION_ROUTING',
      };
      await this.getAdapter<NotificationRoutingDoc>().replaceOne(query, doc, true);
      return {
        id,
        documentType: 'NOTIFICATION_ROUTING',
        covers: doc.covers,
        recipientAddress: input.recipientAddress,
        displayName: doc.displayName,
      };
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async createRoutingAuditRecord(
    record: Creatable<NotificationRoutingAuditHistory>,
  ): Promise<void> {
    try {
      await this.getAdapter<NotificationRoutingAuditHistory>().insertOne(
        record as NotificationRoutingAuditHistory,
      );
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
