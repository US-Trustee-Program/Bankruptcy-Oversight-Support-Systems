import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { BankruptcySoftware } from './BankruptcySoftware';
import Api2 from '@/lib/models/api2';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';
import * as AppInsights from '@/lib/hooks/UseApplicationInsights';
import { AddSoftwareModalRef } from './AddSoftwareModal';

const mockShow = vi.fn();
vi.mock('./AddSoftwareModal', () => ({
  AddSoftwareModal: forwardRef<
    AddSoftwareModalRef,
    { onSuccess: (software: BankruptcySoftwareProfile) => void }
  >(function MockAddSoftwareModal({ onSuccess }, ref) {
    useImperativeHandle(ref, () => ({ show: mockShow, hide: vi.fn() }));
    return (
      <div
        data-testid="mock-add-software-modal"
        role="button"
        tabIndex={0}
        onClick={() => onSuccess(newSoftware)}
        onKeyDown={() => onSuccess(newSoftware)}
      />
    );
  }),
}));

const newSoftware: BankruptcySoftwareProfile = {
  id: 'sw-new',
  documentType: 'BANKRUPTCY_SOFTWARE',
  name: 'New Software',
  status: 'active',
  updatedOn: '2024-01-01T00:00:00.000Z',
  updatedBy: { id: 'user-1', name: 'User One' },
};

const mockSoftwareList: BankruptcySoftwareProfile[] = [
  {
    id: 'sw-1',
    documentType: 'BANKRUPTCY_SOFTWARE',
    name: 'Axos',
    status: 'active',
    updatedOn: '2024-01-01T00:00:00.000Z',
    updatedBy: { id: 'user-1', name: 'User One' },
  },
  {
    id: 'sw-2',
    documentType: 'BANKRUPTCY_SOFTWARE',
    name: 'BlueStylus',
    status: 'active',
    updatedOn: '2024-01-01T00:00:00.000Z',
    updatedBy: { id: 'user-1', name: 'User One' },
  },
];

function renderComponent() {
  return render(
    <BrowserRouter>
      <BankruptcySoftware />
    </BrowserRouter>,
  );
}

describe('BankruptcySoftware component', () => {
  beforeEach(() => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    vi.spyOn(Api2, 'getSoftwareList').mockResolvedValue({ data: mockSoftwareList });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should show loading state initially', async () => {
    renderComponent();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('should render software table after loading', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('bankruptcy-software-table')).toBeInTheDocument();
    });
  });

  test('should render "Software Name" column header', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Software Name')).toBeInTheDocument();
    });
  });

  test('should render each software name as a link to the detail page', async () => {
    renderComponent();
    await waitFor(() => {
      const axosLink = screen.getByRole('link', { name: 'Axos' });
      expect(axosLink).toBeInTheDocument();
      expect(axosLink).toHaveAttribute('href', '/admin/bankruptcy-software/sw-1');
      const blueStylusLink = screen.getByRole('link', { name: 'BlueStylus' });
      expect(blueStylusLink).toHaveAttribute('href', '/admin/bankruptcy-software/sw-2');
    });
  });

  test('should render "+ Add Software" button', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('button-add-software-button')).toBeInTheDocument();
    });
  });

  test('should show error alert when fetch fails', async () => {
    vi.spyOn(Api2, 'getSoftwareList').mockRejectedValue(new Error('network error'));
    renderComponent();
    await waitFor(() => {
      expect(
        screen.getByTestId('alert-container-bankruptcy-software-load-error'),
      ).toBeInTheDocument();
    });
  });

  test('should call modal show() when + Add Software button is clicked', async () => {
    renderComponent();
    const btn = await screen.findByTestId('button-add-software-button');
    fireEvent.click(btn);
    expect(mockShow).toHaveBeenCalled();
  });

  test('should append new software to list and track AppInsights event on success', async () => {
    const trackEventSpy = vi.fn();
    vi.spyOn(AppInsights, 'getAppInsights').mockReturnValue({
      appInsights: { trackEvent: trackEventSpy },
    } as never);

    renderComponent();
    const modal = await screen.findByTestId('mock-add-software-modal');
    fireEvent.click(modal);

    await waitFor(() => {
      expect(screen.getByText('New Software')).toBeInTheDocument();
      expect(trackEventSpy).toHaveBeenCalledWith({
        name: 'Bankruptcy Software Created',
        properties: { softwareId: newSoftware.id, softwareName: newSoftware.name },
      });
    });
  });
});
