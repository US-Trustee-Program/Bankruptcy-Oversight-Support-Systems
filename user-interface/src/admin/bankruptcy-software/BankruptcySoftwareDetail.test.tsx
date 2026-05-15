import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BankruptcySoftwareDetail } from './BankruptcySoftwareDetail';
import Api2 from '@/lib/models/api2';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';
import { BankProfile } from '@common/cams/banks';

const mockSoftware: BankruptcySoftwareProfile = {
  id: 'sw-1',
  documentType: 'BANKRUPTCY_SOFTWARE',
  name: 'Axos',
  status: 'active',
  updatedOn: '2024-01-01T00:00:00.000Z',
  updatedBy: { id: 'user-1', name: 'User One' },
};

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
    name: 'Bank of America',
    status: 'active',
    updatedOn: '2024-01-01T00:00:00.000Z',
    updatedBy: { id: 'user-1', name: 'User One' },
  },
];

function renderDetail(softwareId = 'sw-1') {
  return render(
    <MemoryRouter initialEntries={[`/admin/bankruptcy-software/${softwareId}`]}>
      <Routes>
        <Route
          path="/admin/bankruptcy-software/:softwareId/*"
          element={<BankruptcySoftwareDetail />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BankruptcySoftwareDetail', () => {
  beforeEach(() => {
    vi.spyOn(Api2, 'getSoftware').mockResolvedValue({ data: mockSoftware });
    vi.spyOn(Api2, 'getBanks').mockResolvedValue({ data: mockBanks });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should show loading state initially', () => {
    renderDetail();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('should render vendor name heading after loading', async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Axos', level: 1 })).toBeInTheDocument();
    });
  });

  test('should render "Bankruptcy Software" subtitle', async () => {
    renderDetail();
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Bankruptcy Software', level: 2 }),
      ).toBeInTheDocument();
    });
  });

  test('should render back link to software list', async () => {
    renderDetail();
    await waitFor(() => {
      const backLink = screen.getByTestId('back-to-software-link');
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute('href', '/admin/bankruptcy-software');
    });
  });

  test('should render Overview nav link', async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('software-overview-nav-link')).toBeInTheDocument();
    });
  });

  test('should render contact info form at contact-info route', async () => {
    render(
      <MemoryRouter initialEntries={[`/admin/bankruptcy-software/sw-1/contact-info`]}>
        <Routes>
          <Route
            path="/admin/bankruptcy-software/:softwareId/*"
            element={<BankruptcySoftwareDetail />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('contact-info-form')).toBeInTheDocument();
    });
  });

  test('should update software name when contact form calls onSaved', async () => {
    const updatedSoftware: BankruptcySoftwareProfile = { ...mockSoftware, name: 'Axos Renamed' };
    vi.spyOn(Api2, 'updateSoftware').mockResolvedValue({ data: updatedSoftware });

    render(
      <MemoryRouter initialEntries={[`/admin/bankruptcy-software/sw-1/contact-info`]}>
        <Routes>
          <Route
            path="/admin/bankruptcy-software/:softwareId/*"
            element={<BankruptcySoftwareDetail />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('contact-info-form')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('button-save-contact-info'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Axos Renamed', level: 1 })).toBeInTheDocument();
    });
  });

  test('should cancel fetch when component unmounts', async () => {
    vi.spyOn(Api2, 'getSoftware').mockReturnValue(new Promise(() => {}));
    vi.spyOn(Api2, 'getBanks').mockReturnValue(new Promise(() => {}));

    const { unmount } = renderDetail();
    unmount();

    expect(screen.queryByRole('heading', { name: 'Axos', level: 1 })).not.toBeInTheDocument();
  });

  test('should show error alert when fetch fails', async () => {
    vi.spyOn(Api2, 'getSoftware').mockRejectedValue(new Error('not found'));
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('alert-container-software-detail-load-error')).toBeInTheDocument();
    });
  });

  test('should fetch banks list on mount', async () => {
    renderDetail();
    await waitFor(() => {
      expect(Api2.getBanks).toHaveBeenCalled();
    });
  });

  test('should render associated banks section in overview', async () => {
    const softwareWithBanks: BankruptcySoftwareProfile = {
      ...mockSoftware,
      associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase Bank', status: 'active' }],
    };
    vi.spyOn(Api2, 'getSoftware').mockResolvedValue({ data: softwareWithBanks });

    renderDetail();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Associated Banks' })).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'Chase Bank (opens in new tab)' })).toBeInTheDocument();
  });

  test('should update table after adding a bank', async () => {
    vi.spyOn(Api2, 'getSoftware').mockResolvedValue({ data: mockSoftware });

    const updatedSoftware: BankruptcySoftwareProfile = {
      ...mockSoftware,
      associatedBanks: [{ bankId: 'bank-2', bankName: 'Bank of America', status: 'active' }],
    };
    vi.spyOn(Api2, 'addAssociatedBank').mockResolvedValue({ data: updatedSoftware });

    renderDetail();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Associated Banks' })).toBeInTheDocument();
    });

    // Type in combobox and select a bank
    const combobox = screen.getByRole('combobox');
    await userEvent.click(combobox);
    await userEvent.type(combobox, 'Bank of America');

    await waitFor(() => {
      expect(screen.getByText('Bank of America')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('Bank of America'));

    // Click Add Bank button
    const addButton = screen.getByTestId('button-add-bank-button');
    await userEvent.click(addButton);

    // Confirm in modal
    await waitFor(() => {
      expect(
        screen.getByTestId('button-add-associated-bank-confirm-modal-submit-button'),
      ).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByTestId('button-add-associated-bank-confirm-modal-submit-button'),
    );

    await waitFor(() => {
      expect(Api2.addAssociatedBank).toHaveBeenCalledWith('sw-1', 'bank-2', 'Bank of America');
    });
  });
});
