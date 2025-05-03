import { getCaseNumber } from '@/lib/utils/caseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { orderStatusType, orderType } from '@/lib/utils/labels';
import { CourtDivisionDetails } from '@common/cams/courts';
import { TransferOrder } from '@common/cams/orders';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe } from 'vitest';

import { TransferOrderAccordion, TransferOrderAccordionProps } from './TransferOrderAccordion';

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

function findAccordionHeading(id: string) {
  const heading = screen.getByTestId(`accordion-heading-${id}`);
  expect(heading).toBeInTheDocument();
  expect(heading).toBeVisible();
  return heading;
}

function findActionText(id: string, visible: boolean) {
  const content = screen.getByTestId(`action-text-${id}`);
  expect(content).toBeInTheDocument();
  if (visible) {
    expect(content).toBeVisible();
  } else {
    expect(content).not.toBeVisible();
  }
  return content;
}

describe('TransferOrderAccordion', () => {
  let order: TransferOrder;
  const regionMap = new Map();
  regionMap.set('02', 'NEW YORK');
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

  const accordionFieldHeaders = ['Court District', 'Order Filed', 'Event Type', 'Event Status'];

  function renderWithProps(props?: Partial<TransferOrderAccordionProps>) {
    const defaultProps: TransferOrderAccordionProps = {
      courts: testOffices,
      fieldHeaders: accordionFieldHeaders,
      onExpand: () => {},
      onOrderUpdate: () => {},
      order: order,
      orderType,
      regionsMap: regionMap,
      statusType: orderStatusType,
    };

    const renderProps = { ...defaultProps, ...props };
    render(
      <BrowserRouter>
        <TransferOrderAccordion {...renderProps} />
      </BrowserRouter>,
    );
  }

  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    order = MockData.getTransferOrder();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should render an order', async () => {
    renderWithProps();

    const heading = findAccordionHeading(order.id);

    expect(heading?.textContent).toContain(order.courtName);
    expect(heading?.textContent).toContain(formatDate(order.orderDate));

    const content = findAccordionContent(order.id, false);
    if (heading) fireEvent.click(heading);

    expect(content?.textContent).toContain(order.docketEntries[0]?.summaryText);
    expect(content?.textContent).toContain(order.docketEntries[0]?.fullText);

    const form = screen.getByTestId(`order-form-${order.id}`);
    expect(form).toBeInTheDocument();
  });

  test('should expand and show detail when a header is clicked', async () => {
    let heading;
    renderWithProps();

    await waitFor(async () => {
      heading = findAccordionHeading(order.id);
      findAccordionContent(order.id, false);
    });

    if (heading) fireEvent.click(heading);

    await waitFor(async () => {
      findAccordionContent(order.id, true);
    });
  });

  test('should expand and show order reject details with reason undefined when a rejected header is clicked if rejection does not have a reason.', async () => {
    let heading;
    const rejectedOrder: TransferOrder = { ...order, reason: '', status: 'rejected' };

    renderWithProps({
      order: rejectedOrder,
    });

    await waitFor(async () => {
      heading = findAccordionHeading(order.id);
    });

    if (heading) fireEvent.click(heading);

    await waitFor(async () => {
      const content = findAccordionContent(order.id, true);
      expect(content).toHaveTextContent(`Rejected transfer of ${getCaseNumber(order.caseId)}.`);
    });
  });

  test('should expand and show order reject details with reason when a rejected header is clicked that does have a reason defined', async () => {
    let heading;
    const rejectedOrder: TransferOrder = { ...order, reason: 'order is bad', status: 'rejected' };

    renderWithProps({
      order: rejectedOrder,
    });

    await waitFor(async () => {
      heading = findAccordionHeading(order.id);
    });

    if (heading) fireEvent.click(heading);

    await waitFor(async () => {
      const content = findAccordionContent(order.id, true);
      expect(content).toHaveTextContent(
        `Rejected transfer of ${getCaseNumber(order.caseId)} for the following reason:order is bad`,
      );
    });
  });

  test('should expand and show order transfer information when an order has been approved', async () => {
    let heading;

    const mockedApprovedOrder: TransferOrder = MockData.getTransferOrder({
      override: {
        status: 'approved',
      },
    });

    renderWithProps({
      order: mockedApprovedOrder,
    });

    await waitFor(async () => {
      heading = findAccordionHeading(mockedApprovedOrder.id);
    });

    if (heading) fireEvent.click(heading);

    await waitFor(async () => {
      const actionText = findActionText(mockedApprovedOrder.id, true);
      expect(actionText).toHaveTextContent(
        `Transferred ${getCaseNumber(mockedApprovedOrder.caseId)} from ${mockedApprovedOrder.courtName} (${mockedApprovedOrder.courtDivisionName}) to ${getCaseNumber(mockedApprovedOrder.newCase?.caseId)} and court ${mockedApprovedOrder.newCase?.courtName} (${mockedApprovedOrder.newCase?.courtDivisionName}).`,
      );
    });
  });
});
