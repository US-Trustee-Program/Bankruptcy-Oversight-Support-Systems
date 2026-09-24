import { render, screen, fireEvent } from '@testing-library/react';
import PairFieldGroup from './PairFieldGroup';

describe('PairFieldGroup', () => {
  function renderGroup(error: string) {
    return render(
      <PairFieldGroup
        idPrefix="test-pair"
        groupClassName="test-group"
        rowClassName="test-group__row"
        title="Test Pair"
        error={error}
      >
        {({ hasError, ariaDescribedBy }) => (
          <>
            <input
              data-testid="field-a"
              aria-invalid={hasError}
              aria-describedby={ariaDescribedBy}
            />
            <input
              data-testid="field-b"
              aria-invalid={hasError}
              aria-describedby={ariaDescribedBy}
            />
          </>
        )}
      </PairFieldGroup>,
    );
  }

  test('renders the title', () => {
    renderGroup('');
    expect(screen.getByText('Test Pair')).toBeInTheDocument();
  });

  test('renders custom header markup instead of title when provided', () => {
    render(
      <PairFieldGroup
        idPrefix="test-pair"
        groupClassName="test-group"
        rowClassName="test-group__row"
        title="Should not render"
        header={
          <div className="custom-header">
            <label htmlFor="field-a">Custom Header</label>
          </div>
        }
        error=""
      >
        {() => <input id="field-a" data-testid="field-a" />}
      </PairFieldGroup>,
    );

    expect(screen.getByText('Custom Header')).toBeInTheDocument();
    expect(screen.queryByText('Should not render')).not.toBeInTheDocument();
  });

  test('does not show the error before the group is blurred', () => {
    renderGroup('Year and Status must both be set.');
    expect(screen.queryByTestId('test-pair-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('field-a')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByTestId('field-a')).not.toHaveAttribute('aria-describedby');
  });

  test('shows the error once focus leaves the row while invalid', () => {
    renderGroup('Year and Status must both be set.');

    fireEvent.focus(screen.getByTestId('field-a'));
    fireEvent.blur(screen.getByTestId('field-a'), { relatedTarget: null });

    const errorEl = screen.getByTestId('test-pair-error');
    expect(errorEl).toHaveTextContent('Year and Status must both be set.');
    expect(screen.getByTestId('field-a')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('field-a')).toHaveAttribute('aria-describedby', errorEl.id);
    expect(screen.getByTestId('field-b')).toHaveAttribute('aria-describedby', errorEl.id);
  });

  test('does not show the error when blurring out while valid', () => {
    renderGroup('');

    fireEvent.focus(screen.getByTestId('field-a'));
    fireEvent.blur(screen.getByTestId('field-a'), { relatedTarget: null });

    expect(screen.queryByTestId('test-pair-error')).not.toBeInTheDocument();
  });

  test('hides the error again when the group regains focus', () => {
    renderGroup('Year and Status must both be set.');

    fireEvent.focus(screen.getByTestId('field-a'));
    fireEvent.blur(screen.getByTestId('field-a'), { relatedTarget: null });
    expect(screen.getByTestId('test-pair-error')).toBeInTheDocument();

    fireEvent.focus(screen.getByTestId('field-b'));
    expect(screen.queryByTestId('test-pair-error')).not.toBeInTheDocument();
  });

  test('does not move focus between the two fields within the group', () => {
    renderGroup('Year and Status must both be set.');

    fireEvent.focus(screen.getByTestId('field-a'));
    fireEvent.blur(screen.getByTestId('field-a'), { relatedTarget: screen.getByTestId('field-b') });

    expect(screen.queryByTestId('test-pair-error')).not.toBeInTheDocument();
  });
});
