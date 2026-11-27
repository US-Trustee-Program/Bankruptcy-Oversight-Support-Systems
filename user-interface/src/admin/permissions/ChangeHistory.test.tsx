import { act, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import Api2 from '@/lib/models/api2';
import { CamsRole } from '@common/cams/roles';
import { PermissionChange, PermissionSnapshot } from '@common/cams/user-access';
import { MOCKED_USTP_OFFICE_DATA_MAP } from '@common/cams/test-utilities/offices.mock';
import { ChangeHistory } from './ChangeHistory';

const MANHATTAN = MOCKED_USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_2_Office_Manhattan')!;

const MANHATTAN_ATTORNEY: PermissionSnapshot = {
  role: CamsRole.TrialAttorney,
  regionId: '2',
  officeCode: MANHATTAN.officeCode,
};
const REGION_2_ATTORNEY: PermissionSnapshot = {
  role: CamsRole.TrialAttorney,
  regionId: '2',
  officeCode: null,
};

function change(
  kind: PermissionChange['kind'],
  previous: PermissionSnapshot | null,
  next: PermissionSnapshot | null,
  performedAt: string,
): PermissionChange {
  return {
    auditId: `audit-${kind}-${performedAt}-${previous?.officeCode}-${next?.officeCode}`,
    assignmentId: 'assignment',
    userId: 'okta-sarah',
    userName: 'Sarah Williams',
    performedBy: 'okta-maria',
    performedByName: 'Maria Garcia',
    performedAt,
    kind,
    previous,
    next,
  };
}

// The Slice 3 scenario, newest first as the API returns it.
const SCENARIO: PermissionChange[] = [
  change('removed', REGION_2_ATTORNEY, null, '2026-11-25T15:00:00.000Z'),
  change('replaced', MANHATTAN_ATTORNEY, REGION_2_ATTORNEY, '2026-11-20T15:00:00.000Z'),
  change('granted', null, REGION_2_ATTORNEY, '2026-11-20T15:00:00.000Z'),
  change('granted', null, MANHATTAN_ATTORNEY, '2026-11-02T15:00:00.000Z'),
];

function changesResponse(data: PermissionChange[], totalCount = data.length, offset = 0) {
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

const table = () => screen.queryByRole('table', { name: 'Change History' });
const heading = () => screen.getByRole('heading', { name: 'Change History' });
const spinner = () => screen.queryByTestId('change-history-loading');
const loadError = () => document.querySelector('#change-history-load-error');
const nextPage = () => screen.getByTestId('pagination-button-next-results');

// Each row's cell values, without the labels CamsTable shows in the stacked layout.
function rowTexts() {
  return within(table()!)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => {
          const copy = cell.cloneNode(true) as Element;
          copy.querySelector('.cams-table__cell-label')?.remove();
          return copy.textContent;
        }),
    );
}

async function showChanges(data: PermissionChange[], totalCount = data.length) {
  const spy = vi
    .spyOn(Api2, 'getPermissionChanges')
    .mockResolvedValue(changesResponse(data, totalCount));
  render(<ChangeHistory />);
  await waitFor(() => expect(table()).toBeInTheDocument());
  return spy;
}

describe('ChangeHistory', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Api2, 'getOffices').mockResolvedValue({ data: [MANHATTAN] });
  });

  test('should request the first page of 20 changes', async () => {
    const spy = await showChanges(SCENARIO);

    expect(spy).toHaveBeenCalledWith({ limit: 20, offset: 0 });
  });

  test('should show a Change History table with the columns User, Previous, New, Changed by and Date', async () => {
    await showChanges(SCENARIO);

    const headers = within(table()!).getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual([
      'User',
      'Previous',
      'New',
      'Changed by',
      'Date',
    ]);
  });

  test('should show one row per change, newest first, with (none) for the missing side', async () => {
    await showChanges(SCENARIO);

    const removed = 'Trial Attorney, Region 2 - All Offices';
    const manhattan = 'Trial Attorney, Region 2 - Manhattan';
    expect(rowTexts()).toEqual([
      ['Sarah Williams', removed, '(none)', 'Maria Garcia', '11/25/2026'],
      ['Sarah Williams', manhattan, removed, 'Maria Garcia', '11/20/2026'],
      ['Sarah Williams', '(none)', removed, 'Maria Garcia', '11/20/2026'],
      ['Sarah Williams', '(none)', manhattan, 'Maria Garcia', '11/02/2026'],
    ]);
  });

  // Kelly Diabagate, 2026-11-27: a permission wraps only after a comma or a dash.
  test('should let a permission wrap only after its comma and its dash', async () => {
    await showChanges([change('granted', null, MANHATTAN_ATTORNEY, '2026-11-25T15:00:00.000Z')]);

    const parts = (column: string) =>
      Array.from(document.querySelectorAll(`.col-${column} .change-history__part`)).map(
        (part) => part.textContent,
      );
    expect(parts('new')).toEqual(['Trial Attorney,', 'Region 2 -', 'Manhattan']);
    expect(parts('previous')).toEqual(['(none)']);
  });

  test('should show a Super User permission without a scope', async () => {
    const superUser = { role: CamsRole.SuperUser, regionId: null, officeCode: null };
    await showChanges([change('granted', null, superUser, '2026-11-25T15:00:00.000Z')]);

    expect(rowTexts()[0].slice(1, 3)).toEqual(['(none)', 'Super User']);
  });

  test('should show a national permission as All Regions', async () => {
    const national = { role: CamsRole.TrialAttorney, regionId: null, officeCode: null };
    await showChanges([change('granted', null, national, '2026-11-25T15:00:00.000Z')]);

    expect(rowTexts()[0][2]).toEqual('Trial Attorney, All Regions');
  });

  // Kelly Diabagate, 2026-11-27: a missing side is always (none), even for a replacement.
  test('should show (none) when the replacing permission could not be read', async () => {
    await showChanges([change('replaced', MANHATTAN_ATTORNEY, null, '2026-11-25T15:00:00.000Z')]);

    expect(rowTexts()[0].slice(1, 3)).toEqual(['Trial Attorney, Region 2 - Manhattan', '(none)']);
  });

  test('should show the office code when the office is not in the offices list', async () => {
    const unknown = { role: CamsRole.Auditor, regionId: '3', officeCode: 'RETIRED_OFFICE' };
    await showChanges([change('granted', null, unknown, '2026-11-25T15:00:00.000Z')]);

    expect(rowTexts()[0][2]).toEqual('Auditor, Region 3 - RETIRED_OFFICE');
  });

  test('should show office codes with a warning when office names fail to load', async () => {
    vi.spyOn(Api2, 'getOffices').mockRejectedValue(new Error('offices failed'));

    await showChanges([change('granted', null, MANHATTAN_ATTORNEY, '2026-11-25T15:00:00.000Z')]);

    expect(rowTexts()[0][2]).toEqual(`Trial Attorney, Region 2 - ${MANHATTAN.officeCode}`);
    expect(screen.getByText(/Unable to load office names/)).toBeInTheDocument();
  });

  test('should wait for office names before showing the table', async () => {
    const offices = pending<{ data: (typeof MANHATTAN)[] }>();
    vi.spyOn(Api2, 'getOffices').mockReturnValue(offices.promise);
    const changesCall = Promise.resolve(changesResponse(SCENARIO));
    vi.spyOn(Api2, 'getPermissionChanges').mockReturnValue(changesCall);

    render(<ChangeHistory />);
    await act(() => changesCall); // changes have loaded; office names have not

    expect(table()).not.toBeInTheDocument();
    expect(spinner()).toBeInTheDocument();
    await act(async () => offices.resolve({ data: [MANHATTAN] }));
    expect(table()).toBeInTheDocument();
    expect(spinner()).not.toBeInTheDocument();
  });

  test('should not show pagination when every change fits on one page', async () => {
    await showChanges(SCENARIO);

    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  test('should load the next 20 changes from the pagination and focus the heading', async () => {
    const spy = await showChanges(SCENARIO, 45);
    spy.mockResolvedValue(changesResponse(SCENARIO.slice(0, 1), 45, 20));

    await userEvent.click(nextPage());

    await waitFor(() => expect(spy).toHaveBeenLastCalledWith({ limit: 20, offset: 20 }));
    await waitFor(() => expect(rowTexts()).toHaveLength(1));
    expect(heading()).toHaveFocus();
  });

  test('should page forward and back from the page it is on', async () => {
    const spy = await showChanges(SCENARIO, 45);
    const showPage = async (button: HTMLElement, offset: number, rows: number) => {
      spy.mockResolvedValueOnce(changesResponse(SCENARIO.slice(0, rows), 45, offset));
      await userEvent.click(button);
      await waitFor(() => expect(rowTexts()).toHaveLength(rows));
      expect(spy).toHaveBeenLastCalledWith({ limit: 20, offset });
    };

    await showPage(nextPage(), 20, 2);
    await showPage(nextPage(), 40, 3);
    await showPage(screen.getByTestId('pagination-button-previous-results'), 20, 1);
  });

  test('should move focus to the heading when a page change fails', async () => {
    const spy = await showChanges(SCENARIO, 45);
    spy.mockRejectedValueOnce(new Error('500'));

    await userEvent.click(nextPage());

    await waitFor(() => expect(loadError()).toBeInTheDocument());
    expect(table()).not.toBeInTheDocument();
    expect(heading()).toHaveFocus();
  });

  test('should never let an older page replace a newer one', async () => {
    const spy = await showChanges(SCENARIO, 45);
    const older = pending<ReturnType<typeof changesResponse>>();
    const newer = pending<ReturnType<typeof changesResponse>>();
    spy.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    await userEvent.click(nextPage());
    await userEvent.click(screen.getByTestId('pagination-button-page-3-results'));
    await act(async () => newer.resolve(changesResponse(SCENARIO.slice(0, 1), 45, 40)));
    await act(async () => older.resolve(changesResponse(SCENARIO.slice(0, 3), 45, 20)));

    expect(rowTexts()).toHaveLength(1);
    expect(spinner()).not.toBeInTheDocument();
  });

  test('should never let an older failure hide a newer page', async () => {
    const spy = await showChanges(SCENARIO, 45);
    const older = pending<void>();
    spy
      .mockReturnValueOnce(older.promise.then(() => Promise.reject(new Error('500'))))
      .mockResolvedValueOnce(changesResponse(SCENARIO.slice(0, 1), 45, 40));

    await userEvent.click(nextPage());
    await userEvent.click(screen.getByTestId('pagination-button-page-3-results'));
    await waitFor(() => expect(rowTexts()).toHaveLength(1));
    await act(async () => older.resolve());

    expect(loadError()).not.toBeInTheDocument();
    expect(spinner()).not.toBeInTheDocument();
    expect(rowTexts()).toHaveLength(1);
  });

  test('should say there are no changes yet when there are none', async () => {
    vi.spyOn(Api2, 'getPermissionChanges').mockResolvedValue(changesResponse([]));

    render(<ChangeHistory />);

    expect(await screen.findByText('No permission changes yet.')).toBeInTheDocument();
    expect(table()).not.toBeInTheDocument();
  });

  test('should show an error, and no table, when the changes fail to load', async () => {
    vi.spyOn(Api2, 'getPermissionChanges').mockRejectedValue(new Error('load failed'));

    render(<ChangeHistory />);

    await waitFor(() =>
      expect(loadError()).toHaveTextContent('Unable to load change history. Please try again.'),
    );
    expect(table()).not.toBeInTheDocument();
    expect(document.querySelector('#change-history-empty')).not.toBeInTheDocument();
    expect(spinner()).not.toBeInTheDocument();
    expect(screen.getByTestId('change-history-status')).toHaveTextContent('');
    expect(heading()).toHaveFocus();
  });

  test.each([
    { totalCount: 45, label: '45 permission changes' },
    { totalCount: 1, label: '1 permission change' },
  ])(
    'should announce loading, then the count, to screen readers: $label',
    async ({ totalCount, label }) => {
      const changes = pending<ReturnType<typeof changesResponse>>();
      vi.spyOn(Api2, 'getPermissionChanges').mockReturnValue(changes.promise);

      render(<ChangeHistory />);

      const status = screen.getByTestId('change-history-status');
      expect(status).toHaveTextContent('Loading change history...');
      await act(async () => changes.resolve(changesResponse(SCENARIO.slice(0, 1), totalCount)));
      expect(status).toHaveTextContent(new RegExp(`^${label}$`));
    },
  );
});
