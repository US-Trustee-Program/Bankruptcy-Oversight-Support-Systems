import { render, screen, within, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TrusteeComparisonTable from './TrusteeComparisonTable';
import { ComparisonCandidate, ComparisonCell, TrusteeComparison } from './trustee-comparison';

function cells(
  overrides: Partial<Record<keyof ComparisonCandidate['cells'], Partial<ComparisonCell>>> = {},
): ComparisonCandidate['cells'] {
  const base: ComparisonCandidate['cells'] = {
    name: { value: 'Jane Doe', differs: false },
    phone: { value: '518-555-0100', differs: false },
    street: { value: '1 Main St', differs: false },
    city: { value: 'Albany', differs: false },
    state: { value: 'NY', differs: false },
    zip: { value: '12207', differs: false },
    email: { value: 'jane@example.com', differs: false },
    foundBy: { value: 'Exact surname', differs: false },
  };
  for (const [key, cell] of Object.entries(overrides)) {
    base[key as keyof typeof base] = { ...base[key as keyof typeof base], ...cell };
  }
  return base;
}

function candidate(
  trusteeId: string,
  trusteeName: string,
  cellOverrides?: Parameters<typeof cells>[0],
): ComparisonCandidate {
  return {
    trusteeId,
    trusteeName,
    camsRaw: { trusteeId, name: trusteeName, firstName: '', lastName: trusteeName },
    cells: cells(cellOverrides),
  };
}

const comparison: TrusteeComparison = {
  rows: [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'street', label: 'Street' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'zip', label: 'Zip' },
    { key: 'email', label: 'Email' },
    { key: 'foundBy', label: 'Found by' },
  ],
  source: {
    name: 'Jane Q. Doe',
    phone: '518-555-0100',
    street: '1 Main St',
    city: 'Albany',
    state: 'NY',
    zip: '12207',
    email: undefined,
    foundBy: undefined,
  },
  candidates: [
    candidate('t1', 'Jane Doe', {
      phone: { value: '518-555-0199', differs: true },
      state: { value: 'NJ', differs: true },
    }),
    candidate('t2', 'Janet Doe', { email: { value: undefined } }),
  ],
};

function renderTable(props: Partial<Parameters<typeof TrusteeComparisonTable>[0]> = {}) {
  return render(
    <BrowserRouter>
      <TrusteeComparisonTable
        comparison={comparison}
        sourceLabel="Source record (DXTR)"
        {...props}
      />
    </BrowserRouter>,
  );
}

function rowCells(label: string) {
  const header = screen.getByRole('rowheader', { name: label });
  return within(header.closest('tr')!).getAllByRole('cell');
}

describe('TrusteeComparisonTable', () => {
  test('puts the source record first, then one column per candidate in the given order', () => {
    renderTable();

    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual(['Field', 'Source record (DXTR)', 'Jane Doe', 'Janet Doe']);
    for (const th of screen.getAllByRole('columnheader')) {
      expect(th).toHaveAttribute('scope', 'col');
    }
  });

  test('links each candidate column header to the CAMS trustee', () => {
    renderTable();

    expect(screen.getByRole('link', { name: /Janet Doe/ })).toHaveAttribute('href', '/trustees/t2');
  });

  test('renders one row header per comparison row', () => {
    renderTable();

    const rowHeaders = screen.getAllByRole('rowheader');
    expect(rowHeaders.map((th) => th.textContent)).toEqual([
      'Name',
      'Phone',
      'Street',
      'City',
      'State',
      'Zip',
      'Email',
      'Found by',
    ]);
    for (const th of rowHeaders) {
      expect(th).toHaveAttribute('scope', 'row');
    }
  });

  test('shows the source value and each candidate value in a row', () => {
    renderTable();

    expect(rowCells('Phone').map((td) => td.textContent)).toEqual([
      '518-555-0100',
      '518-555-0199',
      '518-555-0100',
    ]);
  });

  test('marks a differing cell with a warning icon that has an accessible name', () => {
    renderTable();

    const [, janeDoePhone, janetDoePhone] = rowCells('Phone');
    expect(
      within(janeDoePhone).getByLabelText('Phone differs from the source record'),
    ).toBeInTheDocument();
    expect(within(janetDoePhone).queryByLabelText(/differs/)).not.toBeInTheDocument();
  });

  test('marks a State difference with the same warning icon as any other field', () => {
    renderTable();

    const [, janeDoeState] = rowCells('State');
    const [, janeDoePhone] = rowCells('Phone');
    const stateIcon = within(janeDoeState).getByLabelText('State differs from the source record');
    const phoneIcon = within(janeDoePhone).getByLabelText('Phone differs from the source record');
    expect(stateIcon.getAttribute('class')).toBe(phoneIcon.getAttribute('class'));
    expect(janeDoeState.className).toBe(janeDoePhone.className);
  });

  test('shows "Not Provided" without a marker for a missing value', () => {
    renderTable();

    const [sourceEmail, , janetDoeEmail] = rowCells('Email');
    expect(sourceEmail).toHaveTextContent('Not Provided');
    expect(janetDoeEmail).toHaveTextContent('Not Provided');
    expect(janetDoeEmail.querySelector('svg')).toBeNull();
  });

  test('leaves the source record Found by cell empty', () => {
    renderTable();

    const [sourceFoundBy, janeDoeFoundBy] = rowCells('Found by');
    expect(sourceFoundBy).toHaveTextContent('');
    expect(janeDoeFoundBy).toHaveTextContent('Exact surname');
  });

  test('offers Match Trustee for each candidate and reports the chosen one', () => {
    const onApprove = vi.fn();
    renderTable({ onApprove });

    fireEvent.click(screen.getByRole('button', { name: 'Match Trustee Janet Doe' }));

    expect(onApprove).toHaveBeenCalledWith(comparison.candidates[1]);
    expect(screen.getAllByRole('button', { name: /Match Trustee/ })).toHaveLength(2);
  });

  test('gives each Match Trustee button a distinct accessible name', () => {
    renderTable({ onApprove: vi.fn() });

    expect(screen.getByRole('button', { name: 'Match Trustee Jane Doe' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Match Trustee Janet Doe' })).toBeInTheDocument();
  });

  test('disables Match Trustee while an approval is processing', () => {
    renderTable({ onApprove: vi.fn(), isProcessing: true });

    for (const button of screen.getAllByRole('button', { name: /Match Trustee/ })) {
      expect(button).toBeDisabled();
    }
  });

  test('has no Match Trustee buttons when approval is not offered', () => {
    renderTable();

    expect(screen.queryByRole('button', { name: /Match Trustee/ })).not.toBeInTheDocument();
  });

  test('shows only the source column when there are no candidates', () => {
    renderTable({ comparison: { ...comparison, candidates: [] } });

    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Field',
      'Source record (DXTR)',
    ]);
  });
});
