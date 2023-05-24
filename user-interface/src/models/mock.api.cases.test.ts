import api from './mock.api.cases';
import { ResponseData } from './api';

type CaseListResponse = {
  message: string;
  count: number;
  body: {
    staff1Label: string;
    staff2Label: string;
    caseList: [];
  };
};

describe('Testing the MockApi', () => {
  it('should return an empty set if supplied with an invalid path', async () => {
    const response: ResponseData = await api.list('/some-random-gibberish');

    expect(response).toStrictEqual({
      message: 'not found',
      count: 0,
      body: {},
    });
  });

  it('should return a list of 13 cases when supplied with the path /cases', async () => {
    const response: CaseListResponse = (await api.list('/cases')) as CaseListResponse;

    expect(response.count).toBe(13);
    expect(response.body.caseList.length).toBe(13);
  });
});
