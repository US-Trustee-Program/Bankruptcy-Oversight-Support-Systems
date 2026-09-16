import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import EditableTableCard from './EditableTableCard';

describe('EditableTableCard', () => {
  const columns = [
    { key: 'renewal', header: 'Renewal', testId: 'renewal-value' },
    { key: 'issued', header: 'Issued', testId: 'issued-value' },
  ];
  const values = {
    renewal: '06/01/2026',
    issued: '06/01/2023',
  };

  test('renders title, table headers, and values', () => {
    render(
      <EditableTableCard
        id="edit-thing"
        title="Bond"
        tableAriaLabel="Bond key dates"
        columns={columns}
        values={values}
      />,
    );

    expect(screen.getByText('Bond')).toBeInTheDocument();
    expect(screen.getByText('Renewal')).toBeInTheDocument();
    expect(screen.getByText('Issued')).toBeInTheDocument();
    expect(screen.getByTestId('renewal-value')).toHaveTextContent('06/01/2026');
    expect(screen.getByTestId('issued-value')).toHaveTextContent('06/01/2023');
  });

  test('does not render an edit button when onEdit is not provided', () => {
    render(
      <EditableTableCard
        id="edit-thing"
        title="Bond"
        tableAriaLabel="Bond key dates"
        columns={columns}
        values={values}
      />,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('renders an edit button and invokes onEdit when clicked', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();

    render(
      <EditableTableCard
        id="edit-thing"
        title="Bond"
        tableAriaLabel="Bond key dates"
        columns={columns}
        values={values}
        onEdit={onEdit}
        editAriaLabel="Edit bond key dates"
      />,
    );

    const button = screen.getByRole('button', { name: 'Edit bond key dates' });
    await user.click(button);

    expect(onEdit).toHaveBeenCalledOnce();
  });

  test('renders a tag when provided', () => {
    render(
      <EditableTableCard
        id="edit-thing"
        title="Bond"
        tableAriaLabel="Bond key dates"
        columns={columns}
        values={values}
        tag={{ label: 'Active', color: 'green', id: 'bond-status-tag' }}
      />,
    );

    expect(screen.getByTestId('tag-bond-status-tag')).toHaveTextContent('Active');
  });

  test('does not render a tag when not provided', () => {
    render(
      <EditableTableCard
        id="edit-thing"
        title="Bond"
        tableAriaLabel="Bond key dates"
        columns={columns}
        values={values}
      />,
    );

    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });

  test('applies testId and className to the card', () => {
    render(
      <EditableTableCard
        id="edit-thing"
        title="Bond"
        tableAriaLabel="Bond key dates"
        columns={columns}
        values={values}
        testId="my-card"
        className="my-card-class"
      />,
    );

    const card = screen.getByTestId('my-card');
    expect(card).toHaveClass('usa-card');
    expect(card).toHaveClass('editable-table-card');
    expect(card).toHaveClass('my-card-class');
  });
});
