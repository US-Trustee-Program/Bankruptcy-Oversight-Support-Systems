import { ApplicationContext } from '../adapters/types/basic';
import { Chapter11CaseListDbResult } from '../adapters/types/cases';

export interface Chapter11GatewayInterface {
  getCaseList(
    context: ApplicationContext,
    caseOptions: { chapter: string; professionalId: string },
  ): Promise<Chapter11CaseListDbResult>;
}
