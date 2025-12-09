import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import Button, { ButtonRef, UswdsButtonState, UswdsButtonStyle } from './Button';

describe('Test button component', () => {
  test('Should add the proper css class when uswdsButtonStyle is passed in', () => {
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Button id="test" uswdsStyle={UswdsButtonStyle.Cool}>
            Button text
          </Button>
        </BrowserRouter>
      </React.StrictMode>,
    );

    const button = screen.getByTestId('button-test');
    expect(button).toHaveClass('usa-button--accent-cool');
  });

  test('Should add the proper css class when uswdsButtonState is passed in', () => {
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Button id="test" buttonState={UswdsButtonState.Focus}>
            Button text
          </Button>
        </BrowserRouter>
      </React.StrictMode>,
    );

    const button = screen.getByTestId('button-test');
    expect(button).toHaveClass('usa-focus');
  });

  test('Should disable button when disable attribute is set on the Button', () => {
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Button id="test" disabled={true}>
            Button text
          </Button>
        </BrowserRouter>
      </React.StrictMode>,
    );

    const button = screen.getByTestId('button-test');
    expect(button).toHaveAttribute('disabled');
    expect(button).toHaveAttribute('aria-disabled');
  });

  test('Should disable button when the disable method is called on the Button ref', () => {
    const buttonRef = React.createRef<ButtonRef>();
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Button id="test" ref={buttonRef}>
            Button text
          </Button>
        </BrowserRouter>
      </React.StrictMode>,
    );

    const button = screen.getByTestId('button-test');

    expect(button).not.toHaveAttribute('disabled');

    act(() => buttonRef.current?.disableButton(true));
    expect(button).toHaveAttribute('disabled');

    act(() => buttonRef.current?.disableButton(false));
    expect(button).not.toHaveAttribute('disabled');
  });

  test('Should default to type="button" when no type prop is provided', () => {
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Button id="test">Button text</Button>
        </BrowserRouter>
      </React.StrictMode>,
    );

    const button = screen.getByTestId('button-test');
    expect(button).toHaveAttribute('type', 'button');
  });

  test('Should respect type="submit" when explicitly provided', () => {
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Button id="test" type="submit">
            Submit text
          </Button>
        </BrowserRouter>
      </React.StrictMode>,
    );

    const button = screen.getByTestId('button-test');
    expect(button).toHaveAttribute('type', 'submit');
  });
});
