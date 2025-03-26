import { ConditionOrConjunction } from './query-builder';

export type Match<T = unknown> = ConditionOrConjunction<T> & {
  stage: 'MATCH';
};

export type Paginate = {
  stage: 'PAGINATE';
  limit: number;
  skip: number;
};

function paginate(skip: number, limit: number): Paginate {
  return {
    stage: 'PAGINATE',
    skip,
    limit,
  };
}

export type SortedAttribute<T = unknown> = [field: keyof T, direction: 'ASCENDING' | 'DESCENDING'];

export type Sort<T = unknown> = {
  stage: 'SORT';
  attributes: SortedAttribute<T>[];
};

export function isSort(obj: unknown): obj is Sort {
  return typeof obj === 'object' && 'stage' in obj && obj.stage === 'SORT';
}

function orderBy<T = unknown>(...attributes: SortedAttribute<T>[]): Sort<T> {
  return { stage: 'SORT', attributes };
}

export function isPaginate(obj: unknown): obj is Paginate {
  return typeof obj === 'object' && 'limit' in obj && 'skip' in obj;
}

function match<T = unknown>(query: ConditionOrConjunction): Match<T> {
  return {
    ...query,
    stage: 'MATCH',
  };
}

export type Stage = Paginate | Sort;

export type Pipeline = {
  stages: (Stage | Match)[];
};

export function isPipeline(obj: unknown): obj is Pipeline {
  return typeof obj === 'object' && 'stages' in obj;
}

function pipeline(...stages: (Stage | Match)[]): Pipeline {
  return {
    stages,
  };
}

const QueryPipeline = {
  match,
  orderBy,
  paginate,
  pipeline,
};

export default QueryPipeline;
