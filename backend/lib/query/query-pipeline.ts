import { ConditionOrConjunction } from './query-builder';

export type Match = ConditionOrConjunction<never> & {
  stage: 'MATCH';
};

export type Paginate = {
  stage: 'PAGINATE';
  limit: number;
  skip: number;
};

export function isPaginate(obj: unknown): obj is Paginate {
  return typeof obj === 'object' && 'limit' in obj && 'skip' in obj;
}

export type SortedAttribute<T = unknown> = [field: keyof T, direction: 'ASCENDING' | 'DESCENDING'];

export type Sort = {
  stage: 'SORT';
  attributes: SortedAttribute<never>[];
};

export function isSort(obj: unknown): obj is Sort {
  return typeof obj === 'object' && 'stage' in obj && obj.stage === 'SORT';
}

export type Stage = Paginate | Sort | Match;

export type Pipeline = {
  stages: Stage[];
};

export function isPipeline(obj: unknown): obj is Pipeline {
  return typeof obj === 'object' && 'stages' in obj;
}

function paginate(skip: number, limit: number): Paginate {
  return {
    stage: 'PAGINATE',
    skip,
    limit,
  };
}

function orderBy(...attributes: SortedAttribute<never>[]): Sort {
  return {
    stage: 'SORT',
    attributes,
  };
}

function match(query: ConditionOrConjunction<never>): Match {
  return {
    ...query,
    stage: 'MATCH',
  };
}

function pipeline(...stages: Stage[]): Pipeline {
  return { stages };
}

const QueryPipeline = {
  match,
  orderBy,
  paginate,
  pipeline,
};

export default QueryPipeline;
