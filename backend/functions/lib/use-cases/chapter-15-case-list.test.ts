const context = require('azure-function-context-mock');
import { CaseListDbResult } from '../adapters/types/cases';
import Chapter15CaseList from './chapter-15-case-list';

const mockChapterList: CaseListDbResult = {
  success: true,
  message: '',
  count: 0,
  body: {
    caseList: [],
  }
}

describe('Chapter 15 case tests', () => {
  xtest('Calling getChapter15CaseList should return valid chapter 15 data', async () => {
    const chapter15CaseList = new Chapter15CaseList;
    const results = await chapter15CaseList.getChapter15CaseList(context);

    expect(results).toEqual(mockChapterList);
  });
});
