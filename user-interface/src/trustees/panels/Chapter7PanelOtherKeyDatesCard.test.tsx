import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import Chapter7PanelOtherKeyDatesCard from './Chapter7PanelOtherKeyDatesCard';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

describe('Chapter7PanelOtherKeyDatesCard', () => {
  const keyDates: TrusteeUpcomingKeyDates = {
    id: 'key-dates-006',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-123',
    appointmentId: 'appointment-001',
    createdOn: '2020-01-10T14:30:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2020-01-10T14:30:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    pastBackgroundQuestion: '2023-06-03',
  };

  function renderCard(data: TrusteeUpcomingKeyDates | null = keyDates, isLoading = false) {
    return render(
      <Chapter7PanelOtherKeyDatesCard
        trusteeId="trustee-123"
        appointmentId="appointment-001"
        data={data}
        isLoading={isLoading}
      />,
    );
  }

  test('renders the Other title and the Background Questionnaire column', () => {
    renderCard();

    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.getByTestId('past-background-question-row')).toHaveTextContent('06/03/2023');
  });

  test('shows "No date added" when there is no key dates document', () => {
    renderCard(null);

    expect(screen.getByTestId('past-background-question-row')).toHaveTextContent('No date added');
  });

  test('shows a loading spinner while loading', () => {
    renderCard(null, true);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Other')).not.toBeInTheDocument();
  });

  test('renders with no Edit button', () => {
    renderCard();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
