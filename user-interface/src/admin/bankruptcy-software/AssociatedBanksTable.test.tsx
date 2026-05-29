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

  test('should call onEditStatus with correct params when Edit Status is clicked for first row', async () => {
    const onEditStatus = vi.fn();
    renderTable(mockAssociations, mockBanks, vi.fn(), onEditStatus);

    const editButtons = screen.getAllByRole('button', { name: 'Edit Status' });
    await userEvent.click(editButtons[0]);

    expect(onEditStatus).toHaveBeenCalledWith('bank-1', 'Chase Bank', 'active');
  });

  test('should call onEditStatus with correct params when Edit Status is clicked for second row', async () => {
    const onEditStatus = vi.fn();
    renderTable(mockAssociations, mockBanks, vi.fn(), onEditStatus);

    const editButtons = screen.getAllByRole('button', { name: 'Edit Status' });
    await userEvent.click(editButtons[1]);

    expect(onEditStatus).toHaveBeenCalledWith('bank-2', 'Wells Fargo', 'inactive');
  });

  test('should show only active unassociated banks in dropdown', async () => {
    renderTable();

    // bank-1 and bank-2 are already associated; bank-4 is inactive
    // Only bank-3 (Bank of America) should appear as an option
    const combobox = screen.getByRole('combobox');
    await userEvent.click(combobox);
    await userEvent.type(combobox, 'Bank');

    await screen.findByText('Bank of America');
    const options = screen.getAllByRole('option');
    const optionLabels = options.map((o) => o.textContent);
    expect(optionLabels).toContain('Bank of America');
    expect(optionLabels).not.toContain('Citibank');
    expect(optionLabels).not.toContain('Chase Bank');
    expect(optionLabels).not.toContain('Wells Fargo');
  });

  test('should disable Add Bank button when no active unassociated banks remain', () => {
    const allAssociated: SoftwareBankAssociation[] = [
      { bankId: 'bank-1', bankName: 'Chase Bank', status: 'active' },
      { bankId: 'bank-2', bankName: 'Wells Fargo', status: 'active' },
      { bankId: 'bank-3', bankName: 'Bank of America', status: 'active' },
    ];
    renderTable(allAssociated, mockBanks);

    // bank-4 (Citibank) is inactive so no banks remain available
    expect(screen.getByTestId('button-add-bank-button')).toBeDisabled();
  });

  test('should call onAddBank after modal confirm', async () => {
    const onAddBank = vi.fn();
    renderTable([], mockBanks, onAddBank);

    const combobox = screen.getByRole('combobox');
    await userEvent.click(combobox);
    await userEvent.type(combobox, 'Bank of America');

    const option = await screen.findByText('Bank of America');
    await userEvent.click(option);

    await userEvent.click(screen.getByTestId('button-add-bank-button'));

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

  test('should not call onAddBank when modal is cancelled', async () => {
    const onAddBank = vi.fn();
    renderTable([], mockBanks, onAddBank);

    const combobox = screen.getByRole('combobox');
    await userEvent.click(combobox);
    await userEvent.type(combobox, 'Bank of America');

    const option = await screen.findByText('Bank of America');
    await userEvent.click(option);

    await userEvent.click(screen.getByTestId('button-add-bank-button'));

    const cancelBtn = await screen.findByRole('button', { name: 'Cancel' });
    await userEvent.click(cancelBtn);

    await waitFor(() => {
      expect(onAddBank).not.toHaveBeenCalled();
    });
  });

  test('should disable Add Bank button when selection is cleared', async () => {
    renderTable([], mockBanks);

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

  test('should render empty table when no associations exist', () => {
    renderTable([]);

    expect(screen.getByRole('heading', { name: 'Associated Banks' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
