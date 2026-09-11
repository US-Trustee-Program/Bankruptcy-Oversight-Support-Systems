import { render, screen } from '@testing-library/react';
import { AccessibleFieldValue } from './AccessibleFieldValue';

describe('AccessibleFieldValue', () => {
  test('renders a visually-hidden label ahead of the value', () => {
    render(<AccessibleFieldValue label="Phone">555-1234</AccessibleFieldValue>);

    const hiddenLabel = screen.getByText('Phone:');
    expect(hiddenLabel).toHaveClass('usa-sr-only');
    expect(screen.getByText('555-1234')).toBeInTheDocument();
  });

  test('applies the provided className to the wrapping element', () => {
    render(
      <AccessibleFieldValue label="Email" className="trustee-field">
        test@example.com
      </AccessibleFieldValue>,
    );

    expect(screen.getByText('test@example.com').closest('div')).toHaveClass('trustee-field');
  });
});
