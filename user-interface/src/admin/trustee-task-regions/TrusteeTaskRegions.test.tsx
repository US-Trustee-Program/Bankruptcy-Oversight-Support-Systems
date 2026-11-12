import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TrusteeTaskRegions } from './TrusteeTaskRegions';
import Api2 from '@/lib/models/api2';
import { RegionCaseAppointmentSource } from '@common/cams/trustee-appointments';

const mockSources: RegionCaseAppointmentSource[] = [
  { regionId: '02', regionName: 'NEW YORK', source: 'ACMS' },
  { regionId: '03', regionName: 'PHILADELPHIA', source: 'DXTR' },
  { regionId: '10', regionName: 'INDIANAPOLIS', source: 'ACMS' },
];

function renderComponent() {
  return render(
    <BrowserRouter>
      <TrusteeTaskRegions />
    </BrowserRouter>,
  );
}

describe('TrusteeTaskRegions component', () => {
  beforeEach(() => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    vi.spyOn(Api2, 'getCaseAppointmentSources').mockResolvedValue({ data: mockSources });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should show loading state initially', () => {
    renderComponent();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('should render the regions table after loading', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('trustee-task-regions-table')).toBeInTheDocument();
    });
  });

  test('should render "Region" and "Source" column headers', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Region')).toBeInTheDocument();
      expect(screen.getByText('Source')).toBeInTheDocument();
    });
  });

  test('should render an un-padded region id for each row', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.queryByText('02')).not.toBeInTheDocument();
    });
  });

  test('should render a disabled "Change to DXTR" button for an ACMS region, with no "ACMS" label', async () => {
    renderComponent();
    await waitFor(() => {
      const button = screen.getByTestId('button-change-to-dxtr-02');
      expect(button).toHaveTextContent('Change to DXTR');
      expect(button).toBeDisabled();
    });
    expect(screen.queryByText('ACMS')).not.toBeInTheDocument();
  });

  test('should render "Using DXTR" with no button for a DXTR region', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Using DXTR')).toBeInTheDocument();
      expect(screen.queryByTestId('button-change-to-dxtr-03')).not.toBeInTheDocument();
    });
  });

  test('should show the load error message instead of the table when fetch fails', async () => {
    vi.spyOn(Api2, 'getCaseAppointmentSources').mockRejectedValue(new Error('network error'));
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('alert-message-trustee-task-regions-load-error')).toHaveTextContent(
        'Failed to load region sources. network error',
      );
    });
    expect(screen.queryByTestId('trustee-task-regions-table')).not.toBeInTheDocument();
  });
});
