import { render, screen, within } from '@testing-library/react';
import TrusteeInformationReceivedTable from './TrusteeInformationReceivedTable';
import { TrusteeComparison } from './trustee-comparison';

const comparison: TrusteeComparison = {
  rows: [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'street', label: 'Street' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'zip', label: 'Zip' },
    { key: 'email', label: 'Email' },
  ],
  source: {
    name: 'Jane Q. Doe',
    phone: '518-555-0100',
    street: '1 Main St',
    city: 'Albany',
    state: 'NY',
    zip: '12207',
    email: 'jane@example.com',
  },
  candidates: [],
};

describe('TrusteeInformationReceivedTable', () => {
  test('shows Name, Address, Phone, and Email column headers', () => {
    render(<TrusteeInformationReceivedTable comparison={comparison} />);

    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Name',
      'Address',
      'Phone',
      'Email',
    ]);
  });

  test('omits the Email column when the comparison has no email row', () => {
    render(
      <TrusteeInformationReceivedTable
        comparison={{ ...comparison, rows: comparison.rows.filter((r) => r.key !== 'email') }}
      />,
    );

    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Name',
      'Address',
      'Phone',
    ]);
  });

  test('shows the sent record values in a single row', () => {
    render(<TrusteeInformationReceivedTable comparison={comparison} />);

    const row = screen.getByRole('rowheader', { name: 'Jane Q. Doe' }).closest('tr')!;
    expect(row).toHaveTextContent('1 Main St');
    expect(row).toHaveTextContent('Albany, NY 12207');
    expect(row).toHaveTextContent('518-555-0100');
    expect(row).toHaveTextContent('jane@example.com');
  });

  test('shows "Not Provided" for missing values', () => {
    render(
      <TrusteeInformationReceivedTable
        comparison={{
          ...comparison,
          source: { ...comparison.source, email: undefined, street: undefined },
        }}
      />,
    );

    const row = screen.getByRole('rowheader', { name: 'Jane Q. Doe' }).closest('tr')!;
    const [addressCell, , emailCell] = within(row).getAllByRole('cell');
    expect(addressCell).toHaveTextContent('Albany, NY 12207');
    expect(addressCell).not.toHaveTextContent('1 Main St');
    expect(emailCell).toHaveTextContent('Not Provided');
  });

  test('shows "Not Provided" for the address when every part is missing', () => {
    render(
      <TrusteeInformationReceivedTable
        comparison={{
          ...comparison,
          source: {
            ...comparison.source,
            street: undefined,
            city: undefined,
            state: undefined,
            zip: undefined,
          },
        }}
      />,
    );

    const row = screen.getByRole('rowheader', { name: 'Jane Q. Doe' }).closest('tr')!;
    const [addressCell] = within(row).getAllByRole('cell');
    expect(addressCell).toHaveTextContent('Not Provided');
  });

  test('shows "Not Provided" for the name when it is missing', () => {
    render(
      <TrusteeInformationReceivedTable
        comparison={{ ...comparison, source: { ...comparison.source, name: undefined } }}
      />,
    );

    expect(screen.getByRole('rowheader', { name: 'Not Provided' })).toBeInTheDocument();
  });

  test('takes its accessible name from the heading it is labelled by', () => {
    render(
      <>
        <h3 id="received-heading">Trustee Information Received</h3>
        <TrusteeInformationReceivedTable comparison={comparison} labelledBy="received-heading" />
      </>,
    );

    expect(screen.getByRole('table', { name: 'Trustee Information Received' })).toBeInTheDocument();
  });

  describe('reserveActionColumn', () => {
    test('reserves an Action col without adding an Action header or cell', () => {
      render(<TrusteeInformationReceivedTable comparison={comparison} reserveActionColumn />);

      const table = screen.getByTestId('trustee-information-received-table');
      expect(table.querySelectorAll('colgroup col')).toHaveLength(5);
      expect(table.querySelector('.comparison-col-action')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
        'Name',
        'Address',
        'Phone',
        'Email',
      ]);
      const row = screen.getByRole('rowheader', { name: 'Jane Q. Doe' }).closest('tr')!;
      expect(within(row).getAllByRole('cell')).toHaveLength(3);
    });

    test('reserves 4 cols when the comparison has no email row', () => {
      render(
        <TrusteeInformationReceivedTable
          comparison={{ ...comparison, rows: comparison.rows.filter((r) => r.key !== 'email') }}
          reserveActionColumn
        />,
      );

      const table = screen.getByTestId('trustee-information-received-table');
      expect(table.querySelectorAll('colgroup col')).toHaveLength(4);
      expect(screen.getAllByRole('columnheader')).toHaveLength(3);
    });

    test('omits the Action col by default', () => {
      render(<TrusteeInformationReceivedTable comparison={comparison} />);

      const table = screen.getByTestId('trustee-information-received-table');
      expect(table.querySelector('.comparison-col-action')).toBeNull();
      expect(table.querySelectorAll('colgroup col')).toHaveLength(4);
    });
  });

  test('labels each cell of the row with the header text at the same position', () => {
    render(<TrusteeInformationReceivedTable comparison={comparison} />);

    const headers = screen.getAllByRole('columnheader');
    const row = screen.getByRole('rowheader', { name: 'Jane Q. Doe' }).closest('tr')!;
    const cells = Array.from(row.children) as HTMLElement[];
    expect(cells.map((cell) => cell.getAttribute('data-label'))).toEqual([
      'Name',
      'Address',
      'Phone',
      'Email',
    ]);
    cells.forEach((cell, i) => {
      expect(cell.getAttribute('data-label')).toBe(headers[i].textContent);
    });
  });

  test('shows "Not Provided" for phone when it is missing', () => {
    render(
      <TrusteeInformationReceivedTable
        comparison={{ ...comparison, source: { ...comparison.source, phone: undefined } }}
      />,
    );

    const row = screen.getByRole('rowheader', { name: 'Jane Q. Doe' }).closest('tr')!;
    const phoneCell = within(row).getAllByRole('cell')[1];
    expect(phoneCell).toHaveTextContent('Not Provided');
  });
});
