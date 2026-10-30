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
  ],
  source: {
    name: 'Jane Q. Doe',
    phone: '518-555-0100',
    street: '1 Main St',
    city: 'Albany',
    state: 'NY',
    zip: '12207',
    email: undefined,
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
      <TrusteeComparisonTable comparison={comparison} {...props} />
    </BrowserRouter>,
  );
}

function candidateRow(trusteeName: string) {
  const header = screen.getByRole('rowheader', { name: new RegExp(trusteeName) });
  return header.closest('tr')!;
}

describe('TrusteeComparisonTable', () => {
  test('has one column per field, Name first and Action last, when approval is offered', () => {
    renderTable({ onApprove: vi.fn() });

    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual(['Name', 'Address', 'Phone', 'Email', 'Action']);
    for (const th of screen.getAllByRole('columnheader')) {
      expect(th).toHaveAttribute('scope', 'col');
    }
  });

  test('omits the Email column when the comparison has no email row', () => {
    renderTable({
      comparison: { ...comparison, rows: comparison.rows.filter((r) => r.key !== 'email') },
    });

    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Name',
      'Address',
      'Phone',
    ]);
  });

  test('omits the Action column when approval is not offered', () => {
    renderTable();

    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Name',
      'Address',
      'Phone',
      'Email',
    ]);
  });

  test('renders one row per candidate, in the given order', () => {
    renderTable();

    const rowHeaders = screen.getAllByRole('rowheader');
    expect(rowHeaders).toHaveLength(2);
    expect(rowHeaders[0]).toHaveTextContent('Jane Doe');
    expect(rowHeaders[1]).toHaveTextContent('Janet Doe');
    for (const th of rowHeaders) {
      expect(th).toHaveAttribute('scope', 'row');
    }
  });

  test('links each candidate name to the CAMS trustee', () => {
    renderTable();

    expect(screen.getByRole('link', { name: /Janet Doe/ })).toHaveAttribute('href', '/trustees/t2');
  });

  test('shows each candidate value in its row', () => {
    renderTable();

    const row = within(candidateRow('Jane Doe'));
    expect(row.getAllByRole('cell')[1]).toHaveTextContent('518-555-0199');
  });

  test('combines street, city, state and zip into one Address cell', () => {
    renderTable();

    const row = within(candidateRow('Janet Doe'));
    const addressCell = row.getAllByRole('cell')[0];
    expect(addressCell).toHaveTextContent('1 Main St');
    expect(addressCell).toHaveTextContent('Albany, NY 12207');
  });

  test('marks a differing field with a warning icon placed before its value', () => {
    renderTable();

    const row = within(candidateRow('Jane Doe'));
    const phoneCell = row.getAllByRole('cell')[1];
    const icon = within(phoneCell).getByRole('img', {
      name: 'Phone differs from the source record',
    });
    // Walk up from the icon itself (not a specific wrapper class) to find its containing
    // element's siblings, and confirm the value is one of the later ones.
    const iconContainer = icon.parentElement!;
    const siblings = Array.from(iconContainer.parentElement!.childNodes);
    const textAfterIcon = siblings
      .slice(siblings.indexOf(iconContainer) + 1)
      .some((node) => node.textContent?.includes('518-555-0199'));
    expect(textAfterIcon).toBe(true);
  });

  test('marks the whole Address cell with one icon when any of its parts differs', () => {
    const withAddressDiff = {
      ...comparison,
      candidates: [candidate('t1', 'Jane Doe', { street: { value: '2 Oak St', differs: true } })],
    };
    renderTable({ comparison: withAddressDiff });

    const row = within(candidateRow('Jane Doe'));
    const addressCell = row.getAllByRole('cell')[0];
    expect(
      within(addressCell).getByLabelText('Address differs from the source record'),
    ).toBeInTheDocument();
  });

  test('does not mark a candidate name as differing when it matches', () => {
    renderTable();

    const row = within(candidateRow('Janet Doe'));
    expect(row.queryByLabelText(/differs/)).not.toBeInTheDocument();
  });

  test('marks a differing candidate name', () => {
    const withNameDiff = {
      ...comparison,
      candidates: [candidate('t1', 'Jane Doe', { name: { value: 'Jane Doe', differs: true } })],
    };
    renderTable({ comparison: withNameDiff });

    expect(screen.getByLabelText('Name differs from the source record')).toBeInTheDocument();
  });

  test('shows "Not Provided" without a marker for a missing value', () => {
    renderTable();

    const row = within(candidateRow('Janet Doe'));
    const emailCell = row.getAllByRole('cell')[2];
    expect(emailCell).toHaveTextContent('Not Provided');
    expect(emailCell.querySelector('svg')).toBeNull();
  });

  test('shows "Not Provided" in the Address cell when street, city, state and zip are all missing', () => {
    const withNoAddress = {
      ...comparison,
      candidates: [
        candidate('t1', 'Jane Doe', {
          street: { value: undefined },
          city: { value: undefined },
          state: { value: undefined },
          zip: { value: undefined },
        }),
      ],
    };
    renderTable({ comparison: withNoAddress });

    const row = within(candidateRow('Jane Doe'));
    const addressCell = row.getAllByRole('cell')[0];
    expect(addressCell).toHaveTextContent('Not Provided');
    expect(addressCell.querySelector('svg')).toBeNull();
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

  test('renders no candidate rows when there are no candidates', () => {
    renderTable({ comparison: { ...comparison, candidates: [] } });

    expect(screen.queryAllByRole('rowheader')).toHaveLength(0);
  });
});
