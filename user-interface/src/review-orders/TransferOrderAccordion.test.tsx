import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import { OfficeDetails, Order, OrderResponseData } from '@/lib/type-declarations/chapter-15';
import ReviewOrders, { orderType, statusType } from './ReviewOrdersScreen';
import { BrowserRouter } from 'react-router-dom';
import { formatDate } from '@/lib/utils/datetime';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { TransferOrderAccordion } from './TransferOrderAccordion';

describe('TransferOrderAccordion', () => {
  let order: Order;
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
      region: '02',
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
      region: '02',
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
      region: '02',
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
      region: '02',
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
        <ReviewOrders />
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
        <ReviewOrders />
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

    const selection = screen.getByTestId(`court-selection-${order.id}`);
    expect(selection).toBeInTheDocument();
    if (selection) {
      fireEvent.click(selection);
      fireEvent.change(selection, { target: { value: '001' } });
    }

    await waitFor(async () => {
      const preview = screen.getByTestId(`preview-description-${order.id}`);
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
        <ReviewOrders />
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

    const selection = screen.getByTestId(`court-selection-${order.id}`);
    expect(selection).toBeInTheDocument();
    if (selection) {
      fireEvent.click(selection);
      fireEvent.change(selection, { target: { value: '001' } });
    }

    await waitFor(async () => {
      const preview = screen.getByTestId(`preview-description-${order.id}`);
      expect(preview).toBeInTheDocument();
      expect(preview).toBeVisible();
      expect(preview?.textContent).toEqual(
        'USTP Office: transfer from02 - Court Division 1to02 - New York 1',
      );
    });

    expect(selection).toBeInTheDocument();
    if (selection) {
      fireEvent.click(selection);
      fireEvent.change(selection, { target: { value: '' } });
    }

    await waitFor(async () => {
      const preview = screen.queryByTestId(`preview-description-${order.id}`);
      expect(preview).toBeInTheDocument();
      expect(preview?.textContent).toEqual('');
    });
  });

  test('should allow the new case ID to be entered', async () => {
    render(
      <BrowserRouter>
        <ReviewOrders />
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

    const newValue = '081-22-33333';
    const newCaseIdText = screen.getByTestId(`new-case-input-${order.id}`);
    fireEvent.change(newCaseIdText, { target: { value: newValue } });

    await waitFor(async () => {
      const newCaseIdText = screen.getByTestId(`new-case-input-${order.id}`);
      expect(newCaseIdText).toHaveValue(newValue);
    });
  });
});
