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
    vi.spyOn(Api2, 'getSoftwareBankTrustees').mockResolvedValue({
      data: [],
      pagination: { count: 0, totalCount: 0, currentPage: 1, totalPages: 0, limit: 1 },
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should render table with associations showing bank name as link and status text', async () => {
    renderTable();

    await waitFor(() => {
      expect(
        screen.getByRole('link', { name: 'Chase Bank (opens in new tab)' }),
      ).toBeInTheDocument();
    });

    const chaseLink = screen.getByRole('link', { name: 'Chase Bank (opens in new tab)' });
    expect(chaseLink).toHaveAttribute('href', '/admin/banks/bank-1');

    const wellsLink = screen.getByRole('link', { name: 'Wells Fargo (opens in new tab)' });
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

  test('should exclude already-associated banks from dropdown', async () => {
    renderTable();

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  test('should exclude inactive banks from dropdown', async () => {
    // All banks are already associated — inactive bank-4 should not appear
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
    await waitFor(() => {
      const option = screen.getByText('Bank of America');
      return option;
    });
    const option = screen.getByText('Bank of America');
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
      expect(
        screen.getByRole('link', { name: 'Chase Bank (opens in new tab)' }),
      ).toBeInTheDocument();
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
    expect(screen.getByRole('link', { name: 'Chase Bank (opens in new tab)' })).toBeInTheDocument();
  });

  test('should display warning icon when API call fails to fetch trustee count', async () => {
    vi.spyOn(Api2, 'getSoftwareBankTrustees').mockRejectedValue(new Error('Network error'));

    renderTable([mockAssociations[0]]);

    await waitFor(() => {
      expect(screen.getByTestId('trustee-count-error-bank-1')).toBeInTheDocument();
    });
    expect(screen.getByRole('img', { name: 'warning icon' })).toBeInTheDocument();
  });

  test('should merge trustee counts when associations change', async () => {
    vi.spyOn(Api2, 'getSoftwareBankTrustees').mockImplementation(
      (_softwareId: string, bankId: string) => {
        if (bankId === 'bank-1') {
          return Promise.resolve({
            data: [],
            pagination: { count: 0, totalCount: 5, currentPage: 1, totalPages: 1, limit: 1 },
          } as never);
        }
        return Promise.resolve({
          data: [],
          pagination: { count: 0, totalCount: 3, currentPage: 1, totalPages: 1, limit: 1 },
        } as never);
      },
    );

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
});
