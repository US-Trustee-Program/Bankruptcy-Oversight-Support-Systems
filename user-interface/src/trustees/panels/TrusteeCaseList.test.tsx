import { render, screen } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import TrusteeCaseList from './TrusteeCaseList';
import * as UseTrusteeCaseListModule from './useTrusteeCaseList';
import { TrusteeCaseListItem } from '@common/cams/trustee-cases';
import { Pagination } from '@common/api/pagination';

const mockCase: TrusteeCaseListItem = {
  caseId: '111-24-00001',
  caseTitle: 'Smith, John',
  chapter: '7',
  dateFiled: '2024-01-15',
  closedDate: '2025-03-10',
};

const defaultHookResult: UseTrusteeCaseListModule.UseTrusteeCaseListResult = {
  cases: [mockCase],
  pagination: undefined,
  isLoading: false,
  predicate: { limit: 25, offset: 0 },
  fetchPage: vi.fn(),
};

describe('TrusteeCaseList', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(UseTrusteeCaseListModule, 'useTrusteeCaseList').mockReturnValue(defaultHookResult);
  });

  test('shows LoadingSpinner when isLoading is true', () => {
    vi.spyOn(UseTrusteeCaseListModule, 'useTrusteeCaseList').mockReturnValue({
      ...defaultHookResult,
      isLoading: true,
      cases: [],
    });

    render(
      <MemoryRouter>
        <TrusteeCaseList trusteeId="trustee-123" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('trustee-case-list-table')).not.toBeInTheDocument();
  });

  test('shows "No cases found" when cases is empty and not loading', () => {
    vi.spyOn(UseTrusteeCaseListModule, 'useTrusteeCaseList').mockReturnValue({
      ...defaultHookResult,
      cases: [],
    });

    render(
      <MemoryRouter>
        <TrusteeCaseList trusteeId="trustee-123" />
      </MemoryRouter>,
    );

    expect(screen.getByText('No cases found.')).toBeInTheDocument();
    expect(screen.queryByTestId('trustee-case-list-table')).not.toBeInTheDocument();
  });

  test('renders table rows with case number link, chapter, and formatted dates', () => {
    render(
      <MemoryRouter>
        <TrusteeCaseList trusteeId="trustee-123" />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('trustee-case-list-table')).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', `/case-detail/${mockCase.caseId}`);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Smith, John')).toBeInTheDocument();
  });

  test('renders Pagination when pagination.totalPages > 1', () => {
    const pagination: Pagination = {
      count: 25,
      limit: 25,
      currentPage: 1,
      totalPages: 3,
      totalCount: 75,
    };

    vi.spyOn(UseTrusteeCaseListModule, 'useTrusteeCaseList').mockReturnValue({
      ...defaultHookResult,
      pagination,
    });

    render(
      <MemoryRouter>
        <TrusteeCaseList trusteeId="trustee-123" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
  });

  test('does not render Pagination when pagination.totalPages <= 1', () => {
    const pagination: Pagination = {
      count: 5,
      limit: 25,
      currentPage: 1,
      totalPages: 1,
      totalCount: 5,
    };

    vi.spyOn(UseTrusteeCaseListModule, 'useTrusteeCaseList').mockReturnValue({
      ...defaultHookResult,
      pagination,
    });

    render(
      <MemoryRouter>
        <TrusteeCaseList trusteeId="trustee-123" />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
  });
});
