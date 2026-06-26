import QueryBuilder, {
  Condition,
  Conjunction,
  isCondition,
  isConjunction,
  isProjection,
  isSortSpec,
  Projection,
  SortSpec,
} from './query-builder';

describe('Query Builder', () => {
  type Foo = {
    uno: string;
    two: number;
    three: boolean;
  };

  const { not, and, or, using } = QueryBuilder;
  const q = using<Foo>();

  test('should build correct query tree', () => {
    const expected: Conjunction<Foo> = {
      conjunction: 'OR',
      values: [
        {
          condition: 'EQUALS',
          leftOperand: { name: 'uno' },
          rightOperand: 'theValue',
        },
        {
          conjunction: 'AND',
          values: [
            {
              condition: 'EQUALS',
              leftOperand: { name: 'two' },
              rightOperand: 45,
            },
            {
              condition: 'EQUALS',
              leftOperand: { name: 'three' },
              rightOperand: true,
            },
            {
              conjunction: 'OR',
              values: [
                {
                  condition: 'EQUALS',
                  leftOperand: { name: 'uno' },
                  rightOperand: 'hello',
                },
                {
                  condition: 'EQUALS',
                  leftOperand: { name: 'uno' },
                  rightOperand: 'something',
                },
              ],
            },
          ],
        },
      ],
    };

    const actual = or(
      q('uno').equals('theValue'),
      and(
        q('two').equals(45),
        q('three').equals(true),
        or(q('uno').equals('hello'), q('uno').equals('something')),
      ),
    );

    expect(actual).toEqual(expected);
  });

  const staticEqualCondition: Condition<Foo> = {
    condition: 'EQUALS',
    leftOperand: { name: 'two' },
    rightOperand: 45,
  };

  const simpleQueryCases = [
    {
      condition: 'EQUALS',
      query: () => q('two').equals(45),
      result: {
        condition: 'EQUALS',
        leftOperand: { name: 'two' },
        rightOperand: 45,
      },
    },
    {
      condition: 'GREATER_THAN',
      query: () => q('two').greaterThan(45),
      result: {
        condition: 'GREATER_THAN',
        leftOperand: { name: 'two' },
        rightOperand: 45,
      },
    },
    {
      condition: 'GREATER_THAN_OR_EQUAL',
      query: () => q('two').greaterThanOrEqual(45),
      result: {
        condition: 'GREATER_THAN_OR_EQUAL',
        leftOperand: { name: 'two' },
        rightOperand: 45,
      },
    },
    {
      condition: 'CONTAINS',
      query: () => q('two').contains([45]),
      result: { condition: 'CONTAINS', leftOperand: { name: 'two' }, rightOperand: [45] },
    },
    {
      condition: 'LESS_THAN',
      query: () => q('two').lessThan(45),
      result: {
        condition: 'LESS_THAN',
        leftOperand: { name: 'two' },
        rightOperand: 45,
      },
    },
    {
      condition: 'LESS_THAN_OR_EQUAL',
      query: () => q('two').lessThanOrEqual(45),
      result: {
        condition: 'LESS_THAN_OR_EQUAL',
        leftOperand: { name: 'two' },
        rightOperand: 45,
      },
    },
    {
      condition: 'NOT_EQUALS',
      query: () => q('two').notEqual(45),
      result: {
        condition: 'NOT_EQUALS',
        leftOperand: { name: 'two' },
        rightOperand: 45,
      },
    },
    {
      condition: 'NOT_CONTAINS',
      query: () => q('two').notContains([45, 55]),
      result: { condition: 'NOT_CONTAINS', leftOperand: { name: 'two' }, rightOperand: [45, 55] },
    },
    {
      condition: 'REGEX',
      query: () => q('two').regex('45'),
      result: { condition: 'REGEX', leftOperand: { name: 'two' }, rightOperand: '45' },
    },
    {
      condition: 'EXISTS',
      query: () => q('two').exists(),
      result: { condition: 'EXISTS', leftOperand: { name: 'two' }, rightOperand: true },
    },
  ];

  test.each(simpleQueryCases)('should handle $condition condition', (testQuery) => {
    const query = testQuery.query();
    expect(query).toEqual(testQuery.result);
  });

  const conjunctionCases = [
    {
      conjunction: 'AND',
      query: () => and(staticEqualCondition),
      result: { conjunction: 'AND', values: [staticEqualCondition] },
    },
    {
      conjunction: 'OR',
      query: () => or(staticEqualCondition),
      result: { conjunction: 'OR', values: [staticEqualCondition] },
    },
    {
      conjunction: 'NOT',
      query: () => not(staticEqualCondition),
      result: { conjunction: 'NOT', values: [staticEqualCondition] },
    },
  ];

  test.each(conjunctionCases)('should handle $conjunction conjunction', (conjunctionQuery) => {
    const query = conjunctionQuery.query();
    expect(query).toEqual(conjunctionQuery.result);
  });

  test('isCondition', () => {
    const condition: Condition<Foo> = {
      condition: 'REGEX',
      leftOperand: { name: 'uno' },
      rightOperand: '',
    };
    expect(isCondition(condition)).toBeTruthy();
    expect(isCondition({})).toBeFalsy();
    expect(isCondition(null)).toBeFalsy();
  });

  test('isConjunction', () => {
    const conjunction: Conjunction = {
      conjunction: 'AND',
      values: [],
    };
    expect(isConjunction(conjunction)).toBeTruthy();
    expect(isConjunction({})).toBeFalsy();
    expect(isConjunction(null)).toBeFalsy();
  });

  test('isSortSpec', () => {
    const sort: SortSpec<Foo> = {
      fields: [{ field: { name: 'uno' }, direction: 'ASCENDING' }],
    };
    expect(isSortSpec(sort)).toBeTruthy();
    expect(isSortSpec({})).toBeFalsy();
  });

  describe('pick and omit', () => {
    const { pick, omit } = QueryBuilder;

    test('pick returns INCLUDE projection with specified fields', () => {
      const expected: Projection<Foo> = {
        fields: ['uno', 'two'],
        mode: 'INCLUDE',
      };
      expect(pick<Foo>('uno', 'two')).toEqual(expected);
    });

    test('omit returns EXCLUDE projection with specified fields', () => {
      const expected: Projection<Foo> = {
        fields: ['three'],
        mode: 'EXCLUDE',
      };
      expect(omit<Foo>('three')).toEqual(expected);
    });

    test('pick with a single field', () => {
      const result = pick<Foo>('uno');
      expect(result).toEqual({ fields: ['uno'], mode: 'INCLUDE' });
    });

    test('omit with multiple fields', () => {
      const result = omit<Foo>('uno', 'two', 'three');
      expect(result).toEqual({ fields: ['uno', 'two', 'three'], mode: 'EXCLUDE' });
    });

    test('isProjection returns true for valid projection', () => {
      expect(isProjection(pick<Foo>('uno'))).toBeTruthy();
      expect(isProjection(omit<Foo>('two'))).toBeTruthy();
    });

    test('isProjection returns false for non-projection objects', () => {
      expect(isProjection({})).toBeFalsy();
      expect(isProjection({ fields: ['uno'] })).toBeFalsy();
      expect(isProjection({ mode: 'INCLUDE' })).toBeFalsy();
      expect(isProjection(null)).toBeFalsy();
    });
  });
});
