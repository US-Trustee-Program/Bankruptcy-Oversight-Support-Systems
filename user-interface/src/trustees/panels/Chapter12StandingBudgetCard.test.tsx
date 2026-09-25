import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import Chapter12StandingBudgetCard from './Chapter12StandingBudgetCard';

describe('Chapter12StandingBudgetCard', () => {
  test('renders the Budget title and its two fixed columns', () => {
    render(<Chapter12StandingBudgetCard appointmentId="appointment-1" />);

    expect(screen.getByText('Budget')).toBeInTheDocument();
    expect(screen.getByTestId('budget-submission-due-row')).toHaveTextContent('05/01');
    expect(screen.getByTestId('budget-review-to-oo-row')).toHaveTextContent('06/01');
  });

  test('scopes its table id with the appointmentId to avoid duplicates across appointments', () => {
    render(<Chapter12StandingBudgetCard appointmentId="appointment-1" />);

    expect(document.getElementById('chapter12-standing-budget-table-appointment-1')).not.toBeNull();
  });
});
