import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import DatesCard from './DatesCard';

describe('DatesCard', () => {
  const mockProps = {
    dateFiled: '2023-01-15',
    showReopenDate: false,
  };

  test('renders dates card with filed date', () => {
    render(<DatesCard {...mockProps} />);

    expect(screen.getByText('Dates')).toBeInTheDocument();
    expect(screen.getByTestId('case-detail-filed-date')).toBeInTheDocument();
    expect(screen.getByText('Case Filed:')).toBeInTheDocument();
  });

  test('shows reopened date when showReopenDate is true', () => {
    render(<DatesCard {...mockProps} reopenedDate="2023-06-01" showReopenDate={true} />);

    expect(screen.getByTestId('case-detail-reopened-date')).toBeInTheDocument();
    expect(screen.getByText('Reopened by court:')).toBeInTheDocument();
  });

  test('shows closed date when showReopenDate is false and closedDate exists', () => {
    render(<DatesCard {...mockProps} closedDate="2023-12-01" showReopenDate={false} />);

    expect(screen.getByTestId('case-detail-closed-date')).toBeInTheDocument();
    expect(screen.getByText('Closed by court:')).toBeInTheDocument();
  });

  test('does not show closed date when showReopenDate is true', () => {
    render(<DatesCard {...mockProps} closedDate="2023-12-01" showReopenDate={true} />);

    expect(screen.queryByTestId('case-detail-closed-date')).not.toBeInTheDocument();
  });

  test('shows dismissed date when provided', () => {
    render(<DatesCard {...mockProps} dismissedDate="2023-11-15" />);

    expect(screen.getByTestId('case-detail-dismissed-date')).toBeInTheDocument();
    expect(screen.getByText('Dismissed by court:')).toBeInTheDocument();
  });

  test('uses semantic HTML with dl, dt, dd elements', () => {
    const { container } = render(<DatesCard {...mockProps} />);

    const dl = container.querySelector('dl');
    expect(dl).toBeInTheDocument();

    const dt = container.querySelector('dt');
    expect(dt).toBeInTheDocument();
    expect(dt).toHaveClass('case-detail-item-name');

    const dd = container.querySelector('dd');
    expect(dd).toBeInTheDocument();
    expect(dd).toHaveClass('case-detail-item-value');
  });
});
