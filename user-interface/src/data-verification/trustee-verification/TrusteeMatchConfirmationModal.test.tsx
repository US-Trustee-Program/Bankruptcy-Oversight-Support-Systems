import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TrusteeMatchConfirmationModal, {
  TrusteeMatchConfirmationModalImperative,
} from './TrusteeMatchConfirmationModal';
import { CandidateScore } from '@common/cams/dataflow-events';
import MockData from '@common/cams/test-utilities/mock-data';

const modalId = 'test-order-id';

const sampleCandidate: CandidateScore = {
  trusteeId: 'trustee-1',
  trusteeName: 'Jane Smith',
  totalScore: 95,
  addressScore: 90,
  districtDivisionScore: 100,
  chapterScore: 95,
  address: {
    address1: '123 Main St',
    address2: 'Suite 200',
    city: 'New York',
    state: 'NY',
    zipCode: '10001',
    countryCode: 'US',
  },
  phone: { number: '555-1234', extension: '99' },
  email: 'jane@example.com',
  appointments: [
    MockData.getTrusteeAppointment({
      courtName: 'Southern District',
      courtDivisionName: 'Manhattan',
    }),
  ],
};

describe('TrusteeMatchConfirmationModal', () => {
  const modalRef = React.createRef<TrusteeMatchConfirmationModalImperative>();

  function renderWithProps(onConfirm = vi.fn(), onCancel = vi.fn()) {
    render(
      <BrowserRouter>
        <TrusteeMatchConfirmationModal
          ref={modalRef}
          id={modalId}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      </BrowserRouter>,
    );
    return { onConfirm, onCancel };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders without candidate content before show() is called', () => {
    renderWithProps();
    expect(screen.queryByText(/Are you sure you want to confirm/)).not.toBeInTheDocument();
  });

  test('shows heading and candidate name after show() is called', async () => {
    renderWithProps();
    act(() => modalRef.current?.show(sampleCandidate));

    await waitFor(() => {
      expect(document.querySelector('.usa-modal__heading')).toHaveTextContent('Confirm Trustee');
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  test('shows candidate address, phone, and email after show() is called', async () => {
    renderWithProps();
    act(() => modalRef.current?.show(sampleCandidate));

    await waitFor(() => {
      const content = document.querySelector('.usa-modal__main');
      expect(content?.textContent).toContain('123 Main St');
      expect(content?.textContent).toContain('Suite 200');
      expect(content?.textContent).toContain('New York, NY 10001');
      expect(content?.textContent).toContain('555-1234 x99');
      expect(content?.textContent).toContain('jane@example.com');
    });
  });

  test('shows candidate appointments after show() is called', async () => {
    renderWithProps();
    act(() => modalRef.current?.show(sampleCandidate));

    await waitFor(() => {
      const content = document.querySelector('.usa-modal__main');
      expect(content?.textContent).toContain('Southern District');
    });
  });

  test('calls onConfirm with the candidate when Confirm Appointment is clicked', async () => {
    const { onConfirm } = renderWithProps();
    act(() => modalRef.current?.show(sampleCandidate));

    const submitButton = screen.getByTestId(
      `button-trustee-confirmation-modal-${modalId}-submit-button`,
    );
    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith(sampleCandidate);
    });
  });

  test('calls onCancel when Cancel button is clicked', async () => {
    const { onCancel } = renderWithProps();
    act(() => modalRef.current?.show(sampleCandidate));

    const cancelButton = screen.getByTestId(
      `button-trustee-confirmation-modal-${modalId}-cancel-button`,
    );
    await waitFor(() => expect(cancelButton).toBeEnabled());
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(onCancel).toHaveBeenCalled();
    });
  });

  test('shows candidate without address or phone when those fields are absent', async () => {
    const minimalCandidate: CandidateScore = {
      trusteeId: 'trustee-2',
      trusteeName: 'Bob Jones',
      totalScore: 80,
      addressScore: 80,
      districtDivisionScore: 80,
      chapterScore: 80,
    };
    renderWithProps();
    act(() => modalRef.current?.show(minimalCandidate));

    await waitFor(() => {
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    });
  });
});
