import { CaseListDbResult } from '../adapters/types/cases';

export class InvalidChapterCaseList {
  returnInvalidChapterResponse(): CaseListDbResult {
    const result = {
      success: false,
      message: 'Invalid Chapter value provided',
      count: 0,
      body: {
        caseList: [],
      },
    };
    return result;
  }
}

export default InvalidChapterCaseList;
