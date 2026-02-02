import { TextAreaRef } from '@/lib/type-declarations/input-fields';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import TextArea from './TextArea';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';

describe('Tests for USWDS TextArea component', () => {
  const ref = React.createRef<TextAreaRef>();
  const youChangedMe = vi.fn();
  const id = 'input-1';
  const textAreaId = `textarea-${id}`;
  const labelId = `textarea-label-${id}`;
  const label = 'test TextArea';
  const value = 'original text';
  const newValue = 'new value';
  const testClassName = 'test-class-name';
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
  });

  const renderWithoutProps = () => {
    render(
      <div>
        <TextArea
          ref={ref}
          id={id}
          label={label}
          value={value}
          onChange={youChangedMe}
          className={testClassName}
        />
      </div>,
    );
  };

  test('Should include label if provided', async () => {
    renderWithoutProps();
    const labelEl = screen.getByTestId(labelId);
    expect(labelEl).toBeInTheDocument();
    expect(labelEl).toHaveClass('usa-label ' + testClassName + '-label');
    expect(labelEl).toHaveAttribute('id', labelId);
    expect(labelEl).toHaveAttribute('for', textAreaId);
  });

  test('TextArea should include correct class and id', async () => {
    renderWithoutProps();
    const textAreaEl = screen.getByTestId(textAreaId);
    expect(textAreaEl).toBeInTheDocument();
    expect(textAreaEl).toHaveClass('usa-textarea ' + testClassName);
    expect(textAreaEl).toHaveAttribute('id', textAreaId);
  });

  test('Should not include aria description if none is supplied', async () => {
    renderWithoutProps();
    const usaHintEl = document.querySelector('.usa-hint');
    expect(usaHintEl).not.toBeInTheDocument();
  });

  test('Should change value when ref.setValue() is called and set value back to original when ref.resetValue() is called.', async () => {
    renderWithoutProps();
    const inputEl = screen.getByTestId(textAreaId);
    expect(inputEl).toHaveValue(value);

    act(() => ref.current?.setValue(newValue));
    expect(inputEl).toHaveValue(newValue);

    act(() => ref.current?.resetValue());
    expect(inputEl).toHaveValue(value);
  });

  test('Should clear value when ref.clearValue is called.', async () => {
    renderWithoutProps();
    const inputEl = screen.getByTestId(textAreaId);

    act(() => ref.current?.setValue(newValue));
    expect(inputEl).toHaveValue(newValue);

    act(() => ref.current?.clearValue());
    expect(inputEl).toHaveValue('');
  });

  test('clearValue should skip focus if inputRef is null', async () => {
    renderWithoutProps();
    const mockInnerRef = { current: { focus: vi.fn(), value: '' } };
    const useRefMock = vi.spyOn(React, 'useRef').mockReturnValueOnce(mockInnerRef);

    expect(ref.current).toBeDefined();
    expect(typeof ref.current!.clearValue).toBe('function');

    act(() => ref.current?.clearValue());

    expect(mockInnerRef.current.focus).not.toHaveBeenCalled();

    useRefMock.mockRestore();
  });

  test('Should return value when ref.getValue is called.', async () => {
    renderWithoutProps();
    const inputEl = screen.getByTestId(textAreaId);

    act(() => ref.current?.setValue(newValue));
    expect(inputEl).toHaveValue(newValue);

    expect(ref.current?.getValue()).toEqual(newValue);
  });

  test('Should call props.onChange when a change is made to textarea by keypress or by ref.', async () => {
    renderWithoutProps();
    const inputEl = screen.getByTestId(textAreaId);

    act(() => ref.current?.setValue(newValue));
    expect(inputEl).toHaveValue(newValue);
    expect(youChangedMe).toHaveBeenCalled();

    const anotherValue = '. Yet another value';
    await userEvent.type(inputEl, anotherValue);
    expect(inputEl).toHaveValue(newValue + anotherValue);
    expect(youChangedMe).toHaveBeenCalled();
  });
});

describe('Testing TextArea for ariaDescription', () => {
  test('Should include ariaDescription if supplied', async () => {
    const description = 'This is a test description';

    render(
      <div>
        <TextArea id="text-area-id" ariaDescription={description} />
      </div>,
    );

    const inputEl = screen.getByTestId('textarea-text-area-id');
    const usaHintEl = document.querySelector('.usa-hint');
    expect(usaHintEl).toBeInTheDocument();

    const ariaId = usaHintEl?.id;
    expect(inputEl).toHaveAttribute('aria-describedby', ariaId);

    expect(usaHintEl).toHaveTextContent(description);
  });
});

describe('Test in odd cases', () => {
  const ref = React.createRef<TextAreaRef>();
  const youChangedMe = vi.fn();
  const id = 'input-1';
  const textAreaId = `textarea-${id}`;
  const label = 'test TextArea';
  const newValue = 'new value';
  const testClassName = 'test-class-name';

  const renderWithoutProp = () => {
    render(
      <div>
        <TextArea
          ref={ref}
          id={id}
          label={label}
          onChange={youChangedMe}
          className={testClassName}
        />
      </div>,
    );
  };

  test('null on reset if no value provided to props', async () => {
    renderWithoutProp();
    const inputEl = screen.getByTestId(textAreaId);

    act(() => ref.current?.setValue(newValue));
    expect(inputEl).toHaveValue(newValue);

    act(() => ref.current?.resetValue());
    expect(inputEl).toHaveValue('');

    inputEl.focus();
    act(() => ref.current?.clearValue());
    expect(inputEl).toHaveFocus();
  });
});

describe('TextArea additional coverage tests', () => {
  const ref = React.createRef<TextAreaRef>();
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should handle disabled prop properly', async () => {
    render(
      <TextArea
        ref={ref}
        id="test-disabled"
        label="Test Disabled"
        disabled={true}
        onChange={mockOnChange}
      />,
    );

    const textareaEl = screen.getByTestId('textarea-test-disabled');
    expect(textareaEl).toBeDisabled();

    // Should be able to enable/disable via ref
    act(() => ref.current?.disable(false));
    expect(textareaEl).not.toBeDisabled();

    act(() => ref.current?.disable(true));
    expect(textareaEl).toBeDisabled();
  });

  test('should handle focus method', async () => {
    render(<TextArea ref={ref} id="test-focus" label="Test Focus" onChange={mockOnChange} />);

    const textareaEl = screen.getByTestId('textarea-test-focus');
    expect(textareaEl).not.toHaveFocus();

    act(() => ref.current?.focus());
    expect(textareaEl).toHaveFocus();
  });

  test('should handle required prop and show required indicator', () => {
    render(
      <TextArea id="test-required" label="Test Required" required={true} onChange={mockOnChange} />,
    );

    const requiredIndicator = document.querySelector('.required-form-field');
    expect(requiredIndicator).toBeInTheDocument();
  });

  test('should apply className to form group and label correctly', () => {
    const customClass = 'my-custom-class';
    render(
      <TextArea
        id="test-classname"
        label="Test ClassName"
        className={customClass}
        onChange={mockOnChange}
      />,
    );

    const formGroup = document.querySelector('.usa-form-group.textarea-container');
    const label = screen.getByTestId('textarea-label-test-classname');

    expect(formGroup).toHaveClass(customClass);
    expect(label).toHaveClass(`usa-label ${customClass}-label`);
  });

  test('should handle value prop changes', async () => {
    const { rerender } = render(
      <TextArea
        ref={ref}
        id="test-value-change"
        label="Test Value Change"
        value="initial"
        onChange={mockOnChange}
      />,
    );

    const textareaEl = screen.getByTestId('textarea-test-value-change');
    expect(textareaEl).toHaveValue('initial');

    // Change the prop value
    rerender(
      <TextArea
        ref={ref}
        id="test-value-change"
        label="Test Value Change"
        value="updated"
        onChange={mockOnChange}
      />,
    );

    await waitFor(() => {
      expect(textareaEl).toHaveValue('updated');
    });
  });

  test('should handle all standard textarea props', () => {
    render(
      <TextArea
        id="test-props"
        label="Test Props"
        placeholder="Enter text here"
        rows={5}
        cols={50}
        maxLength={100}
        onChange={mockOnChange}
      />,
    );

    const textareaEl = screen.getByTestId('textarea-test-props');
    expect(textareaEl).toHaveAttribute('placeholder', 'Enter text here');
    expect(textareaEl).toHaveAttribute('rows', '5');
    expect(textareaEl).toHaveAttribute('cols', '50');
    expect(textareaEl).toHaveAttribute('maxlength', '100');
  });

  test('should handle clearValue emitting change event', async () => {
    render(
      <TextArea
        ref={ref}
        id="test-clear-emit"
        label="Test Clear Emit"
        value="some text"
        onChange={mockOnChange}
      />,
    );

    act(() => ref.current?.clearValue());

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ value: '' }),
      }),
    );
  });
});

describe('TextArea error handling tests', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should display error message and set ARIA attributes when errorMessage provided', () => {
    render(
      <TextArea id="test" label="Test" errorMessage="This is required" onChange={mockOnChange} />,
    );

    const textarea = document.getElementById('textarea-test');
    const errorElement = document.getElementById('textarea-test-error-message');
    const textareaGroup = document.querySelector('.usa-textarea-group');

    expect(errorElement).toBeInTheDocument();
    expect(errorElement).toHaveTextContent('This is required');
    expect(errorElement).toHaveClass('usa-input__error-message');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea).toHaveAttribute('aria-errormessage', 'textarea-test-error-message');
    expect(textareaGroup).toHaveClass('usa-textarea-group--error');
  });

  test('should not display error message or set ARIA attributes when errorMessage is undefined or empty', () => {
    const { rerender } = render(<TextArea id="test" label="Test" onChange={mockOnChange} />);

    let textarea = document.getElementById('textarea-test');
    let textareaGroup = document.querySelector('.usa-textarea-group');

    expect(document.getElementById('textarea-test-error-message')).not.toBeInTheDocument();
    expect(textarea).not.toHaveAttribute('aria-invalid');
    expect(textarea).not.toHaveAttribute('aria-errormessage');
    expect(textareaGroup).not.toHaveClass('usa-textarea-group--error');

    rerender(<TextArea id="test" label="Test" errorMessage="" onChange={mockOnChange} />);

    textarea = document.getElementById('textarea-test');
    textareaGroup = document.querySelector('.usa-textarea-group');

    expect(document.getElementById('textarea-test-error-message')).not.toBeInTheDocument();
    expect(textarea).not.toHaveAttribute('aria-invalid');
    expect(textarea).not.toHaveAttribute('aria-errormessage');
    expect(textareaGroup).not.toHaveClass('usa-textarea-group--error');
  });
});
