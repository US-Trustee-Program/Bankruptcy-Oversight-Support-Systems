import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { useTrusteeAssignments } from './UseTrusteeAssignments';
import Api2 from '@/lib/models/api2';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { OversightRole } from '@common/cams/roles';
import { ResponseBody } from '@common/api/response';

vi.mock('@/lib/models/api2', () => ({
  default: {
    getTrusteeOversightAssignments: vi.fn(),
    createTrusteeOversightAssignment: vi.fn(),
  },
}));

describe('useTrusteeAssignments', () => {
  const mockAssignments: TrusteeOversightAssignment[] = [
    {
      id: 'assignment-1',
      trusteeId: 'trustee-123',
      user: {
        id: 'attorney-123',
        name: 'Attorney Smith',
      },
      role: OversightRole.OversightAttorney,
      createdBy: {
        id: 'user-123',
        name: 'Admin User',
      },
      createdOn: '2023-01-01T00:00:00.000Z',
      updatedBy: {
        id: 'user-123',
        name: 'Admin User',
      },
      updatedOn: '2023-01-01T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('should initialize with empty state', () => {
    const { result } = renderHook(() => useTrusteeAssignments());

    expect(result.current.assignments).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('should fetch assignments successfully', async () => {
    const response: ResponseBody<TrusteeOversightAssignment[]> = {
      data: mockAssignments,
    };
    vi.mocked(Api2.getTrusteeOversightAssignments).mockResolvedValueOnce(response);

    const { result } = renderHook(() => useTrusteeAssignments());

    expect(result.current.isLoading).toBe(false);

    result.current.getTrusteeOversightAssignments('trustee-123');

    await waitFor(() => {
      expect(result.current.assignments).toEqual(mockAssignments);
    });

    expect(vi.mocked(Api2.getTrusteeOversightAssignments)).toHaveBeenCalledWith('trustee-123');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('should handle fetch assignments error', async () => {
    const errorMessage = 'Failed to fetch data';
    vi.mocked(Api2.getTrusteeOversightAssignments).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useTrusteeAssignments());

    result.current.getTrusteeOversightAssignments('trustee-123');

    await waitFor(() => {
      expect(result.current.error).toBe(errorMessage);
    });

    expect(result.current.assignments).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  test('should assign attorney successfully', async () => {
    const newAssignment: TrusteeOversightAssignment = {
      ...mockAssignments[0],
      id: 'new-assignment-1',
    };

    const response: ResponseBody<TrusteeOversightAssignment> = {
      data: newAssignment,
    };
    vi.mocked(Api2.createTrusteeOversightAssignment).mockResolvedValueOnce(response);

    const { result } = renderHook(() => useTrusteeAssignments());

    result.current.assignAttorneyToTrustee('trustee-123', 'attorney-123');

    await waitFor(() => {
      expect(result.current.assignments).toEqual([newAssignment]);
    });

    expect(vi.mocked(Api2.createTrusteeOversightAssignment)).toHaveBeenCalledWith(
      'trustee-123',
      'attorney-123',
      OversightRole.OversightAttorney,
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('should handle assign attorney error', async () => {
    const errorMessage = 'Failed to assign attorney';
    vi.mocked(Api2.createTrusteeOversightAssignment).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useTrusteeAssignments());

    let caughtError: Error | null = null;

    result.current.assignAttorneyToTrustee('trustee-123', 'attorney-123').catch((err: Error) => {
      caughtError = err;
    });

    await waitFor(() => {
      expect(result.current.error).toBe(errorMessage);
    });

    expect(result.current.assignments).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(caughtError).not.toBeNull();
  });

  test('should clear error state', async () => {
    const errorMessage = 'Test error for clearing';
    vi.mocked(Api2.getTrusteeOversightAssignments).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useTrusteeAssignments());

    // First set error state through a failed API call
    result.current.getTrusteeOversightAssignments('trustee-123');

    await waitFor(() => {
      expect(result.current.error).toBe(errorMessage);
    });

    // Then test clearing the error
    result.current.clearError();

    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });
  });

  test('should handle null/undefined data in fetch assignments response', async () => {
    const response = {
      data: null,
    } as unknown as ResponseBody<TrusteeOversightAssignment[]>;
    vi.mocked(Api2.getTrusteeOversightAssignments).mockResolvedValueOnce(response);

    const { result } = renderHook(() => useTrusteeAssignments());

    result.current.getTrusteeOversightAssignments('trustee-123');

    await waitFor(() => {
      expect(result.current.assignments).toEqual([]);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('should handle non-Error throw in fetch assignments', async () => {
    const errorString = 'Non-error failure';
    vi.mocked(Api2.getTrusteeOversightAssignments).mockRejectedValue(errorString);

    const { result } = renderHook(() => useTrusteeAssignments());

    result.current.getTrusteeOversightAssignments('trustee-123');

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to fetch assignments');
    });

    expect(result.current.assignments).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  test('should handle non-Error throw in assign attorney', async () => {
    const errorString = 'Non-error failure';
    vi.mocked(Api2.createTrusteeOversightAssignment).mockRejectedValue(errorString);

    const { result } = renderHook(() => useTrusteeAssignments());

    let caughtError: unknown = null;

    result.current.assignAttorneyToTrustee('trustee-123', 'attorney-123').catch((err: unknown) => {
      caughtError = err;
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to assign attorney');
    });

    expect(result.current.assignments).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(caughtError).toBe(errorString);
  });
});
