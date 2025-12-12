import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach, MockedFunction } from 'vitest';
import { useTrusteeAssignments } from './UseTrusteeAssignments';
import createApi2 from '../../lib/Api2Factory';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { OversightRole } from '@common/cams/roles';
import { _Api2 } from '@/lib/models/api2';

vi.mock('../../lib/Api2Factory', () => ({
  default: vi.fn(),
}));

type MockedApi2 = {
  [K in keyof typeof _Api2]: MockedFunction<(typeof _Api2)[K]>;
};

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

  const mockApiMethods = {
    getTrusteeOversightAssignments: vi.fn(),
    createTrusteeOversightAssignment: vi.fn(),
  } as unknown as MockedApi2;

  beforeEach(() => {
    vi.clearAllMocks();
    (createApi2 as MockedFunction<typeof createApi2>).mockReturnValue(mockApiMethods);
  });

  test('should initialize with empty state', () => {
    const { result } = renderHook(() => useTrusteeAssignments());

    expect(result.current.assignments).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('should fetch assignments successfully', async () => {
    mockApiMethods.getTrusteeOversightAssignments.mockResolvedValue({
      data: mockAssignments,
    });

    const { result } = renderHook(() => useTrusteeAssignments());

    expect(result.current.isLoading).toBe(false);

    result.current.getTrusteeOversightAssignments('trustee-123');

    await waitFor(() => {
      expect(result.current.assignments).toEqual(mockAssignments);
    });

    expect(mockApiMethods.getTrusteeOversightAssignments).toHaveBeenCalledWith('trustee-123');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('should handle fetch assignments error', async () => {
    const errorMessage = 'Failed to fetch data';
    mockApiMethods.getTrusteeOversightAssignments.mockRejectedValue(new Error(errorMessage));

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

    mockApiMethods.createTrusteeOversightAssignment.mockResolvedValue({
      data: newAssignment,
    });

    const { result } = renderHook(() => useTrusteeAssignments());

    result.current.assignAttorneyToTrustee('trustee-123', 'attorney-123');

    await waitFor(() => {
      expect(result.current.assignments).toEqual([newAssignment]);
    });

    expect(mockApiMethods.createTrusteeOversightAssignment).toHaveBeenCalledWith(
      'trustee-123',
      'attorney-123',
      OversightRole.OversightAttorney,
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('should handle assign attorney error', async () => {
    const errorMessage = 'Failed to assign attorney';
    mockApiMethods.createTrusteeOversightAssignment.mockRejectedValue(new Error(errorMessage));

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
    mockApiMethods.getTrusteeOversightAssignments.mockRejectedValue(new Error(errorMessage));

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
    mockApiMethods.getTrusteeOversightAssignments.mockResolvedValue({
      data: null,
    } as unknown as { data: TrusteeOversightAssignment[] });

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
    mockApiMethods.getTrusteeOversightAssignments.mockRejectedValue(errorString);

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
    mockApiMethods.createTrusteeOversightAssignment.mockRejectedValue(errorString);

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
