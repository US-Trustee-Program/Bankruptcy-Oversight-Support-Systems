import { TextAreaRef } from '@/lib/type-declarations/input-fields';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import TextArea from './TextArea';

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

  const renderWithoutProps = () => {
    render(
      <div>
        <TextArea
          className={testClassName}
          id={id}
          label={label}
          onChange={youChangedMe}
          ref={ref}
          value={value}
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

    ref.current?.setValue(newValue);
    await waitFor(() => {
      expect(inputEl).toHaveValue(newValue);
    });

    ref.current?.resetValue();
    await waitFor(() => {
      expect(inputEl).toHaveValue(value);
    });
  });

  test('Should clear value when ref.clearValue is called.', async () => {
    renderWithoutProps();
    const inputEl = screen.getByTestId(textAreaId);
    ref.current?.setValue(newValue);

    await waitFor(() => {
      expect(inputEl).toHaveValue(newValue);
    });

    ref.current?.clearValue();
    await waitFor(() => {
      expect(inputEl).toHaveValue('');
    });
  });

  test('clearValue should skip focus if inputRef is null', async () => {
    renderWithoutProps();
    const mockInnerRef = { current: { focus: vi.fn(), value: '' } };
    const useRefMock = vi.spyOn(React, 'useRef').mockReturnValueOnce(mockInnerRef);

    expect(ref.current).toBeDefined();
    expect(typeof ref.current!.clearValue).toBe('function');

    ref.current?.clearValue();

    expect(mockInnerRef.current.focus).not.toHaveBeenCalled();

    useRefMock.mockRestore();
  });

  test('Should return value when ref.getValue is called.', async () => {
    renderWithoutProps();
    const inputEl = screen.getByTestId(textAreaId);
    ref.current?.setValue(newValue);

    await waitFor(() => {
      expect(inputEl).toHaveValue(newValue);
    });

    expect(ref.current?.getValue()).toEqual(newValue);
  });

  test('Should call props.onChange when a change is made to textarea by keypress or by ref.', async () => {
    renderWithoutProps();
    const inputEl = screen.getByTestId(textAreaId);

    ref.current?.setValue(newValue);
    await waitFor(() => {
      expect(inputEl).toHaveValue(newValue);
    });
    expect(youChangedMe).toHaveBeenCalled();

    const anotherValue = '. Yet another value';
    await userEvent.type(inputEl, anotherValue);
    await waitFor(() => {
      expect(inputEl).toHaveValue(newValue + anotherValue);
    });
    expect(youChangedMe).toHaveBeenCalled();
  });
});

describe('Testing TextArea for ariaDescription', () => {
  test('Should include ariaDescription if supplied', async () => {
    const description = 'This is a test description';

    render(
      <div>
        <TextArea ariaDescription={description} id="text-area-id" />
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
          className={testClassName}
          id={id}
          label={label}
          onChange={youChangedMe}
          ref={ref}
        />
      </div>,
    );
  };

  test('test null on reset if no value provided to props', async () => {
    renderWithoutProp();
    const inputEl = screen.getByTestId(textAreaId);

    ref.current?.setValue(newValue);
    await waitFor(() => {
      expect(inputEl).toHaveValue(newValue);
    });

    ref.current?.resetValue();
    await waitFor(() => {
      expect(inputEl).toHaveValue('');
    });

    inputEl.focus();
    ref.current?.clearValue();
    expect(inputEl).toHaveFocus();
  });
});
