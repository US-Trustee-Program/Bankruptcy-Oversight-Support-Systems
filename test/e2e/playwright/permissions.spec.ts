import { expect, Page, Response } from '@playwright/test';
import { test } from './fixture/urlQueryString';
import { logout } from './login/login-helpers';
import {
  CamsUserWithPermissions,
  PermissionChange,
  UserRoleAssignment,
} from '../../../common/src/cams/user-access';
import { CamsRole } from '../../../common/src/cams/roles';
import { SUPERUSER_OKTA_USER_ID, SUPERUSER_OKTA_USER_NAME } from './superuser';
import { grantSuperUser, revokePermission } from './login/superuser-access';

const timeoutOption = { timeout: 60000 };

// Runs as the shared SuperUser account (playwright.config.ts, chromium-superuser). The CAMS users
// come from the real "USTP Cams Users" Okta group; the seed clears user-role-assignments each run.

// The users list, not a grant or removal: their paths also start with api/user-access/users.
function isUsersListResponse(response: Response) {
  return (
    response.request().method() === 'GET' &&
    response.url().includes('api/user-access/users') &&
    response.ok()
  );
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

  const usersResponse = page.waitForResponse(isUsersListResponse, timeoutOption);
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
async function grantTrialAttorneyInAnOffice(
  page: Page,
  user: CamsUserWithPermissions,
  // 200 means the user already held it, e.g. on a retry that grants the same user again.
  expectedStatuses: number[] = [201],
) {
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
  const reloadResponse = page.waitForResponse(isUsersListResponse, timeoutOption);
  const save = page.getByTestId('button-add-permission-modal-submit-button');
  await expect(save).toBeEnabled();
  await save.click();

  const grant = await grantResponse;
  expect(expectedStatuses).toContain(grant.status());
  const { permission } = (await grant.json()).data as { permission: UserRoleAssignment };
  expect(permission).toEqual(expect.objectContaining({ userId: user.id, active: true }));
  await reloadResponse;
  await expect(page.getByTestId('modal-content-add-permission-modal')).toBeHidden(timeoutOption);

  return { permission, roleLabel, regionId, officeName };
}

/** Removes a permission from the user's row through the Remove Permission modal. */
async function removeFromRow(page: Page, user: CamsUserWithPermissions, permissionId: string) {
  await page.locator(`#remove-permission-${permissionId}`).click();
  await expect(page.getByTestId('modal-content-remove-permission-modal')).toBeVisible(
    timeoutOption,
  );
  await expect(page.getByTestId('modal-remove-permission-modal')).toContainText(
    `This will remove ${user.name}'s`,
  );

  const removeResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/permissions/${encodeURIComponent(permissionId)}`) &&
      response.request().method() === 'DELETE',
    timeoutOption,
  );
  const reloadResponse = page.waitForResponse(isUsersListResponse, timeoutOption);
  await page.getByTestId('button-remove-permission-modal-submit-button').click();
  expect((await removeResponse).status()).toBe(204);
  await reloadResponse;

  await expect(page.getByTestId('modal-content-remove-permission-modal')).toBeHidden(timeoutOption);
}

// One row per permission (a user with none has one row); this column's cell in each of the user's
// rows. Compare with useInnerText, which leaves out the labels the stacked layout shows.
function permissionCells(page: Page, userId: string, column: 'role' | 'region' | 'office') {
  return page
    .locator(`[data-testid="cams-user-row-${userId}"], [data-testid^="cams-user-row-${userId}-"]`)
    .locator(`.col-${column}`);
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
    const innerText = { useInnerText: true };
    await expect(permissionCells(page, user.id, 'role')).toHaveText([roleLabel], innerText);
    await expect(permissionCells(page, user.id, 'region')).toHaveText([regionId], innerText);
    await expect(permissionCells(page, user.id, 'office')).toHaveText([officeName], innerText);
  });

  // CAMS-941 Slice 1.
  test("removes a permission and the user's row no longer shows it", async ({ page }) => {
    const user = userWithoutPermissions(users);
    const { permission } = await grantTrialAttorneyInAnOffice(page, user);

    await removeFromRow(page, user, permission.id);

    await expect(page.getByText(`Permission successfully removed from ${user.name}.`)).toBeVisible(
      timeoutOption,
    );
    await expect(permissionCells(page, user.id, 'role')).toHaveText([''], { useInnerText: true });
    await expect(page.locator(`#add-permission-${user.id}`)).toBeFocused();
  });

  // CAMS-941 Slice 3: "A change appears right away". Tests run one at a time (workers: 1), so the
  // removal is the newest change. Retry-safe: a retry picks a user who still has no permissions and
  // checks only that user's rows, never a row count.
  test('shows a removal first on Change History, with its grant below it', async ({ page }) => {
    const user = userWithoutPermissions(users);
    const { permission, regionId, officeName } = await grantTrialAttorneyInAnOffice(page, user);
    await removeFromRow(page, user, permission.id);

    const changesResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        response.url().includes('api/user-access/changes') &&
        response.ok(),
      timeoutOption,
    );
    await page.locator('#permissions-tabs').getByRole('link', { name: 'Change History' }).click();
    const changes = (await (await changesResponse).json()).data as PermissionChange[];

    const [removal, grant] = changes;
    const snapshot = {
      role: CamsRole.TrialAttorney,
      regionId: permission.regionId,
      officeCode: permission.officeCode,
    };
    expect(removal).toEqual(
      expect.objectContaining({
        kind: 'removed',
        assignmentId: permission.id,
        userId: user.id,
        previous: snapshot,
        next: null,
        performedBy: SUPERUSER_OKTA_USER_ID,
      }),
    );
    expect(grant).toEqual(
      expect.objectContaining({
        kind: 'granted',
        assignmentId: permission.id,
        userId: user.id,
        previous: null,
        next: snapshot,
      }),
    );

    // The screen shows the same two rows, in that order, at the top of the table.
    const rows = page.locator('#change-history-table .cams-table__body .cams-table__row');
    await expect(rows.first()).toHaveAttribute('data-testid', `change-row-${removal.auditId}`, {
      timeout: timeoutOption.timeout,
    });
    await expect(rows.nth(1)).toHaveAttribute('data-testid', `change-row-${grant.auditId}`);
    const scope = `Trial Attorney, Region ${regionId} - ${officeName}`;
    const cell = (row: number, column: string) => rows.nth(row).locator(`.col-${column}`);
    const innerText = { useInnerText: true };
    await expect(cell(0, 'user')).toContainText(user.name, innerText);
    await expect(cell(0, 'previous')).toContainText(scope, innerText);
    await expect(cell(0, 'new')).toContainText('(none)', innerText);
    await expect(cell(0, 'changed-by')).toContainText(removal.performedByName, innerText);
    await expect(cell(1, 'previous')).toContainText('(none)', innerText);
    await expect(cell(1, 'new')).toContainText(scope, innerText);
  });

  // CAMS-941 Slice 2.
  test('offers removal of your own permissions except Super User, which the API refuses', async ({
    page,
  }) => {
    // Filter to the signed-in account, which may not be on the first page. Only the filtered
    // response counts: an unfiltered reload would not prove the account is listed. Okta may list
    // the account as "E2E Test" or "Test, E2E", so filter on the part both contain and match by id.
    const nameFilter = 'E2E';
    const filtered = page.waitForResponse(
      (response) =>
        isUsersListResponse(response) &&
        new URL(response.url()).searchParams.get('name') === nameFilter,
      timeoutOption,
    );
    await page.locator('#cams-users-name-filter').fill(nameFilter);
    const filteredResponse = await filtered;
    const listed = ((await filteredResponse.json()).data as CamsUserWithPermissions[]).find(
      (candidate) => candidate.id === SUPERUSER_OKTA_USER_ID,
    );
    // The account must be in the Okta CAMS users group (USTP Cams Users) to be listed at all; the
    // Super User grant in Mongo alone does not list it (CI run 46029550302 failed this way).
    expect(listed, 'the e2e account should be in the Okta CAMS users group').toBeDefined();
    const self = listed!;
    const superUserPermission = self.permissions.find((p) => p.role === CamsRole.SuperUser);
    expect(superUserPermission, 'the e2e account should hold Super User').toBeDefined();

    // A throwaway permission the account may remove itself; 200 covers a retry after a failed
    // cleanup. The finally block removes it in Mongo if the test stops before the API does.
    const { permission, roleLabel } = await grantTrialAttorneyInAnOffice(page, self, [200, 201]);
    const { authorization } = await filteredResponse.request().allHeaders();
    const usersUrl = new URL(filteredResponse.url());
    const removeOwn = (permissionId: string) =>
      page.request.delete(
        `${usersUrl.origin}${usersUrl.pathname}/${encodeURIComponent(self.id)}/permissions/` +
          encodeURIComponent(permissionId),
        { headers: { authorization } },
      );
    try {
      // The account's rows are on screen, so the absent Remove button below means something.
      await expect(permissionCells(page, self.id, 'role')).toContainText([roleLabel], {
        useInnerText: true,
      });
      await expect(page.locator(`#remove-permission-${permission.id}`)).toBeVisible();
      await expect(page.locator(`#remove-permission-${superUserPermission!.id}`)).toHaveCount(0);
      await expect(page.locator(`#add-permission-${self.id}`)).toBeEnabled();

      // Send the Super User removal straight to the API with the page's own credentials.
      const refused = await removeOwn(superUserPermission!.id);
      expect(refused.status()).toBe(400);
      expect(await refused.json()).toEqual(
        expect.objectContaining({
          message: 'You cannot remove your own Super User permission.',
          status: 400,
        }),
      );

      // Nothing was written: the Super User permission is still active.
      const reread = await page.request.get(filteredResponse.url(), { headers: { authorization } });
      expect(reread.ok()).toBe(true);
      const after = ((await reread.json()).data as CamsUserWithPermissions[]).find(
        (candidate) => candidate.id === self.id,
      );
      expect(after?.permissions.map((p) => p.id)).toContain(superUserPermission!.id);

      // The account's other permissions it may remove.
      expect((await removeOwn(permission.id)).status()).toBe(204);
    } finally {
      await revokePermission(self.id, permission.id);
      // A broken guard would have taken the shared account's Super User, failing every later test
      // in the run; put it back (a no-op while it is still held).
      await grantSuperUser(SUPERUSER_OKTA_USER_ID, SUPERUSER_OKTA_USER_NAME);
    }
  });
});
