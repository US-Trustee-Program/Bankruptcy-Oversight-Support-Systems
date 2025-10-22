import { render, screen } from '@testing-library/react';
import { useGlobalAlert } from './UseGlobalAlert';
import { GlobalAlertContext } from '@/App';
import { GlobalAlertRef } from '../components/cams/GlobalAlert/GlobalAlert';
import { createRef } from 'react';

function TestComponent() {
  const alert = useGlobalAlert();
  return (
    <div>
      <div data-testid="alert-status">{alert ? 'Alert Available' : 'Alert Not Available'}</div>
    </div>
  );
}

describe('useGlobalAlert', () => {
  test('should return null when context is empty', () => {
    const mockRef = createRef<null>();
    render(
      <GlobalAlertContext.Provider value={mockRef}>
        <TestComponent />
      </GlobalAlertContext.Provider>,
    );
    expect(screen.getByTestId('alert-status')).toHaveTextContent('Alert Not Available');
  });

  test('should return the alert ref when context has value', () => {
    // Create a mock ref with a non-null value
    const mockRef = createRef<GlobalAlertRef>();
    mockRef.current = {
      show: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
    };
    render(
      <GlobalAlertContext.Provider value={mockRef}>
        <TestComponent />
      </GlobalAlertContext.Provider>,
    );
    expect(screen.getByTestId('alert-status')).toHaveTextContent('Alert Available');
  });

  test('should work with default context value (React 19 compatibility)', () => {
    // Don't provide a context provider, so it uses the default value
    render(<TestComponent />);

    // With our React 19 fix, the default context value should have a null current property
    // which should result in "Alert Not Available"
    expect(screen.getByTestId('alert-status')).toHaveTextContent('Alert Not Available');
  });
});
