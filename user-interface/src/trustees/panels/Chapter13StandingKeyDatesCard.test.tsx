import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import Chapter13StandingKeyDatesCard from './Chapter13StandingKeyDatesCard';

describe('Chapter13StandingKeyDatesCard', () => {
  test('renders title, tag, and fields as label/value columns', () => {
    render(
      <Chapter13StandingKeyDatesCard
        title="Audit"
        tag={<span data-testid="my-tag">Complete for 2026</span>}
        testId="test-card"
        fields={[
          { label: 'Annual Audit Period', value: '10/01 - 09/30', testId: 'field-1' },
          { label: 'Last Audit Report', value: '02/04/2023', testId: 'field-2' },
        ]}
      />,
    );

    expect(screen.getByText('Audit')).toBeInTheDocument();
    expect(screen.getByTestId('my-tag')).toHaveTextContent('Complete for 2026');
    expect(screen.getByTestId('field-1')).toHaveTextContent('Annual Audit Period');
    expect(screen.getByTestId('field-1')).toHaveTextContent('10/01 - 09/30');
    expect(screen.getByTestId('field-2')).toHaveTextContent('Last Audit Report');
    expect(screen.getByTestId('field-2')).toHaveTextContent('02/04/2023');
  });

  test('renders an Edit button that calls onEdit when clicked', () => {
    const onEdit = vi.fn();
    render(
      <Chapter13StandingKeyDatesCard
        title="Audit"
        onEdit={onEdit}
        editAriaLabel="Edit Audit key dates"
        testId="test-card"
        fields={[]}
      />,
    );

    screen.getByRole('button', { name: /edit audit key dates/i }).click();
    expect(onEdit).toHaveBeenCalled();
  });

  test('renders no Edit button when onEdit is not provided', () => {
    render(<Chapter13StandingKeyDatesCard title="Budget" testId="test-card" fields={[]} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('renders no tag when tag prop is not provided', () => {
    render(<Chapter13StandingKeyDatesCard title="Budget" testId="test-card" fields={[]} />);

    expect(screen.queryByTestId('my-tag')).not.toBeInTheDocument();
  });
});
