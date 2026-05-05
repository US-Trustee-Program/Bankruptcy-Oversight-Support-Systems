import { renderHook, waitFor, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { useTrusteeCaseList } from './useTrusteeCaseList';
import Api2 from '@/lib/models/api2';
import * as UseGlobalAlertModule from '@/lib/hooks/UseGlobalAlert';
import { TrusteeCaseListItem } from '@common/cams/trustee-cases';
import { Pagination } from '@common/api/pagination';
import { ResponseBody } from '@common/api/response';

const mockGlobalAlert = {
  show: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  success: vi.fn(),
};

const mockCase: TrusteeCaseListItem = {
  caseId: '111-24-00001',
  caseTitle: 'Smith, John',
  chapter: '7',
  dateFiled: '2024-01-15',
};

const mockPagination: Pagination = {
  count: 1,
  limit: 25,
  currentPage: 1,
  totalPages: 1,
  totalCount: 1,
};

describe('useTrusteeCaseList', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(UseGlobalAlertModule, 'useGlobalAlert').mockReturnValue(mockGlobalAlert);
  });

  test('returns cases and pagination after successful fetch', async () => {
    const response: ResponseBody<TrusteeCaseListItem[]> = {
      data: [mockCase],
      pagination: mockPagination,
    };
    vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue(response);

    const { result } = renderHook(() => useTrusteeCaseList('trustee-123'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.cases).toEqual([mockCase]);
    expect(result.current.pagination).toEqual(mockPagination);
  });

  test('isLoading is true during fetch, false after resolve', async () => {
    let resolve: (value: ResponseBody<TrusteeCaseListItem[]>) => void;
    const promise = new Promise<ResponseBody<TrusteeCaseListItem[]>>((res) => {
      resolve = res;
    });
    vi.spyOn(Api2, 'getTrusteeCases').mockReturnValue(promise);

    const { result } = renderHook(() => useTrusteeCaseList('trustee-123'));

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolve!({ data: [mockCase], pagination: mockPagination });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  test('on API error, calls globalAlert.error and sets cases to []', async () => {
    vi.spyOn(Api2, 'getTrusteeCases').mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useTrusteeCaseList('trustee-123'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.cases).toEqual([]);
    expect(result.current.pagination).toBeUndefined();
    expect(mockGlobalAlert.error).toHaveBeenCalledWith('Could not load trustee cases');
  });

  test('fetchPage triggers a new call with the given offset', async () => {
    const spy = vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: [mockCase],
      pagination: mockPagination,
    });

    const { result } = renderHook(() => useTrusteeCaseList('trustee-123'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.fetchPage(25);
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(spy).toHaveBeenCalledWith('trustee-123', 25, 25);
  });
});
