import { CaseDocket } from '../../use-cases/case-docket/case-docket.model';

export interface CaseDocketGateway {
  getCaseDocket(caseId: string): Promise<CaseDocket>;
}
