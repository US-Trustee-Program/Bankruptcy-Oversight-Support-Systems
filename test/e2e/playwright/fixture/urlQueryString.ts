/*
  This fixture changes the behavior of the 'test' module's 'page.goto' including a query string, x-ms-routing-name.
  Import this fixture instead when testing against a slot environment.
*/
import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page);

    function modifiedGoto(url: string, options: unknown) {
      if (!url.includes('localhost') && url.length > 0) {
        url += (url as string).includes('?') ? '&' : '?'; // checks if query string already exists
        // Use SLOT_NAME environment variable to route traffic to the specified Azure slot environment
        // Note that passing 'self' will target production slot
        const slotName =
          process.env.SLOT_NAME ||
          (() => {
            throw new Error('SLOT_NAME environment variable is required for E2E tests');
          })();
        if (url) {
          url += `x-ms-routing-name=${slotName}`;
        }
      }
      return goto(url, options);
    }

    page.goto = modifiedGoto; // replace original goto

    await use(page);
  },
});
