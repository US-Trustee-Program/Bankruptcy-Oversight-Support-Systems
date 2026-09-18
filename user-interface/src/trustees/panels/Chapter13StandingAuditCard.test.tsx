import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Chapter13StandingAuditCard, {
  Chapter13StandingAuditCardProps,
} from './Chapter13StandingAuditCard';
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

const defaultProps: Chapter13StandingAuditCardProps = {
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

function renderComponent(props?: Partial<Chapter13StandingAuditCardProps>) {
  return render(
    <BrowserRouter>
      <Chapter13StandingAuditCard {...defaultProps} {...props} />
    </BrowserRouter>,
  );
}

describe('Chapter13StandingAuditCard', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseNavigate.mockReturnValue(mockNavigate);
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
  });

  test('renders the Annual Audit Period constant', () => {
    renderComponent();
    expect(screen.getByTestId('annual-audit-period-row')).toHaveTextContent('Annual Audit Period');
    expect(screen.getByTestId('annual-audit-period-row')).toHaveTextContent('10/01 - 09/30');
  });

  test('renders "No date added" for Last Audit Report when data is null', () => {
    renderComponent();
    expect(screen.getByTestId('past-audit-row')).toHaveTextContent('No date added');
  });

  test('renders formatted Last Audit Report when pastAudit is set', () => {
    renderComponent({ data: { ...baseDocument, pastAudit: '2025-06-30' } });
    expect(screen.getByTestId('past-audit-row')).toHaveTextContent('06/30/2025');
  });

  test('renders no completion-status tag when auditCompletionYear/Status are unset', () => {
    renderComponent();
    expect(screen.queryByTestId('tag-audit-completion-status')).not.toBeInTheDocument();
  });

  test('renders a green "Complete for {year}" tag when auditCompletionStatus is Complete', () => {
    renderComponent({
      data: { ...baseDocument, auditCompletionYear: 2026, auditCompletionStatus: 'Complete' },
    });
    const tag = screen.getByTestId('tag-audit-completion-status');
    expect(tag).toHaveTextContent('Complete for 2026');
    expect(tag.className).toContain('bg-success');
  });

  test('renders a red "Incomplete for {year}" tag when auditCompletionStatus is Incomplete', () => {
    renderComponent({
      data: { ...baseDocument, auditCompletionYear: 2026, auditCompletionStatus: 'Incomplete' },
    });
    const tag = screen.getByTestId('tag-audit-completion-status');
    expect(tag).toHaveTextContent('Incomplete for 2026');
    expect(tag).toHaveStyle({ backgroundColor: '#B50909' });
  });

  test('Edit pencil navigates to the dedicated Audit edit route when canManage', () => {
    renderComponent();
    screen.getByRole('button', { name: /edit audit key dates/i }).click();
    expect(mockNavigate).toHaveBeenCalledWith(
      '/trustees/trustee-001/appointments/appointment-001/chapter13-standing-audit-key-dates/edit',
      { state: { subHeading: '' } },
    );
  });

  test('does not render an edit button when user cannot manage trustees', () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);
    renderComponent();
    expect(screen.queryByRole('button', { name: /edit audit key dates/i })).not.toBeInTheDocument();
  });
});
