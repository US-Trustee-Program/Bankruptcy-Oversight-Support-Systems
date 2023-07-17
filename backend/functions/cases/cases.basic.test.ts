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

  test('Should return 5 chapter 11 cases successfully when a chapter parameter of "11" is supplied', async () => {
    const request = {
      query: {
        chapter: '11',
      },
    };

    await httpTrigger(context, request);

    expect(context.res.body.count).toEqual(5);
    expect(context.res.body.body.staff1Label).toEqual('Trial Attorney');
    expect(context.res.body.body.staff2Label).toEqual('Auditor');

    context.res.body.body.caseList.forEach((obj) => {
      expect(obj.currentCaseChapter).toEqual('11');
    });
  });

  test('should return 2 cases successfully when a professional_id parameter of A1 is supplied and chapter is 11', async () => {
    const request = {
      query: {
        chapter: '11',
        professional_id: 'A1',
      },
    };

    await httpTrigger(context, request);

    expect(context.res.body.count).toEqual(2);

    context.res.body.body.caseList.forEach((obj) => {
      expect(obj.staff1ProfCode).toEqual('A1');
    });
  });

  test('should return 3 cases successfully when a professional_id parameter of A2 is supplied and chapter is 11', async () => {
    const request = {
      query: {
        chapter: '11',
        professional_id: 'A2',
      },
    };

    await httpTrigger(context, request);

    expect(context.res.body.count).toEqual(3);

    context.res.body.body.caseList.forEach((obj) => {
      expect(obj.staff1ProfCode).toEqual('A2');
    });
  });

  test('should return 2 cases successfully when a professional_id parameter of B1 is supplied and chapter is 11', async () => {
    const request = {
      query: {
        chapter: '11',
        professional_id: 'B1',
      },
    };

    await httpTrigger(context, request);

    expect(context.res.body.count).toEqual(2);

    context.res.body.body.caseList.forEach((obj) => {
      expect(obj.staff2ProfCode).toEqual('B1');
    });
  });

  test('should return 3 cases successfully when a professional_id parameter of B2 is supplied and chapter is 11', async () => {
    const request = {
      query: {
        chapter: '11',
        professional_id: 'B2',
      },
    };

    await httpTrigger(context, request);

    expect(context.res.body.count).toEqual(3);

    context.res.body.body.caseList.forEach((obj) => {
      expect(obj.staff2ProfCode).toEqual('B2');
    });
  });

  test('should return 4 cases successfully when a professional_id parameter of B2 and chapter of 11 are supplied', async () => {
    const request = {
      query: {
        chapter: '11',
        professional_id: 'B2',
      },
    };

    await httpTrigger(context, request);

    expect(context.res.body.count).toEqual(3);
  });

  test('should return 4 cases successfully when a body containing professional_id of B2 and chapter of 11 are supplied', async () => {
    const request = {
      query: {},
      body: {
        chapter: '11',
        professional_id: 'B2',
      },
    };

    await httpTrigger(context, request);

    expect(context.res.body.count).toEqual(3);
  });
});
