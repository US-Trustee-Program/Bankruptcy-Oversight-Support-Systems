import { PaginationParameters } from './pagination';

export const DEFAULT_SEARCH_LIMIT = 25;
export const DEFAULT_SEARCH_OFFSET = 0;

export type SearchPredicate = PaginationParameters;

export function setPaginationDefaults<P extends SearchPredicate = SearchPredicate>(predicate: P) {
  predicate.limit =
    typeof predicate.limit === 'string'
      ? parseInt(predicate.limit)
      : predicate.limit ?? DEFAULT_SEARCH_LIMIT;
  predicate.offset =
    typeof predicate.offset === 'string'
      ? parseInt(predicate.offset)
      : predicate.offset ?? DEFAULT_SEARCH_OFFSET;
  return predicate;
}

export type CasesSearchPredicate = SearchPredicate & {
  caseNumber?: string;
  divisionCodes?: string[];
};
