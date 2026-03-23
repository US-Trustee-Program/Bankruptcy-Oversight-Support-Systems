import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import MonthDayRangeSelector from './MonthDayRangeSelector';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';

function renderComponent(
  overrides: Partial<React.ComponentProps<typeof MonthDayRangeSelector>> = {},
) {
  const componentProps = {
    id: 'test-range',
    label: 'Test Period',
    startValue: '',
    endValue: '',
    onStartChange: vi.fn(),
    onEndChange: vi.fn(),
    ...overrides,
  };
  render(<MonthDayRangeSelector {...componentProps} />);
  return componentProps;
}

describe('MonthDayRangeSelector layout', () => {
  test('renders the start and end selectors', () => {
    renderComponent();
    expect(document.getElementById('test-range-start-month')).toBeInTheDocument();
    expect(document.getElementById('test-range-start-day')).toBeInTheDocument();
    expect(document.getElementById('test-range-end-month')).toBeInTheDocument();
    expect(document.getElementById('test-range-end-day')).toBeInTheDocument();
  });

  test('renders a separator icon between the two selectors', () => {
    renderComponent();
    const separator = document.querySelector('.review-period-separator');
    expect(separator).toBeInTheDocument();
    const icon = separator!.querySelector('[data-testid="icon"]');
    expect(icon).toBeInTheDocument();
    expect(icon!.querySelector('use')!.getAttribute('xlink:href')).toBe(
      '/assets/styles/img/sprite.svg#remove',
    );
  });
});

describe('MonthDayRangeSelector clear button', () => {
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
  });

  test('does not render clear button when both values are empty', () => {
    renderComponent({ startValue: '', endValue: '' });
    expect(screen.queryByRole('button', { name: 'Clear Test Period' })).not.toBeInTheDocument();
  });

  test('renders clear button when startValue is set', () => {
    renderComponent({ startValue: '1900-04-01' });
    expect(screen.getByRole('button', { name: 'Clear Test Period' })).toBeInTheDocument();
  });

  test('renders clear button when endValue is set', () => {
    renderComponent({ endValue: '1900-03-31' });
    expect(screen.getByRole('button', { name: 'Clear Test Period' })).toBeInTheDocument();
  });

  test('renders clear button when both values are set', () => {
    renderComponent({ startValue: '1900-04-01', endValue: '1900-03-31' });
    expect(screen.getByRole('button', { name: 'Clear Test Period' })).toBeInTheDocument();
  });

  test('clicking clear button calls onStartChange and onEndChange with empty string', async () => {
    const { onStartChange, onEndChange } = renderComponent({
      startValue: '1900-04-01',
      endValue: '1900-03-31',
    });

    await userEvent.click(screen.getByRole('button', { name: 'Clear Test Period' }));

    expect(onStartChange).toHaveBeenCalledWith('');
    expect(onEndChange).toHaveBeenCalledWith('');
  });
});

describe('MonthDayRangeSelector validation', () => {
  test('shows partial date error when only month is selected and submitted is true', () => {
    renderComponent({ startValue: '1900-04-', submitted: true });
    expect(screen.getByText('Must be a valid date mm/dd.')).toBeInTheDocument();
  });

  test('does not show partial date error when only month is selected and submitted is false', () => {
    renderComponent({ startValue: '1900-04-', submitted: false });
    expect(screen.queryByText('Must be a valid date mm/dd.')).not.toBeInTheDocument();
  });
});
