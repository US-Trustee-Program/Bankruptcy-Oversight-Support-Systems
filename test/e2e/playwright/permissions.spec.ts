import { expect, Page } from '@playwright/test';
import { test } from './fixture/urlQueryString';
import { logout } from './login/login-helpers';
import { CamsUserWithPermissions, UserRoleAssignment } from '../../../common/src/cams/user-access';

const timeoutOption = { timeout: 60000 };

// Runs as the shared SuperUser account (playwright.config.ts, chromium-superuser). The CAMS users
// come from the real "USTP Cams Users" Okta group; the seed clears user-role-assignments each run.

function isUsersResponse(url: string) {
  return url.includes('api/user-access/users');
}

async function openPermissions(page: Page): Promise<CamsUserWithPermissions[]> {
  await page.goto('/admin');
  await expect(page.locator('.admin-screen-navigation')).toBeVisible(timeoutOption);
  const permissionsLink = page.getByTestId('permissions-nav-link');
  test.skip(
    (await permissionsLink.count()) === 0,
    'cams-role-assignments is off for the SuperUser account',
  );

  const usersResponse = page.waitForResponse(
    (response) => isUsersResponse(response.url()) && response.ok(),
    timeoutOption,
  );
  await permissionsLink.click();
  const users = (await (await usersResponse).json()).data as CamsUserWithPermissions[];
  await expect(page.locator('#cams-users-table')).toBeVisible(timeoutOption);
  return users;
}

async function chooseFirstOption(page: Page, field: 'role' | 'office'): Promise<string> {
  await page.locator(`#add-permission-modal-${field}-combo-box-input`).click();
  const firstOption = page.getByTestId(`add-permission-modal-${field}-option-item-0`);
  await expect(firstOption).toBeVisible(timeoutOption);
  const label = (await firstOption.textContent())?.trim() ?? '';
  await firstOption.click();
  await expect(page.locator(`#add-permission-modal-${field}-item-list`)).toBeHidden();
  return label;
}

function visibleLines(page: Page, userId: string, column: string) {
  return page
    .getByTestId(`cams-user-row-${userId}`)
    .locator(`[data-cell="${column}"] .cams-users__permission-lines li`);
}

test.describe('Administration > Permissions', () => {
  let users: CamsUserWithPermissions[];

  test.beforeEach(async ({ page }) => {
    users = await openPermissions(page);
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('lists the CAMS users from Okta', async ({ page }) => {
    expect(users.length).toBeGreaterThan(0);
    await expect(page.locator('#cams-users-count')).toContainText('CAMS User');
    await expect(page.getByTestId(`cams-user-row-${users[0].id}`)).toContainText(users[0].name);
  });

  test("grants a role in an office and shows it in the user's row", async ({ page }) => {
    // A user without permissions, so a retry grants to someone else instead of hitting a duplicate.
    const user = users.find((candidate) => candidate.permissions.length === 0);
    test.skip(!user, 'Every CAMS user on the first page already has a permission');

    await page.locator(`#add-permission-${user!.id}`).click();
    await expect(page.getByTestId('modal-content-add-permission-modal')).toBeVisible(timeoutOption);
    const roleLabel = await chooseFirstOption(page, 'role');
    const officeLabel = await chooseFirstOption(page, 'office');
    const reason = page.locator('#textarea-add-permission-modal-reason');
    await reason.click();
    await reason.fill('E2E: grant a role in an office');
    await expect(reason).toHaveValue('E2E: grant a role in an office');

    const grantResponse = page.waitForResponse(
      (response) =>
        response.url().includes('api/user-access/assignments') &&
        response.request().method() === 'POST',
      timeoutOption,
    );
    const reloadResponse = page.waitForResponse(
      (response) => isUsersResponse(response.url()) && response.ok(),
      timeoutOption,
    );
    const save = page.getByTestId('button-add-permission-modal-submit-button');
    await expect(save).toBeEnabled();
    await save.click();

    const grant = await grantResponse;
    expect(grant.status()).toBe(201);
    const assignment = (await grant.json()).data as UserRoleAssignment;
    expect(assignment).toEqual(
      expect.objectContaining({ userId: user!.id, active: true, expiresAt: null }),
    );
    await reloadResponse;

    await expect(page.getByTestId('modal-content-add-permission-modal')).toBeHidden(timeoutOption);
    await expect(page.getByText(`New permission successfully added to ${user!.name}.`)).toBeVisible(
      timeoutOption,
    );
    // Office options read "<region> - <office name>".
    const [regionId, officeName] = officeLabel.split(' - ');
    await expect(visibleLines(page, user!.id, 'Role')).toHaveText([roleLabel]);
    await expect(visibleLines(page, user!.id, 'Region')).toHaveText([regionId]);
    await expect(visibleLines(page, user!.id, 'Office')).toHaveText([officeName]);
  });
});
