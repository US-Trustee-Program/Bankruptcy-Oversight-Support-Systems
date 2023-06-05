import { CaseListDbResult } from '../adapters/types/cases';

namespace UseCases {

  export class InvalidChapter {

    returnEmptyList(): CaseListDbResult {
      const result = {
        success: false,
        message: 'Invalid Chapter value provided',
        count: 0,
        body: {
          caseList: []
        }
      }
      return result;
    }

  }

}

export default UseCases.InvalidChapter;
