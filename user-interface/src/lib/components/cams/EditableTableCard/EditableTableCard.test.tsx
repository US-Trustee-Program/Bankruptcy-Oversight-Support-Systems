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
    expect(screen.getByTestId('renewal-value')).toHaveAttribute('data-cell', 'Renewal');
    expect(screen.getByTestId('issued-value')).toHaveAttribute('data-cell', 'Issued');
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

  test('defaults the edit button title to "Edit" when editTitle is not provided', () => {
    render(
      <EditableTableCard
        id="edit-thing"
        title="Bond"
        tableAriaLabel="Bond key dates"
        columns={columns}
        values={values}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Edit' })).toHaveAttribute('title', 'Edit');
  });

  test('uses editTitle for both the title and the default aria-label', () => {
    render(
      <EditableTableCard
        id="edit-thing"
        title="Bond"
        tableAriaLabel="Bond key dates"
        columns={columns}
        values={values}
        onEdit={vi.fn()}
        editTitle="Edit bond key dates"
      />,
    );

    const button = screen.getByRole('button', { name: 'Edit bond key dates' });
    expect(button).toHaveAttribute('title', 'Edit bond key dates');
  });

  test.each([
    ['positive', 'bg-success-vivid'],
    ['negative', 'bg-secondary-dark'],
  ] as const)('renders a %s tag with the %s style', (color, expectedClass) => {
    render(
      <EditableTableCard
        id="edit-thing"
        title="Bond"
        tableAriaLabel="Bond key dates"
        columns={columns}
        values={values}
        tag={{ label: 'Active', color, id: 'bond-status-tag' }}
      />,
    );

    const tag = screen.getByTestId('tag-bond-status-tag');
    expect(tag).toHaveTextContent('Active');
    expect(tag).toHaveClass(expectedClass);
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

  test('applies tableId and tableClassName to the table', () => {
    render(
      <EditableTableCard
        id="edit-thing"
        title="Bond"
        tableAriaLabel="Bond key dates"
        columns={columns}
        values={values}
        tableId="my-table"
        tableClassName="my-table-class"
      />,
    );

    const table = document.getElementById('my-table');
    expect(table).not.toBeNull();
    expect(table).toHaveClass('my-table-class');
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

  test('columnheader with headerAriaLabel renders aria-label with spaced-out text', () => {
    const columnsWithAriaLabel = [
      {
        key: 'tir',
        header: 'TIR Due',
        headerAriaLabel: 'T I R Due',
        testId: 'tir-value',
      },
    ];
    const valuesWithTir = { tir: '12/31/2026' };

    render(
      <EditableTableCard
        id="edit-thing"
        title="TIR"
        tableAriaLabel="TIR key dates"
        columns={columnsWithAriaLabel}
        values={valuesWithTir}
      />,
    );

    // The columnheader must have the spaced-out aria-label
    const header = screen.getByRole('columnheader', { name: 'T I R Due' });
    expect(header).toBeInTheDocument();

    // The visible text in the header should be exactly "TIR Due" with no spacing
    expect(header).toHaveTextContent('TIR Due');

    // No extra span elements inside the header (no .usa-sr-only or aria-hidden)
    const srOnlySpan = header.querySelector('.usa-sr-only');
    expect(srOnlySpan).not.toBeInTheDocument();

    const hiddenSpan = header.querySelector('[aria-hidden="true"]');
    expect(hiddenSpan).not.toBeInTheDocument();

    // data-cell should render the header text, not the column key
    expect(screen.getByTestId('tir-value')).toHaveAttribute('data-cell', 'TIR Due');
  });

  test('columnheader without headerAriaLabel does not render aria-label', () => {
    render(
      <EditableTableCard
        id="edit-thing"
        title="Bond"
        tableAriaLabel="Bond key dates"
        columns={columns}
        values={values}
      />,
    );

    // The header should not have aria-label when headerAriaLabel is not provided
    const header = screen.getByRole('columnheader', { name: 'Renewal' });
    expect(header).not.toHaveAttribute('aria-label');
  });
});
