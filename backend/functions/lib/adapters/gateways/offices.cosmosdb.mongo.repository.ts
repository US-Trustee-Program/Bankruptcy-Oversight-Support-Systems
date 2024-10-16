import { ApplicationContext } from '../types/basic';
import { AttorneyUser, CamsUserReference } from '../../../../../common/src/cams/users';
import { Auditable, createAuditRecord } from '../../../../../common/src/cams/auditable';
import { DocumentClient } from '../../mongo-humble-objects/mongo-humble';
import { DocumentQuery } from './document-db.repository';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { getCamsUserReference } from '../../../../../common/src/cams/session';

const MODULE_NAME: string = 'COSMOS_MONGO_DB_REPOSITORY_OFFICES';
//const CONTAINER_NAME: string = 'offices';

export type OfficeStaff = CamsUserReference &
  Auditable & {
    documentType: 'OFFICE_STAFF';
    officeCode: string;
    ttl: number;
  };

export class OfficesCosmosMongoDbRepository {
  private documentClient: DocumentClient;

  constructor(connectionString: string) {
    this.documentClient = new DocumentClient(connectionString);
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
    const collection = this.documentClient.database('cams').collection<OfficeStaff>('offices');
    const result = await collection.insertOne(staff);
    context.logger.info(MODULE_NAME, 'result', result);
    await this.documentClient.close();
  }

  async getOfficeAttorneys(
    context: ApplicationContext,
    officeCode: string,
  ): Promise<AttorneyUser[]> {
    const query: DocumentQuery = {
      and: [
        { documentType: { equals: 'OFFICE_STAFF' } },
        { roles: { contains: [CamsRole.TrialAttorney] } },
        { officeCode: { equals: officeCode } },
      ],
    };

    const collection = this.documentClient.database('cams').collection<OfficeStaff>('offices');
    const result = await collection.find(query);

    const count = await collection.countDocuments(query);
    if (count === 0) {
      context.logger.warn(MODULE_NAME, 'No documents found!');
    }
    const officeStaff: OfficeStaff[] = [];

    for await (const doc of result) {
      officeStaff.push(doc);
      context.logger.info(MODULE_NAME, 'result', doc);
    }
    await this.documentClient.close();

    return officeStaff.map((doc) => getCamsUserReference(doc));
  }
}
