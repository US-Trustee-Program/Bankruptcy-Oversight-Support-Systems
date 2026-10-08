import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { SelectRef } from '@/lib/type-declarations/input-fields';
import Select, { SelectOption } from './Select';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';

const OPTIONS: SelectOption[] = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
];

describe('Select', () => {
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
  });

  test('renders a label, hint, and options', () => {
    render(
      <Select
        id="select-1"
        label="Choose one"
        ariaDescription="Pick your favorite"
        options={OPTIONS}
      />,
    );

    expect(screen.getByText('Choose one')).toBeInTheDocument();
    expect(screen.getByText('Pick your favorite')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Option A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Option B' })).toBeInTheDocument();
  });

  test('renders the label with usa-label by default and usa-hint when compactLabel is set', () => {
    const { rerender } = render(<Select id="select-1" label="Year" options={OPTIONS} />);

    expect(screen.getByText('Year')).toHaveClass('usa-label');

    rerender(<Select id="select-1" label="Year" options={OPTIONS} compactLabel />);

    expect(screen.getByText('Year')).toHaveClass('usa-hint');
  });

  test('renders a placeholder option when provided', () => {
    render(<Select id="select-1" options={OPTIONS} placeholder="- Select -" />);

    expect(screen.getByRole('option', { name: '- Select -' })).toBeInTheDocument();
  });

  test('does not render a placeholder option when omitted', () => {
    render(<Select id="select-1" options={OPTIONS} />);

    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  test('applies a custom className to the wrapping form group', () => {
    const { container } = render(
      <Select id="select-1" options={OPTIONS} className="custom-select" />,
    );

    const wrapper = container.querySelector('.usa-form-group');
    expect(wrapper).toHaveClass('usa-form-group', 'custom-select');
  });

  test('renders the required asterisk and sets the required attribute', () => {
    render(<Select id="select-1" label="Choose one" options={OPTIONS} required />);

    const selectEl = screen.getByTestId('select-1');
    expect(selectEl).toBeRequired();
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  test('calls onChange and updates the selected value when the user makes a selection', async () => {
    const handleChange = vi.fn();
    render(<Select id="select-1" options={OPTIONS} onChange={handleChange} />);

    const selectEl = screen.getByTestId('select-1') as HTMLSelectElement;
    await userEvent.selectOptions(selectEl, 'b');

    expect(handleChange).toHaveBeenCalled();
    expect(selectEl.value).toBe('b');
  });

  test('associates the hint and error message via aria-describedby', () => {
    const { rerender } = render(
      <Select id="select-1" options={OPTIONS} ariaDescription="A hint" />,
    );

    const selectEl = screen.getByTestId('select-1');
    expect(selectEl).toHaveAttribute('aria-describedby', 'select-1-hint');
    expect(selectEl).not.toHaveAttribute('aria-invalid');

    rerender(
      <Select id="select-1" options={OPTIONS} ariaDescription="A hint" errorMessage="Required" />,
    );

    expect(selectEl).toHaveAttribute(
      'aria-describedby',
      'select-1-hint select-1-field-error-message',
    );
    expect(selectEl).toHaveAttribute('aria-invalid', 'true');
    expect(selectEl).toHaveClass('usa-input--error');

    const errorEl = document.getElementById('select-1-field-error-message');
    expect(errorEl).toHaveTextContent('Required');
    expect(errorEl).toHaveAttribute('aria-live', 'polite');
    // Matches Input/ComboBox's non-bold error text style, not the bold real-USWDS usa-error-message.
    expect(errorEl).toHaveClass('cams-field-error-message');
  });

  test('keeps the error message container mounted with no error present', () => {
    render(<Select id="select-1" options={OPTIONS} />);

    const errorEl = document.getElementById('select-1-field-error-message');
    expect(errorEl).toBeInTheDocument();
    expect(errorEl).not.toHaveClass('cams-field-error-message');
    expect(errorEl).toHaveTextContent('');
  });

  test('associates only the error message via aria-describedby when no hint is present', () => {
    render(<Select id="select-1" options={OPTIONS} errorMessage="Required" />);

    const selectEl = screen.getByTestId('select-1');
    expect(selectEl).toHaveAttribute('aria-describedby', 'select-1-field-error-message');
  });

  test('includes an externally rendered error id in aria-describedby via ariaDescribedBy', () => {
    render(
      <Select
        id="select-1"
        options={OPTIONS}
        ariaDescription="A hint"
        hasError
        ariaDescribedBy="shared-pair-error"
      />,
    );

    const selectEl = screen.getByTestId('select-1');
    expect(selectEl).toHaveAttribute('aria-describedby', 'select-1-hint shared-pair-error');
    expect(selectEl).toHaveAttribute('aria-invalid', 'true');

    // The externally-referenced id isn't rendered by Select itself -- only the
    // reference is added, so the shared error text isn't duplicated here.
    expect(document.getElementById('select-1-field-error-message')).not.toHaveTextContent(/.+/);
  });

  test('hasError flags the select as invalid without rendering its own error text', () => {
    render(<Select id="select-1" options={OPTIONS} hasError />);

    const selectEl = screen.getByTestId('select-1');
    expect(selectEl).toHaveClass('usa-input--error');
    expect(selectEl).toHaveAttribute('aria-invalid', 'true');
    expect(selectEl).not.toHaveAttribute('aria-describedby');

    const errorEl = document.getElementById('select-1-field-error-message');
    expect(errorEl).not.toHaveClass('cams-field-error-message');
    expect(errorEl).toHaveTextContent('');
  });

  test('syncs the displayed value and disabled state when the value/disabled props change', () => {
    const { rerender } = render(<Select id="select-1" options={OPTIONS} value="a" />);

    const selectEl = screen.getByTestId('select-1') as HTMLSelectElement;
    expect(selectEl.value).toBe('a');
    expect(selectEl).not.toBeDisabled();

    rerender(<Select id="select-1" options={OPTIONS} value="b" disabled />);

    expect(selectEl.value).toBe('b');
    expect(selectEl).toBeDisabled();
  });

  describe('imperative ref API', () => {
    test('getValue/setValue/resetValue/clearValue/disable/focus behave as expected', () => {
      const ref = React.createRef<SelectRef>();
      render(
        <Select ref={ref} id="select-1" options={OPTIONS} placeholder="- Select -" value="a" />,
      );
      const selectEl = screen.getByTestId('select-1') as HTMLSelectElement;

      expect(ref.current?.getValue()).toBe('a');

      act(() => ref.current?.setValue('b'));
      expect(selectEl.value).toBe('b');

      act(() => ref.current?.resetValue());
      expect(selectEl.value).toBe('a');

      act(() => ref.current?.clearValue());
      expect(selectEl.value).toBe('');

      act(() => ref.current?.disable(true));
      expect(selectEl).toBeDisabled();

      act(() => ref.current?.disable(false));
      expect(selectEl).not.toBeDisabled();

      act(() => ref.current?.focus());
      expect(selectEl).toHaveFocus();
    });

    test('clearValue notifies onChange with an empty value', () => {
      const ref = React.createRef<SelectRef>();
      const handleChange = vi.fn();
      render(
        <Select
          ref={ref}
          id="select-1"
          options={OPTIONS}
          placeholder="- Select -"
          value="a"
          onChange={handleChange}
        />,
      );
      const selectEl = screen.getByTestId('select-1') as HTMLSelectElement;

      act(() => ref.current?.clearValue());

      expect(selectEl.value).toBe('');
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({ target: expect.objectContaining({ value: '' }) }),
      );
    });
  });
});
