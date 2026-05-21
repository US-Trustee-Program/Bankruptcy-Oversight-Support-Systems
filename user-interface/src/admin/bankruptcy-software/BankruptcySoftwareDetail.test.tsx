import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { BankruptcySoftwareDetail } from './BankruptcySoftwareDetail';
import Api2 from '@/lib/models/api2';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';
import { BankProfile } from '@common/cams/banks';
import { ResponseBody } from '@common/api/response';

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
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    vi.spyOn(Api2, 'getSoftware').mockResolvedValue({ data: mockSoftware });
    vi.spyOn(Api2, 'getBanks').mockResolvedValue({ data: mockBanks });
  });

  test('should not fetch when softwareId is absent', () => {
    render(
      <MemoryRouter initialEntries={['/admin/bankruptcy-software/']}>
        <Routes>
          <Route path="/admin/bankruptcy-software/" element={<BankruptcySoftwareDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(Api2.getSoftware).not.toHaveBeenCalled();
  });

  test('should not fetch when softwareId is absent', () => {
    render(
      <MemoryRouter initialEntries={['/admin/bankruptcy-software/']}>
        <Routes>
          <Route path="/admin/bankruptcy-software/" element={<BankruptcySoftwareDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(Api2.getSoftware).not.toHaveBeenCalled();
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

  test('should not update state when fetch resolves after unmount', async () => {
    let resolveFetch!: (value: ResponseBody<BankruptcySoftwareProfile>) => void;
    vi.spyOn(Api2, 'getSoftware').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.spyOn(Api2, 'getBanks').mockResolvedValue({ data: mockBanks });

    const { unmount } = renderDetail();
    unmount();

    resolveFetch({ data: mockSoftware });
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.queryByRole('heading', { name: 'Axos', level: 1 })).not.toBeInTheDocument();
  });

  test('should not update state when fetch rejects after unmount', async () => {
    let rejectFetch!: (reason: Error) => void;
    vi.spyOn(Api2, 'getSoftware').mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectFetch = reject;
        }),
    );
    vi.spyOn(Api2, 'getBanks').mockResolvedValue({ data: mockBanks });

    const { unmount } = renderDetail();
    unmount();

    rejectFetch(new Error('network error'));
    await new Promise((r) => setTimeout(r, 0));

    expect(
      screen.queryByTestId('alert-container-software-detail-load-error'),
    ).not.toBeInTheDocument();
  });

  test('should prevent duplicate add-bank calls on double-click', async () => {
    vi.spyOn(Api2, 'addAssociatedBank').mockImplementation(() => new Promise(() => {}));

    renderDetail();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Associated Banks' })).toBeInTheDocument();
    });

    const combobox = screen.getByRole('combobox');
    await userEvent.click(combobox);
    await userEvent.type(combobox, 'Chase Bank');
    await userEvent.click(await screen.findByText('Chase Bank'));
    await userEvent.click(screen.getByTestId('button-add-bank-button'));

    await waitFor(() => {
      expect(
        screen.getByTestId('button-add-associated-bank-confirm-modal-submit-button'),
      ).toBeInTheDocument();
    });

    const confirmButton = screen.getByTestId(
      'button-add-associated-bank-confirm-modal-submit-button',
    );
    await userEvent.dblClick(confirmButton);

    expect(Api2.addAssociatedBank).toHaveBeenCalledTimes(1);
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

  test('should open edit software modal when Edit General is clicked', async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('button-edit-software-general')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTestId('button-edit-software-general'));
    await waitFor(() => {
      expect(screen.getByTestId('modal-edit-software-modal')).toHaveClass('is-visible');
    });
  });

  test('should navigate to contact-info route when Edit Contact is clicked', async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('button-edit-software-contact')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTestId('button-edit-software-contact'));
    await waitFor(() => {
      expect(screen.getByTestId('contact-info-form')).toBeInTheDocument();
    });
  });

  test('should show error alert when adding a bank fails', async () => {
    vi.spyOn(Api2, 'addAssociatedBank').mockRejectedValue(new Error('server error'));
    const alertSpy = TestingUtilities.spyOnGlobalAlert();
    renderDetail();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Associated Banks' })).toBeInTheDocument();
    });

    const combobox = screen.getByRole('combobox');
    await userEvent.click(combobox);
    await userEvent.type(combobox, 'Chase Bank');
    await userEvent.click(await screen.findByText('Chase Bank'));
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
      expect(alertSpy.error).toHaveBeenCalledWith(
        'Failed to add associated bank. Please try again.',
      );
    });
  });

  test('should open edit bank status modal when Edit Status is clicked', async () => {
    const softwareWithBanks: BankruptcySoftwareProfile = {
      ...mockSoftware,
      associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase Bank', status: 'active' }],
    };
    vi.spyOn(Api2, 'getSoftware').mockResolvedValue({ data: softwareWithBanks });

    renderDetail();

    await waitFor(() => {
      expect(screen.getByTestId('button-edit-status-bank-1')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTestId('button-edit-status-bank-1'));
    await waitFor(() => {
      expect(screen.getByTestId('modal-edit-bank-association-status-modal')).toHaveClass(
        'is-visible',
      );
    });
  });

  test('should show API error message when adding a bank fails with status < 500', async () => {
    const apiError = {
      status: 400,
      message: 'This bank is already associated with this software.',
    };
    vi.spyOn(Api2, 'addAssociatedBank').mockRejectedValue(apiError);
    const alertSpy = TestingUtilities.spyOnGlobalAlert();
    renderDetail();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Associated Banks' })).toBeInTheDocument();
    });

    const combobox = screen.getByRole('combobox');
    await userEvent.click(combobox);
    await userEvent.type(combobox, 'Chase Bank');
    await userEvent.click(await screen.findByText('Chase Bank'));
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
      expect(alertSpy.error).toHaveBeenCalledWith(
        'This bank is already associated with this software.',
      );
    });
  });

  test('should update software state after saving bank status', async () => {
    const softwareWithBanks: BankruptcySoftwareProfile = {
      ...mockSoftware,
      associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase Bank', status: 'active' }],
    };
    vi.spyOn(Api2, 'getSoftware').mockResolvedValue({ data: softwareWithBanks });

    const updatedSoftware: BankruptcySoftwareProfile = {
      ...mockSoftware,
      associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase Bank', status: 'inactive' }],
    };
    vi.spyOn(Api2, 'updateBankAssociationStatus').mockResolvedValue({ data: updatedSoftware });
    const alertSpy = TestingUtilities.spyOnGlobalAlert();

    renderDetail();

    await waitFor(() => {
      expect(screen.getByTestId('button-edit-status-bank-1')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTestId('button-edit-status-bank-1'));

    await waitFor(() => {
      expect(screen.getByTestId('modal-edit-bank-association-status-modal')).toHaveClass(
        'is-visible',
      );
    });

    await userEvent.click(
      screen.getByTestId(
        'button-radio-edit-bank-association-status-modal-status-inactive-click-target',
      ),
    );
    await userEvent.click(
      screen.getByTestId('button-edit-bank-association-status-modal-submit-button'),
    );

    await waitFor(() => {
      expect(Api2.updateBankAssociationStatus).toHaveBeenCalledWith('sw-1', 'bank-1', 'inactive');
    });
    await waitFor(() => {
      expect(alertSpy.success).toHaveBeenCalledWith('Chase Bank status has been updated.');
    });
  });

  test('should show API error message when saving bank status fails with status < 500', async () => {
    const softwareWithBanks: BankruptcySoftwareProfile = {
      ...mockSoftware,
      associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase Bank', status: 'active' }],
    };
    vi.spyOn(Api2, 'getSoftware').mockResolvedValue({ data: softwareWithBanks });

    const apiError = {
      status: 400,
      message: 'The specified bank is not associated with this software.',
    };
    vi.spyOn(Api2, 'updateBankAssociationStatus').mockRejectedValue(apiError);
    const alertSpy = TestingUtilities.spyOnGlobalAlert();

    renderDetail();

    await waitFor(() => {
      expect(screen.getByTestId('button-edit-status-bank-1')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTestId('button-edit-status-bank-1'));

    await waitFor(() => {
      expect(screen.getByTestId('modal-edit-bank-association-status-modal')).toHaveClass(
        'is-visible',
      );
    });

    await userEvent.click(
      screen.getByTestId(
        'button-radio-edit-bank-association-status-modal-status-inactive-click-target',
      ),
    );
    await userEvent.click(
      screen.getByTestId('button-edit-bank-association-status-modal-submit-button'),
    );

    await waitFor(() => {
      expect(alertSpy.error).toHaveBeenCalledWith(
        'The specified bank is not associated with this software.',
      );
    });
  });

  test('should show generic error when saving bank status fails with status >= 500', async () => {
    const softwareWithBanks: BankruptcySoftwareProfile = {
      ...mockSoftware,
      associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase Bank', status: 'active' }],
    };
    vi.spyOn(Api2, 'getSoftware').mockResolvedValue({ data: softwareWithBanks });
    vi.spyOn(Api2, 'updateBankAssociationStatus').mockRejectedValue(new Error('Internal error'));
    const alertSpy = TestingUtilities.spyOnGlobalAlert();

    renderDetail();

    await waitFor(() => {
      expect(screen.getByTestId('button-edit-status-bank-1')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTestId('button-edit-status-bank-1'));

    await waitFor(() => {
      expect(screen.getByTestId('modal-edit-bank-association-status-modal')).toHaveClass(
        'is-visible',
      );
    });

    await userEvent.click(
      screen.getByTestId(
        'button-radio-edit-bank-association-status-modal-status-inactive-click-target',
      ),
    );
    await userEvent.click(
      screen.getByTestId('button-edit-bank-association-status-modal-submit-button'),
    );

    await waitFor(() => {
      expect(alertSpy.error).toHaveBeenCalledWith(
        'Failed to update bank status. Please try again.',
      );
    });
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
