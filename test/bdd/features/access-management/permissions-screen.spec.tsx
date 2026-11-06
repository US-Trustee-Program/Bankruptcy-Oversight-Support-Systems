import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initializeTestServer, cleanupTestServer } from '../../helpers/api-server';
import { TestSessions } from '../../fixtures/auth.fixtures';
import { TestSetup, waitForAppLoad } from '../../helpers/fluent-test-setup';
import { clearAllRepositorySpies } from '../../helpers/repository-spies';
import { CamsSession } from '@common/cams/session';
import { CamsRole, CamsRoleType } from '@common/cams/roles';
import { CamsUserReference } from '@common/cams/users';
import { UserRoleAssignment } from '@common/cams/user-access';
import { MOCKED_USTP_OFFICE_DATA_MAP } from '@common/cams/test-utilities/offices.mock';

// ALWAYS import driver mocks
import '../../helpers/driver-mocks';

/**
 * Feature: IT SuperUser grants a role in an office (CAMS-940, Slice 1) — Permissions screen
 *
 * Full stack: React UI -> Express API -> use case -> repositories (spied, backed by TestState).
 * Scenarios: SLICE 1 in superuser-grants-role.feature. API-only rules (audit-failure logging,
 * paging contract) are in user-access-api.spec.tsx.
 */

const MANHATTAN = MOCKED_USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_2_Office_Manhattan')!;
const BUFFALO = MOCKED_USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_2_Office_Buffalo')!;
const SEATTLE = MOCKED_USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_18_Office_Seattle')!;

const SARAH: CamsUserReference = {
  id: 'okta-sarah',
  name: 'Sarah Williams',
  email: 'sarah.williams@example.com',
};
const ALEX: CamsUserReference = { id: 'okta-alex', name: 'Alex Brown', email: 'alex@example.com' };

const MODAL_ID = 'add-permission-modal';
const ROLE_ID = `${MODAL_ID}-role`;
const OFFICE_ID = `${MODAL_ID}-office`;
const REASON =
  'New hire - Trial Attorney for Manhattan. Request forwarded by supervisor John Davis.';
const PERMISSIONS_ROUTE = '/admin/permissions/cams-users';

function permission(
  userId: string,
  office: { regionId: string; officeCode: string },
  role: CamsRoleType = CamsRole.TrialAttorney,
): UserRoleAssignment {
  return {
    documentType: 'USER_ROLE_ASSIGNMENT',
    id: `${userId}-${role}-${office.officeCode}`,
    userId,
    userName: 'stored name',
    role,
    regionId: office.regionId,
    officeCode: office.officeCode,
    assignedBy: 'seed',
    assignedByName: 'Seed',
    assignedAt: '2026-10-01T00:00:00.000Z',
    expiresAt: null,
    active: true,
    activeKey: `${role}|${office.regionId}|${office.officeCode}`,
  };
}

async function openPermissionsAs(
  session: CamsSession,
  assignments: UserRoleAssignment[] = [],
  flagOn = true,
) {
  const view = await TestSetup.forUser(session)
    .withFeatureFlag('cams-role-assignments', flagOn)
    .withOffices([SEATTLE, MANHATTAN, BUFFALO])
    .withCamsUsers([SARAH, ALEX])
    .withRoleAssignments(assignments)
    .renderAt(PERMISSIONS_ROUTE);
  await waitForAppLoad();
  return view;
}

const USER_IDS: Record<string, string> = { [SARAH.name]: SARAH.id, [ALEX.name]: ALEX.id };

function rowFor(name: string) {
  return screen.getByTestId(`cams-user-row-${USER_IDS[name]}`);
}

function cellLines(name: string, column: string) {
  return Array.from(
    rowFor(name).querySelectorAll(`[data-cell="${column}"] .cams-users__permission-lines li`),
    (line) => line.textContent,
  );
}

function modal() {
  return screen.getByTestId(`modal-${MODAL_ID}`);
}

async function openAddPermissionFor(name: string) {
  await userEvent.click(document.querySelector(`#add-permission-${USER_IDS[name]}`)!);
  await waitFor(() => expect(modal()).toHaveClass('is-visible'));
}

async function expandOptions(comboBoxId: string) {
  await userEvent.click(document.querySelector(`#${comboBoxId}-expand`)!);
  return Array.from(
    document.querySelectorAll(`[data-testid^="${comboBoxId}-option-item-"]`),
  ) as HTMLElement[];
}

async function choose(comboBoxId: string, label: string) {
  const option = (await expandOptions(comboBoxId)).find((item) => item.textContent === label);
  if (!option) throw new Error(`No "${label}" option in ${comboBoxId}`);
  await userEvent.click(option);
}

function typeReason(reason: string) {
  fireEvent.change(document.querySelector(`#textarea-${MODAL_ID}-reason`)!, {
    target: { value: reason },
  });
}

async function fillInTrialAttorneyInManhattan() {
  await choose(ROLE_ID, 'Trial Attorney');
  await choose(OFFICE_ID, '2 - Manhattan');
  typeReason(REASON);
}

const saveButton = () => screen.getByTestId(`button-${MODAL_ID}-submit-button`);

describe('Feature: IT SuperUser grants a role in an office (Permissions screen)', () => {
  beforeAll(async () => {
    await initializeTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer();
  });

  afterEach(async () => {
    await clearAllRepositorySpies();
  });

  /**
   * Scenario: The Permissions tab lists every CAMS user with their permissions
   */
  test('should list every CAMS user with their permissions', async () => {
    await openPermissionsAs(TestSessions.superUser(), [
      permission(SARAH.id, SEATTLE),
      permission(SARAH.id, MANHATTAN, CamsRole.Auditor),
    ]);

    expect(
      within(screen.getByRole('navigation', { name: 'Permissions' })).getByRole('link', {
        name: 'CAMS Users',
      }),
    ).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByRole('heading', { name: '2 CAMS Users' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Name',
      'Email',
      'Role',
      'Region',
      'Office',
      'Actions',
    ]);
    const rowIds = Array.from(document.querySelectorAll('[data-testid^="cams-user-row-"]'), (row) =>
      row.getAttribute('data-testid'),
    );
    expect(rowIds).toEqual([`cams-user-row-${ALEX.id}`, `cams-user-row-${SARAH.id}`]);
    expect(cellLines('Sarah Williams', 'Role')).toEqual(['Auditor', 'Trial Attorney']);
    expect(cellLines('Sarah Williams', 'Region')).toEqual(['2', '18']);
    expect(cellLines('Sarah Williams', 'Office')).toEqual(['Manhattan', 'Seattle']);
    expect(cellLines('Alex Brown', 'Role')).toEqual([]);
    expect(document.querySelector(`#add-permission-${SARAH.id}`)).toBeInTheDocument();
    expect(document.querySelector(`#add-permission-${ALEX.id}`)).toBeInTheDocument();
  });

  /**
   * Scenario: IT SuperUser grants Trial Attorney in the Manhattan office
   */
  test('should grant Trial Attorney in the Manhattan office', async () => {
    const maria = TestSessions.superUser();
    const state = await openPermissionsAs(maria);
    await screen.findByRole('heading', { name: '2 CAMS Users' });

    await openAddPermissionFor('Sarah Williams');
    expect(
      within(modal()).getByRole('heading', { name: 'Add Permission to Sarah Williams' }),
    ).toBeInTheDocument();
    await fillInTrialAttorneyInManhattan();
    await userEvent.click(saveButton());

    await waitFor(() => expect(modal()).toHaveClass('is-hidden'));
    expect(
      await screen.findByText('New permission successfully added to Sarah Williams.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(cellLines('Sarah Williams', 'Role')).toEqual(['Trial Attorney']));
    expect(cellLines('Sarah Williams', 'Region')).toEqual(['2']);
    expect(cellLines('Sarah Williams', 'Office')).toEqual(['Manhattan']);

    expect(state.getRoleAssignments()).toEqual([
      expect.objectContaining({
        userId: SARAH.id,
        role: CamsRole.TrialAttorney,
        officeCode: MANHATTAN.officeCode,
        assignedBy: maria.user.id,
        expiresAt: null,
        active: true,
      }),
    ]);
    expect(state.getRoleAssignmentAudits()).toEqual([
      expect.objectContaining({ action: 'CREATED', performedBy: maria.user.id, reason: REASON }),
    ]);
  });

  /**
   * Scenario: Roles and offices are shown by their human-readable names
   */
  test('should offer roles and offices by their human-readable names', async () => {
    await openPermissionsAs(TestSessions.superUser());
    await screen.findByRole('heading', { name: '2 CAMS Users' });
    await openAddPermissionFor('Sarah Williams');

    const roles = (await expandOptions(ROLE_ID)).map((option) => option.textContent);
    expect(roles).toEqual(
      expect.arrayContaining(['Case Assignment Manager', 'Trial Attorney', 'Lead Trial Attorney']),
    );
    expect(roles).toContain('Super User');
    expect(roles).not.toContain('Privileged Identity User');

    // Region 18 has one office here, so it has no "All offices" option.
    const offices = (await expandOptions(OFFICE_ID)).map((option) => option.textContent);
    expect(offices).toEqual([
      'All regions',
      '2 - All offices',
      '2 - Buffalo',
      '2 - Manhattan',
      '18 - Seattle',
    ]);
  });

  /**
   * Scenario: Save is disabled until every field is filled in
   */
  test('should keep Save disabled until every field is filled in', async () => {
    await openPermissionsAs(TestSessions.superUser());
    await screen.findByRole('heading', { name: '2 CAMS Users' });
    await openAddPermissionFor('Sarah Williams');

    expect(saveButton()).toBeDisabled();
    await choose(ROLE_ID, 'Trial Attorney');
    expect(saveButton()).toBeDisabled();
    await choose(OFFICE_ID, '2 - Manhattan');
    expect(saveButton()).toBeDisabled();
    typeReason('   ');
    expect(saveButton()).toBeDisabled();
    typeReason(REASON);
    expect(saveButton()).toBeEnabled();
  });

  /**
   * Scenario: Backing out of the modal saves nothing
   */
  test('should save nothing when Maria cancels', async () => {
    const state = await openPermissionsAs(TestSessions.superUser());
    await screen.findByRole('heading', { name: '2 CAMS Users' });
    await openAddPermissionFor('Sarah Williams');
    await fillInTrialAttorneyInManhattan();

    await userEvent.click(screen.getByTestId(`button-${MODAL_ID}-cancel-button`));

    await waitFor(() => expect(modal()).toHaveClass('is-hidden'));
    expect(state.getRoleAssignments()).toEqual([]);
    expect(state.getRoleAssignmentAudits()).toEqual([]);
  });

  /**
   * Scenario: Saving shows progress
   */
  test('should show progress while the grant is saving', async () => {
    await openPermissionsAs(TestSessions.superUser());
    await screen.findByRole('heading', { name: '2 CAMS Users' });
    const { UserRoleAssignmentMongoRepository } =
      await import('../../../../backend/lib/adapters/gateways/mongo/user-role-assignment.mongo.repository');
    let finishSave: () => void = () => {};
    vi.spyOn(UserRoleAssignmentMongoRepository.prototype, 'create').mockImplementation(
      (assignment) =>
        new Promise((resolve) => {
          finishSave = () => resolve(assignment);
        }),
    );
    await openAddPermissionFor('Sarah Williams');
    await fillInTrialAttorneyInManhattan();

    await userEvent.click(saveButton());

    await waitFor(() =>
      expect(document.querySelector(`#${MODAL_ID}-saving`)).toHaveTextContent(
        'Adding permission...',
      ),
    );
    expect(saveButton()).toBeDisabled();
    finishSave();
    await waitFor(() => expect(modal()).toHaveClass('is-hidden'));
  });

  /**
   * Scenario: A failed grant is explained in the modal
   */
  test('should keep the modal open and explain a failed grant', async () => {
    const state = await openPermissionsAs(TestSessions.superUser());
    await screen.findByRole('heading', { name: '2 CAMS Users' });
    const { UserRoleAssignmentMongoRepository } =
      await import('../../../../backend/lib/adapters/gateways/mongo/user-role-assignment.mongo.repository');
    vi.spyOn(UserRoleAssignmentMongoRepository.prototype, 'create').mockRejectedValue(
      new Error('Cosmos unavailable'),
    );
    await openAddPermissionFor('Sarah Williams');
    await fillInTrialAttorneyInManhattan();

    await userEvent.click(saveButton());

    expect(
      await within(modal()).findByText('Unable to save permission. Please try again'),
    ).toBeInTheDocument();
    expect(modal()).toHaveClass('is-visible');
    await waitFor(() => expect(saveButton()).toBeEnabled());
    expect(document.querySelector(`#textarea-${MODAL_ID}-reason`)).toHaveValue(REASON);
    expect(document.querySelector(`#${ROLE_ID}-combo-box-input`)).toHaveValue('Trial Attorney');
    expect(document.querySelector(`#${OFFICE_ID}-combo-box-input`)).toHaveValue('2 - Manhattan');
    expect(cellLines('Sarah Williams', 'Role')).toEqual([]);
    expect(state.getRoleAssignmentAudits()).toEqual([]);
  });

  /**
   * Scenario: Only SuperUsers can use the capability
   */
  test('should not offer Permissions to a user without the SuperUser role', async () => {
    await TestSetup.forUser(TestSessions.caseAssignmentManager())
      .withFeatureFlag('cams-role-assignments')
      .renderAt(PERMISSIONS_ROUTE);
    await waitForAppLoad();

    expect(
      await screen.findByText(/do not have permission to use the administrative tools/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('permissions-nav-link')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  test('should not offer Permissions while cams-role-assignments is off', async () => {
    await openPermissionsAs(TestSessions.superUser(), [], false);

    expect(await screen.findByRole('heading', { name: 'Administration' })).toBeInTheDocument();
    expect(screen.queryByTestId('permissions-nav-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cams-users-panel')).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // SLICE 2: Finding users (name and email filters, empty states)
  // ---------------------------------------------------------------------------

  describe('finding users', () => {
    const SARAH_LEE: CamsUserReference = {
      id: 'okta-sarah-lee',
      name: 'Sarah Lee',
      email: 'sarah.lee@other.gov',
    };
    const rowIds = () =>
      Array.from(document.querySelectorAll('[data-testid^="cams-user-row-"]'), (row) =>
        row.getAttribute('data-testid'),
      );

    async function openCamsUsers() {
      await TestSetup.forUser(TestSessions.superUser())
        .withFeatureFlag('cams-role-assignments')
        .withOffices([SEATTLE, MANHATTAN, BUFFALO])
        .withCamsUsers([SARAH, ALEX, SARAH_LEE])
        .withRoleAssignments([])
        .renderAt(PERMISSIONS_ROUTE);
      await waitForAppLoad();
      expect(await screen.findByRole('heading', { name: '3 CAMS Users' })).toBeInTheDocument();
    }

    /**
     * Scenario: Filter by CAMS User Name as you type
     */
    test('should filter by CAMS User Name as Maria types', async () => {
      await openCamsUsers();

      await userEvent.type(screen.getByLabelText('CAMS User Name'), 'williams');

      expect(await screen.findByRole('heading', { name: '1 CAMS User' })).toBeInTheDocument();
      expect(rowIds()).toEqual([`cams-user-row-${SARAH.id}`]);
    });

    /**
     * Scenario: Filter by Email as you type
     */
    test('should filter by Email as Maria types', async () => {
      await openCamsUsers();

      await userEvent.type(screen.getByLabelText('Email'), '  sarah.williams@ ');

      expect(await screen.findByRole('heading', { name: '1 CAMS User' })).toBeInTheDocument();
      expect(rowIds()).toEqual([`cams-user-row-${SARAH.id}`]);
    });

    /**
     * Scenario: Filters combine
     */
    test('should show only users matching both filters', async () => {
      await openCamsUsers();

      await userEvent.type(screen.getByLabelText('CAMS User Name'), 'Sarah');
      expect(await screen.findByRole('heading', { name: '2 CAMS Users' })).toBeInTheDocument();
      await userEvent.type(screen.getByLabelText('Email'), 'other.gov');

      expect(await screen.findByRole('heading', { name: '1 CAMS User' })).toBeInTheDocument();
      expect(rowIds()).toEqual([`cams-user-row-${SARAH_LEE.id}`]);
    });

    /**
     * Scenario: Empty state caused by filtering
     */
    test('should say so when the filters match no users', async () => {
      await openCamsUsers();

      await userEvent.type(screen.getByLabelText('CAMS User Name'), 'zz');

      expect(
        await screen.findByText('No CAMS users match your search criteria.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // SLICE 3: broader grants and replaced permissions on the screen
  // ---------------------------------------------------------------------------

  /**
   * Scenario: A broader grant replaces the narrower ones it covers (screen)
   */
  test('should grant a whole region, name the replaced permission and show the result', async () => {
    await openPermissionsAs(TestSessions.superUser(), [permission(SARAH.id, MANHATTAN)]);
    await screen.findByRole('heading', { name: '2 CAMS Users' });
    await openAddPermissionFor('Sarah Williams');

    await choose(ROLE_ID, 'Trial Attorney');
    await choose(OFFICE_ID, '2 - All offices');
    typeReason(REASON);
    await userEvent.click(saveButton());

    expect(
      await screen.findByText(
        'New permission successfully added to Sarah Williams. Their existing Region 2, Manhattan permission was replaced by Region 2, All.',
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(cellLines('Sarah Williams', 'Office')).toEqual(['All']));
    expect(cellLines('Sarah Williams', 'Region')).toEqual(['2']);
  });

  /**
   * Scenario: Grant the Super User role, which has no scope (screen)
   */
  test('should hide Region and Office for Super User and grant it', async () => {
    await openPermissionsAs(TestSessions.superUser());
    await screen.findByRole('heading', { name: '2 CAMS Users' });
    await openAddPermissionFor('Sarah Williams');

    await choose(ROLE_ID, 'Super User');

    expect(document.querySelector(`#${OFFICE_ID}`)).not.toBeInTheDocument();
    typeReason(REASON);
    await userEvent.click(saveButton());
    await waitFor(() => expect(cellLines('Sarah Williams', 'Role')).toEqual(['Super User']));
    expect(cellLines('Sarah Williams', 'Region')).toEqual(['All']);
    expect(cellLines('Sarah Williams', 'Office')).toEqual(['All']);
  });
});
