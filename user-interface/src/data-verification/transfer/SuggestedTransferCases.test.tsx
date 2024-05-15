import { describe } from 'vitest';
import {
  SuggestedTransferCases,
  SuggestedTransferCasesImperative,
  SuggestedTransferCasesProps,
} from './SuggestedTransferCases';
import { TransferOrder } from '@common/cams/orders';
import { OfficeDetails } from '@common/cams/courts';
import { render, waitFor, screen } from '@testing-library/react';
import React from 'react';
import { MockData } from '@common/cams/test-utilities/mock-data';
import Api from '@/lib/models/api';
import { ResponseData, SimpleResponseData } from '@/lib/type-declarations/api';
//import { ResponseData } from '@/lib/type-declarations/api';
import { CaseSummary } from '@common/cams/cases';

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
  console.log('MOCKING getCaseSummary');
  return Promise.resolve({ success: true, body: fromCaseSummary });
}

async function mockGetTransferredCaseSuggestionsFullWithDelay(): Promise<
  ResponseData<CaseSummary[]>
> {
  await sleep(200);
  console.log('MOCKING getTransferredCaseSuggestions');
  return mockGetTransferredCaseSuggestionsFull();
}

async function mockGetTransferredCaseSuggestionsFull(): Promise<ResponseData<CaseSummary[]>> {
  return Promise.resolve({ message: 'ok', count: suggestedCases.length, body: suggestedCases });
}

async function mockGetTransferredCaseSuggestionsEmptyWithDelay(): Promise<
  ResponseData<CaseSummary[]>
> {
  await sleep(200);
  console.log('MOCKING getTransferredCaseSuggestions-Empty', 0);
  return Promise.resolve({ message: 'ok', count: 0, body: [] });
}

describe('SuggestedTransferCases component', () => {
  let order: TransferOrder;

  function renderWithProps(props?: Partial<SuggestedTransferCasesProps>) {
    const onCaseSelection = vitest.fn();
    const onAlert = vitest.fn();
    const ref = React.createRef<SuggestedTransferCasesImperative>();
    const defaultProps: SuggestedTransferCasesProps = {
      order,
      officesList: testOffices,
      onCaseSelection,
      onAlert,
    };

    const renderProps = { ...defaultProps, ...props };
    render(<SuggestedTransferCases {...renderProps} ref={ref} />);

    return {
      ref,
      onCaseSelection,
      onAlert,
    };
  }

  beforeEach(async () => {
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

    const description = document.querySelector('.select-destination-case--description');
    expect(description).toBeInTheDocument();
    expect(description).toHaveTextContent(
      'Select the new case from the list below. If the case is not listed, select the new court division and enter the new case number.',
    );

    await waitFor(() => {
      const description = document.querySelector('.select-destination-case--description');
      expect(description).not.toBeInTheDocument();
    });
  });

  test('should display loading spinner while loading suggestions and hide it when suggestions are retrieved', async () => {
    vi.spyOn(Api, 'get')
      .mockImplementationOnce(mockGetTransferredCaseSuggestionsFullWithDelay)
      .mockImplementationOnce(mockGetCaseSummary);

    renderWithProps();

    const testId = `loading-spinner-${order.id}-suggestions`;
    const spinner = screen.getByTestId(testId);
    expect(spinner).toBeInTheDocument();

    await waitFor(() => {
      const spinner = document.querySelector(testId);
      expect(spinner).not.toBeInTheDocument();
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
    });
  });

  test('should display alert and case entry form if we get less than 1 suggested case', () => {});
  test('should call onAlert if an error results from fetching case suggestions', () => {});
  test('should call onCaseSelection if a selection is made', () => {});
  test('should display form if no-case-suggestion radio button is selected', () => {});
  test('should display validation alert if an invalid case number is entered in the form', () => {});
  test('should display table result if a valid case number has been entered into the form', () => {});
  test('ref.reset should reset all form fields, validation states, case summary and order transfer details', () => {});
  test('ref.cancel should reset and hide all form entry fields', () => {});
  test('should ', () => {});
  test('should ', () => {});
  test('should ', () => {});
  test('should ', () => {});
  test('updateOrderTransfer should return an updated order when supplied an existing order and a caseNumber', () => {});
});
