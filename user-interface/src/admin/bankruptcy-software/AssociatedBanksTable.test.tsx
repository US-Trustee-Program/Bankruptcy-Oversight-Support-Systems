import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AssociatedBanksTable } from './AssociatedBanksTable';
import { SoftwareBankAssociation } from '@common/cams/bankruptcy-software';
import { BankProfile } from '@common/cams/banks';
import Api2 from '@/lib/models/api2';

const mockAssociations: SoftwareBankAssociation[] = [
  { bankId: 'bank-1', bankName: 'Chase Bank', status: 'active' },
  { bankId: 'bank-2', bankName: 'Wells Fargo', status: 'inactive' },
];

const mockBanks: BankProfile[] = [
  {
    id: 'bank-1',
    documentType: 'BANK_PROFILE',
    name: 'Chase Bank',
    status: 'active',
    updatedOn: '2024-01-01T00:00:00.000Z',
    updatedBy: { id: 'user-1', name: 'User One' },
  },
  {
    id: 'bank-2',
    documentType: 'BANK_PROFILE',
    name: 'Wells Fargo',
    status: 'active',
    updatedOn: '2024-01-01T00:00:00.000Z',
    updatedBy: { id: 'user-1', name: 'User One' },
  },
  {
    id: 'bank-3',
    documentType: 'BANK_PROFILE',
    name: 'Bank of America',
    status: 'active',
    updatedOn: '2024-01-01T00:00:00.000Z',
    updatedBy: { id: 'user-1', name: 'User One' },
  },
  {
    id: 'bank-4',
    documentType: 'BANK_PROFILE',
    name: 'Citibank',
    status: 'inactive',
    updatedOn: '2024-01-01T00:00:00.000Z',
    updatedBy: { id: 'user-1', name: 'User One' },
  },
];

function renderTable(
  associations = mockAssociations,
  allBanks = mockBanks,
  onAddBank = vi.fn(),
  onEditStatus = vi.fn(),
) {
  return render(
    <MemoryRouter>
      <AssociatedBanksTable
        softwareId="sw-1"
        associations={associations}
        allBanks={allBanks}
        onAddBank={onAddBank}
        onEditStatus={onEditStatus}
      />
    </MemoryRouter>,
  );
}

describe('AssociatedBanksTable', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Api2, 'getSoftwareTrusteeCounts').mockResolvedValue({
      data: {},
    } as never);
  });

  test('should render table with associations showing bank name as link and status text', async () => {
    renderTable();

    await waitFor(() => {
      expect(screen.getByText('Chase Bank')).toBeInTheDocument();
    });

    const chaseLink = screen.getByText('Chase Bank').closest('a');
    expect(chaseLink).toHaveAttribute('href', '/admin/banks/bank-1');

    const wellsLink = screen.getByText('Wells Fargo').closest('a');
    expect(wellsLink).toHaveAttribute('href', '/admin/banks/bank-2');

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  test('should render Edit Status button for each association', async () => {
    const onEditStatus = vi.fn();
    renderTable(mockAssociations, mockBanks, vi.fn(), onEditStatus);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Edit Status' })).toHaveLength(2);
    });
  });

  test('should call onEditStatus with correct params when Edit Status is clicked', async () => {
    const onEditStatus = vi.fn();
    renderTable(mockAssociations, mockBanks, vi.fn(), onEditStatus);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Edit Status' })).toHaveLength(2);
    });

    const editButtons = screen.getAllByRole('button', { name: 'Edit Status' });
    await userEvent.click(editButtons[0]);

    expect(onEditStatus).toHaveBeenCalledWith('bank-1', 'Chase Bank', 'active');
  });

  test('should exclude already-associated and inactive banks from dropdown', async () => {
    renderTable();

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const combobox = screen.getByRole('combobox');
    await userEvent.click(combobox);

    // Bank of America (bank-3) is active and not associated — should appear
    await waitFor(() => {
      expect(screen.getByText('Bank of America')).toBeInTheDocument();
    });

    // Chase Bank (bank-1) and Wells Fargo (bank-2) are already associated — should not appear
    expect(screen.queryByRole('option', { name: 'Chase Bank' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Wells Fargo' })).not.toBeInTheDocument();

    // Citibank (bank-4) is inactive — should not appear
    expect(screen.queryByRole('option', { name: 'Citibank' })).not.toBeInTheDocument();
  });

  test('should disable Add Bank button when no available banks', async () => {
    const allAssociated: SoftwareBankAssociation[] = [
      { bankId: 'bank-1', bankName: 'Chase Bank', status: 'active' },
      { bankId: 'bank-2', bankName: 'Wells Fargo', status: 'active' },
      { bankId: 'bank-3', bankName: 'Bank of America', status: 'active' },
    ];
    renderTable(allAssociated, mockBanks);

    await waitFor(() => {
      expect(screen.getByTestId('button-add-bank-button')).toBeDisabled();
    });
  });

  test('should call onAddBank after modal confirm', async () => {
    const onAddBank = vi.fn();
    renderTable([], mockBanks, onAddBank);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    // Type in the combobox to filter and select a bank
    const combobox = screen.getByRole('combobox');
    await userEvent.click(combobox);
    await userEvent.type(combobox, 'Bank of America');

    // Click on the option
    const option = await screen.findByText('Bank of America');
    await userEvent.click(option);

    // Click Add Bank button to open the modal
    const addButton = screen.getByTestId('button-add-bank-button');
    await userEvent.click(addButton);

    // Confirm in the modal
    await waitFor(() => {
      expect(
        screen.getByTestId('button-add-associated-bank-confirm-modal-submit-button'),
      ).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByTestId('button-add-associated-bank-confirm-modal-submit-button'),
    );

    await waitFor(() => {
      expect(onAddBank).toHaveBeenCalledWith('bank-3', 'Bank of America');
    });
  });

  test('should disable Add Bank button when selection is cleared', async () => {
    renderTable([], mockBanks);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const combobox = screen.getByRole('combobox');
    await userEvent.click(combobox);
    await userEvent.type(combobox, 'Bank of America');
    await userEvent.click(await screen.findByText('Bank of America'));

    const addButton = screen.getByTestId('button-add-bank-button');
    expect(addButton).not.toBeDisabled();

    await userEvent.click(screen.getByTestId('button-add-bank-combobox-clear-all'));

    await waitFor(() => {
      expect(addButton).toBeDisabled();
    });
  });

  test('should render empty table when no associations exist', async () => {
    renderTable([]);

    await waitFor(() => {
      expect(screen.getByText('No banks associated yet.')).toBeInTheDocument();
    });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  test('should not show loading spinner when associations change after initial load', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <AssociatedBanksTable
          softwareId="sw-1"
          associations={mockAssociations}
          allBanks={mockBanks}
          onAddBank={vi.fn()}
          onEditStatus={vi.fn()}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Chase Bank')).toBeInTheDocument();
    });

    const updatedAssociations: SoftwareBankAssociation[] = [
      { bankId: 'bank-1', bankName: 'Chase Bank', status: 'inactive' },
      { bankId: 'bank-2', bankName: 'Wells Fargo', status: 'active' },
    ];

    rerender(
      <MemoryRouter>
        <AssociatedBanksTable
          softwareId="sw-1"
          associations={updatedAssociations}
          allBanks={mockBanks}
          onAddBank={vi.fn()}
          onEditStatus={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    const chaseLink = screen.getByText('Chase Bank').closest('a');
    expect(chaseLink).toHaveAttribute('href', '/admin/banks/bank-1');
  });

  test('should display warning icon when API call fails to fetch trustee counts', async () => {
    vi.spyOn(Api2, 'getSoftwareTrusteeCounts').mockRejectedValue(new Error('Network error'));

    renderTable([mockAssociations[0]]);

    await waitFor(() => {
      expect(screen.getByTestId('trustee-count-error-bank-1')).toBeInTheDocument();
    });
    expect(screen.getByRole('img', { name: 'warning icon' })).toBeInTheDocument();
  });

  test('should merge trustee counts when associations change', async () => {
    vi.spyOn(Api2, 'getSoftwareTrusteeCounts')
      .mockResolvedValueOnce({ data: { 'bank-1': 5 } } as never)
      .mockResolvedValueOnce({ data: { 'bank-1': 5, 'bank-2': 3 } } as never);

    const { rerender } = render(
      <MemoryRouter>
        <AssociatedBanksTable
          softwareId="sw-1"
          associations={[mockAssociations[0]]}
          allBanks={mockBanks}
          onAddBank={vi.fn()}
          onEditStatus={vi.fn()}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    rerender(
      <MemoryRouter>
        <AssociatedBanksTable
          softwareId="sw-1"
          associations={mockAssociations}
          allBanks={mockBanks}
          onAddBank={vi.fn()}
          onEditStatus={vi.fn()}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  test('should render trustee count as a link when count is greater than zero', async () => {
    vi.spyOn(Api2, 'getSoftwareTrusteeCounts').mockResolvedValue({
      data: { 'bank-1': 7 },
    } as never);

    renderTable([mockAssociations[0]]);

    await waitFor(() => {
      expect(screen.getByText('7')).toBeInTheDocument();
    });

    const link = screen.getByRole('link', { name: '7 opens in a new tab' });
    expect(link).toHaveAttribute('href', '/admin/bankruptcy-software/sw-1/banks/bank-1/trustees');
  });

  test('should render trustee count as plain text when count is zero', async () => {
    vi.spyOn(Api2, 'getSoftwareTrusteeCounts').mockResolvedValue({
      data: { 'bank-1': 0 },
    } as never);

    renderTable([mockAssociations[0]]);

    await waitFor(() => {
      expect(screen.getByTestId('trustee-count-bank-1')).toBeInTheDocument();
    });

    const countElement = screen.getByTestId('trustee-count-bank-1');
    expect(countElement).toHaveTextContent('0');
    expect(countElement.querySelector('a')).not.toBeInTheDocument();
  });

  test('should render em-dash when trustee count is missing for a bank', async () => {
    // Counts come back for other banks but omit the rendered bank, so its count is undefined
    vi.spyOn(Api2, 'getSoftwareTrusteeCounts').mockResolvedValue({
      data: { 'bank-2': 4 },
    } as never);

    renderTable([mockAssociations[0]]);

    const countElement = await screen.findByTestId('trustee-count-bank-1');
    expect(countElement).toHaveTextContent('—');
    expect(countElement.querySelector('a')).not.toBeInTheDocument();
  });

  test('should show Edit Status button only for associations with active bank profiles', async () => {
    const associations: SoftwareBankAssociation[] = [
      { bankId: 'bank-1', bankName: 'Chase Bank', status: 'active' },
      { bankId: 'bank-4', bankName: 'Citibank', status: 'inactive' },
    ];
    renderTable(associations, mockBanks);
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Edit Status' })).toHaveLength(1);
    });
    // The button belongs to the active bank profile, not the inactive one
    expect(screen.getByTestId('button-edit-status-bank-1')).toBeInTheDocument();
    expect(screen.queryByTestId('button-edit-status-bank-4')).not.toBeInTheDocument();
  });
});
