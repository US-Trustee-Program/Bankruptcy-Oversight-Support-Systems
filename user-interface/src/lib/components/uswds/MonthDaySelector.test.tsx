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

  test('day dropdown is disabled when no month is selected', () => {
    render(<MonthDaySelector id="test" />);

    expect(daySelect()).toBeDisabled();
  });

  test('day dropdown is enabled when a month is selected', async () => {
    render(<MonthDaySelector id="test" />);

    await userEvent.selectOptions(monthSelect(), '01');

    expect(daySelect()).not.toBeDisabled();
  });

  test('renders 31 days for January', async () => {
    render(<MonthDaySelector id="test" />);

    await userEvent.selectOptions(monthSelect(), '01');

    const options = Array.from(daySelect().options).map((o) => o.text);
    expect(options[0]).toBe('');
    expect(options[31]).toBe('31');
    expect(options).toHaveLength(32);
  });

  test('renders 28 days for February', async () => {
    render(<MonthDaySelector id="test" />);

    await userEvent.selectOptions(monthSelect(), '02');

    const options = Array.from(daySelect().options).map((o) => o.text);
    expect(options[0]).toBe('');
    expect(options[28]).toBe('28');
    expect(options).toHaveLength(29);
  });

  test('renders 30 days for April', async () => {
    render(<MonthDaySelector id="test" />);

    await userEvent.selectOptions(monthSelect(), '04');

    const options = Array.from(daySelect().options).map((o) => o.text);
    expect(options[0]).toBe('');
    expect(options[30]).toBe('30');
    expect(options).toHaveLength(31);
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

  test('cannot select day when no month is selected', async () => {
    const onChange = vi.fn();
    render(<MonthDaySelector id="test" onChange={onChange} />);

    // Day select is disabled, so attempting to select should not call onChange
    expect(daySelect()).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
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

  test('clears day when switching from a month with 31 days to February', async () => {
    const onChange = vi.fn();
    render(<MonthDaySelector id="test" value="1900-01-31" onChange={onChange} />);

    expect(daySelect()).toHaveValue('31');

    await userEvent.selectOptions(monthSelect(), '02');

    expect(daySelect()).toHaveValue('');
    expect(onChange).toHaveBeenCalledWith('1900-02-');
  });

  test('clears day when switching from a 31-day month to a 30-day month', async () => {
    const onChange = vi.fn();
    render(<MonthDaySelector id="test" value="1900-01-31" onChange={onChange} />);

    await userEvent.selectOptions(monthSelect(), '04');

    expect(daySelect()).toHaveValue('');
    expect(onChange).toHaveBeenCalledWith('1900-04-');
  });

  test('preserves day when switching months if day is valid for new month', async () => {
    const onChange = vi.fn();
    render(<MonthDaySelector id="test" value="1900-01-15" onChange={onChange} />);

    await userEvent.selectOptions(monthSelect(), '02');

    expect(daySelect()).toHaveValue('15');
    expect(onChange).toHaveBeenCalledWith('1900-02-15');
  });
});
