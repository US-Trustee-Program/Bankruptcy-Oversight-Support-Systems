const context = require('azure-function-context-mock');
import { CaseListDbResult, Chapter15Case } from '../adapters/types/cases';
import Chapter15CaseList from './chapter-15-case-list';
import { jest } from '@jest/globals';

describe('Chapter 15 case tests', () => {
  test('Calling getChapter15CaseList should return valid chapter 15 data', async () => {
    const chapter15CaseList = new Chapter15CaseList;
    const caseList: Chapter15Case[] = [
      {
        caseNumber: '04-44449',
        caseTitle: 'Flo Esterly and Neas Van Sampson',
        dateFiled: '2005-05-04',
      },
      {
        caseNumber: '06-1122',
        caseTitle: 'Jennifer Millhouse',
        dateFiled: '2006-03-27',
      }
    ];
    const mockChapterList: CaseListDbResult = {
      success: true,
      message: '',
      count: 0,
      body: {
        caseList,
      }
    }

    jest.spyOn(chapter15CaseList.pacerGateway, 'getChapter15Cases').mockImplementation(async () => {
      return caseList;
    });

    const results = await chapter15CaseList.getChapter15CaseList(context);

    expect(results).toStrictEqual(mockChapterList);
  });
});
