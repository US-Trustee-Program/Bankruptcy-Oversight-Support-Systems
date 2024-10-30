import { ApplicationContext } from '../types/basic';
import { AttorneyUser, CamsUserReference } from '../../../../../common/src/cams/users';
import { Auditable, createAuditRecord } from '../../../../../common/src/cams/auditable';
import { DocumentClient } from '../../humble-objects/mongo-humble';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { getCamsUserReference } from '../../../../../common/src/cams/session';
import QueryBuilder from '../../query/query-builder';
import { getCamsError } from '../../common-errors/error-utilities';
import { deferClose } from '../../defer-close';
import { OfficesRepository } from '../../use-cases/gateways.types';
import { MongoCollectionAdapter } from './mongo/mongo-adapter';

const MODULE_NAME: string = 'COSMOS_MONGO_DB_REPOSITORY_OFFICES';
const COLLECTION_NAME = 'offices';

const { and, equals, contains } = QueryBuilder;

export type OfficeStaff = CamsUserReference &
  Auditable & {
    documentType: 'OFFICE_STAFF';
    officeCode: string;
    ttl: number;
  };

export class OfficesCosmosMongoDbRepository implements OfficesRepository {
  private readonly client: DocumentClient;
  private readonly databaseName: string;

  constructor(context: ApplicationContext) {
    const { connectionString, databaseName } = context.config.documentDbConfig;
    this.databaseName = databaseName;
    this.client = new DocumentClient(connectionString);
    deferClose(context, this.client);
  }

  private getAdapter<T>() {
    return MongoCollectionAdapter.newAdapter<T>(
      MODULE_NAME,
      COLLECTION_NAME,
      this.databaseName,
      this.client,
    );
  }

  async putOfficeStaff(officeCode: string, user: CamsUserReference): Promise<void> {
    const ttl = 4500;
    const staff = createAuditRecord<OfficeStaff>({
      id: user.id,
      documentType: 'OFFICE_STAFF',
      officeCode,
      ...user,
      ttl,
    });
    try {
      await this.getAdapter<OfficeStaff>().insertOne(staff);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async getOfficeAttorneys(officeCode: string): Promise<AttorneyUser[]> {
    const query = QueryBuilder.build(
      and(
        equals<OfficeStaff['documentType']>('documentType', 'OFFICE_STAFF'),
        contains<OfficeStaff['roles']>('roles', [CamsRole.TrialAttorney]),
        equals<OfficeStaff['officeCode']>('officeCode', officeCode),
      ),
    );

    try {
      const result = await this.getAdapter<AttorneyUser>().find(query);
      return result.map((doc) => getCamsUserReference(doc));
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
