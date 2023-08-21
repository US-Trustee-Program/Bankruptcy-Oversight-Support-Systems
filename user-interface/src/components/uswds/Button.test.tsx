import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import Button, { ButtonRef, UswdsButtonState, UswdsButtonStyle } from './Button';

describe('Test button component', () => {
  test('Should add the proper css class when uswdsButtonStyle is passed in', () => {
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Button uswdsStyle={UswdsButtonStyle.Cool}>Button text</Button>
        </BrowserRouter>
      </React.StrictMode>,
    );

    const button = screen.getByTestId('button');
    expect(button).toHaveClass('usa-button--accent-cool');
  });

  test('Should add the proper css class when uswdsButtonState is passed in', () => {
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Button buttonState={UswdsButtonState.Focus}>Button text</Button>
        </BrowserRouter>
      </React.StrictMode>,
    );

    const button = screen.getByTestId('button');
    expect(button).toHaveClass('usa-focus');
  });

  test('Should disable button when disable attribute is set on the Button', () => {
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Button disabled={true}>Button text</Button>
        </BrowserRouter>
      </React.StrictMode>,
    );

    const button = screen.getByTestId('button');
    expect(button).toHaveAttribute('disabled');
    expect(button).toHaveAttribute('aria-disabled');
  });

  test('Should disable button when the disable method is called on the Button ref', () => {
    const buttonRef = React.createRef<ButtonRef>();
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Button ref={buttonRef}>Button text</Button>
        </BrowserRouter>
      </React.StrictMode>,
    );

    const button = screen.getByTestId('button');

    expect(button).not.toHaveAttribute('disabled');

    act(() => {
      buttonRef.current?.disableButton(true);
    });

    expect(button).toHaveAttribute('disabled');

    act(() => {
      buttonRef.current?.disableButton(false);
    });

    expect(button).not.toHaveAttribute('disabled');
  });
});
