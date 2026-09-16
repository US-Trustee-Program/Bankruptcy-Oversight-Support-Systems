import { renderHook, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { useUpcomingKeyDates } from './useUpcomingKeyDates';
import Api2 from '@/lib/models/api2';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

describe('useUpcomingKeyDates', () => {
  const keyDates: TrusteeUpcomingKeyDates = {
    id: 'key-dates-001',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-456',
    appointmentId: 'appointment-002',
    createdOn: '2020-01-10T14:30:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2020-01-10T14:30:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    bondIssuedDate: '2023-06-01',
    bondRenewalDate: '2026-06-01',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('does not fetch when disabled', () => {
    const getSpy = vi.spyOn(Api2, 'getUpcomingKeyDates');

    const { result } = renderHook(() =>
      useUpcomingKeyDates('trustee-456', 'appointment-002', false),
    );

    expect(getSpy).not.toHaveBeenCalled();
    expect(result.current).toEqual({ data: null, isLoading: false, error: false });
  });

  test('fetches and returns data when enabled', async () => {
    const getSpy = vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: keyDates });

    const { result } = renderHook(() =>
      useUpcomingKeyDates('trustee-456', 'appointment-002', true),
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(getSpy).toHaveBeenCalledWith('trustee-456', 'appointment-002');
    expect(result.current.data).toEqual(keyDates);
    expect(result.current.error).toBe(false);
  });

  test('returns null data when no key dates document exists', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    const { result } = renderHook(() =>
      useUpcomingKeyDates('trustee-456', 'appointment-002', true),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe(false);
  });

  test('sets error and logs when the fetch fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchError = new Error('network error');
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockRejectedValue(fetchError);

    const { result } = renderHook(() =>
      useUpcomingKeyDates('trustee-456', 'appointment-002', true),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.error).toBe(true);
    expect(result.current.data).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Could not load upcoming key dates', fetchError);
  });
});
