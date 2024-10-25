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

export type ConditionOrConjunction = Condition | Conjunction;

function build(query: ConditionOrConjunction) {
  return query;
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

function contains<T>(attributeName: string, value: T): Condition {
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

function notContains<T>(attributeName: string, value: T): Condition {
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

function regex(attributeName: string, value: string): Condition {
  return {
    condition: 'REGEX',
    attributeName,
    value,
  };
}

export type SortDirection = [attributeName: string, direction: 'ASCENDING' | 'DESCENDING'];

export type Sort = {
  directions: SortDirection[];
};

export function isSort(obj: unknown): obj is Sort {
  return typeof obj === 'object' && 'directions' in obj;
}

function orderBy(...directions: SortDirection[]): Sort {
  return { directions };
}

const QueryBuilder = {
  build,
  equals,
  greaterThan,
  greaterThanOrEqual,
  contains,
  lessThan,
  lessThanOrEqual,
  notEqual,
  notContains,
  not,
  exists,
  and,
  or,
  regex,
  orderBy,
};

export default QueryBuilder;
