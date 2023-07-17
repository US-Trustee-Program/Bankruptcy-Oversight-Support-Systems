import { ApplicationContext } from '../adapters/types/basic';
import { CaseListDbResult } from '../adapters/types/cases';
import { Chapter11GatewayInterface } from './chapter-11.gateway.interface';
import { getChapter11Gateway } from '../factory';

namespace UseCases {
  export class Chapter11CaseList {
    gateway: Chapter11GatewayInterface;

    constructor(gateway?: Chapter11GatewayInterface) {
      if (!gateway) {
        this.gateway = getChapter11Gateway();
      } else {
        this.gateway = gateway;
      }
    }

    async getChapter11CaseList(
      context: ApplicationContext,
      fields: { chapter: string; professionalId: string },
    ): Promise<CaseListDbResult> {
      let result: CaseListDbResult;
      result = await this.gateway.getCaseList(context, fields);
      result.body.staff1Label = 'Trial Attorney';
      result.body.staff2Label = 'Auditor';
      return result;
    }
  }
}

export default UseCases.Chapter11CaseList;
