import { useEffect, useState } from 'react';
import { Pagination } from '@common/api/pagination';
import { SearchPredicate } from '@common/api/search';
import { TrusteeCaseListItem } from '@common/cams/trustee-cases';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import Api2 from '@/lib/models/api2';

const DEFAULT_LIMIT = 25;

export type TrusteeCaseListPredicate = SearchPredicate & {
  limit: number;
  offset: number;
};

export type UseTrusteeCaseListResult = {
  cases: TrusteeCaseListItem[];
  pagination: Pagination | undefined;
  isLoading: boolean;
  predicate: TrusteeCaseListPredicate;
  fetchPage: (offset: number) => void;
};

export function useTrusteeCaseList(trusteeId: string): UseTrusteeCaseListResult {
  const [cases, setCases] = useState<TrusteeCaseListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [predicate, setPredicate] = useState<TrusteeCaseListPredicate>({
    limit: DEFAULT_LIMIT,
    offset: 0,
  });
  const globalAlert = useGlobalAlert();

  async function loadCases(limit: number, offset: number) {
    setIsLoading(true);
    try {
      const response = await Api2.getTrusteeCases(trusteeId, limit, offset);
      setCases(response.data ?? []);
      setPagination(response.pagination);
    } catch (_error) {
      globalAlert?.error('Could not load trustee cases');
      setCases([]);
      setPagination(undefined);
    } finally {
      setIsLoading(false);
    }
  }

  function fetchPage(offset: number) {
    const nextPredicate = { limit: predicate.limit, offset };
    setPredicate(nextPredicate);
    loadCases(nextPredicate.limit, nextPredicate.offset);
  }

  useEffect(() => {
    loadCases(predicate.limit, predicate.offset);
  }, [trusteeId]);

  return { cases, pagination, isLoading, predicate, fetchPage };
}
