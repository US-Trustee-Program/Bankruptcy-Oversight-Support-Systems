import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { OfficeDivisionSetupOffices } from './OfficeDivisionSetupOffices';
import { PROTOTYPE_DIVISIONS, PROTOTYPE_OFFICES } from './office-division-setup-data';

describe('OfficeDivisionSetupOffices', () => {
  function renderOffices(divisions = PROTOTYPE_DIVISIONS) {
    render(<OfficeDivisionSetupOffices divisions={divisions} onSaveChanges={vi.fn()} />);
  }

  function withUnassigned(divisionName: string) {
    return PROTOTYPE_DIVISIONS.map((d) =>
      d.divisionName === divisionName ? { ...d, office: null } : d,
    );
  }

  function getBodyRows() {
    const table = screen.getByRole('table', { name: 'USTP offices' });
    const [, ...rows] = within(table).getAllByRole('row');
    return rows;
  }

  function getCells(row: HTMLElement) {
    return within(row).getAllByRole('cell');
  }

  function getFilterInput() {
    return screen.getByRole('combobox', { name: /Region & Office/ });
  }

  test('should show Region, Office, Division(s), and Actions columns in order', () => {
    renderOffices();

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers).toEqual(['Region', 'Office', 'Division(s)', 'Actions']);
  });

  test('should label each cell for the stacked mobile layout', () => {
    renderOffices();

    const labels = getCells(getBodyRows()[1]).map(
      (cell) => cell.querySelector('.cams-table__cell-label')?.textContent,
    );
    expect(labels).toEqual(['Region: ', 'Office: ', 'Division(s): ', undefined]);
  });

  test('should show the Unassigned row first, with a no-divisions message when all are assigned', () => {
    renderOffices();

    const cells = getCells(getBodyRows()[0]);
    expect(PROTOTYPE_DIVISIONS.every((d) => d.office)).toBe(true);
    expect(cells[1]).toHaveTextContent('Office: Unassigned');
    expect(cells[2]).toHaveTextContent('Division(s): No divisions unassigned');
    expect(within(cells[3]).queryByRole('button')).not.toBeInTheDocument();
  });

  test('should list unassigned divisions in the first row', () => {
    renderOffices(withUnassigned('Hot Springs'));

    expect(getCells(getBodyRows()[0])[2]).toHaveTextContent(
      'Division(s): Western District of Arkansas (Hot Springs)',
    );
  });

  test('should list each office with its divisions and an Edit Offices button', () => {
    renderOffices();

    const cells = getCells(getBodyRows()[1]);
    expect(cells[0]).toHaveTextContent(PROTOTYPE_OFFICES[0].regionId);
    expect(cells[1]).toHaveTextContent(PROTOTYPE_OFFICES[0].officeName);
    expect(cells[2]).toHaveTextContent('District of Massachusetts (Boston)');
    expect(
      within(cells[3]).getByRole('button', { name: 'Edit Offices: Boston (Region 1)' }),
    ).toBeInTheDocument();
  });

  test('should show None for an office with no divisions', () => {
    renderOffices(withUnassigned('Boston'));

    expect(getCells(getBodyRows()[1])[2]).toHaveTextContent('None');
  });

  test('should show 25 rows per page and the next page when Next is clicked', async () => {
    renderOffices();
    expect(getBodyRows()).toHaveLength(25);

    await userEvent.click(screen.getByTestId('pagination-button-next-results'));

    // Page 2 starts at the 26th row: the unassigned row plus 24 offices came before it.
    expect(getCells(getBodyRows()[0])[1]).toHaveTextContent(PROTOTYPE_OFFICES[24].officeName);
  });

  test('should narrow the Region & Office options to matches as the user types', async () => {
    renderOffices();

    await userEvent.type(getFilterInput(), 'portland');

    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Region 1 - Portland',
      'Region 18 - Portland',
    ]);
  });

  test('should show only the selected office in the table', async () => {
    renderOffices();

    await userEvent.type(getFilterInput(), 'manhattan');
    await userEvent.click(screen.getByRole('option', { name: /Region 2 - Manhattan/ }));

    const rows = getBodyRows();
    expect(rows).toHaveLength(1);
    expect(getCells(rows[0])[1]).toHaveTextContent('Manhattan');
    expect(screen.queryByTestId('pagination-button-next-results')).not.toBeInTheDocument();
  });

  test('should show only the Unassigned row when (unassigned) is selected', async () => {
    renderOffices();

    await userEvent.type(getFilterInput(), 'unassigned');
    await userEvent.click(screen.getByRole('option', { name: /\(unassigned\)/ }));

    const rows = getBodyRows();
    expect(rows).toHaveLength(1);
    expect(getCells(rows[0])[1]).toHaveTextContent('Office: Unassigned');
  });

  test('should show the selected office even when it is past the current page', async () => {
    renderOffices();
    await userEvent.click(screen.getByTestId('pagination-button-next-results'));

    await userEvent.type(getFilterInput(), 'tampa');
    await userEvent.click(screen.getByRole('option', { name: /Region 21 - Tampa/ }));

    expect(getCells(getBodyRows()[0])[1]).toHaveTextContent('Tampa');
  });
});
