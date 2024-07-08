import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { describe } from 'vitest';
import {
  SuggestedTransferCases,
  SuggestedTransferCasesImperative,
  SuggestedTransferCasesProps,
} from './SuggestedTransferCases';
import { OrderStatus, TransferOrder } from '@common/cams/orders';
import { OfficeDetails } from '@common/cams/courts';
import { render, waitFor, screen, fireEvent } from '@testing-library/react';
import { MockData } from '@common/cams/test-utilities/mock-data';

// Because tests set CAMS_PA11Y = true
import Api from '@/lib/models/chapter15-mock.api.cases';

import { ResponseData, SimpleResponseData } from '@/lib/type-declarations/api';
import { CaseSummary } from '@common/cams/cases';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { CaseDocketEntry } from '@/lib/type-declarations/chapter-15';

const testOffices: OfficeDetails[] = [
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

const sleep = (delay: number) => {
  return new Promise((resolve) => {
    return setTimeout(resolve, delay);
  });
};

const fromCaseSummary = MockData.getCaseSummary();
const suggestedCases = MockData.buildArray(MockData.getCaseSummary, 2);

async function mockGetCaseSummary(): Promise<SimpleResponseData<CaseSummary>> {
  return Promise.resolve({ success: true, body: fromCaseSummary });
}

async function mockGetCaseSummaryNotFound(): Promise<
  ResponseData | SimpleResponseData<CaseSummary>
> {
  throw new Error('Case summary not found for case ID.');
}

async function mockGetTransferredCaseSuggestionsFull(): Promise<ResponseData<CaseSummary[]>> {
  return Promise.resolve({ message: 'ok', count: suggestedCases.length, body: suggestedCases });
}

async function mockGetTransferredCaseSuggestionsEmptyWithDelay(): Promise<
  ResponseData<CaseSummary[]>
> {
  await sleep(200);
  return mockGetTransferredCaseSuggestionsEmpty();
}

async function mockGetTransferredCaseSuggestionsEmpty(): Promise<ResponseData<CaseSummary[]>> {
  return Promise.resolve({ message: 'ok', count: 0, body: [] });
}

const mockErrorMessage = 'Some mock error';
async function mockGetTransferredCaseSuggestionsError(): Promise<ResponseData<CaseSummary[]>> {
  throw new Error(mockErrorMessage);
}

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

function enterCaseNumber(caseIdInput: Element | null | undefined, value: string) {
  if (!caseIdInput) throw Error();

  fireEvent.change(caseIdInput!, { target: { value } });
  expect(caseIdInput).toHaveValue(value);

  return caseIdInput;
}

function selectItemInCombobox(orderId: string, index: number) {
  const courtComboboxItems = document.querySelectorAll(`#court-selection-${orderId} li button`);
  fireEvent.click(courtComboboxItems[index]!);
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

  const radio = screen.getByTestId('suggested-cases-radio-empty');
  fireEvent.click(radio);

  const newCaseCourtSelect = screen.getByTestId(`court-selection-usa-combo-box-${order.id}`);
  expect(newCaseCourtSelect).toBeVisible();

  selectItemInCombobox(order.id, 0);

  const caseNumber = getCaseNumber(suggestedCases[0].caseId);
  const input = findCaseNumberInput(order.id);
  const updated = enterCaseNumber(input, caseNumber);
  expect(updated).toHaveValue(caseNumber);
}

describe('SuggestedTransferCases component', () => {
  let order: TransferOrder;

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
    vi.stubEnv('CAMS_PA11Y', 'true');
    order = MockData.getTransferOrder();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should display descriptive instructions when loading suggestions and hide it if suggestedCases returns 0 results', async () => {
    vi.spyOn(Api, 'get')
      .mockImplementationOnce(mockGetTransferredCaseSuggestionsEmptyWithDelay)
      .mockImplementationOnce(mockGetCaseSummary);

    renderWithProps();

    await waitFor(() => {
      const description = screen.getByTestId('suggested-cases-not-found');
      expect(description).toBeInTheDocument();
      expect(description).toHaveTextContent(
        'Select the new court division and enter the new case number.',
      );
    });
  });

  test('should display case table if we get more than 0 suggested cases', async () => {
    vi.spyOn(Api, 'get')
      .mockImplementationOnce(mockGetTransferredCaseSuggestionsFull)
      .mockImplementationOnce(mockGetCaseSummary);

    renderWithProps();

    await waitFor(() => {
      const caseTable = document.querySelector('#suggested-cases');
      expect(caseTable).toBeInTheDocument();

      const description = screen.getByTestId('suggested-cases-found');
      expect(description).toBeInTheDocument();
      expect(description).toHaveTextContent(
        'Select the new case from the list below. If the case is not listed, select "case not listed" and enter the new court division and enter the new case number.',
      );
    });
  });

  test('should call onAlert if an error results from fetching case suggestions', async () => {
    vi.spyOn(Api, 'get').mockImplementationOnce(mockGetTransferredCaseSuggestionsError);
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
    vi.spyOn(Api, 'get')
      .mockImplementationOnce(mockGetTransferredCaseSuggestionsFull)
      .mockImplementationOnce(mockGetCaseSummary);

    const { onCaseSelection } = renderWithProps();

    await waitFor(() => {
      const caseTable = document.querySelector('#suggested-cases');
      expect(caseTable).toBeInTheDocument();
    });

    const radio = screen.getByTestId('suggested-cases-radio-0');
    fireEvent.click(radio);

    expect(onCaseSelection).toHaveBeenCalledWith(expect.objectContaining({ ...suggestedCases[0] }));
  });

  test('should display validation error alert if an invalid case number is entered into input', async () => {
    vi.spyOn(Api, 'get')
      .mockImplementationOnce(mockGetTransferredCaseSuggestionsFull)
      .mockImplementationOnce(mockGetCaseSummaryNotFound);

    renderWithProps();

    await fillCaseNotListedForm(order);

    await waitFor(() => {
      const alert = screen.getByTestId('alert-container-validation-not-found');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveClass('visible');
    });
  });

  test('should display table result if a valid case number has been entered into the form', async () => {
    vi.spyOn(Api, 'get')
      .mockImplementationOnce(mockGetTransferredCaseSuggestionsFull)
      .mockImplementationOnce(mockGetCaseSummary);

    renderWithProps();

    await fillCaseNotListedForm(order);

    await waitFor(async () => {
      const validCasesTable = await screen.findByTestId('validated-cases');
      expect(validCasesTable).toBeVisible();
    });
  });

  test('ref.cancel should reset all form fields, validation states, case summary and order transfer details', async () => {
    vi.spyOn(Api, 'get')
      .mockImplementationOnce(mockGetTransferredCaseSuggestionsFull)
      .mockImplementationOnce(mockGetCaseSummary);

    const { ref } = renderWithProps();

    await fillCaseNotListedForm(order);

    ref.current?.cancel();

    suggestedCases.forEach((_, idx) => {
      const radioBtn = screen.getByTestId(`suggested-cases-radio-${idx}`);
      expect(radioBtn).not.toBeChecked();
    });

    await waitFor(() => {
      const radioBtn = screen.getByTestId('suggested-cases-radio-empty');
      expect(radioBtn).not.toBeChecked();
    });

    const caseEntryForm = document.querySelector('case-entry-form');
    expect(caseEntryForm).not.toBeInTheDocument();
  });

  test('should properly handle deselecting court', async () => {
    vi.spyOn(Api, 'get')
      .mockImplementationOnce(mockGetTransferredCaseSuggestionsFull)
      .mockImplementationOnce(mockGetCaseSummaryNotFound);

    renderWithProps();

    await fillCaseNotListedForm(order);

    await waitFor(() => {
      const alert = screen.getByTestId('alert-container-validation-not-found');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveClass('visible');
    });

    selectItemInCombobox(order.id, 0);

    await waitFor(() => {
      const alert = screen.queryByTestId('alert-container-validation-not-found');
      expect(alert).not.toBeInTheDocument();
    });
  });

  test('should properly handle removing case number', async () => {
    vi.spyOn(Api, 'get')
      .mockImplementationOnce(mockGetTransferredCaseSuggestionsFull)
      .mockImplementationOnce(mockGetCaseSummaryNotFound);

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
    vi.spyOn(Api, 'get')
      .mockImplementationOnce(mockGetTransferredCaseSuggestionsFull)
      .mockImplementationOnce(mockGetCaseSummaryNotFound);

    renderWithProps({ order });

    await waitFor(() => {
      const caseTable = document.querySelector('#suggested-cases');
      expect(caseTable).toBeInTheDocument();
    });

    const radio = screen.getByTestId('suggested-cases-radio-empty');
    fireEvent.click(radio);

    const input = findCaseNumberInput(order.id);
    expect(input).toHaveValue('');
  });
});
