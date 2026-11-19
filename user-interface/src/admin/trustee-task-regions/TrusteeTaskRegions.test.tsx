import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { TrusteeTaskRegions } from './TrusteeTaskRegions';
import Api2 from '@/lib/models/api2';
import { RegionCaseAppointmentSource } from '@common/cams/trustee-appointments';
import TestingUtilities from '@/lib/testing/testing-utilities';

const SUBMIT_BUTTON = 'button-change-to-dxtr-confirm-modal-submit-button';
const CANCEL_BUTTON = 'button-change-to-dxtr-confirm-modal-cancel-button';

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
    vi.restoreAllMocks();
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    vi.spyOn(Api2, 'getCaseAppointmentSources').mockResolvedValue({ data: mockSources });
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

  test('should render an enabled "Change to DXTR" button for an ACMS region, with no "ACMS" label', async () => {
    renderComponent();
    await waitFor(() => {
      const button = screen.getByTestId('button-change-to-dxtr-02');
      expect(button).toHaveTextContent('Change to DXTR');
      expect(button).toBeEnabled();
      expect(button).toHaveAccessibleName('Change to DXTR for Region 2');
    });
    expect(screen.queryByText('ACMS')).not.toBeInTheDocument();
  });

  test('should render "Using DXTR" with no button for a DXTR region', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Using DXTR')).toBeInTheDocument();
      expect(screen.queryByTestId('button-change-to-dxtr-03')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('using-dxtr-03')).toHaveTextContent('Using DXTR for Region 3');
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

  describe('switching a region to DXTR', () => {
    let alertHook: ReturnType<typeof TestingUtilities.spyOnGlobalAlert>;

    beforeEach(() => {
      alertHook = TestingUtilities.spyOnGlobalAlert();
    });

    async function openDialogForRegion02() {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByTestId('button-change-to-dxtr-02')).toBeInTheDocument();
      });
      await userEvent.click(screen.getByTestId('button-change-to-dxtr-02'));
      await waitFor(() => {
        expect(screen.getByTestId('modal-change-to-dxtr-confirm-modal')).toHaveClass('is-visible');
      });
    }

    test('clicking the button opens the confirmation dialog for that region', async () => {
      await openDialogForRegion02();

      expect(document.getElementById('change-to-dxtr-confirm-modal-heading')).toHaveTextContent(
        'Region 2',
      );
    });

    test('cancelling or closing with Escape calls no API and leaves the button enabled', async () => {
      const patchSpy = vi.spyOn(Api2, 'patchCaseAppointmentSource');
      await openDialogForRegion02();
      await userEvent.click(screen.getByTestId(CANCEL_BUTTON));
      expect(patchSpy).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByTestId('modal-change-to-dxtr-confirm-modal')).toHaveClass('is-hidden');
      });
      expect(screen.getByTestId('button-change-to-dxtr-02')).toBeEnabled();

      // Reopen the same rendered dialog and dismiss it the other way.
      await userEvent.click(screen.getByTestId('button-change-to-dxtr-02'));
      await waitFor(() => {
        expect(screen.getByTestId('modal-change-to-dxtr-confirm-modal')).toHaveClass('is-visible');
      });
      await userEvent.keyboard('{Escape}');
      expect(patchSpy).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByTestId('modal-change-to-dxtr-confirm-modal')).toHaveClass('is-hidden');
      });
    });

    test('confirming closes the dialog immediately, disables only that row, and calls the API', async () => {
      let resolveSwitch: (value: { data: RegionCaseAppointmentSource }) => void = () => {};
      const patchSpy = vi
        .spyOn(Api2, 'patchCaseAppointmentSource')
        .mockImplementation(() => new Promise((resolve) => (resolveSwitch = resolve)));
      await openDialogForRegion02();

      await userEvent.click(screen.getByTestId(SUBMIT_BUTTON));

      await waitFor(() => {
        expect(screen.getByTestId('modal-change-to-dxtr-confirm-modal')).toHaveClass('is-hidden');
      });
      expect(patchSpy).toHaveBeenCalledWith('02');
      expect(screen.getByTestId('button-change-to-dxtr-02')).toBeDisabled();
      // Other rows are untouched while region 02 is in flight.
      expect(screen.getByTestId('button-change-to-dxtr-10')).toBeEnabled();

      resolveSwitch({ data: { regionId: '02', regionName: 'NEW YORK', source: 'DXTR' } });
      await waitFor(() => {
        expect(screen.getByText('Using DXTR')).toBeInTheDocument();
      });
    });

    test('confirming a second region while the first is in flight keeps each row disabled until its own request finishes', async () => {
      const resolvers: Record<string, (value: { data: RegionCaseAppointmentSource }) => void> = {};
      vi.spyOn(Api2, 'patchCaseAppointmentSource').mockImplementation(
        (regionId: string) => new Promise((resolve) => (resolvers[regionId] = resolve)),
      );
      await openDialogForRegion02();
      await userEvent.click(screen.getByTestId(SUBMIT_BUTTON));
      await waitFor(() => {
        expect(screen.getByTestId('modal-change-to-dxtr-confirm-modal')).toHaveClass('is-hidden');
      });

      await userEvent.click(screen.getByTestId('button-change-to-dxtr-10'));
      await waitFor(() => {
        expect(screen.getByTestId('modal-change-to-dxtr-confirm-modal')).toHaveClass('is-visible');
      });
      await userEvent.click(screen.getByTestId(SUBMIT_BUTTON));
      await waitFor(() => {
        expect(screen.getByTestId('button-change-to-dxtr-10')).toBeDisabled();
      });
      expect(screen.getByTestId('button-change-to-dxtr-02')).toBeDisabled();

      resolvers['02']({ data: { regionId: '02', regionName: 'NEW YORK', source: 'DXTR' } });
      await waitFor(() => {
        expect(screen.getByTestId('using-dxtr-02')).toBeInTheDocument();
      });
      expect(screen.getByTestId('button-change-to-dxtr-10')).toBeDisabled();

      resolvers['10']({ data: { regionId: '10', regionName: 'INDIANAPOLIS', source: 'DXTR' } });
      await waitFor(() => {
        expect(screen.getByTestId('using-dxtr-10')).toBeInTheDocument();
      });
    });

    test('success replaces the row with "Using DXTR", shows the alert, and moves focus there', async () => {
      vi.spyOn(Api2, 'patchCaseAppointmentSource').mockResolvedValue({
        data: { regionId: '02', regionName: 'NEW YORK', source: 'DXTR' },
      });
      await openDialogForRegion02();

      await userEvent.click(screen.getByTestId(SUBMIT_BUTTON));

      await waitFor(() => {
        expect(alertHook.success).toHaveBeenCalledWith(
          'Region 2 will change to DXTR on the next sync.',
        );
      });
      expect(screen.queryByTestId('button-change-to-dxtr-02')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId('using-dxtr-02')).toHaveFocus();
      });
    });

    test('failure shows the error alert, re-enables the button, and returns focus to it', async () => {
      vi.spyOn(Api2, 'patchCaseAppointmentSource').mockRejectedValue(new Error('server error'));
      await openDialogForRegion02();

      await userEvent.click(screen.getByTestId(SUBMIT_BUTTON));

      await waitFor(() => {
        expect(alertHook.error).toHaveBeenCalledWith('Unable to change to DXTR. Please try again.');
      });
      await waitFor(() => {
        expect(screen.getByTestId('button-change-to-dxtr-02')).toBeEnabled();
      });
      await waitFor(() => {
        expect(screen.getByTestId('button-change-to-dxtr-02')).toHaveFocus();
      });
    });

    test('a response with no data shows the error alert and re-enables the button', async () => {
      // Exercises the generic client's void-response union member.
      vi.spyOn(Api2, 'patchCaseAppointmentSource').mockResolvedValue(undefined);
      await openDialogForRegion02();

      await userEvent.click(screen.getByTestId(SUBMIT_BUTTON));

      await waitFor(() => {
        expect(alertHook.error).toHaveBeenCalledWith('Unable to change to DXTR. Please try again.');
      });
      await waitFor(() => {
        expect(screen.getByTestId('button-change-to-dxtr-02')).toBeEnabled();
      });
    });
  });
});
