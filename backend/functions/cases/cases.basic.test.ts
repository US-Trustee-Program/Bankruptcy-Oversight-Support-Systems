import httpTrigger from './cases.function';

const context = require('azure-function-context-mock');

describe('Standard case list tests without class mocks', () => {
  test('Should return 0 cases successfully when an invalid chapter parameter is provided', async () => {
    const request = {
      query: {
        chapter: '00',
      },
    };

    const responseBody = {
      success: false,
      message: 'Invalid Chapter value provided',
      count: 0,
      body: {
        caseList: [],
      },
    };

    await httpTrigger(context, request);

    expect(context.res.body).toEqual(responseBody);
  });
});
