import { describe } from 'vitest';
import Api2 from '../models/api2';
import { useApi2 } from './UseApi2';

describe('UseApi2 hook', () => {
  test('should alias the Api2 constant', () => {
    expect(useApi2()).toEqual(Api2);
  });
});
