import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BankDetail } from './BankDetail';
import Api2 from '@/lib/models/api2';
import { BankProfile } from '@common/cams/banks';
import TestingUtilities from '@/lib/testing/testing-utilities';

const mockBank: BankProfile = {
  id: 'bank-1',
  documentType: 'BANK_PROFILE',
  name: 'Fifth Third Bank',
  status: 'active',
  updatedOn: '2024-01-01T00:00:00.000Z',
  updatedBy: { id: 'user-1', name: 'User One' },
};

function renderComponent(bankId = 'bank-1') {
  return render(
    <MemoryRouter initialEntries={[`/admin/banks/${bankId}`]}>
      <Routes>
        <Route path="/admin/banks/:bankId/*" element={<BankDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BankDetail', () => {
  beforeEach(() => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    vi.spyOn(Api2, 'getBank').mockResolvedValue({ data: mockBank });
    TestingUtilities.spyOnGlobalAlert();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should show loading then render bank detail page', async () => {
    renderComponent();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Fifth Third Bank', level: 1 }),
      ).toBeInTheDocument();
      const backLink = screen.getByRole('link', { name: /back to banks/i });
      expect(backLink).toHaveAttribute('href', '/admin/banks');
      expect(backLink).toHaveAttribute('title', 'Back to Banks list');

      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('General Information')).toBeInTheDocument();
      expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
      expect(screen.getByTestId('button-edit-bank')).toBeInTheDocument();
    });
  });

  test('should render Inactive status correctly', async () => {
    vi.spyOn(Api2, 'getBank').mockResolvedValue({ data: { ...mockBank, status: 'inactive' } });
    renderComponent();
    await waitFor(() => {
      expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0);
    });
  });

  test('should show error alert when fetch fails', async () => {
    vi.spyOn(Api2, 'getBank').mockRejectedValue(new Error('not found'));
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('alert-container-bank-detail-load-error')).toBeInTheDocument();
    });
  });

  test('should open edit modal when Edit button is clicked', async () => {
    renderComponent();
    const editBtn = await screen.findByTestId('button-edit-bank');
    fireEvent.click(editBtn);
    await waitFor(() => {
      expect(screen.getByTestId('modal-edit-bank-modal')).toHaveClass('is-visible');
    });
  });
});
