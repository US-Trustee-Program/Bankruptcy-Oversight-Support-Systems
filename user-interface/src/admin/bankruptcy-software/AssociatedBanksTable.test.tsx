import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AssociatedBanksTable } from './AssociatedBanksTable';
import { SoftwareBankAssociation } from '@common/cams/bankruptcy-software';
import { BankProfile } from '@common/cams/banks';

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
        associations={associations}
        allBanks={allBanks}
        onAddBank={onAddBank}
        onEditStatus={onEditStatus}
      />
    </MemoryRouter>,
  );
}

describe('AssociatedBanksTable', () => {
  test('should render table with associations showing bank name as link and status text', () => {
    renderTable();

    const chaseLink = screen.getByRole('link', { name: 'Chase Bank (opens in new tab)' });
    expect(chaseLink).toHaveAttribute('href', '/admin/banks/bank-1');

    const wellsLink = screen.getByRole('link', { name: 'Wells Fargo (opens in new tab)' });
    expect(wellsLink).toHaveAttribute('href', '/admin/banks/bank-2');

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  test('should render Edit Status button for each association', () => {
    const onEditStatus = vi.fn();
    renderTable(mockAssociations, mockBanks, vi.fn(), onEditStatus);

    const editButtons = screen.getAllByRole('button', { name: 'Edit Status' });
    expect(editButtons).toHaveLength(2);
  });

  test('should call onEditStatus with correct params when Edit Status is clicked', async () => {
    const onEditStatus = vi.fn();
    renderTable(mockAssociations, mockBanks, vi.fn(), onEditStatus);

    const editButtons = screen.getAllByRole('button', { name: 'Edit Status' });
    await userEvent.click(editButtons[0]);

    expect(onEditStatus).toHaveBeenCalledWith('bank-1', 'Chase Bank', 'active');
  });

  test('should exclude already-associated banks from dropdown', () => {
    renderTable();

    // bank-1 and bank-2 are already associated, bank-4 is inactive
    // Only bank-3 (Bank of America) should be available
    const combobox = screen.getByRole('combobox');
    expect(combobox).toBeInTheDocument();
  });

  test('should exclude inactive banks from dropdown', () => {
    // All banks are already associated — inactive bank-4 should not appear
    const allAssociated: SoftwareBankAssociation[] = [
      { bankId: 'bank-1', bankName: 'Chase Bank', status: 'active' },
      { bankId: 'bank-2', bankName: 'Wells Fargo', status: 'active' },
      { bankId: 'bank-3', bankName: 'Bank of America', status: 'active' },
    ];
    renderTable(allAssociated, mockBanks);

    // The Add Bank button should be disabled since no banks are available
    const addButton = screen.getByTestId('button-add-bank-button');
    expect(addButton).toBeDisabled();
  });

  test('should disable Add Bank button when no available banks', () => {
    const allAssociated: SoftwareBankAssociation[] = [
      { bankId: 'bank-1', bankName: 'Chase Bank', status: 'active' },
      { bankId: 'bank-2', bankName: 'Wells Fargo', status: 'active' },
      { bankId: 'bank-3', bankName: 'Bank of America', status: 'active' },
    ];
    renderTable(allAssociated, mockBanks);

    const addButton = screen.getByTestId('button-add-bank-button');
    expect(addButton).toBeDisabled();
  });

  test('should call onAddBank after modal confirm', async () => {
    const onAddBank = vi.fn();
    renderTable([], mockBanks, onAddBank);

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

  test('should render empty table when no associations exist', () => {
    renderTable([]);

    expect(screen.getByRole('heading', { name: 'Associated Banks' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
