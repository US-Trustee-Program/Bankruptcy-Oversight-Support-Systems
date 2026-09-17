import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import Chapter7PanelTrusteeInterimReportCard from './Chapter7PanelTrusteeInterimReportCard';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

describe('Chapter7PanelTrusteeInterimReportCard', () => {
  const keyDates: TrusteeUpcomingKeyDates = {
    id: 'key-dates-005',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-123',
    appointmentId: 'appointment-001',
    createdOn: '2020-01-10T14:30:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2020-01-10T14:30:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    tirReviewPeriodStart: '1900-01-01',
    tirReviewPeriodEnd: '1900-03-31',
    tirSubmission: '2026-01-30',
    tirReview: '2026-03-30',
    pastTprSubmission: '2026-06-06',
  };

  function renderCard(data: TrusteeUpcomingKeyDates | null = keyDates, isLoading = false) {
    return render(
      <Chapter7PanelTrusteeInterimReportCard
        trusteeId="trustee-123"
        appointmentId="appointment-001"
        data={data}
        isLoading={isLoading}
      />,
    );
  }

  test('renders the Trustee Interim Report title and all four columns', () => {
    renderCard();

    expect(screen.getByText('Trustee Interim Report')).toBeInTheDocument();
    expect(screen.getByTestId('tir-review-period-row')).toBeInTheDocument();
    expect(screen.getByTestId('tir-submission-row')).toHaveTextContent('01/30');
    expect(screen.getByTestId('tir-review-row')).toHaveTextContent('03/30');
    expect(screen.getByTestId('past-tpr-submission-row')).toHaveTextContent('06/06/2026');
  });

  test('labels the TIR Due column "TIR Due" even though the underlying field is tirReview', () => {
    renderCard();

    expect(screen.getByText('TIR Due')).toBeInTheDocument();
  });

  test('shows "No date added" for all fields when there is no key dates document', () => {
    renderCard(null);

    expect(screen.getByTestId('tir-review-period-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('tir-submission-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('tir-review-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('past-tpr-submission-row')).toHaveTextContent('No date added');
  });

  test('shows a loading spinner while loading', () => {
    renderCard(null, true);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Trustee Interim Report')).not.toBeInTheDocument();
  });

  test('renders with no Edit button', () => {
    renderCard();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
