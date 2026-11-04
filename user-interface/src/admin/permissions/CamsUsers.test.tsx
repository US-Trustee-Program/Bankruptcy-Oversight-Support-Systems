import { forwardRef, useImperativeHandle } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import Api2 from '@/lib/models/api2';
import { CamsRole, CamsRoleType } from '@common/cams/roles';
import { UstpOfficeDetails } from '@common/cams/offices';
import { CamsUserWithPermissions, UserRoleAssignment } from '@common/cams/user-access';
import { MOCKED_USTP_OFFICE_DATA_MAP } from '@common/cams/test-utilities/offices.mock';
import { CamsUsers, permissionSentence } from './CamsUsers';
import type { AddPermissionModalProps } from './AddPermissionModal';

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
    expiresAt: null,
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

const row = (user: CamsUserWithPermissions) => screen.getByTestId(`cams-user-row-${user.id}`);
const visibleLines = (user: CamsUserWithPermissions, column: string) =>
  row(user).querySelector(`[data-cell="${column}"] .cams-users__permission-lines`);
const lines = (user: CamsUserWithPermissions, column: string) =>
  Array.from(visibleLines(user, column)?.querySelectorAll('li') ?? [], (li) => li.textContent);
const sentences = (user: CamsUserWithPermissions) =>
  Array.from(
    row(user).querySelectorAll('[data-cell="Role"] .usa-sr-only li'),
    (li) => li.textContent,
  );
const table = () => document.querySelector('#cams-users-table');
const heading = () => document.querySelector('#cams-users-count');
const spinner = () => screen.queryByTestId('cams-users-loading');

describe('CamsUsers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    modalShow.mockReset();
    modalProps = undefined;
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

  test('should show each user with their permissions stacked by role, region and office', async () => {
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
    expect(row(SARAH).querySelector('[data-cell="Email"]')).toHaveTextContent(SARAH.email!);
    expect(lines(SARAH, 'Role')).toEqual(['Auditor', 'Trial Attorney', 'Super User']);
    expect(lines(SARAH, 'Region')).toEqual(['2', '2', 'All']);
    expect(lines(SARAH, 'Office')).toEqual(['Buffalo', 'Manhattan', 'All']);
  });

  test('should read each permission to screen readers as one sentence, in the Role cell', async () => {
    vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(usersResponse([ALEX, SARAH]));

    render(<CamsUsers />);

    await waitFor(() => expect(table()).toBeInTheDocument());
    expect(sentences(SARAH)).toEqual([
      'Auditor, Region 2, Buffalo',
      'Trial Attorney, Region 2, Manhattan',
      'Super User',
    ]);
    for (const column of ['Role', 'Region', 'Office']) {
      expect(visibleLines(SARAH, column)).toHaveAttribute('aria-hidden', 'true');
    }
  });

  test('should show a user with no permissions as having none', async () => {
    vi.spyOn(Api2, 'getCamsUsers').mockResolvedValue(usersResponse([ALEX]));

    render(<CamsUsers />);

    await waitFor(() => expect(table()).toBeInTheDocument());
    expect(lines(ALEX, 'Role')).toEqual([]);
    expect(lines(ALEX, 'Region')).toEqual([]);
    expect(lines(ALEX, 'Office')).toEqual([]);
    expect(row(ALEX).querySelector('[data-cell="Role"] .usa-sr-only')).toHaveTextContent(
      'No permissions',
    );
  });

  test('should give every row an Add Permission action that opens the modal for that user', async () => {
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
      'should clear the $filter filter and reload everyone, hiding Clear while it is empty',
      async ({ filter, input, clearId, key }) => {
        const clear = () => document.querySelector<HTMLButtonElement>(clearId)!;
        const spy = await showUsers();
        expect(clear()).not.toBeVisible();
        typeInto(input(), 'sarah');
        await settle();
        expect(spy).toHaveBeenLastCalledWith({ limit: 20, offset: 0, [key]: 'sarah' });
        expect(clear()).toBeVisible();
        expect(clear()).toHaveAccessibleName(`Clear ${filter} filter`);

        fireEvent.click(clear());
        await settle();

        expect(input()).toHaveValue('');
        expect(spy).toHaveBeenLastCalledWith({ limit: 20, offset: 0 });
        expect(clear()).not.toBeVisible();
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

describe('permissionSentence', () => {
  const officeName = () => 'Manhattan';

  test('should name the role, region and office for an office permission', () => {
    expect(permissionSentence(permission(MANHATTAN), officeName)).toEqual(
      'Trial Attorney, Region 2, Manhattan',
    );
  });

  test('should say all offices for a region-wide permission', () => {
    const regionWide = { ...permission(MANHATTAN), officeCode: null };
    expect(permissionSentence(regionWide, officeName)).toEqual(
      'Trial Attorney, Region 2, all offices',
    );
  });

  test('should say all regions for a national permission', () => {
    expect(permissionSentence(permission(null), officeName)).toEqual('Trial Attorney, all regions');
  });

  test('should give only the role for Super User, which has no scope', () => {
    expect(permissionSentence(permission(null, CamsRole.SuperUser), officeName)).toEqual(
      'Super User',
    );
  });
});
