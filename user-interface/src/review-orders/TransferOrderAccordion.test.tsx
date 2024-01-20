import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import { OfficeDetails, Order, OrderResponseData } from '@/lib/type-declarations/chapter-15';
import { orderType, statusType } from './ReviewOrdersScreen';
import { BrowserRouter } from 'react-router-dom';
import { formatDate } from '@/lib/utils/datetime';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import {
  CaseSelection,
  TransferOrderAccordion,
  getOfficeList,
  //getOrderTransferFromOrder,
  isValidOrderTransfer,
  validateNewCaseIdInput,
} from './TransferOrderAccordion';
//import * as transferModule from './TransferOrderAccordion';
import React from 'react';

vi.mock(
  '../lib/components/SearchableSelect',
  () => import('../lib/components/SearchableSelect.mock'),
);

describe('TransferOrderAccordion', () => {
  let order: Order;
  const regionMap = new Map();
  regionMap.set('02', 'NEW YORK');

  const testOffices: OfficeDetails[] = [
    {
      divisionCode: '001',
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
      divisionCode: '003',
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
      divisionCode: '002',
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
  beforeAll(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    const ordersResponse = (await Chapter15MockApi.get('/orders')) as unknown as OrderResponseData;
    order = ordersResponse.body[0];
  });

  test('should render an order', async () => {
    render(
      <BrowserRouter>
        <TransferOrderAccordion
          order={order}
          officesList={testOffices}
          orderType={orderType}
          statusType={statusType}
          onOrderUpdate={() => {}}
          onExpand={() => {}}
          regionsMap={regionMap}
        />
      </BrowserRouter>,
    );

    const heading = screen.getByTestId(`accordion-heading-${order.id}`);
    expect(heading).toBeInTheDocument();
    expect(heading).toBeVisible();
    expect(heading?.textContent).toContain(order.caseTitle);
    expect(heading?.textContent).toContain(getCaseNumber(order.caseId));
    expect(heading?.textContent).toContain(formatDate(order.orderDate));

    const content = screen.getByTestId(`accordion-content-${order.id}`);
    expect(content).toBeInTheDocument();
    expect(content).not.toBeVisible();
    expect(content?.textContent).toContain(order.summaryText);
    expect(content?.textContent).toContain(order.fullText);

    const form = screen.getByTestId(`order-form-${order.id}`);
    expect(form).toBeInTheDocument();

    const newCaseIdText = screen.getByTestId(`new-case-input-${order.id}`);
    expect(newCaseIdText).toHaveValue(order.newCaseId);
  });

  test('should expand and show detail when a header is clicked', async () => {
    render(
      <BrowserRouter>
        <TransferOrderAccordion
          order={order}
          officesList={testOffices}
          orderType={orderType}
          statusType={statusType}
          onOrderUpdate={() => {}}
          onExpand={() => {}}
          regionsMap={regionMap}
        />{' '}
      </BrowserRouter>,
    );

    await waitFor(async () => {
      const heading = screen.getByTestId(`accordion-heading-${order.id}`);
      expect(heading).toBeInTheDocument();
      expect(heading).toBeVisible();

      const content = screen.getByTestId(`accordion-content-${order.id}`);
      expect(content).toBeInTheDocument();
      expect(content).not.toBeVisible();
    });

    const heading = screen.getByTestId(`accordion-heading-${order.id}`);
    if (heading) fireEvent.click(heading);

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${order.id}`);
      expect(content).toBeInTheDocument();
      expect(content).toBeVisible();
    });
  });

  test('should show preview description when a court is selected', async () => {
    render(
      <BrowserRouter>
        <TransferOrderAccordion
          order={order}
          officesList={testOffices}
          orderType={orderType}
          statusType={statusType}
          onOrderUpdate={() => {}}
          onExpand={() => {}}
          regionsMap={regionMap}
        />{' '}
      </BrowserRouter>,
    );

    expect(order.status).toBe('pending');

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${order.id}`);
      expect(content).toBeInTheDocument();
      expect(content).not.toBeVisible();
    });

    const heading = screen.getByTestId(`accordion-heading-${order.id}`);
    if (heading) fireEvent.click(heading);

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${order.id}`);
      expect(content).toBeInTheDocument();
      expect(content).toBeVisible();

      const selectionComboBox = screen.getByTestId(`court-selection-usa-combo-box-${order.id}`);
      expect(selectionComboBox).toBeInTheDocument();
      expect(selectionComboBox).toBeVisible();
    });

    /**
     * SearchableSelect is a black box.  We can't fire events on it.  We'll have to mock onChange on it.
     */
    const selectInput = document.querySelector(`input#court-selection-${order.id}`);
    expect(selectInput).toBeInTheDocument();
    fireEvent.change(selectInput!, { target: { value: 'random value' } });

    let preview: HTMLElement;
    await waitFor(async () => {
      preview = screen.getByTestId(`preview-description-${order.id}`);
      expect(preview).toBeInTheDocument();
      expect(preview).toBeVisible();
      expect(preview?.textContent).toEqual(
        'USTP Office: transfer fromRegion 2 - Court Division 1toRegion 2 - New York 1',
      );
    });
  });

  /*
  test('should display modal and when Approve is clicked, upon submission of modal should update the status of order to approved', async () => {
    vi.spyOn(transferModule, 'updateOrderTransfer').mockReturnValue({
      id: 'guid-1',
      sequenceNumber: 1,
      caseId: '11-22222',
      newCaseId: '22-11111',
      newCourtName: 'New Test Court',
      newCourtDivisionName: 'New Division Name',
      newDivisionCode: '001',
      newRegionId: '02',
      newRegionName: 'NEW YORK',
      status: 'pending',
      reason: 'Test Reason',
    });

    render(
      <BrowserRouter>
        <TransferOrderAccordion
          order={order}
          officesList={testOffices}
          orderType={orderType}
          statusType={statusType}
          onOrderUpdate={() => {}}
          onExpand={() => {}}
          regionsMap={regionMap}
        />{' '}
      </BrowserRouter>,
    );

    expect(order.status).toBe('pending');

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${order.id}`);
      expect(content).toBeInTheDocument();
    });

    let heading: HTMLElement;
    await waitFor(async () => {
      heading = screen.getByTestId(`accordion-heading-${order.id}`);
    }).then(() => {
      fireEvent.click(heading);
    });

    let dropdownSelect: HTMLElement;
    await waitFor(async () => {
      dropdownSelect = screen.getByTestId(`court-selection-usa-combo-box-guid-0`);
      expect(dropdownSelect).toBeInTheDocument();
      dropdownSelectDiv = document.querySelector('#court-selection-')
      const valuePlaceholder = dropdownSelect.children[0].querySelector('div');
      expect(valuePlaceholder).toHaveTextContent('Select...');

      //const unselectedValue = await screen.findByText('Select...');
      //expect(unselectedValue).toBeInTheDocument();
    }).then(() => {
      fireEvent.click(dropdownSelect!);
    });

    await waitFor(async () => {
      const dropdownSelectItem = document.querySelector('div#react-select-2-option-1');
      if (dropdownSelectItem) {
        fireEvent.click(dropdownSelectItem);
      }
    });

    await waitFor(() => {
      const unselectedValue = screen.queryByText('Select...');
      expect(unselectedValue).not.toBeInTheDocument();
    });

    let dropdownInput: HTMLElement;
    await waitFor(async () => {
      const _content = screen.getByTestId(`accordion-content-${order.id}`);
      dropdownInput = screen.getByTestId(`court-selection-${order.id}`);
    }).then(() => {
      const selection = {
        value: '002',
      };
      const _orderTransfer = getOrderTransferFromOrder(order);

      expect(dropdownInput).toBeInTheDocument();
      fireEvent.change(dropdownInput!, { target: { selection } });
    });

    //
    // SearchableSelect is a black box.  We can't fire events on it.  We'll have to mock onChange on it.
    //
    const selectInput = document.querySelector(`input#court-selection-${order.id}`);
    expect(selectInput).toBeInTheDocument();
    fireEvent.change(selectInput!, { target: { value: 'random value' } });

    await waitFor(() => {
      const approveButton = screen.getByTestId(`button-accordian-approve-button-${order.id}`);
      expect(approveButton).toBeEnabled();
      fireEvent.click(approveButton);
    });

    let confirmModal: HTMLElement;
    await waitFor(async () => {
      confirmModal = screen.getByTestId(`confirm-modal-${order.id}`);
      expect(confirmModal).toBeInTheDocument();
      expect(confirmModal).toBeVisible();
    });
  });
  */

  test('should allow a court to be deselected', async () => {
    render(
      <BrowserRouter>
        <TransferOrderAccordion
          order={order}
          officesList={testOffices}
          orderType={orderType}
          statusType={statusType}
          onOrderUpdate={() => {}}
          onExpand={() => {}}
          regionsMap={regionMap}
        />
      </BrowserRouter>,
    );

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${order.id}`);
      expect(content).toBeInTheDocument();
      expect(content).not.toBeVisible();
    });

    const heading = screen.getByTestId(`accordion-heading-${order.id}`);
    if (heading) fireEvent.click(heading);

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${order.id}`);
      expect(content).toBeInTheDocument();
      expect(content).toBeVisible();
    });

    let selection = document.querySelector(`input#court-selection-${order.id}`);
    expect(selection).toBeInTheDocument();
    fireEvent.change(selection!, { target: { value: 'random value' } });

    let preview: HTMLElement;
    await waitFor(async () => {
      preview = screen.getByTestId(`preview-description-${order.id}`);
      expect(preview).toBeInTheDocument();
      expect(preview).toBeVisible();
      expect(preview?.textContent).toEqual(
        'USTP Office: transfer fromRegion 2 - Court Division 1toRegion 2 - New York 1',
      );
    });

    selection = document.querySelector(`input#court-selection-${order.id}`);
    expect(selection).toBeInTheDocument();
    fireEvent.change(selection!, { target: { value: '' } });

    await waitFor(async () => {
      const preview = screen.queryByTestId(`preview-description-${order.id}`);
      expect(preview).not.toBeInTheDocument();
    });
  });

  test('should allow the new case ID to be entered', async () => {
    render(
      <BrowserRouter>
        <TransferOrderAccordion
          order={order}
          officesList={testOffices}
          orderType={orderType}
          statusType={statusType}
          onOrderUpdate={() => {}}
          onExpand={() => {}}
          regionsMap={regionMap}
        />{' '}
      </BrowserRouter>,
    );

    await waitFor(async () => {
      screen.getByTestId(`accordion-content-${order.id}`);
    });

    const heading = screen.getByTestId(`accordion-heading-${order.id}`);
    if (heading) fireEvent.click(heading);

    await waitFor(async () => {
      const newCaseIdText = screen.getByTestId(`new-case-input-${order.id}`);
      expect(newCaseIdText).toHaveValue(order.newCaseId);
    });

    const newValue = '22-33333';
    const newCaseIdText = screen.getByTestId(`new-case-input-${order.id}`);
    fireEvent.change(newCaseIdText, { target: { value: newValue } });

    await waitFor(async () => {
      const newCaseIdText = screen.getByTestId(`new-case-input-${order.id}`);
      expect(newCaseIdText).toHaveValue(newValue);
    });
  });

  test('should determine if an transfer update DTO is valid', () => {
    const ok = isValidOrderTransfer({
      id: 'guid-1',
      caseId: '111-22-33333',
      sequenceNumber: 0,
      status: 'pending',
      newCaseId: '222-33-44444',
      newCourtDivisionName: 'new court',
    });
    expect(ok).toBeTruthy();

    const notOk = isValidOrderTransfer({
      id: 'guid-1',
      caseId: '111-22-33333',
      sequenceNumber: 0,
      status: 'pending',
    });
    expect(notOk).toBeFalsy();
  });

  // test('should limit user input to a valid case ID', () => {
  //   const validInput = buildChangeEvent('11-22222');
  //   const ok = validateNewCaseIdInput(validInput);
  //   expect(ok.joinedInput).toEqual('');
  //   expect(ok.newCaseId).toBeUndefined;

  //   const invalidInput = buildChangeEvent('lahwrunxhncntgftitjt');
  //   const notOK = validateNewCaseIdInput(invalidInput);
  //   expect(notOK.joinedInput).toEqual('');
  //   expect(notOK.newCaseId).toBeUndefined;
  // });

  test('should get office select options', () => {
    const expectedOptions: Array<Record<string, string>> = [
      { value: '', label: ' ' },
      { value: '001', label: 'A New York 1' },
      { value: '002', label: 'B New York 1' },
      { value: '003', label: 'C New York 1' },
    ];

    const sortedTestOffices = [...testOffices].sort((a, b) =>
      a.divisionCode < b.divisionCode ? -1 : 1,
    );

    const actualOptions = getOfficeList(sortedTestOffices);
    expect(actualOptions).toStrictEqual(expectedOptions);
  });
});

describe('Test CaseSelection component', () => {
  test('Should display message as expected using toCourt and fromCourt', async () => {
    render(
      <CaseSelection
        fromCourt={{
          region: '1',
          courtDivisionName: 'Division Name 1',
        }}
        toCourt={{
          region: '002',
          courtDivisionName: 'Division Name 2',
        }}
      ></CaseSelection>,
    );

    expect(document.body).toHaveTextContent(
      'USTP Office: transfer fromRegion 1 - Division Name 1toRegion 2 - Division Name 2',
    );
  });

  test('Should properly display region as a non-numeric string when one is supplied', async () => {
    render(
      <CaseSelection
        fromCourt={{
          region: 'ABC',
          courtDivisionName: 'Division Name 1',
        }}
        toCourt={{
          region: 'BCD',
          courtDivisionName: 'Division Name 2',
        }}
      ></CaseSelection>,
    );

    expect(document.body).toHaveTextContent(
      'USTP Office: transfer fromRegion ABC - Division Name 1toRegion BCD - Division Name 2',
    );
  });
});

describe('Test validateNewCaseIdInput function', () => {
  test('When supplied a valud with a length greater than 7, it should truncate value to 7 digits', async () => {
    const testValue = '1234567890';
    const resultValue = '12-34567';

    const expectedResult = {
      newCaseId: resultValue,
      joinedInput: resultValue,
    };

    const testEvent = {
      target: {
        value: testValue,
      },
    };

    const returnedValue = validateNewCaseIdInput(testEvent as React.ChangeEvent<HTMLInputElement>);
    console.log(returnedValue);
    console.log(expectedResult);
    expect(returnedValue).toEqual(expectedResult);
  });
});
