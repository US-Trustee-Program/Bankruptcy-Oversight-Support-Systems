import { act, renderHook, waitFor } from '@testing-library/react';
import { useCaseAppointment } from './useCaseAppointment';
import Api2 from '@/lib/models/api2';
import { CaseAppointment, CaseTrusteeAppointmentHistory } from '@common/cams/trustee-appointments';
import { CamsHttpError } from '@/lib/models/api';
import { ResponseBody } from '@common/api/response';

const mockAppointment: CaseAppointment = {
  id: 'ca-001',
  caseId: '111-24-00001',
  trusteeId: 'trustee-abc',
  assignedOn: '2026-01-01T00:00:00Z',
  appointedDate: '2026-04-07',
  createdOn: '2026-01-01T00:00:00Z',
  createdBy: { id: 'system', name: 'System' },
  updatedOn: '2026-01-01T00:00:00Z',
  updatedBy: { id: 'system', name: 'System' },
};

describe('useCaseAppointment', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('does not fetch when caseId is undefined', () => {
    const spy = vi.spyOn(Api2, 'getCaseTrusteeAppointment');
    const { result } = renderHook(() => useCaseAppointment(undefined));

    expect(result.current.appointedDate).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  test('returns appointedDate and trusteeId when API returns appointment', async () => {
    vi.spyOn(Api2, 'getCaseTrusteeAppointment').mockResolvedValue({ data: mockAppointment });

    const { result } = renderHook(() => useCaseAppointment('111-24-00001'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.appointedDate).toBe('2026-04-07');
    expect(result.current.trusteeId).toBe('trustee-abc');
  });

  test('returns null when API returns appointment with no appointedDate', async () => {
    const appointmentNoDate: CaseAppointment = { ...mockAppointment, appointedDate: undefined };
    vi.spyOn(Api2, 'getCaseTrusteeAppointment').mockResolvedValue({ data: appointmentNoDate });

    const { result } = renderHook(() => useCaseAppointment('111-24-00001'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.appointedDate).toBeNull();
  });

  test('returns null silently when API throws 404', async () => {
    const consoleSpy = vi.spyOn(console, 'error');
    vi.spyOn(Api2, 'getCaseTrusteeAppointment').mockRejectedValue(
      new CamsHttpError(404, 'Not Found'),
    );

    const { result } = renderHook(() => useCaseAppointment('111-24-99999'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.appointedDate).toBeNull();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  test('cancels in-flight request when component unmounts', async () => {
    const consoleSpy = vi.spyOn(console, 'error');
    let resolveRequest!: (
      value: ResponseBody<CaseAppointment | CaseTrusteeAppointmentHistory>,
    ) => void;
    vi.spyOn(Api2, 'getCaseTrusteeAppointment').mockImplementation(
      () =>
        new Promise<ResponseBody<CaseAppointment | CaseTrusteeAppointmentHistory>>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const { unmount } = renderHook(() => useCaseAppointment('111-24-00001'));

    unmount();

    await act(async () => {
      resolveRequest({ data: mockAppointment });
    });

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  test('returns null and logs error when API throws non-404 error', async () => {
    const consoleSpy = vi.spyOn(console, 'error');
    vi.spyOn(Api2, 'getCaseTrusteeAppointment').mockRejectedValue(
      new CamsHttpError(500, 'Internal Server Error'),
    );

    const { result } = renderHook(() => useCaseAppointment('111-24-99999'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.appointedDate).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Unexpected error fetching case trustee appointment',
      expect.any(CamsHttpError),
    );
  });

  describe('history response shape', () => {
    const mockHistory: CaseTrusteeAppointmentHistory = {
      current: mockAppointment,
      history: [
        {
          ...mockAppointment,
          id: 'ca-past',
          trusteeId: 'trustee-old',
          trusteeName: 'Old Trustee',
          unassignedOn: '2025-01-01T00:00:00Z',
        },
      ],
    };

    test('sets trusteeId and appointedDate from current when history shape returned', async () => {
      vi.spyOn(Api2, 'getCaseTrusteeAppointment').mockResolvedValue({ data: mockHistory });

      const { result } = renderHook(() => useCaseAppointment('111-24-00001'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.trusteeId).toBe(mockAppointment.trusteeId);
      expect(result.current.appointedDate).toBe(mockAppointment.appointedDate);
      expect(result.current.history).toHaveLength(1);
      expect(result.current.history[0].trusteeName).toBe('Old Trustee');
    });

    test('returns empty history for flat CaseAppointment response', async () => {
      vi.spyOn(Api2, 'getCaseTrusteeAppointment').mockResolvedValue({ data: mockAppointment });

      const { result } = renderHook(() => useCaseAppointment('111-24-00001'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.history).toEqual([]);
    });

    test('sets trusteeId to null and history to [] when current is null', async () => {
      vi.spyOn(Api2, 'getCaseTrusteeAppointment').mockResolvedValue({
        data: { current: null, history: [] },
      });

      const { result } = renderHook(() => useCaseAppointment('111-24-00001'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.trusteeId).toBeNull();
      expect(result.current.history).toEqual([]);
    });
  });
});
