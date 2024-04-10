import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page);

    function modifiedGoto(url, options) {
      url += (url as string).includes('?') ? '&' : '?'; // checks if query string already exists
      url += 'x-ms-routing-name=staging';
      return goto(url, options);
    }
    //TODO: When doing an initial deployment we want to be able to test the Production slot
    page.goto = modifiedGoto; // replace original goto

    await use(page);
  },
});
