const context = require('azure-function-context-mock');
import { CaseListDbResult, Chapter15Case } from "../adapters/types/cases";
import Chapter15CaseList from './chapter-15-case-list';
import { PacerApiGateway } from "../adapters/gateways/pacer.api.gateway";
import { PacerGatewayInterface } from "./pacer.gateway.interface";
import { getPacerGateway } from "../../factory";
import {jest} from '@jest/globals';



const mockChapterList: CaseListDbResult = {
  success: true,
  message: '',
  count: 0,
  body: {
    caseList: [],
  }
}

describe('Chapter 15 case tests', () => {
  test('Calling getChapter15CaseList should return valid chapter 15 data', async () => {
    const chapter15CaseList = new Chapter15CaseList;
    const expectedResponseValue: Chapter15Case[] = [
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

    const pacerApiGateway = new PacerApiGateway();
    const mockGateway = jest.spyOn(pacerApiGateway, 'getChapter15Cases');
    mockGateway.mockImplementation(async () => {
      return expectedResponseValue
    });

    // jest.mock('../adapters/gateways/pacer.api.gateway');
    // const fakeGetChapter15Cases = jest.fn(async () => {
    //   return expectedResponseValue
    // });
    // jest.mocked(PacerApiGateway).mockImplementation( async () => {
    //   return{
    //     method: fakeGetChapter15Cases
    //   }
    // });

    const results = await chapter15CaseList.getChapter15CaseList(context);

    expect(results).toEqual(mockChapterList);
  });
});
