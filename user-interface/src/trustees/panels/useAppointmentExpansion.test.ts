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
    sessionStorage.clear();
  });

  test('an active appointment is expanded by default', () => {
    const appointment = makeAppointment('appt-1', { status: 'active' });
    const { result } = renderHook(() => useAppointmentExpansion('trustee-123'));

    expect(result.current.isExpanded(appointment)).toBe(true);
  });

  test('an inactive appointment is collapsed by default', () => {
    const appointment = makeAppointment('appt-1', { status: 'inactive' });
    const { result } = renderHook(() => useAppointmentExpansion('trustee-123'));

    expect(result.current.isExpanded(appointment)).toBe(false);
  });

  test('toggling one appointment does not affect another appointment', () => {
    const active = makeAppointment('active-1', { status: 'active' });
    const inactive = makeAppointment('inactive-1', { status: 'inactive' });
    const { result } = renderHook(() => useAppointmentExpansion('trustee-123'));

    act(() => {
      result.current.toggleExpanded(inactive);
    });

    expect(result.current.isExpanded(active)).toBe(true);
    expect(result.current.isExpanded(inactive)).toBe(true);
  });

  test('toggling an expanded appointment collapses it, toggling again expands it', () => {
    const active = makeAppointment('active-1', { status: 'active' });
    const { result } = renderHook(() => useAppointmentExpansion('trustee-123'));

    expect(result.current.isExpanded(active)).toBe(true);

    act(() => {
      result.current.toggleExpanded(active);
    });
    expect(result.current.isExpanded(active)).toBe(false);

    act(() => {
      result.current.toggleExpanded(active);
    });
    expect(result.current.isExpanded(active)).toBe(true);
  });

  test('an appointment stays expanded after its status changes once explicitly toggled', () => {
    const inactive = makeAppointment('appt-1', { status: 'inactive' });
    const { result } = renderHook(() => useAppointmentExpansion('trustee-123'));

    act(() => {
      result.current.toggleExpanded(inactive);
    });
    expect(result.current.isExpanded(inactive)).toBe(true);

    const nowActive = { ...inactive, status: 'active' as const };
    expect(result.current.isExpanded(nowActive)).toBe(true);
  });

  test('an appointment expanded/collapsed before navigating away keeps that state on return', () => {
    const inactive = makeAppointment('appt-1', { status: 'inactive' });

    const { result: firstResult, unmount: unmountFirst } = renderHook(() =>
      useAppointmentExpansion('trustee-123'),
    );
    expect(firstResult.current.isExpanded(inactive)).toBe(false);

    act(() => {
      firstResult.current.toggleExpanded(inactive);
    });
    expect(firstResult.current.isExpanded(inactive)).toBe(true);

    unmountFirst();

    const { result: secondResult } = renderHook(() => useAppointmentExpansion('trustee-123'));
    expect(secondResult.current.isExpanded(inactive)).toBe(true);
  });

  test('persisted expansion state does not leak across different trustees', () => {
    const inactive = makeAppointment('appt-1', { status: 'inactive' });

    const { result: trusteeAResult, unmount: unmountTrusteeA } = renderHook(() =>
      useAppointmentExpansion('trustee-a'),
    );
    act(() => {
      trusteeAResult.current.toggleExpanded(inactive);
    });
    expect(trusteeAResult.current.isExpanded(inactive)).toBe(true);
    unmountTrusteeA();

    const { result: trusteeBResult } = renderHook(() => useAppointmentExpansion('trustee-b'));
    expect(trusteeBResult.current.isExpanded(inactive)).toBe(false);
  });

  test('toggling two different appointments in the same update batch updates both independently', () => {
    const inactiveOne = makeAppointment('inactive-1', { status: 'inactive' });
    const inactiveTwo = makeAppointment('inactive-2', { status: 'inactive' });
    const { result } = renderHook(() => useAppointmentExpansion('trustee-123'));

    // Fire both toggles within a single update batch so a closure-captured
    // (rather than functional) state update would drop one of them.
    act(() => {
      result.current.toggleExpanded(inactiveOne);
      result.current.toggleExpanded(inactiveTwo);
    });

    expect(result.current.isExpanded(inactiveOne)).toBe(true);
    expect(result.current.isExpanded(inactiveTwo)).toBe(true);
  });
});
