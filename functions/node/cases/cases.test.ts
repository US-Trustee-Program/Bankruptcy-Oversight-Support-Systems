import httpTrigger from './cases.function';
import { getProperty } from '../lib/testing/mock-data';
const context = require('../lib/testing/defaultContext');

test('Cases Endpoint should return all cases by default', async () => {
  const request = {
      query: { }
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

/*
test('Users Http trigger should return 1 user record when supplied with "Test" "Person".', async () => {
  const request = {
    query: {
      first_name: 'Test',
      last_name: 'Person'
    }
  };

  const userListRecords = await getProperty('users', 'list');
  const body = userListRecords.userList[0];

  const responseBody = {
    "success": true,
    "message": "user record",
    "count": 1,
    "body": [ body ], 
  }

  await httpTrigger(context, request);

  expect(context.res.body).toEqual(responseBody);
});
*/
