import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { useTrusteeAssignments } from './UseTrusteeAssignments';
import useApi2 from './UseApi2';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { OversightRole } from '@common/cams/roles';

// Mock the useApi2 hook
vi.mock('./UseApi2', () => ({
  default: vi.fn(),
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
      role: OversightRole.TrialAttorney,
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useApi2 as jest.Mock).mockReturnValue(mockApiMethods);
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

    act(() => {
      result.current.getTrusteeOversightAssignments('trustee-123');
    });

    expect(result.current.isLoading).toBe(true);

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

    act(() => {
      result.current.getTrusteeOversightAssignments('trustee-123');
    });

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

    act(() => {
      result.current.assignAttorneyToTrustee('trustee-123', 'attorney-123');
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.assignments).toEqual([newAssignment]);
    });

    expect(mockApiMethods.createTrusteeOversightAssignment).toHaveBeenCalledWith(
      'trustee-123',
      'attorney-123',
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('should handle assign attorney error', async () => {
    const errorMessage = 'Failed to assign attorney';
    mockApiMethods.createTrusteeOversightAssignment.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useTrusteeAssignments());

    let caughtError: Error | null = null;

    act(() => {
      result.current.assignAttorneyToTrustee('trustee-123', 'attorney-123').catch((err: Error) => {
        caughtError = err;
      });
    });

    await waitFor(() => {
      expect(result.current.error).toBe(errorMessage);
    });

    expect(result.current.assignments).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(caughtError).not.toBeNull();
  });

  test('should clear error state', () => {
    const { result } = renderHook(() => useTrusteeAssignments());

    // Set error state manually by accessing the private setState function
    act(() => {
      // @ts-expect-error - Accessing private state for testing
      result.current.setError('Test error');
    });

    expect(result.current.error).toBe('Test error');

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});
