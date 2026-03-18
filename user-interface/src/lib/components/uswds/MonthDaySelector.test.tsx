import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import MonthDaySelector from './MonthDaySelector';

function monthSelect(id = 'test') {
  return document.getElementById(`${id}-month`) as HTMLSelectElement;
}

function daySelect(id = 'test') {
  return document.getElementById(`${id}-day`) as HTMLSelectElement;
}

describe('MonthDaySelector', () => {
  test('renders label and Month/Day column hints', () => {
    render(<MonthDaySelector id="test" label="Review Period Start" />);

    expect(screen.getByText('Review Period Start')).toBeInTheDocument();
    expect(screen.getByText('Month')).toBeInTheDocument();
    expect(screen.getByText('Day')).toBeInTheDocument();
  });

  test('renders month options as numbers 1 through 12', () => {
    render(<MonthDaySelector id="test" />);

    const options = Array.from(monthSelect().options).map((o) => o.text);
    expect(options[0]).toBe('');
    expect(options[1]).toBe('01');
    expect(options[9]).toBe('09');
    expect(options[12]).toBe('12');
    expect(options).toHaveLength(13);
  });

  test('renders day options 1 through 31', () => {
    render(<MonthDaySelector id="test" />);

    const options = Array.from(daySelect().options).map((o) => o.text);
    expect(options[0]).toBe('');
    expect(options[1]).toBe('01');
    expect(options[9]).toBe('09');
    expect(options[31]).toBe('31');
    expect(options).toHaveLength(32);
  });

  test('pre-populates month and day from value prop', () => {
    render(<MonthDaySelector id="test" value="1900-09-15" />);

    expect(monthSelect()).toHaveValue('09');
    expect(daySelect()).toHaveValue('15');
  });

  test('calls onChange with combined sentinel value when both month and day are selected', async () => {
    const onChange = vi.fn();
    render(<MonthDaySelector id="test" onChange={onChange} />);

    await userEvent.selectOptions(monthSelect(), '04');
    await userEvent.selectOptions(daySelect(), '01');

    expect(onChange).toHaveBeenLastCalledWith('1900-04-01');
  });

  test('calls onChange with partial value when only month is selected', async () => {
    const onChange = vi.fn();
    render(<MonthDaySelector id="test" onChange={onChange} />);

    await userEvent.selectOptions(monthSelect(), '04');

    expect(onChange).toHaveBeenCalledWith('1900-04-');
  });

  test('calls onChange with partial value when only day is selected', async () => {
    const onChange = vi.fn();
    render(<MonthDaySelector id="test" onChange={onChange} />);

    await userEvent.selectOptions(daySelect(), '15');

    expect(onChange).toHaveBeenCalledWith('1900--15');
  });

  test('calls onChange with empty string when both month and day are cleared', async () => {
    const onChange = vi.fn();
    render(<MonthDaySelector id="test" value="1900-04-15" onChange={onChange} />);

    await userEvent.selectOptions(monthSelect(), '');
    await userEvent.selectOptions(daySelect(), '');

    expect(onChange).toHaveBeenLastCalledWith('');
  });

  test('shows custom error message', () => {
    render(<MonthDaySelector id="test" customErrorMessage="This field is required." />);

    expect(screen.getByText('This field is required.')).toBeInTheDocument();
  });

  test('applies error styling to both selects when error message is present', () => {
    render(<MonthDaySelector id="test" customErrorMessage="Error" />);

    expect(monthSelect()).toHaveClass('usa-input--error');
    expect(daySelect()).toHaveClass('usa-input--error');
  });

  test('disables both selects when disabled prop is true', () => {
    render(<MonthDaySelector id="test" disabled />);

    expect(monthSelect()).toBeDisabled();
    expect(daySelect()).toBeDisabled();
  });

  test('syncs month and day state when value prop changes', () => {
    const { rerender } = render(<MonthDaySelector id="test" value="1900-04-01" />);

    expect(monthSelect()).toHaveValue('04');
    expect(daySelect()).toHaveValue('01');

    rerender(<MonthDaySelector id="test" value="1900-09-15" />);

    expect(monthSelect()).toHaveValue('09');
    expect(daySelect()).toHaveValue('15');
  });

  test('clears selections when value prop becomes empty', () => {
    const { rerender } = render(<MonthDaySelector id="test" value="1900-04-01" />);

    rerender(<MonthDaySelector id="test" value="" />);

    expect(monthSelect()).toHaveValue('');
    expect(daySelect()).toHaveValue('');
  });
});
