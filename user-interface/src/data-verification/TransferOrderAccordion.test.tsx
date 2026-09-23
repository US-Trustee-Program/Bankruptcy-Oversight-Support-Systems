import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { formatDate } from '@/lib/utils/datetime';
import { TransferOrderAccordion, TransferOrderAccordionProps } from './TransferOrderAccordion';
import { describe } from 'vitest';
import { taskType, orderStatusType } from '@/lib/utils/labels';
import MockData from '@common/cams/test-utilities/mock-data';
import { CourtDivisionDetails } from '@common/cams/courts';
import { TransferOrder } from '@common/cams/orders';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import { AccordionGroup } from '@/lib/components/uswds/Accordion';

function findAccordionHeading(id: string) {
  const heading = screen.getByTestId(`accordion-heading-${id}`);
  expect(heading).toBeInTheDocument();
  expect(heading).toBeVisible();
  return heading;
}

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
  let userEvent: CamsUserEvent;

  const regionMap = new Map<string, string>([['02', 'NEW YORK']]);

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

  const accordionFieldHeaders = ['Court District', 'Order Filed', 'Task Type', 'Task Status'];

  function renderWithProps(props?: Partial<TransferOrderAccordionProps>) {
    const defaultProps: TransferOrderAccordionProps = {
      order: order,
      courts: testOffices,
      taskType,
      statusType: orderStatusType,
      onOrderUpdate: () => {},
      onExpand: () => {},
      regionsMap: regionMap,
      fieldHeaders: accordionFieldHeaders,
    };

    const renderProps = { ...defaultProps, ...props };
    render(
      <BrowserRouter>
        <TransferOrderAccordion {...renderProps} />
      </BrowserRouter>,
    );
  }

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    order = MockData.getTransferOrder();
    userEvent = TestingUtilities.setupUserEvent();
  });

  test('should render an order', async () => {
    renderWithProps();

    const heading = findAccordionHeading(order.id);
    expect(heading.textContent).toContain(order.courtName);
    expect(heading.textContent).toContain(formatDate(order.taskDate));
    expect(heading.textContent).toContain(taskType.get(order.taskType));
    expect(heading.textContent).toContain(orderStatusType.get(order.status));

    findAccordionContent(order.id, false);

    await userEvent.click(heading);

    // PendingTransferOrder owns no testid of its own; order-form is the
    // nearest stable marker (from its child SuggestedTransferCases) that the
    // pending-status branch rendered. The docket entry text this section
    // shows is a FromCaseSummary/PendingTransferOrder behavior, verified in
    // their own test files instead of here.
    const form = screen.getByTestId(`order-form-${order.id}`);
    expect(form).toBeInTheDocument();
  });

  test('renders hidden when the hidden prop is set', () => {
    renderWithProps({ hidden: true });

    const heading = screen.getByTestId(`accordion-heading-${order.id}`);
    expect(heading).not.toBeVisible();
  });

  test('shows a Collapse aria-label when expanded and Expand when not', () => {
    const { rerender } = render(
      <BrowserRouter>
        <TransferOrderAccordion
          order={order}
          courts={testOffices}
          taskType={taskType}
          statusType={orderStatusType}
          onOrderUpdate={() => {}}
          regionsMap={regionMap}
          fieldHeaders={accordionFieldHeaders}
        />
      </BrowserRouter>,
    );

    const heading = findAccordionHeading(order.id);
    expect(heading.querySelector('.expand-aria-label')).toHaveAttribute(
      'aria-label',
      'Click to Expand.',
    );

    rerender(
      <BrowserRouter>
        <TransferOrderAccordion
          order={order}
          courts={testOffices}
          taskType={taskType}
          statusType={orderStatusType}
          onOrderUpdate={() => {}}
          regionsMap={regionMap}
          fieldHeaders={accordionFieldHeaders}
          expandedId={`order-list-${order.id}`}
        />
      </BrowserRouter>,
    );

    expect(heading.querySelector('.expand-aria-label')).toHaveAttribute(
      'aria-label',
      'Click to Collapse.',
    );
  });

  // Exact wording for rejected/approved content is owned by
  // RejectedTransferOrder/ApprovedTransferOrder and verified in their own
  // test files. This accordion only needs to confirm the right branch
  // rendered for the order's status.
  test('should expand and show rejected order content when a rejected header is clicked', async () => {
    let heading;
    const rejectedOrder: TransferOrder = { ...order, reason: '', status: 'rejected' };

    renderWithProps({
      order: rejectedOrder,
    });

    await waitFor(async () => {
      heading = findAccordionHeading(order.id);
    });

    if (heading) {
      await userEvent.click(heading);
    }

    await waitFor(async () => {
      findAccordionContent(order.id, true);
    });
  });

  test('should expand and show approved order content when an approved header is clicked', async () => {
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

    if (heading) {
      await userEvent.click(heading);
    }

    await waitFor(async () => {
      findActionText(mockedApprovedOrder.id, true);
    });
  });

  test('toggles closed when the header is clicked a second time inside an AccordionGroup, notifying onExpand/onCollapse', async () => {
    const onExpand = vi.fn();
    const onCollapse = vi.fn();

    render(
      <BrowserRouter>
        <AccordionGroup>
          <TransferOrderAccordion
            order={order}
            courts={testOffices}
            taskType={taskType}
            statusType={orderStatusType}
            onOrderUpdate={() => {}}
            onExpand={onExpand}
            onCollapse={onCollapse}
            regionsMap={regionMap}
            fieldHeaders={accordionFieldHeaders}
          />
        </AccordionGroup>
      </BrowserRouter>,
    );

    const heading = findAccordionHeading(order.id);

    await userEvent.click(heading);
    findAccordionContent(order.id, true);
    expect(onExpand).toHaveBeenCalledWith(`order-list-${order.id}`);

    await userEvent.click(heading);
    findAccordionContent(order.id, false);
    expect(onCollapse).toHaveBeenCalledWith(`order-list-${order.id}`);
  });
});
