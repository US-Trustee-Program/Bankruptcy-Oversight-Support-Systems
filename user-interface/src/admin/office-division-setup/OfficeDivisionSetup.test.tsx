import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { OfficeDivisionSetup } from './OfficeDivisionSetup';

describe('OfficeDivisionSetup', () => {
  let alertSpy: ReturnType<typeof TestingUtilities.spyOnGlobalAlert>;

  beforeEach(() => {
    alertSpy = TestingUtilities.spyOnGlobalAlert();
  });

  function renderAt(path: string) {
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/office-division-setup/*" element={<OfficeDivisionSetup />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  test('should show the Offices tab selected and the office table by default', () => {
    renderAt('/admin/office-division-setup');

    expect(screen.getByRole('link', { name: 'Offices' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Change History' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByRole('table', { name: 'USTP offices' })).toBeInTheDocument();
  });

  test('should show the change history when the Change History tab is clicked', async () => {
    renderAt('/admin/office-division-setup');

    await userEvent.click(screen.getByRole('link', { name: 'Change History' }));

    expect(screen.getByRole('link', { name: 'Change History' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByText('No changes have been made to office divisions.')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'USTP offices' })).not.toBeInTheDocument();
  });

  function getOfficeRow(officeName: string) {
    const table = screen.getByRole('table', { name: 'USTP offices' });
    const row = within(table)
      .getAllByRole('row')
      .find((r) => within(r).queryAllByRole('cell')[1]?.textContent === `Office: ${officeName}`);
    if (!row) throw new Error(`No row for ${officeName}`);
    return row;
  }

  function getUnassignedRow() {
    return getOfficeRow('Unassigned');
  }

  async function openEditFor(officeLabel: string) {
    await userEvent.click(screen.getByRole('button', { name: `Edit Offices: ${officeLabel}` }));
  }

  test('should move a division from another office when the user saves', async () => {
    renderAt('/admin/office-division-setup');
    await openEditFor('Albany (Region 2)');

    const divisionInput = screen.getByRole('combobox', { name: /Division\(s\)/ });
    await userEvent.type(divisionInput, 'white plains');
    await userEvent.click(screen.getByRole('option', { name: /White Plains/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(getOfficeRow('Albany')).toHaveTextContent(
      'Southern District of New York (White Plains)',
    );
    expect(getOfficeRow('Manhattan')).not.toHaveTextContent('White Plains');
    expect(alertSpy.success).toHaveBeenCalledWith('Divisions updated for Albany (Region 2).');
  });

  test('should reset the division picker after each pick so another can be typed', async () => {
    renderAt('/admin/office-division-setup');
    await openEditFor('Albany (Region 2)');
    const divisionInput = screen.getByRole('combobox', { name: /Division\(s\)/ });

    await userEvent.type(divisionInput, 'white plains');
    await userEvent.click(screen.getByRole('option', { name: /White Plains/ }));

    expect(divisionInput).toHaveValue('');
    expect(divisionInput).toHaveAttribute('placeholder', '- Select one or more -');
    expect(
      screen.getByRole('button', { name: /Southern District of New York \(White Plains\)/ }),
    ).toBeInTheDocument();

    await userEvent.type(divisionInput, 'brooklyn');
    await userEvent.click(screen.getByRole('option', { name: /Brooklyn/ }));

    expect(divisionInput).toHaveValue('');
    expect(
      screen.getByRole('button', { name: /Eastern District of New York \(Brooklyn\)/ }),
    ).toBeInTheDocument();
  });

  test('should not offer divisions the office already has', async () => {
    renderAt('/admin/office-division-setup');
    await openEditFor('Albany (Region 2)');

    await userEvent.type(
      screen.getByRole('combobox', { name: /Division\(s\)/ }),
      'new york (albany)',
    );

    expect(screen.queryByRole('option', { name: /New York \(Albany\)/ })).not.toBeInTheDocument();
  });

  test('should make a removed division unassigned and record it in Change History', async () => {
    renderAt('/admin/office-division-setup');
    await openEditFor('Boston (Region 1)');

    await userEvent.click(
      screen.getByRole('button', { name: /District of Massachusetts \(Boston\)/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(getOfficeRow('Boston')).toHaveTextContent('None');
    expect(getUnassignedRow()).toHaveTextContent('District of Massachusetts (Boston)');

    await userEvent.click(screen.getByRole('link', { name: 'Change History' }));
    const historyTable = screen.getByRole('table', { name: 'Change history' });
    const [, newest] = within(historyTable).getAllByRole('row');
    const cells = within(newest).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('Boston division, District of Massachusetts');
    expect(cells[1]).toHaveTextContent('Boston (Region 1)');
    expect(cells[2]).toHaveTextContent('(unassigned)');
  });

  test('should leave divisions unchanged when the user cancels', async () => {
    renderAt('/admin/office-division-setup');
    await openEditFor('Boston (Region 1)');

    await userEvent.click(
      screen.getByRole('button', { name: /District of Massachusetts \(Boston\)/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(getOfficeRow('Boston')).toHaveTextContent('District of Massachusetts (Boston)');
    expect(alertSpy.success).not.toHaveBeenCalled();
  });
});
