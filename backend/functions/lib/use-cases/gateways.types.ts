import { CaseDocket } from './case-docket/case-docket.model';
import { ApplicationContext } from '../adapters/types/basic';

export interface CaseDocketGateway {
  getCaseDocket(context: ApplicationContext, caseId: string): Promise<CaseDocket>;
}
