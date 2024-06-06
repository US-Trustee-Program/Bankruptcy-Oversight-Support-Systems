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
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { FeatureFlagSet } from '@common/feature-flags';
import * as validationModule from '@/lib/components/uswds/Validation';
import {
  checkValidation,
  clickCaseCheckbox,
  clickMarkLeadButton,
  enterCaseNumber,
  findApproveButton,
  findCaseNumberInput,
  findRejectButton,
  findValidCaseNumberTable,
  openAccordion,
  selectTypeAndMarkLead,
  setupApiGetMock,
  toggleEnableCaseListForm,
} from './testUtilities';

vi.mock('../lib/components/CamsSelect', () => import('../../lib/components/CamsSelect.mock'));

describe('ConsolidationOrderAccordion tests on the Cases Table form (top of accordion)', () => {
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

  test('should correctly enable/disable buttons when selecting consolidated cases and lead case from order case list table', async () => {
    renderWithProps();
    openAccordion(order.id!);
    setupApiGetMock({ bCase: order.childCases[0] });

    const includeAllCheckbox = document.querySelector(`.checkbox-toggle label`);
    const approveButton = findApproveButton(order.id!);
    const rejectButton = findRejectButton(order.id!);
    const cancelButton = document.querySelector(`#accordion-cancel-button-${order.id}`);

    const validationSpy = vi.spyOn(validationModule, 'Validation');

    selectTypeAndMarkLead(order.id!);

    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).not.toBeEnabled();
    });

    checkValidation(validationSpy, true, false, true);

    const firstCheckbox = clickCaseCheckbox(order.id!, 0);

    await waitFor(
      () => {
        expect(approveButton).not.toBeEnabled();
        expect(rejectButton).toBeEnabled();
        checkValidation(validationSpy, true, false, true);
      },
      { timeout: 3000 },
    );

    const secondCheckbox = clickCaseCheckbox(order.id!, 1);

    await waitFor(
      () => {
        expect(approveButton).toBeEnabled();
        expect(rejectButton).toBeEnabled();
        checkValidation(validationSpy, true, true, true);
      },
      { timeout: 3000 },
    );

    clickMarkLeadButton(0, order.id!);

    await waitFor(
      () => {
        expect(approveButton).not.toBeEnabled();
        expect(rejectButton).toBeEnabled();
        checkValidation(validationSpy, true, true, false);
      },
      { timeout: 2000 },
    );

    clickMarkLeadButton(0, order.id!);
    fireEvent.click(firstCheckbox);

    await waitFor(
      () => {
        expect(approveButton).toBeEnabled();
        expect(rejectButton).toBeEnabled();
        checkValidation(validationSpy, true, true, true);
      },
      { timeout: 2000 },
    );

    fireEvent.click(secondCheckbox);

    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).not.toBeEnabled();
      checkValidation(validationSpy, true, false, true);
    });

    fireEvent.click(includeAllCheckbox!);

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
      checkValidation(validationSpy, true, true, true);
    });

    fireEvent.click(includeAllCheckbox!);

    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).not.toBeEnabled();
      checkValidation(validationSpy, true, false, true);
    });

    fireEvent.click(firstCheckbox);
    fireEvent.click(secondCheckbox);

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
      checkValidation(validationSpy, true, true, true);
    });

    fireEvent.click(cancelButton!);

    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).not.toBeEnabled();
      checkValidation(validationSpy, false, false, false);
    });
  });

  test('should correctly disable buttons when there is only 1 child case listed and the same case is marked as the lead in the table', async () => {
    const leadCase = MockData.getCaseSummary();
    const order: ConsolidationOrder = MockData.getConsolidationOrder({
      override: {
        childCases: [MockData.getConsolidatedOrderCase()],
      },
    });

    renderWithProps({ order });
    openAccordion(order.id!);
    setupApiGetMock({ bCase: leadCase });

    const approveButton = findApproveButton(order.id!);
    const rejectButton = findRejectButton(order.id!);
    const invalidCaseNumber = getCaseNumber(order.childCases[0].caseId).replace('-', '');

    const validationSpy = vi.spyOn(validationModule, 'Validation');

    expect(approveButton).not.toBeEnabled();
    expect(rejectButton).not.toBeEnabled();

    clickCaseCheckbox(order.id!, 0);
    selectTypeAndMarkLead(order.id!);

    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).toBeEnabled();
      checkValidation(validationSpy, true, false, true);
    });

    await toggleEnableCaseListForm(order.id!);

    await waitFor(() => {
      checkValidation(validationSpy, true, false, false);
    });

    const leadCaseForm = document.querySelector(`.lead-case-form-container-${order.id}`);
    expect(leadCaseForm).toBeInTheDocument();

    const caseNumberInput = findCaseNumberInput(order.id!);
    enterCaseNumber(caseNumberInput, invalidCaseNumber);

    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).toBeEnabled();
      checkValidation(validationSpy, true, false, true);
    });

    enterCaseNumber(caseNumberInput, leadCase.caseId);

    await waitFor(() => {
      expect(findValidCaseNumberTable(order.id!)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
      checkValidation(validationSpy, true, true, true);
    });
  });

  test('should clear checkboxes and disable approve button when cancel is clicked', async () => {
    renderWithProps();
    openAccordion(order.id!);

    const approveButton = document.querySelector(`#accordion-approve-button-${order.id}`);
    const cancelButton = document.querySelector(`#accordion-cancel-button-${order.id}`);
    expect(approveButton).not.toBeEnabled();

    const checkbox1 = clickCaseCheckbox(order.id!, 0);
    const checkbox2 = clickCaseCheckbox(order.id!, 1);

    expect(approveButton).not.toBeEnabled();

    selectTypeAndMarkLead(order.id!);

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
    });
    fireEvent.click(approveButton as HTMLButtonElement);

    await waitFor(() => {
      expect(checkbox1.checked).toBeTruthy();
      expect(checkbox2.checked).toBeTruthy();
      expect(approveButton).toBeEnabled();
    });

    fireEvent.click(cancelButton as HTMLButtonElement);

    await waitFor(() => {
      expect(checkbox1.checked).toBeFalsy();
      expect(checkbox2.checked).toBeFalsy();
      expect(approveButton).not.toBeEnabled();
    });
  });

  test('should clear checkboxes and disable approve button when accordion is collapsed', async () => {
    renderWithProps();
    openAccordion(order.id!);

    const approveButton = document.querySelector(`#accordion-approve-button-${order.id}`);
    const collapseButton = screen.getByTestId(`accordion-button-order-list-${order.id}`);
    expect(approveButton).not.toBeEnabled();

    let checkbox1 = clickCaseCheckbox(order.id!, 0);
    let checkbox2 = clickCaseCheckbox(order.id!, 1);

    selectTypeAndMarkLead(order.id!);

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
    });
    fireEvent.click(approveButton as HTMLButtonElement);

    await waitFor(() => {
      expect(checkbox1.checked).toBeTruthy();
      expect(checkbox2.checked).toBeTruthy();
      expect(approveButton).toBeEnabled();
    });

    fireEvent.click(collapseButton as HTMLButtonElement); // collapse accordion

    fireEvent.click(collapseButton as HTMLButtonElement);
    checkbox1 = screen.getByTestId(`checkbox-case-selection-case-list-${order.id}-0`);
    checkbox2 = screen.getByTestId(`checkbox-case-selection-case-list-${order.id}-1`);

    await waitFor(() => {
      expect(checkbox1.checked).toBeFalsy();
      expect(checkbox2.checked).toBeFalsy();
      expect(approveButton).not.toBeEnabled();
    });
  });

  test('should select all checkboxes and enable approve button when Include All button is clicked (and consolidation type and lead case are set)', async () => {
    renderWithProps();
    openAccordion(order.id!);

    selectTypeAndMarkLead(order.id!);

    const approveButton = document.querySelector(`#accordion-approve-button-${order.id}`);
    expect(approveButton).not.toBeEnabled();
    const includeAllButton = screen.getByTestId(
      `checkbox-label-case-list-${order.id}-checkbox-toggle`,
    );

    const checkboxList: NodeListOf<HTMLInputElement> = document.querySelectorAll(
      'table input[type="checkbox"]',
    );

    fireEvent.click(includeAllButton!);

    await waitFor(() => {
      for (const checkbox of checkboxList) {
        expect(checkbox.checked).toBeTruthy();
      }
      expect(approveButton).toBeEnabled();
    });

    fireEvent.click(checkboxList[0]);
    await waitFor(() => {
      expect(checkboxList[0].checked).toBeFalsy();
    });

    fireEvent.click(includeAllButton!);
    await waitFor(() => {
      for (const checkbox of checkboxList) {
        expect(checkbox.checked).toBeTruthy();
      }
      expect(approveButton).toBeEnabled();
    });

    fireEvent.click(includeAllButton!);
    await waitFor(() => {
      for (const checkbox of checkboxList) {
        expect(checkbox.checked).toBeFalsy();
      }
      expect(approveButton).toBeDisabled();
    });
  });
});
