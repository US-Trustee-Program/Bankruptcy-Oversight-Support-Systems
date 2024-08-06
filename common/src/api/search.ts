import { PaginationParameters } from './pagination';

export const DEFAULT_SEARCH_LIMIT = 25;
export const DEFAULT_SEARCH_OFFSET = 0;

export type SearchPredicate = PaginationParameters;

export function setPaginationDefaults<P extends SearchPredicate = SearchPredicate>(predicate: P) {
  const limit = typeof predicate.limit === 'string' ? parseInt(predicate.limit) : predicate.limit;
  const offset =
    typeof predicate.offset === 'string' ? parseInt(predicate.offset) : predicate.offset;

  predicate.limit = limit ?? DEFAULT_SEARCH_LIMIT;
  predicate.offset = offset ?? DEFAULT_SEARCH_OFFSET;
  return predicate;
}

export type CasesSearchPredicate = SearchPredicate & {
  caseNumber?: string;
  divisionCodes?: string[];
  chapters?: string[];
  assignments?: string[];
  // TODO: Maybe the case management use case use the assignment use case to "augment" a search predicate to contain the list of case numbers to return.
  caseNumbers?: string[];
};
