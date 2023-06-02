import { CaseListDbResult } from '../adapters/types/cases';
import { Context } from '../adapters/types/basic';
import { getChapter15Cases } from '../adapters/gateways/pacer.gateway';
import { pacerToChapter15Data } from '../interfaces/chapter-15-data-interface';

namespace UseCases {

  export class Chapter15CaseList {

    async getChapter15CaseList(context: Context): Promise<CaseListDbResult> {
      let result: CaseListDbResult;

      // connect to API via PACER gateway
      // get chapter 15 records from pacer
      const cases = await pacerToChapter15Data(await getChapter15Cases());

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
