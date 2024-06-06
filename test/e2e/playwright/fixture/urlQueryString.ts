/*
  This fixture changes the behavior of the 'test' module's 'page.goto' including a query string, x-ms-routing-name.
  Import this fixture instead when testing against a slot environment.
*/
import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page);

    function modifiedGoto(url, options) {
      if (!(url as string).includes('localhost')) {
        url += (url as string).includes('?') ? '&' : '?'; // checks if query string already exists
        // TODO: Purpose of this fixture is to include x-ms-routing-name to route traffic to Azure slot environment named 'staging'
        // TODO: Parameterize this to add flexibility target slot environment. Note that passing 'self' will target production slot
        if (url) url += 'x-ms-routing-name=staging';
      }
      console.log('inside the urlQueryString plugin.', page.url() ?? 'NOTHING HERE!!', url);
      return goto(url, options);
    }
    page.goto = modifiedGoto; // replace original goto

    await use(page);
  },
});
