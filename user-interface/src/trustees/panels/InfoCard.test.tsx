import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import InfoCard from './InfoCard';

describe('InfoCard', () => {
  const fields = [
    { label: 'District', value: 'Southern District of New York', testId: 'district-field' },
    { label: 'Chapter', value: '7', testId: 'chapter-field' },
  ];

  test('renders each field as a labeled list item', () => {
    render(<InfoCard id="edit-info" title="Key Information" fields={fields} />);

    expect(screen.getByText('Key Information')).toBeInTheDocument();
    expect(screen.getByTestId('district-field')).toHaveTextContent(
      'District: Southern District of New York',
    );
    expect(screen.getByTestId('chapter-field')).toHaveTextContent('Chapter: 7');
  });

  test('omits the label span when a field has no label', () => {
    render(
      <InfoCard
        id="edit-info"
        title="Key Information"
        fields={[{ label: '', value: 'unlabeled value', testId: 'unlabeled-field' }]}
      />,
    );

    const field = screen.getByTestId('unlabeled-field');
    expect(field).toHaveTextContent('unlabeled value');
    expect(field.querySelector('.info-card-label')).not.toBeInTheDocument();
  });

  test('renders a stacked field value on its own line', () => {
    render(
      <InfoCard
        id="edit-info"
        title="Key Information"
        fields={[{ label: 'Notes', value: 'Line one', testId: 'notes-field', stacked: true }]}
      />,
    );

    const field = screen.getByTestId('notes-field');
    expect(field.querySelector('.info-card-value-stacked')).toHaveTextContent('Line one');
  });

  test('does not render an edit button when onEdit is not provided', () => {
    render(<InfoCard id="edit-info" title="Key Information" fields={fields} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('renders an edit button with default title and aria-label when onEdit is provided', () => {
    const onEdit = vi.fn();
    render(<InfoCard id="edit-info" title="Key Information" fields={fields} onEdit={onEdit} />);

    const button = screen.getByRole('button', { name: 'Edit' });
    expect(button).toHaveAttribute('title', 'Edit');
  });

  test('uses editTitle and editAriaLabel overrides when provided', () => {
    const onEdit = vi.fn();
    render(
      <InfoCard
        id="edit-info"
        title="Key Information"
        fields={fields}
        onEdit={onEdit}
        editTitle="Edit trustee appointment"
        editAriaLabel="Edit trustee appointment details"
      />,
    );

    const button = screen.getByRole('button', { name: 'Edit trustee appointment details' });
    expect(button).toHaveAttribute('title', 'Edit trustee appointment');
  });

  test('falls back to editTitle for the aria-label when editAriaLabel is not provided', () => {
    const onEdit = vi.fn();
    render(
      <InfoCard
        id="edit-info"
        title="Key Information"
        fields={fields}
        onEdit={onEdit}
        editTitle="Edit trustee appointment"
      />,
    );

    expect(screen.getByRole('button', { name: 'Edit trustee appointment' })).toBeInTheDocument();
  });

  test('calls onEdit when the edit button is clicked', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<InfoCard id="edit-info" title="Key Information" fields={fields} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(onEdit).toHaveBeenCalledOnce();
  });

  test('applies testId and listTestId', () => {
    render(
      <InfoCard
        id="edit-info"
        title="Key Information"
        fields={fields}
        testId="my-info-card"
        listTestId="my-info-card-list"
      />,
    );

    expect(screen.getByTestId('my-info-card')).toBeInTheDocument();
    expect(screen.getByTestId('my-info-card-list')).toBeInTheDocument();
  });
});
