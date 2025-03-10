export type Condition<T = unknown> = {
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
  leftOperand: Field<T>;
  rightOperand: unknown;
  compareFields?: boolean;
};

export function isCondition(obj: unknown): obj is Condition {
  return typeof obj === 'object' && 'condition' in obj;
}

export type Field<T = unknown> = {
  field: keyof T;
};

export function isField(obj: unknown): obj is Field {
  return obj instanceof Object && 'field' in obj;
}

export type Conjunction<T = unknown> = {
  conjunction: 'AND' | 'OR' | 'NOT';
  values: ConditionOrConjunction<T>[];
};

export function isConjunction(obj: unknown): obj is Conjunction {
  return typeof obj === 'object' && 'conjunction' in obj;
}

export type Pagination<T = unknown> = {
  limit: number;
  skip: number;
  values: ConditionOrConjunction<T>[];
  sort?: Sort<T>;
};

export function isPagination(obj: unknown): obj is Pagination {
  return typeof obj === 'object' && 'limit' in obj && 'skip' in obj;
}

export type Query<T = unknown> =
  | Pagination<T>
  | ConditionOrConjunction<T>
  | ConditionOrConjunction<T>[];

export type ConditionOrConjunction<T = unknown> = Condition<T> | Conjunction<T>;

function and<T = unknown>(...values: ConditionOrConjunction<T>[]): Conjunction<T> {
  return {
    conjunction: 'AND',
    values,
  };
}

function or<T = unknown>(...values: ConditionOrConjunction<T>[]): Conjunction<T> {
  return {
    conjunction: 'OR',
    values,
  };
}

function not<T = unknown>(...values: ConditionOrConjunction<T>[]): Conjunction<T> {
  return {
    conjunction: 'NOT',
    values,
  };
}

function equals<T, R extends keyof T>(
  field: R,
  value: T[R],
  compareFields: boolean = false,
): Condition<T> {
  return {
    condition: 'EQUALS',
    leftOperand: { field },
    rightOperand: value,
    compareFields,
  };
}

function notEqual<T, R extends keyof T>(
  field: R,
  value: T[R],
  compareFields: boolean = false,
): Condition<T> {
  return {
    condition: 'NOT_EQUAL',
    leftOperand: { field },
    rightOperand: value,
    compareFields,
  };
}

function greaterThan<T, R extends keyof T>(
  field: R,
  value: T[R],
  compareFields: boolean = false,
): Condition<T> {
  return {
    condition: 'GREATER_THAN',
    leftOperand: { field },
    rightOperand: value,
    compareFields,
  };
}

function greaterThanOrEqual<T, R extends keyof T>(
  field: R,
  value: T[R],
  compareFields: boolean = false,
): Condition<T> {
  return {
    condition: 'GREATER_THAN_OR_EQUAL',
    leftOperand: { field },
    rightOperand: value,
    compareFields,
  };
}

function contains<T, R extends keyof T>(field: R, value: T[R] | T[R][]): Condition<T> {
  return {
    condition: 'CONTAINS',
    leftOperand: { field },
    rightOperand: value,
  };
}

function lessThan<T, R extends keyof T>(
  field: R,
  value: T[R],
  compareFields: boolean = false,
): Condition<T> {
  return {
    condition: 'LESS_THAN',
    leftOperand: { field },
    rightOperand: value,
    compareFields,
  };
}

function lessThanOrEqual<T, R extends keyof T>(
  field: R,
  value: T[R],
  compareFields: boolean = false,
): Condition<T> {
  return {
    condition: 'LESS_THAN_OR_EQUAL',
    leftOperand: { field },
    rightOperand: value,
    compareFields,
  };
}

function notContains<T, R extends keyof T>(field: R, value: T[R] | T[R][]): Condition<T> {
  return {
    condition: 'NOT_CONTAINS',
    leftOperand: { field },
    rightOperand: value,
  };
}

function exists<T, R extends keyof T>(field: R): Condition<T> {
  return {
    condition: 'EXISTS',
    leftOperand: { field },
    rightOperand: true,
  };
}

function notExists<T, R extends keyof T>(field: R): Condition<T> {
  return {
    condition: 'EXISTS',
    leftOperand: { field },
    rightOperand: false,
  };
}

function regex<T>(field: keyof T, value: string): Condition<T> {
  return {
    condition: 'REGEX',
    leftOperand: { field },
    rightOperand: value,
  };
}

function paginate<T = unknown>(
  skip: number,
  limit: number,
  values: ConditionOrConjunction<T>[],
  sort?: Sort<T>,
): Pagination<T> {
  return {
    skip,
    limit,
    values,
    sort,
  };
}

export type SortedAttribute<T = unknown> = [field: keyof T, direction: 'ASCENDING' | 'DESCENDING'];

export type Sort<T = unknown> = {
  attributes: SortedAttribute<T>[];
};

export function isSort(obj: unknown): obj is Sort {
  return typeof obj === 'object' && 'attributes' in obj;
}

function orderBy<T = unknown>(...attributes: SortedAttribute<T>[]): Sort<T> {
  return { attributes };
}

// The functions need to be returned from a closure in order to use function specific generic arguments.
export function using<T = unknown>() {
  return <F extends keyof T>(field: F) => {
    const leftOperand: Field<T> = { field };
    type R = T[F];

    const equals = (rightOperand: Field<T> | R): Condition<T> => {
      return {
        condition: 'EQUALS',
        leftOperand,
        rightOperand,
      };
    };

    const greaterThan = (rightOperand: Field<T> | R): Condition<T> => {
      return {
        condition: 'GREATER_THAN',
        leftOperand,
        rightOperand,
      };
    };

    const greaterThanOrEqual = (rightOperand: Field<T> | R): Condition<T> => {
      return {
        condition: 'GREATER_THAN_OR_EQUAL',
        leftOperand,
        rightOperand,
      };
    };

    const lessThan = (rightOperand: Field<T> | R): Condition<T> => {
      return {
        condition: 'LESS_THAN',
        leftOperand,
        rightOperand,
      };
    };

    const lessThanOrEqual = (rightOperand: Field<T> | R): Condition<T> => {
      return {
        condition: 'LESS_THAN_OR_EQUAL',
        leftOperand,
        rightOperand,
      };
    };

    const notEqual = (rightOperand: Field<T> | R): Condition<T> => {
      return {
        condition: 'NOT_EQUAL',
        leftOperand,
        rightOperand,
      };
    };

    const exists = (): Condition<T> => {
      return {
        condition: 'EXISTS',
        leftOperand,
        rightOperand: true,
      };
    };

    const notExists = (): Condition<T> => {
      return {
        condition: 'EXISTS',
        leftOperand,
        rightOperand: false,
      };
    };

    const contains = (rightOperand: R[]): Condition<T> => {
      return {
        condition: 'CONTAINS',
        leftOperand,
        rightOperand,
      };
    };

    const notContains = (rightOperand: R[]): Condition<T> => {
      return {
        condition: 'NOT_CONTAINS',
        leftOperand,
        rightOperand,
      };
    };

    const regex = (rightOperand: RegExp | string): Condition<T> => {
      return {
        condition: 'REGEX',
        leftOperand,
        rightOperand,
      };
    };

    return {
      contains,
      equals,
      exists,
      notExists,
      greaterThan,
      greaterThanOrEqual,
      lessThan,
      lessThanOrEqual,
      notEqual,
      notContains,
      regex,
    };
  };
}

const QueryBuilder = {
  contains,
  equals,
  exists,
  notExists,
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
  using,
};

export default QueryBuilder;
