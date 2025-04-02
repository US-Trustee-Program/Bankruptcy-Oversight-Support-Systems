import { OfficeAssignee } from '../../../use-cases/dataflows/office-assignees';
import { OfficeAssigneesRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { ApplicationContext } from '../../types/basic';
import { OfficeAssigneePredicate } from '../../../../../common/src/api/search';
import { Query } from '../../../query/query-builder';

const MODULE_NAME = 'OFFICE-ASSIGNEES-MONGO-REPOSITORY';
const COLLECTION_NAME = 'office-assignees';

export class OfficeAssigneeMongoRepository
  extends BaseMongoRepository
  implements OfficeAssigneesRepository
{
  private static referenceCount: number = 0;
  private static instance: OfficeAssigneeMongoRepository;

  private constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!OfficeAssigneeMongoRepository.instance) {
      OfficeAssigneeMongoRepository.instance = new OfficeAssigneeMongoRepository(context);
    }
    OfficeAssigneeMongoRepository.referenceCount++;
    return OfficeAssigneeMongoRepository.instance;
  }

  public static dropInstance() {
    if (OfficeAssigneeMongoRepository.referenceCount > 0) {
      OfficeAssigneeMongoRepository.referenceCount--;
    }
    if (OfficeAssigneeMongoRepository.referenceCount < 1) {
      OfficeAssigneeMongoRepository.instance.client.close().then();
      OfficeAssigneeMongoRepository.instance = null;
    }
  }

  public release() {
    OfficeAssigneeMongoRepository.dropInstance();
  }

  async create(data: OfficeAssignee): Promise<void> {
    await this.getAdapter().insertOne(data);
  }

  async search(_predicate?: OfficeAssigneePredicate): Promise<OfficeAssignee[]> {
    // TODO: Transalate predicate to query.
    const query = {} as Query<OfficeAssignee>;
    return this.getAdapter<OfficeAssignee>().find(query);
  }

  async deleteMany<T>(_predicate: T): Promise<void> {
    // TODO: Transalate predicate to query.
    const query = {} as Query<OfficeAssignee>;
    await this.getAdapter<OfficeAssignee>().deleteMany(query);
  }
}
