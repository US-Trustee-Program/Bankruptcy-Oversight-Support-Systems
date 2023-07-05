import * as dotenv from 'dotenv';

dotenv.config();

describe('Integration Test for the cases Azure Function to call Chapter15 cases',()=>{
  let functionUrl;
  beforeAll(() => {
    functionUrl = process.env.CASES_FUNCTION_URL;
  });

  beforeEach(()=> {
    jest.setTimeout(300000);
  });

  test('cases azure function should return success when called with caseChapter 15 and a professionalId',async()=>{
    jest.setTimeout(300000);
    const _caseChapter= '15';
    const _professionalId= '8182';

    let caseList;
    await fetch(`${functionUrl}/cases?chapter=${_caseChapter}&professional_id=${_professionalId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    }).then(async (response) => {
      caseList = await response.json();
      expect(caseList).toEqual(expect.objectContaining({ success: true, message: '' }));
    });
  });
});
