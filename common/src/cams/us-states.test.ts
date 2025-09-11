import { usStates } from './us-states';

describe('US States', () => {
  test('should return a list of US states', () => {
    expect(usStates[0]).toEqual(
      expect.objectContaining({ code: expect.any(String), name: expect.any(String) }),
    );
    expect(usStates).toHaveLength(59);
  });
});
