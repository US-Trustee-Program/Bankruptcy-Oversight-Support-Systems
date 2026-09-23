import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Chapter13StandingOtherCard, {
  Chapter13StandingOtherCardProps,
} from './Chapter13StandingOtherCard';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

const mockUseNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: mockUseNavigate,
  };
});

const defaultProps: Chapter13StandingOtherCardProps = {
  trusteeId: 'trustee-001',
  appointmentId: 'appointment-001',
  data: null,
};

const baseDocument: TrusteeUpcomingKeyDates = {
  id: 'doc-001',
  documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
  trusteeId: 'trustee-001',
  appointmentId: 'appointment-001',
  createdBy: SYSTEM_USER_REFERENCE,
  createdOn: '2026-01-01T00:00:00.000Z',
  updatedBy: SYSTEM_USER_REFERENCE,
  updatedOn: '2026-01-01T00:00:00.000Z',
};

function renderComponent(props?: Partial<Chapter13StandingOtherCardProps>) {
  return render(
    <BrowserRouter>
      <Chapter13StandingOtherCard {...defaultProps} {...props} />
    </BrowserRouter>,
  );
}

describe('Chapter13StandingOtherCard', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();
    mockUseNavigate.mockReturnValue(mockNavigate);
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
  });

  test('renders all four fields with "No date added" when data is null', () => {
    renderComponent();
    expect(screen.getByTestId('lease-expiration-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('past-background-question-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('id-expiration-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('last-compensation-study-row')).toHaveTextContent('No date added');
  });

  test('renders formatted values when data is set', () => {
    renderComponent({
      data: {
        ...baseDocument,
        leaseExpiration: '2027-06-30',
        pastBackgroundQuestion: '2025-01-15',
        idExpiration: '2028-01-15',
        lastCompensationStudy: '2024-06-01',
      },
    });
    expect(screen.getByTestId('lease-expiration-row')).toHaveTextContent('06/30/2027');
    expect(screen.getByTestId('past-background-question-row')).toHaveTextContent('01/15/2025');
    expect(screen.getByTestId('id-expiration-row')).toHaveTextContent('01/15/2028');
    expect(screen.getByTestId('last-compensation-study-row')).toHaveTextContent('06/2024');
  });

  test('renders no completion-status tag', () => {
    renderComponent();
    expect(screen.queryByTestId(/tag-/)).not.toBeInTheDocument();
  });

  test('Edit pencil navigates to the dedicated Other edit route when canManage', () => {
    renderComponent();
    screen.getByRole('button', { name: /edit other key dates/i }).click();
    expect(mockNavigate).toHaveBeenCalledWith(
      '/trustees/trustee-001/appointments/appointment-001/chapter13-standing-other-key-dates/edit',
    );
  });

  test('does not render an edit button when user cannot manage trustees', () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);
    renderComponent();
    expect(screen.queryByRole('button', { name: /edit other key dates/i })).not.toBeInTheDocument();
  });
});
