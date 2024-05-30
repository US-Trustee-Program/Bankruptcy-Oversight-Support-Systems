import React from 'react';
import CamsSelectMulti, { CamsSelectMultiProps } from './CamsSelectMulti';
import { SelectMultiRef } from '../type-declarations/input-fields';
import { render, screen, waitFor } from '@testing-library/react';

const selectId = 'select-1';

describe('Tests for humble CamsSelectMulti component', () => {
  const ref = React.createRef<SelectMultiRef>();
  const youChangedMe = vi.fn();

  const option1 = {
    value: '1',
    label: 'Option 1',
  };
  const option2 = {
    value: '2',
    label: 'Option 2',
  };
  const option3 = {
    value: '3',
    label: 'Option 3',
  };

  function renderWithProps(props?: Partial<CamsSelectMultiProps>) {
    const defaultProps: CamsSelectMultiProps = {
      id: selectId,
      label: 'Searchable Select',
      className: '',
      onChange: youChangedMe,
      value: [option2],
      options: [option1, option2, option3],
      required: false,
      isSearchable: true,
      closeMenuOnSelect: false,
    };

    const renderProps = { ...defaultProps, ...props };
    render(<CamsSelectMulti {...renderProps} ref={ref} />);
  }

  beforeEach(() => {});

  test('Should set value when ref.setValue() is called and reset to original value when ref.resetValue() is called.', async () => {
    renderWithProps();

    const initialValue = screen.getByText(option2.label);
    expect(initialValue).toBeInTheDocument();

    ref.current?.setValue([option1]);
    await waitFor(() => {
      const value1 = screen.getByText(option1.label);
      expect(value1).toBeInTheDocument();
    });

    ref.current?.resetValue();
    await waitFor(() => {
      const value1 = screen.queryByText(option1.label);
      expect(value1).not.toBeInTheDocument();
    });
  });

  test('Should set value when ref.clearValue() is called.', async () => {
    renderWithProps();
    const initialValue = screen.getByText(option2.label);
    expect(initialValue).toBeInTheDocument();

    ref.current?.setValue([option1]);
    await waitFor(() => {
      const value1 = screen.getByText(option1.label);
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

  test('should return initialValue when calling ref.getValue', () => {
    const option = [option2];
    renderWithProps();
    expect(ref.current?.getValue()).toEqual(expect.arrayContaining(option));
  });
  test('should set disabled attribute to true on input when isDisabled prop is set', () => {
    renderWithProps();
    ref.current?.disable(true);

    const inputEl = document.querySelector(`#${selectId} input`);
    expect(inputEl).toHaveAttribute('disabled', 'true');
  });
});
