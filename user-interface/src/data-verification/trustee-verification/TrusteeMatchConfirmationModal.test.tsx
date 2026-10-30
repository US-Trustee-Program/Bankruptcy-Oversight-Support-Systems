import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TrusteeMatchConfirmationModal, {
  TrusteeMatchConfirmationModalImperative,
} from './TrusteeMatchConfirmationModal';
import { ComparisonRow, ComparisonRowKey, SelectedTrustee } from './trustee-comparison';

const modalId = 'test-order-id';

const dxtrRows: ComparisonRow[] = [
  { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'street', label: 'Street' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zip', label: 'Zip' },
  { key: 'email', label: 'Email' },
];
const acmsRows = dxtrRows.filter((row) => row.key !== 'email');

const source: Record<ComparisonRowKey, string | undefined> = {
  name: 'Jane A. Smith',
  phone: '555-0000',
  street: '1 Court St',
  city: 'New York',
  state: 'NY',
  zip: '10001',
  email: 'jane@court.example',
};

const selected: SelectedTrustee = {
  trusteeId: 'trustee-1',
  trusteeName: 'Jane Smith',
  cells: {
    name: { value: 'Jane Smith', differs: true },
    phone: { value: '555-1234 x99', differs: true },
    street: { value: '123 Main St, Suite 200', differs: false },
    city: { value: 'New York', differs: false },
    state: { value: 'NY', differs: false },
    zip: { value: undefined, differs: true },
    email: { value: 'jane@example.com', differs: false },
  },
};

type RenderOptions = {
  rows?: ComparisonRow[];
  caseCount?: number;
  isProcessing?: boolean;
  onCancel?: () => void;
};

describe('TrusteeMatchConfirmationModal', () => {
  const modalRef = React.createRef<TrusteeMatchConfirmationModalImperative>();

  function modalTree(options: RenderOptions, onConfirm: (selected: SelectedTrustee) => void) {
    return (
      <BrowserRouter>
        <TrusteeMatchConfirmationModal
          ref={modalRef}
          id={modalId}
          rows={options.rows ?? dxtrRows}
          source={source}
          caseCount={options.caseCount ?? 3}
          onConfirm={onConfirm}
          onCancel={options.onCancel}
          isProcessing={options.isProcessing}
        />
      </BrowserRouter>
    );
  }

  function renderModal(options: RenderOptions = {}) {
    const onConfirm = vi.fn();
    const { rerender } = render(modalTree(options, onConfirm));
    return {
      onConfirm,
      rerender: (next: RenderOptions) => rerender(modalTree(next, onConfirm)),
    };
  }

  function showSelected() {
    act(() => modalRef.current?.show(selected));
  }

  const sourceColumn = () => screen.getByTestId('confirm-match-source');
  const selectedColumn = () => screen.getByTestId('confirm-match-selected');
  const submitButton = () =>
    screen.getByTestId(`button-trustee-confirmation-modal-${modalId}-submit-button`);
  const cancelButton = () =>
    screen.getByTestId(`button-trustee-confirmation-modal-${modalId}-cancel-button`);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders no trustee content before show() is called', () => {
    renderModal();
    expect(screen.queryByTestId('confirm-match-selected')).not.toBeInTheDocument();
  });

  test('asks whether the selected trustee is the same trustee sent to CAMS', () => {
    renderModal();
    showSelected();

    expect(document.querySelector('.usa-modal__heading')).toHaveTextContent(
      'Confirm Trustee Match',
    );
    expect(
      screen.getByText('Is this the same trustee as the information sent to CAMS?'),
    ).toBeInTheDocument();
    expect(
      within(sourceColumn()).getByRole('heading', { level: 3, name: 'Information Sent to CAMS' }),
    ).toBeInTheDocument();
    expect(
      within(selectedColumn()).getByRole('heading', { level: 3, name: 'Selected CAMS Trustee' }),
    ).toBeInTheDocument();
  });

  test('shows every row in both columns, with the trustee name linked', () => {
    renderModal();
    showSelected();

    const sourceText = sourceColumn().textContent;
    ['Jane A. Smith', '555-0000', '1 Court St', 'New York', 'NY', '10001'].forEach((value) =>
      expect(sourceText).toContain(value),
    );
    expect(sourceText).toContain('jane@court.example');

    const selectedText = selectedColumn().textContent;
    ['555-1234 x99', '123 Main St, Suite 200', 'jane@example.com'].forEach((value) =>
      expect(selectedText).toContain(value),
    );
    expect(within(selectedColumn()).getByRole('link', { name: /Jane Smith/ })).toHaveAttribute(
      'href',
      '/trustees/trustee-1',
    );
    expect(screen.queryByText('Exact surname')).not.toBeInTheDocument();
    expect(screen.queryByText(/Found by/)).not.toBeInTheDocument();
  });

  test('omits Email when the rows exclude it', () => {
    renderModal({ rows: acmsRows });
    showSelected();

    expect(sourceColumn().textContent).not.toContain('jane@court.example');
    expect(selectedColumn().textContent).not.toContain('jane@example.com');
  });

  test('shows Not Provided for a missing value', () => {
    renderModal();
    showSelected();

    expect(within(selectedColumn()).getByText('Not Provided')).toBeInTheDocument();
  });

  test('shows Not Provided in the source column for a missing source value', () => {
    const sourceWithoutPhone = { ...source, phone: undefined };
    render(
      <BrowserRouter>
        <TrusteeMatchConfirmationModal
          ref={modalRef}
          id={modalId}
          rows={dxtrRows}
          source={sourceWithoutPhone}
          caseCount={3}
          onConfirm={vi.fn()}
        />
      </BrowserRouter>,
    );
    showSelected();

    expect(within(sourceColumn()).getByText('Not Provided')).toBeInTheDocument();
  });

  test('marks only the selected trustee fields that differ and have a value', () => {
    renderModal();
    showSelected();

    expect(
      within(selectedColumn()).getByRole('img', { name: 'Name differs from the source record' }),
    ).toBeInTheDocument();
    expect(
      within(selectedColumn()).getByRole('img', { name: 'Phone differs from the source record' }),
    ).toBeInTheDocument();
    expect(within(selectedColumn()).getAllByRole('img', { name: /differs/ })).toHaveLength(2);
    expect(within(sourceColumn()).queryAllByRole('img', { name: /differs/ })).toHaveLength(0);
  });

  test('says how many cases will be assigned to the trustee', () => {
    renderModal({ caseCount: 3 });
    showSelected();

    expect(
      screen.getByRole('heading', { level: 3, name: 'What Happens Next' }),
    ).toBeInTheDocument();
    expect(screen.getByText('3 cases will be assigned to Jane Smith.')).toBeInTheDocument();
  });

  test('uses the singular for one case', () => {
    renderModal({ caseCount: 1 });
    showSelected();

    expect(screen.getByText('1 case will be assigned to Jane Smith.')).toBeInTheDocument();
  });

  test('calls onConfirm with the selected trustee when Match Trustee is clicked', async () => {
    const { onConfirm } = renderModal();
    showSelected();

    expect(submitButton()).toHaveTextContent('Match Trustee');
    await waitFor(() => expect(submitButton()).toBeEnabled());
    fireEvent.click(submitButton());

    expect(onConfirm).toHaveBeenCalledWith(selected);
  });

  test('does not call onConfirm when Match Trustee is clicked before show()', () => {
    const { onConfirm } = renderModal();

    fireEvent.click(submitButton());

    expect(onConfirm).not.toHaveBeenCalled();
  });

  test('reads Matching Trustee... and disables both buttons while processing', async () => {
    renderModal({ isProcessing: true });
    showSelected();

    await waitFor(() => expect(submitButton()).toHaveTextContent('Matching Trustee...'));
    expect(submitButton()).toBeDisabled();
    expect(cancelButton()).toBeDisabled();
  });

  test('keeps the preview open on Escape, overlay click, or X while processing', () => {
    renderModal({ isProcessing: true });
    showSelected();

    const wrapper = document.getElementById(`trustee-confirmation-modal-${modalId}-wrapper`);
    expect(wrapper).toHaveClass('is-visible');

    fireEvent.keyDown(screen.getByTestId(`modal-content-trustee-confirmation-modal-${modalId}`), {
      key: 'Escape',
    });
    expect(wrapper).toHaveClass('is-visible');

    fireEvent.click(screen.getByTestId(`modal-overlay-trustee-confirmation-modal-${modalId}`));
    expect(wrapper).toHaveClass('is-visible');

    expect(
      screen.queryByTestId(`modal-x-button-trustee-confirmation-modal-${modalId}`),
    ).not.toBeInTheDocument();
  });

  test('keeps one status region mounted so Matching trustee... is announced when processing starts', () => {
    const { rerender } = renderModal();
    showSelected();

    const status = screen.getByRole('status');
    rerender({ isProcessing: true });

    expect(screen.getByRole('status')).toBe(status);
    expect(status).toHaveTextContent('Matching trustee...');
  });

  test('moves focus into the dialog when processing starts, since the submit button is disabled', async () => {
    const { rerender } = renderModal();
    showSelected();
    await waitFor(() => expect(submitButton()).toBeEnabled());

    submitButton().focus();
    fireEvent.click(submitButton());
    rerender({ isProcessing: true });

    expect(screen.getByRole('status')).toHaveFocus();
    expect(submitButton()).not.toHaveFocus();
  });

  test('announces Matching trustee... in the status region while processing', async () => {
    renderModal({ isProcessing: true });
    showSelected();

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Matching trustee...');
  });

  test('calls onCancel and hides when Cancel is clicked', async () => {
    const onCancel = vi.fn();
    renderModal({ onCancel });
    showSelected();

    await waitFor(() => expect(cancelButton()).toBeEnabled());
    fireEvent.click(cancelButton());

    expect(onCancel).toHaveBeenCalled();
    await waitFor(() =>
      expect(document.getElementById(`trustee-confirmation-modal-${modalId}-wrapper`)).toHaveClass(
        'is-hidden',
      ),
    );
  });
});
