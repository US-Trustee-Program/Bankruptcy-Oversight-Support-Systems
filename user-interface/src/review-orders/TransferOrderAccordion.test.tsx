import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import { OfficeDetails, Order, OrderResponseData } from '@/lib/type-declarations/chapter-15';
import { orderType, statusType } from './ReviewOrdersScreen';
import { BrowserRouter } from 'react-router-dom';
import { formatDate } from '@/lib/utils/datetime';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import {
  TransferOrderAccordion,
  getOfficeList,
  isValidOrderTransfer,
} from './TransferOrderAccordion';

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
        'USTP Office: transfer from02 - Court Division 1to02 - New York 1',
      );
    });
  });

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
        'USTP Office: transfer from02 - Court Division 1to02 - New York 1',
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

// function buildChangeEvent(value: string): React.ChangeEvent<HTMLInputElement> {
//   const element = new HTMLInputElement();
//   element.value = value;
//   return { target: element };
// }
