import { ApplicationContext } from '../types/basic';
import { AttorneyUser, CamsUserReference } from '../../../../../common/src/cams/users';
import { Auditable, createAuditRecord } from '../../../../../common/src/cams/auditable';
import { DocumentClient } from '../../mongo-humble-objects/mongo-humble';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { getCamsUserReference } from '../../../../../common/src/cams/session';
import QueryBuilder from '../../query/query-builder';
import { toMongoQuery } from '../../query/mongo-query-renderer';
import { getCamsError } from '../../common-errors/error-utilities';
import { Closable, deferClose } from '../../defer-close';

const MODULE_NAME: string = 'COSMOS_MONGO_DB_REPOSITORY_OFFICES';

const { and, equals, contains } = QueryBuilder;

export type OfficeStaff = CamsUserReference &
  Auditable & {
    documentType: 'OFFICE_STAFF';
    officeCode: string;
    ttl: number;
  };

export class OfficesCosmosMongoDbRepository implements Closable {
  private documentClient: DocumentClient;
  private readonly containerName = 'offices';

  constructor(context: ApplicationContext) {
    this.documentClient = new DocumentClient(context.config.cosmosConfig.mongoDbConnectionString);
    deferClose(context, this);
  }

  async close() {
    await this.documentClient.close();
  }

  async putOfficeStaff(
    context: ApplicationContext,
    officeCode: string,
    user: CamsUserReference,
  ): Promise<void> {
    const ttl = 4500;

    const staff = createAuditRecord<OfficeStaff>({
      id: user.id,
      documentType: 'OFFICE_STAFF',
      officeCode,
      ...user,
      ttl,
    });
    try {
      const collection = this.documentClient
        .database(context.config.documentDbConfig.databaseName)
        .collection<OfficeStaff>(this.containerName);
      collection.insertOne(staff);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async getOfficeAttorneys(
    context: ApplicationContext,
    officeCode: string,
  ): Promise<AttorneyUser[]> {
    const query = toMongoQuery(
      QueryBuilder.build(
        and(
          equals<OfficeStaff['documentType']>('documentType', 'OFFICE_STAFF'),
          contains<OfficeStaff['roles']>('roles', [CamsRole.TrialAttorney]),
          equals<OfficeStaff['officeCode']>('officeCode', officeCode),
        ),
      ),
    );
    const collection = this.documentClient
      .database(context.config.documentDbConfig.databaseName)
      .collection<OfficeStaff>(this.containerName);

    const result = await collection.find(query);

    const officeStaff: OfficeStaff[] = [];
    try {
      for await (const doc of result) {
        officeStaff.push(doc);
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }

    return officeStaff.map((doc) => getCamsUserReference(doc));
  }
}
