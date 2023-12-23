import { render, screen, waitFor } from '@testing-library/react';
import ReviewOrders from './ReviewOrdersScreen';

describe('Review Orders screen', () => {
  beforeEach(() => {
    vi.stubEnv('CAMS_PA11Y', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test.skip('Should render review orders screen with a list of 3 orders', async () => {
    render(<ReviewOrders />);

    const ordersScreen = screen.getByTestId('review-orders-screen');

    expect(ordersScreen).toBeInTheDocument();

    let accordionGroup;

    await waitFor(() => {
      accordionGroup = screen.getByTestId('accordion-group');
      expect(accordionGroup).toBeInTheDocument();
    });

    console.log(screen.debug(accordionGroup));
    /*
    const accordion1 = screen.getByTestId('accordion-0');
    const accordion2 = screen.getByTestId('accordion-1');
    const accordion3 = screen.getByTestId('accordion-3');

    expect(accordion1).toBeInTheDocument();
    expect(accordion2).toBeInTheDocument();
    expect(accordion3).toBeInTheDocument();
    */
  });
});
