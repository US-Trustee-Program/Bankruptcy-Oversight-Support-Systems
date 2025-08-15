import { render, screen } from '@testing-library/react';
import TrusteeDetailScreen from './TrusteeDetailScreen';

test('should render placeholder trustee name', () => {
  render(<TrusteeDetailScreen />);

  const heading = screen.getByRole('heading', { level: 1 });
  expect(heading).toHaveTextContent('Tina Trustee');
});

test('should render with correct test id', () => {
  render(<TrusteeDetailScreen />);

  const container = screen.getByTestId('trustee-detail-screen');
  expect(container).toBeInTheDocument();
});
