import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import { OrderResponseData } from '@/lib/type-declarations/chapter-15';
import ReviewOrders from './ReviewOrdersScreen';
import { BrowserRouter } from 'react-router-dom';
import { formatDate } from '@/lib/utils/datetime';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';

describe('Review Orders screen', () => {
  let ordersResponse: OrderResponseData;

  beforeAll(async () => {
    ordersResponse = (await Chapter15MockApi.get('/orders')) as unknown as OrderResponseData;
  });

  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('should render a list of orders', async () => {
    render(
      <BrowserRouter>
        <ReviewOrders />
      </BrowserRouter>,
    );

    const ordersScreen = screen.getByTestId('review-orders-screen');
    expect(ordersScreen).toBeInTheDocument();

    const accordionGroup = screen.getByTestId('accordion-group');
    expect(accordionGroup).toBeInTheDocument();

    let idx = 0;
    for (const order of ordersResponse.body) {
      await waitFor(async () => {
        const heading = screen.getByTestId(`accordion-heading-${idx}`);
        expect(heading).toBeInTheDocument();
        expect(heading).toBeVisible();
        expect(heading?.textContent).toContain(order.caseTitle);
        expect(heading?.textContent).toContain(getCaseNumber(order.caseId));
        expect(heading?.textContent).toContain(formatDate(order.orderDate));

        const content = screen.getByTestId(`accordion-content-${idx}`);
        expect(content).toBeInTheDocument();
        expect(content).not.toBeVisible();
        expect(content?.textContent).toContain(order.summaryText);
        expect(content?.textContent).toContain(order.fullText);

        const newCaseIdText = screen.getByTestId(`new-case-input-${idx}`);
        expect(newCaseIdText).toHaveValue(order.newCaseId);
      });
      idx++;
    }
  });

  test('should expand and show detail when a header is clicked', async () => {
    render(
      <BrowserRouter>
        <ReviewOrders />
      </BrowserRouter>,
    );

    const idx = 0;

    await waitFor(async () => {
      const heading = screen.getByTestId(`accordion-heading-${idx}`);
      expect(heading).toBeInTheDocument();
      expect(heading).toBeVisible();

      const content = screen.getByTestId(`accordion-content-${idx}`);
      expect(content).toBeInTheDocument();
      expect(content).not.toBeVisible();
    });

    act(() => {
      const heading = screen.getByTestId(`accordion-heading-${idx}`);
      if (heading) fireEvent.click(heading);
    });

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${idx}`);
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

    const idx = 0;

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${idx}`);
      expect(content).toBeInTheDocument();
      expect(content).not.toBeVisible();
    });

    act(() => {
      const heading = screen.getByTestId(`accordion-heading-${idx}`);
      if (heading) fireEvent.click(heading);
    });

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${idx}`);
      expect(content).toBeInTheDocument();
      expect(content).toBeVisible();
    });

    act(() => {
      const selection = screen.getByTestId(`court-selection-${idx}`);
      expect(selection).toBeInTheDocument();
      if (selection) {
        fireEvent.click(selection);
        fireEvent.change(selection, { target: { value: '001' } });
      }
    });

    await waitFor(async () => {
      const preview = screen.getByTestId(`preview-description-${idx}`);
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

    const idx = 0;

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${idx}`);
      expect(content).toBeInTheDocument();
      expect(content).not.toBeVisible();
    });

    act(() => {
      const heading = screen.getByTestId(`accordion-heading-${idx}`);
      if (heading) fireEvent.click(heading);
    });

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${idx}`);
      expect(content).toBeInTheDocument();
      expect(content).toBeVisible();
    });

    act(() => {
      const selection = screen.getByTestId(`court-selection-${idx}`);
      expect(selection).toBeInTheDocument();
      if (selection) {
        fireEvent.click(selection);
        fireEvent.change(selection, { target: { value: '001' } });
      }
    });

    await waitFor(async () => {
      const preview = screen.getByTestId(`preview-description-${idx}`);
      expect(preview).toBeInTheDocument();
      expect(preview).toBeVisible();
      expect(preview?.textContent).toEqual(
        'USTP Office: transfer from02 - Court Division 1to02 - New York 1',
      );
    });

    act(() => {
      const selection = screen.getByTestId(`court-selection-${idx}`);
      expect(selection).toBeInTheDocument();
      if (selection) {
        fireEvent.click(selection);
        fireEvent.change(selection, { target: { value: '' } });
      }
    });

    await waitFor(async () => {
      const preview = screen.queryByTestId(`preview-description-${idx}`);
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

    const idx = 0;
    const order = ordersResponse.body[idx];

    await waitFor(async () => {
      screen.getByTestId(`accordion-content-${idx}`);
    });

    act(() => {
      const heading = screen.getByTestId(`accordion-heading-${idx}`);
      if (heading) fireEvent.click(heading);
    });

    await waitFor(async () => {
      const newCaseIdText = screen.getByTestId(`new-case-input-${idx}`);
      expect(newCaseIdText).toHaveValue(order.newCaseId);
    });

    const newValue = '081-22-33333';
    act(() => {
      const newCaseIdText = screen.getByTestId(`new-case-input-${idx}`);
      fireEvent.change(newCaseIdText, { target: { value: newValue } });
    });

    await waitFor(async () => {
      const newCaseIdText = screen.getByTestId(`new-case-input-${idx}`);
      expect(newCaseIdText).toHaveValue(newValue);
    });
  });

  test('should not render a list if an API error is encountered', async () => {
    vitest.spyOn(Chapter15MockApi, 'get').mockRejectedValue({});

    render(
      <BrowserRouter>
        <ReviewOrders />
      </BrowserRouter>,
    );

    await waitFor(async () => {
      const accordionGroup = screen.getByTestId('accordion-group');
      expect(accordionGroup).toBeInTheDocument();
      expect(accordionGroup.childElementCount).toEqual(0);
    });
  });
});
