import httpTrigger from './healthcheck.function';
const context = require('../lib/testing/default-context');

test('Healthcheck endpoint should return an ALIVE status', async () => {
  const request = {
    query: {},
  };

  await httpTrigger(context, request);

  expect(context.res.body).toEqual({ status: 'ALIVE' });
});
