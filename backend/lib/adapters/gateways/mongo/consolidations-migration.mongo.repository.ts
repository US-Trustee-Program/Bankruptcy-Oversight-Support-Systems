// TODO: Delete this module once the consolidation order `consolidationId` values have been migrated.

import { ConsolidationOrder } from '../../../../../common/src/cams/orders';
import { using } from '../../../query/query-builder';
import { ApplicationContext } from '../../types/basic';
import { getCamsError } from '../../../common-errors/error-utilities';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import {
  MigrationConsolidationOrder,
  UpdateConsolidationId,
} from '../../../use-cases/gateways.types';
import QueryPipeline from '../../../query/query-pipeline';

const MODULE_NAME = 'CONSOLIDATIONS-MIGRATION-MONGO-REPOSITORY';
const COLLECTION_NAME = 'consolidations';

export default class ConsolidationOrdersMigrationMongoRepository extends BaseMongoRepository {
  private static referenceCount: number = 0;
  private static instance: ConsolidationOrdersMigrationMongoRepository;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!ConsolidationOrdersMigrationMongoRepository.instance) {
      ConsolidationOrdersMigrationMongoRepository.instance =
        new ConsolidationOrdersMigrationMongoRepository(context);
    }
    ConsolidationOrdersMigrationMongoRepository.referenceCount++;
    return ConsolidationOrdersMigrationMongoRepository.instance;
  }

  public static dropInstance() {
    if (ConsolidationOrdersMigrationMongoRepository.referenceCount > 0) {
      ConsolidationOrdersMigrationMongoRepository.referenceCount--;
    }
    if (ConsolidationOrdersMigrationMongoRepository.referenceCount < 1) {
      ConsolidationOrdersMigrationMongoRepository.instance.client.close().then();
      ConsolidationOrdersMigrationMongoRepository.instance = null;
    }
  }

  public release() {
    ConsolidationOrdersMigrationMongoRepository.dropInstance();
  }

  public async list(): Promise<MigrationConsolidationOrder[]> {
    const { include, pipeline } = QueryPipeline;
    return this.getAdapter<MigrationConsolidationOrder>().aggregate(
      pipeline(include({ name: 'id' }, { name: 'jobId' }, { name: 'status' })),
    );
  }

  public async set(value: UpdateConsolidationId): Promise<UpdateConsolidationId> {
    const { id, consolidationId } = value;
    const doc = using<UpdateConsolidationId>();
    const query = doc('id').equals(id);

    try {
      const adapter = this.getAdapter<ConsolidationOrder>();

      const original = await adapter.findOne(query);

      const copy = {
        ...original,
        id: crypto.randomUUID(),
        consolidationId,
      };

      await adapter.insertOne(copy);
      await adapter.deleteOne(query);

      return value;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
