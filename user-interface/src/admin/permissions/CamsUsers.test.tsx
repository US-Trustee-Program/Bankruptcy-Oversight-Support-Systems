import { forwardRef, useImperativeHandle } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import Api2 from '@/lib/models/api2';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsRole, CamsRoleType } from '@common/cams/roles';
import { UstpOfficeDetails } from '@common/cams/offices';
import { CamsUserWithPermissions, UserRoleAssignment } from '@common/cams/user-access';
import { MOCKED_USTP_OFFICE_DATA_MAP } from '@common/cams/test-utilities/offices.mock';
import { CamsUsers } from './CamsUsers';
import type { AddPermissionModalProps } from './AddPermissionModal';
import type { RemovePermissionModalProps } from './RemovePermissionModal';

const MANHATTAN = MOCKED_USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_2_Office_Manhattan')!;
const BUFFALO = MOCKED_USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_2_Office_Buffalo')!;

const modalShow = vi.fn();
let modalProps: AddPermissionModalProps | undefined;
vi.mock('./AddPermissionModal', () => ({
  AddPermissionModal: forwardRef(function MockModal(props: AddPermissionModalProps, ref) {
    modalProps = props;
    useImperativeHandle(ref, () => ({ show: modalShow }));
    return <div data-testid="mocked-add-permission-modal" />;
  }),
}));

const removeModalShow = vi.fn();
let removeModalProps: RemovePermissionModalProps | undefined;

vi.mock('./RemovePermissionModal', () => ({
  RemovePermissionModal: forwardRef(function MockRemoveModal(
    props: RemovePermissionModalProps,
    ref,
  ) {
    removeModalProps = props;
    useImperativeHandle(ref, () => ({ show: removeModalShow }));
    return <div data-testid="mocked-remove-permission-modal" />;
  }),
}));

function permission(
  office: { regionId: string; officeCode: string } | null,
  role: CamsRoleType = CamsRole.TrialAttorney,
): UserRoleAssignment {
  return {
    documentType: 'USER_ROLE_ASSIGNMENT',
    id: `${role}-${office?.officeCode ?? 'national'}`,
    userId: 'user',
    userName: 'user',
    role,
    regionId: office?.regionId ?? null,
    officeCode: office?.officeCode ?? null,
    assignedBy: 'super',
    assignedByName: 'Super',
    assignedAt: '2026-11-01T00:00:00.000Z',
    active: true,
    activeKey: 'key',
  };
}

const SARAH: CamsUserWithPermissions = {
  id: 'okta-sarah',
  name: 'Sarah Williams',
  email: 'sarah.williams@example.com',
  permissions: [
    permission(BUFFALO, CamsRole.Auditor),
    permission(MANHATTAN),
    permission(null, CamsRole.SuperUser),
  ],
};
const ALEX: CamsUserWithPermissions = {
  id: 'okta-alex',
  name: 'Alex Brown',
  email: 'alex@example.com',
  permissions: [],
};

function usersResponse(data: CamsUserWithPermissions[], totalCount = data.length, offset = 0) {
  return {
    data,
    pagination: {
      count: data.length,
      totalCount,
      currentPage: Math.floor(offset / 20) + 1,
      totalPages: Math.ceil(totalCount / 20) || 1,
      limit: 20,
    },
  };
}

function pending<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const nameFilter = () => document.querySelector<HTMLInputElement>('#cams-users-name-filter')!;
const emailFilter = () => document.querySelector<HTMLInputElement>('#cams-users-email-filter')!;
const emptyState = () => document.querySelector('#cams-users-empty');

// A user's first row holds their name, email and Add Permission; each further permission has its own
// row (the Trustees list pattern).
const row = (user: CamsUserWithPermissions) => screen.getByTestId(`cams-user-row-${user.id}`);
const userRows = (user: CamsUserWithPermissions) =>
  Array.from(
    document.querySelectorAll<HTMLElement>(
      `[data-testid="cams-user-row-${user.id}"], [data-testid^="cams-user-row-${user.id}-"]`,
    ),
  );
// A cell's value, without the label CamsTable shows in the stacked layout.
const cellValue = (cell: Element | null) => {
  const copy = cell?.cloneNode(true) as Element | undefined;
  copy?.querySelector('.cams-table__cell-label')?.remove();
  return copy?.textContent ?? '';
};
// One value per permission row, in row order.
const lines = (user: CamsUserWithPermissions, column: 'Role' | 'Region' | 'Office') =>
  userRows(user)
    .map((r) => cellValue(r.querySelector(`.col-${column.toLowerCase()}`)))
    .filter((value) => value !== '');
const table = () => document.querySelector('#cams-users-table');
const heading = () => document.querySelector('#cams-users-count');
const spinner = () => screen.queryByTestId('cams-users-loading');

describe('CamsUsers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    modalShow.mockReset();
    modalProps = undefined;
    removeModalShow.mockReset();
    removeModalProps = undefined;
    vi.spyOn(Api2, 'getOffices').mockResolvedValue({ data: [MANHATTAN, BUFFALO] });
  });

  test('should request the first page of 20 users', async () => {
    const spy = vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(usersResponse([ALEX]));

    render(<CamsUsers />);

    await waitFor(() => expect(table()).toBeInTheDocument());
    expect(spy).toHaveBeenCalledWith({ limit: 20, offset: 0 });
  });

  test('should keep loading until the users arrive', async () => {
    const users = pending<ReturnType<typeof usersResponse>>();
    vi.spyOn(Api2, 'getCamsUsers').mockReturnValue(users.promise);
    const officesResponse = Promise.resolve({ data: [MANHATTAN, BUFFALO] });
    vi.spyOn(Api2, 'getOffices').mockReturnValue(officesResponse);

    render(<CamsUsers />);
    await act(() => officesResponse); // offices have loaded; users have not

    expect(spinner()).toBeInTheDocument();
    expect(table()).not.toBeInTheDocument();
    expect(heading()).toHaveTextContent('CAMS Users');
    expect(screen.getByTestId('cams-users-status')).toHaveTextContent('Loading CAMS users...');
    await act(async () => users.resolve(usersResponse([ALEX])));
    expect(table()).toBeInTheDocument();
    expect(spinner()).not.toBeInTheDocument();
  });

  test('should keep loading until the office names arrive, so codes never show', async () => {
    const offices = pending<{ data: UstpOfficeDetails[] }>();
    vi.spyOn(Api2, 'getOffices').mockReturnValue(offices.promise);
    const usersCall = Promise.resolve(usersResponse([SARAH]));
    vi.spyOn(Api2, 'getCamsUsers').mockReturnValue(usersCall);

    render(<CamsUsers />);
    await act(() => usersCall); // users have loaded; offices have not

    expect(spinner()).toBeInTheDocument();
    expect(table()).not.toBeInTheDocument();
    await act(async () => offices.resolve({ data: [MANHATTAN, BUFFALO] }));
    expect(lines(SARAH, 'Office')).toEqual(['Buffalo', 'Manhattan', 'All']);
  });

  test.each([
    { totalCount: 607, label: '607 CAMS Users' },
    { totalCount: 1, label: '1 CAMS User' },
  ])('should head the table with the user count: $label', async ({ totalCount, label }) => {
    vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(usersResponse([ALEX], totalCount));

    render(<CamsUsers />);

    await waitFor(() => expect(heading()).toHaveTextContent(label));
    expect(screen.getByTestId('cams-users-status')).toHaveTextContent(label);
  });

  test('should show one row per permission, with the name and email on the first row only', async () => {
    vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(usersResponse([ALEX, SARAH]));

    render(<CamsUsers />);

    await waitFor(() => expect(table()).toBeInTheDocument());
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Name',
      'Email',
      'Role',
      'Region',
      'Office',
      'Actions',
    ]);
    const rows = userRows(SARAH);
    expect(rows).toHaveLength(3);
    expect(cellValue(rows[0].querySelector('.col-name'))).toEqual(SARAH.name);
    expect(cellValue(rows[0].querySelector('.col-email'))).toEqual(SARAH.email);
    expect(lines(SARAH, 'Role')).toEqual(['Auditor', 'Trial Attorney', 'Super User']);
    expect(lines(SARAH, 'Region')).toEqual(['2', '2', 'All']);
    expect(lines(SARAH, 'Office')).toEqual(['Buffalo', 'Manhattan', 'All']);
  });

  test("should show a user's name and email on their first row only, naming them on later rows for screen readers alone", async () => {
    vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(usersResponse([SARAH]));

    render(<CamsUsers />);

    await waitFor(() => expect(table()).toBeInTheDocument());
    for (const later of userRows(SARAH).slice(1)) {
      const nameCell = later.querySelector('.col-name')!;
      expect(nameCell.querySelector('.usa-sr-only')).toHaveTextContent(SARAH.name);
      expect(nameCell.textContent).toEqual(SARAH.name);
      const emailCell = later.querySelector('.col-email')!;
      expect(emailCell.textContent).toEqual('');
      expect(emailCell.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    }
  });

  const emailText = (user: CamsUserWithPermissions) =>
    within(row(user)).getByTestId('cams-user-email');
  // The text on each side of a break point, however EmailText nests it.
  const textAround = (container: HTMLElement, breakPoint: Element) => {
    const before = document.createRange();
    before.setStart(container, 0);
    before.setEndBefore(breakPoint);
    const after = document.createRange();
    after.setStartAfter(breakPoint);
    after.setEnd(container, container.childNodes.length);
    return [before.toString(), after.toString()];
  };

  test.each([
    {
      case: 'an email',
      email: 'sarah.williams@example.com',
      parts: ['sarah.williams@', 'example.com'],
    },
    {
      case: 'an email with more than one @',
      email: 'a@b@example.com',
      parts: ['a@', 'b@example.com'],
    },
  ])(
    'should let $case wrap only after its first @, keeping its text unchanged',
    async ({ email, parts }) => {
      const user = { ...SARAH, email };
      vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(usersResponse([user]));

      render(<CamsUsers />);

      await waitFor(() => expect(table()).toBeInTheDocument());
      const breakPoints = emailText(user).querySelectorAll('wbr');
      expect(breakPoints).toHaveLength(1);
      expect(textAround(emailText(user), breakPoints[0])).toEqual(parts);
      expect(emailText(user).textContent).toBe(email);
    },
  );

  test.each([
    { case: 'an email without an @', email: 'not-an-email' },
    { case: 'an empty email', email: '' },
    { case: 'a missing email', email: undefined },
  ])('should show $case as it is, without a break point', async ({ email }) => {
    const user = { ...ALEX, email };
    vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(usersResponse([user]));

    render(<CamsUsers />);

    await waitFor(() => expect(table()).toBeInTheDocument());
    expect(emailText(user).querySelector('wbr')).toBeNull();
    expect(emailText(user).textContent).toBe(email ?? '');
  });

  test('should show a user with no permissions as one row with empty Role, Region and Office', async () => {
    vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(usersResponse([ALEX]));

    render(<CamsUsers />);

    await waitFor(() => expect(table()).toBeInTheDocument());
    expect(userRows(ALEX)).toHaveLength(1);
    for (const column of ['.col-role', '.col-region', '.col-office']) {
      const cell = row(ALEX).querySelector(column);
      expect(cell).toBeInTheDocument();
      expect(cellValue(cell)).toEqual('');
    }
  });

  test('should give every user an Add Permission action that opens the modal for that user', async () => {
    vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(usersResponse([ALEX, SARAH]));

    render(<CamsUsers />);
    await waitFor(() => expect(table()).toBeInTheDocument());

    const sarahButton = document.querySelector(`#add-permission-${SARAH.id}`)!;
    expect(sarahButton).toHaveAccessibleName('Add Permission to Sarah Williams');
    expect(sarahButton).toHaveTextContent('Add Permission');
    expect(document.querySelector(`#add-permission-${ALEX.id}`)).toBeInTheDocument();
    await userEvent.click(sarahButton);
    expect(modalShow).toHaveBeenCalledWith({ id: SARAH.id, name: SARAH.name });
    expect(modalProps!.offices).toEqual([MANHATTAN, BUFFALO]);
  });

  test("should place Add Permission on a user's first row for columns and after their last permission for the stacked layout", async () => {
    const ONE: CamsUserWithPermissions = {
      ...ALEX,
      id: 'okta-one',
      permissions: [permission(MANHATTAN)],
    };
    vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(usersResponse([ALEX, ONE, SARAH]));

    render(<CamsUsers />);
    await waitFor(() => expect(table()).toBeInTheDocument());

    // First row for columns, none in between, last row for the stacked layout.
    const sarahRows = userRows(SARAH);
    expect(sarahRows.map((r) => r.querySelectorAll('.cams-users__add-permission').length)).toEqual([
      1, 0, 1,
    ]);
    const firstRowAdd = sarahRows[0].querySelector(`#add-permission-${SARAH.id}`)!;
    const lastRowAdd = sarahRows[2].querySelector(`#add-permission-${SARAH.id}-last`)!;
    expect(firstRowAdd).toHaveClass('cams-users__add-permission--first-row');
    expect(lastRowAdd).toHaveClass('cams-users__add-permission--last-row');
    expect(lastRowAdd).toHaveAccessibleName('Add Permission to Sarah Williams');
    // In the last row it comes after that row's Remove Permission.
    const lastRowButtons = Array.from(sarahRows[2].querySelectorAll('button'));
    expect(lastRowButtons.map((button) => button.className)).toEqual([
      expect.stringContaining('cams-users__remove-permission'),
      expect.stringContaining('cams-users__add-permission--last-row'),
    ]);
    await userEvent.click(lastRowAdd);
    expect(modalShow).toHaveBeenCalledWith({ id: SARAH.id, name: SARAH.name });

    // A user with one row has a single Add Permission, shown in both layouts.
    for (const user of [ALEX, ONE]) {
      const adds = userRows(user).flatMap((r) =>
        Array.from(r.querySelectorAll('.cams-users__add-permission')),
      );
      expect(adds).toHaveLength(1);
      expect(adds[0].className).not.toMatch(/--(first|last)-row/);
    }
  });

  test('should give each permission a Remove Permission action that opens the remove modal for it', async () => {
    vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(usersResponse([ALEX, SARAH]));

    render(<CamsUsers />);
    await waitFor(() => expect(table()).toBeInTheDocument());

    const removeButtons = userRows(SARAH).map((permissionRow) =>
      permissionRow.querySelector('.cams-users__remove-permission')!,
    );
    expect(removeButtons.map((button) => button.getAttribute('aria-label'))).toEqual([
      // Starts with the visible text, as Add Permission's does (WCAG 2.5.3 Label in Name), and names
      // the permission, so a list of a user's buttons tells them apart.
      'Remove Permission from Sarah Williams: Auditor, Region 2 - Buffalo',
      'Remove Permission from Sarah Williams: Trial Attorney, Region 2 - Manhattan',
      'Remove Permission from Sarah Williams: Super User',
    ]);
    removeButtons.forEach((button) => expect(button).toHaveTextContent('Remove Permission'));
    expect(row(ALEX).querySelectorAll('.cams-users__remove-permission')).toHaveLength(0);

    await userEvent.click(document.querySelector(`#remove-permission-${SARAH.permissions[1].id}`)!);
    expect(removeModalShow).toHaveBeenCalledWith(
      { id: SARAH.id, name: SARAH.name },
      SARAH.permissions[1],
    );
    expect(removeModalProps!.offices).toEqual([MANHATTAN, BUFFALO]);
  });

  test("should not offer removal of the signed-in Super User's own Super User permission, but offer their others", async () => {
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(
      MockData.getCamsSession({
        user: { id: SARAH.id, name: SARAH.name, roles: [CamsRole.SuperUser] },
      }),
    );
    // Another Super User's Super User permission stays removable: only your own is protected.
    const MARIA: CamsUserWithPermissions = {
      id: 'okta-maria',
      name: 'Maria Garcia',
      email: 'maria@example.com',
      permissions: [permission(MANHATTAN), permission(null, CamsRole.SuperUser)],
    };
    vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(usersResponse([MARIA, SARAH]));

    render(<CamsUsers />);
    await waitFor(() => expect(table()).toBeInTheDocument());

    expect(lines(SARAH, 'Role')).toEqual(['Auditor', 'Trial Attorney', 'Super User']);
    expect(
      userRows(SARAH).map((r) => r.querySelectorAll('.cams-users__remove-permission').length),
    ).toEqual([1, 1, 0]);
    // Gherkin: her row still has an Add Permission action.
    expect(document.querySelector(`#add-permission-${SARAH.id}`)).toBeEnabled();
    expect(lines(MARIA, 'Role')).toEqual(['Trial Attorney', 'Super User']);
    expect(
      userRows(MARIA).map((r) => r.querySelectorAll('.cams-users__remove-permission').length),
    ).toEqual([1, 1]);
  });

  test("should reload the current page and move focus to the user's Add Permission after a removal", async () => {
    const pageOne = Array.from({ length: 20 }, (_, i) => ({
      ...ALEX,
      id: `p1-${i}`,
      name: `A ${i}`,
    }));
    // Another user comes first on page two, so focusing the page's first Add Permission would fail.
    const pageTwoAlex = { ...ALEX, id: 'p2-alex' };
    const pageTwoSarah = { ...SARAH, id: 'p2-sarah' };
    const spy = vi
      .spyOn(Api2, 'getCamsUsers')
      .mockImplementation(async ({ offset }) =>
        offset === 0
          ? usersResponse(pageOne, 22)
          : usersResponse([pageTwoAlex, pageTwoSarah], 22, 20),
      );
    render(<CamsUsers />);
    await waitFor(() => expect(table()).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('pagination-button-next-results'));
    await waitFor(() => expect(row(pageTwoSarah)).toBeInTheDocument());

    const withoutManhattan = {
      ...pageTwoSarah,
      permissions: [SARAH.permissions[0], SARAH.permissions[2]],
    };
    spy.mockResolvedValueOnce(usersResponse([pageTwoAlex, withoutManhattan], 22, 20));
    await act(async () => removeModalProps!.onSuccess(pageTwoSarah.id));

    expect(spy).toHaveBeenLastCalledWith({ limit: 20, offset: 20 });
    expect(lines(pageTwoSarah, 'Office')).toEqual(['Buffalo', 'All']);
    expect(document.querySelector(`#add-permission-${pageTwoSarah.id}`)).toHaveFocus();
  });

  test.each([
    {
      case: 'the first of their permissions',
      remaining: [SARAH.permissions[1], SARAH.permissions[2]],
    },
    { case: 'their only permission', remaining: [] },
  ])(
    "should move focus to the user's Add Permission after removing $case",
    async ({ remaining }) => {
      const spy = vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(usersResponse([ALEX, SARAH]));
      render(<CamsUsers />);
      await waitFor(() => expect(table()).toBeInTheDocument());

      spy.mockResolvedValueOnce(usersResponse([ALEX, { ...SARAH, permissions: remaining }]));
      await act(async () => removeModalProps!.onSuccess(SARAH.id));

      expect(document.querySelector(`#add-permission-${SARAH.id}`)).toHaveFocus();
    },
  );

  test("should move focus to the stacked layout's Add Permission when that is the one shown", async () => {
    // jsdom applies no stylesheet; stand in for the stacked layout, which hides the first-row
    // button (CamsUsers.scss, the container query below $cams-users-columns-min-width).
    vi.spyOn(HTMLElement.prototype, 'checkVisibility').mockImplementation(function (
      this: HTMLElement,
    ) {
      return !this.classList.contains('cams-users__add-permission--first-row');
    });
    const spy = vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(usersResponse([ALEX, SARAH]));
    render(<CamsUsers />);
    await waitFor(() => expect(table()).toBeInTheDocument());

    spy.mockResolvedValueOnce(
      usersResponse([ALEX, { ...SARAH, permissions: SARAH.permissions.slice(1) }]),
    );
    await act(async () => removeModalProps!.onSuccess(SARAH.id));

    expect(document.querySelector(`#add-permission-${SARAH.id}-last`)).toHaveFocus();
  });

  test('should move focus to the heading after a removal when adding permissions is unavailable', async () => {
    vi.spyOn(Api2, 'getOffices').mockRejectedValue(new Error('500'));
    vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(usersResponse([SARAH]));
    render(<CamsUsers />);
    await waitFor(() =>
      expect(document.querySelector(`#add-permission-${SARAH.id}`)).toBeDisabled(),
    );

    await act(async () => removeModalProps!.onSuccess(SARAH.id));

    expect(heading()).toHaveFocus();
  });

  test('should page 20 at a time, focus the heading, and reload the current page after a grant', async () => {
    const pageOne = Array.from({ length: 20 }, (_, i) => ({
      ...ALEX,
      id: `p1-${i}`,
      name: `A ${i}`,
    }));
    const pageTwo = { ...ALEX, id: 'p2-0', name: 'Z 0' };
    const spy = vi
      .spyOn(Api2, 'getCamsUsers')
      .mockImplementation(async ({ offset }) =>
        offset === 0 ? usersResponse(pageOne, 21) : usersResponse([pageTwo], 21, 20),
      );
    render(<CamsUsers />);
    await waitFor(() => expect(table()).toBeInTheDocument());

    await userEvent.click(screen.getByTestId('pagination-button-next-results'));

    await waitFor(() => expect(row(pageTwo)).toBeInTheDocument());
    expect(spy).toHaveBeenLastCalledWith({ limit: 20, offset: 20 });
    expect(heading()).toHaveFocus();

    spy.mockResolvedValueOnce(
      usersResponse([{ ...pageTwo, permissions: [permission(MANHATTAN)] }], 21, 20),
    );
    await act(async () => modalProps!.onSuccess());

    expect(spy).toHaveBeenLastCalledWith({ limit: 20, offset: 20 });
    expect(lines(pageTwo, 'Office')).toEqual(['Manhattan']);
  });

  test('should keep the rows in place while the page reloads', async () => {
    const spy = vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(usersResponse([ALEX]));
    render(<CamsUsers />);
    await waitFor(() => expect(table()).toBeInTheDocument());
    const reload = pending<ReturnType<typeof usersResponse>>();
    spy.mockReturnValueOnce(reload.promise);
    const button = document.querySelector<HTMLElement>(`#add-permission-${ALEX.id}`)!;
    button.focus();

    act(() => {
      modalProps!.onSuccess();
    });

    expect(spinner()).toBeInTheDocument();
    expect(button).toBeInTheDocument();
    expect(button).toHaveFocus();
    await act(async () => reload.resolve(usersResponse([ALEX])));
  });

  test('should move focus to the heading when the reload after a grant fails', async () => {
    const spy = vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(usersResponse([ALEX]));
    render(<CamsUsers />);
    await waitFor(() => expect(table()).toBeInTheDocument());
    spy.mockRejectedValueOnce(new Error('500'));
    const button = document.querySelector<HTMLElement>(`#add-permission-${ALEX.id}`)!;
    button.focus();

    await act(async () => modalProps!.onSuccess());

    expect(document.querySelector('#cams-users-load-error')).toBeInTheDocument();
    expect(table()).not.toBeInTheDocument();
    expect(button).not.toBeInTheDocument();
    expect(heading()).toHaveFocus();
  });

  test('should move focus to the heading when the reload after a removal fails', async () => {
    const spy = vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(usersResponse([SARAH]));
    render(<CamsUsers />);
    await waitFor(() => expect(table()).toBeInTheDocument());
    spy.mockRejectedValueOnce(new Error('500'));

    await act(async () => removeModalProps!.onSuccess(SARAH.id));

    expect(document.querySelector('#cams-users-load-error')).toBeInTheDocument();
    expect(table()).not.toBeInTheDocument();
    expect(heading()).toHaveFocus();
  });

  test('should move focus to the heading when a page change fails', async () => {
    const pageOne = Array.from({ length: 20 }, (_, i) => ({ ...ALEX, id: `p1-${i}` }));
    vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(usersResponse(pageOne, 21));
    render(<CamsUsers />);
    await waitFor(() => expect(table()).toBeInTheDocument());
    vi.spyOn(Api2, 'getCamsUsers').mockRejectedValueOnce(new Error('500'));

    await userEvent.click(screen.getByTestId('pagination-button-next-results'));

    await waitFor(() =>
      expect(document.querySelector('#cams-users-load-error')).toBeInTheDocument(),
    );
    expect(table()).not.toBeInTheDocument();
    expect(heading()).toHaveFocus();
  });

  test('should not show pagination when everyone fits on one page', async () => {
    vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(usersResponse([ALEX, SARAH]));

    render(<CamsUsers />);

    await waitFor(() => expect(table()).toBeInTheDocument());
    expect(screen.queryByTestId('pagination-button-next-results')).not.toBeInTheDocument();
  });

  test('should say so when there are no CAMS users', async () => {
    vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(usersResponse([]));

    render(<CamsUsers />);

    await waitFor(() => expect(document.querySelector('#cams-users-empty')).toBeInTheDocument());
    expect(document.querySelector('#cams-users-empty')).toHaveTextContent('No CAMS users found.');
    expect(table()).not.toBeInTheDocument();
  });

  test('should explain when the users cannot be loaded', async () => {
    vi.spyOn(Api2, 'getCamsUsers').mockRejectedValue(new Error('500'));

    render(<CamsUsers />);

    await waitFor(() =>
      expect(document.querySelector('#cams-users-load-error')).toHaveTextContent(
        'Unable to load CAMS users. Please try again.',
      ),
    );
    expect(table()).not.toBeInTheDocument();
  });

  test('should show offices by code and disable adding when the office names cannot be loaded', async () => {
    vi.spyOn(Api2, 'getOffices').mockRejectedValue(new Error('500'));
    vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(usersResponse([SARAH]));

    render(<CamsUsers />);

    await waitFor(() => expect(table()).toBeInTheDocument());
    expect(document.querySelector('#cams-users-offices-error')).toHaveTextContent(
      'Unable to load office names.',
    );
    expect(lines(SARAH, 'Office')).toEqual([BUFFALO.officeCode, MANHATTAN.officeCode, 'All']);
    await waitFor(() =>
      expect(document.querySelector(`#add-permission-${SARAH.id}`)).toBeDisabled(),
    );
    expect(document.querySelector(`#add-permission-${SARAH.id}-last`)).toBeDisabled();
  });

  describe('filters', () => {
    const MIA: CamsUserWithPermissions = {
      id: 'okta-mia',
      name: 'Mia Sarahson',
      email: 'mia@example.com',
      permissions: [],
    };
    const DEBOUNCE_MS = 300;

    // The debounce runs on a fake clock, so these tests drive the inputs with fireEvent: userEvent
    // (through Testing Library's async wrapper) waits on a real-time setTimeout that a Vitest fake
    // clock never fires.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    });

    /** Types one character at a time, as a user would, appending to what is there. */
    function typeInto(input: HTMLInputElement, text: string) {
      for (const character of text) {
        fireEvent.change(input, { target: { value: input.value + character } });
      }
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    const settle = (ms = DEBOUNCE_MS) => act(() => vi.advanceTimersByTimeAsync(ms));

    async function showUsers(response = usersResponse([ALEX, SARAH, MIA])) {
      const spy = vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(response);
      render(<CamsUsers />);
      await settle(0);
      expect(table()).toBeInTheDocument();
      return spy;
    }

    test('should label the CAMS User Name and Email filters', async () => {
      await showUsers();

      expect(screen.getByLabelText('CAMS User Name')).toBe(nameFilter());
      expect(screen.getByLabelText('Email')).toBe(emailFilter());
    });

    test('should request page 1, 300 ms after typing stops, and show the filtered count', async () => {
      const spy = await showUsers();
      spy.mockResolvedValue(usersResponse([SARAH]));

      typeInto(nameFilter(), 'Sarah');
      await settle(DEBOUNCE_MS - 1);
      expect(spy).toHaveBeenCalledTimes(1);
      await settle(1);

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenLastCalledWith({ limit: 20, offset: 0, name: 'Sarah' });
      expect(heading()).toHaveTextContent('1 CAMS User');
      expect(screen.getByTestId('cams-users-status')).toHaveTextContent('1 CAMS User');
      expect(row(SARAH)).toBeInTheDocument();
    });

    test('should send both filters together', async () => {
      const spy = await showUsers();

      typeInto(nameFilter(), 'sarah');
      typeInto(emailFilter(), 'sarah.williams@');
      await settle();

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenLastCalledWith({
        limit: 20,
        offset: 0,
        name: 'sarah',
        email: 'sarah.williams@',
      });
    });

    test.each(['S', ' a '])(
      'should ignore a filter under 2 characters after trimming: "%s"',
      async (typed) => {
        const spy = await showUsers();

        typeInto(nameFilter(), typed);
        typeInto(emailFilter(), 'x');
        await settle();

        expect(spy).toHaveBeenCalledTimes(1);
        expect(nameFilter()).toHaveValue(typed);
      },
    );

    test('should send the trimmed text and leave the input as typed', async () => {
      const spy = await showUsers();

      typeInto(nameFilter(), '  sa ');
      await settle();

      expect(spy).toHaveBeenLastCalledWith({ limit: 20, offset: 0, name: 'sa' });
      expect(nameFilter()).toHaveValue('  sa ');
    });

    test('should not reload when only surrounding spaces change', async () => {
      const spy = await showUsers();
      typeInto(nameFilter(), 'sarah');
      await settle();
      expect(spy).toHaveBeenCalledTimes(2);

      typeInto(nameFilter(), '  ');
      await settle();

      expect(spy).toHaveBeenCalledTimes(2);
    });

    test('should not apply text that was deleted before typing stopped', async () => {
      const spy = await showUsers();

      typeInto(nameFilter(), 'sarah');
      fireEvent.change(nameFilter(), { target: { value: '' } });
      await settle();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    test('should never let an older response replace a newer one', async () => {
      const spy = await showUsers();
      const older = pending<ReturnType<typeof usersResponse>>();
      const newer = pending<ReturnType<typeof usersResponse>>();
      spy.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

      typeInto(nameFilter(), 'sa');
      await settle();
      typeInto(nameFilter(), 'rah');
      await settle();
      expect(spy).toHaveBeenCalledTimes(3);

      await act(async () => newer.resolve(usersResponse([SARAH])));
      await act(async () => older.resolve(usersResponse([SARAH, MIA])));

      expect(heading()).toHaveTextContent('1 CAMS User');
      expect(screen.queryByTestId(`cams-user-row-${MIA.id}`)).not.toBeInTheDocument();
    });

    test('should never let an older failure hide a newer result', async () => {
      const spy = await showUsers();
      const older = pending<ReturnType<typeof usersResponse>>();
      spy
        .mockReturnValueOnce(older.promise.then(() => Promise.reject(new Error('500'))))
        .mockResolvedValueOnce(usersResponse([SARAH]));

      typeInto(nameFilter(), 'sa');
      await settle();
      typeInto(nameFilter(), 'rah');
      await settle();
      await act(async () => older.resolve(usersResponse([])));

      expect(document.querySelector('#cams-users-load-error')).not.toBeInTheDocument();
      expect(spinner()).not.toBeInTheDocument();
      expect(row(SARAH)).toBeInTheDocument();
    });

    test('should say so when the filters match nobody', async () => {
      const spy = await showUsers();
      spy.mockResolvedValue(usersResponse([]));

      typeInto(nameFilter(), 'zz');
      await settle();

      expect(emptyState()).toHaveTextContent('No CAMS users match your search criteria.');
      expect(table()).not.toBeInTheDocument();
    });

    test.each([
      {
        filter: 'CAMS User Name',
        input: nameFilter,
        clearId: '#cams-users-name-filter-clear',
        key: 'name',
      },
      {
        filter: 'Email',
        input: emailFilter,
        clearId: '#cams-users-email-filter-clear',
        key: 'email',
      },
    ])(
      'should clear the $filter filter and reload everyone, showing Clear only while it has a value',
      async ({ filter, input, clearId, key }) => {
        const clear = () => document.querySelector<HTMLButtonElement>(clearId);
        const spy = await showUsers();
        expect(clear()).not.toBeInTheDocument();
        typeInto(input(), 'sarah');
        await settle();
        expect(spy).toHaveBeenLastCalledWith({ limit: 20, offset: 0, [key]: 'sarah' });
        expect(clear()).toBeVisible();
        expect(clear()).toHaveAccessibleName(`Clear ${filter} filter`);

        fireEvent.click(clear()!);
        await settle();

        expect(input()).toHaveValue('');
        expect(input()).toHaveFocus();
        expect(spy).toHaveBeenLastCalledWith({ limit: 20, offset: 0 });
        expect(clear()).not.toBeInTheDocument();
      },
    );

    test('should return to page 1 on a filter change and keep the filters while paging and after a grant', async () => {
      const many = Array.from({ length: 20 }, (_, i) => ({
        ...ALEX,
        id: `u-${i}`,
        name: `A ${i}`,
      }));
      const spy = await showUsers(usersResponse(many, 41));

      fireEvent.click(screen.getByTestId('pagination-button-next-results'));
      await settle(0);
      expect(spy).toHaveBeenLastCalledWith({ limit: 20, offset: 20 });

      typeInto(nameFilter(), 'al');
      await settle();
      expect(spy).toHaveBeenLastCalledWith({ limit: 20, offset: 0, name: 'al' });

      fireEvent.click(screen.getByTestId('pagination-button-next-results'));
      await settle(0);
      expect(spy).toHaveBeenLastCalledWith({ limit: 20, offset: 20, name: 'al' });

      await act(async () => modalProps!.onSuccess());
      expect(spy).toHaveBeenLastCalledWith({ limit: 20, offset: 20, name: 'al' });
    });

    test('should keep the filter values when loading fails', async () => {
      const spy = await showUsers();
      spy.mockRejectedValue(new Error('500'));

      typeInto(nameFilter(), 'sarah');
      await settle();

      expect(document.querySelector('#cams-users-load-error')).toBeInTheDocument();
      expect(nameFilter()).toHaveValue('sarah');
    });
  });
});
