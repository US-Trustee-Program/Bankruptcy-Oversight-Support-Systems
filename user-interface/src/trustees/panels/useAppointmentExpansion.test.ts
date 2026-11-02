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

  test('an active appointment is collapsed by default when the trustee has multiple appointments', () => {
    const appointment = makeAppointment('appt-1', { status: 'active' });
    const { result } = renderHook(() => useAppointmentExpansion('trustee-123', 2));

    expect(result.current.isExpanded(appointment)).toBe(false);
  });

  test('an inactive appointment is collapsed by default when the trustee has multiple appointments', () => {
    const appointment = makeAppointment('appt-1', { status: 'inactive' });
    const { result } = renderHook(() => useAppointmentExpansion('trustee-123', 2));

    expect(result.current.isExpanded(appointment)).toBe(false);
  });

  test('toggling one appointment does not affect another appointment', () => {
    const active = makeAppointment('active-1', { status: 'active' });
    const inactive = makeAppointment('inactive-1', { status: 'inactive' });
    const { result } = renderHook(() => useAppointmentExpansion('trustee-123', 2));

    act(() => {
      result.current.toggleExpanded(inactive);
    });

    expect(result.current.isExpanded(active)).toBe(false);
    expect(result.current.isExpanded(inactive)).toBe(true);
  });

  test('toggling a collapsed appointment expands it, toggling again collapses it', () => {
    const active = makeAppointment('active-1', { status: 'active' });
    const { result } = renderHook(() => useAppointmentExpansion('trustee-123', 2));

    expect(result.current.isExpanded(active)).toBe(false);

    act(() => {
      result.current.toggleExpanded(active);
    });
    expect(result.current.isExpanded(active)).toBe(true);

    act(() => {
      result.current.toggleExpanded(active);
    });
    expect(result.current.isExpanded(active)).toBe(false);
  });

  test('an appointment stays expanded after its status changes once explicitly toggled', () => {
    const inactive = makeAppointment('appt-1', { status: 'inactive' });
    const { result } = renderHook(() => useAppointmentExpansion('trustee-123', 2));

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
      useAppointmentExpansion('trustee-123', 2),
    );
    expect(firstResult.current.isExpanded(inactive)).toBe(false);

    act(() => {
      firstResult.current.toggleExpanded(inactive);
    });
    expect(firstResult.current.isExpanded(inactive)).toBe(true);

    unmountFirst();

    const { result: secondResult } = renderHook(() => useAppointmentExpansion('trustee-123', 2));
    expect(secondResult.current.isExpanded(inactive)).toBe(true);
  });

  test('persisted expansion state does not leak across different trustees', () => {
    const inactive = makeAppointment('appt-1', { status: 'inactive' });

    const { result: trusteeAResult, unmount: unmountTrusteeA } = renderHook(() =>
      useAppointmentExpansion('trustee-a', 2),
    );
    act(() => {
      trusteeAResult.current.toggleExpanded(inactive);
    });
    expect(trusteeAResult.current.isExpanded(inactive)).toBe(true);
    unmountTrusteeA();

    const { result: trusteeBResult } = renderHook(() => useAppointmentExpansion('trustee-b', 2));
    expect(trusteeBResult.current.isExpanded(inactive)).toBe(false);
  });

  test('toggling two different appointments in the same update batch updates both independently', () => {
    const inactiveOne = makeAppointment('inactive-1', { status: 'inactive' });
    const inactiveTwo = makeAppointment('inactive-2', { status: 'inactive' });
    const { result } = renderHook(() => useAppointmentExpansion('trustee-123', 2));

    // Fire both toggles within a single update batch so a closure-captured
    // (rather than functional) state update would drop one of them.
    act(() => {
      result.current.toggleExpanded(inactiveOne);
      result.current.toggleExpanded(inactiveTwo);
    });

    expect(result.current.isExpanded(inactiveOne)).toBe(true);
    expect(result.current.isExpanded(inactiveTwo)).toBe(true);
  });
  describe('count-based default', () => {
    const STORAGE_KEY = 'appointment-expansion-trustee-123';
    const appointment = makeAppointment('appt-1');

    function renderWithCount(appointmentCount: number) {
      return renderHook(({ count }) => useAppointmentExpansion('trustee-123', count), {
        initialProps: { count: appointmentCount },
      });
    }

    test.each([
      { count: 0, expected: false },
      { count: 1, expected: true },
      { count: 2, expected: false },
    ])(
      'with $count appointment(s) and no stored choice, isExpanded is $expected',
      ({ count, expected }) => {
        const { result } = renderWithCount(count);

        expect(result.current.isExpanded(appointment)).toBe(expected);
      },
    );

    test('a lone appointment collapses on the first toggle and stores the explicit choice', () => {
      const { result } = renderWithCount(1);

      act(() => {
        result.current.toggleExpanded(appointment);
      });

      expect(result.current.isExpanded(appointment)).toBe(false);
      expect(sessionStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ 'appt-1': false }));
    });

    test('a collapsed lone appointment stays collapsed after remount', () => {
      const { result: beforeNavigation, unmount } = renderWithCount(1);
      act(() => {
        beforeNavigation.current.toggleExpanded(appointment);
      });
      unmount();

      const { result } = renderWithCount(1);

      expect(result.current.isExpanded(appointment)).toBe(false);
    });

    test('a default expansion is never persisted', () => {
      const { result } = renderWithCount(1);

      expect(result.current.isExpanded(appointment)).toBe(true);
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    test('an untouched default-expanded appointment collapses when the count grows to 2', () => {
      const { result, rerender } = renderWithCount(1);
      expect(result.current.isExpanded(appointment)).toBe(true);

      rerender({ count: 2 });

      expect(result.current.isExpanded(appointment)).toBe(false);
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    test.each([
      { count: 2, stored: true },
      { count: 1, stored: false },
    ])(
      'a stored choice of $stored wins over the default for $count appointment(s)',
      ({ count, stored }) => {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ 'appt-1': stored }));

        const { result } = renderWithCount(count);

        expect(result.current.isExpanded(appointment)).toBe(stored);
      },
    );
  });
});
