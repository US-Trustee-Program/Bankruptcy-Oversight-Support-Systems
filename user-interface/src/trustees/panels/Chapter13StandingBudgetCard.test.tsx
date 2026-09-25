import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import Chapter13StandingBudgetCard from './Chapter13StandingBudgetCard';

describe('Chapter13StandingBudgetCard', () => {
  test('renders Budget Submission Due and Budget Due to OO constants', () => {
    render(<Chapter13StandingBudgetCard appointmentId="appointment-1" />);
    expect(screen.getByTestId('budget-submission-due-row')).toHaveTextContent('07/01');
    expect(screen.getByTestId('budget-review-to-oo-row')).toHaveTextContent('08/15');
  });

  test('renders no edit button', () => {
    render(<Chapter13StandingBudgetCard appointmentId="appointment-1" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('renders no completion-status tag', () => {
    render(<Chapter13StandingBudgetCard appointmentId="appointment-1" />);
    expect(screen.queryByTestId(/tag-/)).not.toBeInTheDocument();
  });

  test('scopes its table id with the appointmentId to avoid duplicates across appointments', () => {
    render(<Chapter13StandingBudgetCard appointmentId="appointment-1" />);
    expect(document.getElementById('chapter13-standing-budget-table-appointment-1')).not.toBeNull();
  });
});
