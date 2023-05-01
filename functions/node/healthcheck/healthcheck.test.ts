import httpTrigger from './healthcheck.function';
const context = require('../lib/testing/defaultContext');

/*
test('Http trigger should return known text', async () => {

    const request = {
        query: { name: 'Bill' }
    };

    await httpFunction(context, request);

    expect(context.log.mock.calls.length).toBe(1);
    expect(context.res.body).toEqual('Hello Bill');
});
*/

test('Users Http trigger should by default complain about missing first and last name parameters', async () => {
    const request = {
        query: { }
    };

    await httpTrigger(context, request);

  expect(context.res.body).toEqual({ error: 'Required parameters absent: first_name and last_name.' });
});
