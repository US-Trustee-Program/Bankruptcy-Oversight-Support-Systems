import httpStart from './client/trigger.function';
import { HttpRequest, InvocationContext } from '@azure/functions';

describe.skip('migration tests', () => {
  test('should call things', async () => {
    const context = new InvocationContext();
    const request = new HttpRequest({
      body: { string: '{"chapters":["12","15"],"divisionCodes":["071","081"]}' },
      url: 'http://localhost:7071/migration',
      method: 'POST',
    });
    await httpStart(request, context);
  });
});
