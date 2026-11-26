import { expect, Page } from '@playwright/test';
import { test } from './fixture/urlQueryString';
import { logout } from './login/login-helpers';
import { CamsUserWithPermissions, UserRoleAssignment } from '../../../common/src/cams/user-access';
import { CamsRole } from '../../../common/src/cams/roles';

const timeoutOption = { timeout: 60000 };

// Runs as the shared SuperUser account (playwright.config.ts, chromium-superuser). The CAMS users
// come from the real "USTP Cams Users" Okta group; the seed clears user-role-assignments each run.

function isUsersResponse(url: string) {
  return url.includes('api/user-access/users');
}

async function openPermissions(page: Page): Promise<CamsUserWithPermissions[]> {
  await page.goto('/admin');
  await expect(
    page.locator('.admin-screen-navigation'),
    'the e2e user should hold Super User from superuser-setup',
  ).toBeVisible(timeoutOption);
  const permissionsLink = page.getByTestId('permissions-nav-link');
  await expect(
    permissionsLink,
    'cams-role-assignments must be on for the e2e SuperUser',
  ).toBeVisible(timeoutOption);

  const usersResponse = page.waitForResponse(
    (response) => isUsersResponse(response.url()) && response.ok(),
    timeoutOption,
  );
  await permissionsLink.click();
  const users = (await (await usersResponse).json()).data as CamsUserWithPermissions[];
  await expect(page.locator('#cams-users-table')).toBeVisible(timeoutOption);
  return users;
}

// Picks Trial Attorney by value, not by position: an unscoped role such as Super User hides the
// Region and Office picker, which this office-scoped grant needs.
async function chooseTrialAttorney(page: Page): Promise<string> {
  await page.locator('#add-permission-modal-role-combo-box-input').click();
  const option = page.locator(
    `#add-permission-modal-role-item-list li[data-value="${CamsRole.TrialAttorney}"]`,
  );
  await expect(option).toBeVisible(timeoutOption);
  const label = (await option.textContent())?.trim() ?? '';
  await option.click();
  await expect(page.locator('#add-permission-modal-role-item-list')).toBeHidden();
  return label;
}

// Picks a real office, never the "All Regions" or "Region N - All Offices" wide-scope entries
// (always listed first; see toScopeOptions in AddPermissionModal.tsx), so the grant is scoped to
// one office as the test name promises.
async function chooseAnOffice(page: Page): Promise<{ regionId: string; officeName: string }> {
  await page.locator('#add-permission-modal-office-combo-box-input').click();
  const option = page
    .locator(
      '#add-permission-modal-office-item-list li[data-value]' +
        ':not([data-value="all"]):not([data-value^="region-"])',
    )
    .first();
  await expect(option).toBeVisible(timeoutOption);
  const label = (await option.textContent())?.trim() ?? '';
  await option.click();
  await expect(page.locator('#add-permission-modal-office-item-list')).toBeHidden();
  // Option labels read "Region <id> - <office name>" (scopeLabel in common/cams/user-access.ts).
  const match = label.match(/^Region (\S+) - (.+)$/);
  expect(match, `unexpected office option label: "${label}"`).not.toBeNull();
  const [, regionId, officeName] = match!;
  return { regionId, officeName };
}

// A user without permissions, so a retry grants to someone else instead of hitting a duplicate.
// The seed clears every assignment, so finding none means the seed did not run.
function userWithoutPermissions(users: CamsUserWithPermissions[]): CamsUserWithPermissions {
  const user = users.find((candidate) => candidate.permissions.length === 0);
  expect(user, 'the seed should leave CAMS users without permissions').toBeDefined();
  return user!;
}

/** Grants Trial Attorney in one office from the Add Permission modal and waits for the reload. */
async function grantTrialAttorneyInAnOffice(page: Page, user: CamsUserWithPermissions) {
  await page.locator(`#add-permission-${user.id}`).click();
  await expect(page.getByTestId('modal-content-add-permission-modal')).toBeVisible(timeoutOption);
  const roleLabel = await chooseTrialAttorney(page);
  const { regionId, officeName } = await chooseAnOffice(page);

  const grantResponse = page.waitForResponse(
    (response) =>
      /\/api\/user-access\/users\/.+\/permissions\/.+/.test(response.url()) &&
      response.request().method() === 'PUT',
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
  const { permission } = (await grant.json()).data as { permission: UserRoleAssignment };
  expect(permission).toEqual(expect.objectContaining({ userId: user.id, active: true }));
  await reloadResponse;
  await expect(page.getByTestId('modal-content-add-permission-modal')).toBeHidden(timeoutOption);

  return { permission, roleLabel, regionId, officeName };
}

/**
 * Sends DELETE for a permission with the same API host and Authorization header the page uses, read
 * from a fresh users request.
 */
async function removeThroughApi(page: Page, permission: UserRoleAssignment) {
  const usersRequest = page.waitForRequest((request) => isUsersResponse(request.url()));
  await page.reload();
  const request = await usersRequest;
  const apiRoot = request.url().slice(0, request.url().indexOf('/user-access/'));
  const path = [
    'users',
    permission.userId,
    'permissions',
    permission.role,
    permission.regionId ?? 'all',
    permission.officeCode ?? 'all',
  ]
    .map(encodeURIComponent)
    .join('/');
  const response = await page.request.delete(`${apiRoot}/user-access/${path}`, {
    headers: { authorization: (await request.allHeaders())['authorization'] ?? '' },
  });
  return { status: response.status() };
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
    const user = userWithoutPermissions(users);
    const { roleLabel, regionId, officeName } = await grantTrialAttorneyInAnOffice(page, user);

    await expect(page.getByText(`New permission successfully added to ${user.name}.`)).toBeVisible(
      timeoutOption,
    );
    await expect(visibleLines(page, user.id, 'Role')).toHaveText([roleLabel]);
    await expect(visibleLines(page, user.id, 'Region')).toHaveText([regionId]);
    await expect(visibleLines(page, user.id, 'Office')).toHaveText([officeName]);
  });

  // CAMS-941 Slice 1. Removes through the API until the Remove Permission button exists (S1.2).
  test("removes a permission and the user's row no longer shows it", async ({ page }) => {
    const user = userWithoutPermissions(users);
    const { permission } = await grantTrialAttorneyInAnOffice(page, user);

    const { status } = await removeThroughApi(page, permission);
    expect(status).toBe(204);

    const reloaded = await openPermissions(page);
    const row = reloaded.find((candidate) => candidate.id === user.id);
    expect(row?.permissions).toEqual([]);
    await expect(visibleLines(page, user.id, 'Role')).toHaveCount(0);
  });
});
