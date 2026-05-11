import { render, screen, act } from '@testing-library/react';
import { useRef } from 'react';
import GlobalAlert, { GlobalAlertRef } from './GlobalAlert';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { BrowserRouter } from 'react-router-dom';

describe('GlobalAlert', () => {
  const TestComponent = () => {
    const alertRef = useRef<GlobalAlertRef>(null);
    return (
      <div>
        <GlobalAlert ref={alertRef} type={UswdsAlertStyle.Info} message="Initial message" />
        <button onClick={() => alertRef.current?.error('Test error')}>Show Error</button>
        <button onClick={() => alertRef.current?.info('Test info')}>Show Info</button>
        <button onClick={() => alertRef.current?.success('Test success')}>Show Success</button>
        <button onClick={() => alertRef.current?.warning('Test warning')}>Show Warning</button>
      </div>
    );
  };

  test.each([
    ['error', 'Show Error', 'Test error', 'usa-alert--error'],
    ['info', 'Show Info', 'Test info', 'usa-alert--info'],
    ['success', 'Show Success', 'Test success', 'usa-alert--success'],
    ['warning', 'Show Warning', 'Test warning', 'usa-alert--warning'],
  ])('should show %s alert', async (_type, buttonText, expectedText, expectedClass) => {
    render(
      <BrowserRouter>
        <TestComponent />
      </BrowserRouter>,
    );
    const button = screen.getByText(buttonText);
    act(() => button.click());

    const alert = await screen.findByTestId('alert');
    expect(alert).toHaveTextContent(expectedText);
    expect(alert).toHaveClass(expectedClass);
  });

  test('should show custom alert with show method', async () => {
    const TestCustomComponent = () => {
      const alertRef = useRef<GlobalAlertRef>(null);
      return (
        <div>
          <GlobalAlert ref={alertRef} type={UswdsAlertStyle.Info} message="Initial message" />
          <button
            onClick={() =>
              alertRef.current?.show({
                message: 'Custom alert',
                type: UswdsAlertStyle.Info,
                timeout: 5,
              })
            }
          >
            Show Custom
          </button>
        </div>
      );
    };

    render(
      <BrowserRouter>
        <TestCustomComponent />
      </BrowserRouter>,
    );
    const customButton = screen.getByText('Show Custom');
    act(() => customButton.click());

    const alert = await screen.findByTestId('alert');
    expect(alert).toHaveTextContent('Custom alert');
    expect(alert).toHaveClass('usa-alert--info');
  });

  test('should handle timeout correctly', async () => {
    vi.useFakeTimers();
    render(
      <BrowserRouter>
        <TestComponent />
      </BrowserRouter>,
    );
    const errorButton = screen.getByText('Show Error');
    act(() => errorButton.click());

    const alertContainer = screen.getByTestId('alert-container');
    expect(alertContainer).toHaveClass('visible');

    // Run all pending timers
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(alertContainer).not.toHaveClass('visible');
    vi.useRealTimers();
  });
});
