export type Condition<T = unknown> = {
  condition:
    | 'EQUALS'
    | 'GREATER_THAN'
    | 'GREATER_THAN_OR_EQUAL'
    | 'CONTAINS'
    | 'LESS_THAN'
    | 'LESS_THAN_OR_EQUAL'
    | 'NOT_EQUALS'
    | 'NOT_CONTAINS'
    | 'EXISTS'
    | 'REGEX';
  leftOperand: Field<T>;
  rightOperand: unknown;
};

export function isCondition(obj: unknown): obj is Condition {
  return typeof obj === 'object' && 'condition' in obj;
}

export type Field<T = never> = {
  name: keyof T;
};

export function isField(obj: unknown): obj is Field {
  // TODO: This inference is specced very wide and could return many false positives.
  return obj instanceof Object && 'name' in obj;
}

export type Conjunction<T = unknown> = {
  conjunction: 'AND' | 'OR' | 'NOT';
  values: ConditionOrConjunction<T>[];
};

export function isConjunction(obj: unknown): obj is Conjunction {
  return typeof obj === 'object' && 'conjunction' in obj;
}

export type Query<T = unknown> = ConditionOrConjunction<T> | ConditionOrConjunction<T>[];

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

export interface ConditionFunctions<T = unknown, R = T[keyof T]> {
  equals: (rightOperand: Field<T> | R) => Condition<T>;
  greaterThan: (rightOperand: Field<T> | R) => Condition<T>;
  greaterThanOrEqual: (rightOperand: Field<T> | R) => Condition<T>;
  lessThan: (rightOperand: Field<T> | R) => Condition<T>;
  lessThanOrEqual: (rightOperand: Field<T> | R) => Condition<T>;
  notEqual: (rightOperand: Field<T> | R) => Condition<T>;
  exists: () => Condition<T>;
  notExists: () => Condition<T>;
  contains: (rightOperand: R | R[]) => Condition<T>;
  notContains: (rightOperand: R | R[]) => Condition<T>;
  regex: (rightOperand: RegExp | string) => Condition<T>;
}

export function using<T = unknown>() {
  return <F extends keyof T>(field: F) => {
    const leftOperand: Field<T> = { name: field };
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
        condition: 'NOT_EQUALS',
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

    const contains = (rightOperand: R | R[]): Condition<T> => {
      return {
        condition: 'CONTAINS',
        leftOperand,
        rightOperand,
      };
    };

    const notContains = (rightOperand: R | R[]): Condition<T> => {
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

export type SortedField<T = never> = {
  field: Field<T>;
  direction: 'ASCENDING' | 'DESCENDING';
};

export type SortSpec<T = never> = {
  fields: SortedField<T>[];
};

export function isSortSpec(obj: unknown): obj is SortSpec {
  return typeof obj === 'object' && 'fields' in obj && !('stage' in obj);
}

function orderBy<T = never>(...specs: [keyof T, 'ASCENDING' | 'DESCENDING'][]): SortSpec {
  return {
    fields: specs.map((spec) => {
      return { field: { name: spec[0] }, direction: spec[1] };
    }),
  };
}

const QueryBuilder = {
  not,
  and,
  or,
  using,
  orderBy,
};

export default QueryBuilder;
