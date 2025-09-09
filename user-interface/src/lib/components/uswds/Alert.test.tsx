import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import Alert, { AlertRefType, UswdsAlertStyle } from './Alert';
import { act, render, screen, waitFor } from '@testing-library/react';

const sleep = (milliseconds: number) =>
  new Promise((callback) => setTimeout(callback, milliseconds));

describe('Test Alert component', () => {
  test('should be visible for provided timeout', async () => {
    const alertRef = React.createRef<AlertRefType>();
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Alert
            message="Test alert message"
            type={UswdsAlertStyle.Success}
            role="status"
            slim={true}
            ref={alertRef}
            timeout={4}
          ></Alert>
        </BrowserRouter>
      </React.StrictMode>,
    );

    const alert = screen.getByTestId('alert');
    await waitFor(() => {
      expect(alert).not.toHaveClass('usa-alert__visible');
    });
    expect(alert).not.toHaveClass('usa-alert__hidden');
    expect(alert).toHaveClass('usa-alert__unset');

    act(() => alertRef.current?.show());
    await waitFor(() => {
      expect(alert).toHaveClass('usa-alert__visible');
    });
    expect(alert).not.toHaveClass('usa-alert__hidden');
    expect(alert).not.toHaveClass('usa-alert__unset');

    await sleep(3000);
    await waitFor(() => {
      expect(alert).toHaveClass('usa-alert__visible');
    });
    expect(alert).not.toHaveClass('usa-alert__hidden');
    expect(alert).not.toHaveClass('usa-alert__unset');

    await waitFor(
      () => {
        expect(alert).not.toHaveClass('usa-alert__visible');
      },
      { timeout: 2000 },
    );
    expect(alert).toHaveClass('usa-alert__hidden');
    expect(alert).not.toHaveClass('usa-alert__unset');
  }, 8000);

  test('should be visible until hide is called if no timeout is provided', async () => {
    const alertRef = React.createRef<AlertRefType>();
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Alert
            message="Test alert message"
            type={UswdsAlertStyle.Success}
            role="status"
            slim={true}
            ref={alertRef}
          ></Alert>
        </BrowserRouter>
      </React.StrictMode>,
    );

    const alertContainer = screen.getByTestId('alert-container');
    await waitFor(() => {
      expect(alertContainer).not.toHaveClass('inline-alert');
    });

    const alert = screen.getByTestId('alert');
    expect(alert).not.toHaveClass('usa-alert__visible');
    expect(alert).not.toHaveClass('usa-alert__hidden');
    expect(alert).toHaveClass('usa-alert__unset');

    act(() => alertRef.current?.show());
    await waitFor(() => {
      expect(alertContainer).not.toHaveClass('inline-alert');
    });
    expect(alert).toHaveClass('usa-alert__visible');
    expect(alert).not.toHaveClass('usa-alert__hidden');
    expect(alert).not.toHaveClass('usa-alert__unset');

    await waitFor(() => {
      expect(alert).toHaveClass('usa-alert__visible');
    });
    expect(alert).not.toHaveClass('usa-alert__hidden');
    expect(alert).not.toHaveClass('usa-alert__unset');

    act(() => alertRef.current?.hide());
    await waitFor(() => {
      expect(alert).not.toHaveClass('usa-alert__visible');
    });
    expect(alert).toHaveClass('usa-alert__hidden');
    expect(alert).not.toHaveClass('usa-alert__unset');
  }, 8000);

  test('should have inline-alert class if declared as inline', async () => {
    const alertRef = React.createRef<AlertRefType>();
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Alert
            message="Test alert message"
            type={UswdsAlertStyle.Info}
            role="status"
            slim={true}
            ref={alertRef}
            inline={true}
          ></Alert>
        </BrowserRouter>
      </React.StrictMode>,
    );

    const alertContainer = screen.getByTestId('alert-container');
    await waitFor(() => {
      expect(alertContainer).toHaveClass('inline-alert');
    });
  });

  test('should have info class', async () => {
    const alertRef = React.createRef<AlertRefType>();
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Alert
            message="Test alert message"
            type={UswdsAlertStyle.Info}
            role="status"
            slim={true}
            ref={alertRef}
          ></Alert>
        </BrowserRouter>
      </React.StrictMode>,
    );

    const alert = screen.getByTestId('alert');
    await waitFor(() => {
      expect(alert).toHaveClass('usa-alert--info');
    });
  });

  test('should have warning class', async () => {
    const alertRef = React.createRef<AlertRefType>();
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Alert
            message="Test alert message"
            type={UswdsAlertStyle.Warning}
            role="status"
            slim={true}
            ref={alertRef}
          ></Alert>
        </BrowserRouter>
      </React.StrictMode>,
    );

    const alert = screen.getByTestId('alert');
    await waitFor(() => {
      expect(alert).toHaveClass('usa-alert--warning');
    });
  });

  test('should have error class', async () => {
    const alertRef = React.createRef<AlertRefType>();
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Alert
            message="Test alert message"
            type={UswdsAlertStyle.Error}
            role="status"
            slim={true}
            ref={alertRef}
          ></Alert>
        </BrowserRouter>
      </React.StrictMode>,
    );

    const alert = screen.getByTestId('alert');
    await waitFor(() => {
      expect(alert).toHaveClass('usa-alert--error');
    });
  });

  test('should have success class', async () => {
    const alertRef = React.createRef<AlertRefType>();
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Alert
            message="Test alert message"
            type={UswdsAlertStyle.Success}
            role="status"
            slim={true}
            ref={alertRef}
          ></Alert>
        </BrowserRouter>
      </React.StrictMode>,
    );

    const alert = screen.getByTestId('alert');
    await waitFor(() => {
      expect(alert).toHaveClass('usa-alert--success');
    });
  });

  test('should have slim class', async () => {
    const alertRef = React.createRef<AlertRefType>();
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Alert
            message="Test alert message"
            type={UswdsAlertStyle.Success}
            role="status"
            slim={true}
            ref={alertRef}
          ></Alert>
        </BrowserRouter>
      </React.StrictMode>,
    );

    const alert = screen.getByTestId('alert');
    await waitFor(() => {
      expect(alert).toHaveClass('usa-alert--slim');
    });
  });

  test('should not have slim class', async () => {
    const alertRef = React.createRef<AlertRefType>();
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Alert
            message="Test alert message"
            type={UswdsAlertStyle.Success}
            role="status"
            ref={alertRef}
          ></Alert>
        </BrowserRouter>
      </React.StrictMode>,
    );

    const alert = screen.getByTestId('alert');
    await waitFor(() => {
      expect(alert).not.toHaveClass('usa-alert--slim');
    });
  });

  test('should contain the message', async () => {
    const alertRef = React.createRef<AlertRefType>();
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Alert
            message="Test alert message"
            type={UswdsAlertStyle.Success}
            role="status"
            ref={alertRef}
          ></Alert>
        </BrowserRouter>
      </React.StrictMode>,
    );

    const alertMessage = screen.getByTestId('alert-message');
    await waitFor(() => {
      expect(alertMessage).toContainHTML('Test alert message');
    });
  });

  test('should put the status role in the html', async () => {
    const alertRef = React.createRef<AlertRefType>();
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Alert
            message="Test alert message"
            type={UswdsAlertStyle.Success}
            role="status"
            ref={alertRef}
          ></Alert>
        </BrowserRouter>
      </React.StrictMode>,
    );

    const alert = screen.getByTestId('alert');
    await waitFor(() => {
      expect(alert).toHaveAttribute('role', 'status');
    });
  });

  test('should put the alert role in the html', async () => {
    const alertRef = React.createRef<AlertRefType>();
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Alert
            message="Test alert message"
            type={UswdsAlertStyle.Success}
            role="alert"
            ref={alertRef}
          ></Alert>
        </BrowserRouter>
      </React.StrictMode>,
    );

    const alert = screen.getByTestId('alert');
    await waitFor(() => {
      expect(alert).toHaveAttribute('role', 'alert');
    });
  });
});
