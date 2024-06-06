import { Page, chromium, expect, type FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  const { baseURL } = config.projects[0].use;

  const chromiumBrowser = await chromium.launch();
  const chromiumPage = await chromiumBrowser.newPage();
  await logout(baseURL, chromiumPage);
  chromiumBrowser.close();

  const edgeBrowser = await chromium.launch();
  const edgePage = await edgeBrowser.newPage();
  await logout(baseURL, edgePage);
  edgeBrowser.close();
}

async function logout(baseUrl: string, page: Page) {
  const logoutUrl = `${baseUrl}/logout`;
  await page.goto(logoutUrl);
  await expect(page.getByTestId('alert-message')).toBeVisible();
  await expect(page.getByTestId('button-undefined')).toBeVisible(); //test-id for confirm on prelogin is button-undefined. we should change this
}

export default globalTeardown;
