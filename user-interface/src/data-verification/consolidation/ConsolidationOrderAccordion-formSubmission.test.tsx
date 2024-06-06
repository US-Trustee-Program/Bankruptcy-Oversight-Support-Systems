import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { expect, test } from 'vitest';
import { orderType, orderStatusType } from '@/lib/utils/labels';
import { BrowserRouter } from 'react-router-dom';
import { ConsolidationOrder } from '@common/cams/orders';
import {
  ConsolidationOrderAccordion,
  ConsolidationOrderAccordionProps,
} from '@/data-verification/consolidation/ConsolidationOrderAccordion';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { OfficeDetails } from '@common/cams/courts';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { FeatureFlagSet } from '@common/feature-flags';
import {
  clickCaseCheckbox,
  openAccordion,
  selectTypeAndMarkLead,
  setupApiGetMock,
} from './testUtilities';

vi.mock('../../lib/components/CamsSelect', () => import('@/lib/components/CamsSelect.mock'));

describe('ConsolidationOrderAccordion form tests', () => {
  const order: ConsolidationOrder = MockData.getConsolidationOrder();
  const offices: OfficeDetails[] = MockData.getOffices();
  const regionMap = new Map();

  const onOrderUpdateMockFunc = vitest.fn();
  const onExpandMockFunc = vitest.fn();
  let mockFeatureFlags: FeatureFlagSet;

  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    mockFeatureFlags = {
      'consolidations-enabled': true,
    };
    vitest.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  function renderWithProps(props?: Partial<ConsolidationOrderAccordionProps>) {
    const defaultProps: ConsolidationOrderAccordionProps = {
      order,
      officesList: offices,
      orderType,
      statusType: orderStatusType,
      onOrderUpdate: onOrderUpdateMockFunc,
      onExpand: onExpandMockFunc,
      regionsMap: regionMap,
    };

    const renderProps = { ...defaultProps, ...props };
    render(
      <BrowserRouter>
        <ConsolidationOrderAccordion {...renderProps} />
      </BrowserRouter>,
    );
  }

  test('should open approval modal when approve button is clicked', async () => {
    renderWithProps();
    openAccordion(order.id!);

    const approveButton = document.querySelector(
      `#accordion-approve-button-${order.id}`,
    ) as HTMLButtonElement;
    expect(approveButton).not.toBeEnabled();

    selectTypeAndMarkLead(order.id!);

    clickCaseCheckbox(order.id!, 0);
    clickCaseCheckbox(order.id!, 1);
    await waitFor(() => {
      expect(approveButton).toBeEnabled();
    });

    fireEvent.click(approveButton);

    const modal = screen.getByTestId(`modal-confirmation-modal-${order.id}`);
    await waitFor(() => {
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveClass('is-visible');
      // for some reason, toBeVisible() doesn't work.
      expect(modal).toHaveStyle({ display: 'block' });
    });
  });

  test('should open rejection modal when reject button is clicked', async () => {
    renderWithProps();
    const rejectButton = document.querySelector(
      `#accordion-reject-button-${order.id}`,
    ) as HTMLButtonElement;
    expect(rejectButton).not.toBeEnabled();

    selectTypeAndMarkLead(order.id!);

    clickCaseCheckbox(order.id!, 0);
    await waitFor(() => {
      expect(rejectButton).toBeEnabled();
    });

    fireEvent.click(rejectButton);

    const modal = screen.getByTestId(`modal-confirmation-modal-${order.id}`);
    await waitFor(() => {
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveClass('is-visible');
      // for some reason, toBeVisible() doesn't work.
      expect(modal).toHaveStyle({ display: 'block' });
    });
  });

  test('should call orderUpdate for rejection', async () => {
    renderWithProps();

    const expectedOrderRejected: ConsolidationOrder = {
      ...order,
      status: 'rejected',
      reason: 'Test.',
    };

    vi.spyOn(Chapter15MockApi, 'put').mockResolvedValue({
      message: '',
      count: 1,
      body: [expectedOrderRejected],
    });

    const rejectButton = document.querySelector(
      `#accordion-reject-button-${order.id}`,
    ) as HTMLButtonElement;
    expect(rejectButton).not.toBeEnabled();

    clickCaseCheckbox(order.id!, 0);

    selectTypeAndMarkLead(order.id!);

    await waitFor(() => {
      expect(rejectButton).toBeEnabled();
    });
    fireEvent.click(rejectButton);

    const modal = screen.getByTestId(`modal-confirmation-modal-${order.id}`);

    await waitFor(() => {
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveClass('is-visible');
      // for some reason, toBeVisible() doesn't work.
      expect(modal).toHaveStyle({ display: 'block' });
    });

    const modalRejectButton = screen.getByTestId(
      `button-confirmation-modal-${order.id}-submit-button`,
    );

    await waitFor(() => {
      expect(modalRejectButton).toBeEnabled();
    });

    fireEvent.click(modalRejectButton);

    await waitFor(() => {
      expect(onOrderUpdateMockFunc).toHaveBeenCalled();
      expect(onOrderUpdateMockFunc).toHaveBeenCalledWith(
        {
          message: `Rejection of consolidation order was successful.`,
          timeOut: 8,
          type: UswdsAlertStyle.Success,
        },
        [expectedOrderRejected],
        order,
      );
    });
  });

  test('should handle api exception for rejection', async () => {
    renderWithProps();

    const errorMessage = 'Some random error';
    const alertMessage =
      'An unknown error has occurred and has been logged.  Please try again later.';
    vi.spyOn(Chapter15MockApi, 'put').mockRejectedValue(new Error(errorMessage));

    const rejectButton = document.querySelector(
      `#accordion-reject-button-${order.id}`,
    ) as HTMLButtonElement;
    expect(rejectButton).not.toBeEnabled();

    clickCaseCheckbox(order.id!, 0);

    selectTypeAndMarkLead(order.id!);

    await waitFor(() => {
      expect(rejectButton).toBeEnabled();
    });
    fireEvent.click(rejectButton);

    const modal = screen.getByTestId(`modal-confirmation-modal-${order.id}`);

    await waitFor(() => {
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveClass('is-visible');
      // for some reason, toBeVisible() doesn't work.
      expect(modal).toHaveStyle({ display: 'block' });
    });

    const modalRejectButton = screen.getByTestId(
      `button-confirmation-modal-${order.id}-submit-button`,
    );

    await waitFor(() => {
      expect(modalRejectButton).toBeEnabled();
    });

    fireEvent.click(modalRejectButton);

    await waitFor(() => {
      expect(onOrderUpdateMockFunc).toHaveBeenCalled();
      expect(onOrderUpdateMockFunc).toHaveBeenCalledWith({
        message: alertMessage,
        timeOut: 8,
        type: UswdsAlertStyle.Error,
      });
    });
  });

  test('should call orderUpdate for approval', async () => {
    renderWithProps();
    openAccordion(order.id!);

    const leadCase = order.childCases[0];
    const expectedOrderApproved: ConsolidationOrder = {
      ...order,
      leadCase,
      status: 'approved',
    };

    setupApiGetMock();

    vi.spyOn(Chapter15MockApi, 'put').mockResolvedValue({
      message: '',
      count: 1,
      body: [expectedOrderApproved],
    });

    const approveButton = document.querySelector(`#accordion-approve-button-${order.id}`);
    expect(approveButton).not.toBeEnabled();

    clickCaseCheckbox(order.id!, 0);
    clickCaseCheckbox(order.id!, 1);

    selectTypeAndMarkLead(order.id!);

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
    });
    fireEvent.click(approveButton as HTMLButtonElement);

    const modal = screen.getByTestId(`modal-confirmation-modal-${order.id}`);

    await waitFor(() => {
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveClass('is-visible');
      // for some reason, toBeVisible() doesn't work.
      expect(modal).toHaveStyle({ display: 'block' });
    });

    const modalApproveButton = screen.getByTestId(
      `button-confirmation-modal-${order.id}-submit-button`,
    );

    await waitFor(() => {
      expect(modalApproveButton).toBeEnabled();
    });

    fireEvent.click(modalApproveButton);

    await waitFor(() => {
      expect(onOrderUpdateMockFunc).toHaveBeenCalled();
      expect(onOrderUpdateMockFunc).toHaveBeenCalledWith(
        {
          message: `Consolidation to lead case ${getCaseNumber(leadCase.caseId)} in ${leadCase.courtName} (${leadCase?.courtDivisionName}) was successful.`,
          timeOut: 8,
          type: UswdsAlertStyle.Success,
        },
        [expectedOrderApproved],
        order,
      );
    });
  });

  test('should handle api exception for approval', async () => {
    renderWithProps();
    openAccordion(order.id!);

    setupApiGetMock();

    const errorMessage = 'Some random error';
    const alertMessage =
      'An unknown error has occurred and has been logged.  Please try again later.';
    vi.spyOn(Chapter15MockApi, 'put').mockRejectedValue(new Error(errorMessage));

    const approveButton = document.querySelector(`#accordion-approve-button-${order.id}`);
    expect(approveButton).not.toBeEnabled();

    clickCaseCheckbox(order.id!, 0);
    clickCaseCheckbox(order.id!, 1);

    selectTypeAndMarkLead(order.id!);

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
    });
    fireEvent.click(approveButton as HTMLButtonElement);

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
    });
    fireEvent.click(approveButton as HTMLButtonElement);

    const modal = screen.getByTestId(`modal-confirmation-modal-${order.id}`);

    await waitFor(() => {
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveClass('is-visible');
      // for some reason, toBeVisible() doesn't work.
      expect(modal).toHaveStyle({ display: 'block' });
    });

    const modalApproveButton = screen.getByTestId(
      `button-confirmation-modal-${order.id}-submit-button`,
    );

    await waitFor(() => {
      expect(modalApproveButton).toBeEnabled();
    });

    fireEvent.click(modalApproveButton);

    await waitFor(() => {
      expect(onOrderUpdateMockFunc).toHaveBeenCalled();
      expect(onOrderUpdateMockFunc).toHaveBeenCalledWith({
        message: alertMessage,
        timeOut: 8,
        type: UswdsAlertStyle.Error,
      });
    });
  });
});
