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

  test('takes its accessible name from the heading it is labelled by', () => {
    render(
      <>
        <h3 id="received-heading">Trustee Information Received</h3>
        <TrusteeInformationReceivedTable comparison={comparison} labelledBy="received-heading" />
      </>,
    );

    expect(screen.getByRole('table', { name: 'Trustee Information Received' })).toBeInTheDocument();
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
