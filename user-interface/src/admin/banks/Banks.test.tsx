import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Banks } from './Banks';
import Api2 from '@/lib/models/api2';
import { BankProfile } from '@common/cams/banks';
import * as AppInsights from '@/lib/hooks/UseApplicationInsights';
import { AddBankModalRef } from './AddBankModal';

const mockShow = vi.fn();
vi.mock('./AddBankModal', () => ({
  AddBankModal: forwardRef<AddBankModalRef, { onSuccess: (bank: BankProfile) => void }>(
    function MockAddBankModal({ onSuccess }, ref) {
      useImperativeHandle(ref, () => ({ show: mockShow, hide: vi.fn() }));
      return (
        <div
          data-testid="mock-add-bank-modal"
          role="button"
          tabIndex={0}
          onClick={() => onSuccess(newBank)}
          onKeyDown={() => onSuccess(newBank)}
        />
      );
    },
  ),
}));

const newBank: BankProfile = {
  id: 'bank-new',
  documentType: 'BANK_PROFILE',
  name: 'New Bank',
  status: 'active',
  updatedOn: '2024-01-01T00:00:00.000Z',
  updatedBy: { id: 'user-1', name: 'User One' },
};

const mockBanks: BankProfile[] = [
  {
    id: 'bank-1',
    documentType: 'BANK_PROFILE',
    name: 'Alpha Bank',
    status: 'active',
    updatedOn: '2024-01-01T00:00:00.000Z',
    updatedBy: { id: 'user-1', name: 'User One' },
  },
  {
    id: 'bank-2',
    documentType: 'BANK_PROFILE',
    name: 'Beta Bank',
    status: 'inactive',
    updatedOn: '2024-01-01T00:00:00.000Z',
    updatedBy: { id: 'user-1', name: 'User One' },
  },
];

function renderComponent() {
  return render(
    <BrowserRouter>
      <Banks />
    </BrowserRouter>,
  );
}

describe('Banks component', () => {
  beforeEach(() => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    vi.spyOn(Api2, 'getBanks').mockResolvedValue({ data: mockBanks });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should show loading state initially', async () => {
    renderComponent();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('should render bank table after loading', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('banks-table')).toBeInTheDocument();
    });
  });

  test('should render "Bank name" and "Status" column headers', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Bank name')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
  });

  test('should render each bank name as plain text', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Alpha Bank')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Alpha Bank' })).not.toBeInTheDocument();
    });
  });

  test('should render "Active" for active bank status', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  test('should render "Inactive" for inactive bank status', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  test('should render "+ Add Bank" button', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('button-add-bank-button')).toBeInTheDocument();
    });
  });

  test('should show error alert when fetch fails', async () => {
    vi.spyOn(Api2, 'getBanks').mockRejectedValue(new Error('network error'));
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('alert-container-banks-load-error')).toBeInTheDocument();
    });
  });

  test('should call modal show() when + Add Bank button is clicked', async () => {
    renderComponent();
    const btn = await screen.findByTestId('button-add-bank-button');
    fireEvent.click(btn);
    expect(mockShow).toHaveBeenCalled();
  });

  test('should append new bank to list and track AppInsights event on success', async () => {
    const trackEventSpy = vi.fn();
    vi.spyOn(AppInsights, 'getAppInsights').mockReturnValue({
      appInsights: { trackEvent: trackEventSpy },
    } as never);

    renderComponent();
    const modal = await screen.findByTestId('mock-add-bank-modal');
    fireEvent.click(modal);

    await waitFor(() => {
      expect(screen.getByText('New Bank')).toBeInTheDocument();
      expect(trackEventSpy).toHaveBeenCalledWith({
        name: 'Bank Created',
        properties: { bankId: newBank.id, bankName: newBank.name },
      });
    });
  });
});
