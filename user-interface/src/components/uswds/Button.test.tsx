import { render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import Button, { UswdsButtonState, UswdsButtonStyle } from './Button';

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
});
