import * as dotenv from 'dotenv';

dotenv.config();

describe('Integration Test for the cases Azure Function to call get cases', () => {
  let functionUrl;
  beforeAll(() => {
    functionUrl = process.env.CASES_FUNCTION_URL;
  });

  test('cases azure function should return success when retrieving cases', async () => {
    let casesResponse;
    await fetch(`${functionUrl}/cases`, {
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
