import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import Checkbox, { CheckboxProps, CheckboxRef, CheckboxState } from './Checkbox';

describe('Test Checkbox component', async () => {
  function renderWithProps(props?: Partial<CheckboxProps>, ref?: React.Ref<CheckboxRef>) {
    const defaultProps: CheckboxProps = {
      id: 'checkbox123',
      value: 'checkbox toggle',
      checked: false,
      onChange: () => {},
      onFocus: () => {},
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

    await waitFor(() => {
      cbRef.current?.setChecked(true);
    });
    expect(checkbox).toBeChecked();

    await waitFor(() => {
      cbRef.current?.setChecked(false);
    });
    expect(checkbox).not.toBeChecked();
  });

  test('Should check box when calling ref.setChecked(CheckboxState.CHECKED), uncheck when calling ref.setChecked(CheckboxState.UNCHECKED), and set to indeterminate state when calling ref.setChecked(CheckboxState.INDETERMINATE)', async () => {
    const cbRef = React.createRef<CheckboxRef>();
    renderWithProps({}, cbRef);

    const checkbox = document.querySelector('input[type="checkbox"]');
    expect(checkbox).not.toBeChecked();
    expect(checkbox).not.toHaveAttribute('data-indeterminate', 'true');

    await waitFor(() => {
      cbRef.current?.setChecked(CheckboxState.CHECKED);
    });
    expect(checkbox).toBeChecked();
    expect(checkbox).not.toHaveAttribute('data-indeterminate', 'true');

    await waitFor(() => {
      cbRef.current?.setChecked(CheckboxState.UNCHECKED);
    });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).not.toHaveAttribute('data-indeterminate', 'true');

    await waitFor(() => {
      cbRef.current?.setChecked(CheckboxState.INDETERMINATE);
    });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveAttribute('data-indeterminate', 'true');
  });

  test('should add a class if className is provided', () => {
    const addedClassName = 'test-class';
    renderWithProps({ id: 'test', className: addedClassName });
    screen.debug();
    const checkbox = screen.getByTestId('checkbox-test');
    expect(checkbox.parentNode).toHaveClass(addedClassName);
  });

  test('should have the default class', () => {
    renderWithProps({ id: 'test' });
    const checkbox = screen.getByTestId('checkbox-test');
    const parent = checkbox.parentNode;
    expect(parent).toHaveClass('usa-form-group');
    expect(parent).toHaveClass('usa-checkbox');
  });
});
