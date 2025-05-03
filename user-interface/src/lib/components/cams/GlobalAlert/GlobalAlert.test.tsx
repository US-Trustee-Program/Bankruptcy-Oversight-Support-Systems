import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { BrowserRouter } from 'react-router-dom';

import GlobalAlert, { GlobalAlertRef } from './GlobalAlert';

describe('GlobalAlert', () => {
  const TestComponent = () => {
    const alertRef = useRef<GlobalAlertRef>(null);
    return (
      <div>
        <GlobalAlert message="Initial message" ref={alertRef} type={UswdsAlertStyle.Info} />
        <button onClick={() => alertRef.current?.error('Test error')}>Show Error</button>
        <button onClick={() => alertRef.current?.info('Test info')}>Show Info</button>
        <button onClick={() => alertRef.current?.success('Test success')}>Show Success</button>
        <button onClick={() => alertRef.current?.warning('Test warning')}>Show Warning</button>
      </div>
    );
  };

  test('should show error alert', async () => {
    render(
      <BrowserRouter>
        <TestComponent />
      </BrowserRouter>,
    );
    const errorButton = screen.getByText('Show Error');
    act(() => {
      errorButton.click();
    });

    const alert = await screen.findByTestId('alert');
    expect(alert).toHaveTextContent('Test error');
    expect(alert).toHaveClass('usa-alert--error');
  });

  test('should show info alert', async () => {
    render(
      <BrowserRouter>
        <TestComponent />
      </BrowserRouter>,
    );
    const infoButton = screen.getByText('Show Info');
    act(() => {
      infoButton.click();
    });

    const alert = await screen.findByTestId('alert');
    expect(alert).toHaveTextContent('Test info');
    expect(alert).toHaveClass('usa-alert--info');
  });

  test('should show success alert', async () => {
    render(
      <BrowserRouter>
        <TestComponent />
      </BrowserRouter>,
    );
    const successButton = screen.getByText('Show Success');
    act(() => {
      successButton.click();
    });

    const alert = await screen.findByTestId('alert');
    expect(alert).toHaveTextContent('Test success');
    expect(alert).toHaveClass('usa-alert--success');
  });

  test('should show warning alert', async () => {
    render(
      <BrowserRouter>
        <TestComponent />
      </BrowserRouter>,
    );
    const warningButton = screen.getByText('Show Warning');
    act(() => {
      warningButton.click();
    });

    const alert = await screen.findByTestId('alert');
    expect(alert).toHaveTextContent('Test warning');
    expect(alert).toHaveClass('usa-alert--warning');
  });

  test('should show custom alert with show method', async () => {
    const TestCustomComponent = () => {
      const alertRef = useRef<GlobalAlertRef>(null);
      return (
        <div>
          <GlobalAlert message="Initial message" ref={alertRef} type={UswdsAlertStyle.Info} />
          <button
            onClick={() =>
              alertRef.current?.show({
                message: 'Custom alert',
                timeout: 5,
                type: UswdsAlertStyle.Info,
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
    act(() => {
      customButton.click();
    });

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
    act(() => {
      errorButton.click();
    });

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
