import httpTrigger from './cases.function';
import { getProperty } from '../lib/testing/mock-data';
const context = require('../lib/testing/defaultContext');

describe('Standard case list tests without class mocks', () => {
  test('Cases Endpoint should return all cases by default', async () => {
    const request = {
      query: {}
    };

    await httpTrigger(context, request);

    const caseListRecords = await getProperty('cases', 'list');
    const body = {
      staff1Label: "Trial Attorney",
      staff2Label: "Auditor",
      caseList: caseListRecords.caseList,
    };

    const responseBody = {
      "success": true,
      "message": "cases list",
      "count": caseListRecords.caseList.length,
      "body": body,
    }

    expect(context.res.body).toEqual(responseBody);
    expect(context.res.body.body.caseList.length).toEqual(body.caseList.length);
  });

  test('An invalid chapter parameter should return 0 cases successfully', async () => {
    const request = {
      query: {
        chapter: '00',
      }
    };

    const responseBody = {
      "success": true,
      "message": "cases list",
      "count": 0,
      "body": {
        staff1Label: 'Trial Attorney',
        staff2Label: 'Auditor',
        caseList: []
      }
    };

    await httpTrigger(context, request);

    expect(context.res.body).toEqual(responseBody);
  });

  test('A chapter parameter of "11", should return 5 chapter 11 cases successfully', async () => {
    const request = {
      query: {
        chapter: '11',
      }
    };

    await httpTrigger(context, request);

    expect(context.res.body.count).toEqual(5);
    expect(context.res.body.body.staff1Label).toEqual('Trial Attorney');
    expect(context.res.body.body.staff2Label).toEqual('Auditor');

    context.res.body.body.caseList.forEach(obj => {
      expect(obj.currentCaseChapter).toEqual('11');
    });
  });

  test('A professional_id parameter of A1 should return 5 cases successfully', async () => {
    const request = {
      query: {
        professional_id: 'A1',
      }
    };

    await httpTrigger(context, request);

    expect(context.res.body.count).toEqual(5);

    context.res.body.body.caseList.forEach(obj => {
      expect(obj.staff1ProfCode).toEqual('A1');
    });
  });

  test('A professional_id parameter of A2 should return 4 cases successfully', async () => {
    const request = {
      query: {
        professional_id: 'A2',
      }
    };

    await httpTrigger(context, request);

    expect(context.res.body.count).toEqual(4);

    context.res.body.body.caseList.forEach(obj => {
      expect(obj.staff1ProfCode).toEqual('A2');
    });
  });

  test('A professional_id parameter of B1 should return 3 cases successfully', async () => {
    const request = {
      query: {
        professional_id: 'B1',
      }
    };

    await httpTrigger(context, request);

    expect(context.res.body.count).toEqual(3);

    context.res.body.body.caseList.forEach(obj => {
      expect(obj.staff2ProfCode).toEqual('B1');
    });
  });

  test('A professional_id parameter of B2 should return 7 cases successfully', async () => {
    const request = {
      query: {
        professional_id: 'B2',
      }
    };

    await httpTrigger(context, request);

    expect(context.res.body.count).toEqual(7);

    context.res.body.body.caseList.forEach(obj => {
      expect(obj.staff2ProfCode).toEqual('B2');
    });
  });

  test('A professional_id parameter of B2 and chapter of 11 should return 4 cases successfully', async () => {
    const request = {
      query: {
        chapter: '11',
        professional_id: 'B2',
      }
    };

    await httpTrigger(context, request);

    expect(context.res.body.count).toEqual(3);
  });

  test('A body containing professional_id of B2 and chapter of 11 should return 4 cases successfully', async () => {
    const request = {
      query: {},
      body: {
        chapter: '11',
        professional_id: 'B2',
      }
    };

    await httpTrigger(context, request);

    expect(context.res.body.count).toEqual(3);
  });

  test('A professional_id parameter of B2 and chapter of 7A should return 1 case successfully', async () => {
    const request = {
      query: {
        chapter: '7A',
        professional_id: 'B2',
      }
    };

    await httpTrigger(context, request);

    expect(context.res.body.count).toEqual(1);
  });
});

/*
describe('getCase() test', () => {
  test('Requesting a single specific case should return 1 case record', async () => {
    const request = {
      query: {
        caseId: '403',
      }
    }

    const caseListRecords = await getProperty('cases', 'list');
    const body = {
      caseList: caseListRecords.caseList,
    };

    const responseBody = {
      "success": true,
      "message": "cases list",
      "count": caseListRecords.caseList.length,
      "body": body,
    }

    const result = {

    }

    await httpTrigger(context, request);

    expect(context.res.body).toEqual(result);
  })
});
*/
