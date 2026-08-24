import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import MonthYearSelector from './MonthYearSelector';

const CURRENT_YEAR = new Date().getFullYear();

function monthSelect(id = 'test') {
  return document.getElementById(`${id}-month`) as HTMLSelectElement;
}

function yearSelect(id = 'test') {
  return document.getElementById(`${id}-year`) as HTMLSelectElement;
}

describe('MonthYearSelector', () => {
  test('renders month and year dropdowns', () => {
    render(<MonthYearSelector id="test" label="Last Compensation Study" />);

    expect(screen.getByText('Last Compensation Study')).toBeInTheDocument();
    expect(screen.getByText('Month')).toBeInTheDocument();
    expect(screen.getByText('Year')).toBeInTheDocument();
    expect(monthSelect()).toBeInTheDocument();
    expect(yearSelect()).toBeInTheDocument();
  });

  test('renders 12 month options (plus blank)', () => {
    render(<MonthYearSelector id="test" />);

    const options = Array.from(monthSelect().options).map((o) => o.value);
    expect(options).toHaveLength(13);
    expect(options[0]).toBe('');
    expect(options[1]).toBe('01');
    expect(options[12]).toBe('12');
  });

  test('renders 20 year options (plus blank) starting from current year', () => {
    render(<MonthYearSelector id="test" />);

    const options = Array.from(yearSelect().options).map((o) => o.value);
    expect(options).toHaveLength(21);
    expect(options[0]).toBe('');
    expect(options[1]).toBe(String(CURRENT_YEAR));
    expect(options[20]).toBe(String(CURRENT_YEAR - 19));
  });

  test('initializes from value prop', () => {
    render(<MonthYearSelector id="test" value="2023-08-01" />);

    expect(monthSelect().value).toBe('08');
    expect(yearSelect().value).toBe('2023');
  });

  test('renders with empty selects when no value provided', () => {
    render(<MonthYearSelector id="test" />);

    expect(monthSelect().value).toBe('');
    expect(yearSelect().value).toBe('');
  });

  test('selecting both month and year calls onChange with YYYY-MM-01', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onValidationChange = vi.fn();

    render(
      <MonthYearSelector id="test" onChange={onChange} onValidationChange={onValidationChange} />,
    );

    await user.selectOptions(monthSelect(), '06');
    await user.selectOptions(yearSelect(), String(CURRENT_YEAR));

    expect(onChange).toHaveBeenLastCalledWith(`${CURRENT_YEAR}-06-01`);
    expect(onValidationChange).toHaveBeenLastCalledWith(false);
  });

  test('selecting only month calls onValidationChange(true)', async () => {
    const user = userEvent.setup();
    const onValidationChange = vi.fn();

    render(<MonthYearSelector id="test" onValidationChange={onValidationChange} />);

    await user.selectOptions(monthSelect(), '03');

    expect(onValidationChange).toHaveBeenLastCalledWith(true);
  });

  test('selecting only year calls onValidationChange(true)', async () => {
    const user = userEvent.setup();
    const onValidationChange = vi.fn();

    render(<MonthYearSelector id="test" onValidationChange={onValidationChange} />);

    await user.selectOptions(yearSelect(), String(CURRENT_YEAR));

    expect(onValidationChange).toHaveBeenLastCalledWith(true);
  });

  test('clearing both selects calls onValidationChange(false) and onChange("")', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onValidationChange = vi.fn();

    render(
      <MonthYearSelector
        id="test"
        value="2023-05-01"
        onChange={onChange}
        onValidationChange={onValidationChange}
      />,
    );

    await user.selectOptions(monthSelect(), '');
    await user.selectOptions(yearSelect(), '');

    expect(onChange).toHaveBeenLastCalledWith('');
    expect(onValidationChange).toHaveBeenLastCalledWith(false);
  });

  test('reacts to external value change via useEffect', () => {
    const { rerender } = render(<MonthYearSelector id="test" value="" />);

    expect(monthSelect().value).toBe('');
    expect(yearSelect().value).toBe('');

    rerender(<MonthYearSelector id="test" value="2024-11-01" />);

    expect(monthSelect().value).toBe('11');
    expect(yearSelect().value).toBe('2024');
  });
});
