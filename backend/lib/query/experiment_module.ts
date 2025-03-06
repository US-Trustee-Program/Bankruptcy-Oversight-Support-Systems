import { Condition } from './query-builder';

// Field would be added to the query builder model.
export type Field<T = unknown> = {
  field: keyof T;
};

export function isField(obj: unknown): obj is Field {
  return obj instanceof Object && 'field' in obj; // && obj.field is keyof T; // how to express field is in T?? If so we can cast Field<T> instead of Field
}

// This would replace Condition in the query builder model...
export type UpgradedCondition<T = unknown> = Omit<Condition, 'leftOperand'> & {
  leftOperand: Field<T>;
  rightOperand: Field<T> | unknown;
};

// The functions need to be returned from a closure in order to use function specific generic arguments.
export function using<T = unknown>() {
  return <F extends keyof T>(field: F) => {
    const leftOperand: Field<T> = { field };
    type R = T[F];

    function equals(rightOperand: Field<T> | R): UpgradedCondition<T> {
      return {
        condition: 'EQUALS',
        leftOperand,
        rightOperand,
      };
    }

    return {
      equals,
    };
  };
}
