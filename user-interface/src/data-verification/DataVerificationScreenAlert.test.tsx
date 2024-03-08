import { render, screen, waitFor } from '@testing-library/react';
import * as transferOrderAccordionModule from './TransferOrderAccordion';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { BrowserRouter } from 'react-router-dom';
import DataVerificationScreen from './DataVerificationScreen';
import { MockData } from '@common/cams/test-utilities/mock-data';

describe('Review Orders screen - Alert', () => {
  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('should display alert and update order list when an order is updated by the TransferOrderAccordion', async () => {
    const mockOrder = MockData.getTransferOrder({ override: { status: 'approved' } });
    const mockAlertMessage = `Transfer of case to ${mockOrder.newCaseId} in ${mockOrder.newCase?.courtName} (${mockOrder.newCase?.courtDivisionName}) was approved.`;

    vi.spyOn(transferOrderAccordionModule, 'TransferOrderAccordion').mockImplementation(
      (props: transferOrderAccordionModule.TransferOrderAccordionProps) => {
        props.onOrderUpdate(
          {
            message: mockAlertMessage,
            type: UswdsAlertStyle.Success,
            timeOut: 8,
          },
          mockOrder,
        );

        return <></>;
      },
    );

    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );

    await waitFor(async () => {
      const alertContainer = screen.getByTestId('alert-container-data-verification-alert');
      expect(alertContainer).toBeInTheDocument();
      expect(alertContainer).toHaveClass('visible');

      const alert = screen.getByTestId('alert-data-verification-alert');
      expect(alert).toHaveClass('usa-alert__visible');
      expect(alert).toHaveTextContent(mockAlertMessage);
    });
  });
});
