import { OfficeAssignee } from '../../../use-cases/dataflows/migrate-office-assignees';
import { OfficeAssigneesRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { ApplicationContext } from '../../types/basic';
import { OfficeAssigneePredicate } from '../../../../../common/src/api/search';
import QueryBuilder, { using } from '../../../query/query-builder';
import { CamsError } from '../../../common-errors/cams-error';

const { and } = QueryBuilder;

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

  async search(predicate?: OfficeAssigneePredicate): Promise<OfficeAssignee[]> {
    return this.getAdapter<OfficeAssignee>().find(this.toQuery(predicate));
  }

  async deleteMany(predicate: OfficeAssigneePredicate): Promise<void> {
    await this.getAdapter<OfficeAssignee>().deleteMany(this.toQuery(predicate));
  }

  toQuery(predicate: OfficeAssigneePredicate) {
    const doc = using<OfficeAssignee>();
    if (predicate.caseId && predicate.userId) {
      return and(doc('userId').equals(predicate.userId), doc('caseId').equals(predicate.caseId));
    } else if (predicate.officeCode) {
      return doc('officeCode').equals(predicate.officeCode);
    } else {
      throw new CamsError(MODULE_NAME, { message: 'Invalid predicate', data: predicate });
    }
  }
}
