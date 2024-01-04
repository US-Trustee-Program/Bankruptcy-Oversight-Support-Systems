import { AggregateAuthenticationError } from '@azure/identity';

export function throwAggregateAuthenticationError<T>() {
  return function (): T {
    throw new AggregateAuthenticationError([], 'Mock AggregateAuthenticationError');
  };
}
