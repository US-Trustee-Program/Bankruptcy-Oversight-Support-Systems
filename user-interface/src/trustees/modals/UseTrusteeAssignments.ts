import { useState, useCallback } from 'react';
import useApi2 from '../../lib/hooks/UseApi2';
import { TrusteeOversightAssignment } from '@common/cams/trustees';

interface UseTrusteeAssignmentsReturn {
  assignments: TrusteeOversightAssignment[];
  isLoading: boolean;
  error: string | null;
  getTrusteeOversightAssignments: (trusteeId: string) => Promise<void>;
  assignAttorneyToTrustee: (trusteeId: string, attorneyUserId: string) => Promise<void>;
  clearError: () => void;
}

export function useTrusteeAssignments(): UseTrusteeAssignmentsReturn {
  const [assignments, setAssignments] = useState<TrusteeOversightAssignment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const api = useApi2();

  const getTrusteeOversightAssignments = useCallback(
    async (trusteeId: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.getTrusteeOversightAssignments(trusteeId);
        setAssignments(response.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch assignments');
      } finally {
        setIsLoading(false);
      }
    },
    [api],
  );

  const assignAttorneyToTrustee = useCallback(
    async (trusteeId: string, attorneyUserId: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.createTrusteeOversightAssignment(trusteeId, attorneyUserId);
        if (response && response.data) {
          setAssignments((prev) => [...prev, response.data]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to assign attorney');
        throw err; // Re-throw for component handling
      } finally {
        setIsLoading(false);
      }
    },
    [api],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    assignments,
    isLoading,
    error,
    getTrusteeOversightAssignments,
    assignAttorneyToTrustee,
    clearError,
  };
}
