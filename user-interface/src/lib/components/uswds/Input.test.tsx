import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InputRef } from '@/lib/type-declarations/input-fields';
import Input from './Input';
import userEvent from '@testing-library/user-event';

describe('Tests for USWDS Input component.', () => {
  const ref = React.createRef<InputRef>();
  const youChangedMe = vi.fn();

  beforeEach(() => {
    render(
      <div>
        <Input ref={ref} id="input-1" inputMode="numeric" value="1" onChange={youChangedMe}></Input>
      </div>,
    );
  });

  test('Should change value when ref.setValue() is called and set value back to original when ref.resetValue() is called.', async () => {
    const inputEl = screen.getByTestId('input-1');
    expect(inputEl).toHaveValue('1');

    ref.current?.setValue('2');
    await waitFor(() => {
      expect(inputEl).toHaveValue('2');
    });

    ref.current?.resetValue();
    await waitFor(() => {
      expect(inputEl).toHaveValue('1');
    });
  });

  test('Should clear value when ref.clearValue is called.', async () => {
    const inputEl = screen.getByTestId('input-1');
    ref.current?.setValue('2');

    await waitFor(() => {
      expect(inputEl).toHaveValue('2');
    });

    ref.current?.clearValue();
    await waitFor(() => {
      expect(inputEl).toHaveValue('');
    });
  });

  test('Should call props.onChange when a change is made to input by keypress or by ref.', async () => {
    const inputEl = screen.getByTestId('input-1');

    ref.current?.setValue('2');
    await waitFor(() => {
      expect(inputEl).toHaveValue('2');
    });
    expect(youChangedMe).toHaveBeenCalled();

    fireEvent.change(inputEl, { target: { value: '5' } });
    await waitFor(() => {
      expect(inputEl).toHaveValue('5');
    });
    expect(youChangedMe).toHaveBeenCalled();
  });
});

describe('Test error handling', () => {
  test('Should have error attributes set properly when an error occurs', async () => {
    const errorMessageId = 'input-1-input__error-message';
    const { rerender } = render(
      <div>
        <Input id="input-1" errorMessage={undefined}></Input>
      </div>,
    );

    const inputEl = screen.getByTestId('input-1');
    expect(inputEl).not.toHaveAttribute('aria-invalid');
    expect(inputEl).not.toHaveAttribute('aria-errorMessage');

    rerender(
      <div>
        <Input id="input-1" errorMessage="TEST MESSAGE"></Input>
      </div>,
    );

    await waitFor(() => {
      expect(inputEl).toHaveAttribute('aria-invalid', 'true');
      expect(inputEl).toHaveAttribute('aria-errorMessage', errorMessageId);
    });

    const errorMessageDiv = document.getElementById(errorMessageId);
    expect(errorMessageDiv).toHaveTextContent('TEST MESSAGE');
  });
});

describe('Tests for USWDS Input component when no value is initially set.', () => {
  const ref = React.createRef<InputRef>();

  test('Should change value to empty string when props.input is not set and ref.setValue() is called.', async () => {
    render(
      <div>
        <Input ref={ref} id="input-1"></Input>
      </div>,
    );

    const inputEl = screen.getByTestId('input-1');
    expect(inputEl).toHaveValue('');

    ref.current?.setValue('12345');
    await waitFor(() => {
      expect(inputEl).toHaveValue('12345');
    });

    ref.current?.resetValue();
    await waitFor(() => {
      expect(inputEl).toHaveValue('');
    });
  });

  describe('Input styling', () => {
    test('should set the className if provided', () => {
      const expectedClassName = 'classNameTest';
      render(
        <div>
          <Input id="input-1" className={expectedClassName}></Input>
        </div>,
      );
      const inputEl = screen.getByTestId('input-1');
      expect(inputEl).toHaveClass(expectedClassName);
    });

    test('should have data-position="left" if position is set to "left"', () => {
      render(
        <div>
          <Input id="input-1" position="left"></Input>
        </div>,
      );
      const inputEl = screen.getByTestId('input-1');
      expect(inputEl).toHaveAttribute('data-position', 'left');
    });

    test('should have a default classes and data-position="right" if neither className nor position are provided', () => {
      render(
        <div>
          <Input id="input-1"></Input>
        </div>,
      );
      const inputEl = screen.getByTestId('input-1');
      expect(inputEl).toHaveClass('usa-input');
      expect(inputEl).toHaveClass('usa-tooltip');
      expect(inputEl).toHaveAttribute('data-position', 'right');
    });

    test('should not have clear button if input is empty and should appear once text is entered', async () => {
      render(
        <div>
          <Input includeClearButton={true} id="input-1"></Input>
        </div>,
      );
      let clearButton;
      const inputEl = screen.getByTestId('input-1');
      expect(inputEl).toBeInTheDocument();

      clearButton = screen.queryByTestId('button-clear-input-1');
      expect(clearButton).not.toBeInTheDocument();

      await userEvent.type(inputEl, 'test input');

      await waitFor(() => {
        clearButton = screen.queryByTestId('button-clear-input-1');
        expect(clearButton).toBeInTheDocument();
      });
    });
  });
});
