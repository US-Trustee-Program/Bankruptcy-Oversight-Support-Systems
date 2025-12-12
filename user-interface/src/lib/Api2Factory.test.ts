import { describe } from 'vitest';
import Api2 from './models/api2';
import createApi2 from './Api2Factory';

describe('CreateApi2 factory', () => {
  test('should alias the Api2 constant', () => {
    expect(createApi2()).toEqual(Api2);
  });
});
