import { ApplicationContext } from '../adapters/types/basic';
import { CaseDetailsDbResult } from '../adapters/types/cases';
import { getCasesGateway } from '../factory';
import { CasesInterface } from './cases.interface';

export default class Chapter15CaseDetail {
  casesGateway: CasesInterface;

  constructor(casesGateway?: CasesInterface) {
    if (!casesGateway) {
      this.casesGateway = getCasesGateway();
    } else {
      this.casesGateway = casesGateway;
    }
  }

  async getChapter15CaseDetail(
    context: ApplicationContext,
    caseId: string,
  ): Promise<CaseDetailsDbResult> {
    const caseDetails = await this.casesGateway.getChapter15Case(context, caseId);
    return {
      success: true,
      message: '',
      body: {
        caseDetails,
      },
    };
  }
}
