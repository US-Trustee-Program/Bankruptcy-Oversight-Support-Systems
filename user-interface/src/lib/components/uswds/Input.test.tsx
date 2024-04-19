import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InputRef } from '@/lib/type-declarations/input-fields';
import Input from './Input';

describe('Tests for USWDS Input component.', () => {
  const ref = React.createRef<InputRef>();
  const youChangedMe = vi.fn();

  beforeEach(() => {
    render(
      <div>
        <Input ref={ref} id="input-1" inputmode="numeric" value="1" onChange={youChangedMe}></Input>
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

  test('Should call props.onChange when a change is made to input by keypress, but not by ref.', async () => {
    const inputEl = screen.getByTestId('input-1');

    ref.current?.setValue('2');
    await waitFor(() => {
      expect(inputEl).toHaveValue('2');
    });
    expect(youChangedMe).not.toHaveBeenCalled();

    fireEvent.change(inputEl, { target: { value: '5' } });
    await waitFor(() => {
      expect(inputEl).toHaveValue('5');
    });
    expect(youChangedMe).toHaveBeenCalled();
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
    test('should have a default classes if not className provided', () => {
      render(
        <div>
          <Input id="input-1"></Input>
        </div>,
      );
      const inputEl = screen.getByTestId('input-1');
      expect(inputEl).toHaveClass('usa-input');
      expect(inputEl).toHaveClass('usa-tooltip');
    });
  });
});
