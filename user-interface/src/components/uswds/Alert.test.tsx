import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import Alert, { AlertRefType, UswdsAlertStyle } from './Alert';
import { render, screen } from '@testing-library/react';

const sleep = (milliseconds: number) =>
  new Promise((callback) => setTimeout(callback, milliseconds));

describe('Test Alert component', () => {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
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
    expect(alert).not.toHaveClass('usa-alert__visible');
    expect(alert).not.toHaveClass('usa-alert__hidden');
    expect(alert).toHaveClass('usa-alert__unset');

    alertRef.current?.show();
    await sleep(100);
    expect(alert).toHaveClass('usa-alert__visible');
    expect(alert).not.toHaveClass('usa-alert__hidden');
    expect(alert).not.toHaveClass('usa-alert__unset');

    await sleep(3000);
    expect(alert).toHaveClass('usa-alert__visible');
    expect(alert).not.toHaveClass('usa-alert__hidden');
    expect(alert).not.toHaveClass('usa-alert__unset');

    await sleep(1000);
    expect(alert).not.toHaveClass('usa-alert__visible');
    expect(alert).toHaveClass('usa-alert__hidden');
    expect(alert).not.toHaveClass('usa-alert__unset');
  }, 6000);

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

    const alert = screen.getByTestId('alert');
    expect(alert).not.toHaveClass('usa-alert__visible');
    expect(alert).not.toHaveClass('usa-alert__hidden');
    expect(alert).toHaveClass('usa-alert__unset');

    alertRef.current?.show();
    await sleep(100);
    expect(alert).toHaveClass('usa-alert__visible');
    expect(alert).not.toHaveClass('usa-alert__hidden');
    expect(alert).not.toHaveClass('usa-alert__unset');

    await sleep(5000);
    expect(alert).toHaveClass('usa-alert__visible');
    expect(alert).not.toHaveClass('usa-alert__hidden');
    expect(alert).not.toHaveClass('usa-alert__unset');

    alertRef.current?.hide();
    await sleep(100);
    expect(alert).not.toHaveClass('usa-alert__visible');
    expect(alert).toHaveClass('usa-alert__hidden');
    expect(alert).not.toHaveClass('usa-alert__unset');
  }, 8000);
});
