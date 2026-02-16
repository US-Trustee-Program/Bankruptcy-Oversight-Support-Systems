import React from 'react';
import { OrderStatus } from '@common/cams/orders';
import { CourtDivisionDetails } from '@common/cams/courts';
import { act, render, waitFor, screen, fireEvent } from '@testing-library/react';
import MockData from '@common/cams/test-utilities/mock-data';
import { CaseDocketEntry, CaseSummary } from '@common/cams/cases';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import Api2 from '@/lib/models/api2';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import { MOCKED_USTP_OFFICES_ARRAY } from '@common/cams/test-utilities/offices.mock';
import { BrowserRouter } from 'react-router-dom';
import { describe } from 'vitest';
import SuggestedTransferCases, {
  SuggestedTransferCasesImperative,
  SuggestedTransferCasesProps,
} from './SuggestedTransferCases';

const testOffices: CourtDivisionDetails[] = [
  {
    courtDivisionCode: '001',
    groupDesignator: 'AA',
    courtId: '0101',
    officeCode: '1',
    officeName: 'A1',
    state: 'NY',
    courtName: 'A',
    courtDivisionName: 'New York 1',
    regionId: '02',
    regionName: 'NEW YORK',
  },
  {
    courtDivisionCode: '003',
    groupDesignator: 'AC',
    courtId: '0103',
    officeCode: '3',
    officeName: 'C1',
    state: 'NY',
    courtName: 'C',
    courtDivisionName: 'New York 1',
    regionId: '02',
    regionName: 'NEW YORK',
  },
  {
    courtDivisionCode: '002',
    groupDesignator: 'AB',
    courtId: '0102',
    officeCode: '2',
    officeName: 'B1',
    state: 'NY',
    courtName: 'B',
    courtDivisionName: 'New York 1',
    regionId: '02',
    regionName: 'NEW YORK',
  },
];

const fromCaseSummary = MockData.getCaseSummary();
const suggestedCases = MockData.buildArray(MockData.getCaseSummary, 2);
const caseSummaryError = new Error('Case summary not found for case ID.');

const mockErrorMessage = 'Some mock error';
const emptySuggestedCasesId = 'button-radio-case-not-listed-radio-button-click-target';

async function waitForLoadToComplete(orderId: string) {
  const testId = `loading-spinner-${orderId}-suggestions`;
  const spinner = screen.getByTestId(testId);
  expect(spinner).toBeInTheDocument();

  await waitFor(() => {
    expect(spinner).not.toBeInTheDocument();
  });
}

function findCaseNumberInput(id: string) {
  const caseIdInput = document.querySelector(`input#new-case-input-${id}`);
  expect(caseIdInput).toBeInTheDocument();
  return caseIdInput;
}

async function enterCaseNumber(caseIdInput: Element | null | undefined, value: string) {
  if (!caseIdInput) {
    throw Error();
  }

  // This directive is the only way I've found to suppress the React act warnings in this test suite.
  // Using userEvent.type works for one test that uses this function, but fails with another test that uses it.
  // eslint-disable-next-line testing-library/no-unnecessary-act
  await act(async () => fireEvent.change(caseIdInput!, { target: { value } }));

  expect(caseIdInput).toHaveValue(value);

  return caseIdInput;
}

async function selectItemInCombobox(orderId: string, index: number) {
  const courtComboboxItems = document.querySelectorAll(`#court-selection-${orderId} li`);
  const userEvent = TestingUtilities.setupUserEvent();
  await userEvent.click(courtComboboxItems[index]!);
}

async function fillCaseNotListedForm(
  order: CaseSummary & {
    id: string;
    orderType: 'transfer';
    orderDate: string;
    status: OrderStatus;
    docketEntries: CaseDocketEntry[];
    docketSuggestedCaseNumber?: string;
    newCase?: CaseSummary;
    reason?: string;
  },
) {
  await waitFor(() => {
    const caseTable = document.querySelector('#suggested-cases');
    expect(caseTable).toBeInTheDocument();
  });

  const radio = screen.getByTestId(emptySuggestedCasesId);
  fireEvent.click(radio);

  expect(await screen.findByTestId(`court-selection-usa-combo-box-${order.id}`)).toBeVisible();

  await selectItemInCombobox(order.id, 0);

  const caseNumber = getCaseNumber(suggestedCases[0].caseId);
  const input = findCaseNumberInput(order.id);

  const updated = await enterCaseNumber(input, caseNumber);
  expect(updated).toHaveValue(caseNumber);
}

describe('SuggestedTransferCases component', () => {
  const order = MockData.getTransferOrder();

  function renderWithProps(props?: Partial<SuggestedTransferCasesProps>) {
    const onCaseSelection = vitest.fn();
    const onInvalidCaseNumber = vitest.fn();
    const onAlert = vitest.fn();
    const ref = React.createRef<SuggestedTransferCasesImperative>();
    const defaultProps: SuggestedTransferCasesProps = {
      order,
      officesList: testOffices,
      onCaseSelection,
      onInvalidCaseNumber,
      onAlert,
    };

    const renderProps = { ...defaultProps, ...props };
    render(
      <BrowserRouter>
        <SuggestedTransferCases {...renderProps} ref={ref} />
      </BrowserRouter>,
    );

    return {
      ref,
      onCaseSelection,
      onAlert,
    };
  }

  beforeEach(async () => {
    TestingUtilities.setUser({
      roles: [CamsRole.DataVerifier],
      offices: MOCKED_USTP_OFFICES_ARRAY,
    });
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should display descriptive instructions when loading suggestions and hide it if suggestedCases returns 0 results', async () => {
    vi.spyOn(Api2, 'getOrderSuggestions').mockResolvedValue({ data: [] });
    vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue({ data: fromCaseSummary });

    renderWithProps();
    await TestingUtilities.waitForDocumentBody();

    const description = screen.getByTestId('suggested-cases-not-found');
    expect(description).toBeInTheDocument();
    expect(description).toHaveTextContent(
      'Choose a new court division and enter a case number, and a case will be selected for this case event automatically.',
    );
  });

  test('should display case table if we get more than 0 suggested cases', async () => {
    vi.spyOn(Api2, 'getOrderSuggestions').mockResolvedValue({ data: suggestedCases });
    vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue({ data: fromCaseSummary });

    renderWithProps();
    await TestingUtilities.waitForDocumentBody();

    const caseTable = document.querySelector('#suggested-cases');
    expect(caseTable).toBeInTheDocument();

    const description = screen.getByTestId('suggested-cases-found');
    expect(description).toBeInTheDocument();
    expect(description).toHaveTextContent(
      'Select the new case from the list below. If the case is not listed, select "case not listed" and enter the new court division and case number.',
    );
  });

  test('should call onAlert if an error results from fetching case suggestions', async () => {
    vi.spyOn(Api2, 'getOrderSuggestions').mockRejectedValue(new Error(mockErrorMessage));
    const { onAlert } = renderWithProps();

    await waitForLoadToComplete(order.id);

    expect(onAlert).toHaveBeenCalled();
    expect(onAlert).toHaveBeenCalledWith({
      message: mockErrorMessage,
      type: UswdsAlertStyle.Error,
      timeOut: 8,
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

    expect(await screen.findByTestId('validated-cases')).toBeVisible();
  });

  test('ref.cancel should reset all form fields, validation states, case summary and order transfer details', async () => {
    vi.spyOn(Api2, 'getOrderSuggestions').mockResolvedValue({ data: suggestedCases });
    vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue({ data: fromCaseSummary });

    const { ref } = renderWithProps();

    await fillCaseNotListedForm(order);

    act(() => ref.current?.cancel());

    suggestedCases.forEach((_, idx) => {
      const radioBtn = screen.getByTestId(`radio-suggested-cases-checkbox-${idx}`);
      expect(radioBtn).not.toBeChecked();
    });

    await waitFor(() => {
      const radioBtn = screen.getByTestId(emptySuggestedCasesId);
      expect(radioBtn).not.toBeChecked();
    });
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
    await enterCaseNumber(input, caseNumberWithTooFewCharacters);

    await waitFor(() => {
      const alert = screen.queryByTestId('alert-container-validation-not-found');
      expect(alert).not.toBeInTheDocument();
    });
  });

  test('should handle no suggested case number in docket text', async () => {
    const order_ = MockData.getTransferOrder({
      override: { docketSuggestedCaseNumber: undefined },
    });
    vi.spyOn(Api2, 'getOrderSuggestions').mockResolvedValue({ data: suggestedCases });
    vi.spyOn(Api2, 'getCaseSummary').mockRejectedValue(caseSummaryError);

    renderWithProps({ order: order_ });

    await waitFor(() => {
      const caseTable = document.querySelector('#suggested-cases');
      expect(caseTable).toBeInTheDocument();
    });

    const radio = screen.getByTestId(emptySuggestedCasesId);
    fireEvent.click(radio);

    const input = findCaseNumberInput(order_.id);
    expect(input).toHaveValue('');
  });
});
