import { PaginationParameters } from './pagination';

export type SearchPredicate = PaginationParameters;

// TODO: Evaluate the parameters here. P is a superset of PaginationParameters and options is a subset.
export function setPaginationDefaults<P extends SearchPredicate = SearchPredicate>(
  predicate: P,
  options: Partial<PaginationParameters> = {},
) {
  predicate.limit =
    typeof predicate.limit === 'string'
      ? parseInt(predicate.limit)
      : predicate.limit ?? options.limit ?? 25;
  // if (!predicate.limit) predicate.limit = options.limit ?? 25;
  predicate.offset =
    typeof predicate.offset === 'string'
      ? parseInt(predicate.offset)
      : predicate.offset ?? options.offset ?? 0;
  // if (!predicate.offset) predicate.offset = options.offset ?? 0;
  return predicate;
}

export type CasesSearchPredicate = SearchPredicate & {
  caseNumber?: string;
  divisionCodes?: string[];
};
