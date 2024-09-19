import { OfficesRepository } from '../../use-cases/gateways.types';
import { ApplicationContext } from '../types/basic';
import { AttorneyUser, CamsUserReference } from '../../../../../common/src/cams/users';
import { CosmosDbRepository } from './cosmos/cosmos.repository';
import { UstpOfficeDetails } from '../../../../../common/src/cams/courts';
import { CamsRole } from '../../../../../common/src/cams/roles';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_OFFICES';
const CONTAINER_NAME: string = 'offices';

export class OfficesCosmosDbRepository implements OfficesRepository {
  private officeStaffRepo: CosmosDbRepository<CamsUserReference>;
  private officesRepo: CosmosDbRepository<UstpOfficeDetails>;

  constructor(context: ApplicationContext) {
    this.officeStaffRepo = new CosmosDbRepository<CamsUserReference>(
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
    return await this.officeStaffRepo.query(context, querySpec);
  }
}
