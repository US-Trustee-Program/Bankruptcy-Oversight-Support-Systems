import QueryBuilder, { Condition } from './query-builder';

describe('Query Builder', () => {
  const {
    //find,
    equals,
    greaterThan,
    greaterThanOrEqual,
    contains,
    lessThan,
    lessThanOrEqual,
    notEqual,
    notContains,
    not,
    exists,
    and,
    or,
    regex,
  } = QueryBuilder;

  test('should build correct query tree', () => {
    const { and, or, equals } = QueryBuilder;

    type Foo = {
      uno: string;
      two: number;
      three: boolean;
    };

    const expected = {
      conjunction: 'OR',
      values: [
        { condition: 'EQUALS', attributeName: 'uno', value: 'theValue' },
        {
          conjunction: 'AND',
          values: [
            { condition: 'EQUALS', attributeName: 'two', value: 45 },
            { condition: 'EQUALS', attributeName: 'three', value: true },
            {
              conjunction: 'OR',
              values: [
                { condition: 'EQUALS', attributeName: 'uno', value: 'hello' },
                { condition: 'EQUALS', attributeName: 'uno', value: 'something' },
              ],
            },
          ],
        },
      ],
    };

    const actual = QueryBuilder.build(
      or(
        equals<string>('uno', 'theValue'),
        and(
          equals<Foo['two']>('two', 45),
          equals('three', true),
          or(equals('uno', 'hello'), equals('uno', 'something')),
        ),
      ),
    );

    expect(actual).toEqual(expected);
  });
  const staticEqualCondition: Condition = { condition: 'EQUALS', attributeName: 'two', value: 45 };

  const simpleQueryCases = [
    {
      condition: 'EQUALS',
      query: () => equals('two', 45),
      result: { condition: 'EQUALS', attributeName: 'two', value: 45 },
    },
    {
      condition: 'GREATER_THAN',
      query: () => greaterThan('two', 45),
      result: { condition: 'GREATER_THAN', attributeName: 'two', value: 45 },
    },
    {
      condition: 'GREATER_THAN_OR_EQUAL',
      query: () => greaterThanOrEqual('two', 45),
      result: { condition: 'GREATER_THAN_OR_EQUAL', attributeName: 'two', value: 45 },
    },
    {
      condition: 'CONTAINS',
      query: () => contains('two', 45),
      result: { condition: 'CONTAINS', attributeName: 'two', value: 45 },
    },
    {
      condition: 'LESS_THAN',
      query: () => lessThan('two', 45),
      result: { condition: 'LESS_THAN', attributeName: 'two', value: 45 },
    },
    {
      condition: 'LESS_THAN_OR_EQUAL',
      query: () => lessThanOrEqual('two', 45),
      result: { condition: 'LESS_THAN_OR_EQUAL', attributeName: 'two', value: 45 },
    },
    {
      condition: 'NOT_EQUAL',
      query: () => notEqual('two', 45),
      result: { condition: 'NOT_EQUAL', attributeName: 'two', value: 45 },
    },
    {
      condition: 'NOT_CONTAINS',
      query: () => notContains('two', 45),
      result: { condition: 'NOT_CONTAINS', attributeName: 'two', value: 45 },
    },
    {
      condition: 'REGEX',
      query: () => regex('two', '45'),
      result: { condition: 'REGEX', attributeName: 'two', value: '45' },
    },
    {
      condition: 'EXISTS',
      query: () => exists('two', true),
      result: { condition: 'EXISTS', attributeName: 'two', value: true },
    },
  ];

  test.each(simpleQueryCases)('should handle $condition condition', (testQuery) => {
    const query = QueryBuilder.build(testQuery.query());
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
      condition: 'NOT',
      query: () => not(staticEqualCondition),
      result: { conjunction: 'NOT', values: [staticEqualCondition] },
    },
  ];

  test.each(conjunctionCases)('should handle $conjunction conjunction', (conjunctionQuery) => {
    const query = QueryBuilder.build(conjunctionQuery.query());
    expect(query).toEqual(conjunctionQuery.result);
  });
});
