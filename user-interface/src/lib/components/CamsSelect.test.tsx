import React from 'react';
import CamsSelect, { CamsSelectProps } from './CamsSelect';
import { InputRef } from '../type-declarations/input-fields';
import { render, screen, waitFor } from '@testing-library/react';

const selectId = 'select-1';

describe('Tests for humble CamsSelect component', () => {
  const ref = React.createRef<InputRef>();
  const youChangedMe = vi.fn();

  function renderWithProps(props?: Partial<CamsSelectProps>) {
    const defaultProps: CamsSelectProps = {
      id: selectId,
      label: 'Searchable Select',
      className: '',
      onChange: youChangedMe,
      value: '2',
      options: [
        {
          value: '0',
          label: 'Option 0',
        },
        {
          value: '1',
          label: 'Option 1',
        },
        {
          value: '2',
          label: 'Option 2',
        },
      ],
      required: false,
      isSearchable: true,
      isMulti: false,
      closeMenuOnSelect: false,
    };

    const renderProps = { ...defaultProps, ...props };
    render(
      <div>
        <CamsSelect {...renderProps} ref={ref} />
      </div>,
    );
  }

  beforeEach(() => {});

  test('Should set value when ref.setValue() is called and reset to original value when ref.resetValue() is called.', async () => {
    renderWithProps();

    const initialValue = screen.getByText('Option 2');
    expect(initialValue).toBeInTheDocument();

    ref.current?.setValue('1');
    await waitFor(() => {
      const value1 = screen.getByText('Option 1');
      expect(value1).toBeInTheDocument();
    });

    ref.current?.resetValue();
    await waitFor(() => {
      const value1 = screen.getByText('Option 2');
      expect(value1).toBeInTheDocument();
    });
  });

  test('Should set value when ref.clearValue() is called.', async () => {
    renderWithProps();

    const initialValue = screen.getByText('Option 2');
    expect(initialValue).toBeInTheDocument();

    ref.current?.setValue('1');
    await waitFor(() => {
      const value1 = screen.getByText('Option 1');
      expect(value1).toBeInTheDocument();
    });

    ref.current?.clearValue();
    await waitFor(() => {
      const value1 = screen.getByText('Select...');
      expect(value1).toBeInTheDocument();
    });
  });

  test('should set required attribute on input when required prop is set to true', () => {
    renderWithProps({ required: true });
    const inputEl = document.querySelector(`#${selectId} input`);
    expect(inputEl).toHaveAttribute('required', 'true');
  });

  test('should throw Error Not Implemented when calling ref.getValue', () => {
    renderWithProps();

    expect(() => {
      ref.current?.getValue();
    }).toThrow('Not implemented');
  });

  test('should set disabled attribute to true on input when isDisabled prop is set', () => {
    renderWithProps();
    ref.current?.disable(true);

    const inputEl = document.querySelector(`#${selectId} input`);
    expect(inputEl).toHaveAttribute('disabled', 'true');
  });
});
