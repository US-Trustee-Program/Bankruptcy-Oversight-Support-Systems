import * as dotenv from 'dotenv';

dotenv.config();

describe('Integration Test for the cases Azure Function to call get cases', () => {
  let functionUrl;
  let slotName;
  beforeAll(() => {
    functionUrl = process.env.CASES_FUNCTION_URL;
    if (process.env.IS_SLOTS == 'true') {
      slotName = 'staging';
    } else {
      slotName = 'self';
    }
  });

  test('cases azure function should return success when retrieving cases', async () => {
    let casesResponse;
    const targetURL = `${functionUrl}/cases?x-ms-routing-name=${slotName}`;
    await fetch(targetURL, {
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
