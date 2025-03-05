import { Condition, Conjunction } from './query-builder';

export type Field<T> = {
  field: keyof T;
};

export type UpgradedCondition<T> = Omit<Condition, 'leftOperand'> & {
  leftOperand: Field<T>;
  rightOperand: Field<T> | string | number | boolean | UpgradedCondition<T> | Conjunction;
};

// The interface isn't needed if it is always equal to the using function return value.
interface Builder<T> {
  equals: (left: keyof T, right: string | number | boolean | Field<T>) => Condition;
  equals2: (left: Field<T>, right: string | number | boolean | Field<T>) => UpgradedCondition<T>;
  isField: (obj: unknown) => obj is Field<T>;
}

function equals<T = unknown>(
  leftOperand: keyof T,
  rightOperand: string | number | boolean | Field<T>,
): Condition {
  return {
    condition: 'EQUALS',
    leftOperand: leftOperand.toString(),
    rightOperand,
  };
}

function equals2<T = unknown>(
  leftOperand: Field<T>,
  rightOperand: string | number | boolean | Field<T>, // I would love to get the primitive type from something like: 'typeof T[leftOperand.field]'.
): UpgradedCondition<T> {
  return {
    condition: 'EQUALS',
    leftOperand,
    rightOperand,
  };
}

function isField<T>(obj: unknown): obj is Field<T> {
  return obj instanceof Object && 'field' in obj;
}

export function using<T = unknown>(): Builder<T> {
  return {
    equals,
    equals2,
    isField,
  };
}
