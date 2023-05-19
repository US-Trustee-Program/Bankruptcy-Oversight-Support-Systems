import httpTrigger from './healthcheck.function';
const context = require('../lib/testing/defaultContext');

test('Users Http trigger should by default complain about missing first and last name parameters', async () => {
    const request = {
        query: {}
    };

    await httpTrigger(context, request);

    expect(context.res.body).toEqual({ status: 'ALIVE' });
});
