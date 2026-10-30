import { render, screen, within } from '@testing-library/react';
import { OfficeDivisionSetupChangeHistory } from './OfficeDivisionSetupChangeHistory';
import { DivisionMoveHistoryEntry } from './office-division-setup-data';

const PROTOTYPE_CHANGE_HISTORY: DivisionMoveHistoryEntry[] = [
  {
    id: 'history-2',
    divisionName: 'Poughkeepsie',
    courtName: 'Southern District of New York',
    previousOffice: { regionId: '2', officeName: 'Albany' },
    newOffice: { regionId: '2', officeName: 'Manhattan' },
    changedBy: 'Jane Smith',
    changedOn: '2026-10-27T15:12:00Z',
  },
  {
    id: 'history-1',
    divisionName: 'Syracuse',
    courtName: 'Northern District of New York',
    previousOffice: { regionId: '2', officeName: 'Utica' },
    newOffice: { regionId: '2', officeName: 'Albany' },
    changedBy: 'Jane Smith',
    changedOn: '2026-10-20T14:03:00Z',
  },
];

describe('OfficeDivisionSetupChangeHistory', () => {
  function getBodyRows() {
    const table = screen.getByRole('table', { name: 'Change history' });
    const [, ...rows] = within(table).getAllByRole('row');
    return rows;
  }

  test('should show Change, Previous, New, Changed by, and Date columns in order', () => {
    render(<OfficeDivisionSetupChangeHistory history={PROTOTYPE_CHANGE_HISTORY} />);

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers).toEqual(['Change', 'Previous', 'New', 'Changed by', 'Date']);
  });

  test('should show the moved division, its old and new office, who moved it, and when', () => {
    render(<OfficeDivisionSetupChangeHistory history={PROTOTYPE_CHANGE_HISTORY} />);

    const cells = within(getBodyRows()[0]).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('Poughkeepsie division, Southern District of New York');
    expect(cells[1]).toHaveTextContent('Albany (Region 2)');
    expect(cells[2]).toHaveTextContent('Manhattan (Region 2)');
    expect(cells[3]).toHaveTextContent('Jane Smith');
    expect(cells[4]).toHaveTextContent('10/27/2026');
  });

  test('should list the newest change first', () => {
    const reversed = [...PROTOTYPE_CHANGE_HISTORY].reverse();
    render(<OfficeDivisionSetupChangeHistory history={reversed} />);

    const firstChange = within(getBodyRows()[0]).getAllByRole('cell')[0];
    expect(firstChange).toHaveTextContent('Poughkeepsie');
  });

  test('should show (unassigned) when a division had or has no office', () => {
    render(
      <OfficeDivisionSetupChangeHistory
        history={[{ ...PROTOTYPE_CHANGE_HISTORY[0], newOffice: null }]}
      />,
    );

    expect(within(getBodyRows()[0]).getAllByRole('cell')[2]).toHaveTextContent('(unassigned)');
  });

  test('should explain that nothing has changed yet when there is no history', () => {
    render(<OfficeDivisionSetupChangeHistory history={[]} />);

    expect(screen.getByText('No changes have been made to office divisions.')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Change history' })).not.toBeInTheDocument();
  });
});
