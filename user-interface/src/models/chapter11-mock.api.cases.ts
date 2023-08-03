import { ResponseData } from '../type-declarations/api';
import Api from './api';

interface ApiOptions {
  professional_id?: string | number;
  chapter?: string;
}
export default class MockApi extends Api {
  public static async list(path: string, options?: ApiOptions): Promise<ResponseData> {
    let response: ResponseData;
    let caseList: object[];

    const profId = options?.professional_id;
    switch (path) {
      case '/cases':
        caseList = MockApi.caseList;

        if (profId) {
          caseList = MockApi.caseList.filter((caseRecord) => {
            if (`${profId}`.length > 0) {
              return [caseRecord.staff1ProfId, caseRecord.staff1ProfId].includes(`${profId}`);
            }
          });
        }

        response = {
          message: 'cases list',
          count: MockApi.caseList.length,
          body: {
            staff1Label: 'Trial Attorney',
            staff2Label: 'Auditor',
            caseList: caseList,
          },
        };
        break;
      default:
        response = {
          message: 'not found',
          count: 0,
          body: {},
        };
    }
    return Promise.resolve(response);
  }

  static caseList = [
    {
      currentCaseChapter: '11',
      caseNumber: '22-90677',
      debtor1Name: 'Lisa Ross                     ',
      currentChapterFileDate: 20220103,
      staff1ProfId: '1',
      staff1ProfName: 'Ashley Rodriguez',
      staff1ProfTypeDescription: 'STAFF MEMBER        ',
      staff2ProfId: '2',
      staff2ProfName: 'Sierra Montes',
      staff2ProfTypeDescription: 'STAFF MEMBER        ',
      hearingDate: 20220114,
      hearingTime: 1030,
      hearingCode: 'IDI',
      hearingDisposition: 'HELD',
    },
    {
      currentCaseChapter: '11',
      caseNumber: '22-91967',
      debtor1Name: 'Jason Cooper                  ',
      currentChapterFileDate: 20220130,
      staff1ProfId: '1',
      staff1ProfName: 'Ashley Rodriguez',
      staff1ProfTypeDescription: 'STAFF MEMBER        ',
      staff2ProfId: '2',
      staff2ProfName: 'Sierra Montes',
      staff2ProfTypeDescription: 'STAFF MEMBER        ',
      hearingDate: 20220215,
      hearingTime: 1030,
      hearingCode: 'IDI',
      hearingDisposition: 'HELD',
    },
    {
      currentCaseChapter: '11',
      caseNumber: '22-93124',
      debtor1Name: 'Brandon Jimenez               ',
      currentChapterFileDate: 20220218,
      staff1ProfId: '1',
      staff1ProfName: 'Ashley Rodriguez',
      staff1ProfTypeDescription: 'STAFF MEMBER        ',
      staff2ProfId: '2',
      staff2ProfName: 'Sierra Montes',
      staff2ProfTypeDescription: 'STAFF MEMBER        ',
      hearingDate: 20220301,
      hearingTime: 1500,
      hearingCode: 'IDI',
      hearingDisposition: 'HELD',
    },
    {
      currentCaseChapter: '11',
      caseNumber: '22-93526',
      debtor1Name: 'Amy Yates                     ',
      currentChapterFileDate: 20220225,
      staff1ProfId: '3',
      staff1ProfName: 'B C',
      staff1ProfTypeDescription: 'STAFF MEMBER        ',
      staff2ProfId: '4',
      staff2ProfName: 'D E',
      staff2ProfTypeDescription: 'STAFF MEMBER        ',
      hearingDate: 20220315,
      hearingTime: 1030,
      hearingCode: 'IDI',
      hearingDisposition: 'HELD',
    },
    {
      currentCaseChapter: '11',
      caseNumber: '22-94369',
      debtor1Name: 'Jacqueline Colon              ',
      currentChapterFileDate: 20220314,
      staff1ProfId: '1',
      staff1ProfName: 'Ashley Rodriguez',
      staff1ProfTypeDescription: 'STAFF MEMBER        ',
      staff2ProfId: '4',
      staff2ProfName: 'D E',
      staff2ProfTypeDescription: 'STAFF MEMBER        ',
      hearingDate: 20220330,
      hearingTime: 1030,
      hearingCode: 'IDI',
      hearingDisposition: 'HELD',
    },
    {
      currentCaseChapter: '11',
      caseNumber: '22-96360',
      debtor1Name: 'Tracy Pena                    ',
      currentChapterFileDate: 20220421,
      staff1ProfId: '5',
      staff1ProfName: 'E F',
      staff1ProfTypeDescription: 'STAFF MEMBER        ',
      staff2ProfId: '4',
      staff2ProfName: 'D E',
      staff2ProfTypeDescription: 'STAFF MEMBER        ',
      hearingDate: 20220506,
      hearingTime: 1030,
      hearingCode: 'IDI',
      hearingDisposition: 'HELD',
    },
    {
      currentCaseChapter: '11',
      caseNumber: '22-98134',
      debtor1Name: 'Mary Harrington               ',
      currentChapterFileDate: 20220523,
      staff1ProfId: '3',
      staff1ProfName: 'B C',
      staff1ProfTypeDescription: 'STAFF MEMBER        ',
      staff2ProfId: '4',
      staff2ProfName: 'D E',
      staff2ProfTypeDescription: 'STAFF MEMBER        ',
      hearingDate: 20220715,
      hearingTime: 1130,
      hearingCode: 'IDI',
      hearingDisposition: ' ',
    },
    {
      currentCaseChapter: '11',
      caseNumber: '22-98073',
      debtor1Name: 'Kristina Castaneda PhD        ',
      currentChapterFileDate: 20220522,
      staff1ProfId: '1',
      staff1ProfName: 'Ashley Rodriguez',
      staff1ProfTypeDescription: 'STAFF MEMBER        ',
      staff2ProfId: '3',
      staff2ProfName: 'B C',
      staff2ProfTypeDescription: 'STAFF MEMBER        ',
      hearingDate: 20220610,
      hearingTime: 1030,
      hearingCode: 'IDI',
      hearingDisposition: 'HELD',
    },
    {
      currentCaseChapter: '11',
      caseNumber: '22-99573',
      debtor1Name: 'Michele Mendez                ',
      currentChapterFileDate: 20220622,
      staff1ProfId: '1',
      staff1ProfName: 'Ashley Rodriguez',
      staff1ProfTypeDescription: 'STAFF MEMBER        ',
      staff2ProfId: '2',
      staff2ProfName: 'Sierra Montes',
      staff2ProfTypeDescription: 'STAFF MEMBER        ',
      hearingDate: 0,
      hearingTime: 0,
      hearingCode: '   ',
      hearingDisposition: ' ',
    },
    {
      currentCaseChapter: '11',
      caseNumber: '22-05595',
      debtor1Name: 'Kimberly Williams             ',
      currentChapterFileDate: 20221018,
      staff1ProfId: '1',
      staff1ProfName: 'Ashley Rodriguez',
      staff1ProfTypeDescription: 'STAFF MEMBER        ',
      staff2ProfId: '2',
      staff2ProfName: 'Sierra Montes',
      staff2ProfTypeDescription: 'STAFF MEMBER        ',
      hearingDate: 20221101,
      hearingTime: 1030,
      hearingCode: 'IDI',
      hearingDisposition: 'HELD',
    },
    {
      currentCaseChapter: '11',
      caseNumber: '22-06711',
      debtor1Name: 'John Logan                    ',
      currentChapterFileDate: 20221107,
      staff1ProfId: '1',
      staff1ProfName: 'Ashley Rodriguez',
      staff1ProfTypeDescription: 'STAFF MEMBER        ',
      staff2ProfId: '2',
      staff2ProfName: 'Sierra Montes',
      staff2ProfTypeDescription: 'STAFF MEMBER        ',
      hearingDate: 20221129,
      hearingTime: 1030,
      hearingCode: 'IDI',
      hearingDisposition: 'HELD',
    },
    {
      currentCaseChapter: '11',
      caseNumber: '22-06814',
      debtor1Name: 'Kristin Mann                  ',
      currentChapterFileDate: 20221110,
      staff1ProfId: '5',
      staff1ProfName: 'E F',
      staff1ProfTypeDescription: 'STAFF MEMBER        ',
      staff2ProfId: '6',
      staff2ProfName: 'G H',
      staff2ProfTypeDescription: 'STAFF MEMBER        ',
      hearingDate: 20221118,
      hearingTime: 1500,
      hearingCode: 'IDI',
      hearingDisposition: 'HELD',
    },
    {
      currentCaseChapter: '11',
      caseNumber: '22-07022',
      debtor1Name: 'Danielle Harrison             ',
      currentChapterFileDate: 20221115,
      staff1ProfId: '5',
      staff1ProfName: 'E F',
      staff1ProfTypeDescription: 'STAFF MEMBER        ',
      staff2ProfId: '6',
      staff2ProfName: 'G H',
      staff2ProfTypeDescription: 'STAFF MEMBER        ',
      hearingDate: 20221207,
      hearingTime: 1030,
      hearingCode: 'IDI',
      hearingDisposition: ' ',
    },
  ];
}
