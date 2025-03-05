import { Condition } from './query-builder';

// Field would be added to the query builder model.
export type Field<T> = {
  field: keyof T;
};

// This would replace Condition in the query builder model...
export type UpgradedCondition<T = unknown> = Omit<Condition, 'leftOperand'> & {
  leftOperand: Field<T>;
  rightOperand: Field<T> | unknown;
};

// The functions need to be returned from a closure in order to use function specific generic arguments.
export function using<T = unknown>() {
  function equals<R = unknown>(
    leftOperand: Field<T>,
    rightOperand: Field<T> | R,
  ): UpgradedCondition<T> {
    return {
      condition: 'EQUALS',
      leftOperand,
      rightOperand,
    };
  }

  function isField(obj: unknown): obj is Field<T> {
    return obj instanceof Object && 'field' in obj;
  }

  return {
    equals,
    isField,
  };
}
