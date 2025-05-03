import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Api2 from '@/lib/models/api2';
import testingUtilities from '@/lib/testing/testing-utilities';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { CaseDocketEntry, CaseSummary } from '@common/cams/cases';
import { CourtDivisionDetails } from '@common/cams/courts';
import { MOCKED_USTP_OFFICES_ARRAY } from '@common/cams/offices';
import { OrderStatus, TransferOrder } from '@common/cams/orders';
import { CamsRole } from '@common/cams/roles';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { describe } from 'vitest';

import {
  SuggestedTransferCases,
  SuggestedTransferCasesImperative,
  SuggestedTransferCasesProps,
} from './SuggestedTransferCases';

const testOffices: CourtDivisionDetails[] = [
  {
    courtDivisionCode: '001',
    courtDivisionName: 'New York 1',
    courtId: '0101',
    courtName: 'A',
    groupDesignator: 'AA',
    officeCode: '1',
    officeName: 'A1',
    regionId: '02',
    regionName: 'NEW YORK',
    state: 'NY',
  },
  {
    courtDivisionCode: '003',
    courtDivisionName: 'New York 1',
    courtId: '0103',
    courtName: 'C',
    groupDesignator: 'AC',
    officeCode: '3',
    officeName: 'C1',
    regionId: '02',
    regionName: 'NEW YORK',
    state: 'NY',
  },
  {
    courtDivisionCode: '002',
    courtDivisionName: 'New York 1',
    courtId: '0102',
    courtName: 'B',
    groupDesignator: 'AB',
    officeCode: '2',
    officeName: 'B1',
    regionId: '02',
    regionName: 'NEW YORK',
    state: 'NY',
  },
];

const fromCaseSummary = MockData.getCaseSummary();
const suggestedCases = MockData.buildArray(MockData.getCaseSummary, 2);
const caseSummaryError = new Error('Case summary not found for case ID.');

const mockErrorMessage = 'Some mock error';
const emptySuggestedCasesId = 'button-radio-case-not-listed-radio-button-click-target';

function enterCaseNumber(caseIdInput: Element | null | undefined, value: string) {
  if (!caseIdInput) {
    throw Error();
  }

  fireEvent.change(caseIdInput!, { target: { value } });
  expect(caseIdInput).toHaveValue(value);

  return caseIdInput;
}

async function fillCaseNotListedForm(
  order: CaseSummary & {
    docketEntries: CaseDocketEntry[];
    docketSuggestedCaseNumber?: string;
    id: string;
    newCase?: CaseSummary;
    orderDate: string;
    orderType: 'transfer';
    reason?: string;
    status: OrderStatus;
  },
) {
  await waitFor(() => {
    const caseTable = document.querySelector('#suggested-cases');
    expect(caseTable).toBeInTheDocument();
  });

  const radio = screen.getByTestId(emptySuggestedCasesId);
  fireEvent.click(radio);

  const newCaseCourtSelect = screen.getByTestId(`court-selection-usa-combo-box-${order.id}`);
  expect(newCaseCourtSelect).toBeVisible();

  await selectItemInCombobox(order.id, 0);

  const caseNumber = getCaseNumber(suggestedCases[0].caseId);
  const input = findCaseNumberInput(order.id);
  const updated = enterCaseNumber(input, caseNumber);
  expect(updated).toHaveValue(caseNumber);
}

function findCaseNumberInput(id: string) {
  const caseIdInput = document.querySelector(`input#new-case-input-${id}`);
  expect(caseIdInput).toBeInTheDocument();
  return caseIdInput;
}

async function selectItemInCombobox(orderId: string, index: number) {
  const courtComboboxItems = document.querySelectorAll(`#court-selection-${orderId} li`);
  await userEvent.click(courtComboboxItems[index]!);
}

async function waitForLoadToComplete(orderId: string) {
  const testId = `loading-spinner-${orderId}-suggestions`;
  const spinner = screen.getByTestId(testId);
  expect(spinner).toBeInTheDocument();

  await waitFor(() => {
    expect(spinner).not.toBeInTheDocument();
  });
}

describe('SuggestedTransferCases component', () => {
  let order: TransferOrder;

  function renderWithProps(props?: Partial<SuggestedTransferCasesProps>) {
    const onCaseSelection = vitest.fn();
    const onInvalidCaseNumber = vitest.fn();
    const onAlert = vitest.fn();
    const ref = React.createRef<SuggestedTransferCasesImperative>();
    const defaultProps: SuggestedTransferCasesProps = {
      officesList: testOffices,
      onAlert,
      onCaseSelection,
      onInvalidCaseNumber,
      order,
    };

    const renderProps = { ...defaultProps, ...props };
    render(
      <BrowserRouter>
        <SuggestedTransferCases {...renderProps} ref={ref} />
      </BrowserRouter>,
    );

    return {
      onAlert,
      onCaseSelection,
      ref,
    };
  }

  beforeEach(async () => {
    testingUtilities.setUser({
      offices: MOCKED_USTP_OFFICES_ARRAY,
      roles: [CamsRole.DataVerifier],
    });
    vi.stubEnv('CAMS_PA11Y', 'true');
    order = MockData.getTransferOrder();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should display descriptive instructions when loading suggestions and hide it if suggestedCases returns 0 results', async () => {
    vi.spyOn(Api2, 'getOrderSuggestions').mockResolvedValue({ data: [] });
    vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue({ data: fromCaseSummary });

    renderWithProps();

    await waitFor(() => {
      const description = screen.getByTestId('suggested-cases-not-found');
      expect(description).toBeInTheDocument();
      expect(description).toHaveTextContent(
        'Choose a new court division and enter a case number, and a case will be selected for this case event automatically.',
      );
    });
  });

  test('should display case table if we get more than 0 suggested cases', async () => {
    vi.spyOn(Api2, 'getOrderSuggestions').mockResolvedValue({ data: suggestedCases });
    vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue({ data: fromCaseSummary });

    renderWithProps();

    await waitFor(() => {
      const caseTable = document.querySelector('#suggested-cases');
      expect(caseTable).toBeInTheDocument();

      const description = screen.getByTestId('suggested-cases-found');
      expect(description).toBeInTheDocument();
      expect(description).toHaveTextContent(
        'Select the new case from the list below. If the case is not listed, select "case not listed" and enter the new court division and case number.',
      );
    });
  });

  test('should call onAlert if an error results from fetching case suggestions', async () => {
    vi.spyOn(Api2, 'getOrderSuggestions').mockRejectedValue(new Error(mockErrorMessage));
    const { onAlert } = renderWithProps();

    await waitForLoadToComplete(order.id);

    expect(onAlert).toHaveBeenCalled();
    expect(onAlert).toHaveBeenCalledWith({
      message: mockErrorMessage,
      timeOut: 8,
      type: UswdsAlertStyle.Error,
    });
  });

  test('should call onCaseSelection if a selection is made', async () => {
    vi.spyOn(Api2, 'getOrderSuggestions').mockResolvedValue({ data: suggestedCases });
    vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue({ data: fromCaseSummary });

    const { onCaseSelection } = renderWithProps();

    await waitFor(() => {
      const caseTable = document.querySelector('#suggested-cases');
      expect(caseTable).toBeInTheDocument();
    });

    const radio = screen.getByTestId('button-radio-suggested-cases-checkbox-0-click-target');
    fireEvent.click(radio);

    expect(onCaseSelection).toHaveBeenCalledWith(expect.objectContaining({ ...suggestedCases[0] }));
  });

  test('should display validation error alert if an invalid case number is entered into input', async () => {
    vi.spyOn(Api2, 'getOrderSuggestions').mockResolvedValue({ data: suggestedCases });
    vi.spyOn(Api2, 'getCaseSummary').mockRejectedValue(caseSummaryError);

    renderWithProps();

    await fillCaseNotListedForm(order);

    await waitFor(() => {
      const alert = screen.getByTestId('alert-container-validation-not-found');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveClass('visible');
    });
  });

  test('should display table result if a valid case number has been entered into the form', async () => {
    vi.spyOn(Api2, 'getOrderSuggestions').mockResolvedValue({ data: suggestedCases });
    vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue({ data: fromCaseSummary });

    renderWithProps();

    await fillCaseNotListedForm(order);

    await waitFor(async () => {
      const validCasesTable = await screen.findByTestId('validated-cases');
      expect(validCasesTable).toBeVisible();
    });
  });

  test('ref.cancel should reset all form fields, validation states, case summary and order transfer details', async () => {
    vi.spyOn(Api2, 'getOrderSuggestions').mockResolvedValue({ data: suggestedCases });
    vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue({ data: fromCaseSummary });

    const { ref } = renderWithProps();

    await fillCaseNotListedForm(order);

    ref.current?.cancel();

    suggestedCases.forEach((_, idx) => {
      const radioBtn = screen.getByTestId(`radio-suggested-cases-checkbox-${idx}`);
      expect(radioBtn).not.toBeChecked();
    });

    await waitFor(() => {
      const radioBtn = screen.getByTestId(emptySuggestedCasesId);
      expect(radioBtn).not.toBeChecked();
    });

    const caseEntryForm = document.querySelector('case-entry-form');
    expect(caseEntryForm).not.toBeInTheDocument();
  });

  test('should properly handle deselecting court', async () => {
    vi.spyOn(Api2, 'getOrderSuggestions').mockResolvedValue({ data: suggestedCases });
    vi.spyOn(Api2, 'getCaseSummary').mockRejectedValue(caseSummaryError);

    renderWithProps();

    await fillCaseNotListedForm(order);

    await waitFor(() => {
      const alert = screen.getByTestId('alert-container-validation-not-found');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveClass('visible');
    });

    await selectItemInCombobox(order.id, 0);

    await waitFor(() => {
      const alert = screen.queryByTestId('alert-container-validation-not-found');
      expect(alert).not.toBeInTheDocument();
    });
  });

  test('should properly handle removing case number', async () => {
    vi.spyOn(Api2, 'getOrderSuggestions').mockResolvedValue({ data: suggestedCases });
    vi.spyOn(Api2, 'getCaseSummary').mockRejectedValue(caseSummaryError);

    renderWithProps();

    await fillCaseNotListedForm(order);

    await waitFor(() => {
      const alert = screen.getByTestId('alert-container-validation-not-found');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveClass('visible');
    });

    const caseNumberWithTooFewCharacters = '24-2314';
    const input = findCaseNumberInput(order.id);
    enterCaseNumber(input, caseNumberWithTooFewCharacters);

    await waitFor(() => {
      const alert = screen.queryByTestId('alert-container-validation-not-found');
      expect(alert).not.toBeInTheDocument();
    });
  });

  test('should handle no suggested case number in docket text', async () => {
    order = MockData.getTransferOrder({ override: { docketSuggestedCaseNumber: undefined } });
    vi.spyOn(Api2, 'getOrderSuggestions').mockResolvedValue({ data: suggestedCases });
    vi.spyOn(Api2, 'getCaseSummary').mockRejectedValue(caseSummaryError);

    renderWithProps({ order });

    await waitFor(() => {
      const caseTable = document.querySelector('#suggested-cases');
      expect(caseTable).toBeInTheDocument();
    });

    const radio = screen.getByTestId(emptySuggestedCasesId);
    fireEvent.click(radio);

    const input = findCaseNumberInput(order.id);
    expect(input).toHaveValue('');
  });
});
