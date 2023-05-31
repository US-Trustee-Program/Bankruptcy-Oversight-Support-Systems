const context = require('azure-function-context-mock');
import { CaseListRecordSet } from '../adapters/types/cases';
import Chapter15CaseList from './chapter-15-case-list';

const mockChapterList: CaseListRecordSet = {
  staff1Label: '',
  staff2Label: '',
  caseList: [{}],
  initialized: true,
}

describe('Chapter 15 case tests', () => {
  test('Calling getChapter15CaseList should return valid chapter 15 data', async () => {
    const chapter15CaseList = new Chapter15CaseList;
    const results = chapter15CaseList.getChapter15CaseList(context); 

    expect(results).toEqual(mockChapterList);
  });
});
