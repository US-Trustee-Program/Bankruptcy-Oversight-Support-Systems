import { isPaginated } from './pagination';

describe('pagination tests', () => {
  test('should identify pagination request', () => {
    const meta = {
      isPaginated: true,
    };
    expect(isPaginated(meta)).toBeTruthy();
  });

  const meta = [
    {
      isPaginated: false,
    },
    'nonsense',
    {
      hello: 'world',
    },
  ];
  test.each(meta)('should identify non-pagination request', () => {
    expect(isPaginated(meta)).toBeFalsy();
  });
});
