import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page);

    function modifiedGoto(url, options) {
      url += (url as string).includes('?') ? '&' : '?'; // checks if query string already exists
      url += 'x-ms-routing-name=staging';
      return goto(url, options);
    }

    page.goto = modifiedGoto; // replace original goto

    await use(page);
  },
});
