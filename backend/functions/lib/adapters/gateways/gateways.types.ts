import { CaseDocket, CaseDocketEntryDocument } from '../../use-cases/case-docket/case-docket.model';
import { ApplicationContext } from '../types/basic';

export interface CaseDocketGateway {
  getCaseDocket(context: ApplicationContext, caseId: string): Promise<CaseDocket>;
  getCaseDocketDocuments(
    context: ApplicationContext,
    caseId: string,
  ): Promise<CaseDocketEntryDocument[]>;
}
