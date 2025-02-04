import QueryBuilder, {
  Condition,
  Conjunction,
  isCondition,
  isConjunction,
  isSort,
  Sort,
  SortedAttribute,
} from './query-builder';

describe('Query Builder', () => {
  const {
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
    orderBy,
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

    const actual = or(
      equals<string>('uno', 'theValue'),
      and(
        equals<Foo['two']>('two', 45),
        equals('three', true),
        or(equals('uno', 'hello'), equals('uno', 'something')),
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
      query: () => contains<number>('two', [45]),
      result: { condition: 'CONTAINS', attributeName: 'two', value: [45] },
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
      query: () => notContains<number>('two', [45]),
      result: { condition: 'NOT_CONTAINS', attributeName: 'two', value: [45] },
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
      condition: 'NOT',
      query: () => not(staticEqualCondition),
      result: { conjunction: 'NOT', values: [staticEqualCondition] },
    },
  ];

  test.each(conjunctionCases)('should handle $conjunction conjunction', (conjunctionQuery) => {
    const query = conjunctionQuery.query();
    expect(query).toEqual(conjunctionQuery.result);
  });

  test('should proxy a query passed to the build function', () => {
    const query = or();
    const actual = QueryBuilder.build(query);
    expect(actual).toEqual(query);
  });

  test('should proxy a list of SortDirection when orderBy is called', () => {
    const attributeFoo: SortedAttribute = ['foo', 'ASCENDING'];
    const attributeBar: SortedAttribute = ['bar', 'DESCENDING'];
    expect(orderBy(attributeFoo)).toEqual({ attributes: [attributeFoo] });
    expect(orderBy(attributeFoo, attributeBar)).toEqual({
      attributes: [attributeFoo, attributeBar],
    });
  });

  test('isCondition', () => {
    const condition: Condition = {
      condition: 'REGEX',
      attributeName: '',
      value: '',
    };
    expect(isCondition(condition)).toBeTruthy();
    expect(isCondition({})).toBeFalsy();
  });

  test('isConjunction', () => {
    const conjunction: Conjunction = {
      conjunction: 'AND',
      values: [],
    };
    expect(isConjunction(conjunction)).toBeTruthy();
    expect(isConjunction({})).toBeFalsy();
  });

  test('isSort', () => {
    const sort: Sort = {
      attributes: [['foo', 'ASCENDING']],
    };
    expect(isSort(sort)).toBeTruthy();
    expect(isSort({})).toBeFalsy();
  });
});
