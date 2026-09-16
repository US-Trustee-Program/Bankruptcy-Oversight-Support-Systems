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

  test('an active appointment is expanded by default', () => {
    const active = makeAppointment('active-1', { status: 'active' });
    const { result } = renderHook(() => useAppointmentExpansion('trustee-123', [active]));

    expect(result.current.isExpanded(active)).toBe(true);
  });

  test('a non-active appointment is collapsed by default', () => {
    const inactive = makeAppointment('inactive-1', { status: 'inactive' });
    const { result } = renderHook(() => useAppointmentExpansion('trustee-123', [inactive]));

    expect(result.current.isExpanded(inactive)).toBe(false);
  });

  test('multiple active appointments are each expanded by default', () => {
    const activeOne = makeAppointment('active-1', { status: 'active' });
    const activeTwo = makeAppointment('active-2', { status: 'active' });
    const { result } = renderHook(() =>
      useAppointmentExpansion('trustee-123', [activeOne, activeTwo]),
    );

    expect(result.current.isExpanded(activeOne)).toBe(true);
    expect(result.current.isExpanded(activeTwo)).toBe(true);
  });

  test('toggling one appointment does not affect another appointment', () => {
    const active = makeAppointment('active-1', { status: 'active' });
    const inactive = makeAppointment('inactive-1', { status: 'inactive' });
    const { result } = renderHook(() => useAppointmentExpansion('trustee-123', [active, inactive]));

    act(() => {
      result.current.toggleExpanded(inactive.id);
    });

    expect(result.current.isExpanded(active)).toBe(true);
    expect(result.current.isExpanded(inactive)).toBe(true);
  });

  test('toggling an expanded active appointment collapses it', () => {
    const active = makeAppointment('active-1', { status: 'active' });
    const { result } = renderHook(() => useAppointmentExpansion('trustee-123', [active]));

    act(() => {
      result.current.toggleExpanded(active.id);
    });

    expect(result.current.isExpanded(active)).toBe(false);
  });

  test('an appointment explicitly expanded while active collapses once its status changes to inactive', () => {
    const active = makeAppointment('appt-1', { status: 'active' });
    const { result, rerender } = renderHook(
      ({ appointments }) => useAppointmentExpansion('trustee-123', appointments),
      { initialProps: { appointments: [active] } },
    );

    // Explicitly collapse it, then re-expand it, recording an explicit
    // toggle for the "active" status in session state.
    act(() => {
      result.current.toggleExpanded(active.id);
    });
    expect(result.current.isExpanded(active)).toBe(false);
    act(() => {
      result.current.toggleExpanded(active.id);
    });
    expect(result.current.isExpanded(active)).toBe(true);

    // Simulate the appointment's status changing to inactive (e.g. via edit).
    const inactive = { ...active, status: 'inactive' as const };
    rerender({ appointments: [inactive] });

    expect(result.current.isExpanded(inactive)).toBe(false);
  });

  test('toggling an appointment persists its expand state across a simulated remount within the same session', () => {
    const inactive = makeAppointment('appt-1', { status: 'inactive' });

    const { result: firstResult, unmount: unmountFirst } = renderHook(() =>
      useAppointmentExpansion('trustee-123', [inactive]),
    );
    expect(firstResult.current.isExpanded(inactive)).toBe(false);

    act(() => {
      firstResult.current.toggleExpanded(inactive.id);
    });
    expect(firstResult.current.isExpanded(inactive)).toBe(true);

    unmountFirst();

    const { result: secondResult } = renderHook(() =>
      useAppointmentExpansion('trustee-123', [inactive]),
    );
    expect(secondResult.current.isExpanded(inactive)).toBe(true);
  });

  test('an explicit toggle recorded for one status is not reused after the status cycles away and back', () => {
    const inactive = makeAppointment('appt-1', { status: 'inactive' });

    const { result: firstResult, unmount: unmountFirst } = renderHook(() =>
      useAppointmentExpansion('trustee-123', [inactive]),
    );
    expect(firstResult.current.isExpanded(inactive)).toBe(false);

    // Explicitly expand it while inactive, recording an override for "inactive".
    act(() => {
      firstResult.current.toggleExpanded(inactive.id);
    });
    expect(firstResult.current.isExpanded(inactive)).toBe(true);
    unmountFirst();

    // Cycle the status to active, then back to inactive (e.g. via edits).
    const active = { ...inactive, status: 'active' as const };
    const { result: secondResult, unmount: unmountSecond } = renderHook(() =>
      useAppointmentExpansion('trustee-123', [active]),
    );
    expect(secondResult.current.isExpanded(active)).toBe(true);
    unmountSecond();

    const { result: thirdResult } = renderHook(() =>
      useAppointmentExpansion('trustee-123', [inactive]),
    );
    // The stale "inactive" override from before the cycle must not be reused.
    expect(thirdResult.current.isExpanded(inactive)).toBe(false);
  });

  test('toggling two different appointments in the same update batch updates both independently', () => {
    const inactiveOne = makeAppointment('inactive-1', { status: 'inactive' });
    const inactiveTwo = makeAppointment('inactive-2', { status: 'inactive' });
    const { result } = renderHook(() =>
      useAppointmentExpansion('trustee-123', [inactiveOne, inactiveTwo]),
    );

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
