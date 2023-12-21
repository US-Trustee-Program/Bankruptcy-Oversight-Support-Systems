import { render, screen } from '@testing-library/react';
import ReviewOrders from './ReviewOrdersScreen';

describe('Review Orders screen', () => {
  test('Should render review orders screen', () => {
    render(<ReviewOrders />);

    const ordersScreen = screen.getByTestId('review-orders-screen');

    expect(ordersScreen).toBeInTheDocument();
  });
});
