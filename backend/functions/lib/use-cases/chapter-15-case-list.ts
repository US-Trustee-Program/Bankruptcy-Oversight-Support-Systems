import { CaseListDbResult } from '../adapters/types/cases';
import { Context } from '../adapters/types/basic';
import { getChapter15Cases } from '../adapters/gateways/pacer.gateway';

namespace UseCases {

  export class Chapter15CaseList {

    async getChapter15CaseList(context: Context): Promise<CaseListDbResult> {
      let result: CaseListDbResult;

      const cases = await getChapter15Cases();
      // connect to API via PACER gateway
      // get chapter 15 records from pacer
      // build CaseListDbResult object
      // return results
      return {
        success: true,
        message: '',
        count: 0,
        body: {
          caseList: [],
        }
      }
    }

  }

}

export default UseCases.Chapter15CaseList;
