import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import StandingBudgetCard, { StandingBudgetCardVariant } from './StandingBudgetCard';

describe('StandingBudgetCard', () => {
  test.each([
    ['chapter12-standing', '05/01', '06/01'],
    ['chapter13-standing', '07/01', '08/15'],
  ] as [StandingBudgetCardVariant, string, string][])(
    'renders the confirmed %s dates',
    (variant, budgetSubmissionDue, budgetReviewToOO) => {
      render(<StandingBudgetCard appointmentId="appointment-1" variant={variant} />);

      expect(screen.getByText('Budget')).toBeInTheDocument();
      expect(screen.getByTestId('budget-submission-due-row')).toHaveTextContent(
        budgetSubmissionDue,
      );
      expect(screen.getByTestId('budget-review-to-oo-row')).toHaveTextContent(budgetReviewToOO);
    },
  );

  test.each(['chapter12-standing', 'chapter13-standing'] as StandingBudgetCardVariant[])(
    'scopes its %s table id with the appointmentId to avoid duplicates across appointments',
    (variant) => {
      render(<StandingBudgetCard appointmentId="appointment-1" variant={variant} />);

      expect(document.getElementById(`${variant}-budget-table-appointment-1`)).not.toBeNull();
    },
  );
});
