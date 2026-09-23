import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import Chapter12StandingBudgetCard from './Chapter12StandingBudgetCard';

describe('Chapter12StandingBudgetCard', () => {
  test('renders the Budget title and its two fixed columns', () => {
    render(<Chapter12StandingBudgetCard />);

    expect(screen.getByText('Budget')).toBeInTheDocument();
    expect(screen.getByTestId('budget-submission-due-row')).toHaveTextContent('05/01');
    expect(screen.getByTestId('budget-review-to-oo-row')).toHaveTextContent('06/01');
  });
});
