import { CasePersistenceGateway } from '../adapters/types/persistence.gateway';
import { CaseListDbResult } from '../adapters/types/cases';
import { Context } from '../adapters/types/basic';

namespace UseCases {
  export class Chapter11CaseList {
    async getChapter11CaseList(
      context: Context,
      database: CasePersistenceGateway,
      fields: { chapter: string; professionalId: string },
    ): Promise<CaseListDbResult> {
      let result: CaseListDbResult;
      result = await database.getCaseList(context, fields);
      result.body.staff1Label = 'Trial Attorney';
      result.body.staff2Label = 'Auditor';
      return result;
    }
  }
}

export default UseCases.Chapter11CaseList;
