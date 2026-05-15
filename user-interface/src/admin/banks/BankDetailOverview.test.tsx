import { render, screen } from '@testing-library/react';
import { BankDetailOverview } from './BankDetailOverview';
import { BankProfile } from '@common/cams/banks';

const bank: BankProfile = {
  id: 'bank-1',
  documentType: 'BANK_PROFILE',
  name: 'Fifth Third Bank',
  status: 'active',
  updatedOn: '2024-01-01T00:00:00.000Z',
  updatedBy: { id: 'user-1', name: 'User One' },
};

describe('BankDetailOverview', () => {
  test('should render bank name and Active status', () => {
    render(<BankDetailOverview bank={bank} onEdit={vi.fn()} />);
    expect(screen.getByText('Fifth Third Bank')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  test('should render Inactive status when bank is inactive', () => {
    render(<BankDetailOverview bank={{ ...bank, status: 'inactive' }} onEdit={vi.fn()} />);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  test('should call onEdit when Edit button is clicked', () => {
    const onEdit = vi.fn();
    render(<BankDetailOverview bank={bank} onEdit={onEdit} />);
    screen.getByTestId('button-edit-bank').click();
    expect(onEdit).toHaveBeenCalled();
  });
});
