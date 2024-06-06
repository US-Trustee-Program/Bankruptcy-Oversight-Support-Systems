import { Page, chromium, expect, type FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;

  const chromiumBrowser = await chromium.launch();
  const chromiumPage = await chromiumBrowser.newPage();
  console.log(baseURL);
  await login(baseURL, chromiumPage);
  chromiumBrowser.close();

  const edgeBrowser = await chromium.launch({
    channel: 'msedge',
  });
  const edgePage = await edgeBrowser.newPage();
  await login(baseURL, edgePage);
  edgeBrowser.close();
}

async function login(baseUrl: string, page: Page) {
  const loginUrl = `${baseUrl}/login`;
  await page.goto(loginUrl);
  await page.getByTestId('button-undefined').click(); //test-id for confirm on prelogin is button-undefined. we should change this
  await expect(page.getByTestId('modal-content-login-modal')).toBeVisible();
  await page.getByTestId('radio-role-0-click-target').click();
  await page.getByTestId('button-login-modal-submit-button').click();
  await expect(page.getByTestId('modal-content-login-modal')).not.toBeVisible();
}

export default globalSetup;
