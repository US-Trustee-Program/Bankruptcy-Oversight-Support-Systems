import { render, screen, waitFor } from '@testing-library/react';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import * as transferOrderAccordionModule from './TransferOrderAccordion';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { BrowserRouter } from 'react-router-dom';
import DataVerificationScreen from './DataVerificationScreen';

describe('Review Orders screen - Alert', () => {
  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('should display alert and update order list when an order is updated by the TransferOrderAccordion', async () => {
    const mockOrder = { ...Chapter15MockApi.orders[0] };
    mockOrder.status = 'approved';
    mockOrder.newCase = {
      caseId: '55-55555',
      courtDivisionName: 'Cool Division',
      courtName: 'My Shinny New court',
    };
    const mockAlertMessage = `Transfer of case to ${mockOrder.newCaseId} in ${mockOrder.newCase.courtName} (${mockOrder.newCase.courtDivisionName}) was approved.`;

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
