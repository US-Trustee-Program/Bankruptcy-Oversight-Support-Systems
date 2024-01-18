import { AggregateAuthenticationError } from '@azure/identity';

export function throwAggregateAuthenticationError<T>() {
  return async function (): Promise<T> {
    throw new AggregateAuthenticationError([], 'Mock AggregateAuthenticationError');
  };
}
