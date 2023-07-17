import { CasePersistenceGateway } from '../adapters/types/persistence.gateway';
import { CaseListDbResult } from '../adapters/types/cases';
import { ApplicationContext } from '../adapters/types/basic';

export class Chapter11CaseList {
  async getChapter11CaseList(
    context: ApplicationContext,
    database: CasePersistenceGateway,
    fields: { chapter: string; professionalId: string },
  ): Promise<CaseListDbResult> {
    const result: CaseListDbResult = await database.getCaseList(context, fields);
    result.body.staff1Label = 'Trial Attorney';
    result.body.staff2Label = 'Auditor';
    return result;
  }
}

export default Chapter11CaseList;
