import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TrusteeMatchConfirmationModal, {
  TrusteeMatchConfirmationModalImperative,
} from './TrusteeMatchConfirmationModal';
import { ComparisonRow, ComparisonRowKey, SelectedTrustee } from './trustee-comparison';
import Api2 from '@/lib/models/api2';
import {
  AppointmentTaskPreviewGroup,
  EnrichedTrusteeMatchVerification,
} from '@common/cams/trustee-match-verification';

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
  source?: Record<ComparisonRowKey, string | undefined>;
};

describe('TrusteeMatchConfirmationModal', () => {
  let modalRef: React.RefObject<TrusteeMatchConfirmationModalImperative | null>;

  function modalTree(options: RenderOptions, onConfirm: (selected: SelectedTrustee) => void) {
    return (
      <BrowserRouter>
        <TrusteeMatchConfirmationModal
          ref={modalRef}
          id={modalId}
          rows={options.rows ?? dxtrRows}
          source={options.source ?? source}
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

  function mockPreview(appointmentTaskPreview?: AppointmentTaskPreviewGroup[]) {
    return vi.spyOn(Api2, 'getTrusteeMatchVerificationDetail').mockResolvedValue({
      data: { appointmentTaskPreview } as EnrichedTrusteeMatchVerification,
    } as never);
  }

  const stLouisChapter7: AppointmentTaskPreviewGroup = {
    courtId: '081',
    courtDivisionCode: '081',
    courtName: 'Eastern District of Missouri',
    courtDivisionName: 'St. Louis',
    chapter: '7',
    caseCount: 1,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockPreview();
    modalRef = React.createRef<TrusteeMatchConfirmationModalImperative>();
  });

  test('renders no trustee content before show() is called', () => {
    renderModal();
    expect(screen.queryByTestId('confirm-match-selected')).not.toBeInTheDocument();
    expect(screen.queryByTestId('confirm-match-source')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Is this the same trustee as the information sent to CAMS?'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 3, name: 'What Happens Next' }),
    ).not.toBeInTheDocument();
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
    renderModal({ source: { ...source, phone: undefined } });
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

  test('places the difference marker before the value it flags, matching the comparison table', () => {
    renderModal();
    showSelected();

    const marker = within(selectedColumn()).getByRole('img', {
      name: 'Name differs from the source record',
    });
    const nameLink = within(selectedColumn()).getByRole('link', { name: /Jane Smith/ });
    expect(
      marker.compareDocumentPosition(nameLink) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test.each([
    { caseCount: 3, expected: '3 cases will be assigned to Jane Smith.' },
    { caseCount: 1, expected: '1 case will be assigned to Jane Smith.' },
    {
      caseCount: 0,
      expected:
        'No cases are affected yet. Future cases sent with this information will be matched to Jane Smith automatically.',
    },
  ])(
    'shows the correct case-assignment sentence for caseCount=$caseCount',
    ({ caseCount, expected }) => {
      renderModal({ caseCount });
      showSelected();

      expect(
        screen.getByRole('heading', { level: 3, name: 'What Happens Next' }),
      ).toBeInTheDocument();
      expect(screen.getByText(expected)).toBeInTheDocument();
    },
  );

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

  test('forwards isProcessing to Modal as forceAction', () => {
    renderModal({ isProcessing: true });
    showSelected();

    expect(
      screen.getByTestId(`modal-content-trustee-confirmation-modal-${modalId}`),
    ).toHaveAttribute('data-force-action', 'true');
  });

  test('keeps one status region mounted so Matching trustee... is announced when processing starts', async () => {
    const { rerender } = renderModal();
    showSelected();
    await waitFor(() =>
      expect(screen.queryByText('Checking appointments...')).not.toBeInTheDocument(),
    );

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

  test('still hides on Cancel when onCancel is not provided', async () => {
    renderModal();
    showSelected();

    await waitFor(() => expect(cancelButton()).toBeEnabled());
    fireEvent.click(cancelButton());

    await waitFor(() =>
      expect(document.getElementById(`trustee-confirmation-modal-${modalId}-wrapper`)).toHaveClass(
        'is-hidden',
      ),
    );
  });

  test('hides when the imperative handle hide() is called directly, as the real approval caller does', async () => {
    renderModal();
    showSelected();

    await waitFor(() =>
      expect(
        document.getElementById(`trustee-confirmation-modal-${modalId}-wrapper`),
      ).not.toHaveClass('is-hidden'),
    );

    act(() => modalRef.current?.hide());

    await waitFor(() =>
      expect(document.getElementById(`trustee-confirmation-modal-${modalId}-wrapper`)).toHaveClass(
        'is-hidden',
      ),
    );
  });

  test('forwards show() options (openModalButtonRef) to Modal for focus return on hide', async () => {
    const openerRef = React.createRef<HTMLButtonElement>();
    render(
      <BrowserRouter>
        <button ref={openerRef}>Open</button>
        <TrusteeMatchConfirmationModal
          ref={modalRef}
          id={modalId}
          rows={dxtrRows}
          source={source}
          caseCount={3}
          onConfirm={vi.fn()}
        />
      </BrowserRouter>,
    );

    act(() => modalRef.current?.show(selected, { openModalButtonRef: openerRef }));

    await waitFor(() => expect(cancelButton()).toBeEnabled());
    fireEvent.click(cancelButton());

    await waitFor(() => expect(openerRef.current).toHaveFocus());
  });
  describe('appointment task preview', () => {
    test('requests the preview for the selected trustee when shown', async () => {
      const preview = mockPreview();
      renderModal();
      showSelected();

      await waitFor(() => expect(preview).toHaveBeenCalledWith(modalId, 'trustee-1'));
    });

    test('names the appointment task the match will create', async () => {
      mockPreview([stLouisChapter7]);
      renderModal({ caseCount: 1 });
      showSelected();

      expect(
        await screen.findByText(
          '1 case in Eastern District of Missouri (St. Louis), Chapter 7 will become a Trustee Appointment task.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByText('1 case will be assigned to Jane Smith.')).toBeInTheDocument();
    });

    test('lists the assignment and each appointment task as bullets when there are several outcomes', async () => {
      mockPreview([stLouisChapter7, { ...stLouisChapter7, chapter: '13', caseCount: 2 }]);
      renderModal({ caseCount: 3 });
      showSelected();

      await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(3));
      expect(screen.getAllByRole('listitem')[2]).toHaveTextContent(
        '2 cases in Eastern District of Missouri (St. Louis), Chapter 13 will become a Trustee Appointment task.',
      );
    });

    test('keeps the single sentence, with no bullets, when there is nothing to preview', async () => {
      const preview = mockPreview([]);
      renderModal({ caseCount: 3 });
      showSelected();

      await waitFor(() => expect(preview).toHaveBeenCalled());
      expect(screen.getByText('3 cases will be assigned to Jane Smith.')).toBeInTheDocument();
      expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    });

    test('falls back to the court id wording when the court name is unknown', async () => {
      mockPreview([{ ...stLouisChapter7, courtName: undefined, courtDivisionName: undefined }]);
      renderModal();
      showSelected();

      expect(
        await screen.findByText(
          '1 case in this court, Chapter 7 will become a Trustee Appointment task.',
        ),
      ).toBeInTheDocument();
    });

    test('shows a loading state until the preview resolves', async () => {
      let resolve!: (value: never) => void;
      vi.spyOn(Api2, 'getTrusteeMatchVerificationDetail').mockReturnValue(
        new Promise<never>((r) => {
          resolve = r;
        }),
      );
      renderModal();
      showSelected();

      expect(screen.getByText('Checking appointments...')).toBeInTheDocument();

      await act(async () => resolve({ data: { appointmentTaskPreview: [] } } as never));
      expect(screen.queryByText('Checking appointments...')).not.toBeInTheDocument();
    });

    test('still shows the assignment sentence and allows confirming when the preview fails', async () => {
      vi.spyOn(Api2, 'getTrusteeMatchVerificationDetail').mockRejectedValue(new Error('boom'));
      const { onConfirm } = renderModal({ caseCount: 2 });
      showSelected();

      await waitFor(() =>
        expect(screen.queryByText('Checking appointments...')).not.toBeInTheDocument(),
      );
      expect(screen.getByText('2 cases will be assigned to Jane Smith.')).toBeInTheDocument();
      fireEvent.click(submitButton());
      expect(onConfirm).toHaveBeenCalledWith(selected);
    });

    test('does not show a previous trustee preview for a newly selected trustee', async () => {
      mockPreview([stLouisChapter7]);
      renderModal();
      showSelected();
      await screen.findByText(/will become a Trustee Appointment task/);

      mockPreview([]);
      act(() => modalRef.current?.show({ ...selected, trusteeId: 'trustee-2' }));

      await waitFor(() =>
        expect(
          screen.queryByText(/will become a Trustee Appointment task/),
        ).not.toBeInTheDocument(),
      );
    });
  });
});
