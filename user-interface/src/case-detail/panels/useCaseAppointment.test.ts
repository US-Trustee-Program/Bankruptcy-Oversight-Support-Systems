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

const CASE_A = '111-24-00001';
const CASE_B = '111-24-00002';

const caseBHistory: CaseTrusteeAppointmentHistory = {
  current: {
    ...mockAppointment,
    id: 'ca-002',
    caseId: CASE_B,
    trusteeId: 'trustee-b',
    appointedDate: '2026-05-01',
  },
  history: [],
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

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

  test('sets trusteeId, appointedDate, and history from the response', async () => {
    vi.spyOn(Api2, 'getCaseTrusteeAppointment').mockResolvedValue({ data: mockHistory });

    const { result } = renderHook(() => useCaseAppointment('111-24-00001'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.trusteeId).toBe('trustee-abc');
    expect(result.current.appointedDate).toBe('2026-04-07');
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].trusteeName).toBe('Old Trustee');
  });

  test('returns null appointedDate when the current appointment has none', async () => {
    vi.spyOn(Api2, 'getCaseTrusteeAppointment').mockResolvedValue({
      data: { current: { ...mockAppointment, appointedDate: undefined }, history: [] },
    });

    const { result } = renderHook(() => useCaseAppointment('111-24-00001'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.appointedDate).toBeNull();
  });

  test('keeps history when there is no current appointment', async () => {
    vi.spyOn(Api2, 'getCaseTrusteeAppointment').mockResolvedValue({
      data: { current: null, history: mockHistory.history },
    });

    const { result } = renderHook(() => useCaseAppointment('111-24-00001'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.trusteeId).toBeNull();
    expect(result.current.appointedDate).toBeNull();
    expect(result.current.history).toEqual(mockHistory.history);
  });

  test('reports loading while the request is in flight', async () => {
    const request = deferred<ResponseBody<CaseTrusteeAppointmentHistory>>();
    vi.spyOn(Api2, 'getCaseTrusteeAppointment').mockReturnValue(request.promise);

    const { result } = renderHook(() => useCaseAppointment(CASE_A));

    expect(result.current.loading).toBe(true);

    await act(async () => {
      request.resolve({ data: mockHistory });
    });

    expect(result.current.loading).toBe(false);
  });

  test('clears the previous case as soon as caseId changes', async () => {
    const requestB = deferred<ResponseBody<CaseTrusteeAppointmentHistory>>();
    vi.spyOn(Api2, 'getCaseTrusteeAppointment').mockImplementation((caseId) =>
      caseId === CASE_A ? Promise.resolve({ data: mockHistory }) : requestB.promise,
    );

    const { result, rerender } = renderHook(({ caseId }) => useCaseAppointment(caseId), {
      initialProps: { caseId: CASE_A },
    });
    await waitFor(() => expect(result.current.trusteeId).toBe('trustee-abc'));

    rerender({ caseId: CASE_B });

    expect(result.current.trusteeId).toBeNull();
    expect(result.current.appointedDate).toBeNull();
    expect(result.current.history).toEqual([]);
    expect(result.current.loading).toBe(true);
  });

  test.each([
    {
      outcome: 'resolves',
      settle: (request: Deferred<ResponseBody<CaseTrusteeAppointmentHistory>>) =>
        request.resolve({ data: mockHistory }),
    },
    {
      outcome: 'rejects',
      settle: (request: Deferred<ResponseBody<CaseTrusteeAppointmentHistory>>) =>
        request.reject(new CamsHttpError(500, 'Internal Server Error')),
    },
  ])('ignores the previous case when its request $outcome late', async ({ settle }) => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const requestA = deferred<ResponseBody<CaseTrusteeAppointmentHistory>>();
    const requestB = deferred<ResponseBody<CaseTrusteeAppointmentHistory>>();
    vi.spyOn(Api2, 'getCaseTrusteeAppointment').mockImplementation((caseId) =>
      caseId === CASE_A ? requestA.promise : requestB.promise,
    );

    const { result, rerender } = renderHook(({ caseId }) => useCaseAppointment(caseId), {
      initialProps: { caseId: CASE_A },
    });
    rerender({ caseId: CASE_B });

    await act(async () => {
      requestB.resolve({ data: caseBHistory });
    });
    await act(async () => {
      settle(requestA);
    });

    expect(result.current.trusteeId).toBe('trustee-b');
    expect(result.current.appointedDate).toBe('2026-05-01');
    expect(result.current.history).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  test('returns empty state and logs error when API throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Api2, 'getCaseTrusteeAppointment').mockRejectedValue(
      new CamsHttpError(500, 'Internal Server Error'),
    );

    const { result } = renderHook(() => useCaseAppointment('111-24-99999'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.appointedDate).toBeNull();
    expect(result.current.trusteeId).toBeNull();
    expect(result.current.history).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Unexpected error fetching case trustee appointment',
      expect.any(CamsHttpError),
    );
  });
});
