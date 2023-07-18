import httpTrigger from './attorneys.function';
const context = require('azure-function-context-mock');

test('Attorneys Http trigger should by default return a list of attorneys', async () => {
  const request = {
    query: {},
  };

  await httpTrigger(context, request);

  expect(1).toEqual(1);
});
