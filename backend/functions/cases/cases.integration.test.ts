import * as dotenv from 'dotenv';

dotenv.config();

describe('Integration Test for the cases Azure Function to call Chapter15 cases',()=>{
  let functionUrl;
  beforeAll(() => {
    functionUrl = process.env.CASES_FUNCTION_URL;
  });

  test('cases azure function should return success when called with chapter 15',async()=>{
    const _caseChapter= '15';

    let casesResponse;
    await fetch(`${functionUrl}/cases?chapter=${_caseChapter}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    }).then(async (response) => {
      casesResponse = await response.json();
      expect(casesResponse).toEqual(expect.objectContaining({ success: true, message: '' }));
    });
  }, 15000);
});
