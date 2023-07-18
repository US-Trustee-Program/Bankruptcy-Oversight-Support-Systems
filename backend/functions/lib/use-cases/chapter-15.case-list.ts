import { ApplicationContext, ObjectKeyVal } from '../adapters/types/basic';
import { CaseListDbResult } from '../adapters/types/cases';
import { getPacerGateway } from '../factory';
import { CasesInterface } from './cases.interface';

export class Chapter15CaseList {
  pacerGateway: CasesInterface;

  constructor(pacerGateway?: CasesInterface) {
    if (!pacerGateway) {
      this.pacerGateway = getPacerGateway();
    } else {
      this.pacerGateway = pacerGateway;
    }
  }

  async getChapter15CaseList(context: ApplicationContext): Promise<CaseListDbResult> {
    try {
      let startingMonth = parseInt(process.env.STARTING_MONTH);
      if (startingMonth > 0) {
        startingMonth = 0 - startingMonth;
      }
      const cases = await this.pacerGateway.getChapter15Cases(context, startingMonth || undefined);

      return {
        success: true,
        message: '',
        count: cases?.length,
        body: {
          caseList: cases as ObjectKeyVal[],
        },
      };
    } catch (e) {
      const message = (e as Error).message;
      return {
        success: false,
        message: message && message.length ? message : 'Unknown Error received from PACER server',
        count: 0,
        body: {
          caseList: [],
        },
      };
    }
  }
}

export default Chapter15CaseList;
