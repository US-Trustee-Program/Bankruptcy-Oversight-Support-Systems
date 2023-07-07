import { AttorneyPersistenceGateway } from '../adapters/types/persistence.gateway';
import { AttorneyListDbResult } from '../adapters/types/attorneys';
import { Context } from '../adapters/types/basic';

namespace UseCases {
  export class AttorneysList {
    async getAttorneyList(
      context: Context,
      database: AttorneyPersistenceGateway,
      fields: { officeId: string },
    ): Promise<AttorneyListDbResult> {
      let result: AttorneyListDbResult;
      return await database.getAttorneyList(context, fields);
    }
  }
}

export default UseCases.AttorneysList;
