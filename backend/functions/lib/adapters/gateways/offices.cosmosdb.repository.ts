import { OfficesRepository } from '../../use-cases/gateways.types';
import { ApplicationContext } from '../types/basic';
import { AttorneyUser, CamsUserReference } from '../../../../../common/src/cams/users';
import { CosmosDbRepository } from './cosmos/cosmos.repository';
import { UstpOfficeDetails } from '../../../../../common/src/cams/courts';
import { OfficeStaff } from '../../../../../common/src/cams/staff';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { createAuditRecord } from '../../../../../common/src/cams/auditable';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_OFFICES';
const CONTAINER_NAME: string = 'offices';

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
    const staff = createAuditRecord<OfficeStaff>({
      id: officeCode + ':' + user.id,
      documentType: 'OFFICE_STAFF',
      officeCode,
      user,
    });
    await this.officeStaffRepo.upsert(context, staff.id, officeCode, staff);
  }

  async getOfficeAttorneys(
    context: ApplicationContext,
    officeCode: string,
  ): Promise<AttorneyUser[]> {
    const query = `SELECT * FROM c WHERE c.officeCode = @officeCode and c.documentType = 'OFFICE_STAFF' and ARRAY_CONTAINS(c.user.roles, @role)`;
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
    return docs.map((doc) => doc.user);
  }
}
