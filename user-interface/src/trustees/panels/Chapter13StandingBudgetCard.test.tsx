import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import Chapter13StandingBudgetCard from './Chapter13StandingBudgetCard';

describe('Chapter13StandingBudgetCard', () => {
  test('renders Budget Submission Due and Budget Due to OO constants', () => {
    render(<Chapter13StandingBudgetCard />);
    expect(screen.getByTestId('budget-submission-due-row')).toHaveTextContent('07/01');
    expect(screen.getByTestId('budget-review-to-oo-row')).toHaveTextContent('08/15');
  });

  test('renders no edit button', () => {
    render(<Chapter13StandingBudgetCard />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('renders no completion-status tag', () => {
    render(<Chapter13StandingBudgetCard />);
    expect(screen.queryByTestId(/tag-/)).not.toBeInTheDocument();
  });
});
