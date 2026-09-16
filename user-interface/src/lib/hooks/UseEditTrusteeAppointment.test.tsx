import { renderHook } from '@testing-library/react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import useEditTrusteeAppointment from './UseEditTrusteeAppointment';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { CamsRole } from '@common/cams/roles';
import TestingUtilities from '@/lib/testing/testing-utilities';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

describe('useEditTrusteeAppointment', () => {
  const mockAppointment: TrusteeAppointment = {
    id: 'appointment-001',
    trusteeId: 'trustee-123',
    chapter: '11',
    appointmentType: 'case-by-case',
    courtId: '0208',
    courtName: 'Southern District of New York',
    status: 'active',
    appointedDate: '2020-01-15T00:00:00.000Z',
    effectiveDate: '2020-01-15T00:00:00.000Z',
    createdOn: '2020-01-10T14:30:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2020-01-10T14:30:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
  });

  function renderTheHook(appointment: TrusteeAppointment = mockAppointment) {
    return renderHook(() => useEditTrusteeAppointment(appointment), { wrapper: BrowserRouter });
  }

  test('canManage is true when the user has the TrusteeAdmin role', () => {
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);

    const { result } = renderTheHook();

    expect(result.current.canManage).toBe(true);
  });

  test('canManage is false when the user lacks the TrusteeAdmin role', () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

    const { result } = renderTheHook();

    expect(result.current.canManage).toBe(false);
  });

  test('openEditTrustee navigates to the appointment edit page', () => {
    const { result } = renderTheHook();

    result.current.openEditTrustee();

    expect(mockNavigate).toHaveBeenCalledWith(
      `/trustees/${mockAppointment.trusteeId}/appointments/${mockAppointment.id}/edit`,
    );
  });
});
