import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { orderType, orderStatusType } from '@/lib/utils/labels';
import { BrowserRouter } from 'react-router-dom';
import { ConsolidationOrder } from '@common/cams/orders';
import {
  ConsolidationOrderAccordion,
  ConsolidationOrderAccordionProps,
} from '@/data-verification/ConsolidationOrderAccordion';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { OfficeDetails } from '@common/cams/courts';
import { formatDate } from '@/lib/utils/datetime';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import { selectItemInMockSelect } from '../lib/components/SearchableSelect.mock';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';

vi.mock(
  '../lib/components/SearchableSelect',
  () => import('../lib/components/SearchableSelect.mock'),
);

function findAccordionHeading(id: string) {
  const heading = screen.getByTestId(`accordion-heading-${id}`);
  expect(heading).toBeInTheDocument();
  expect(heading).toBeVisible();
  return heading;
}

function findAccordionContent(id: string, visible: boolean) {
  const content = screen.getByTestId(`accordion-content-${id}`);
  expect(content).toBeInTheDocument();
  if (visible) {
    expect(content).toBeVisible();
  } else {
    expect(content).not.toBeVisible();
  }
  return content;
}

describe('ConsolidationOrderAccordion tests', () => {
  const order: ConsolidationOrder = MockData.getConsolidationOrder();
  const offices: OfficeDetails[] = MockData.getOffices();
  const regionMap = new Map();

  const onOrderUpdateMockFunc = vitest.fn();
  const onExpandMockFunc = vitest.fn();

  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
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

  test('should render an order heading', async () => {
    renderWithProps();
    const heading = findAccordionHeading(order.id!);
    expect(heading?.textContent).toContain(order.courtName);
    expect(heading?.textContent).toContain(formatDate(order.orderDate));
  });

  test('should display pending order content', () => {
    const pendingOrder = MockData.getConsolidationOrder();
    renderWithProps({ order: pendingOrder });
    const content = findAccordionContent(pendingOrder.id!, false);

    const childCaseTable = screen.getByTestId(`${pendingOrder.id}-case-list`);
    expect(childCaseTable).toBeInTheDocument();

    pendingOrder.childCases.forEach((childCase) => {
      expect(content?.textContent).toContain(childCase.caseTitle);
      expect(content?.textContent).toContain(formatDate(childCase.dateFiled));
      childCase.docketEntries.forEach((de) => {
        expect(content?.textContent).toContain(de.summaryText);
        expect(content?.textContent).toContain(de.fullText);
      });
    });
  });

  test('should display approved order content', () => {
    // TODO: test rendering an approved order.
  });

  test('should display rejected order content', () => {
    // TODO: test rendering a rejected order.
  });

  test('should correctly enable/disable approve button', async () => {
    renderWithProps();
    const approveButton = document.querySelector(`#accordion-approve-button-${order.id}`);
    expect(approveButton).not.toBeEnabled();
    const checkbox = screen.getByTestId(`${order.id}-case-list-checkbox-0`);
    fireEvent.click(checkbox);
    await waitFor(() => {
      expect(approveButton).toBeEnabled();
    });
    fireEvent.click(checkbox);
    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
    });
  });

  test('should open approval modal when approve button is clicked', async () => {
    renderWithProps();
    const approveButton = document.querySelector(`#accordion-approve-button-${order.id}`);
    expect(approveButton).not.toBeEnabled();
    const checkbox = screen.getByTestId(`${order.id}-case-list-checkbox-0`);
    fireEvent.click(checkbox);
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
  });

  test('should not show add case when add case consolidation feature flag is false', async () => {
    const mockFeatureFlags = {
      'consolidations-add-case': false,
    };
    vitest.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);

    renderWithProps();

    const courtSelectDiv = screen.queryByTestId(`court-selection-usa-combo-box-${order.id}`);
    expect(courtSelectDiv).not.toBeInTheDocument();
  });

  test('should call orderUpdate with expected parameters when approval process is completed', async () => {
    renderWithProps();

    const leadCase = order.childCases[0];
    const expectedOrderApproved: ConsolidationOrder = {
      ...order,
      leadCase,
      status: 'approved',
    };

    vi.spyOn(Chapter15MockApi, 'put').mockResolvedValue({
      message: '',
      count: 1,
      body: [expectedOrderApproved],
    });

    const approveButton = document.querySelector(`#accordion-approve-button-${order.id}`);
    expect(approveButton).not.toBeEnabled();
    const checkbox = screen.getByTestId(`${order.id}-case-list-checkbox-0`);
    fireEvent.click(checkbox);
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

    // select the lead case in the modal and click the submit button.
    selectItemInMockSelect('lead-case-court', 1);
    const modalCaseNumberInput = screen.getByTestId(
      `lead-case-input-confirmation-modal-${order.id}`,
    );
    fireEvent.change(modalCaseNumberInput!, {
      target: { value: getCaseNumber(leadCase.caseId) },
    });
    const modalApproveButton = screen.getByTestId('toggle-modal-button-submit');
    fireEvent.click(modalApproveButton);

    await waitFor(() => {
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
});
