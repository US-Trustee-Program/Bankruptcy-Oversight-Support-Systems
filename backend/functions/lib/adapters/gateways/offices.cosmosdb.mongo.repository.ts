import { ApplicationContext } from '../types/basic';
import { AttorneyUser, CamsUserReference } from '../../../../../common/src/cams/users';
import { Auditable, createAuditRecord } from '../../../../../common/src/cams/auditable';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { getCamsUserReference } from '../../../../../common/src/cams/session';
import QueryBuilder from '../../query/query-builder';
import { getCamsError } from '../../common-errors/error-utilities';
import { OfficesRepository } from '../../use-cases/gateways.types';
import { BaseMongoRepository } from './mongo/base-mongo-repository';

const MODULE_NAME: string = 'COSMOS_MONGO_DB_REPOSITORY_OFFICES';
const COLLECTION_NAME = 'offices';

const { and, equals, contains } = QueryBuilder;

export type OfficeStaff = CamsUserReference &
  Auditable & {
    documentType: 'OFFICE_STAFF';
    officeCode: string;
    ttl: number;
  };

export class OfficesCosmosMongoDbRepository
  extends BaseMongoRepository
  implements OfficesRepository
{
  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
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
