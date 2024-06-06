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
import { selectItemInMockSelect } from '@/lib/components/CamsSelect.mock';
import {
  enterCaseNumber,
  findApproveButton,
  findCaseNumberInput,
  findRejectButton,
  findValidCaseNumberAlert,
  findValidCaseNumberTable,
  openAccordion,
  selectTypeAndMarkLead,
  setupApiGetMock,
  toggleEnableCaseListForm,
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

  test('checking "lead case not listed" checkbox should clear markLeadCase button selection', async () => {
    renderWithProps();
    openAccordion(order.id!);

    await toggleEnableCaseListForm(order.id!);

    const markLeadCaseButton = screen.getByTestId(`button-assign-lead-case-list-${order.id}-0`);
    expect(markLeadCaseButton).toHaveClass('usa-button--outline');

    fireEvent.click(markLeadCaseButton);
    expect(markLeadCaseButton).not.toHaveClass('usa-button--outline');

    await toggleEnableCaseListForm(order.id!);

    waitFor(() => {
      expect(markLeadCaseButton).toHaveClass('usa-button--outline');
    });
  });

  test('should correctly enable/disable buttons based on selections in "case not listed" form', async () => {
    renderWithProps();
    openAccordion(order.id!);
    setupApiGetMock({ bCase: order.childCases[0] });

    const includeAllCheckbox = document.querySelector(`.checkbox-toggle label`);
    const approveButton = findApproveButton(order.id!);
    const rejectButton = findRejectButton(order.id!);

    selectTypeAndMarkLead(order.id!);
    fireEvent.click(includeAllCheckbox!);

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    const markAsLeadButton = screen.getByTestId(`button-assign-lead-case-list-${order.id}-0`);
    expect(markAsLeadButton).not.toHaveClass('usa-button--outline');

    await toggleEnableCaseListForm(order.id!);

    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).toBeEnabled();
      expect(markAsLeadButton).toHaveClass('usa-button--outline');
    });

    const leadCaseForm = document.querySelector(`.lead-case-form-container-${order.id}`);
    expect(leadCaseForm).toBeInTheDocument();

    selectItemInMockSelect(`lead-case-court`, 0);

    const caseNumberInput = findCaseNumberInput(order.id!);

    const validCaseNumber = getCaseNumber(order.childCases[0].caseId).replace('-', '');
    enterCaseNumber(caseNumberInput, validCaseNumber);

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    enterCaseNumber(caseNumberInput, '11111111');

    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    enterCaseNumber(caseNumberInput, '111111');

    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    enterCaseNumber(caseNumberInput, validCaseNumber);

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    await toggleEnableCaseListForm(order.id!);

    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).toBeEnabled();
      expect(leadCaseForm).not.toBeInTheDocument();
    });
  });

  test('should show alert when no lead case can be found in search field', async () => {
    const order: ConsolidationOrder = MockData.getConsolidationOrder({
      override: { courtDivisionCode: '081' },
    });
    renderWithProps({ order });
    openAccordion(order.id!);
    setupApiGetMock({ bCase: order.childCases[0] });

    await toggleEnableCaseListForm(order.id!);

    selectItemInMockSelect(`lead-case-court`, 0);
    const caseNumberInput = findCaseNumberInput(order.id!);

    enterCaseNumber(caseNumberInput, '11111111');

    const spinner = screen.getByTestId(`lead-case-number-loading-spinner-${order.id}`);
    expect(spinner).toBeInTheDocument();

    let alert;
    await waitFor(
      async () => {
        alert = await findValidCaseNumberAlert(order.id!);
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent("We couldn't find a case with that number.");
        expect(spinner).not.toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    enterCaseNumber(caseNumberInput, '11111');

    await waitFor(() => {
      expect(alert!).not.toBeInTheDocument();
    });

    enterCaseNumber(caseNumberInput, getCaseNumber(order.childCases[0].caseId).replace('-', ''));

    await waitFor(() => {
      expect(findValidCaseNumberTable(order.id!)).toBeInTheDocument();
    });

    enterCaseNumber(caseNumberInput, '');

    await waitFor(async () => {
      expect(findValidCaseNumberTable(order.id!)).not.toBeInTheDocument();
    });
  });

  test('should show alert when no lead case can be found in search field, and error returned was not a 404', async () => {
    renderWithProps();
    openAccordion(order.id!);
    setupApiGetMock({ bCase: order.childCases[0] });

    await toggleEnableCaseListForm(order.id!);

    selectItemInMockSelect(`lead-case-court`, 0);
    const caseNumberInput = findCaseNumberInput(order.id!);

    enterCaseNumber(caseNumberInput, '00000000');

    await waitFor(
      async () => {
        const alert = await findValidCaseNumberAlert(order.id!);
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent('Cannot verify lead case number.');
        expect(findValidCaseNumberTable(order.id!)).not.toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  test('should show alert when lookup of associated cases fails', async () => {
    renderWithProps();
    openAccordion(order.id!);
    const testCase = order.childCases[0];
    testCase.caseId = '999-99-99999';
    setupApiGetMock({ bCase: testCase });

    await toggleEnableCaseListForm(order.id!);

    selectItemInMockSelect(`lead-case-court`, 0);
    const caseNumberInput = findCaseNumberInput(order.id!);

    enterCaseNumber(caseNumberInput, '9999999');

    await waitFor(async () => {
      const alert = await findValidCaseNumberAlert(order.id!);
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(
        `Cannot verify lead case is not part of another consolidation. `,
      );
      expect(findValidCaseNumberTable(order.id!)).not.toBeInTheDocument();
    });
  });

  test('should show an alert if the lead case is already a part of another consolidation', async () => {
    renderWithProps();
    openAccordion(order.id!);

    const leadCase = MockData.getCaseSummary();
    const associations = MockData.buildArray(
      () =>
        MockData.getConsolidationReference({
          override: {
            documentType: 'CONSOLIDATION_FROM',
            caseId: leadCase.caseId,
          },
        }),
      1,
    );

    setupApiGetMock({ bCase: leadCase, associations });

    await toggleEnableCaseListForm(order.id!);

    // Select lead case court.
    selectItemInMockSelect(`lead-case-court`, 0);

    // Enter case number.
    const leadCaseNumber = getCaseNumber(leadCase.caseId);
    const caseNumberInput = findCaseNumberInput(order.id!);
    await waitFor(() => {
      enterCaseNumber(caseNumberInput, leadCaseNumber);
      expect(caseNumberInput).toHaveValue(leadCaseNumber);
    });

    await waitFor(async () => {
      const alertElement = await screen.findByTestId(
        `alert-message-lead-case-number-alert-${order.id}`,
      );
      expect(alertElement).toHaveTextContent(`This case is already part of a consolidation.`);
    });
  });

  test('should show an alert if the lead case is a child case of another consolidation', async () => {
    renderWithProps();
    openAccordion(order.id!);

    const leadCase = MockData.getCaseSummary();
    const otherLeadCase = MockData.getCaseSummary();
    const associations = MockData.buildArray(
      () =>
        MockData.getConsolidationReference({
          override: {
            documentType: 'CONSOLIDATION_TO',
            caseId: leadCase.caseId,
            otherCase: otherLeadCase,
          },
        }),
      3,
    );

    setupApiGetMock({ bCase: leadCase, associations });

    await toggleEnableCaseListForm(order.id!);

    // Select lead case court.
    selectItemInMockSelect(`lead-case-court`, 0);

    // Enter case number.
    const leadCaseNumber = getCaseNumber(leadCase.caseId);
    const caseNumberInput = findCaseNumberInput(order.id!);
    await waitFor(() => {
      enterCaseNumber(caseNumberInput, leadCaseNumber);
    });

    await waitFor(() => {
      expect(caseNumberInput).toHaveValue(leadCaseNumber);
    });

    await waitFor(async () => {
      const alertElement = await screen.findByTestId(
        `alert-message-lead-case-number-alert-${order.id}`,
      );
      expect(alertElement).toHaveTextContent(
        `Case ${leadCaseNumber} is a consolidated child case of case ${getCaseNumber(otherLeadCase.caseId)}.`,
      );
    });
  });
});
