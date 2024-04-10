import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import Checkbox, { CheckboxProps, CheckboxRef, CheckBoxState } from './Checkbox';

describe('Test Checkbox component', async () => {
  function renderWithProps(props?: Partial<CheckboxProps>, ref?: React.Ref<CheckboxRef>) {
    const defaultProps: CheckboxProps = {
      id: 'checkbox123',
      value: 'checkbox toggle',
      checked: false,
      onChange: () => {},
      onFocus: () => {},
      className: '',
    };

    const renderProps = { ...defaultProps, ...props };
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Checkbox {...renderProps} ref={ref} />
        </BrowserRouter>
      </React.StrictMode>,
    );
  }

  test('Should call onChange handler when check box is clicked', async () => {
    const checkboxOnClick = vi.fn();
    renderWithProps({ onChange: checkboxOnClick });

    const checkbox = screen.getByTestId('checkbox-checkbox123');
    fireEvent.click(checkbox);
    expect(checkboxOnClick).toHaveBeenCalled();
  });

  test('Should call onFocus handler when check box is focused', async () => {
    const checkboxOnFocus = vi.fn();
    renderWithProps({ onFocus: checkboxOnFocus });

    const checkbox = screen.getByTestId('checkbox-checkbox123');
    fireEvent.focus(checkbox);
    expect(checkboxOnFocus).toHaveBeenCalled();
  });

  test('Should return correct label from ref.getLabel()', async () => {
    const cbRef = React.createRef<CheckboxRef>();
    renderWithProps({ label: 'test label' }, cbRef);
    expect(cbRef.current?.getLabel()).toEqual('test label');
  });

  test('Should return empty string if ref.getLabel() is called and no label property was provided', async () => {
    const cbRef = React.createRef<CheckboxRef>();
    renderWithProps({}, cbRef);
    expect(cbRef.current?.getLabel()).toEqual('');
  });

  test('Should check box when calling ref.setChecked(true) and uncheck when calling ref.setChecked(false)', async () => {
    const cbRef = React.createRef<CheckboxRef>();
    renderWithProps({}, cbRef);

    const checkbox = document.querySelector('input[type="checkbox"]');
    expect(checkbox).not.toBeChecked();

    await vi.waitFor(() => {
      cbRef.current?.setChecked(true);
    });
    expect(checkbox).toBeChecked();

    await vi.waitFor(() => {
      cbRef.current?.setChecked(false);
    });
    expect(checkbox).not.toBeChecked();
  });

  test('Should check box when calling ref.setChecked(CheckBoxState.CHECKED), uncheck when calling ref.setChecked(CheckBoxState.UNCHECKED), and set to indeterminate state when calling ref.setChecked(CheckBoxState.INDETERMINATE)', async () => {
    const cbRef = React.createRef<CheckboxRef>();
    renderWithProps({}, cbRef);

    const checkbox = document.querySelector('input[type="checkbox"]');
    expect(checkbox).not.toBeChecked();
    expect(checkbox).not.toHaveAttribute('data-indeterminate', 'true');

    await vi.waitFor(() => {
      cbRef.current?.setChecked(CheckBoxState.CHECKED);
    });
    expect(checkbox).toBeChecked();
    expect(checkbox).not.toHaveAttribute('data-indeterminate', 'true');

    await vi.waitFor(() => {
      cbRef.current?.setChecked(CheckBoxState.UNCHECKED);
    });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).not.toHaveAttribute('data-indeterminate', 'true');

    await vi.waitFor(() => {
      cbRef.current?.setChecked(CheckBoxState.INDETERMINATE);
    });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveAttribute('data-indeterminate', 'true');
  });
});
