import { OfficeAssignee, OfficeAssigneesRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { ApplicationContext } from '../../types/basic';
import { OfficeAssigneePredicate } from '@common/api/search';
import QueryBuilder, { using } from '../../../query/query-builder';
import { CamsError } from '../../../common-errors/cams-error';
import { CamsUserReference } from '@common/cams/users';
import QueryPipeline from '../../../query/query-pipeline';

const { and } = QueryBuilder;
const { descending, first, group, match, pipeline, sort, source } = QueryPipeline;

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

  async getDistinctAssigneesByOffice(officeCode): Promise<CamsUserReference[]> {
    // DistinctAssignee is shaped after the $group stage in the aggregate pipeline
    type DistinctAssignee = {
      _id: string;
      name: string;
    };

    const doc = source<OfficeAssignee>('office-assignment').usingFields(
      'name',
      'officeCode',
      'userId',
    );
    const query = pipeline(
      match(doc.officeCode.equals(officeCode)),
      group([doc.userId], [first(doc.name, doc.name)]),
      sort(descending(doc.name)),
    );
    const results = await this.getAdapter<DistinctAssignee>().aggregate(query);
    return results.map((result) => {
      return {
        id: result._id,
        name: result.name,
      };
    });
  }

  async deleteMany(predicate: OfficeAssigneePredicate): Promise<void> {
    await this.getAdapter<OfficeAssignee>().deleteMany(this.toQuery(predicate));
  }

  toQuery(predicate: OfficeAssigneePredicate) {
    const doc = using<OfficeAssignee>();
    if (predicate.caseId && predicate.userId) {
      return and(doc('userId').equals(predicate.userId), doc('caseId').equals(predicate.caseId));
    } else if (predicate.caseId) {
      return doc('caseId').equals(predicate.caseId);
    } else if (predicate.officeCode) {
      return doc('officeCode').equals(predicate.officeCode);
    } else {
      throw new CamsError(MODULE_NAME, { message: 'Invalid predicate', data: predicate });
    }
  }
}
