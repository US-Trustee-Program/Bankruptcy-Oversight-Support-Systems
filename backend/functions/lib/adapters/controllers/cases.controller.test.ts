import { CasesController } from './cases.controller';

const context = require('azure-function-context-mock');

const expectedResult = {
  success: true,
  message: '',
  count: 2,
  body: {
    caseList: [
      {
        caseId: '081-11-06541',
        caseTitle: 'Crawford, Turner and Garrett',
        dateFiled: '2011-05-20',
      },
      {
        caseId: '081-14-03544',
        caseTitle: 'Ali-Cruz',
        dateFiled: '2014-04-23',
      },
    ],
  },
};

jest.mock('../../use-cases/chapter-15.case', () => {
  return {
    default: {
      Chapter15CaseList: jest.fn().mockImplementation(() => {
        return {
          getChapter15CaseList: () => {
            return Promise.resolve(expectedResult);
          },
        };
      }),
    },
  };
});

describe('cases controller test', () => {
  test('Should get list of chapter 15 cases', async () => {
    // jest
    //   .spyOn(chapter15caseList, 'getChapter15CaseList')
    //   .mockReturnValue(Promise.resolve(expectedResult));

    const controller = new CasesController(context);
    const actual = await controller.getCaseList({ caseChapter: '15' });
    expect(actual).toEqual(expectedResult);
  });

  test('Should get case details of chapter 15 case using caseId', async () => {
    const caseId1 = '081-11-06541';
    const caseId2 = '081-14-03544';

    const expectedResult1 = {
      success: true,
      message: '',
      body: {
        caseDetails: {
          caseId: caseId1,
          caseTitle: 'Crawford, Turner and Garrett',
          dateFiled: '05-20-2011',
          dateClosed: '06-21-2011',
          assignments: [],
        },
      },
    };
    const expectedResult2 = {
      success: true,
      message: '',
      body: {
        caseDetails: {
          caseId: caseId2,
          caseTitle: 'Ali-Cruz',
          dateFiled: '04-23-2014',
          dateClosed: '',
          assignments: [],
        },
      },
    };

    const controller = new CasesController(context);

    const actual1 = await controller.getCaseDetails({ caseId: caseId1 });
    expect(actual1).toEqual(expectedResult1);

    const actual2 = await controller.getCaseDetails({ caseId: caseId2 });
    expect(actual2).toEqual(expectedResult2);
  });
});
