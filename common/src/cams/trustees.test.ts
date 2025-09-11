import { TRUSTEE_STATUS_VALUES } from './trustees';

describe('parties', () => {
  test('TRUSTEE_STATUS_VALUES', () => {
    expect(TRUSTEE_STATUS_VALUES).toEqual(['active', 'not active', 'suspended']);
  });
});
