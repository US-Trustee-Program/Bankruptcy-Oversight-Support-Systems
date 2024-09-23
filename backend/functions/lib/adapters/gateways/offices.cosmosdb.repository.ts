import { OfficesRepository } from '../../use-cases/gateways.types';
import { ApplicationContext } from '../types/basic';
import { AttorneyUser, CamsUserReference } from '../../../../../common/src/cams/users';
import { CosmosDbRepository } from './cosmos/cosmos.repository';
import { UstpOfficeDetails } from '../../../../../common/src/cams/courts';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { Auditable, createAuditRecord } from '../../../../../common/src/cams/auditable';
import { getCamsUserReference } from '../../../../../common/src/cams/session';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_OFFICES';
const CONTAINER_NAME: string = 'offices';

export type OfficeStaff = CamsUserReference &
  Auditable & {
    documentType: 'OFFICE_STAFF';
    officeCode: string;
    ttl: number;
  };

export class OfficesCosmosDbRepository implements OfficesRepository {
  private officeStaffRepo: CosmosDbRepository<OfficeStaff>;
  private officesRepo: CosmosDbRepository<UstpOfficeDetails>;

  constructor(context: ApplicationContext) {
    this.officeStaffRepo = new CosmosDbRepository<OfficeStaff>(
      context,
      CONTAINER_NAME,
      MODULE_NAME,
    );
    this.officesRepo = new CosmosDbRepository<UstpOfficeDetails>(
      context,
      CONTAINER_NAME,
      MODULE_NAME,
    );
  }
  async putOfficeStaff(
    context: ApplicationContext,
    officeCode: string,
    user: CamsUserReference,
  ): Promise<void> {
    const ttl = 4500; // 75 minutes
    const staff = createAuditRecord<OfficeStaff>({
      id: user.id,
      documentType: 'OFFICE_STAFF',
      officeCode,
      ...user,
      ttl,
    });
    await this.officeStaffRepo.upsert(context, officeCode, staff);
  }

  async getOfficeAttorneys(
    context: ApplicationContext,
    officeCode: string,
  ): Promise<AttorneyUser[]> {
    const query = `SELECT * FROM c WHERE c.officeCode = @officeCode and c.documentType = 'OFFICE_STAFF' and ARRAY_CONTAINS(c.roles, @role)`;
    const querySpec = {
      query,
      parameters: [
        {
          name: '@officeCode',
          value: officeCode,
        },
        {
          name: '@role',
          value: CamsRole.TrialAttorney,
        },
      ],
    };
    const docs = await this.officeStaffRepo.query(context, querySpec);
    return docs.map((doc) => getCamsUserReference(doc));
  }
}
