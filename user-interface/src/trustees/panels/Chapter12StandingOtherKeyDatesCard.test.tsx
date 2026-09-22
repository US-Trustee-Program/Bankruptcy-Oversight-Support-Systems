import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import Chapter12StandingOtherKeyDatesCard from './Chapter12StandingOtherKeyDatesCard';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

describe('Chapter12StandingOtherKeyDatesCard', () => {
  const keyDates: TrusteeUpcomingKeyDates = {
    id: 'key-dates-003',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-123',
    appointmentId: 'appointment-001',
    createdOn: '2020-01-10T14:30:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2020-01-10T14:30:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    leaseExpiration: '2023-06-03',
    pastBackgroundQuestion: '2023-06-03',
    idExpiration: '2023-06-03',
  };

  function renderCard(data: TrusteeUpcomingKeyDates | null = keyDates, isLoading = false) {
    return render(
      <Chapter12StandingOtherKeyDatesCard
        trusteeId="trustee-123"
        appointmentId="appointment-001"
        data={data}
        isLoading={isLoading}
      />,
    );
  }

  test('renders the Other title and all four columns', () => {
    renderCard();

    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.getByTestId('annual-report-due-row')).toHaveTextContent(
      '09/30 (Due non-audit years)',
    );
    expect(screen.getByTestId('lease-expiration-row')).toHaveTextContent('06/03/2023');
    expect(screen.getByTestId('past-background-question-row')).toHaveTextContent('06/03/2023');
    expect(screen.getByTestId('id-expiration-row')).toHaveTextContent('06/03/2023');
  });

  test('shows "No date added" for the editable fields when there is no key dates document', () => {
    renderCard(null);

    expect(screen.getByTestId('lease-expiration-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('past-background-question-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('id-expiration-row')).toHaveTextContent('No date added');
  });

  test('always shows the fixed Annual Report Due to OO value, even with no data', () => {
    renderCard(null);

    expect(screen.getByTestId('annual-report-due-row')).toHaveTextContent(
      '09/30 (Due non-audit years)',
    );
  });

  test('shows a loading spinner while loading', () => {
    renderCard(null, true);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Other')).not.toBeInTheDocument();
  });

  test('never renders a completion-status tag or an edit button', () => {
    renderCard();

    expect(screen.queryAllByTestId(/^tag-/)).toHaveLength(0);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
