import { act, renderHook } from '@testing-library/react';
import { useAppointmentExpansion } from './useAppointmentExpansion';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

const baseAppointment: Omit<TrusteeAppointment, 'id'> = {
  trusteeId: 'trustee-123',
  chapter: '11',
  appointmentType: 'case-by-case',
  courtId: '081',
  courtDivisionName: undefined,
  courtName: 'Southern District of New York',
  divisionCode: '1',
  status: 'active',
  appointedDate: '2020-01-15T00:00:00.000Z',
  effectiveDate: '2020-01-15T00:00:00.000Z',
  createdOn: '2020-01-10T14:30:00.000Z',
  createdBy: SYSTEM_USER_REFERENCE,
  updatedOn: '2020-01-10T14:30:00.000Z',
  updatedBy: SYSTEM_USER_REFERENCE,
};

const makeAppointment = (
  id: string,
  overrides: Partial<TrusteeAppointment> = {},
): TrusteeAppointment => ({
  id,
  ...baseAppointment,
  ...overrides,
});

describe('useAppointmentExpansion', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  test.each([['active' as const], ['inactive' as const]])(
    'a %s appointment is collapsed by default',
    (status) => {
      const appointment = makeAppointment('appt-1', { status });
      const { result } = renderHook(() => useAppointmentExpansion('trustee-123'));

      expect(result.current.isExpanded(appointment)).toBe(false);
    },
  );

  test('toggling one appointment does not affect another appointment', () => {
    const active = makeAppointment('active-1', { status: 'active' });
    const inactive = makeAppointment('inactive-1', { status: 'inactive' });
    const { result } = renderHook(() => useAppointmentExpansion('trustee-123'));

    act(() => {
      result.current.toggleExpanded(inactive.id);
    });

    expect(result.current.isExpanded(active)).toBe(false);
    expect(result.current.isExpanded(inactive)).toBe(true);
  });

  test('toggling a collapsed appointment expands it, toggling again collapses it', () => {
    const active = makeAppointment('active-1', { status: 'active' });
    const { result } = renderHook(() => useAppointmentExpansion('trustee-123'));

    act(() => {
      result.current.toggleExpanded(active.id);
    });
    expect(result.current.isExpanded(active)).toBe(true);

    act(() => {
      result.current.toggleExpanded(active.id);
    });
    expect(result.current.isExpanded(active)).toBe(false);
  });

  test('an appointment stays expanded after its status changes', () => {
    const active = makeAppointment('appt-1', { status: 'active' });
    const { result } = renderHook(() => useAppointmentExpansion('trustee-123'));

    act(() => {
      result.current.toggleExpanded(active.id);
    });
    expect(result.current.isExpanded(active)).toBe(true);

    const inactive = { ...active, status: 'inactive' as const };
    expect(result.current.isExpanded(inactive)).toBe(true);
  });

  test('toggling an appointment persists its expand state across a simulated remount within the same session', () => {
    const inactive = makeAppointment('appt-1', { status: 'inactive' });

    const { result: firstResult, unmount: unmountFirst } = renderHook(() =>
      useAppointmentExpansion('trustee-123'),
    );
    expect(firstResult.current.isExpanded(inactive)).toBe(false);

    act(() => {
      firstResult.current.toggleExpanded(inactive.id);
    });
    expect(firstResult.current.isExpanded(inactive)).toBe(true);

    unmountFirst();

    const { result: secondResult } = renderHook(() => useAppointmentExpansion('trustee-123'));
    expect(secondResult.current.isExpanded(inactive)).toBe(true);
  });

  test('expansion state is isolated per trusteeId', () => {
    const appointment = makeAppointment('appt-1', { status: 'active' });

    const { result: trusteeAResult } = renderHook(() => useAppointmentExpansion('trustee-A'));
    act(() => {
      trusteeAResult.current.toggleExpanded(appointment.id);
    });
    expect(trusteeAResult.current.isExpanded(appointment)).toBe(true);

    const { result: trusteeBResult } = renderHook(() => useAppointmentExpansion('trustee-B'));
    expect(trusteeBResult.current.isExpanded(appointment)).toBe(false);
  });

  test('toggling two different appointments in the same update batch updates both independently', () => {
    const inactiveOne = makeAppointment('inactive-1', { status: 'inactive' });
    const inactiveTwo = makeAppointment('inactive-2', { status: 'inactive' });
    const { result } = renderHook(() => useAppointmentExpansion('trustee-123'));

    // Fire both toggles within a single update batch so a closure-captured
    // (rather than functional) state update would drop one of them.
    act(() => {
      result.current.toggleExpanded(inactiveOne.id);
      result.current.toggleExpanded(inactiveTwo.id);
    });

    expect(result.current.isExpanded(inactiveOne)).toBe(true);
    expect(result.current.isExpanded(inactiveTwo)).toBe(true);
  });
});
