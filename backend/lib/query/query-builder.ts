export type Condition = {
  condition:
    | 'EQUALS'
    | 'GREATER_THAN'
    | 'GREATER_THAN_OR_EQUAL'
    | 'CONTAINS'
    | 'LESS_THAN'
    | 'LESS_THAN_OR_EQUAL'
    | 'NOT_EQUAL'
    | 'NOT_CONTAINS'
    | 'EXISTS'
    | 'MATCH'
    | 'EXPR'
    | 'REGEX';
  attributeName: string;
  value: unknown;
};

export function isCondition(obj: unknown): obj is Condition {
  return typeof obj === 'object' && 'condition' in obj;
}

export type Conjunction = {
  conjunction: 'AND' | 'OR' | 'NOT';
  values: ConditionOrConjunction[];
};

export function isConjunction(obj: unknown): obj is Conjunction {
  return typeof obj === 'object' && 'conjunction' in obj;
}

export type Pagination = {
  limit: number;
  skip: number;
  values: ConditionOrConjunction[];
  sort?: Sort;
};

export function isPagination(obj: unknown): obj is Pagination {
  return typeof obj === 'object' && 'limit' in obj && 'skip' in obj;
}

export type Query = Pagination | ConditionOrConjunction | ConditionOrConjunction[];

export type ConditionOrConjunction = Condition | Conjunction;

function build<T extends Query = Query>(query: Query) {
  return query as T;
}

function and(...values: ConditionOrConjunction[]): Conjunction {
  return {
    conjunction: 'AND',
    values,
  };
}

function or(...values: ConditionOrConjunction[]): Conjunction {
  return {
    conjunction: 'OR',
    values,
  };
}

function not(...values: ConditionOrConjunction[]): Conjunction {
  return {
    conjunction: 'NOT',
    values,
  };
}

function equals<T>(attributeName: string, value: T): Condition {
  return {
    condition: 'EQUALS',
    attributeName,
    value,
  };
}

function notEqual<T>(attributeName: string, value: T): Condition {
  return {
    condition: 'NOT_EQUAL',
    attributeName,
    value,
  };
}

function greaterThan<T>(attributeName: string, value: T): Condition {
  return {
    condition: 'GREATER_THAN',
    attributeName,
    value,
  };
}

function greaterThanOrEqual<T>(attributeName: string, value: T): Condition {
  return {
    condition: 'GREATER_THAN_OR_EQUAL',
    attributeName,
    value,
  };
}

function contains<T>(attributeName: string, value: T | T[]): Condition {
  return {
    condition: 'CONTAINS',
    attributeName,
    value,
  };
}

function lessThan<T>(attributeName: string, value: T): Condition {
  return {
    condition: 'LESS_THAN',
    attributeName,
    value,
  };
}

function lessThanOrEqual<T>(attributeName: string, value: T): Condition {
  return {
    condition: 'LESS_THAN_OR_EQUAL',
    attributeName,
    value,
  };
}

function notContains<T>(attributeName: string, value: T | T[]): Condition {
  return {
    condition: 'NOT_CONTAINS',
    attributeName,
    value,
  };
}

function exists<T>(attributeName: keyof T, value: boolean): Condition {
  return {
    condition: 'EXISTS',
    attributeName: attributeName as string,
    value,
  };
}

function expression<T>(attributeName: keyof T, value: unknown): Condition {
  // NEEDED QUERY { "$match": { "$expr": { "$gt": ["$reopenedDate", "$closedDate"] } } }
  return {
    condition: 'EXPR',
    attributeName: attributeName as string,
    value,
  };
}

// function match<T>(attributeName: keyof T, value: boolean): Condition {
//   return {
//     condition: 'MATCH',
//     attributeName: attributeName as string,
//     value,
//   };
// }

// function expression<T>(attributeName: keyof T, value: boolean): Condition {
//   return {
//     condition: 'EXPR',
//     attributeName: attributeName as string,
//     value,
//   };
// }

function regex(attributeName: string, value: string): Condition {
  return {
    condition: 'REGEX',
    attributeName,
    value,
  };
}

function paginate(
  skip: number,
  limit: number,
  values: ConditionOrConjunction[],
  sort?: Sort,
): Pagination {
  return {
    skip,
    limit,
    values,
    sort,
  };
}

export type SortedAttribute = [attributeName: string, direction: 'ASCENDING' | 'DESCENDING'];

export type Sort = {
  attributes: SortedAttribute[];
};

export function isSort(obj: unknown): obj is Sort {
  return typeof obj === 'object' && 'attributes' in obj;
}

function orderBy(...attributes: SortedAttribute[]): Sort {
  return { attributes };
}

const QueryBuilder = {
  build,
  contains,
  equals,
  exists,
  expression,
  greaterThan,
  greaterThanOrEqual,
  lessThan,
  lessThanOrEqual,
  notEqual,
  notContains,
  regex,
  not,
  and,
  or,
  orderBy,
  paginate,
};

export default QueryBuilder;
