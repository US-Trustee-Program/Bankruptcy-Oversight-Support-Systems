import httpTrigger from './cases.function';
import { getProperty } from '../lib/testing/mock-data';
const context = require('../lib/testing/defaultContext');

describe('Standard case list tests without class mocks', () => {
  test('Cases Endpoint should return all cases by default', async () => {
    const request = {
      query: {}
    };

    const caseListRecords = await getProperty('cases', 'list');
    const caseList = [...caseListRecords.caseList].splice(0, 20);
    const body = {
      staff1Label: "Trial Attorney",
      staff2Label: "Auditor",
      caseList: caseList,
    };

    const responseBody = {
      "success": true,
      "message": "cases list",
      "count": caseList.length,
      "body": body,
    }

    await httpTrigger(context, request);

    expect(context.res.body).toEqual(responseBody);
    expect(context.res.body.body.caseList.length).toEqual(body.caseList.length);
  });

  test('Should return 0 cases successfully when an invalid chapter parameter is provided', async () => {
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

  test('Should return 5 chapter 11 cases successfully when a chapter parameter of "11" is supplied', async () => {
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

  test('should return 5 cases successfully when a professional_id parameter of A1 is supplied', async () => {
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

  test('should return 4 cases successfully when a professional_id parameter of A2 is supplied', async () => {
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

  test('should return 3 cases successfully when a professional_id parameter of B1 is supplied', async () => {
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

  test('should return 7 cases successfully when a professional_id parameter of B2 is supplied', async () => {
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

  test('should return 4 cases successfully when a professional_id parameter of B2 and chapter of 11 are supplied', async () => {
    const request = {
      query: {
        chapter: '11',
        professional_id: 'B2',
      }
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
      }
    };

    await httpTrigger(context, request);

    expect(context.res.body.count).toEqual(3);
  });

  test('should return 1 case successfully when a professional_id parameter of B2 and chapter of 7A are supplied', async () => {
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
