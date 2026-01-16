import React from 'react';
import { fireEvent, render, screen, act } from '@testing-library/react';
import { InputRef } from '@/lib/type-declarations/input-fields';
import Input from './Input';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';

describe('Tests for USWDS Input component.', () => {
  const ref = React.createRef<InputRef>();
  const youChangedMe = vi.fn();

  const renderWithoutProps = () => {
    render(
      <div>
        <Input ref={ref} id="input-1" inputMode="numeric" value="1" onChange={youChangedMe}></Input>
      </div>,
    );
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('Should change value when ref.setValue() is called and set value back to original when ref.resetValue() is called.', async () => {
    renderWithoutProps();
    const inputEl = screen.getByTestId('input-1');
    expect(inputEl).toHaveValue('1');

    act(() => ref.current?.setValue('2'));
    expect(inputEl).toHaveValue('2');

    act(() => ref.current?.resetValue());
    expect(inputEl).toHaveValue('1');
  });

  test('Should clear value when ref.clearValue is called.', async () => {
    renderWithoutProps();
    const inputEl = screen.getByTestId('input-1');

    act(() => ref.current?.setValue('2'));
    expect(inputEl).toHaveValue('2');

    act(() => ref.current?.clearValue());
    expect(inputEl).toHaveValue('');
  });

  // NOTE: This may be a code smell with the implicit API. We do NOT call the callback when setValue is called.
  test('Should not call props.onChange when setValue is called on the implicit API.', async () => {
    renderWithoutProps();
    const inputEl = screen.getByTestId('input-1');

    act(() => ref.current?.setValue('2'));
    expect(inputEl).toHaveValue('2');
    expect(youChangedMe).not.toHaveBeenCalled();

    fireEvent.change(inputEl, { target: { value: '5' } });

    expect(inputEl).toHaveValue('5');
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

    expect(inputEl).toHaveAttribute('aria-invalid', 'true');
    expect(inputEl).toHaveAttribute('aria-errorMessage', errorMessageId);

    const errorMessageDiv = document.getElementById(errorMessageId);
    expect(errorMessageDiv).toHaveTextContent('TEST MESSAGE');
  });
});

describe('Tests for USWDS Input component when no value is initially set.', () => {
  const ref = React.createRef<InputRef>();
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
  });

  test('Should change value to empty string when props.input is not set and ref.setValue() is called.', async () => {
    render(
      <div>
        <Input ref={ref} id="input-1"></Input>
      </div>,
    );

    const inputEl = screen.getByTestId('input-1');
    expect(inputEl).toHaveValue('');

    act(() => ref.current?.setValue('12345'));
    expect(inputEl).toHaveValue('12345');

    act(() => ref.current?.resetValue());
    expect(inputEl).toHaveValue('');
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

      clearButton = screen.queryByTestId('button-clear-input-1');
      expect(clearButton).toBeInTheDocument();
    });
  });
});

describe('Input additional coverage tests', () => {
  const ref = React.createRef<InputRef>();
  const mockOnChange = vi.fn();
  const mockOnFocus = vi.fn();
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
    vi.clearAllMocks();
  });

  test('should handle ariaDescription prop', () => {
    const description = 'This is a test description';
    render(<Input id="test-aria" ariaDescription={description} onChange={mockOnChange} />);

    const inputEl = screen.getByTestId('test-aria');
    const hintEl = document.querySelector('.usa-hint');

    expect(hintEl).toBeInTheDocument();
    expect(hintEl).toHaveTextContent(description);
    expect(inputEl).toHaveAttribute('aria-describedby', expect.stringContaining('input-hint-'));
  });

  test('should handle ariaDescription as array with multiple lines', () => {
    const descriptionArray = ['First line of description', 'Second line of description'];
    render(
      <Input id="test-aria-array" ariaDescription={descriptionArray} onChange={mockOnChange} />,
    );

    const inputEl = screen.getByTestId('test-aria-array');
    const hintEl = document.querySelector('.usa-hint');

    expect(hintEl).toBeInTheDocument();
    expect(hintEl).toHaveTextContent('First line of description');
    expect(hintEl).toHaveTextContent('Second line of description');

    const brElements = hintEl?.querySelectorAll('br');
    expect(brElements).toHaveLength(1);

    expect(inputEl).toHaveAttribute('aria-describedby', expect.stringContaining('input-hint-'));
  });

  test('should handle ariaDescription as array with single line', () => {
    const descriptionArray = ['Single line'];
    render(
      <Input id="test-aria-single" ariaDescription={descriptionArray} onChange={mockOnChange} />,
    );

    const hintEl = document.querySelector('.usa-hint');

    expect(hintEl).toBeInTheDocument();
    expect(hintEl).toHaveTextContent('Single line');

    const brElements = hintEl?.querySelectorAll('br');
    expect(brElements).toHaveLength(0);
  });

  test('should not render hint div for empty array', () => {
    const descriptionArray: string[] = [];
    render(
      <Input id="test-aria-empty" ariaDescription={descriptionArray} onChange={mockOnChange} />,
    );

    const inputEl = screen.getByTestId('test-aria-empty');
    const hintEl = document.querySelector('.usa-hint');

    expect(hintEl).not.toBeInTheDocument();
    expect(inputEl).not.toHaveAttribute('aria-describedby');
  });

  test('should handle ariaDescription as array with three lines', () => {
    const descriptionArray = ['Line one', 'Line two', 'Line three'];
    render(
      <Input id="test-aria-three" ariaDescription={descriptionArray} onChange={mockOnChange} />,
    );

    const hintEl = document.querySelector('.usa-hint');

    expect(hintEl).toBeInTheDocument();
    expect(hintEl).toHaveTextContent('Line one');
    expect(hintEl).toHaveTextContent('Line two');
    expect(hintEl).toHaveTextContent('Line three');

    const brElements = hintEl?.querySelectorAll('br');
    expect(brElements).toHaveLength(2);
  });

  test('calls onChange when user types and updates value', async () => {
    const handleChange = vi.fn();
    render(<Input id="change-id" label="Change" onChange={handleChange} />);

    const input = screen.getByLabelText('Change') as HTMLInputElement;
    await userEvent.type(input, 'abc');

    expect(handleChange).toHaveBeenCalled();
    expect(input.value).toBe('abc');
  });

  test('should handle focus method and onFocus prop', async () => {
    render(
      <Input
        ref={ref}
        id="test-focus"
        label="Test Focus"
        onFocus={mockOnFocus}
        onChange={mockOnChange}
      />,
    );

    const inputEl = screen.getByTestId('test-focus');

    // Test ref focus method
    act(() => ref.current?.focus());
    expect(inputEl).toHaveFocus();

    fireEvent.focus(inputEl);
    expect(mockOnFocus).toHaveBeenCalled();
  });

  test('should handle disable/enable via ref', async () => {
    render(<Input ref={ref} id="test-disable" onChange={mockOnChange} />);

    const inputEl = screen.getByTestId('test-disable');
    expect(inputEl).not.toBeDisabled();

    act(() => ref.current?.disable(true));
    expect(inputEl).toBeDisabled();

    act(() => ref.current?.disable(false));
    expect(inputEl).not.toBeDisabled();
  });

  test('should handle getValue method', () => {
    render(<Input ref={ref} id="test-get-value" value="initial value" onChange={mockOnChange} />);

    expect(ref.current?.getValue()).toBe('initial value');
  });

  test('should handle icon prop without clear button', () => {
    render(
      <Input id="test-icon" icon="search" includeClearButton={false} onChange={mockOnChange} />,
    );

    const iconContainer = document.querySelector('.usa-input-prefix');
    const icon = document.querySelector('.usa-icon');

    expect(iconContainer).toBeInTheDocument();
    expect(icon).toBeInTheDocument();
    expect(iconContainer).toHaveAttribute('aria-hidden', 'true');
  });

  test('should handle clear button functionality', async () => {
    render(
      <Input
        ref={ref}
        id="test-clear-functionality"
        value="some text"
        includeClearButton={true}
        onChange={mockOnChange}
      />,
    );

    const inputEl = screen.getByTestId('test-clear-functionality');
    const clearButton = screen.getByTestId('button-clear-test-clear-functionality');

    expect(clearButton).toBeInTheDocument();
    expect(inputEl).toHaveValue('some text');

    await userEvent.click(clearButton);

    expect(inputEl).toHaveValue('');
    expect(inputEl).toHaveFocus();
  });

  test('should not show clear button when disabled', () => {
    render(
      <Input
        id="test-clear-disabled"
        value="some text"
        includeClearButton={true}
        disabled={true}
        onChange={mockOnChange}
      />,
    );

    const clearButton = screen.queryByTestId('button-clear-test-clear-disabled');
    expect(clearButton).not.toBeInTheDocument();
  });

  test('should handle required prop properly', () => {
    render(<Input id="test-required" label="Test Label" required={true} onChange={mockOnChange} />);
    const input = document.getElementById('test-required') as HTMLInputElement;
    expect(input).toBeRequired();
  });

  test('should handle error input group styling', () => {
    render(<Input id="test-error-group" errorMessage="Test error" onChange={mockOnChange} />);

    const inputGroup = document.querySelector('.usa-input-group');
    expect(inputGroup).toHaveClass('usa-input-group--error');
  });

  test('should generate aria-describedby when no id provided', () => {
    render(<Input ariaDescription="Test description" onChange={mockOnChange} />);

    const hintElement = document.querySelector('.usa-hint');
    expect(hintElement).toBeInTheDocument();
    expect(hintElement?.id).toMatch(/input-hint-.+/);
  });

  test('should handle various input types and autoComplete', () => {
    render(
      <Input
        id="test-types"
        type="email"
        autoComplete="off"
        inputMode="email"
        onChange={mockOnChange}
      />,
    );

    const inputEl = screen.getByTestId('test-types');
    expect(inputEl).toHaveAttribute('type', 'email');
    expect(inputEl).toHaveAttribute('autocomplete', 'off');
    expect(inputEl).toHaveAttribute('inputmode', 'email');
  });

  test('should handle className prop on form group and input', () => {
    const customClass = 'my-custom-class';
    render(<Input id="test-class" className={customClass} onChange={mockOnChange} />);

    const formGroup = document.querySelector('.usa-form-group');
    const inputEl = screen.getByTestId('test-class');

    expect(formGroup).toHaveClass(customClass);
    expect(inputEl).toHaveClass(`usa-input usa-tooltip ${customClass}`);
  });
});
